/* palettes.js — the Psychedelic Palette Atlas as data + a generator.
 *
 * 12 named schemes from the atlas, each a 4-role palette (primary/secondary/
 * bridge/accent) given in CIE 1931 xy. xy is the source of truth; hex is
 * precomputed once at load (the 12 are static). A generator mints fresh 5-role
 * schemes (adding the "breath" relief role) when the unlock ledger runs past the
 * hand-authored catalog — the atlas's own "pick an anchor, derive neighbours"
 * grammar.
 *
 * Authority (per architecture): the atlas owns COLOUR. The C# SceneCatalog owns
 * motion/structure (which layers run). party.js pushes the hex from here; it
 * overrides the C# scene's built-in palette rather than blending.
 *
 * Browser (window) + bare vm/node (globalThis), guarded — same discipline as
 * house.js / party.js. Pure data + math, no I/O.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  /* ── CIE xyY → sRGB hex (D65). Y absent from the atlas, so each role carries a
     default luminance; out-of-gamut anchors clip toward the nearest primary
     (expected for Acid Green / Deep Blue, not a bug). ────────────────────────── */
  function xyYtoRgb(x, y, Y) {
    if (y <= 1e-6) return [0, 0, 0];
    var X = (x / y) * Y, Z = ((1 - x - y) / y) * Y;
    var r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    var g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    var b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
    var m = Math.max(r, g, b, 1); r /= m; g /= m; b /= m; // preserve hue if >1
    function enc(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
    return [Math.round(enc(r) * 255), Math.round(enc(g) * 255), Math.round(enc(b) * 255)];
  }
  function toHex(rgb) {
    return rgb.map(function (v) { var h = clamp(v, 0, 255).toString(16); return h.length < 2 ? "0" + h : h; }).join("");
  }
  // Per-role default luminance. Accent brightest by construction — that IS the
  // atlas's "only one colour may scream" rule, enforced without extra logic.
  var Y = { primary: 0.50, secondary: 0.45, bridge: 0.40, accent: 0.65, breath: 0.55 };

  // motion word → 0..1 (authored, not fuzzy-matched at runtime)
  var MOTION = {
    "Barely moving": 0.05, "Extremely slow": 0.10, "Very slow": 0.15, "Very smooth": 0.25,
    "Slow waves": 0.30, "Slow pulses": 0.30, "Breathing": 0.35, "Flowing": 0.45,
    "Medium-fast": 0.65, "Chaotic growth": 0.70, "Erratic": 0.85, "Rapid flickers": 0.90,
  };

  // xy of the 4 roles per scheme. `dark:true` = "Black" accent (no xy in atlas) →
  // rendered near-black via a low-Y override.
  var SCHEMES = [
    { id: "Deep Ocean",    mood: "Calm",     stars: 2, motion: "Very slow",
      roles: { primary: [0.15, 0.06], secondary: [0.20, 0.28], bridge: [0.22, 0.33], accent: [0.313, 0.329] } },
    { id: "Aurora",        mood: "Wonder",   stars: 3, motion: "Slow waves",
      roles: { primary: [0.27, 0.57], secondary: [0.22, 0.33], bridge: [0.29, 0.16], accent: [0.33, 0.55] } },
    { id: "Synthwave",     mood: "Neon",     stars: 4, motion: "Medium-fast",
      roles: { primary: [0.33, 0.16], secondary: [0.22, 0.33], bridge: [0.29, 0.15], accent: [0.313, 0.329] } },
    { id: "Sacred Fire",   mood: "Ritual",   stars: 4, motion: "Slow pulses",
      roles: { primary: [0.64, 0.33], secondary: [0.50, 0.42], bridge: [0.31, 0.17], accent: [0.313, 0.329], accentDark: true } },
    { id: "Alien Flora",   mood: "Organic",  stars: 5, motion: "Chaotic growth",
      roles: { primary: [0.33, 0.55], secondary: [0.30, 0.18], bridge: [0.22, 0.33], accent: [0.313, 0.329] } },
    { id: "Solar Temple",  mood: "Divine",   stars: 3, motion: "Breathing",
      roles: { primary: [0.47, 0.46], secondary: [0.55, 0.40], bridge: [0.60, 0.34], accent: [0.313, 0.329], accentDark: true } },
    { id: "Electric Storm",mood: "Energy",   stars: 5, motion: "Rapid flickers",
      roles: { primary: [0.16, 0.08], secondary: [0.33, 0.16], bridge: [0.30, 0.60], accent: [0.313, 0.329] } },
    { id: "Dream Bloom",   mood: "Floating", stars: 2, motion: "Very smooth",
      roles: { primary: [0.38, 0.26], secondary: [0.30, 0.20], bridge: [0.20, 0.30], accent: [0.34, 0.53] } },
    { id: "Toxic Reactor", mood: "Sci-fi",   stars: 5, motion: "Erratic",
      roles: { primary: [0.30, 0.60], secondary: [0.42, 0.50], bridge: [0.22, 0.33], accent: [0.313, 0.329], accentDark: true } },
    { id: "Cosmic Void",   mood: "Mystery",  stars: 3, motion: "Extremely slow",
      roles: { primary: [0.15, 0.06], secondary: [0.25, 0.14], bridge: [0.313, 0.329], accent: [0.33, 0.16] } },
    { id: "Coral Reef",    mood: "Playful",  stars: 3, motion: "Flowing",
      roles: { primary: [0.56, 0.38], secondary: [0.19, 0.31], bridge: [0.24, 0.46], accent: [0.42, 0.49] } },
    { id: "White Lotus",   mood: "Meditation", stars: 1, motion: "Barely moving",
      roles: { primary: [0.313, 0.329], secondary: [0.23, 0.32], bridge: [0.30, 0.22], accent: [0.46, 0.45] } },
  ];

  var ROLE_ORDER = ["primary", "secondary", "bridge", "accent"];

  function bake(scheme) {
    var hex = {};
    ROLE_ORDER.forEach(function (role) {
      var xy = scheme.roles[role];
      if (!xy) return;
      var lum = (role === "accent" && scheme.roles.accentDark) ? 0.03 : Y[role];
      hex[role] = toHex(xyYtoRgb(xy[0], xy[1], lum));
    });
    if (scheme.roles.breath) hex.breath = toHex(xyYtoRgb(scheme.roles.breath[0], scheme.roles.breath[1], Y.breath));
    var order = scheme.roles.breath ? ["primary", "secondary", "bridge", "accent", "breath"] : ROLE_ORDER;
    return {
      id: scheme.id, mood: scheme.mood,
      contrastNorm: scheme.stars / 5,
      speedNorm: MOTION[scheme.motion] != null ? MOTION[scheme.motion] : 0.3,
      hex: hex,
      colors: order.map(function (r) { return hex[r]; }).filter(Boolean),
    };
  }

  var _baked = {};
  SCHEMES.forEach(function (s) { _baked[s.id] = bake(s); });

  /* ── Generator: the atlas's 5-step grammar. Seeds an anchor from one of the 12
     named primaries ("in-family" — a taste call K. can flip to free-roaming), then
     derives neighbours, warm/cool leans, a breath relief, and a screaming accent.
     `seedIndex`/`jitter` are passed in (no Math.random — keeps it vm-safe and the
     caller varies them by the unlock count). ─────────────────────────────────── */
  /* ── Naming ───────────────────────────────────────────────────────────────
     Generated schemes used to be called "Gen-Aurora-42", which is a serial number
     wearing a costume: it tells a curator nothing and reads as spam when the
     unlock toast fires. A name should say what the colour IS, so the first word
     comes from the primary's actual hue and the second is a deterministic pick
     from an atlas-flavoured noun list. Same seed → same name, always. */
  // One word per 30° sector, in hue order — 0°=red through 330°=rose. Keep these
  // aligned with the sectors: an earlier list had Gold sitting on 90–120°, which
  // named a plainly green scheme "Gold Aria".
  var HUE_WORDS = ["Crimson", "Ember", "Gold", "Lime", "Jade", "Teal",
                   "Cyan", "Azure", "Indigo", "Violet", "Magenta", "Rose"];
  var FORM_WORDS = ["Tide", "Bloom", "Veil", "Drift", "Hollow", "Halo", "Mirage",
                    "Current", "Lantern", "Nocturne", "Meridian", "Cascade",
                    "Thicket", "Ravine", "Cathedral", "Aria"];

  // Hue angle (0..360) of an "rrggbb" hex — enough to place a colour in a family.
  function hueOf(hex) {
    var n = parseInt(hex, 16);
    var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 1e-6) return 0;                       // greys have no hue; Crimson by convention
    var hh;
    if (mx === r) hh = ((g - b) / d) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60; if (hh < 0) hh += 360;
    return hh;
  }

  /* ── Mixing two schemes: for crossfading one light-scene into the next ──────
     WHY NOT A PLAIN RGB LERP. Halfway between Deep Ocean's blue (1a3fbf-ish) and
     Sacred Fire's amber, componentwise RGB lands on a desaturated grey-brown: the
     straight line between two saturated colours passes near the achromatic axis.
     On the lamps that reads as the room briefly going dead, which is worse than
     the hard cut we are replacing.

     So mix in HSV along the SHORTEST hue path (going 350°→10° must cross 0°, not
     travel 340° the long way round), and lerp S and V directly. That traces an arc
     around the colour wheel instead of a chord through the middle, so saturation is
     held up all the way across.

     Grey has no hue (hueOf returns 0 by convention), so mixing to/from a grey would
     otherwise sweep the whole wheel on the way. When one end is unsaturated we keep
     the OTHER end's hue and just move saturation — the colour fades in or out in
     place, which is what "no hue" should mean. */
  function rgbOf(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function satVal(hex) {
    var c = rgbOf(hex), mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    return { s: mx === 0 ? 0 : (mx - mn) / mx, v: mx / 255 };
  }
  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex([Math.round((t[0] + m) * 255), Math.round((t[1] + m) * 255), Math.round((t[2] + m) * 255)]);
  }

  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    var ha = hueOf(a), hb = hueOf(b), A = satVal(a), B = satVal(b);
    if (A.s < 0.02) ha = hb;                  // no hue of its own — adopt the target's
    else if (B.s < 0.02) hb = ha;
    var d = ((hb - ha + 540) % 360) - 180;    // shortest signed path, -180..180
    return hsvToHex(ha + d * t, A.s + (B.s - A.s) * t, A.v + (B.v - A.v) * t);
  }

  // Schemes differ in length — 3-entry FALLBACK, 4 static roles, 5 when a scheme has
  // a `breath`. Walk the LONGER one and clamp the short side to its last entry, or a
  // mid-fade palette comes out shorter than either end and the lamp palette string
  // (which is positional) silently means something else.
  function mixPalette(a, b, t) {
    a = a || []; b = b || [];
    if (!a.length) return b.slice(); if (!b.length) return a.slice();
    var n = Math.max(a.length, b.length), out = [];
    for (var i = 0; i < n; i++) out.push(mix(a[Math.min(i, a.length - 1)], b[Math.min(i, b.length - 1)], t));
    return out;
  }

  function nameFor(primaryHex, seedIndex) {
    var hueWord = HUE_WORDS[Math.floor(hueOf(primaryHex) / 30) % 12];
    // Stride by a number coprime with the list length so consecutive unlocks never
    // land on the same noun twice in a row.
    var form = FORM_WORDS[Math.abs(seedIndex * 7 + 3) % FORM_WORDS.length];
    return hueWord + " " + form;
  }

  function generate(seedIndex, jitter) {
    var base = SCHEMES[((seedIndex % SCHEMES.length) + SCHEMES.length) % SCHEMES.length];
    var a = base.roles.primary;
    var j = jitter || 0;
    function near(dx, dy) { return [clamp(a[0] + dx, 0.02, 0.72), clamp(a[1] + dy, 0.02, 0.82)]; }
    // 3 neighbours in a 0.03–0.06 xy ring, angle varied by jitter
    var ang = (j * 2.399);                       // golden-angle spread, deterministic
    var secondary = near(0.045 * Math.cos(ang),        0.045 * Math.sin(ang));
    var bridge    = near(0.035 * Math.cos(ang + 2.09), 0.035 * Math.sin(ang + 2.09));
    // breath: desaturate a neighbour toward D65 white (relief zone)
    var breath = [secondary[0] + (0.3127 - secondary[0]) * 0.8, secondary[1] + (0.329 - secondary[1]) * 0.8];
    // accent: push hard away from the anchor for max chroma (the scream)
    var accent = [clamp(a[0] + (a[0] - 0.3127) * 0.9 + 0.05, 0.02, 0.72),
                  clamp(a[1] + (a[1] - 0.329) * 0.9, 0.02, 0.82)];
    var primaryHex = toHex(xyYtoRgb(a[0], a[1], Y.primary));
    var id = nameFor(primaryHex, seedIndex);
    return {
      id: id, mood: "Generated",
      contrastNorm: base.stars / 5,
      speedNorm: MOTION[base.motion] != null ? MOTION[base.motion] : 0.3,
      hex: {
        primary:   toHex(xyYtoRgb(a[0], a[1], Y.primary)),
        secondary: toHex(xyYtoRgb(secondary[0], secondary[1], Y.secondary)),
        bridge:    toHex(xyYtoRgb(bridge[0], bridge[1], Y.bridge)),
        accent:    toHex(xyYtoRgb(accent[0], accent[1], Y.accent)),
        breath:    toHex(xyYtoRgb(breath[0], breath[1], Y.breath)),
      },
      get colors() { return [this.hex.primary, this.hex.secondary, this.hex.bridge, this.hex.accent, this.hex.breath]; },
    };
  }

  var PALETTES = {
    ids: SCHEMES.map(function (s) { return s.id; }),
    get: function (id) { return _baked[id] || _baked[SCHEMES[0].id]; },
    all: function () { return SCHEMES.map(function (s) { return _baked[s.id]; }); },
    generate: generate,
    nameFor: nameFor,
    mix: mix, mixPalette: mixPalette,   // crossfading one light-scene into the next
    hsvHex: hsvToHex,                   // the colour cards build their palettes from this
    xyYtoRgb: xyYtoRgb, toHex: toHex,   // exposed for tests
    hueOf: hueOf,
  };

  root.PALETTES = PALETTES;
  if (typeof module !== "undefined" && module.exports) module.exports = PALETTES;
})();
