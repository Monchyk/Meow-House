/* phases.js — the arc. DESIGN.md:26-32, finally in code.
 *
 *   1 curiosity     the house is strange, nothing is explained
 *   2 investigation cases open, structure starts to persist
 *   3 empathy       the field reorganises around one star. wordless.
 *   4 integration   dynamic symmetry — a living system, not a win screen
 *
 * A pure function of the progress record, plus hysteresis so a visitor sitting
 * exactly on a boundary never sees the field flicker between two states.
 *
 * Nothing here renders or decides anything visual. It answers "where are we in
 * the arc" and hands out the force/render weights that answer implies.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  var Phases = {
    phase: 1,
    _cfg: null,

    init: function (cfg) {
      this._cfg = cfg || (root.FIELD_CFG && root.FIELD_CFG.phases) || {};
      this.phase = 1;
      return this;
    },

    /* what the record would imply with no hysteresis */
    raw: function (p) {
      var c = this._cfg;
      var dev = p.developed || 0, walked = p.casesWalked || 0;
      if (dev >= c.p4.developed && walked >= c.p4.casesWalked) return 4;
      if (walked >= c.p3.casesWalked && dev >= c.p3.developed) return 3;
      if (dev >= c.p2.developed) return 2;
      return 1;
    },

    /* Advance freely; fall back only after slipping clearly below the
     * threshold. In practice progress never decreases, so the fallback exists
     * for the debug/reset path rather than for visitors. */
    update: function (p) {
      var target = this.raw(p);
      if (target > this.phase) this.phase = target;
      else if (target < this.phase) {
        var h = this._cfg.hysteresis || 0;
        var slack = { developed: (p.developed || 0) + h,
                      casesWalked: (p.casesWalked || 0) + h };
        if (this.raw(slack) < this.phase) this.phase = target;
      }
      if (this._cfg.forcePhase) this.phase = this._cfg.forcePhase;
      return this.phase;
    },

    /* The weights the rest of the engine reads. This is the single place the
     * arc becomes visible behaviour. */
    weights: function (phase) {
      var c = this._cfg, ph = phase || this.phase;
      return {
        phase: ph,
        /* layout */
        hyperPull:   ph >= 3 ? (c.p3HyperPull || 1) : 0,
        breath:      ph >= 4 ? (c.p4Breath || 0) : 0,
        /* render */
        showHulls:   ph >= 3,
        hullAlpha:   ph >= 3 ? (c.p3HullAlpha || 0.16) : 0,
        keepLit:     ph >= 2,     // developed stars stay lit between visits
        showDevEdges: ph >= 2,    // edges persist between developed pairs
        edgeBoost:   ph >= 4 ? (c.p4EdgeBoost || 2.2) : 1,
        /* How far you can see. THE arc mechanic — see config.phases.horizon. */
        horizon:     (c.horizon && c.horizon[ph]) || 1,
        /* at phase 3+ the stars that many cases share carry visible weight:
         * the convergence becomes felt just before it becomes structural */
        showShared:  ph >= 3,
        /* rules */
        casesOpen:   ph >= 2,
        cluesEnabled: ph >= 2
      };
    },

    /* debug/authoring only — never rendered */
    name: function (p) {
      return ["", "curiosity", "investigation", "empathy", "integration"][p || this.phase];
    }
  };

  root.PHASES = Phases;
})();
