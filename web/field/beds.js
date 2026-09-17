/* beds.js — THE MIDDLE TIER.
 *
 *   house.js  ambient   one layer, always on, continuously tuned  (priority 0)
 *   beds.js   TEXTURE   a few layers whose PRESENCE slides        (priority 2-3)
 *   moments.js events    punctuation, seconds long                 (priority 5)
 *
 * Why this exists: with only ambient + events, every state change was a step
 * function. A layer either was or wasn't there, and switching one in required a
 * whole scene rebuild — which is why crossing the symmetry threshold read as
 * carnival flashing rather than as a room changing its mind.
 *
 * A bed is never switched. Its alpha is a continuous function of house state,
 * patched on the same cadence as the ambient, and the C# SustainLayer slews
 * toward whatever we ask for. So "the house is 30% more agitated" is now an
 * expressible sentence, and an event lands on an already-moving room instead of
 * on silence.
 *
 * The layers here are the four the engine can actually sustain — sparse or
 * seamless, no visible start or end. Everything else in the catalog is a
 * pointer (Chase, Scanner), a blackout risk (TheaterChase, Comet write black to
 * their off-lights), or inherently rhythmic (Strobe, Heartbeat, Siren).
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  var BEDS = {
    _cfg: null,
    _state: {},          // id -> { alpha, started, kick }
    _acc: 0,
    enabled: true,

    init: function (cfg) {
      this._cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.beds) || {};
      this._state = {};
      this._acc = 0;
      return this;
    },

    defs: function () { return (this._cfg && this._cfg.layers) || []; },

    /* A moment can shove a bed up; it decays back on its own. This is what makes
     * an event LEAVE THE ROOM CHANGED rather than snapping back to baseline. */
    kick: function (id, amount) {
      var st = this._state[id] || (this._state[id] = { alpha: 0, started: false, kick: 0 });
      st.kick = clamp(st.kick + (amount || 0), 0, 1);
      return this;
    },
    kickAll: function (amount) {
      var d = this.defs();
      for (var i = 0; i < d.length; i++) this.kick(d[i].id, amount * (d[i].kickShare || 1));
      return this;
    },

    /* the alpha a bed WANTS right now, from house state + any live kick */
    targetFor: function (def, house, endo) {
      var v = 0;
      switch (def.driver) {
        case "dopamine":   v = (house.dopamine || 0); break;
        case "arousal":    v = endo ? endo.a : 0; break;
        case "entropy":    v = house.entropy || 0; break;
        case "load":       v = house.sensoryLoad || 0; break;
        case "certainty":  v = house.narrativeCertainty || 0; break;
        default:           v = house[def.driver] || 0;
      }
      var st = this._state[def.id];
      var kick = st ? st.kick : 0;
      var a = def.floor + (def.ceil - def.floor) * clamp(v, 0, 1) + kick * (def.kickGain || 0.3);
      return clamp(a, 0, def.ceil + 0.2);
    },

    /* Patched on the ambient's cadence. Cheap: the engine composites before it
     * transmits, so extra layers cost nothing on the wire. */
    frame: function (dt, house, endo) {
      if (!this.enabled || !root.Hue || !root.Hue.sustain) return;
      var c = this._cfg || {};

      /* decay kicks continuously, even on ticks we don't transmit */
      for (var k in this._state) {
        var s0 = this._state[k];
        if (s0.kick > 0) s0.kick = Math.max(0, s0.kick - dt * (c.kickDecay || 0.35));
      }

      this._acc += dt;
      if (this._acc < (c.patchEvery || 0.2)) return;
      this._acc = 0;

      var defs = this.defs();
      for (var i = 0; i < defs.length; i++) {
        var def = defs[i];
        if (def.enabled === false) continue;
        var st = this._state[def.id] || (this._state[def.id] = { alpha: 0, started: false, kick: 0 });
        var want = this.targetFor(def, house || {}, endo);

        /* Only talk to the bridge when it would actually change something.
         * The slew lives server-side, so we send a target, not a ramp. */
        if (st.started && Math.abs(want - st.alpha) < (c.deadband || 0.02)) continue;
        st.alpha = want;

        try {
          root.Hue.sustain(def.id, st.started ? null : def.layer,
                           st.started ? null : def.params,
                           +want.toFixed(3), def.priority, def.slew || c.slew || 0.35);
          st.started = true;
        } catch (e) { /* offline, or an older C# build — the piece plays on */ }
      }
    },

    stopAll: function () {
      if (!root.Hue || !root.Hue.unsustain) return;
      var defs = this.defs();
      for (var i = 0; i < defs.length; i++) {
        try { root.Hue.unsustain(defs[i].id, 1.5); } catch (e) {}
      }
      this._state = {};
    },

    /* debug readout */
    readout: function () {
      var out = {};
      for (var k in this._state) out[k] = +(this._state[k].alpha || 0).toFixed(2);
      return out;
    }
  };

  root.BEDS = BEDS;
})();
