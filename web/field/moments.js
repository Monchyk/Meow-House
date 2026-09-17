/* moments.js — THE REWARD CHANNEL.
 *
 * agency.js is the one funnel for things the house does UNPROMPTED.
 * moments.js is the one funnel for things you EARNED.
 *
 * Same rule as agency: if a payoff grows its own private timer inside nav or
 * render, the piece stops having a reward language and starts having twitches.
 *
 * ---------------------------------------------------------------------------
 * DESIGN CHOICE — "ride on top", not "take the room" (K., 2026-07-20).
 *
 * A moment does NOT seize the lamps and perform. It pushes the organism hard
 * enough that the ambient endocrine model renders the flare *itself*. Every
 * photon stays an honest readout of the house — there is no theatre layer and
 * no lock. The cost is accepted deliberately: a stressed house mutes your
 * reward, and that is a feature (DESIGN.md — failure is emotional).
 *
 * This only works because emitLights now maps FOUR dimensions instead of one.
 * When every parameter came off a single `order` scalar, every moment produced
 * the identical gesture. Now:
 *
 *   dopamine       -> colour LIGHTNESS + flow      (the flash)
 *   regulation     -> hue toward calm blue         (settling)
 *   narrativeCert. -> saturation                   (things becoming certain)
 *   sensoryLoad    -> speed                        (urgency)
 *   entropy        -> spread                       (things coming apart)
 *
 * PARAM SCALES — the bug that made this whole layer invisible: the C# layers
 * declare brightness on a 10-100 PERCENT scale and ApplyParams does NOT clamp
 * to the declared Min/Max, so sending "1.0" meant 1%, not full. Every value
 * below is in the layer's own declared units. Check them against the live
 * registry with: node tools/check_light_params.js
 *
 * So a resolve (dopamine + regulation + certainty) genuinely looks different
 * from a case completing (certainty + calm) or an interruption (load + entropy),
 * without anyone scripting a light cue.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  /* Each moment is a named push-set plus a screen gesture. `weight` scales the
   * whole thing, so a big star resolving hits harder than a small one. */
  var MOMENTS = {
    /* A star resolves. The biggest earned payoff in the piece. */
    resolve: {
      /* a ring travels out through the real room — the physical twin of the
       * on-screen shockwave travelling the graph */
      light: { effect: "Ripple", seconds: 3.8,
               params: { color: "F2C978", rippleRate: "0.9", speed: "1.5",
                         ringWidth: "0.35", brightness: "100" } },
      dopamine: 1.0,
      push: { regulation: 0.30, narrativeCertainty: 0.24, flow: 0.22,
              symmetry: 0.15, sensoryLoad: -0.10, playerConfidence: 0.15 },
      shock: { strength: 1.0, hops: 3, speed: 2.6 },
      bloom: 1.0
    },

    /* You named a star and the house agreed. Quiet, warm, certain. */
    readMatch: {
      light: { effect: "Sparkle", seconds: 2.2,
               params: { color: "FFE9C0", brightness: "70",
                         flashDuration: "0.6", spawnRate: "3.5" } },
      dopamine: 0.35,
      push: { narrativeCertainty: 0.18, trust: 0.10, regulation: 0.08 },
      shock: { strength: 0.4, hops: 1, speed: 2.2 },
      bloom: 0.4
    },

    /* You named it differently than it names itself. NOT a failure: the house
     * gets defensive, the colour loses certainty, the edges soften. */
    readMiss: {
      /* TWO TRUTHS, in light. The lamps alternate between the feeling YOU named
       * and the one the star names itself — the disagreement made physical
       * without a word of explanation. Colours are injected at fire time. */
      light: { effect: "ColorSwap", seconds: 3.6,
               params: { colorA: "8E7CC3", colorB: "4A8B8C",
                         swapInterval: "0.4", brightness: "65" } },
      dopamine: 0.10,
      push: { mask: 0.14, entropy: 0.10, narrativeCertainty: -0.06 },
      shock: { strength: 0.3, hops: 1, speed: 1.4 },
      bloom: 0.2
    },

    /* Opening a case: the field narrows to one story. A held breath. */
    caseOpen: {
      /* a searchlight: the room starts looking for something */
      light: { effect: "Scanner", seconds: 3.6,
               params: { headColor: "F2C94C", glowColor: "3A3358",
                         speed: "2.5", glowWidth: "2", brightness: "80" } },
      dopamine: 0.25,
      push: { curiosity: 0.20, narrativeCertainty: 0.10, sensoryLoad: 0.05 },
      shock: { strength: 0.5, hops: 2, speed: 2.0 },
      bloom: 0.5
    },

    /* A case fully walked. Certainty, and the room settles. */
    caseWalked: {
      light: { effect: "Comet", seconds: 3.8,
               params: { headColor: "FFF0D0", tailColor: "6E63A8", speed: "0.7",
                         tailLength: "5", headBrightness: "100" } },
      dopamine: 0.7,
      push: { narrativeCertainty: 0.35, regulation: 0.22, hope: 0.15, rumination: -0.12 },
      shock: { strength: 0.8, hops: 4, speed: 2.2 },
      bloom: 0.8
    },

    /* The arc turns. These are the largest state events in the build. Phase 3
     * is deliberately the biggest thing that ever happens to the lamps. */
    phase2: {
      light: { effect: "Wave", seconds: 4.2,
               params: { color: "D4A055", speed: "0.5", waveWidth: "0.5",
                         peakBrightness: "90" } },
      dopamine: 0.6,
      push: { curiosity: 0.25, narrativeCertainty: 0.18, novelty: 0.30 },
      shock: { strength: 0.7, hops: 4, speed: 2.0 },
      bloom: 0.7
    },
    phase3: {
      /* the largest thing that ever happens to the lamps */
      light: { effect: "Fireworks", seconds: 6.0,
               params: { palette: "F2C94C,8E7CC3,F5E6D0,4A8B8C",
                         burstRate: "1.4", radius: "2.0", brightness: "100" } },
      dopamine: 1.0,
      push: { regulation: 0.45, narrativeCertainty: 0.45, symmetry: 0.30,
              entropy: -0.30, rumination: -0.20, hope: 0.25 },
      shock: { strength: 1.0, hops: 99, speed: 1.1 },   // slow wave over everything
      bloom: 1.0
    },
    phase4: {
      /* integration is NOT stillness: the room takes a pulse and keeps it */
      light: { effect: "Heartbeat", seconds: 8.0,
               params: { color: "F5E6D0", syncBpm: "true", brightness: "85" } },
      dopamine: 0.8,
      push: { regulation: 0.5, symmetry: 0.4, entropy: -0.35,
              safety: 0.3, hope: 0.3, sensoryLoad: -0.2 },
      shock: { strength: 0.9, hops: 99, speed: 0.8 },
      bloom: 0.9
    },

    /* The house acting on its own gets a small, different signature — it must
     * never feel like something you earned. */
    agency: {
      /* something crosses the room that you did not ask for */
      light: { effect: "Meteor", seconds: 2.2,
               params: { headColor: "BEB4E0", tailColor: "241F38", count: "2",
                         speed: "1.5", tailLength: "4" } },
      dopamine: 0.2,
      push: { novelty: 0.15 },
      shock: { strength: 0.35, hops: 2, speed: 1.6 },
      bloom: 0.3
    }
  };

  var MOMENTS_API = {
    active: [],        // live shockwaves, drained by the renderer
    last: null,
    _hooks: [],

    on: function (fn) { this._hooks.push(fn); return this; },

    /* Fire a moment. `origin` is the star it happened at (for the shockwave);
     * `weight` scales everything, default 1. */
    fire: function (name, origin, weight, opts) {
      var m = MOMENTS[name];
      if (!m) return null;
      var w = (weight === undefined ? 1 : weight);

      /* The organism still does the AMBIENT work — "ride on top" is unchanged,
       * the continuous field remains an honest readout of the house. */
      if (root.HOUSE) {
        if (m.dopamine) root.HOUSE.burstDopamine(m.dopamine * w);
        for (var k in m.push) root.HOUSE.push(k, m.push[k] * w);
      }

      /* Shove the beds up. This is what stops an event from snapping back to
       * baseline the instant it ends: the room stays a little more awake for a
       * while afterwards and decays down on its own. */
      if (root.BEDS) root.BEDS.kickAll((m.bloom || 0.5) * w * 0.6);

      /* PUNCTUATION. A transient effect layer fired over the running ambient —
       * it never rebuilds the scene, so the tide keeps its phase and there is
       * no 3s attack dip. This is what makes a reward land as an event rather
       * than a slow drift. Guarded: offline Hue, or an older C# build without
       * /effects/pulse, simply does nothing. */
      if (m.light && root.Hue && root.Hue.pulse) {
        var params = {};
        for (var pk in m.light.params) params[pk] = m.light.params[pk];
        if (opts && opts.colorA) params.colorA = String(opts.colorA).replace("#", "");
        if (opts && opts.colorB) params.colorB = String(opts.colorB).replace("#", "");
        /* Lock the ambient out of rebuilding for the life of the pulse (plus a
         * beat), or the very next emitLights hard switch deletes it. */
        if (root.HOUSE && root.HOUSE.holdLights) root.HOUSE.holdLights(m.light.seconds + 0.6);
        try { root.Hue.pulse(m.light.effect, params, m.light.seconds); } catch (e) {}
      }

      var ev = {
        name: name, origin: origin, weight: w,
        shock: m.shock ? { t: 0, strength: m.shock.strength * w,
                           hops: m.shock.hops, speed: m.shock.speed,
                           origin: origin } : null,
        bloom: (m.bloom || 0) * w,
        at: (this._clock || 0)
      };
      if (ev.shock && origin) this.active.push(ev.shock);
      if (this.active.length > 6) this.active.shift();
      this.last = ev;
      for (var i = 0; i < this._hooks.length; i++) {
        try { this._hooks[i](ev); } catch (e) {}
      }
      return ev;
    },

    frame: function (dt) {
      this._clock = (this._clock || 0) + dt;
      for (var i = this.active.length - 1; i >= 0; i--) {
        var s = this.active[i];
        s.t += dt * s.speed;
        if (s.t > (s.hops === 99 ? 8 : s.hops + 1.2)) this.active.splice(i, 1);
      }
    },

    reset: function () { this.active = []; this.last = null; this._clock = 0; return this; },

    /* what the renderer needs: how bright a star should flare right now given
     * every live shockwave, based on its hop distance from each origin */
    flareAt: function (graph, id, hopCache) {
      var total = 0;
      for (var i = 0; i < this.active.length; i++) {
        var s = this.active[i];
        var hops = hopCache && hopCache[i] ? hopCache[i][id] : undefined;
        if (hops === undefined) continue;
        /* a ring: brightest where the wavefront currently is */
        var d = Math.abs(s.t - hops);
        if (d > 1) continue;
        total += (1 - d) * s.strength * Math.max(0, 1 - s.t / 8);
      }
      return total;
    }
  };

  root.MOMENTS = MOMENTS_API;
  root.MOMENT_DEFS = MOMENTS;
})();
