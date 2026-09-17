/* house.js — THE STATE BIBLE. The organism DEEP HOUSE is.
 *
 * One shared state. Every room only READS (get/sample) and PUSHES (nudges) —
 * no room invents its own rules. This file is the whole reason the house feels
 * like one nervous system instead of a museum of rooms.
 *
 *   Emotional Physics : each variable has rest, rise/fall gain, decay, and
 *                       threshold→feedback coupling ("everything leaks").
 *   House Pulse       : one heartbeat clock; regulated → phase-lock, entropy → drift.
 *   Endocrine lights  : state → a diffusing light field; lamps SECRETE chemicals
 *                       (stress spreads slow, dopamine bursts, fatigue desaturates).
 *   Mask Layer        : outward (lamps) may diverge from inward (truth) when mask
 *                       is high — with occasional slips that leak the inside.
 *   Memory            : emotional residue persists across visits (localStorage).
 *   Observe           : watches dwell / hesitation / backtracking → weather.
 *
 * Runs in the browser (window) and in a bare vm for logic tests (globalThis),
 * so Hue / localStorage are all optional and guarded.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* HSL (h 0-360, s/l 0-1) → "RRGGBB" (no #, the C# fork's RGBColor format). */
  function hslHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    function f(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
    }
    function hx(v) { var n = Math.round(clamp(v, 0, 1) * 255).toString(16); return n.length < 2 ? "0" + n : n; }
    return hx(r) + hx(g) + hx(b);
  }

  /* tiny stable string hash → 0..1 (for the Hue engine's per-spot warmth field). */
  function hash01(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return (h >>> 0) / 4294967295;
  }

  /* Per-variable physics. Missing fields default sanely. Asymmetry is the point:
   *   up/down = gain applied to positive/negative pushes (rise fast vs fall fast)
   *   decay   = pull-per-second back toward rest (the "falls slow" knob)
   *   feedback= when value>threshold, leak coeff·dt into each neighbour           */
  var CFG = {
    // --- stress family: rises fast, falls slow, leaks into regulation ---
    sensoryLoad:  { rest: 0.18, up: 1.5, down: 0.9, decay: 0.06, threshold: 0.6,
                    feedback: [["regulation", -0.5], ["lightingStability", -0.45], ["entropy", 0.5], ["socialBattery", -0.3]] },
    rumination:   { rest: 0.15, up: 1.3, down: 0.7, decay: 0.05, threshold: 0.55,
                    feedback: [["hope", -0.3], ["flow", -0.4], ["entropy", 0.3]] },
    fatigue:      { rest: 0.2,  up: 1.0, down: 0.4, decay: 0.03, threshold: 0.7,
                    feedback: [["processingBudget", -0.4], ["flow", -0.3]] },
    entropy:      { rest: 0.35, up: 1.2, down: 0.8, decay: 0.12, threshold: 0.65,
                    feedback: [["lightingStability", -0.5], ["narrativeCertainty", -0.4]] },
    // --- fragile-good family: rises slow, collapses fast ---
    trust:        { rest: 0.35, up: 0.5, down: 1.6, decay: 0.02, threshold: 0.6,
                    feedback: [["safety", 0.4], ["mask", -0.3]] },
    safety:       { rest: 0.4,  up: 0.5, down: 1.5, decay: 0.03, threshold: 0.6,
                    feedback: [["regulation", 0.3]] },
    hope:         { rest: 0.4,  up: 0.6, down: 1.2, decay: 0.03 },
    regulation:   { rest: 0.45, up: 0.7, down: 1.1, decay: 0.04, threshold: 0.8,
                    feedback: [["entropy", -0.4], ["symmetry", 0.3]] },
    flow:         { rest: 0.3,  up: 0.8, down: 1.0, decay: 0.06 },
    // --- curiosity: rises on discovery, decays on repetition (handled in observe) ---
    curiosity:    { rest: 0.4,  up: 1.0, down: 0.9, decay: 0.05 },
    novelty:      { rest: 0.5,  up: 1.1, down: 1.0, decay: 0.09 },
    // --- masking / social ---
    mask:         { rest: 0.5,  up: 1.0, down: 0.8, decay: 0.02 },
    socialBattery:{ rest: 0.6,  up: 0.7, down: 1.0, decay: 0.02 },
    // --- gallery-driven ---
    symmetry:     { rest: 0.1,  up: 1.2, down: 1.2, decay: 0.15, threshold: 0.85,
                    feedback: [["regulation", 0.5], ["narrativeCertainty", 0.3]] },
    // --- systems / expression ---
    lightingStability: { rest: 0.7, up: 0.8, down: 1.0, decay: 0.05 },
    narrativeCertainty:{ rest: 0.4, up: 0.7, down: 1.0, decay: 0.04 },
    musicIntensity:    { rest: 0.3, up: 1.0, down: 0.9, decay: 0.07 },
    heartbeat:    { rest: 0.35, up: 1.1, down: 0.7, decay: 0.06 },   // pulse RATE
    breathing:    { rest: 0.5,  up: 0.8, down: 0.8, decay: 0.05 },   // pulse DEPTH
    // --- present-but-mostly-inert until an organ animates them (State Bible completeness) ---
    processingBudget:  { rest: 0.7, up: 0.8, down: 0.8, decay: 0.04 },
    workingMemory:     { rest: 0.6, up: 0.8, down: 0.8, decay: 0.04 },
    alexithymia:       { rest: 0.6, up: 0.6, down: 0.6, decay: 0.02 },
    justiceSensitivity:{ rest: 0.6, up: 0.9, down: 0.7, decay: 0.02 },
    playerConfidence:  { rest: 0.4, up: 0.8, down: 0.9, decay: 0.03 },
    operatorIntent:    { rest: 0.0, up: 1.0, down: 1.0, decay: 0.08 },
    houseMemory:       { rest: 0.0, up: 1.0, down: 1.0, decay: 0.0 }
  };

  var state = {};
  for (var k in CFG) state[k] = CFG[k].rest;

  // dopamine is a transient burst channel that rides on top of the endocrine field
  var dopamine = 0;

  var HOUSE = {
    state: state,
    cfg: CFG,

    get: function (v) { return state[v]; },
    sample: function (list) { var o = {}; for (var i = 0; i < list.length; i++) o[list[i]] = state[list[i]]; return o; },

    /* Rooms nudge; they never set. delta is scaled by the var's rise/fall gain. */
    push: function (v, delta) {
      var c = CFG[v]; if (!c) return;
      var g = delta >= 0 ? (c.up == null ? 1 : c.up) : (c.down == null ? 1 : c.down);
      state[v] = clamp(state[v] + delta * g, 0, 1);
    },

    burstDopamine: function (amt) { dopamine = clamp(dopamine + (amt == null ? 0.6 : amt), 0, 1); },

    /* Discrete operator/world events perturb the weather with physics, not scripts. */
    pulseEvent: function (name) {
      switch (name) {
        case "fire-alarm":       this.push("sensoryLoad", 0.6); this.push("safety", -0.5); this.push("heartbeat", 0.5); break;
        case "compliment":       this.push("trust", 0.15); this.push("hope", 0.2); this.burstDopamine(0.5); break;
        case "favourite-song":   this.push("flow", 0.4); this.push("musicIntensity", 0.4); this.burstDopamine(0.7); break;
        case "someone-laughs":   this.push("novelty", 0.3); this.push("safety", 0.1); break;
        case "sudden-silence":   this.push("sensoryLoad", -0.4); this.push("rumination", 0.2); this.push("breathing", 0.3); break;
        case "interrupted":      this.push("sensoryLoad", 0.4); this.push("workingMemory", -0.4); this.push("flow", -0.5); break;
        case "phone-notif":      this.push("sensoryLoad", 0.25); this.push("novelty", 0.2); break;
        default: break;
      }
      this.push("operatorIntent", 0.4);
    },

    /* Emotional Physics — advance every variable + threshold coupling. */
    _t: 0,
    tick: function (dt) {
      this._t += dt;
      // 1) decay toward rest
      for (var v in CFG) {
        var c = CFG[v];
        state[v] += (c.rest - state[v]) * Math.min(1, c.decay * dt);
      }
      // 2) threshold → feedback coupling (leaks). Computed from a snapshot so
      //    order doesn't matter within a tick.
      var snap = {}; for (var s in state) snap[s] = state[s];
      for (var vv in CFG) {
        var cc = CFG[vv];
        if (!cc.feedback || snap[vv] < (cc.threshold == null ? 2 : cc.threshold)) continue;
        var over = snap[vv] - cc.threshold;
        for (var i = 0; i < cc.feedback.length; i++) {
          var tgt = cc.feedback[i][0], coeff = cc.feedback[i][1];
          if (state[tgt] == null) continue;
          state[tgt] = clamp(state[tgt] + coeff * over * dt, 0, 1);
        }
      }
      dopamine = clamp(dopamine - dt * 0.5, 0, 1); // dopamine burns off fast
    },

    /* House Pulse — one heartbeat for everything to breathe on. */
    _phase: 0,
    pulse: function (dt) {
      if (dt) {
        var rate = 0.4 + state.heartbeat * 1.8;        // Hz-ish
        this._phase = (this._phase + dt * rate) % 1;
      }
      var sync = clamp(state.regulation - state.entropy * 0.8, 0, 1); // 1 = locked, 0 = drifting
      return { phase: this._phase, sync: sync, depth: state.breathing };
    },

    /* Endocrine light field. inward = the truth; outward = what the lamps show
     * (diverges under mask). Returns {inward, outward, slip}. */
    endocrine: function () {
      var st = state;
      // inward affect from the organism
      var valence = clamp((st.hope * 0.4 + st.safety * 0.3 + st.regulation * 0.3 + dopamine * 0.3)
                          - (st.rumination * 0.4 + st.sensoryLoad * 0.4), 0, 1);
      var arousal = clamp(st.sensoryLoad * 0.5 + st.heartbeat * 0.4 + st.musicIntensity * 0.3, 0, 1);
      var bright  = clamp(0.85 - st.fatigue * 0.5 + dopamine * 0.3, 0.1, 1);
      var sat     = clamp(st.narrativeCertainty * 0.5 + st.regulation * 0.4 - st.fatigue * 0.3, 0.05, 1);
      var inward  = { v: valence * 2 - 1, a: arousal, bright: bright, sat: sat };
      // outward masks toward "pleasant" when mask is high
      var m = st.mask;
      var outward = {
        v: lerp(inward.v, 0.5, m * 0.8),
        a: lerp(inward.a, 0.35, m * 0.6),
        bright: lerp(inward.bright, 0.8, m * 0.5),
        sat: lerp(inward.sat, 0.7, m * 0.5)
      };
      // mask slip: when entropy is high the mask flickers, briefly leaking inward
      var slip = (st.entropy > 0.7) && (Math.sin(this._t * 11) > 0.86);
      if (slip) outward = { v: inward.v, a: inward.a, bright: inward.bright, sat: inward.sat };
      return { inward: inward, outward: outward, slip: slip, dopamine: dopamine };
    },

    /* "Order" the lamps should express: 0 = chaos, 1 = symmetry/regulation.
     * Blends the Gallery's σ (state.symmetry) with the house's own regulation
     * vs entropy/stress, so calming anything cools the room and chaos heats it. */
    lightOrder: function () {
      var st = state;
      var truth = clamp(0.5
        + st.symmetry * 0.35 + st.regulation * 0.35
        - st.entropy * 0.5 - st.sensoryLoad * 0.25 - st.rumination * 0.15, 0, 1);
      // The mask hides turmoil: a masked house LOOKS composed (pulled toward a
      // calm-but-not-serene 0.6) unless the mask slips and the inside leaks out.
      var slip = (st.entropy > 0.7) && (Math.sin(this._t * 11) > 0.86);
      return { order: slip ? truth : lerp(truth, 0.6, st.mask * 0.7), slip: slip, truth: truth };
    },

    /* Drive the real lamps through the C# fork's Superfluid flow: a continuous flood
     * from the screen light out to the room's corners, breathing with `order`:
     *   order high (symmetry) → slow tide, COOL blue, soft edges = calm flooding
     *   order low  (chaos)    → fast tide, WARM amber, sharp edges + Sparkle overlay = busy
     * Most ticks are a SOFT param update (Hue.runEffectParams) — the layer's own tide
     * phase keeps running server-side, so retuning color/speed never resets or flashes.
     * Only real transitions (first connect, a slip, or crossing the chaos/order overlay
     * threshold) go through the hard Hue.runEffect switch. Everything guarded — offline
     * Hue never throws. (Feelings/Decks rooms drive their own scenes, excluded by brain.js.) */
    _lightAcc: 0,
    _sinceEmit: 0,
    _lastOrder: -1,
    _lastLight: 0,
    _lastFlow: 0,
    _lightHold: 0,
    _sparkleOn: false,
    /* Called by moments.js the instant a transient effect is fired: for the next
     * `seconds`, emitLights must not rebuild the scene. */
    holdLights: function (seconds) {
      this._lightHold = Math.max(this._lightHold, seconds || 0);
      return this;
    },

    emitLights: function (dt) {
      if (this._lightHold > 0) this._lightHold -= dt;
      this._lightAcc += dt;
      if (this._lightAcc < 0.14) return;                // ~7 Hz ceiling; the gate below decides
      var acc = this._lightAcc;
      this._lightAcc = 0;
      this._sinceEmit += acc;
      if (typeof root.Hue === "undefined" || !root.Hue.runEffect) return;

      var lo = this.lightOrder(), order = lo.order;
      var endo = this.endocrine();
      var out = endo.outward;                            // what the house SHOWS

      /* ── FOUR DIMENSIONS, NOT ONE ────────────────────────────────────────
       * This used to map the single `order` scalar onto every parameter, which
       * meant all 26 state variables collapsed to one amber<->blue slider and
       * every event looked identical. The endocrine field was already computing
       * valence / arousal / brightness / saturation and the lamps threw all of
       * it away. Now each parameter has its own source, so different causes
       * produce visibly different light.
       *
       * The C# layer live-tunes exactly four params (docs/LIGHTING.md §3):
       * color / speed / spread / flowIntensity. Brightness is not one of them —
       * but `color` is HSL and its LIGHTNESS was pinned at 0.55, an entire free
       * dimension. That is now the reward channel. */

      var hue   = lerp(26, 220, order);                  // the amber<->blue spine, kept
      var sat   = clamp(0.55 + out.sat * 0.42, 0.3, 0.97);        // certainty deepens colour
      var light = clamp(0.40 + out.bright * 0.16 + dopamine * 0.34, 0.22, 0.92);
      var hex   = hslHex(hue, sat, light);

      var speed = clamp(lerp(0.22, 1.35, out.a) - order * 0.12, 0.05, 3.0);  // arousal = urgency
      var spread = clamp(lerp(0.20, 0.60, state.entropy), 0.05, 1.0);        // chaos = diffuse
      var flow  = clamp(0.45 + (out.v + 1) / 2 * 0.35 + dopamine * 0.45, 0, 1);

      /* THE SPARKLE OVERLAY IS GONE — see web/field/beds.js.
       *
       * It toggled at a threshold, and toggling an effect layer forces a HARD
       * switch, which rebuilds the whole scene: a binary snap AND a teardown on
       * every crossing. That was the "carnival fair" feel, and it also destroyed
       * any transient effect mid-flight. Hysteresis made it thrash less; it did
       * not make it gradual.
       *
       * The `shimmer` bed replaces it with a continuously-modulated version at
       * priority 2, so the same signal now slides instead of switching, and the
       * ambient never needs a rebuild for it. */
      var wantSparkle = false;

      /* ── RESPONSIVENESS ──────────────────────────────────────────────────
       * dopamine decays in ~2s, so a 0.5s throttle with a 0.05 deadband could
       * miss a reward entirely — the single biggest payoff in the piece often
       * produced no visible light at all. When the house is actually moving we
       * sample fast; when it is idling we fall back to the calm 2 Hz so we are
       * not hammering the bridge. This does not override the model, it just
       * samples an honest signal often enough to see it. */
      var live = dopamine > 0.04 || lo.slip;
      if (!live && this._sinceEmit < 0.5) return;

      var moved = this._lastOrder < 0 ||
                  Math.abs(order - this._lastOrder) >= 0.05 ||
                  Math.abs(light - (this._lastLight || 0)) >= 0.02 ||
                  Math.abs(flow - (this._lastFlow || 0)) >= 0.03;
      if (!lo.slip && !moved && this._sinceEmit < 6) return;
      this._sinceEmit = 0;

      /* MOMENT HOLD. While an earned moment is playing, its effect layer lives
       * inside the running scene — so a rebuild would delete the reward we just
       * fired. During the hold we only ever soft-patch. */
      var holding = this._lightHold > 0;
      if (holding) wantSparkle = this._sparkleOn;

      var needsHardSwitch = !holding &&
        (this._lastOrder < 0 || lo.slip || wantSparkle !== this._sparkleOn);

      /* Never soft-patch before a scene exists, or there is nothing to patch. */
      if (!needsHardSwitch && this._lastOrder < 0) needsHardSwitch = true;
      this._lastOrder = order;
      this._lastLight = light;
      this._lastFlow = flow;
      this._sparkleOn = wantSparkle;

      var ambientParams = {
        color: hex,
        speed: speed.toFixed(2),
        spread: spread.toFixed(2),
        flowIntensity: flow.toFixed(2)
      };

      try {
        if (needsHardSwitch) {
          var req = { AmbientType: "Superfluid", AmbientParams: ambientParams, DurationSeconds: 8 };
          if (wantSparkle) { req.EffectType = "Sparkle"; req.EffectParams = {}; }
          root.Hue.runEffect(req);
        } else {
          root.Hue.runEffectParams({ AmbientType: "Superfluid", AmbientParams: ambientParams });
        }
      } catch (e) { /* offline — the house keeps thinking */ }
    },

    /* What the lamps are currently expressing, for tests and debug overlays.
     * Mirrors emitLights' mapping without touching the bridge. */
    lightReadout: function () {
      var lo = this.lightOrder(), out = this.endocrine().outward;
      return {
        order: lo.order,
        hue: lerp(26, 220, lo.order),
        sat: clamp(0.55 + out.sat * 0.42, 0.3, 0.97),
        light: clamp(0.40 + out.bright * 0.16 + dopamine * 0.34, 0.22, 0.92),
        speed: clamp(lerp(0.22, 1.35, out.a) - lo.order * 0.12, 0.05, 3.0),
        spread: clamp(lerp(0.20, 0.60, state.entropy), 0.05, 1.0),
        flow: clamp(0.45 + (out.v + 1) / 2 * 0.35 + dopamine * 0.45, 0, 1),
        dopamine: dopamine
      };
    },

    /* ── The Hue engine: a probability organ, not a secret dispenser ────────
     * The bottom "Hue" button on the Dimmer is the one people instinctively spam.
     * It does NOT hand out secrets and is NOT a slot machine. Every press STIRS
     * THE ORGANISM: it raises a hidden `attention` accumulator that DECAYS when
     * you stop. Higher attention quietly re-weights rare events — it changes
     * *probability*, never announces itself. The reward is that the world gets
     * STRANGER, not that you won a prize (no jackpots — that breeds spam-to-win).
     *
     *   micro : ~always — a shimmer, a wobble, a breath of dopamine.
     *   slip  : rare, scaled by attention² × warmth — a "reality slip" the UI
     *           performs (a word changes, a date is off; nobody is told). A big
     *           event settles instability (attention drops), so it's self-pacing.
     *   poke  : sustained rapport (attention high) → the house pokes BACK on its
     *           own (lamps flicker, entropy leaks) — interaction becomes two-way.
     *
     * WARMER/COLDER: `warmth(spot)` is a hidden field, seeded per run and slowly
     * drifting, so a cold spot today runs warm tomorrow — THIS is why some
     * secrets take many runs. brain.js calls setContext(spotKey) so the field
     * knows "where" you are (room + exhibit + beat). The engine owns the state;
     * brain.js owns the visible slip (and must never touch the hidden fragments). */
    hue: {
      attention: 0,          // 0..1 rapport / coincidence accumulator
      _seed: (typeof Math !== "undefined" ? (Math.random() * 1e9) | 0 : 12345), // per-run drift
      _spot: "lobby",
      _spotPresses: 0,
      _pokeCd: 0,
      setContext: function (spotKey) {
        spotKey = spotKey || "lobby";
        if (spotKey !== this._spot) { this._spot = spotKey; this._spotPresses = 0; }
      },
      /* hidden 0..1 field: warm = "something is near", drifts over the session. */
      warmth: function () {
        var base = hash01(this._spot + ":" + this._seed);
        return clamp(0.5 + 0.5 * Math.sin(base * 6.2831853 + HOUSE._t * 0.03), 0, 1);
      },
      decay: function (dt) {
        this.attention = clamp(this.attention - dt * 0.035, 0, 1);
        this._pokeCd = Math.max(0, this._pokeCd - dt);
      },
      /* one Hue press → an outcome the UI dresses up. */
      press: function () {
        this._spotPresses++;
        this.attention = clamp(this.attention + 0.06, 0, 1);
        var w = this.warmth();
        // always-on micro juice: a little dopamine, a little novelty
        dopamine = clamp(dopamine + 0.05 + w * 0.05, 0, 1);
        HOUSE.push("novelty", 0.02); HOUSE.push("curiosity", 0.02);
        // escalation: warm spot + repeated presses raise slip odds; cold shrugs
        var slipChance = clamp(0.008
          + this.attention * this.attention * 0.18 * w
          + Math.min(this._spotPresses, 12) * 0.004 * w, 0, 0.6);
        if (Math.random() < slipChance) {
          this.attention = clamp(this.attention - 0.15, 0, 1);   // big event settles the system
          dopamine = clamp(dopamine + 0.25, 0, 1);
          return { kind: "slip", warmth: w, attention: this.attention };
        }
        // reciprocity: high sustained rapport → the house pokes back unbidden
        if (this.attention > 0.7 && this._pokeCd <= 0 && Math.random() < 0.2) {
          this._pokeCd = 6;
          HOUSE.push("lightingStability", -0.15); HOUSE.push("entropy", 0.06);
          return { kind: "poke", warmth: w, attention: this.attention };
        }
        return { kind: "micro", warmth: w, attention: this.attention };
      }
    },

    /* ── House Memory: emotional residue across visits ────────────────────── */
    loadMemory: function () {
      try {
        if (typeof root.localStorage === "undefined") return;
        var raw = root.localStorage.getItem("deephouse.memory");
        if (!raw) return;
        var m = JSON.parse(raw);
        // a tense previous run starts the next slightly on-edge (half residue)
        if (typeof m.rumination === "number") state.rumination = clamp(m.rumination * 0.5, 0, 1);
        if (typeof m.entropy === "number")    state.entropy    = clamp(0.35 + m.entropy * 0.25, 0, 1);
        if (typeof m.trust === "number")      state.trust      = clamp(m.trust * 0.7 + 0.1, 0, 1);
        state.houseMemory = 1;                 // the house remembers something happened
      } catch (e) {}
    },
    saveMemory: function () {
      try {
        if (typeof root.localStorage === "undefined") return;
        root.localStorage.setItem("deephouse.memory", JSON.stringify({
          rumination: state.rumination, entropy: state.entropy, trust: state.trust, at: Date.now()
        }));
      } catch (e) {}
    },

    /* ── Observe the player: dwell, hesitation, backtracking → weather ─────── */
    observe: {
      _lastInputAt: 0, _roomEnteredAt: 0, _backtracks: 0, _inputs: 0,
      room: function (id, now) {
        now = now || Date.now();
        this._roomEnteredAt = now;
        HOUSE.push("novelty", 0.25);          // a new room is novelty
        HOUSE.push("curiosity", 0.15);
      },
      input: function (action, now) {
        now = now || Date.now();
        var gap = this._lastInputAt ? (now - this._lastInputAt) / 1000 : 1;
        this._lastInputAt = now; this._inputs++;
        if (gap > 4) {                         // long hesitation = contemplation
          HOUSE.push("curiosity", 0.05); HOUSE.push("rumination", 0.04);
        } else if (gap < 0.4) {                // rushing = load, less absorption
          HOUSE.push("sensoryLoad", 0.03); HOUSE.push("novelty", -0.05); HOUSE.push("playerConfidence", 0.03);
        }
        if (action === "back") { this._backtracks++; HOUSE.push("curiosity", 0.03); HOUSE.push("playerConfidence", -0.02); }
      }
    },

    /* one call per frame from brain.js */
    frame: function (dt) { this.tick(dt); this.pulse(dt); this.hue.decay(dt); this.emitLights(dt); }
  };

  root.HOUSE = HOUSE;
})();
