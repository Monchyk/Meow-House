/* config.js — EVERY TUNABLE IN THE FIELD, IN ONE PLACE.
 *
 * The rule for this file: if a number changes how the piece FEELS, it lives
 * here and nowhere else. Modules read FIELD_CFG; they never hard-code a feel
 * constant. That is what makes the whole thing tweakable without reading code.
 *
 * Grouped by subsystem. Every value is annotated with what moving it does, and
 * which direction is "more".
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  root.FIELD_CFG = {

    /* ---------------------------------------------------------- the walk */
    nav: {
      travelTime: 0.85,      // s, camera ease between stars. higher = dreamier
      travelEase: 2.2,       // ease exponent. higher = more "arrival"
      ringRadius: 46,        // px, selection ring around the current star
      pathMax: 24,           // how far back Esc can walk before the trail forgets
      neighbourSort: "angle" // "angle" | "degree" | "feeling" — ↑↓ ordering
    },

    /* ------------------------------------------------------- the horizon
     * How much of the graph you can see. Driven by BPM from the Decks:
     * fast = wider but noisier, slow = narrow but legible. Stop tapping and
     * it slowly opens (silence is a mechanic).                             */
    horizon: {
      hopsMin: 1,            // hops of edge visible at rest
      hopsMax: 3,            // hops at full tempo
      bpmLow: 60,            // BPM mapping to hopsMin
      bpmHigh: 150,          // BPM mapping to hopsMax
      silenceOpenRate: 0.06, // hops/s the horizon widens with no input
      fadePerHop: 0.45       // each hop out is this fraction as bright
    },

    /* ------------------------------------------------------------ layout */
    layout: {
      seed: 20260720,        // fixed → the field is a PLACE, the same one, always
      iterations: 600,       // settle steps run at boot (headless-cheap)
      repulsion: 2500,       // node-node push. higher = airier
                             // (>2500 goes unstable/asymmetric — check extent)
      springLength: 90,      // preferred edge length
      springK: 0.035,        // edge pull. higher = tighter clusters
      gravity: 0.012,        // pull toward origin, stops drift to infinity
      damping: 0.86,
      theta: 0.8,            // Barnes-Hut opening angle. lower = accurate/slower
      communityPull: 0.35,   // districts cohere. 0 = ignore communities
      hyperPull: 0.0,        // raised by phase 3 — this is the reveal
      relayoutTime: 14.0     // s, eased transition when weights change. SLOW.
    },

    /* ------------------------------------------------------------ render */
    render: {
      /* WORLD → SCREEN. The layout settles to roughly 800x730 world units; at
       * zoom 1 that was a postage stamp on a 1080p screen. This is the knob to
       * turn if the field feels too small or too sprawling — it scales spacing
       * and star size together, so the composition holds. */
      zoom: 1.75,

      starMin: 2.6, starMax: 11.0,  // px radius at zoom 1, mapped from degree
      starGamma: 0.55,              // degree→size curve. lower = flatter
      dimAlpha: 0.10,               // undeveloped, out-of-horizon
      liveAlpha: 0.85,              // developed
      edgeAlpha: 0.16,
      hullAlpha: 0.07,              // hyperedge blobs (phase 3+)
      hullTension: 0.42,
      trailAlpha: 0.30,
      bloom: true,                  // reuse drawSuperfluidBloom from viz/symmetry
      descFade: 0.6                 // s, descriptor cross-fade on travel
    },

    /* ----------------------------------------------------------- develop */
    develop: {
      lockSigma: 0.9,        // σ at which a star is DEVELOPED (matches gallery)
      exhibitByCommunity: true, // a district shares a visual family
      relockable: false      // once developed, stays developed
    },

    /* ------------------------------------------------------------- feel
     * Naming a star's feeling. Match = clean read. Mismatch is NOT failure —
     * the star resolves tinted by YOUR reading instead of its own.          */
    feel: {
      matchPush:    { narrativeCertainty: 0.18, trust: 0.10, regulation: 0.08 },
      mismatchPush: { mask: 0.14, entropy: 0.10, narrativeCertainty: -0.06 },
      keepBothReadings: true
    },

    /* ------------------------------------------------------------ phases
     * The arc. Hysteresis stops flicker at a boundary: you must exceed `enter`
     * to advance and fall below `exit` to fall back.                        */
    phases: {
      hysteresis: 1,

      /* Thresholds. Rebalanced 2026-07-20: the originals (34 developed for
       * phase 4) were ~15 minutes of tuning before the arc resolved, which is
       * longer than anyone stands at an installation and far longer than
       * anyone testing it will tolerate. */
      p2: { developed: 3 },                    // Investigation: cases open
      p3: { casesWalked: 2, developed: 8 },    // Empathy: hyperedges + re-layout
      p4: { developed: 18, casesWalked: 4 },   // Integration: dynamic symmetry

      /* THE HORIZON IS THE ARC.
       * This is the mechanic that makes the four phases legible at all. At
       * phase 1 you see one hop — the house is strange and you are feeling
       * your way. By phase 3 you see everything, which is the only reason the
       * re-layout reads as a revelation: the whole field reorganising is
       * invisible if you can only see your neighbours. The world literally
       * opens as you understand more. */
      horizon: { 1: 1, 2: 2, 3: 99, 4: 99 },

      p3HyperPull: 1.0,                        // layout.hyperPull at phase 3
      p4Breath: 0.05,                          // micro-drift amplitude at rest
      p3HullAlpha: 0.16,                       // hulls must actually be visible
      p4EdgeBoost: 2.2                         // integration: the web is whole
    },

    /* ------------------------------------------------------------- BEDS
     * THE MIDDLE TIER — the fix for "the effect changes are so sudden".
     *
     * A bed is a long-lived layer whose PRESENCE (alpha) is a continuous
     * function of house state, never switched. Between the ambient (priority 0)
     * and events (5). Priorities must be distinct and non-zero: equal
     * priorities sort unstably server-side and one layer silently wins.
     *
     * floor = presence when the driver is at 0 (a bed is never fully absent,
     *         or its arrival is itself a step)
     * ceil  = presence when the driver is at 1
     * Keep ceilings LOW. These are texture, not statements — if you can point
     * at a bed and name it, it is too loud.                                */
    beds: {
      patchEvery: 0.2,       // s between target updates. server-side slew smooths
      deadband: 0.02,        // don't transmit changes smaller than this
      slew: 0.3,             // alpha units/s the server may move. lower = lazier
      kickDecay: 0.35,       // /s a moment's shove fades back to baseline

      layers: [
        {
          /* the room is alive / something was earned. Replaces the old binary
           * Sparkle overlay, which toggled at a threshold and WAS the carnival. */
          id: "shimmer", layer: "Sparkle", priority: 2,
          driver: "dopamine", floor: 0.06, ceil: 0.34,
          kickGain: 0.35, kickShare: 1.0, slew: 0.5,
          params: { color: "FFE4B0", brightness: "55",
                    flashDuration: "2.4", spawnRate: "0.8" }
        },
        {
          /* urgency. A slow spatial swell — at low alpha this reads as the room
           * breathing harder rather than as an effect. */
          id: "swell", layer: "Pulse", priority: 3,
          driver: "arousal", floor: 0.04, ceil: 0.26,
          kickGain: 0.15, kickShare: 0.4, slew: 0.22,
          enabled: true,
          params: { color: "6E7BD0", frequency: "0.35", waveNumber: "2.0",
                    minBri: "20", maxBri: "70" }
        },
        {
          /* things coming apart. Off by default — three beds is probably already
           * too much texture. Turn on once shimmer+swell feel right. */
          id: "unease", layer: "Ripple", priority: 3,
          driver: "entropy", floor: 0.0, ceil: 0.22,
          kickGain: 0.1, kickShare: 0.2, slew: 0.18,
          enabled: false,
          params: { color: "4A8B8C", rippleRate: "0.25", speed: "0.6",
                    ringWidth: "0.6", brightness: "45" }
        }
      ]
    },

    /* ----------------------------------------------------------- AGENCY
     * The house's initiative. See agency.js for what these mean; the short
     * version is that `urge` accumulates and, past `fireAt`, the house DOES
     * something you did not ask for. Everything else shapes what it picks.  */
    agency: {
      seed: 77,

      /* slow variables: rest value + how fast they move (per second).
       * These are an order of magnitude slower than house.js on purpose —
       * house.js is weather, agency is temperament.                        */
      vars: {
        curiosity:     { rest: 0.45, rate: 0.020 },
        trust:         { rest: 0.30, rate: 0.008 },  // slowest to earn
        defensiveness: { rest: 0.25, rate: 0.030 },  // fastest to raise
        attention:     { rest: 0.40, rate: 0.045 },
        coincidence:   { rest: 0.20, rate: 0.015 },
        nostalgia:     { rest: 0.15, rate: 0.006 },  // only grows across runs
        initiative:    { rest: 0.35, rate: 0.012 }
      },

      urgeBase: 0.035,       // /s baseline accumulation
      fireAt: 1.0,           // urge threshold for an act
      refractory: 22.0,      // s of enforced silence after acting
      quietStart: 45.0,      // s at boot before the house may act at all
      maxPerMinute: 3,       // hard ceiling on unprompted acts

      /* defensiveness suppresses, trust and initiative enable */
      suppressByDefensive: 0.8,
      enableByTrust: 0.5,
      enableByInitiative: 0.7,

      /* how strongly the house prefers acting on something you just touched
       * (coincidence) vs something from an earlier run (nostalgia)          */
      relevanceWeight: 0.6,
      nostalgiaWeight: 0.4,

      /* base weights per intent kind — the shape of its personality.
       * Raise one and the house leans that way for every future behaviour. */
      weights: {
        light:     1.0,   // a lamp does something unbidden
        field:     0.8,   // a star lights / the layout breathes somewhere else
        clue:      0.5,   // a fragment surfaces
        memory:    0.4,   // something from a previous visit returns
        music:     0.6,   // tempo drifts, a remembered rhythm
        interrupt: 0.2    // the house cuts across what you were doing
      },

      /* an intent is only worth firing if it clears this. keeps the house
       * from muttering. */
      minStrength: 0.25
    },

    /* ---------------------------------------------------------- progress */
    progress: {
      key: "deephouse.progress",
      schema: 1,
      autosaveEvery: 5.0     // s
    },

    debug: {
      showIds: false,
      showAgency: false,     // overlay the slow vars + urge meter
      forcePhase: 0,         // 0 = off, 1..4 = pin the arc for testing

      /* Reaching phase 4 honestly is ~18 developed stars and 4 walked cases.
       * Set this to 2/3/4 and reload: the field is SEEDED with enough progress
       * to sit just below that phase, so you can watch the real transition fire
       * instead of pinning the end state. Set back to 0 for a real run.
       * (It writes to the save file — debug.wipe clears it.) */
      seedToPhase: 0,
      wipe: false            // true = clear saved progress on load
    }
  };
})();
