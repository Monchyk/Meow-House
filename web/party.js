/* party.js — THE PARTY ORGANISM. Sibling to house.js, different organism.
 *
 * One decaying "business" state drives everything: the physical lamps (via
 * GlobalEnergy through hue.js) and the screen spiral (read directly). The room
 * is always winding down toward a floor; people push back with the Hue remote.
 *
 *   Business   : 0..1. Holding Bright↑ drives it up (faster/vivider/warmer),
 *                Bright↓ down. Left alone it DECAYS to `floor` over ~30-60 min.
 *                Pushed below floor it AUTO-CLIMBS back — the hand can't flatline it.
 *   Two modes  : "spiral" (default) and "light" — Power-short toggles which the
 *                Hue button browses/commits. Bright always drives business.
 *   Two lists  : spiralPlaylist + lightPlaylist. Independent cursors, both advance
 *                one step on each decay-TROUGH (when business bottoms at the floor).
 *                Uneven lengths ⇒ pairings phase against each other (Reich-style).
 *   Unlock     : browse only UNLOCKED catalog items; committing one to a playlist
 *                unlocks the next locked item — and when the hand-authored catalog
 *                is exhausted, MINTS a fresh one via palettes.js (the overflow valve).
 *   Colour     : light-scenes point at a palettes.js scheme (the atlas owns colour).
 *                Contrast caps how energetic the room can get; motion shapes the spiral.
 *   Toasts     : ephemeral cues (mode change, unlock) via onToast listeners.
 *
 * Runs in the browser (window) and in a bare vm/node for logic tests (globalThis),
 * so localStorage is optional and guarded — same discipline as house.js.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // palettes.js — global in the browser (script order), require() under node.
  function P() {
    if (root.PALETTES) return root.PALETTES;
    try { return (typeof require !== "undefined") ? require("./palettes.js") : null; } catch (e) { return null; }
  }
  var FALLBACK = ["8E7CC3", "6C6896", "F2C978"]; // if palettes.js somehow absent

  /* ── Catalog. `u:true` = unlocked from the start; the rest unlock by commit.
     Light-scenes: id = the C# scene/mood to POST; paletteId = atlas scheme (colour).
     Scene↔scheme pairing is a curation/taste call (Fable's proposal, K. may reshuffle). */
  /* The spiral catalog IS the exhibit list. Each id is the exact `title` of an
     exhibit in viz/symmetry.js, which is how the screen finds the shape — the name
     is the lookup key, so it means something. Previously these were five invented
     names (`Trefoil Gyre`…) HASHED into a 13-exhibit pool: the name promised a shape
     it did not deliver, and 25 of the 38 exhibits could never appear at all.

     Kept as a literal rather than imported from symmetry.js on purpose: this file
     must stay dependency-free so it runs in a bare node vm for the tests. The two
     lists are bound instead by `catalog.test.js`, which asserts set-equality — that
     test is what stops them drifting apart again.

     All unlocked: with real shapes there is nothing to earn by hiding them, and the
     room is meant to run itself through the whole set. Order follows symmetry.js's
     own EXHIBITS order, which runs roughly gentle → loud. */
  var SPIRAL_TITLES = [
    "Lissajous", "Harmonograph", "Rose curve", "Roots of unity", "Phyllotaxis",
    "Clifford attractor", "De Jong attractor", "Hopalong", "Superformula",
    "Chladni plate", "Ulam spiral", "Maurer rose", "Times-table cardioid",
    "Spirograph", "Star polygon", "Cellular automaton", "Flocking", "Game of Life",
    "Lorenz attractor", "Truchet tiles", "Julia set", "Moiré interference",
    "Mandelbrot set", "Logarithmic spiral", "Koch snowflake", "Newton fractal",
    "Fermat spiral", "Hyperbolic spiral", "Euler spiral", "Spiral of Theodorus",
    "Dragon curve", "Hilbert curve", "Hypocycloid", "Lemniscate", "Mystic rose",
    "Chaos game", "Ford circles", "Sacks spiral", "Double helix",
    "Galaxy", "Spherical spiral", "Torus knot", "Guilloché",
    "Torus", "Superellipse bloom", "Kuramoto fireflies", "Quasicrystal", "Epicycloid gears",
    "Aizawa attractor", "Thomas attractor", "Flow field", "Metaballs", "Mandala",
    "String art", "Standing wave", "Voronoi shatter", "Barnsley fern", "Supershape",
    "Reaction diffusion", "Icosahedron",
    "Plasma", "Kaleidoscope", "Doyle spiral", "Recamán", "Involute spiral", "Sierpiński carpet",
  ];
  var SPIRALS = SPIRAL_TITLES.map(function (t) { return { id: t, u: true, off: false, ovl: true }; });
  var LIGHTS = [
    { id: "Calm Tide",    paletteId: "Deep Ocean",  u: true  },
    { id: "Drift",        paletteId: "Aurora",      u: true  },
    { id: "Glow",         paletteId: "White Lotus", u: false },
    { id: "Dream",        paletteId: "Dream Bloom", u: false },
    { id: "Cozy",         paletteId: "Solar Temple",u: false },
    { id: "Sunset Drift", paletteId: "Sacred Fire", u: false },
  ];
  /* ── COLOUR MODE CARDS ─────────────────────────────────────────────────────
     K.: *"colour mode cards, so it basically just can cycle through the whole colour
     spectrum. either 1 colour, split colours, or random colours… make some that are
     very nice and slow transitions. make some that have a bit of a fire effect every
     now and then. make the lights dance around by having a small little effect that
     travels through the light locations."*

     A normal light-scene is STATIC DATA — one atlas scheme, fixed. A card is a
     light-scene that is a BEHAVIOUR: `emit(t, business)` returns a palette plus lamp
     parameter overrides, so it can rotate, split, flare or travel. They are ordinary
     catalog entries, so they appear in the Light catalog, join playlists, can be
     vetoed, and attract mode cycles them like anything else.

     Everything here is built from the eight Superfluid knobs that
     `/api/effects/params` actually exposes (docs/HUE-API.md): color, palette, speed,
     spread, flowIntensity, colorSpan, colorDrift, brightBand. **No C# change**, which
     is what keeps this in one repo. Two documented traps respected: unknown keys are
     silently ignored (the endpoint returns softUpdate:true having applied nothing),
     and the published ranges are NOT clamped for you.

     No Math.random anywhere — a card is a pure function of its own clock, so a run
     replays exactly like the rest of this file. */
  function hsv(h, s, v) {
    var pal = P();
    return pal && pal.hsvHex ? pal.hsvHex(h, s, v) : "8E7CC3";
  }
  // Sine in 0..1, period `per` seconds. Cards are built from these rather than from
  // raw time so nothing drifts out of phase after an hour.
  function osc(t, per, phase) { return 0.5 + 0.5 * Math.sin((t / per + (phase || 0)) * 2 * Math.PI); }
  function PARTY_uniqueId(list, name) {
    var taken = {}, i;
    for (i = 0; i < list.length; i++) taken[list[i].id] = 1;
    if (!taken[name]) return name;
    for (i = 2; i < 999; i++) if (!taken[name + " " + i]) return name + " " + i;
    return name + " " + list.length;
  }

  var CARDS = [
    { id: "Spectrum", u: true,
      hint: "one slow walk through the entire hue wheel",
      emit: function (t, b) {
        // ~15 min a lap at rest, ~8 pushed. A card is a deliberate mode, not ambient
        // wallpaper — but on screen the palette walks the whole spiral, so it has to be
        // SLOW to not read as a strobe. K.: "way too fast" at the old 5-min lap.
        var lap = 900 - b * 420, base = (t / lap) * 360;
        return { palette: [0, 20, 40, 20].map(function (d, i) { return hsv(base + d, 0.85, i === 0 ? 0.95 : 0.8); }),
                 params: { colorSpan: 1.4, colorDrift: 0.03 + b * 0.04, spread: 0.6 } };
      } },

    { id: "Monochrome", u: true,
      hint: "a single hue, only depth moving",
      emit: function (t, b) {
        var hue = 205 + 25 * Math.sin(t / 900 * 2 * Math.PI);   // barely wanders
        var v = 0.72 + 0.2 * osc(t, 180);
        return { palette: [hsv(hue, 0.9, v), hsv(hue, 0.55, v * 0.8), hsv(hue, 0.95, v * 0.6), hsv(hue, 0.55, v * 0.8)],
                 params: { colorSpan: 0.4, colorDrift: 0.02, spread: 0.75, brightBand: 0.22 } };
      } },

    // Colored-shadows rig (docs/COLORED-SHADOWS.md roster 1.2, "Complement Reveal").
    // Deliberately BOLD/COARSE/SATURATED on a dark ground: overlapping physical lamp
    // light destroys fine detail, so detail here is a liability, not a loss. Pair with
    // a CYAN lamp flood; a body blocking the lamp makes this blaze inside the silhouette.
    { id: "Shadow Red", u: true,
      hint: "one saturated red, dark ground — the beamer half of the colored-shadow rig",
      emit: function (t, b) {
        var hue = 0 + 8 * Math.sin(t / 1400 * 2 * Math.PI);     // stays red, barely breathes
        var v = 0.9 + 0.08 * osc(t, 220);
        return { palette: [hsv(hue, 1, v), hsv(hue, 1, v * 0.35), hsv(hue, 1, v * 0.9), hsv(hue, 1, v * 0.25)],
                 params: { colorSpan: 0.12, colorDrift: 0.0, spread: 0.55, brightBand: 0.5 } };
      } },

    // Same rig, DARKER. Cyan flood is at its ceiling (/api/brightness only dims), so the
    // only remaining balance lever is the beamer: dim the projection until the lit wall
    // washes pale. Doc: "purer lamp shadows come from a darker projection."
    { id: "Shadow Red Dim", u: true,
      hint: "Shadow Red at half level — use when the cyan flood can't wash the wall pale",
      emit: function (t, b) {
        var hue = 0 + 8 * Math.sin(t / 1400 * 2 * Math.PI);
        var v = 0.5 + 0.05 * osc(t, 220);
        return { palette: [hsv(hue, 1, v), hsv(hue, 1, v * 0.3), hsv(hue, 1, v * 0.9), hsv(hue, 1, v * 0.2)],
                 params: { colorSpan: 0.12, colorDrift: 0.0, spread: 0.55, brightBand: 0.5 } };
      } },

    { id: "Split", u: true,
      hint: "two opposite hues sharing the room",
      emit: function (t, b) {
        var a = (t / 900) * 360;
        return { palette: [hsv(a, 0.9, 0.92), hsv(a + 180, 0.85, 0.8), hsv(a, 0.9, 0.92), hsv(a + 180, 0.85, 0.8)],
                 params: { colorSpan: 2.0, colorDrift: 0.02 + b * 0.03, spread: 0.45 } };
      } },

    { id: "Triad", u: true,
      hint: "three evenly spaced hues",
      emit: function (t, b) {
        var a = (t / 1100) * 360;
        return { palette: [hsv(a, 0.88, 0.92), hsv(a + 120, 0.88, 0.85), hsv(a + 240, 0.88, 0.85), hsv(a + 120, 0.88, 0.85)],
                 params: { colorSpan: 2.6, colorDrift: 0.03, spread: 0.4 } };
      } },

    { id: "Wander", u: true,
      hint: "new hues chosen slowly, never the same way twice",
      emit: function (t, b) {
        // Seeded from the step index, so it wanders without Math.random.
        var step = Math.floor(t / 100), f = (t % 100) / 100;
        function pick(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 360; }
        var a = pick(step), nx = pick(step + 1);
        var hue = a + ((((nx - a) % 360) + 540) % 360 - 180) * (f * f * (3 - 2 * f));  // shortest path, eased
        return { palette: [hsv(hue, 0.85, 0.92), hsv(hue + 35, 0.8, 0.82), hsv(hue - 35, 0.8, 0.82), hsv(hue + 35, 0.8, 0.82)],
                 params: { colorSpan: 1.2, colorDrift: 0.03, spread: 0.6 } };
      } },

    { id: "Ember", u: true,
      hint: "warm and low, with an occasional flare",
      emit: function (t, b) {
        // The one card that deliberately spikes. Kept legal: the flare moves FLOW and
        // SPEED, never brightness — a lamp swinging wide reads as flashing (invariant
        // 3) — it is rare rather than rhythmic (three slow oscillators beating against
        // each other), and effectiveEnergy()/energyCap still cap what reaches the room.
        var g = osc(t, 90) * osc(t, 57) * osc(t, 27);
        var flare = g > 0.55 ? (g - 0.55) / 0.45 : 0;
        var hue = 18 + 26 * osc(t, 170) + flare * 14;
        return { palette: [hsv(hue, 0.95, 0.85 + flare * 0.15), hsv(hue - 12, 0.98, 0.55),
                           hsv(hue + 22, 0.85, 0.7 + flare * 0.2), hsv(hue - 12, 0.98, 0.55)],
                 params: { colorSpan: 0.8, colorDrift: 0.03 + flare * 0.10, spread: 0.5,
                           flowIntensity: 0.5 + flare * 0.45, speed: 0.12 + flare * 0.5 } };
      } },

    { id: "Runner", u: true,
      hint: "a narrow band travelling through the lamps",
      emit: function (t, b) {
        // The "dancing" one. HONEST LIMIT: the single Superfluid layer positions colour
        // by DISTANCE from the screen, so this is a compact band moving out through the
        // room, not a lamp-by-lamp chase in physical order. A true positional chase
        // needs a new C# layer — see PARTY-BRIEF §21.
        var hue = (t / 600) * 360;
        return { palette: [hsv(hue, 0.9, 0.95), hsv(hue + 60, 0.85, 0.5), hsv(hue + 120, 0.9, 0.8), hsv(hue + 60, 0.85, 0.5)],
                 params: { spread: 0.10, colorSpan: 3.4, colorDrift: 0.14 + b * 0.16,
                           speed: 0.22 + b * 0.33, flowIntensity: 0.9 } };
      } },
  ];
  // An id is the playlist key, the localStorage key and the dashboard key, so a
  // collision silently merges two entries — "Drift" the card once shadowed "Drift" the
  // static scheme, and the card simply stopped emitting. Renaming was the fix; this
  // makes the next one impossible instead of careful.
  CARDS.forEach(function (c) {
    c.card = true;
    c.id = PARTY_uniqueId(LIGHTS, c.id);
    LIGHTS.push(c);
  });

  var STATIC_SPIRALS = SPIRALS.length, STATIC_LIGHTS = LIGHTS.length;

  /* ── PRESETS — set-and-forget looks ────────────────────────────────────────
     K.: *"some presets with explanation as how these presets will work… set and
     forget buttons that change the outcome of the spirals on a whiff."*

     A preset is a PARTIAL block of settings, not a full desk state. It names the
     handful of knobs that make its look and leaves everything else alone, so
     stacking two of them is a legitimate move (deep dive + swarm) rather than the
     second one silently undoing the first. The exhibit on screen is untouched —
     a preset changes HOW whatever is running behaves, which is why one button can
     change the outcome of every spiral at once.

     `why` is the line the dashboard prints under the button, and the rule for it is
     the rule for the tuning desk: describe the ROOM, not the maths. It is read in a
     dark room by someone who did not write this.

     Saved presets (the "save as…" button) are different in kind: a full snapshot of
     the desk, kept in localStorage on the master. They are listed alongside these
     and marked, because "why did loading mine change things this one didn't" is
     otherwise a mystery. */
  var PRESETS = [
    /* THE ROOM — how the installation behaves as a machine: how hard it can be driven,
       how fast it forgets, how bright it is allowed to get. These are the "set it and
       stop thinking about it" ones; the spiral looks below are the ones you press for
       effect. Same partial-block rule, so a room preset and a look compose. */
    { id: "gentle room", g: "room", why: "hard to overdrive and quick to settle — the safe default for a room with people talking in it",
      set: { floor: 0.18, energyCap: 0.55, driveRate: 0.4, decayRate: 0.0008, contrastFloor: 0.5, paletteFade: 12 } },
    { id: "responsive", g: "room", why: "answers a button immediately and falls back just as fast — for showing someone what the room does",
      set: { floor: 0.12, energyCap: 0.8, driveRate: 1.3, decayRate: 0.004, contrastFloor: 0.35 } },
    { id: "long memory", g: "room", why: "whatever the room is pushed to, it stays there for ages — the energy of the last hour is still in it",
      set: { decayRate: 0.0001, driveRate: 0.5, floor: 0.25, paletteFade: 20 } },
    { id: "peak hour", g: "room", why: "the ceiling comes off and it sits high on its own — bright, loud, not for a quiet room",
      set: { floor: 0.38, energyCap: 1, driveRate: 0.9, decayRate: 0.0012, contrastFloor: 0.25 } },

    /* THE SPIRAL — what the pattern on screen and in the bloom actually does. */
    { id: "slow burn", g: "spiral", why: "the room breathing in its sleep — wide slow resolves, barely any dive, colours melting rather than cutting",
      set: { bpm: 32, swingFreqBase: 0.05, swingFreqGain: 0.5, swingRange: 1, zoomMax: 1.8, zoomRatio: 0.35,
             bloomFlowLo: 0.25, bloomFlowHi: 0.12, paletteFade: 20 } },
    { id: "hard swing", g: "spiral", why: "chaos to symmetry and back, fast, and it flings itself further the harder the room pushes",
      set: { bpm: 96, swingFreqBase: 0.3, swingFreqGain: 3.2, swingRange: 1, zoomMax: 4.5, zoomRatio: 1,
             bloomFlareAmp: 3, energyCap: 0.8 } },
    { id: "deep dive", g: "spiral", why: "the frame falls into the middle of the pattern — the furthest travel this room does",
      set: { zoomMax: 5.5, zoomRatio: 0.5, zoomFalloff: 3.4, zoomMode: 0, zoomInvert: 0, bloomReachHi: 1.2 } },
    { id: "corner flood", g: "spiral", why: "the light actually arrives in the corners as the pattern resolves — the whole wall lights, then lets go",
      set: { bloomReachLo: 0.6, bloomReachHi: 1.2, bloomCornerAlphaLo: -0.01, bloomCornerAlphaHi: 0.2,
             bloomCornerRadHi: 0.55, bloomCoreAlphaHi: 0.16 } },
    { id: "black hole", g: "spiral", why: "everything drains toward one burning centre and the edges stay dark",
      set: { bloomCoreHi: 0.8, bloomCoreAlphaHi: 0.22, bloomReachLo: 0.15, bloomReachHi: 0.5,
             bloomCornerAlphaLo: -0.15, bloomCornerAlphaHi: 0, zoomMax: 3.5 } },
    { id: "swarm", g: "spiral", why: "many small quick pulses instead of a few fat ones — reads as a shoal rather than a flow",
      set: { bpm: 110, bloomDrops: 16, bloomDropRadLo: 0.03, bloomDropRadHi: 0.07, bloomDropAlphaLo: 0.03,
             bloomDropAlphaHi: 0.12, bloomFlowLo: 1.2, bloomFlowHi: 0.6 } },
    { id: "full spectrum", g: "spiral", why: "every colour the scheme has, on screen at once, all the way through the resolve — the widest this room gets",
      set: { colorSpreadChaos: 1, colorSpreadOrder: 1 } },
    { id: "one colour", g: "spiral", why: "converges hard toward a single hue as it resolves — the calm end, and how it used to behave",
      set: { colorSpreadChaos: 0.6, colorSpreadOrder: 0.2 } },
    { id: "held breath", g: "spiral", why: "almost still. it never fully dissolves and never fully resolves — for talking over",
      set: { bpm: 24, swingFreqBase: 0.03, swingFreqGain: 0.2, swingRange: 0.35, zoomMax: 1.4,
             bloomFlowLo: 0.1, bloomFlowHi: 0.06, paletteFade: 25 } },

    /* THE ORGANISM — a living body grown over the pattern. */
    // Me Julie (a.k.a. Intergalactico / Medulli — named live 2026-09-03): the ferrofluid
    // core the installation is built around. A dark centre that refuses to burn, light only
    // on her reaching thorns, a touch of slime diffusion filling the gap so the middle never
    // hotspots. Rides the soft screen blend + gentle ceiling. Rough first body — to be made
    // real (dark-core pass, then audio-reactive bass) but engraved here so she cannot be lost.
    { id: "Me Julie", g: "organism", why: "the ferrofluid core — dark centre that won't burn, light on her reaching thorns, diffusion filling the gap. the organism the whole installation is built around",
      set: { orgAmount: 0.85, orgFerro: 0.75, orgSlime: 0.2, orgSyn: 0, orgFluid: 0, orgVicsek: 0,
             orgWiring: 0, orgPossess: 0, orgPlace: 0, orgPlaceMode: 0, orgGlow: 0.4, orgCeiling: 0.6, orgBlend: 1 } },
  ];

  /* ── NUCLEUS SNAP POINTS ───────────────────────────────────────────────────
     K.: *"the bloom sliders… it's very hard to finetune. I'd like to snip the sliders
     back into specific positions to mess with them again."*

     Nineteen interacting knobs is not a thing anyone tunes from where they happen to
     be sitting — every session starts mid-nowhere and the first ten minutes are spent
     getting back to somewhere legible. So unlike the presets above, these are NOT
     partial: each one sets ALL nineteen, spread deliberately far apart across the
     parameter space. Press one and every slider snaps to a known position; then push
     it around from there, and "save the desk as a preset…" keeps whatever you found.

     Columns, in `NUC_KEYS` order — Lo is the chaos end of the σ swing, Hi the resolved
     end. Reading a row left to right: how big the centre well is, how bright, how far
     the streams travel, how fast, how many pulses and how big/bright, how the corners
     behave, and how hard a press flares. */
  var NUC_KEYS = [
    "bloomCoreLo", "bloomCoreHi", "bloomCoreAlphaLo", "bloomCoreAlphaHi",
    "bloomReachLo", "bloomReachHi", "bloomFlowLo", "bloomFlowHi",
    "bloomDrops", "bloomDropRadLo", "bloomDropRadHi", "bloomDropAlphaLo", "bloomDropAlphaHi",
    "bloomCornerAlphaLo", "bloomCornerAlphaHi", "bloomCornerRadLo", "bloomCornerRadHi",
    "bloomFlareAmp", "bloomFlareReach",
  ];
  function nucleus(id, why, v) {
    var set = {};
    NUC_KEYS.forEach(function (k, i) { set[k] = v[i]; });
    return { id: id, g: "nucleus", why: why, set: set };
  }
  var NUCLEUS_PRESETS = [
    //        core lo/hi   alpha lo/hi   reach lo/hi  flow lo/hi  drops  rad lo/hi   dropA lo/hi   cornerA lo/hi  cornerR lo/hi  flare amp/reach
    nucleus("mist", "everything soft, dim and enormous — no edges anywhere, the whole frame is one faint glow",
      [0.30, 0.85, 0.02, 0.06, 0.70, 1.20, 0.18, 0.08, 3, 0.28, 0.50, 0.010, 0.030, -0.02, 0.05, 0.45, 0.80, 1.0, 0.15]),
    nucleus("pinpoint", "the opposite: tiny bright grains racing outward, a spray rather than a flow",
      [0.05, 0.18, 0.05, 0.16, 0.55, 1.10, 1.30, 0.70, 18, 0.015, 0.045, 0.045, 0.140, -0.06, 0.10, 0.05, 0.14, 2.4, 0.45]),
    nucleus("furnace", "almost everything is the centre — a huge burning well, barely anything reaching out",
      [0.45, 0.95, 0.12, 0.32, 0.12, 0.35, 0.35, 0.15, 3, 0.10, 0.22, 0.015, 0.050, -0.18, -0.02, 0.06, 0.15, 1.4, 0.10]),
    nucleus("four corners", "the room's corners do the work — the centre is a dim source and the arrival is the event",
      [0.06, 0.20, 0.02, 0.05, 0.85, 1.20, 0.45, 0.20, 6, 0.06, 0.14, 0.020, 0.070, -0.02, 0.28, 0.30, 0.70, 1.8, 0.55]),
    nucleus("heartbeat", "few, large, slow pulses that arrive one at a time — the most legible the bloom gets",
      [0.18, 0.50, 0.05, 0.14, 0.60, 1.05, 0.14, 0.06, 2, 0.22, 0.42, 0.030, 0.090, -0.08, 0.12, 0.20, 0.42, 3.0, 0.60]),
    nucleus("swarm dense", "twenty small pulses at once, packed close — reads as texture rather than as motion",
      [0.10, 0.30, 0.03, 0.09, 0.45, 0.95, 0.95, 0.50, 20, 0.03, 0.08, 0.025, 0.080, -0.04, 0.09, 0.08, 0.20, 1.6, 0.30]),
    nucleus("hard edges", "high contrast and short reach — dark between the pulses instead of a wash",
      [0.08, 0.24, 0.06, 0.20, 0.30, 0.70, 0.60, 0.28, 7, 0.04, 0.10, 0.060, 0.180, -0.20, 0.16, 0.08, 0.22, 2.8, 0.35]),
    nucleus("flood", "everything at once, at the top of its range — the loudest the nucleus goes",
      [0.35, 0.90, 0.10, 0.28, 1.00, 1.20, 0.80, 0.45, 14, 0.14, 0.30, 0.050, 0.150, 0.02, 0.26, 0.40, 0.75, 4.0, 0.85]),
  ];
  PRESETS = PRESETS.concat(NUCLEUS_PRESETS);

  // Resolve a light-scene entry → { colors[], contrastNorm, speedNorm }.
  // `_cardT` is passed by the engine so a card can be evaluated at a given moment; it
  // is the one entry kind whose colour is a function of time rather than a lookup.
  function resolveLight(entry, t, biz) {
    if (entry && entry.card) {
      var e = entry.emit(t || 0, biz || 0);
      return { colors: e.palette, contrastNorm: 0.62, speedNorm: 0.45, params: e.params };
    }
    if (entry._palette) return entry._palette;               // generated scheme carried inline
    var pal = P();
    if (pal && entry.paletteId) {
      var s = pal.get(entry.paletteId);
      if (s) return { colors: s.colors, contrastNorm: s.contrastNorm, speedNorm: s.speedNorm };
    }
    return { colors: FALLBACK, contrastNorm: 0.5, speedNorm: 0.3 };
  }

  var PARTY = {
    /* Tunable physics. decayRate default = ~0.8 span over ~33 min; tests override. */
    config: {
      /* MASTER TEMPO. K.: *"most fractal art is very very slow… right now it almost
         becomes like a hypnotoad. can we slow everything down? have a master tempo
         on it all."* Every clock in the organism — the 38 exhibits, the bloom, the
         colour cards, the σ/zoom pendulum, the lamp speeds — advances at this rate.
         Nothing else shares a rate; each was tuned alone, which is why the composite
         read as busy.
         Labelled in BPM because that is the language the music is in, and because
         the C# side already exposes /api/bpm to lock to later. 120 BPM = 1.0 = the
         speed everything was tuned at; the default is deliberately well under that.
         Only ever multiplies an INCREMENT (`phase += rate * tempo * dt`), never
         `elapsed * tempo` — see tools/party-tests/tide.test.js for why. */
      bpm: 48,             // ≈0.4× — the slow end. Move it on the night.
      floor:       0.20,   // GlobalEnergy rest, matches C# SceneRenderer default
      driveRate:   0.55,   // /s while holding a brightness button
      decayRate:   0.0004, // /s pull toward floor when idle (~30 min from full)
      recoverRate: 0.0002, // /s climb back when pushed below floor (slower — "climbs back slowly")
      floorMargin: 0.03,   // hysteresis band for trough detection
      contrastFloor: 0.4,  // a 0-star scheme still allows this fraction of full energy
      energyCap:     0.65, // hard ceiling on GlobalEnergy. The C# renderer widens its
                           // per-frame slew (anti-strobe) cap as energy rises, so this
                           // keeps the room in gentle territory no matter how hard it's
                           // driven — the not-a-carnival guard.
      // Spiral pendulum: the rotation SWINGS back and forth (not continuous spin).
      // Amplitude + frequency scale with business — pump it hard = wide fast swings;
      // as business decays the swing narrows and slows to a gentle rest.
      swingAmp:      1.15,  // max swing angle (rad) at full business (~66°)
      swingFreqBase: 0.12,  // rad/s swing rate at rest (keeps a slow sway alive)
      swingFreqGain: 1.7,   // extra swing rate per unit business
      swingRange:    1.0,   // how much of the chaos↔symmetry spectrum the swing covers
                            // (1 = full end-to-end; lower = a narrower band around mid)
      // The dwell: hold still on arriving at an end of the swing, so the reach is felt
      // and re-entering motion is the reward. 0 off / 1 chaos / 2 symmetry / 3 both.
      // Off by default — this changes the room's core rhythm and is K.'s to switch on.
      dwellMode:     0,
      dwellSeconds:  4,     // how long the held breath lasts (tempo-scaled)
      // Zoom pendulum: the SECOND swing. Rides the same _swingPhase as σ, so it is
      // part of the pendulum rather than a clock of its own — pumping business speeds
      // up the dive exactly as it speeds up resolve↔dissolve. Depth scales with
      // business: a resting room stays at full view and never dives.
      zoomMin:    1.0,   // full view
      zoomMax:    3.2,   // deepest centre dive at full business
      zoomRatio:  0.5,   // zoom rate vs σ rate (0.5 = one dive per two σ swings)
      zoomInvert: 0,     // 0 = deepest AT symmetry (resolve) · 1 = deepest at chaos
                         // (dissolve). Eased, not snapped — see _zoomPhase in tick().
      // KEEP-IN-FRAME (default) vs OFF-SCREEN dive. K.: "I want the picture to
      // actually stay in frame … I'd rather have stuff zoom out and in where
      // everything stays inside the frame." So the default no longer magnifies past
      // the edge at all — the picture BREATHES in scale: it shrinks toward the centre
      // (zoom out) and grows back to fill the frame (zoom in to fit), never beyond.
      // The old magnify-past-the-edge behaviour lives on behind the toggle.
      zoomOffscreen: 0,  // 0 = bounded, whole picture always visible (scale ≤ 1) ·
                         // 1 = the dive may magnify past the frame (the old behaviour)
      zoomFit:     0.4,  // in-frame mode: how far OUT it zooms at the deepest dive
                         // (0.4 = shrinks to 40% of the frame, then grows back to fill)
      // OFF-SCREEN mode only — HOW the magnify is applied (ignored when in-frame):
      zoomMode:    0,    // 0 = lens (magnify the centre) · 1 = uniform (whole frame)
      zoomFalloff: 2.2,  // lens only: how fast the magnification eases off toward the
                         // edge. Lower = the swell reaches further out (broader, softer);
                         // higher = a tighter bulge in the middle.
      /* OVERLAP — two exhibits in one frame (request 14.2 + K.'s background toggle).
         0 = off · 1 = transition (the previous one decays away over `overlapFade`
         seconds) · 2 = persistent (it stays underneath for the whole dwell).
         An opaque exhibit is always forced to the BOTTOM layer by symmetry.js — it
         repaints the whole frame, so on top it would simply erase the other. */
      overlapMode: 0, overlapAmount: 0.45, overlapFade: 12,
      /* The NUCLEUS — the screen bloom's whole look (brief §14.3). These were literals
         inside drawSuperfluidBloom; they live here so the dashboard can reach them.
         Each pair is the σ range: `Lo` at chaos, `Hi` at order. symmetry.js falls back
         to identical defaults when PARTY is absent, so brain.js is untouched. */
      bloomCoreLo: 0.10, bloomCoreHi: 0.44,             // central well size
      bloomCoreAlphaLo: 0.03, bloomCoreAlphaHi: 0.12,   // …and its brightness
      bloomReachLo: 0.34, bloomReachHi: 1.0,            // how far the streams travel
      bloomFlowLo: 0.55, bloomFlowHi: 0.22,             // stream speed (Lo > Hi: chaos races)
      bloomDrops: 5,                                    // fronts per stream
      bloomDropRadLo: 0.06, bloomDropRadHi: 0.16,
      bloomDropAlphaLo: 0.02, bloomDropAlphaHi: 0.085,
      // Negative floor is deliberate — corners stay dark until σ climbs. Raising it
      // above 0 lights all four corners during the chaos phase.
      bloomCornerAlphaLo: -0.04, bloomCornerAlphaHi: 0.085,
      bloomCornerRadLo: 0.12, bloomCornerRadHi: 0.30,
      bloomFlareAmp: 1.6, bloomFlareReach: 0.28,        // the press flare
      // How long an ATTRACT-MODE scene change takes to arrive. Manual picks ignore
      // this and snap. Long enough to read as drift, short enough to finish well
      // inside the 25-45 s dwell so the room isn't permanently mid-fade.
      paletteFade: 8,
      /* MID-FADE PUSH RATE, in Hz. How often the lamps are told the eased palette
         while a scene drifts. It was a hardcoded 320 ms (~3 Hz) with a comment
         claiming the C# layer interpolates anyway; K.'s eyes said stutter. It is a
         knob so the 3-vs-12 comparison can be run live instead of guessed — the
         answer decides whether the fix is here or in the Hue repo's slew limiter.
         "An idle room is silent on the wire" (invariant 5) still holds: this gates
         only the fade, and a still room pushes nothing at any rate.

         ⚠ DEFAULT RAISED 3 → 12 on 2026-07-26, and the FIRST verdict was wrong.
         An earlier live A/B found 3 and 12 indistinguishable — but that was run
         while the C# limiter was still chasing colour in RGB and rounding
         brightness to 1%, and both sides stuttered too badly for the rate to show.
         Re-asked once those were fixed, K.: "12 hz def beat 3 hz." A verdict is
         only as good as the room it was collected in. */
      palettePushHz: 12,
      /* HOW FAR EACH LAMP'S BRIGHTNESS SWINGS — the gap between its floor and its
         ceiling. K.: "lets just minimalise the floor and the cealing difference delta
         so it doesnt feel like a fire effect but it doesnt feel static either."
         That is the whole tension in one number. Wide = flicker, a fire. Zero = a flat
         wash that reads as dead. It was hardcoded at 0.30 in party-main.js, so the
         balance could never actually be found — only argued about.
         ⚠ Motion belongs in SPACE, not in a lamp's brightness (PARTY-BRIEF §13): the
         room comes alive from lamps being out of PHASE with each other, not from any
         one lamp swinging hard. So this can go quite low and still breathe.

         Narrowed 0.30 → 0.12 on 2026-07-26. K. tried 0.10 and read it as stuttery,
         but diagnosed it himself as the push rate rather than the width — "I believe
         narrow breath stutters because of its slowness and catching up rather than
         anything else" — and he was right: a small swing makes a 3 Hz target update
         far more visible than a large one does. With the rate at 12 the narrow band
         is the calm-but-alive setting he asked for. 0.12 is a considered number, not
         a measured one; it is one slider away from being someone's actual choice. */
      lampBrightBand: 0.12,
      /* LAMP FLOW — how hard the superfluid pushes light through the lamps, i.e. how
         much of the room's brightness the effect is actually using. Used to be welded
         to the master tempo: slowing the room down also dimmed it, because `flowN`
         was multiplied by tempo along with the motion rates. K., 2026-07-26: "I just
         want everything to move slower. not less bright." So it is its own dial now.
         1.0 = the flow the room was tuned at; the tempo no longer touches it, and
         slow + bright is a setting you can hold. */
      lampFlow: 1.0,
      /* HOW MANY COLOURS ARE ON SCREEN AT ONCE. K.: "a lot of them show pretty
         unicoloured… I love it when the spirals and bloom have 4 or more different
         colours, 2 being a bit of a lower bound." These are the fraction of the
         palette loop the picture spans, at each end of the σ swing. 1 = the whole
         scheme; 0.2 = a narrow slice, near-monochrome. The order end used to be
         hard-wired at 0.34, which is where the unicoloured resolve came from. */
      colorSpreadChaos: 1.0,
      colorSpreadOrder: 1.0,   // widened default (2026-09-03, live-tuned): the ordered end
                               // was collapsing to ~one warm hue on screen; full spread keeps
                               // the palette diffusing across the shape at rest.
      // Neglect: the room notices being left alone. attention() ramps up after
      // `attentionAfter` seconds untouched, reaching full over `attentionRamp`.
      // Past `deathAfter` it has wound all the way down. Seconds.
      attentionAfter: 420,  // ~7 min before it starts asking for you
      attentionRamp:  120,  // …reaching full insistence over 2 more min
      deathAfter:     1800, // ~30 min untouched = standstill
      // Seconds of nobody touching anything before the room starts running itself.
      // Deliberately far below attentionAfter: 7 minutes of dead air at a party is an
      // eternity, and attract mode is the thing that fills it. 0 disables it entirely.
      // Engaging this way sets `_autoAuto`, so the FIRST touch hands control straight
      // back — a guest who walks up must never have to fight the slideshow off.
      //
      // DEFAULT 0 = OFF, and that is deliberate, not timidity. At any non-zero default
      // this hijacks `business` in every long unattended run — which is precisely what
      // four suites (cards, mods, tempo, tune) assert must NOT happen: "at 24 BPM
      // business still controls SPEED". Those are physics contracts written by other
      // sessions and a red test may be a decision (STATE.md), so the feature ships
      // opt-in and K. dials it on the night. **Suggested party value: 90.**
      slideshowAfter: 0,
      // How far the dice may travel. 1 = the old behaviour exactly: every slider
      // redrawn uniformly across its whole min..max, which is why a roll so often
      // lands on extremes and throws away the look you were building on. Below 1 the
      // roll samples a window of that fraction CENTRED ON THE CURRENT VALUE, so a
      // nucleus card stays recognisably itself and the dice become "vary this" rather
      // than "replace this". Lives in config (not the dashboard) so presets, reset and
      // the snapshot carry it like every other setting.
      randomiseSpread: 1,

      // ── THE ORGANISM — living render modes over the spiral ────────────────────
      // A crossfade + a mixing board. orgAmount 0 = pure spiral (today's screen); 1 =
      // pure organism; in between = both. The per-mode weights (0..1 each, independent)
      // say WHICH bodies show — synaptic / slime mold / superfluid / Vicsek murmuration
      // — drawn additively over the spiral by the AmbientDirector (party only; a no-op
      // in the main house). Numeric only: config is numeric-coerced and setTuned refuses
      // undeclared keys, so these MUST live in the literal for the dashboard, snapshot,
      // reset and dice to reach them (the zoomMode precedent). Default 0 = organisms OFF;
      // orgSyn defaults to 1 so raising orgAmount alone always shows a body — the draw
      // path additionally clamps the spiral fade to actual organism content, so an
      // orgAmount=1 with every weight at 0 can never blank the screen.
      orgAmount: 0,
      orgSyn:    1,
      orgSlime:  0,
      orgFluid:  0,
      orgVicsek: 0,
      orgWiring: 0,
      orgFerro:  0,   // ferrofluid-on-a-speaker (rough WIP, uncommitted): spiked membrane, thorns ride the bass

      // ── ORGANISM PLACEMENT + CHIMERA ("Possession") ──────────────────────────
      // orgPlace 0 = organism sits centre, mixed with the spiral (today); 1 = the WHOLE
      // organism (slime included) grows OUT from the centre to fill the frame into the
      // corners, like the superfluid bloom flooding out. The spiral still shows through
      // (never-blank clamp keeps ≥40% of it). orgPlaceMode 3 = breathe the reach in/out
      // with the room; 0/1/2 = steady grow (1/2 reserved for future growth shapes).
      // orgPossess 0 = additive overlay (today); 1 = the spiral's own rendered pixels drive
      // the sim, so the slime crawls its bright curves, the flock traces its arms — the
      // organism grows ON the spiral. orgGlow = master brightness (organism is additive, so
      // this tames the wash-out). All default 0 (glow 0.5) = today's look. Numeric, so
      // snapshot/reset/dice/setTuned cover them for free like the other org keys.
      orgPlace:     0,
      orgPlaceMode: 0,
      orgPossess:   0,
      orgGlow:      0.5,   // master organism brightness — the organism is additive over the spiral,
                           // so this is the one knob that tames the whole thing to taste (0 = invisible,
                           // 1 = full). Kept low by default; drag it up if you want it hotter.
      // How the organism's light lands on the screen. 0 = "lighter" (pure additive —
      // overlaps clip HARD to white and then PLATEAU, which reads as harsh). 1 = "screen"
      // — 1-(1-a)(1-b), a soft roll-off that eases toward white instead of clipping, so
      // the top of the brightness slider keeps doing something.
      // Default 1 (2026-09-03, live-tuned with friends): the soft blend was clearly the
      // better look on every body — the harsh additive clip is gone system-wide.
      orgBlend:     1,
      // Gentle ceiling on the whole peak: the effective brightness is multiplied by this
      // BEFORE it hits the composite, so 1 = full punch, lower = a softer top end
      // everywhere. Pairs with orgGlow (which shapes the curve) — this caps how hot the
      // curve is ever allowed to get.
      // Default 0.6 (2026-09-03, live-tuned): the peak was blowing out; 0.6 keeps the
      // whole top end gentle across every organism. Drag to 1 for full punch.
      orgCeiling:   0.6,
    },

    business: 0.20,
    mode: "spiral",        // "spiral" | "light"
    drive: 0,              // -1 / 0 / +1 from the brightness buttons
    spiralPlaylist: [],
    lightPlaylist: [],
    spiralCursor: 0,
    lightCursor: 0,
    activeSpiralId: null, // what's shown NOW (cycling sets this live; commit pins it)
    activeLightId: null,
    // THE GARDEN: spirals guests planted through a game (game.js host.contribute → apply
    // "contribute"). Additive, persistent, cycled alongside the catalog — a contribution
    // outlives the game that made it ("it's breathing in the room now"). Entries are
    // { id, spiral(title), params, palette(int), t } — geometry + colour only, never text.
    garden: [],
    _gardenId: null,      // garden entry shown NOW (null = a catalog spiral is showing)
    _gardenSeq: 0,        // monotonic id counter for planted entries
    _browse: { spiral: 0, light: 0 }, // index into the UNLOCKED list per mode
    _wasAboveFloor: false,
    _swingPhase: 0,        // pendulum phase for the spiral's back-and-forth rotation
    _zoomPhase: 0,         // eased offset (rad) of the zoom swing vs the σ swing
    zoomManual: null,      // dashboard override: a number pins the zoom, null = pendulum
                           // (lives here, not in config — config is numeric-coerced)
    idle: 0,               // seconds since anyone last touched it
    // Colour crossfade between light-scenes. `_palFade` is the duration the NEXT
    // scene change will take: attract mode sets it, every manual path leaves it 0.
    // Manual snaps on purpose — pressing `show` and waiting 8 s to see what you
    // picked makes the catalog impossible to audition.
    _pal: { curId: null, from: null, to: null, t: 0, dur: 0 },
    _palFade: 0,
    _genCount: 0,
    _toastFns: [],

    /* ── input ───────────────────────────────────────────────────────────── */
    holdBright: function (dir) {
      this.drive = dir < 0 ? -1 : dir > 0 ? 1 : 0;
      if (this.drive !== 0) this.idle = 0;
    },

    toggleMode: function () {
      this.idle = 0;
      this.mode = this.mode === "spiral" ? "light" : "spiral";
      this._toast(this.mode === "spiral" ? "Spiral" : "Light");
      return this.mode;
    },

    // Hue-short: step to the next AVAILABLE item AND show it immediately (live preview).
    cycle: function () {
      this.idle = 0;
      this._gardenId = null;   // navigating by hand leaves a shown contribution
      var unlocked = this._available();
      if (!unlocked.length) return null;
      this._browse[this.mode] = (this._browse[this.mode] + 1) % unlocked.length;
      var id = unlocked[this._browse[this.mode]].id;
      if (this.mode === "spiral") this.activeSpiralId = id; else this.activeLightId = id;
      return id;
    },

    // Hue-hold: commit the browsed item to the mode's playlist + unlock the next
    // locked item — or mint a fresh one if the static catalog is exhausted.
    commit: function () {
      this.idle = 0;
      var list = this._catalog();
      var unlocked = this._available();
      if (!unlocked.length) return { added: null, unlocked: null };
      var activeId = (this.mode === "spiral" ? this.activeSpiralId : this.activeLightId)
        || unlocked[this._browse[this.mode] % unlocked.length].id; // pin what's shown now
      var pl = this.mode === "spiral" ? this.spiralPlaylist : this.lightPlaylist;
      var added = null;
      if (pl.indexOf(activeId) === -1) { pl.push(activeId); added = activeId; this._toast("+ " + activeId); }
      var next = null;
      for (var i = 0; i < list.length; i++) { if (!list[i].u) { list[i].u = true; next = list[i].id; break; } }
      if (!next) next = this._mint();     // catalog exhausted → overflow valve
      if (next) this._toast("Unlocked: " + next);
      this._save();
      return { added: added, unlocked: next };
    },

    // Mint a fresh catalog entry (unlocked). LIGHTS ONLY — the palette atlas really
    // can generate a new scheme, so the overflow valve still works there.
    // Deterministic (seeded by _genCount, no Math.random).
    //
    // Spirals cannot be minted any more and return null. The generator could invent a
    // NAME, but not a draw function: the catalog is now the exhibit list, so a minted
    // spiral would be a label with no shape behind it — exactly the fake-name problem
    // this change removes. `commit()` guards with `if (next)`, so a null is fine and
    // simply means "the spiral catalog is complete". All 38 start unlocked anyway.

    // A name must be unique — it is the playlist key, the localStorage key and what
    // the dashboard shows. Collisions would silently merge two catalog entries.
    _uniqueId: function (list, name) {
      var taken = {};
      for (var i = 0; i < list.length; i++) taken[list[i].id] = 1;
      if (!taken[name]) return name;
      for (var k = 2; k < 999; k++) if (!taken[name + " " + k]) return name + " " + k;
      return name + " " + Date.now();
    },

    _mint: function () {
      this._genCount++;
      if (this.mode === "light") {
        var pal = P();
        if (!pal) return null;
        var g = pal.generate(this._genCount, this._genCount);
        var lid = this._uniqueId(LIGHTS, g.id);
        LIGHTS.push({ id: lid, u: true,
          _palette: { colors: g.colors, contrastNorm: g.contrastNorm, speedNorm: g.speedNorm } });
        return lid;
      }
      return null;   // spiral catalog is the exhibit list — complete, nothing to mint
    },

    /* ── tick: the whole physics + phasing, one call per frame ───────────── */
    tick: function (dt) {
      var c = this.config;
      /* TWO TIME BASES, deliberately. `dt` is wall-clock and drives everything that
         is a RESPONSE — how fast the room answers a button, how long it has been
         left alone. Those must stay honest whatever the tempo is, or turning the
         dial down would also make the remote feel broken and delay the neglect cue.
         `mdt` is tempo-scaled and drives everything that is MOTION. */
      var mdt = dt * this.tempo();
      // Attract mode gets first refusal on business, but a hand on the remote always
      // wins: `drive !== 0` skips it entirely, and _autoTick re-seats its own envelope
      // afterwards so letting go doesn't snap the room back.
      if (this.auto && this.drive === 0) {
        this._autoTick(dt);
      } else if (this.drive !== 0) {
        this.business = clamp(this.business + this.drive * c.driveRate * dt, 0, 1);
        if (this.auto) this._autoResync();
      } else if (this.business > c.floor) {
        this.business = Math.max(c.floor, this.business - c.decayRate * dt);
      } else if (this.business < c.floor) {
        this.business = Math.min(c.floor, this.business + c.recoverRate * dt);
      }
      // Neglect clock: holding a button counts as being touched, continuously.
      if (this.drive !== 0) this.idle = 0; else this.idle += dt;
      this._slideshowTick();
      this._clock = (this._clock || 0) + mdt;  // the cards' own time base
      this._modTick(mdt);         // LFO patches, before anything reads config
      this._palTick(mdt);         // colour drift between light-scenes
      // Spiral pendulum: advance the swing phase; the rate rises with business.
      this._swingPhase = this._swingTick(this._swingPhase, mdt);
      // Zoom phase eases toward its target (0 = resolve, π = dissolve). Snapping it
      // mid-swing would jump the zoom and read as a glitch; ~0.35 s feels like a turn.
      var zTarget = c.zoomInvert ? Math.PI : 0;
      this._zoomPhase += (zTarget - this._zoomPhase) * Math.min(1, dt / 0.35);
      // Decay-trough detector: each full descent to the floor advances BOTH lists.
      // Suppressed under attract mode, which owns its own clock and ignores playlists —
      // otherwise every auto swell would ALSO step the cursors and two schedulers would
      // fight over what is on screen.
      if (this.business > c.floor + c.floorMargin) {
        this._wasAboveFloor = true;
      } else if (this._wasAboveFloor && this.business <= c.floor + 1e-6) {
        this._wasAboveFloor = false;
        if (!this.auto) this._advance();
      }
      return this.business;
    },

    _advance: function () {
      var sp = this._step(this.spiralPlaylist, this.spiralCursor, SPIRALS);
      if (sp) { this.spiralCursor = sp.cursor; this.activeSpiralId = sp.id; }
      var li = this._step(this.lightPlaylist, this.lightCursor, LIGHTS);
      if (li) { this.lightCursor = li.cursor; this.activeLightId = li.id; }
    },

    // Step a playlist cursor to the next entry that is not vetoed. Without the skip the
    // `off` switch silently failed here: cycle() and attract mode both honour it, but a
    // trough advance walked the playlist blindly and put a vetoed exhibit back on screen
    // — in exactly the mode where the curation was done by hand.
    // A playlist that is entirely vetoed returns null: hold what is showing rather than
    // force something the curator switched off.
    _step: function (pl, cursor, list) {
      if (!pl.length) return null;
      for (var i = 1; i <= pl.length; i++) {
        var n = (cursor + i) % pl.length, id = pl[n];
        var e = list.find(function (x) { return x.id === id; });
        if (e && !e.off) return { cursor: n, id: id };
      }
      return null;
    },

    /* ── attract mode: the room runs itself ───────────────────────────────────
       There is no working remote, and a still screen is a dead screen. With `auto`
       on, the party walks the whole catalog by itself — a new spiral and a new
       light-scene every `_autoDwell` seconds, each cycle carrying its own swell of
       business, its own σ band and its own decision about whether to dive.

       WHY IT CANNOT REUSE THE TROUGH DETECTOR. `_advance()` fires when business
       descends to the floor, but only after `_wasAboveFloor` — which needs something
       to have pushed business UP first. With nobody driving, business rests at the
       floor forever and the trough never arms: the screen would sit on one shape
       until someone touched it. So attract mode brings its own clock AND drives
       business itself. That is the whole reason this exists as separate machinery.

       Random, but NOT Math.random: this file is deterministic by contract (the tests
       replay it), so the draws are a hash of an integer step. Same step, same show. */
    auto: false,
    _autoStep: 0,      // which cycle we are on — the only state the draws depend on
    _autoT: 0,         // seconds into the current cycle
    _autoDwell: 30,    // length of the current cycle
    _autoAmp: 0.5,     // how far this cycle's swell rises above the floor

    // Deterministic 0..1 from an integer (mulberry32's mixing step, stateless).
    _rnd: function (n) {
      var t = (n * 2654435761 + 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    _autoTick: function (dt) {
      var c = this.config;
      if (!this._autoT && !this._autoStep) this._autoPick();   // first tick arms cycle 0
      this._autoT += dt;
      if (this._autoT >= this._autoDwell) { this._autoT = 0; this._autoPick(); }
      // One raised-cosine swell per cycle: floor → peak → floor. A single breath, not a
      // pulse train — invariant 1, this is not a carnival. effectiveEnergy() still caps
      // what reaches the lamps, so this can never outrun the anti-strobe governor.
      var phase = this._autoT / this._autoDwell;
      var swell = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
      this.business = clamp(c.floor + this._autoAmp * swell, 0, 1);
    },

    /* ── the dwell: a held breath at either end of the swing ─────────────────
       K.: "can we look into that they do actually go all the way to their super-chaos
       or symmetry and maybe even give us a toggle option to take a customisable pause
       at either point. this will be rewarding for watching it re-enter motion."
       Spec: docs/PARTY-BRIEF.md §23.3.

       FREEZE THE INCREMENT; NEVER RESCALE THE PHASE. A pause implemented by scaling or
       offsetting accumulated phase re-introduces the §13 flicker bug exactly. So during
       a dwell the `+=` simply does not happen — the phase is not touched at all.

       Detection is an edge on cos(phase) across the would-be increment: `+→−` just
       passed the sin peak (symmetry), `−→+` just passed the trough (chaos). It rides
       the phase already being integrated, so it needs no clock of its own and holds at
       any rate or tempo.

       The snap to the nearest kπ/2 is bounded by one frame's increment (≪0.05 rad) and
       sin is flat at its own extremum, so it is invisible — the same correction already
       trusted for `_zoomPhase`. Freezing the phase also freezes the dive, because there
       is one pendulum by design; the zoom stopping mid-motion is correct, not a bug. */
    _dwellRemaining: 0,
    /* Re-arm latch. Pinning the phase to the extremum parks cos() at ~0, so the very
       next frame reads as another crossing and the dwell re-triggers forever — the room
       freezes at the first end it reaches and never sees the other. Detection therefore
       stays disarmed until the swing has visibly moved off the extremum. 0.1 ≈ 6° of
       phase: far enough that cos has a settled sign, far too small to skip a real end. */
    _dwellArmed: true,

    _swingTick: function (phase, mdt) {
      var c = this.config;
      // Tempo-scaled on purpose: a dwell is pacing, i.e. motion, so turning the master
      // tempo down stretches the hold with everything else. (Contrast the neglect
      // clock, which stays wall-clock — §22.)
      if (this._dwellRemaining > 0) {
        this._dwellRemaining -= mdt;
        return phase;                       // frozen: the += does not run
      }
      var inc = (c.swingFreqBase + this.business * c.swingFreqGain) * mdt;
      var next = phase + inc;
      var mode = c.dwellMode || 0;          // 0 off · 1 chaos · 2 symmetry · 3 both
      if (!this._dwellArmed && Math.abs(Math.cos(next)) > 0.1) this._dwellArmed = true;
      if (mode && inc > 0 && this._dwellArmed) {
        var a = Math.cos(phase), b = Math.cos(next);
        var atSymmetry = a > 0 && b <= 0;   // sin peak  → fully resolved
        var atChaos    = a < 0 && b >= 0;   // sin trough → fully dissolved
        if ((atSymmetry && (mode & 2)) || (atChaos && (mode & 1))) {
          this._dwellRemaining = c.dwellSeconds || 0;
          this._dwellArmed = false;
          // Pin to the exact extremum so the held frame is the real end of the reach,
          // not one frame short of it.
          return Math.round(next / (Math.PI / 2)) * (Math.PI / 2);
        }
      }
      return next;
    },

    // Hands control back cleanly when someone grabs the remote mid-cycle: restart the
    // cycle from where business actually is, so releasing doesn't jump.
    _autoResync: function () { this._autoT = 0; },

    /* An unattended room should not sit still. After `slideshowAfter` seconds untouched
       attract mode engages on its own, and the first touch takes it straight back off.

       Why watch `idle` falling rather than hooking every input: SIX paths zero `idle`
       (holdBright, toggleMode, cycle, commit, apply, _reset) and a seventh would be
       added by the next feature and silently miss this. A drop in `idle` IS the
       definition of "someone touched it", whatever route they came in by.

       Only auto-engaged slideshows are auto-cancelled. If K. switched attract on by
       hand from the dashboard, a guest brushing a button must not switch it off — that
       is K.'s decision, not the room's. `_autoAuto` is what tells the two apart. */
    _autoAuto: false,        // true only while attract is running because NOBODY touched it
    _lastIdle: 0,

    _slideshowTick: function () {
      var after = this.config.slideshowAfter;
      if (this.idle < this._lastIdle && this._autoAuto) {   // someone just touched it
        this.auto = false;
        this._autoAuto = false;
        this._toast("Manual");
      } else if (!this.auto && after > 0 && this.idle >= after) {
        this.auto = true;
        this._autoAuto = true;
        this._autoT = 0;
        this._autoPick();
        this._toast("Slideshow");
      }
      this._lastIdle = this.idle;
    },

    // Choose the next cycle. Draws from everything AVAILABLE (unlocked, not vetoed),
    // ignoring the playlists entirely — curation is the manual path, this is the
    // self-running one.
    _autoPick: function () {
      var s = ++this._autoStep, r = this._rnd.bind(this);
      // Lights still earn by commit — but in attract mode nobody commits, so 4 of the 6
      // would stay locked forever and the room would loop two palettes all night. Each
      // cycle opens one. Deliberately does NOT mint: the overflow valve would grow the
      // catalog without bound over an evening, and the room only needs variety, not
      // infinity. Spirals are already all unlocked.
      for (var i = 0; i < LIGHTS.length; i++) { if (!LIGHTS[i].u && !LIGHTS[i].card) { LIGHTS[i].u = true; break; } }
      // Attract mode is the AMBIENT runner, so it draws only from the calm static
      // scenes — never the colour cards. A card is a deliberate performance mode (a
      // rainbow walk, a fire flicker); dropping one into the ambient rotation is exactly
      // the "that's not ambient" jar K. hit. Cards are entered by hand only.
      var sp = this._available(SPIRALS);
      var li = this._available(LIGHTS).filter(function (x) { return !x.card; });
      // The garden RECURS: roughly one cycle in three, when guests have planted spirals,
      // the room re-shows a contributed one instead of a catalog shape — a flower someone
      // made keeps coming back through the evening, not only at the moment they made it.
      if (this.garden.length && r(s * 8 + 11) < 0.34) {
        var ge = this.garden[Math.floor(r(s * 8 + 12) * this.garden.length) % this.garden.length];
        this._gardenId = ge.id; this.activeSpiralId = ge.spiral;
      } else {
        this._gardenId = null;
        if (sp.length) this.activeSpiralId = sp[Math.floor(r(s * 8 + 1) * sp.length) % sp.length].id;
      }
      // The one path that drifts rather than cuts — this is the transition K. sees all
      // evening. Manual picks stay instant so the catalog can be auditioned.
      this._palFade = this.config.paletteFade;
      if (li.length) this.activeLightId  = li[Math.floor(r(s * 8 + 2) * li.length) % li.length].id;
      this._autoDwell = 25 + r(s * 8 + 3) * 20;                       // 25–45 s per shape
      this._autoAmp   = 0.30 + r(s * 8 + 4) * 0.45;                   // how hard it breathes
      // "…while zooming sometimes." Two cycles in three dive; the rest stay at full
      // view, so the dive stays an event instead of a constant wobble. zoomManual = 1
      // pins the pendulum flat; null hands it back. ex.noZoom still overrides both.
      this.zoomManual = (r(s * 8 + 5) < 0.66) ? null : 1;
      this.config.zoomInvert = (r(s * 8 + 6) < 0.5) ? 0 : 1;          // resolve or dissolve
      // σ band jitter — some cycles sweep the whole chaos↔order spectrum, some stay in
      // a narrow, calmer part of it. Bounded: never below a slow sway, never frantic.
      this.config.swingRange    = 0.55 + r(s * 8 + 7) * 0.45;
      this.config.swingFreqBase = 0.08 + r(s * 8 + 8) * 0.10;
      // K.: "if we can randomise the order somehow it will end up having some really
      // cool interactions and transitions." Only meaningful once overlap is switched
      // on at all — while it is off this leaves it off. Roughly half the cycles keep
      // the previous shape underneath, and how strongly varies, so pairings feel
      // found rather than scheduled. Seeded like the rest, so a run still replays.
      if (this.config.overlapMode) {
        this.config.overlapAmount = 0.25 + r(s * 8 + 9) * 0.45;
        this._overlapThis = r(s * 8 + 10) < 0.55;
      }
      return this.activeSpiralId;
    },

    /* ── MODULATION: patch any setting onto one of the running clocks ──────────
       K.: *"an option to add any setting we want to one of the clocks we have running?
       its kinda cool they are like oscillators and we can add some lfo effects."*

       Exactly right — the room already contains several oscillators, they were just
       hard-wired to one destination each. This makes them sources anything can
       subscribe to:

         swing     the σ pendulum (resolve↔dissolve). Speeds up as the room gets busy.
         zoom      the dive, which rides the same phase at its own ratio
         business  not an oscillator — the room's energy, a slow envelope
         cycle     position through the current attract-mode dwell (a 25-45 s ramp)
         breath    a free slow sine, for when you want motion unrelated to the room

       ⚠ WHY A SEPARATE BASE. A mod writes into `config` so every reader — symmetry.js,
       the lamp push, the dashboard — sees the modulated value with no changes. But
       writing into the same field you read from compounds: last frame's modulated value
       becomes this frame's base and the setting walks away within seconds. So the
       untouched value is kept in `_modBase`, and every frame is computed from THAT.
       Un-patching restores it.

       Depth is a FRACTION OF THE SETTING'S OWN VALUE (±depth × base), so one number
       means the same thing on a slider that runs 0–0.05 and one that runs 1–6. */
    mods: [],          // [{ key, src, depth }]
    _modBase: null,
    _modBreath: 0,

    /* The master tempo as a plain multiplier. One accessor, one source of truth —
       everything that moves asks here. 120 BPM = 1.0 = the old speed. Clamped so a
       stray 0 can't freeze the room and a stray 10000 can't strobe it. `bpm` is an
       ordinary config key, so it is patchable onto a clock (patch("bpm","breath",…)
       = the room breathing its own tempo) and settable via setTuned for free. */
    tempo: function () { return clamp(this.config.bpm == null ? 120 : this.config.bpm, 12, 200) / 120; },

    modSource: function (name) {
      var c = this.config;
      switch (name) {
        case "swing":    return clamp((this.spiralTune() + 1) / 2, 0, 1);
        case "zoom": {
          var lo = c.zoomMin == null ? 1 : c.zoomMin, hi = c.zoomMax == null ? 3.2 : c.zoomMax;
          return hi > lo ? clamp((this.spiralZoom() - lo) / (hi - lo), 0, 1) : 0;
        }
        case "business": return clamp(this.business, 0, 1);
        case "cycle":    return this._autoDwell ? clamp(this._autoT / this._autoDwell, 0, 1) : 0;
        case "breath":   return 0.5 + 0.5 * Math.sin(this._modBreath);
        default:         return 0.5;                       // unknown source = no offset
      }
    },

    _modTick: function (dt) {
      this._modBreath += dt * 0.12;                        // ~52 s a lap
      if (!this._modBase) this._modBase = {};
      var self = this, c = this.config, base = this._modBase, live = {};
      this.mods.forEach(function (m) {
        if (!m || !Object.prototype.hasOwnProperty.call(c, m.key)) return;
        if (base[m.key] == null) base[m.key] = c[m.key];   // capture BEFORE first write
        live[m.key] = 1;
        var s = self.modSource(m.src), b = base[m.key];
        c[m.key] = b + b * (m.depth || 0) * (s * 2 - 1);
      });
      // Restore anything no longer patched, or it stays frozen wherever the LFO left it.
      for (var k in base) {
        if (!live[k]) { c[k] = base[k]; delete base[k]; }
      }
    },

    // Add / retune / remove (depth 0 or src falsy removes). One mod per setting: two
    // oscillators fighting over one field is not a feature, it is a race.
    /* Per-slider dice bounds: { key: [lo, hi] }. K.: "I want to limit it myself somehow
       on each slider." A roll on a limited key stays inside ITS OWN bounds, so the
       settings you have already decided about hold still while the rest re-rolls.

       NOT in `config`, deliberately: config is a flat numeric map (setTuned refuses
       anything non-finite) and these are pairs. This follows `mods` instead — engine
       state with its own commands, carried in the snapshot. */
    diceLimits: {},

    /* ── button mapping, editable at the party ───────────────────────────────
       K.: "I want to be able to tweak some of its mapping at the party itself if I
       deem something better."  Before this, the mapping lived in listen.py — changing
       it meant editing a file and restarting Python, at the party, on the laptop.

       Now listen.py forwards the raw GESTURE and the room decides what it means, so a
       remap is a dropdown on K.'s phone and takes effect on the next press.

       A gesture is "<role>.<short|long|press|release>". The defaults below reproduce
       the old hardcoded behaviour EXACTLY — buttonmap.test.js asserts that, so
       switching to this path changed nothing until K. moves a dropdown. */
    buttonMap: {
      "power.short": "mode",
      "power.long":  "resetConfig",
      "up.press":    "driveUp",
      "down.press":  "driveDown",
      "hue.short":   "cycle",
      "hue.long":    "commit",
    },

    // The vocabulary a button may be bound to. Anything not here is refused, so a typo
    // in a relayed message cannot invent a command.
    BUTTON_ACTIONS: ["none", "mode", "cycle", "commit", "skip", "auto", "randomise",
                     "resetConfig", "driveUp", "driveDown"],

    setButtonMap: function (gesture, action) {
      if (typeof gesture !== "string") return false;
      if (this.BUTTON_ACTIONS.indexOf(action) === -1) return false;
      this.buttonMap[gesture] = action;
      return true;
    },

    /* One physical button event. `role` is which button, `event` is the bridge's own
       word for what it did. Returns the action that fired, or null.

       Releases are special: they are not bound to anything, they UNDO a drive. Only the
       role that started the drive may end it, so mashing a second button cannot leave
       the first one's drive stranded — the failure that reads as a room with a mind of
       its own. */
    _driveRole: null,

    button: function (role, event) {
      if (!role) return null;
      this.idle = 0;                                   // any press is attention
      if (event === "short_release" || event === "long_release") {
        if (this._driveRole === role) { this.holdBright(0); this._driveRole = null; }
        // A short_release also completes a short press. long_release does not: its
        // meaning was already delivered by long_press, and firing both would double.
        if (event === "long_release") return null;
        var act = this.buttonMap[role + ".short"];
        return this._runButton(act, role);
      }
      if (event === "initial_press") return this._runButton(this.buttonMap[role + ".press"], role);
      if (event === "repeat")        return this._runButton(this.buttonMap[role + ".press"], role);
      if (event === "long_press")    return this._runButton(this.buttonMap[role + ".long"], role);
      return null;
    },

    _runButton: function (action, role) {
      if (!action || action === "none") return null;
      switch (action) {
        case "mode":        this.toggleMode(); break;
        case "cycle":       this.cycle(); break;
        case "commit":      this.commit(); break;
        case "skip":        if (this.auto) { this._autoT = 0; this._autoPick(); } break;
        case "auto":        this.apply({ cmd: "auto" }); break;
        // "give me a different look now", whether or not attract is running — the
        // randomise K. wants on a button, distinct from `skip` which only stirs attract.
        case "randomise":   this._autoT = 0; this._autoPick(); break;
        case "resetConfig": this.apply({ cmd: "resetConfig" }); break;
        case "driveUp":     this.holdBright(1);  this._driveRole = role; break;
        case "driveDown":   this.holdBright(-1); this._driveRole = role; break;
        default: return null;
      }
      return action;
    },

    setDiceLimit: function (key, lo, hi) {
      if (!Object.prototype.hasOwnProperty.call(this.config, key)) return false;
      if (!isFinite(lo) || !isFinite(hi)) return false;
      if (hi < lo) { var t = lo; lo = hi; hi = t; }   // dragged past each other, not an error
      this.diceLimits[key] = [lo, hi];
      return true;
    },

    clearDiceLimit: function (key) {
      if (key == null) { this.diceLimits = {}; return true; }
      delete this.diceLimits[key];
      return true;
    },

    patch: function (key, src, depth) {
      if (!Object.prototype.hasOwnProperty.call(this.config, key)) return null;
      this.mods = this.mods.filter(function (m) { return m.key !== key; });
      if (src && depth > 0) this.mods.push({ key: key, src: src, depth: clamp(+depth, 0, 1) });
      else if (this._modBase && this._modBase[key] != null) {
        this.config[key] = this._modBase[key]; delete this._modBase[key];
      }
      return this.mods.slice();
    },

    // The one way to write a tunable setting. Writing straight into `config` looks
    // like it works and then silently doesn't when the setting is patched onto a
    // clock: _modTick recomputes that field from _modBase every frame, so the new
    // value is gone before it is drawn. Move the base and the mod swings around the
    // new value instead.
    setTuned: function (key, value) {
      if (!Object.prototype.hasOwnProperty.call(this.config, key)) return false;
      if (!isFinite(value)) return false;                  // a NaN in config reaches a canvas
      if (this._modBase && this._modBase[key] != null) this._modBase[key] = value;
      this.config[key] = value;
      return true;
    },

    /* ── presets ───────────────────────────────────────────────────────────── */
    userPresets: [],          // [{ id, why, set:{...}, user:true }] — saved from the desk

    // Built-ins first, then K.'s own. One flat list; the dashboard marks the saved ones.
    presetList: function () { return PRESETS.concat(this.userPresets); },

    loadPreset: function (id) {
      var p = this.presetList().filter(function (x) { return x.id === id; })[0];
      if (!p) return false;
      var self = this, n = 0;
      for (var k in p.set) if (self.setTuned(k, p.set[k])) n++;
      this._toast(p.id);
      return n > 0;
    },

    // Saves the WHOLE desk, deliberately: a saved preset is "the room as it is right
    // now", which is what you reach for the button for. Re-saving a name overwrites,
    // so a look can be nudged and re-saved without collecting duplicates.
    savePreset: function (name, keys, group) {
      var id = String(name || "").trim().slice(0, 40);
      if (!id) return null;
      var snap = {}, self = this;
      // With `keys` (one desk section) the save is PARTIAL, like the built-ins — so a
      // nucleus you tuned can be dropped onto any room setting instead of dragging a
      // whole desk state along with it. Without, the whole desk.
      if (keys && keys.length) keys.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(self.config, k)) snap[k] = self.config[k];
      });
      else for (var k in this.config) snap[k] = this.config[k];
      // Save the pre-mod values, not wherever the LFOs happen to be this frame — else
      // a saved look is a random sample of its own modulation.
      if (this._modBase) for (var b in this._modBase) {
        if (this._modBase[b] != null && Object.prototype.hasOwnProperty.call(snap, b)) snap[b] = this._modBase[b];
      }
      this.userPresets = this.userPresets.filter(function (p) { return p.id !== id; });
      this.userPresets.push({ id: id, user: true, g: "saved",
        why: (keys && keys.length)
          ? "saved from " + (group || "one section") + " — " + keys.length + " settings, drops onto anything"
          : "saved from the desk — the whole thing",
        set: snap });
      this._save();
      this._toast("Saved “" + id + "”");
      return id;
    },

    deletePreset: function (id) {
      var n = this.userPresets.length;
      this.userPresets = this.userPresets.filter(function (p) { return p.id !== id; });
      if (this.userPresets.length !== n) this._save();
      return n !== this.userPresets.length;
    },

    /* ── outputs (what the surfaces read) ────────────────────────────────── */
    energy: function () { return this.business; }, // raw state

    // The spiral's rotation offset: a back-and-forth SWING (pendulum) whose amplitude
    // and rate both scale with business. At the floor, a slow gentle sway; pumped up,
    // a wide fast swing that narrows and slows as business decays — the visible decay.
    spiralAngle: function () {
      return this.business * this.config.swingAmp * Math.sin(this._swingPhase);
    },

    // THE PENDULUM (σ target, -1..1): the pattern RESOLVES to symmetry then DISSOLVES
    // to chaos and back, a clean swing. The swing width + rate scale with business —
    // pumped = wide fast resolve↔dissolve, decaying to a gentle sway as it winds down.
    // (The physical-rotation swing, spiralAngle(), is kept but no longer applied.)
    // FULL-SPECTRUM swing: always traverses chaos↔symmetry end to end, never parked
    // near the middle. Business sets how FAST it flips (the _swingPhase rate), not how
    // far — a calm room still fully resolves and dissolves, it just takes its time.
    spiralTune: function () {
      var range = (this.config.swingRange == null) ? 1 : this.config.swingRange;
      return range * Math.sin(this._swingPhase);
    },

    // THE ZOOM (≥1): how far into the spiral's centre we are diving. Same pendulum,
    // half rate — the dive deepens as the pattern resolves and pulls back out as it
    // dissolves (flip with config.zoomInvert). Depth rides business, so a room at
    // rest sits at full view: the dive is something you earn by pumping.
    // Consumers (symmetry.js) apply this as a canvas transform about the centre.
    spiralZoom: function () {
      if (this.zoomManual != null) return this.zoomManual;
      var c = this.config;
      var lo = (c.zoomMin == null) ? 1 : c.zoomMin, hi = (c.zoomMax == null) ? 1 : c.zoomMax;
      var u = (Math.sin(this._swingPhase * c.zoomRatio + this._zoomPhase) + 1) / 2;
      return lo + (hi - lo) * u * this.business;
    },

    // 0 → 1 as neglect sets in: how hard the room is asking for someone. Consumers
    // (screen pull-inward, decorative-lamp flicker) scale their cue by this.
    attention: function () {
      var over = this.idle - this.config.attentionAfter;
      if (over <= 0) return 0;
      return clamp(over / Math.max(1, this.config.attentionRamp), 0, 1);
    },

    // Wound all the way down — the room has come to a standstill.
    isDead: function () { return this.idle >= this.config.deathAfter; },

    // What actually goes to GlobalEnergy: business capped by the scheme's contrast,
    // so a calm scheme (few stars) can never drive the room to full energy. Rides
    // inside the already-slew-governed pipeline — no second uncoordinated channel.
    effectiveEnergy: function () {
      var l = this.activeLight();
      var e = this.business * lerp(this.config.contrastFloor, 1.0, l.contrastNorm);
      var cap = (this.config.energyCap == null) ? 1 : this.config.energyCap;
      return Math.min(e, cap);
    },

    /* ── the colour drift ──────────────────────────────────────────────────────
       K.: *"make the colors of the lights slowly drift into each other rather than
       get instaswapped — its a bit harsh of a mode shift."* A scene change used to
       replace the whole palette in one frame, so the lamps AND the screen cut. The
       seam always existed; attract mode made it happen every 25-45 s.

       Eased HERE, in the engine, rather than in the lamp-push path — because both
       surfaces read their colour through this one function (the screen via
       activeSpiral().palette), so fading it once fades the room and the projection
       together. Doing it in party-main.js would have smoothed the lamps and left the
       spiral still cutting.

       contrastNorm/speedNorm ease too: contrast feeds effectiveEnergy(), so letting
       it jump would put a step in the lamp brightness at the exact moment the colour
       is trying to glide. */
    _resolveLightId: function () {
      return this.activeLightId
        || (this.lightPlaylist.length ? this.lightPlaylist[this.lightCursor % this.lightPlaylist.length] : null)
        || this._firstUnlockedId(LIGHTS);
    },
    _lightOf: function (id) {
      var entry = LIGHTS.find(function (x) { return x.id === id; }) || LIGHTS[0];
      var r = resolveLight(entry, this._clock, this.business);
      return { colors: r.colors, contrastNorm: r.contrastNorm, speedNorm: r.speedNorm, params: r.params || null };
    },

    // Where the fade is RIGHT NOW. Also the starting point when a fade is interrupted
    // by another change — resuming from the eased value is what stops a mid-drift
    // scene change from snapping back to the old colour first.
    _palNow: function () {
      var p = this._pal;
      // The TARGET is re-resolved every call, never captured. A colour card's palette
      // is a function of time, so a captured `to` would freeze it on whatever colour it
      // happened to hold at the instant of the switch — the card would arrive dead.
      // `from` stays frozen on purpose: that IS the outgoing scene's last colour.
      var to = this._lightOf(p.curId || this._resolveLightId());
      if (!p.from || !(p.dur > 0)) return to;
      var k = p.t / p.dur;
      k = k * k * (3 - 2 * k);                       // smoothstep: no jerk at either end
      var pal = P();
      return {
        colors: pal ? pal.mixPalette(p.from.colors, to.colors, k)
                    : (k < 0.5 ? p.from.colors : to.colors),
        contrastNorm: lerp(p.from.contrastNorm, to.contrastNorm, k),
        speedNorm:    lerp(p.from.speedNorm,    to.speedNorm,    k),
        // Lamp params belong to the incoming scene — they are behaviour, not colour,
        // and half-applied behaviour is just wrong rather than half-arrived.
        params: to.params || null,
      };
    },

    // Driven from tick(). Detects the change here rather than at every call site that
    // can set activeLightId (cycle, commit, setActive, _advance, _autoPick) — one
    // place that cannot be forgotten. `_palFade` is the duration the NEXT change will
    // use: attract mode sets it, everything else leaves it 0 and snaps.
    _palTick: function (dt) {
      var p = this._pal, target = this._resolveLightId();
      if (target !== p.curId) {
        var prev = p.curId ? this._palNow() : null;
        p.curId = target;
        var next = this._lightOf(target);
        if (prev && this._palFade > 0) { p.from = prev; p.t = 0; p.dur = this._palFade; }
        else { p.from = null; p.t = 0; p.dur = 0; }
        this._palFade = 0;
      } else if (p.dur > 0) {
        p.t += dt;
        if (p.t >= p.dur) { p.t = p.dur; p.dur = 0; p.from = null; }   // settled
      }
    },
    fading: function () { return this._pal.dur > 0; },

    // Asked by symmetry.js before it layers two exhibits. Keyed by TITLE, because
    // that is all the renderer knows — the catalog id IS the exhibit title (§19.2).
    overlapAllowed: function (title) {
      // Attract mode skips overlap on roughly half its cycles so a pairing reads as
      // something that happened rather than a permanent double-exposure.
      if (this.auto && this._overlapThis === false) return false;
      var e = SPIRALS.find(function (x) { return x.id === title; });
      return !e || e.ovl !== false;
    },

    // Current light-scene: C# scene name + the EASED atlas palette + metadata. The id
    // is the target's, so a name appears the moment it is picked while its colour is
    // still arriving.
    activeLight: function () {
      var id = this._resolveLightId();
      var entry = LIGHTS.find(function (x) { return x.id === id; }) || LIGHTS[0];
      var now = this._palNow();
      return { id: entry.id, palette: now.colors, contrastNorm: now.contrastNorm,
               speedNorm: now.speedNorm, params: now.params || null, card: !!entry.card };
    },

    // Current spiral: geometry + business/motion-shaped chaos & spin speed, wearing
    // the active light-scene's palette. Motion is scaled by the scheme's speedNorm,
    // so a "barely moving" palette reads calm even at high business.
    activeSpiral: function () {
      var self = this;
      var light = this.activeLight();
      var motionGain = 0.3 + light.speedNorm * 0.7;
      // A CONTRIBUTED spiral is showing: draw its exhibit at the guest's OWN params (the
      // angle they found), wearing the room's live palette so it belongs to the room while
      // staying unmistakably theirs. params rides into ex.draw via the AmbientDirector.
      if (this._gardenId) {
        var g = this.garden.find(function (e) { return e.id === self._gardenId; });
        if (g) return {
          id: g.spiral, params: g.params || null,
          chaos: clamp(0.12 + this.business * 0.6 * motionGain, 0, 1),
          speed: (0.4 + this.business) * motionGain,
          palette: light.palette,
        };
        this._gardenId = null;   // entry capped out of the garden → fall back to the catalog
      }
      // `id` is the exhibit title — the screen looks the shape up by it. The old
      // per-entry `arms`/`chaos`/`spin` seeds are gone: they were persisted, shown in
      // the dashboard, and read by nothing. chaos/speed stay because they are DERIVED
      // (business × the scheme's own speedNorm), so a "barely moving" palette still
      // reads calm at high business.
      var id = this.activeSpiralId
        || (this.spiralPlaylist.length ? this.spiralPlaylist[this.spiralCursor % this.spiralPlaylist.length] : null)
        || this._firstUnlockedId(SPIRALS);
      var s = SPIRALS.find(function (x) { return x.id === id; }) || SPIRALS[0];
      return {
        id: s.id, params: null,
        chaos: clamp(0.12 + this.business * 0.6 * motionGain, 0, 1),
        speed: (0.4 + this.business) * motionGain,
        palette: light.palette,
      };
    },

    /* ── dashboard sync: a serializable view + a command applier (pure) ───── */
    snapshot: function () {
      function catSp(x) { return { id: x.id, u: !!x.u, off: !!x.off, ovl: x.ovl !== false }; }
      function catLi(x) { var r = resolveLight(x, PARTY._clock, PARTY.business); return { id: x.id, u: !!x.u, off: !!x.off, ovl: x.ovl !== false, card: !!x.card, hint: x.hint || "", palette: r.colors, contrast: r.contrastNorm }; }
      return {
        mode: this.mode, business: this.business, drive: this.drive,
        activeSpiralId: this.activeSpiralId, activeLightId: this.activeLightId,
        garden: this.garden.slice(), gardenId: this._gardenId,
        spiralPlaylist: this.spiralPlaylist.slice(), lightPlaylist: this.lightPlaylist.slice(),
        spiralCursor: this.spiralCursor, lightCursor: this.lightCursor,
        effectiveEnergy: this.effectiveEnergy(), tune: this.spiralTune(),
        zoom: this.spiralZoom(), zoomManual: this.zoomManual,
        idle: this.idle, attention: this.attention(), dead: this.isDead(),
        auto: !!this.auto, autoStep: this._autoStep,
        mods: this.mods.map(function (m) { return { key: m.key, src: m.src, depth: m.depth }; }),
        diceLimits: JSON.parse(JSON.stringify(this.diceLimits)),
        buttonMap: JSON.parse(JSON.stringify(this.buttonMap)),
        buttonActions: this.BUTTON_ACTIONS.slice(),
        spirals: SPIRALS.map(catSp), lights: LIGHTS.map(catLi),
        // Names + explanations only — the dashboard never needs the key blocks, and
        // shipping 30 numbers per preset at 4 Hz is pure noise on the wire.
        presets: this.presetList().map(function (p) { return { id: p.id, why: p.why, g: p.g || (p.user ? "saved" : "spiral"), user: !!p.user }; }),
        config: JSON.parse(JSON.stringify(this.config)),
      };
    },

    // Apply one dashboard command ({cmd, ...}). Returns nothing; caller re-broadcasts.
    apply: function (m) {
      if (!m || !m.cmd) return;
      this.idle = 0;                                   // a dashboard touch is attention too
      var pl = (m.mode === "spiral") ? this.spiralPlaylist : this.lightPlaylist;
      switch (m.cmd) {
        case "mode":   this.toggleMode(); break;
        // Attract mode on/off. Turning it OFF leaves whatever is on screen in place
        // (no snap back); turning it ON picks immediately rather than waiting out a
        // dwell, so the button visibly does something.
        case "auto":
          this.auto = (m.value == null) ? !this.auto : !!m.value;
          // Switched by hand, so it is no longer the room's decision — a guest touching
          // a button must not undo what K. deliberately turned on. See _slideshowTick.
          this._autoAuto = false;
          if (this.auto) { this._autoT = 0; this._autoPick(); }
          this._toast(this.auto ? "Auto" : "Manual");
          break;
        case "skip":   if (this.auto) { this._autoT = 0; this._autoPick(); } break;
        case "patch":  this.patch(m.key, m.src, m.depth); break;
        case "btn":       this.button(m.role, m.event); break;
        case "buttonMap": this.setButtonMap(m.gesture, m.action); break;
        case "diceLimit": this.setDiceLimit(m.key, +m.lo, +m.hi); break;
        case "diceClear": this.clearDiceLimit(m.key); break;
        case "cycle":  this.cycle(); break;
        case "commit": this.commit(); break;
        case "hold":   this.holdBright(m.dir || 0); break;
        case "business": this.business = clamp(+m.value || 0, 0, 1); break;
        // value = a number pins the zoom by hand; null/absent hands it back to the
        // pendulum. Separate from setConfig, which coerces everything to a number.
        case "zoom":
          this.zoomManual = (m.value == null) ? null : clamp(+m.value, 1, 8);
          break;
        case "setActive":
          this._gardenId = null;   // pinning a catalog shape leaves a shown contribution
          if (m.mode === "spiral") this.activeSpiralId = m.id; else this.activeLightId = m.id;
          break;
        // A game hands the room a spiral to keep — the ONE crossing from the arcade into
        // the living party (game.js host.contribute POSTs it over /party/pub). Purely
        // ADDITIVE: it can only append to the garden, never touch another guest's spiral
        // or the party's own state. Geometry + colour only; no text ever reaches here
        // (the display firewall). Shows it immediately, then it recurs via _autoPick.
        case "contribute": {
          if (!m.spiral) break;
          this._gardenSeq = (this._gardenSeq || 0) + 1;
          var ent = {
            id: "g" + this._gardenSeq + "-" + ((m.t | 0) || 0),
            spiral: String(m.spiral),
            params: (m.params && typeof m.params === "object") ? m.params : {},
            palette: m.palette | 0,
            t: (m.t | 0) || 0,
          };
          this.garden.push(ent);
          if (this.garden.length > 24) this.garden = this.garden.slice(-24);
          this._gardenId = ent.id;            // show it NOW — "it's breathing in the room"
          this.activeSpiralId = ent.spiral;   // so the director resolves the right exhibit
          this._save();
          this._toast("planted");
          break;
        }
        case "addToPlaylist":
          if (m.id && pl.indexOf(m.id) === -1) { pl.push(m.id); this._save(); }
          break;
        case "removeFromPlaylist":
          if (m.index >= 0 && m.index < pl.length) { pl.splice(m.index, 1); this._save(); }
          break;
        case "reorder":
          if (m.from >= 0 && m.from < pl.length && m.to >= 0 && m.to < pl.length) {
            var it = pl.splice(m.from, 1)[0]; pl.splice(m.to, 0, it); this._save();
          }
          break;
        case "zoomInvert":    this.config.zoomInvert    = this.config.zoomInvert    ? 0 : 1; break;
        case "zoomMode":      this.config.zoomMode      = this.config.zoomMode      ? 0 : 1; break;
        case "zoomOffscreen": this.config.zoomOffscreen = this.config.zoomOffscreen ? 0 : 1; break;
        case "setConfig": this.setTuned(m.key, +m.value); break;
        // Dashboard "randomise all" — one message, not thirty. The ranges live in the
        // dashboard's TUNE table (which is where they are written down once), so the
        // dice are thrown there and the result arrives as a block.
        case "setConfigMany": {
          var vals = m.values || {};
          for (var vk in vals) this.setTuned(vk, +vals[vk]);
          break;
        }
        // "back to how it was." Un-patches everything first: a mod holds the pre-mod
        // value in _modBase and would otherwise write it straight back over the
        // defaults on the next frame.
        case "preset":       this.loadPreset(m.id); break;
        case "savePreset":   this.savePreset(m.name, m.keys, m.group); break;
        case "deletePreset": this.deletePreset(m.id); break;
        // No `keys` = the whole desk back to factory. With `keys` (the dashboard sends
        // one group's worth) only that section resets, so "put the room back" does not
        // also throw away an hour of work on the nucleus.
        case "resetConfig": {
          var keys = m.keys && m.keys.length ? m.keys : null;
          var self0 = this;
          this.mods = this.mods.filter(function (md) {
            if (keys && keys.indexOf(md.key) === -1) return true;
            if (self0._modBase) delete self0._modBase[md.key];   // its base is about to be overwritten
            return false;
          });
          if (!keys) this._modBase = null;
          (keys || Object.keys(CONFIG_DEFAULTS)).forEach(function (dk) {
            if (Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, dk)) self0.config[dk] = CONFIG_DEFAULTS[dk];
          });
          this._toast(keys ? "Section reset" : "Settings reset");
          break;
        }
        // Curator veto. Switching off whatever is on screen right now would leave it
        // stuck there (nothing re-picks until the next advance), so step past it.
        case "off": {
          var lst = (m.mode === "spiral") ? SPIRALS : LIGHTS;
          var ent = lst.find(function (x) { return x.id === m.id; });
          if (!ent) break;
          ent.off = (m.value == null) ? !ent.off : !!m.value;
          var activeKey = (m.mode === "spiral") ? "activeSpiralId" : "activeLightId";
          if (ent.off && this[activeKey] === ent.id) {
            var left = this._available(lst);
            if (left.length) this[activeKey] = left[0].id;
          }
          this._save();
          break;
        }
        // Per-exhibit overlap veto — separate from `off`. `off` means "never show
        // this"; `ovl:false` means "show it, but never layered with anything else".
        // The escape-time exhibits are the likely customers: they are the expensive
        // ones, and overlap roughly doubles render cost.
        case "ovl": {
          var ol = (m.mode === "spiral") ? SPIRALS : LIGHTS;
          var oe = ol.find(function (x) { return x.id === m.id; });
          if (!oe) break;
          oe.ovl = (m.value == null) ? (oe.ovl === false) : !!m.value;
          this._save();
          break;
        }
        case "dwellMode":
          // 0 → 1 → 2 → 3 → 0. off / chaos / symmetry / both.
          this.config.dwellMode = ((this.config.dwellMode || 0) + 1) % 4;
          this._dwellRemaining = 0; this._dwellArmed = true;   // never strand a hold from the old mode
          break;
        case "overlapMode":
          // 0 → 1 → 2 → 0. off / transition / persistent.
          this.config.overlapMode = ((this.config.overlapMode || 0) + 1) % 3;
          break;
        case "unlockAll":
          SPIRALS.forEach(function (x) { x.u = true; }); LIGHTS.forEach(function (x) { x.u = true; }); this._save();
          break;
      }
    },

    /* ── toasts ──────────────────────────────────────────────────────────── */
    onToast: function (fn) { this._toastFns.push(fn); },
    _toast: function (text) { this._toastFns.forEach(function (f) { try { f(text); } catch (e) {} }); },

    /* ── persistence (localStorage; guarded for node) ────────────────────── */
    _key: "deephouse.party",
    _save: function () {
      try {
        if (!root.localStorage) return;
        root.localStorage.setItem(this._key, JSON.stringify({
          spiralPlaylist: this.spiralPlaylist, lightPlaylist: this.lightPlaylist,
          spiralCursor: this.spiralCursor, lightCursor: this.lightCursor, genCount: this._genCount,
          // The garden survives a reload — a flower a guest planted, gone at the next
          // refresh, is worse than none. Newest 24; ids resolved against the catalog on load.
          garden: this.garden,
          us: SPIRALS.filter(function (x) { return x.u; }).map(function (x) { return x.id; }),
          ul: LIGHTS.filter(function (x) { return x.u; }).map(function (x) { return x.id; }),
          // Vetoes survive a reload — switching a badly-behaving exhibit off mid-party
          // and having it come back at the next refresh would be worse than useless.
          offs: SPIRALS.concat(LIGHTS).filter(function (x) { return x.off; }).map(function (x) { return x.id; }),
          noovl: SPIRALS.concat(LIGHTS).filter(function (x) { return x.ovl === false; }).map(function (x) { return x.id; }),
          presets: this.userPresets,
          genSpirals: SPIRALS.slice(STATIC_SPIRALS),
          genLights:  LIGHTS.slice(STATIC_LIGHTS),
        }));
      } catch (e) {}
    },
    _load: function () {
      try {
        if (!root.localStorage) return;
        var raw = root.localStorage.getItem(this._key);
        if (!raw) return;
        var d = JSON.parse(raw);
        // Spirals can no longer be minted (the catalog IS the exhibit list — see
        // SPIRAL_TITLES above, and _mint() returns null in spiral mode). So a persisted
        // `genSpirals` entry is always a relic of a browser that minted one before that
        // change — restoring it would resurrect a name with no shape behind it, exactly
        // the bug the naming change removed. d.genSpirals is intentionally never applied.
        // Lights are unaffected: the palette atlas genuinely can still mint a scheme.
        (d.genLights || []).forEach(function (e) { if (!LIGHTS.find(function (x) { return x.id === e.id; })) LIGHTS.push(e); });
        // Self-healing migration. Playlists saved before the catalog became the exhibit
        // list point at ids that no longer exist ("gyre", "Trefoil Gyre", minted spiral
        // names). Left in, they resolve to nothing and the screen looks broken for
        // reasons no one can see. Drop them instead — a stale store degrades to empty
        // playlists, which is a state the room already knows how to run from.
        this.spiralPlaylist = (d.spiralPlaylist || []).filter(function (id) {
          return SPIRALS.some(function (x) { return x.id === id; });
        });
        this.lightPlaylist  = (d.lightPlaylist || []).filter(function (id) {
          return LIGHTS.some(function (x) { return x.id === id; });
        });
        // Restore the garden — keep only entries whose spiral still resolves to a real
        // exhibit (a renamed/removed shape would draw nothing). Boots into normal rotation
        // (_gardenId stays null); planted flowers recur through _autoPick. _gardenSeq is
        // lifted past the loaded ids so a fresh contribution can't collide with one.
        this.garden = (d.garden || []).filter(function (e) {
          return e && e.spiral && SPIRALS.some(function (x) { return x.id === e.spiral; });
        });
        this._gardenSeq = this.garden.reduce(function (mx, e) {
          var n = parseInt(String(e.id).slice(1), 10); return (n > mx) ? n : mx;
        }, 0);
        // Saved looks survive a reload — a preset built during the party and lost at
        // the next refresh is worse than no button at all.
        this.userPresets = (d.presets || []).filter(function (p) { return p && p.id && p.set; });
        this.spiralCursor   = d.spiralCursor || 0;
        this.lightCursor    = d.lightCursor || 0;
        this._genCount      = d.genCount || 0;
        (d.us || []).forEach(function (id) { var s = SPIRALS.find(function (x) { return x.id === id; }); if (s) s.u = true; });
        (d.ul || []).forEach(function (id) { var l = LIGHTS.find(function (x) { return x.id === id; }); if (l) l.u = true; });
        (d.offs || []).forEach(function (id) {
          var e = SPIRALS.find(function (x) { return x.id === id; }) || LIGHTS.find(function (x) { return x.id === id; });
          if (e) e.off = true;
        });
        (d.noovl || []).forEach(function (id) {
          var e = SPIRALS.find(function (x) { return x.id === id; }) || LIGHTS.find(function (x) { return x.id === id; });
          if (e) e.ovl = false;
        });
      } catch (e) {}
    },

    /* ── internals ───────────────────────────────────────────────────────── */
    _catalog: function () { return this.mode === "spiral" ? SPIRALS : LIGHTS; },

    // What the room may actually show: unlocked AND not switched off. `off` is the
    // curator's veto, separate from `u` on purpose — locked means "not yet earned",
    // off means "I have seen this one and it does not present well" (it lagged, it
    // strobed, it looked like static). Mandelbrot is the reason this exists.
    _available: function (list) {
      return (list || this._catalog()).filter(function (x) { return x.u && !x.off; });
    },
    _firstUnlockedId: function (list) { var u = list.filter(function (x) { return x.u; }); return (u[0] || list[0]).id; },

    // Test/reset hook — restores static catalog, drops generated entries, clears playlists.
    _reset: function () {
      SPIRALS.length = STATIC_SPIRALS; LIGHTS.length = STATIC_LIGHTS;
      SPIRALS.forEach(function (x) { x.u = true; x.off = false; x.ovl = true; });   // all shapes, always
      // Static schemes still earn by commit (first two unlocked); CARDS are always
      // unlocked — they exist to be cycled through, not earned.
      LIGHTS.forEach(function (x, i) { x.u = x.card ? true : i < 2; x.off = false; });
      this.business = this.config.floor; this.mode = "spiral"; this.drive = 0;
      this.spiralPlaylist = []; this.lightPlaylist = [];
      this.garden = []; this._gardenId = null; this._gardenSeq = 0;
      this.spiralCursor = 0; this.lightCursor = 0; this._genCount = 0;
      this.activeSpiralId = SPIRALS[0].id; this.activeLightId = LIGHTS[0].id;
      this._browse = { spiral: 0, light: 0 }; this._wasAboveFloor = false; this._swingPhase = 0;
      this._dwellRemaining = 0; this._dwellArmed = true;
      this._zoomPhase = 0; this.zoomManual = null;
      this.auto = false; this._autoStep = 0; this._autoT = 0; this._autoDwell = 30; this._autoAmp = 0.5;
      this._autoAuto = false; this._lastIdle = 0; this.diceLimits = {};
      this._pal = { curId: null, from: null, to: null, t: 0, dur: 0 }; this._palFade = 0;
      this._overlapThis = true; this._clock = 0;
      this.mods = []; this._modBase = null; this._modBreath = 0; this.userPresets = [];
      this.idle = 0;
    },
  };

  // Taken once, before anything can touch config, so "reset to original" means the
  // values written in this file — not whatever the room happened to be at on load.
  var CONFIG_DEFAULTS = JSON.parse(JSON.stringify(PARTY.config));

  PARTY._load();
  root.PARTY = PARTY;
  if (typeof module !== "undefined" && module.exports) module.exports = PARTY;
})();
