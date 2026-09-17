/* field-room.js — the controller. Owns the constellation room end to end and
 * gives brain.js a small surface to call: boot / act / frame / draw / title.
 *
 * This exists so brain.js does not grow a second brain. brain.js keeps input,
 * the RAF loop, BPM/mic, the Hue organ, the operator relay and the HOUSE
 * coupling; everything about the field lives here.
 *
 * MODES (all four buttons, no fifth):
 *   walk       ↑↓ ring (slot 0 = this star)  Enter travel/examine  Esc retrace
 *   instrument ↑↓ pick an instrument         Enter open            Esc walk
 *   develop    ↑↓ tune chaos→symmetry        Enter next reading    Esc walk
 *   feel       ↑↓ pick a feeling             Enter commit          Esc walk
 *   cases      ↑↓ pick a case                Enter open overlay    Esc walk
 *
 * AGENCY is wired here and only here. The house's unprompted acts arrive as
 * intents and are carried out against the field. Nothing else subscribes.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  var FIELD = {
    ready: false,
    mode: "walk",
    g: null, L: null, nav: null, R: null,
    gallery: null,
    instrumentIndex: 0,
    feelIndex: 0,
    caseIndex: 0,
    hops: 1,
    _t: 0,
    _weights: null,
    _recent: [],
    _pending: null,        // an agency act waiting to be shown
    _notice: null,         // transient on-screen mark (never prose)

    /* ------------------------------------------------------------- boot */
    boot: function (canvas, gallery, hooks) {
      var self = this;
      this.hooks = hooks || {};
      this.gallery = gallery;
      return fetch("constellation.json")
        .then(function (r) { return r.json(); })
        .then(function (doc) {
          self.g = new root.FieldGraph(doc);
          self.L = new root.FieldLayout(self.g, root.FIELD_CFG.layout);
          self.nav = new root.FieldNav(self.g, self.L, root.FIELD_CFG.nav);
          self.R = new root.FieldRender(self.g, self.L, self.nav, root.FIELD_CFG.render);

          root.PROGRESS.init(root.FIELD_CFG.progress).markBoot();
          root.PHASES.init(root.FIELD_CFG.phases);
          self._applyDebug();
          root.DEVELOP.init(root.FIELD_CFG.develop);
          root.CASES.init(self.g, root.PROGRESS);
          root.AGENCY.init(root.FIELD_CFG.agency);
          root.MOMENTS.reset();
          root.BEDS.init(root.FIELD_CFG.beds);
          self._wireAgency();

          self.nav.onArrive(function (id, isStart) { self._arrive(id, isStart); });
          self.nav.start();
          self._weights = root.PHASES.weights();
          self.ready = true;
          return self;
        });
    },

    /* Debug: wipe, or seed the record so the arc can actually be WATCHED.
     * Reaching phase 4 honestly is ~18 developed stars and 4 walked cases; that
     * is right for a visitor and far too slow for anyone testing the thing.
     * seedToPhase fills in just under the target phase, so the real transition
     * still fires in front of you rather than being pinned. */
    _applyDebug: function () {
      var d = root.FIELD_CFG.debug || {};
      if (d.wipe) root.PROGRESS.reset();
      var target = d.seedToPhase | 0;
      if (target < 2 || target > 4) return;

      var cfg = root.FIELD_CFG.phases;
      var need = target === 2 ? { dev: cfg.p2.developed, cases: 0 }
               : target === 3 ? { dev: cfg.p3.developed, cases: cfg.p3.casesWalked }
               : { dev: cfg.p4.developed, cases: cfg.p4.casesWalked };

      /* one short of the gate, so the transition itself is still ahead of you */
      var nodes = this.g.nodes;
      for (var i = 0; i < Math.max(0, need.dev - 1) && i < nodes.length; i++)
        root.PROGRESS.develop(nodes[i].id, 0.95);
      for (var c = 0; c < Math.max(0, need.cases - 1) && c < this.g.cases.length; c++) {
        var cs = this.g.cases[c];
        for (var j = 0; j < cs.nodes.length; j++) root.PROGRESS.visit(cs.nodes[j]);
        root.PROGRESS.walkCase(cs.id);
      }
      root.PHASES.update({
        developed: root.PROGRESS.developedCount(),
        casesWalked: root.PROGRESS.casesWalked()
      });
      root.PROGRESS.save();
    },

    /* --------------------------------------------------------- the house
     * acts. Every unprompted behaviour lands here. */
    _wireAgency: function () {
      var self = this;
      root.AGENCY.on("*", function (intent) {
        self._pending = intent;
        switch (intent.kind) {
          case "light":
            /* the house sighs somewhere: a dopamine flick with no cause */
            if (root.HOUSE) {
              root.HOUSE.burstDopamine(0.25 * intent.strength);
              root.HOUSE.push("lightingStability", -0.05 * intent.strength);
            }
            break;
          case "field":
            /* a star elsewhere brightens for a moment */
            self._notice = { id: intent.target, t: 2.5, kind: "field" };
            break;
          case "clue":
            /* narrative resolves a notch. The fragment slot is intentionally
             * empty — the engine is complete, the writing is K.'s. */
            if (root.HOUSE) root.HOUSE.push("narrativeCertainty", 0.12 * intent.strength);
            self._notice = { id: intent.target, t: 3.0, kind: "clue" };
            break;
          case "memory":
            self._notice = { id: intent.target, t: 3.0, kind: "memory" };
            if (root.HOUSE) root.HOUSE.push("houseMemory", 0.2);
            break;
          case "music":
            if (self.hooks.driftBpm) self.hooks.driftBpm(intent.strength);
            break;
          case "interrupt":
            if (root.HOUSE) {
              root.HOUSE.push("entropy", 0.10 * intent.strength);
              root.HOUSE.push("sensoryLoad", 0.06 * intent.strength);
            }
            self._notice = { id: self.nav.current, t: 1.2, kind: "interrupt" };
            break;
        }
        /* the house acting on its own must never feel like something earned */
        root.MOMENTS.fire("agency", intent.target || self.nav.current,
                          0.6 + intent.strength * 0.5);
        if (self.hooks.onAgency) self.hooks.onAgency(intent);
      });
    },

    /* ---------------------------------------------------------- arrival */
    _arrive: function (id, isStart) {
      var novel = root.PROGRESS.visit(id);
      this._recent.unshift(id);
      if (this._recent.length > 8) this._recent.pop();
      root.AGENCY.notice("travel", { novel: novel });

      var done = root.CASES.checkCompletion();
      if (done) {
        root.MOMENTS.fire("caseWalked", id, 1);
        if (this.hooks.onCaseWalked) this.hooks.onCaseWalked(done);
      }
      this._syncPhase();
      if (!isStart && this.hooks.onArrive) this.hooks.onArrive(id, novel);
    },

    /* The arc. When the phase changes, the layout is re-weighted and the field
     * physically reorganises — slowly. This is the only place that happens. */
    _syncPhase: function () {
      var before = root.PHASES.phase;
      var now = root.PHASES.update({
        developed: root.PROGRESS.developedCount(),
        casesWalked: root.PROGRESS.casesWalked()
      });
      if (now === before) return;
      root.PROGRESS.setPhase(now);
      var prevPull = this._weights ? this._weights.hyperPull : 0;
      this._weights = root.PHASES.weights();
      /* only re-solve when the forces actually changed: phase 2 leaves hyperPull
       * at 0, and re-solving to the same answer burns a layout pass for nothing */
      /* The arc turning is the largest state event in the build. Phase 3 fires
       * from the HUB so the wave sweeps the whole field from the star every
       * case shares — wordlessly, exactly like the re-layout it accompanies. */
      var from = (now >= 3) ? this.g.hub : this.nav.current;
      root.MOMENTS.fire("phase" + now, from, 1);

      if (this._weights.hyperPull !== prevPull) {
        this.L.reweight({ hyperPull: this._weights.hyperPull },
                        root.FIELD_CFG.layout.relayoutTime);
      }
      if (this.hooks.onPhase) this.hooks.onPhase(now, before);
    },

    /* ------------------------------------------------------------ input */
    act: function (action) {
      if (!this.ready) return;
      var n = this.nav, P = root.PROGRESS;

      if (this.mode === "walk") {
        if (action === "up") n.up();
        else if (action === "down") n.down();
        else if (action === "select") {
          if (n.onSelf()) { this.mode = "instrument"; this.instrumentIndex = 0; }
          else n.travel();
        } else if (action === "back") {
          if (root.CASES.active) root.CASES.close();
          else n.back();
        }
        return;
      }

      if (this.mode === "instrument") {
        var items = this.instruments();
        if (action === "up") this.instrumentIndex = (this.instrumentIndex + items.length - 1) % items.length;
        else if (action === "down") this.instrumentIndex = (this.instrumentIndex + 1) % items.length;
        else if (action === "select") this._open(items[this.instrumentIndex].id);
        else if (action === "back") this.mode = "walk";
        return;
      }

      if (this.mode === "develop") {
        var g = this.gallery;
        if (action === "up") g.nudge(+1);
        else if (action === "down") g.nudge(-1);
        else if (action === "select") { this.mode = "feel"; this.feelIndex = 0; }
        else if (action === "back") this.mode = "walk";
        return;
      }

      if (this.mode === "feel") {
        var E = root.EMOTIONS || [];
        if (action === "up") this.feelIndex = (this.feelIndex + E.length - 1) % E.length;
        else if (action === "down") this.feelIndex = (this.feelIndex + 1) % E.length;
        else if (action === "select") { this._commitReading(); this.mode = "walk"; }
        else if (action === "back") this.mode = "walk";
        return;
      }

      if (this.mode === "cases") {
        var list = root.CASES.suggest();
        if (!list.length) { this.mode = "walk"; return; }
        if (action === "up") this.caseIndex = (this.caseIndex + list.length - 1) % list.length;
        else if (action === "down") this.caseIndex = (this.caseIndex + 1) % list.length;
        else if (action === "select") {
          root.CASES.open(list[this.caseIndex % list.length].id);
          this._everOpenedCase = true;
          root.MOMENTS.fire("caseOpen", this.nav.current, 1);
          root.AGENCY.notice("case", {});
          this.mode = "walk";
        } else if (action === "back") this.mode = "walk";
        return;
      }
    },

    instruments: function () {
      var out = [{ id: "develop", label: "develop" }, { id: "feel", label: "name it" }];
      if (this._weights && this._weights.casesOpen) out.push({ id: "cases", label: "cases" });
      return out;
    },

    _open: function (id) {
      if (id === "develop") {
        root.DEVELOP.open(this.gallery, this.node());
        this.gallery.index = root.DEVELOP.bind(this.gallery, this.node());
        this.mode = "develop";
      } else if (id === "feel") { this.mode = "feel"; this.feelIndex = 0; }
      else if (id === "cases") { this.mode = "cases"; this.caseIndex = 0; }
    },

    /* Naming a star's feeling. A mismatch is NOT a failure — the star still
     * resolves, but tinted by YOUR reading rather than its own, and the
     * divergence is what feeds the mask. DESIGN.md: failure is emotional. */
    _commitReading: function () {
      var E = root.EMOTIONS || [], f = E[this.feelIndex];
      var node = this.node();
      if (!f || !node) return;
      var match = (f.feeling === node.f);
      root.PROGRESS.read(node.id, f.feeling, match);
      root.AGENCY.notice("feel", { match: match });
      /* the pushes live in MOMENTS now, so the reward language is in one place */
      /* On a mismatch the lamps alternate between YOUR reading and the star's
       * own — Two Truths, rendered in light, with nothing explained. */
      var theirs = null, E2 = root.EMOTIONS || [];
      for (var e2 = 0; e2 < E2.length; e2++) if (E2[e2].feeling === node.f) theirs = E2[e2];
      root.MOMENTS.fire(match ? "readMatch" : "readMiss", node.id, 1,
                        match ? null : { colorA: f.hex, colorB: (theirs && theirs.hex) || node.hex });
      if (this.hooks.onReading) this.hooks.onReading(node, f, match);
    },

    /* ------------------------------------------------------------- tick */
    frame: function (dt, houseState) {
      if (!this.ready) return;
      this._t += dt;
      this.L.frame(dt);
      this.nav.frame(dt);
      root.MOMENTS.frame(dt);
      /* the middle tier: bed presence follows house state continuously */
      if (root.BEDS && root.HOUSE) {
        root.BEDS.frame(dt, root.HOUSE.state, root.HOUSE.endocrine().outward);
      }
      root.PROGRESS.frame(dt);
      if (this._notice) { this._notice.t -= dt; if (this._notice.t <= 0) this._notice = null; }

      /* Horizon = tempo, floored by the arc. The phase floor is the important
       * half: it is what makes the four phases legible, and without it the
       * phase-3 re-layout happens entirely off-screen. */
      var hc = root.FIELD_CFG.horizon, bpm = (this.hooks.bpm && this.hooks.bpm()) || 120;
      var f = Math.max(0, Math.min(1, (bpm - hc.bpmLow) / (hc.bpmHigh - hc.bpmLow)));
      var tempoHops = hc.hopsMin + f * (hc.hopsMax - hc.hopsMin);
      var phaseHops = (this._weights && this._weights.horizon) || 1;
      this.hops = Math.max(tempoHops, phaseHops);

      /* the house's own initiative */
      root.AGENCY.frame(dt, {
        house: houseState || (root.HOUSE && root.HOUSE.state) || {},
        phase: root.PHASES.phase,
        runCount: root.PROGRESS.runCount(),
        recent: this._recent,
        remembered: root.PROGRESS.remembered(),
        all: this.g.nodes.map(function (n) { return n.id; })
      });

      /* σ-lock while developing */
      if (this.mode === "develop" && this.gallery) {
        if (root.DEVELOP.check(this.gallery, this.node(), root.PROGRESS)) {
          root.AGENCY.notice("develop", {});
          /* the biggest earned payoff in the piece — scale it by how connected
           * the star is, so resolving a hub genuinely lands harder */
          var nd = this.node();
          root.MOMENTS.fire("resolve", nd.id,
                            0.8 + Math.min(nd.deg, 30) / 30 * 0.5);
          this._syncPhase();
          if (this.hooks.onDevelop) this.hooks.onDevelop(this.node());
        }
      }
    },

    /* ------------------------------------------------------------- draw */
    draw: function (ctx, w, h, dt) {
      if (!this.ready) return;
      /* when a case is open, point at the next anchor you have not stood on */
      var step = root.CASES.active ? root.CASES.nextStep(this.nav.current) : null;
      this.R.draw(ctx, w, h, dt, {
        weights: this._weights,
        progress: root.PROGRESS,
        highlight: root.CASES.highlighted(),
        hops: this.hops,
        fade: 0.22,
        guideTo: step && step.next
      });
      var node = this.node();
      if (this.mode === "walk" || this.mode === "instrument") {
        var onSelf = this.nav.onSelf();
        var target = onSelf ? node : this.g.get(this.nav.selected());
        var resolved = target && root.PROGRESS.isDeveloped(target.id);
        var cur = root.CASES.current();
        var st = cur ? root.CASES.progressOf(cur.id) : null;
        this.R.hud(ctx, w, h, target, null, {
          state: resolved ? "resolved" : "unresolved",
          /* the verb changes with the slot, so Enter is never ambiguous */
          action: onSelf ? "↳ look at this one" : "↳ go there",
          developed: root.PROGRESS.developedCount(),
          total: this.g.nodes.length,
          caseTitle: cur && cur.title,
          caseSeen: st && st.seen,
          caseTotal: st && st.total,
          /* cases exist now and you have never opened one */
          newInstrument: !!(this._weights && this._weights.casesOpen &&
                            !root.CASES.active && root.PROGRESS.casesWalked() === 0 &&
                            !this._everOpenedCase)
        });
      }
      /* the house's unprompted mark: a ring around a star you did not choose */
      if (this._notice && this._notice.id) {
        var p = this.nav.project(this._notice.id, w, h);
        if (p) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14 + (3 - this._notice.t) * 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(242,201,120," + Math.max(0, this._notice.t / 3 * 0.5) + ")";
          ctx.stroke();
          ctx.restore();
        }
      }
    },

    node: function () { return this.ready ? this.g.get(this.nav.current) : null; },

    title: function () {
      if (!this.ready) return "DEEP HOUSE";
      return { walk: "", instrument: "", develop: "", feel: "NAME IT", cases: "THE CASES" }[this.mode] || "";
    },

    hint: function () {
      /* Enter means two different things depending on the slot, so the hint
       * has to follow the selection or it actively misleads. */
      if (this.mode === "walk" && this.ready) {
        return this.nav.onSelf()
          ? "↑ ↓ look around · Enter examine this one · Esc back"
          : "↑ ↓ look around · Enter travel there · Esc back";
      }
      return {
        walk: "↑ ↓ look around · Enter travel there · Esc back",
        instrument: "↑ ↓ choose · Enter open · Esc back",
        develop: "↑ ↓ tune toward symmetry (σ 0.9 resolves it) · Enter name it · Esc back",
        feel: "↑ ↓ choose · Enter commit · Esc back",
        cases: "↑ ↓ choose a case · Enter follow it · Esc back"
      }[this.mode] || "";
    },

    /* a stable key for the Hue engine's warmth field */
    spotKey: function () {
      return this.ready ? ("field:" + this.mode + ":" + this.nav.current) : "field";
    }
  };

  root.FIELD = FIELD;
})();
