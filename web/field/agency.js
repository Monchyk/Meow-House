/* agency.js — THE HOUSE'S INITIATIVE.
 *
 *   "The house is an organism with initiative, not merely a reactive interface."
 *
 * house.js is physiology: it reacts, every frame, to what you did. It has no
 * opinion and it never starts anything. This layer sits ABOVE the endocrine
 * model and supplies the thing physiology cannot — the house occasionally
 * DOING something nobody asked for.
 *
 * This is not an AI and it is not dialogue. There is no model, no text
 * generation, no conversation. It is a slow decision layer: seven temperament
 * variables, an urge that accumulates, and a weighted choice of what to do when
 * that urge crosses a threshold.
 *
 *   house.js   = weather    (fast, reactive, per-frame)
 *   agency.js  = temperament (slow, deliberate, minutes)
 *
 * ---------------------------------------------------------------------------
 * THE FUNNEL — read this before adding any emergent behaviour.
 *
 * Every unprompted thing the house ever does must be emitted here as an INTENT
 * and carried out by a subscriber. Music memories, the coincidence engine,
 * house interruptions, remembered songs, a lamp sighing in another room — all
 * of it. The moment one of those grows its own private timer inside render.js
 * or nav.js, the house stops having a personality and starts having bugs: two
 * modules act at once, nothing can be silenced, and "why did it do that?"
 * becomes unanswerable.
 *
 *   AGENCY.on("light", fn)   subscribe
 *   AGENCY.notice(...)       tell agency what the visitor did
 *   AGENCY.push(v, d)        let a subsystem colour the temperament
 *
 * Agency never touches a lamp, a canvas or the DOM itself. It decides; others
 * act. That keeps it fully testable headless, which it is.
 * ---------------------------------------------------------------------------
 *
 * THE SEVEN
 *   curiosity      wants to show you something you have not seen
 *   trust          earned slowly, lost fast; gates whether it acts near you
 *   defensiveness  suppression. a pressed, rushed, overloaded house goes quiet
 *   attention      how much of itself is pointed at you right now
 *   coincidence    appetite for meaningful timing — acting on what you touched
 *   nostalgia      pull toward earlier runs. only really grows across visits
 *   initiative     the disposition to act at all
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  /* deterministic PRNG — the house's whims must be reproducible, or none of
   * this is testable and no bug in it is ever findable twice. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var AGENCY = {
    state: {},          // the seven, 0..1
    urge: 0,            // accumulates; crossing cfg.fireAt = an act
    lastAct: null,      // the most recent intent, for debug overlays
    log: [],            // ring buffer of recent intents (debug)

    _cfg: null,
    _rng: null,
    _subs: {},
    _since: 0,          // s since boot
    _refract: 0,        // s of enforced silence remaining
    _acts: [],          // timestamps, for maxPerMinute
    _ctx: null,

    /* ------------------------------------------------------------- setup */
    init: function (cfg) {
      this._cfg = (cfg || (root.FIELD_CFG && root.FIELD_CFG.agency)) || {};
      this._rng = mulberry32(this._cfg.seed || 1);
      this._subs = {};   // a re-init drops old listeners, or they double-fire
      this.state = {};
      var vars = this._cfg.vars || {};
      for (var k in vars) this.state[k] = vars[k].rest;
      this.urge = 0; this._since = 0; this._refract = 0;
      this._acts = []; this.log = []; this.lastAct = null;
      return this;
    },

    /* ---------------------------------------------------------- pub/sub */
    on: function (kind, fn) {
      (this._subs[kind] = this._subs[kind] || []).push(fn);
      return this;
    },
    off: function (kind, fn) {
      var a = this._subs[kind]; if (!a) return this;
      var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
      return this;
    },
    _emit: function (intent) {
      this.lastAct = intent;
      this.log.push(intent);
      if (this.log.length > 32) this.log.shift();
      var a = (this._subs[intent.kind] || []).concat(this._subs["*"] || []);
      for (var i = 0; i < a.length; i++) {
        try { a[i](intent); } catch (e) { /* a bad listener never stops the house */ }
      }
      return intent;
    },

    /* ------------------------------------------------------- temperament */
    push: function (name, delta) {
      if (!(name in this.state)) return this;
      var rate = (this._cfg.vars[name] || {}).rate || 0.02;
      this.state[name] = clamp(this.state[name] + delta * (rate / 0.02), 0, 1);
      return this;
    },
    get: function (name) { return this.state[name] || 0; },

    /* What the visitor just did. This is the ONLY input path from the walk.
     * kind: "travel" | "develop" | "feel" | "case" | "idle" | "rush" | "back" */
    notice: function (kind, payload) {
      var p = payload || {};
      switch (kind) {
        case "travel":
          this.push("attention", 0.10);
          this.push("curiosity", p.novel ? 0.08 : -0.02);
          this.push("defensiveness", -0.02);
          break;
        case "develop":                       // patience, rewarded
          this.push("trust", 0.12);
          this.push("initiative", 0.06);
          this.push("curiosity", 0.05);
          this.push("defensiveness", -0.06);
          break;
        case "feel":
          this.push("trust", p.match ? 0.08 : -0.04);
          this.push("defensiveness", p.match ? -0.04 : 0.07);
          break;
        case "case":
          this.push("coincidence", 0.12);
          this.push("curiosity", 0.06);
          break;
        case "rush":                          // hammering the buttons
          this.push("defensiveness", 0.09);
          this.push("attention", -0.05);
          this.push("trust", -0.02);
          break;
        case "back":
          this.push("defensiveness", 0.03);
          this.push("curiosity", 0.02);
          break;
        case "idle":                          // stillness invites the house in
          this.push("attention", -0.03);
          this.push("initiative", 0.05);
          this.push("coincidence", 0.03);
          break;
      }
      return this;
    },

    /* -------------------------------------------------------------- tick */
    frame: function (dt, ctx) {
      if (!this._cfg) this.init();
      var c = this._cfg;
      this._ctx = ctx = ctx || {};
      this._since += dt;
      if (this._refract > 0) this._refract -= dt;

      this._drift(dt, ctx);

      /* urge: baseline, shaped by temperament. A defensive house does not
       * reach out; a trusting, initiative-heavy one does. */
      var gate =
        1 +
        this.get("initiative") * (c.enableByInitiative || 0) +
        this.get("trust") * (c.enableByTrust || 0) -
        this.get("defensiveness") * (c.suppressByDefensive || 0);
      this.urge += (c.urgeBase || 0.03) * Math.max(0, gate) * dt;

      if (this._ready()) {
        var intent = this._decide(ctx);
        if (intent && intent.strength >= (c.minStrength || 0)) {
          this.urge = 0;
          this._refract = c.refractory || 20;
          this._acts.push(this._since);
          return this._emit(intent);
        }
        /* nothing worth saying — bleed a little rather than firing junk */
        this.urge *= 0.6;
      }
      return null;
    },

    _ready: function () {
      var c = this._cfg;
      if (this._since < (c.quietStart || 0)) return false;   // arrive in silence
      if (this._refract > 0) return false;
      if (this.urge < (c.fireAt || 1)) return false;
      var cutoff = this._since - 60, n = 0;
      for (var i = 0; i < this._acts.length; i++) if (this._acts[i] > cutoff) n++;
      return n < (c.maxPerMinute || 3);
    },

    /* slow relaxation toward rest, plus pressure from the fast physiology.
     * This is the one place agency READS house.js. */
    _drift: function (dt, ctx) {
      var vars = this._cfg.vars || {}, h = ctx.house;
      for (var k in vars) {
        var v = vars[k];
        this.state[k] += (v.rest - this.state[k]) * v.rate * dt;
      }
      if (h) {
        var load = (h.sensoryLoad || 0), reg = (h.regulation || 0);
        this.push("defensiveness", (load - 0.5) * dt * 0.35);
        this.push("trust", (reg - 0.5) * dt * 0.10);
        this.push("curiosity", ((h.novelty || 0) - 0.5) * dt * 0.20);
      }
      if (ctx.runCount > 1) {          // nostalgia is a cross-visit variable
        this.push("nostalgia", dt * 0.004 * Math.min(ctx.runCount, 6));
      }
      for (var j in this.state) this.state[j] = clamp(this.state[j], 0, 1);
    },

    /* ------------------------------------------------------------ choose */
    _decide: function (ctx) {
      var c = this._cfg, w = c.weights || {}, self = this;
      var kinds = [], total = 0;

      function offer(kind, mult) {
        var base = (w[kind] || 0) * mult;
        if (base <= 0) return;
        kinds.push({ kind: kind, weight: base });
        total += base;
      }

      /* Each kind's appetite is a different blend of the seven — this is where
       * the personality actually lives. */
      offer("light",     0.6 + this.get("initiative") * 0.8);
      offer("field",     0.4 + this.get("curiosity") * 1.1);
      offer("clue",      (ctx.phase >= 2 ? 1 : 0.15) * (0.3 + this.get("trust") * 1.2));
      offer("memory",    (ctx.runCount > 1 ? 1 : 0.1) * (0.2 + this.get("nostalgia") * 1.6));
      offer("music",     0.4 + this.get("coincidence") * 0.9);
      offer("interrupt", Math.max(0, this.get("attention") - 0.6) * 1.5);

      if (!total) return null;
      var r = this._rng() * total, pick = kinds[kinds.length - 1];
      for (var i = 0; i < kinds.length; i++) {
        r -= kinds[i].weight;
        if (r <= 0) { pick = kinds[i]; break; }
      }

      var target = this._target(ctx);
      var strength = clamp(
        0.25 +
        (pick.weight / total) * 0.5 +
        this.get("initiative") * 0.3 -
        this.get("defensiveness") * 0.3, 0, 1);

      return {
        kind: pick.kind,
        strength: strength,
        target: target && target.id,
        origin: target && target.origin,   // "recent" | "memory" | "far" | null
        at: this._since,
        /* machine-readable provenance. NOT prose, never rendered — this exists
         * so "why did it do that?" is always answerable. */
        because: {
          urge: +this.urge.toFixed(3),
          phase: ctx.phase || 1,
          temperament: JSON.parse(JSON.stringify(this.state))
        }
      };
    },

    /* Which star the act should land on. Coincidence pulls toward what you just
     * touched; nostalgia pulls toward earlier runs; otherwise, somewhere else
     * entirely — the house has a life away from you. */
    _target: function (ctx) {
      var c = this._cfg, r = this._rng();
      var recent = ctx.recent || [], remembered = ctx.remembered || [], all = ctx.all || [];
      var wantRecent = this.get("coincidence") * (c.relevanceWeight || 0.5);
      var wantMemory = this.get("nostalgia") * (c.nostalgiaWeight || 0.4);

      if (recent.length && r < wantRecent)
        return { id: recent[(this._rng() * recent.length) | 0], origin: "recent" };
      if (remembered.length && r < wantRecent + wantMemory)
        return { id: remembered[(this._rng() * remembered.length) | 0], origin: "memory" };
      if (all.length)
        return { id: all[(this._rng() * all.length) | 0], origin: "far" };
      return null;
    },

    /* Testing / operator hook: make the house act now, bypassing the wait. */
    provoke: function (ctx) {
      this._refract = 0; this.urge = this._cfg.fireAt || 1;
      this._since = Math.max(this._since, (this._cfg.quietStart || 0) + 1);
      return this.frame(0.0001, ctx || this._ctx || {});
    }
  };

  root.AGENCY = AGENCY;
})();
