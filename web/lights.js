/* lights.js — the speaker test, for lamps.
 *
 * K., 2026-07-28: "I really just want to have something with a ui interface that we can
 * finetune and test. like a speaker test for surround but with lights."
 *
 * Tap a lamp, it blinks alone, you say which bulb it was, you drag it onto the floorplan.
 * That is the whole instrument.
 *
 * WHY IT IS ITS OWN PAGE and not a dashboard section: dashboard.js rebuilds its DOM at
 * 4 Hz behind a structKey/quietUntil guard that already eats clicks when it gets it
 * wrong. A canvas with pointer-drag inside that loop fights it directly. The two also
 * have different lifetimes — the dashboard is a party-night instrument, this is a setup
 * instrument used twice a year.
 *
 * THE THREE FACTS. Every lamp carries three independent booleans, and being unable to
 * see them together is what hid a month-long bug:
 *   selected   — do we drive it at all      (ours: light-selection.json)
 *   streaming  — is it in the entertainment area, i.e. can it receive colour AT ALL
 *   positioned — does it have a real room position, i.e. can it join the spatial flood
 * `streaming:false` is the loud one: such a lamp gets NOTHING, no matter what we send,
 * because ApplyStates drops anything outside the entertainment group. Five of K.'s ten
 * were in that state for a month while every call answered 200.
 *
 * The bottom half of this file is browser-only; the top half is pure and is what
 * tools/party-tests/lights-map.test.js exercises.
 */
(function () {
  "use strict";

  /* ── pure core ─────────────────────────────────────────────────────────── */

  // The room is normalised to [-1,1] on each axis; centimetres exist only at the edges
  // of the system. Same formula as LightPositionMapper.Normalize — if these drift apart
  // the UI lies about where it just put a lamp.
  function normFromCm(cm, roomCm) { return 2 * (cm / roomCm) - 1; }
  function cmFromNorm(n, roomCm) { return (n + 1) / 2 * roomCm; }

  // Same 1e-6 test as SuperfluidFlowLayer.IsUnmapped and HueEngine.IsAtOrigin. Three
  // copies of one rule is two too many, but the alternative is the badge disagreeing
  // with what the layer actually does, which is worse.
  function isAtOrigin(x, y, z) {
    return Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6 && Math.abs(z) < 1e-6;
  }

  // Top-down plan. x runs left→right; y=+1 is drawn at the TOP because that is where the
  // screen sits, and the flood radiates from the screen — a map with the origin at the
  // bottom would read upside down against the thing it describes.
  function roomToCanvas(x, y, w, h, pad) {
    pad = pad || 0;
    return {
      cx: pad + (x + 1) / 2 * (w - 2 * pad),
      cy: pad + (1 - y) / 2 * (h - 2 * pad)
    };
  }
  function canvasToRoom(cx, cy, w, h, pad) {
    pad = pad || 0;
    var x = (cx - pad) / (w - 2 * pad) * 2 - 1;
    var y = 1 - (cy - pad) / (h - 2 * pad) * 2;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* HEIGHT IS NOT COSMETIC, and it is not what its name suggests.
   *
   * It was three bands here originally, justified by "SuperfluidFlowLayer's corner
   * targets ignore Z". The corners do (they are pinned at z=0, SuperfluidFlowLayer.cs
   * :113-118) — but z still reaches the render through two continuous paths:
   *
   *   1. `dist` is a 3D distance from the origin (:126), which sets WHEN the tide
   *      reaches this lamp and where it sits in the colour ramp.
   *   2. `align` is a dot product against corner directions (:225). Because every corner
   *      sits at z=0, a lamp with a large |z| has its unit direction tilted out of that
   *      plane, which lowers its alignment with EVERY corner.
   *
   * So raising a lamp makes it reached LATER and swept MORE WEAKLY. That is a
   * participation dial wearing a misleading name, and it is continuous — which is why
   * this is a slider and no longer three bands. K.: "why is it like that. and not a
   * height slider? those are some weird settings no?" Correct on both counts.
   */
  function describeHeight(z) {
    if (z <= -0.55) return "low — swept early and hard";
    if (z <= -0.15) return "floor-ish";
    if (z < 0.15) return "level with the screen — fullest sweep";
    if (z < 0.55) return "raised — reached later, gentler";
    return "high — last to be reached, barely swept";
  }

  /* ── the sweep model ───────────────────────────────────────────────────────
   * A PORT of SuperfluidFlowLayer.OnActivate/Update, so the map can show what the room
   * is *supposed* to be doing at this instant and K. can compare it against what the
   * room actually does. That comparison is the entire point of the instrument: a
   * position is only correct if the sweep arrives when and where the map says it will.
   *
   * ⚠ THIS IS A MIRROR, AND MIRRORS DRIFT. If SuperfluidFlowLayer changes, this lies —
   * confidently, and in the one tool built to be trusted. The maths is pinned by
   * lightsmap.test.js against values taken from the C#; if that suite fails after a
   * layer change, THIS is what needs updating, not the test.
   */
  function findOrigin(lamps) {
    var hints = ["tv", "screen", "scherm", "monitor", "display"];
    var placed = lamps.filter(function (l) { return l.positioned; });
    for (var i = 0; i < placed.length; i++) {
      var n = (placed[i].name || "").toLowerCase();
      for (var h = 0; h < hints.length; h++)
        if (n.indexOf(hints[h]) !== -1) return { x: placed[i].x, y: placed[i].y, z: placed[i].z };
    }
    if (!placed.length) return { x: 0, y: 0, z: 0 };
    var sx = 0, sy = 0, sz = 0;
    placed.forEach(function (l) { sx += l.x; sy += l.y; sz += l.z; });
    return { x: sx / placed.length, y: sy / placed.length, z: sz / placed.length };
  }

  var CORNERS = [[-1, -1, 0], [-1, 1, 0], [1, -1, 0], [1, 1, 0]];
  function dist3(a, b) {
    var dx = a.x - b[0], dy = a.y - b[1], dz = a.z - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function smoothStep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* Per-lamp intensity 0..1 at a given point in the tide. `reach` is the same
     (sin(phase)+1)/2 the layer computes; `spread` is config.spread. */
  function predictSweep(lamps, reach, spread) {
    var origin = findOrigin(lamps);
    var placed = lamps.filter(function (l) { return l.positioned; });
    var per = placed.map(function (l) {
      var d = dist3(origin, [l.x, l.y, l.z]);
      var dir = d < 0.001 ? { x: 0, y: 0, z: 0 }
        : { x: (l.x - origin.x) / d, y: (l.y - origin.y) / d, z: (l.z - origin.z) / d };
      return { lamp: l, dir: dir, d: d };
    });

    var out = {};
    per.forEach(function (p) {
      var best = 0;
      CORNERS.forEach(function (c) {
        var cd = dist3(origin, c);
        if (cd < 0.001) return;
        var cdir = { x: (c[0] - origin.x) / cd, y: (c[1] - origin.y) / cd, z: (c[2] - origin.z) / cd };
        // Corners sit at z=0, so a lamp lifted out of that plane aligns less with EVERY
        // corner — which is why height quietly reduces how hard a lamp is swept.
        var align = clamp((p.dir.x * cdir.x + p.dir.y * cdir.y + p.dir.z * cdir.z + 1) * 0.5, 0, 1);
        var distT = clamp(p.d / cd, 0, 1);
        var edge = 1 - clamp(Math.abs(distT - reach) / spread, 0, 1);
        var intensity = smoothStep(edge) * align;
        if (intensity > best) best = intensity;
      });
      out[p.lamp.id] = best;
    });
    return out;
  }

  /* Per-lamp detail: intensity AND normalised distance, the latter being what the layer
     turns into colour. Kept separate from predictSweep() so the older callers and tests
     that just want intensity are untouched. */
  function predictDetail(lamps, reach, spread) {
    var origin = findOrigin(lamps);
    var placed = lamps.filter(function (l) { return l.positioned; });
    var d = {}, maxD = 0;
    placed.forEach(function (l) {
      d[l.id] = dist3(origin, [l.x, l.y, l.z]);
      if (d[l.id] > maxD) maxD = d[l.id];
    });
    if (maxD < 0.001) maxD = 1;
    var inten = predictSweep(lamps, reach, spread);
    var out = {};
    placed.forEach(function (l) {
      // SuperfluidFlowLayer.cs:246 — colour position is distance from the origin,
      // nudged by the tide so the hue front advances and recedes with the swell.
      out[l.id] = {
        intensity: inten[l.id] || 0,
        distNorm: clamp(d[l.id] / maxD, 0, 1),
        colorT: clamp(d[l.id] / maxD, 0, 1) + (reach - 0.5) * 0.15
      };
    });
    return out;
  }

  /* ── palette sampling: a MIRROR of ColorMath.SamplePalette ─────────────────
   * Wrap into [0,1), scale across the palette LOOPING back to the first colour, smooth
   * the fraction, lerp in HSV by the shortest hue path. The looping is why a plain list
   * jumps at the wrap — the last colour blends back into the first — and it is why the
   * modes below keep colorSpan below 1.0 rather than letting the far end of the room
   * wrap around to the near end's colour. */
  function samplePalette(pal, t) {
    if (!pal || !pal.length) return { r: 0, g: 0, b: 0 };
    if (pal.length === 1) return hexToRgb(pal[0]);
    t -= Math.floor(t);
    var scaled = t * pal.length;
    var i = Math.floor(scaled) % pal.length;
    var next = (i + 1) % pal.length;
    return lerpHsv(hexToRgb(pal[i]), hexToRgb(pal[next]), smoothStep(scaled - Math.floor(scaled)));
  }
  function hexToRgb(h) {
    h = String(h).replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHsv(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: h, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToRgb(c) {
    var f = function (n) {
      var k = (n + c.h / 60) % 6;
      return Math.round(255 * (c.v - c.v * c.s * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return { r: f(5), g: f(3), b: f(1) };
  }
  function lerpHsv(a, b, t) {
    var A = rgbToHsv(a), B = rgbToHsv(b);
    var dh = B.h - A.h;                      // shortest way round the wheel, or a fade
    if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return hsvToRgb({ h: (A.h + dh * t + 360) % 360, s: A.s + (B.s - A.s) * t, v: A.v + (B.v - A.v) * t });
  }

  /* ── sweep modes ───────────────────────────────────────────────────────────
   * K.: "now it just kinda fades blueish but thats hard to distinguish the order tbh."
   * Correct — with one colour the ONLY signal is brightness, and brightness is exactly
   * what the slew limiter is built to soften. Colour is carried by distance from the
   * origin (SuperfluidFlowLayer.cs:246), so a palette turns the room into a spatial
   * ruler: a lamp's hue tells you where the model thinks it is, independently of timing.
   *
   * colorSpan stays under 1.0 on the banded modes on purpose. SamplePalette loops the
   * last colour back into the first, so at span 1.0 the furthest lamp wears the nearest
   * lamp's colour — the wrap that party-main.js works around with there-and-back lists.
   */
  var SWEEP_MODES = [
    {
      key: "zones", name: "Zones", brightBand: 0.4, colorSpan: 0.78, colorDrift: 0,
      palette: ["FF2D2D", "FF9500", "FFE800", "28C76F", "2D7DFF"],
      hint: "Distance becomes colour: red near the screen through to blue at the far corner. " +
            "Check each lamp's COLOUR against its dot — this catches a wrong position even " +
            "while the room is standing still."
    },
    {
      key: "crest", name: "Hot crest", brightBand: 1.0, colorSpan: 0.9, colorDrift: 0,
      palette: ["06102E", "3AA0FF", "FFFFFF", "3AA0FF", "06102E"],
      hint: "A white crest travelling over near-black. The clearest read of ORDER — watch " +
            "which lamp the crest touches next."
    },
    {
      key: "plain", name: "Brightness only", brightBand: 1.0, colorSpan: 1.0, colorDrift: 0,
      palette: [],
      hint: "One colour, brightness does everything. Honest but hard to follow — the slew " +
            "limiter softens exactly the signal you are reading."
    },
    {
      key: "spectrum", name: "Spectrum drift", brightBand: 0.5, colorSpan: 0.85, colorDrift: 0.04,
      palette: ["FF0055", "FF9500", "FFE800", "28C76F", "00C7C7", "2D7DFF", "8A4FFF"],
      hint: "The full wheel across the room, slowly drifting. Least diagnostic, best for " +
            "judging whether the room LOOKS good once positions are right."
    }
  ];
  /* Empty body, whitespace, or a 200 carrying no JSON are all "nothing", not failures.
     Only genuinely malformed JSON is an error worth showing. */
  function parseMaybeJson(text) {
    if (text == null) return null;
    var t = String(text).trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function modeByKey(k) {
    for (var i = 0; i < SWEEP_MODES.length; i++) if (SWEEP_MODES[i].key === k) return SWEEP_MODES[i];
    return SWEEP_MODES[0];
  }

  /* reach at t seconds after a fresh /effects/run. _phase integrates from 0, so this is
     knowable — which is what makes a model-vs-room comparison possible at all. */
  function reachAt(t, speed) { return (Math.sin(speed * t) + 1) * 0.5; }

  /* The layer eases in over AttackSeconds on activation, so the room genuinely lags the
     model for the first few seconds. Saying so beats K. concluding the map is wrong. */
  var ATTACK_SECONDS = 3.0;
  function attackAt(t) { return ATTACK_SECONDS <= 0 ? 1 : smoothStep(clamp(t / ATTACK_SECONDS, 0, 1)); }

  /* What is wrong with this lamp, in the order that matters. Position is worthless on a
     lamp that cannot receive colour, so membership outranks it. */
  function classify(l) {
    if (!l.selected) return { key: "off", label: "not driven", tone: "dim" };
    if (!l.streaming) return { key: "nostream", label: "not in entertainment area", tone: "bad" };
    if (!l.positioned) return { key: "nopos", label: "no position", tone: "warn" };
    return { key: "ok", label: "ready", tone: "good" };
  }

  /* Partial by design — one dropped lamp is a one-entry body. The server upserts, so an
     omitted lamp keeps whatever it had. Never send a full replace from a UI that only
     knows about the lamps it happens to be showing. */
  function buildPositionsBody(config, roomDimensions, entries) {
    var positions = {};
    entries.forEach(function (e) {
      positions[e.id] = [round4(e.x), round4(e.y), round4(e.z)];
    });
    return { config: config, roomDimensions: roomDimensions, positions: positions };
  }
  function round4(v) { return Math.round(v * 10000) / 10000; }

  /* The banner. Returns the single most important thing wrong with the room, or null.
     One line, because a wall of warnings is read as decoration. */
  function topWarning(status) {
    if (!status) return null;
    if (!status.connected)
      return { tone: "bad", text: "The Hue app is answering but not streaming — started with `dotnet run` and no bridge connection, or reconnect was never clicked. Nothing here will reach a lamp." };
    if (status.streaming < status.lights)
      return {
        tone: "bad",
        text: (status.lights - status.streaming) + " of " + status.lights +
              " lamps are not in the entertainment area. They receive no colour at all — " +
              "no position or palette can change that. Add them in the Hue app, then reconnect."
      };
    if (status.unpositioned > 0)
      return { tone: "warn", text: status.unpositioned + " lamps have no room position, so they sit out of the spatial flood and render as flat fill." };
    return null;
  }

  /* ── THE WIZARD ────────────────────────────────────────────────────────────
   * K., after the first version shipped: "it doesnt help me step by step to check if the
   * positioning and stuff is good. there is almost no testing grounds. its just a
   * verification step but how do i learn how to use it even?"
   *
   * Correct, and the diagnosis is that an INSPECTOR was built where a PROCEDURE was
   * asked for. He asked for "a speaker test for surround but with lights" — a speaker
   * test is a guided sequence with a verdict at each step, not a mixing desk. Everything
   * the old page displayed was true, which is exactly why the substitution survived two
   * sessions and a full test suite.
   *
   * So: forced order, one thing at a time, visible progress, and — the part that makes it
   * a test rather than a display — a step where K. can be WRONG and be told so.
   */
  var WIZARD_STEPS = [
    {
      key: "check", n: 1, title: "Can every lamp actually light?",
      teach: "Some lamps are not in the Hue entertainment area. Those receive nothing at " +
             "all — no colour, ever — and no amount of positioning changes that. This is " +
             "the only step you cannot fix from here."
    },
    {
      key: "meet", n: 2, title: "Which bulb is which?",
      teach: "Each lamp blinks on its own. Say whether you saw it. The bridge's names are " +
             "not always the room's names, and finding that out now is far cheaper than " +
             "discovering it after you have placed everything."
    },
    {
      key: "place", n: 3, title: "Put them on the map",
      teach: "One lamp at a time: it blinks, you tap where it really is. Rough is fine — " +
             "the flood uses direction and relative distance, never centimetres."
    },
    {
      key: "quiz", n: 4, title: "Test yourself",
      teach: "Now the room asks YOU. A lamp blinks and you tap the dot you think it is. " +
             "This is the only step that can prove the map is right — everything before it " +
             "just records what you believed."
    },
    {
      key: "sweep", n: 5, title: "Watch the sweep",
      teach: "The flood runs and the map animates the same maths. If a lamp brightens at " +
             "the wrong moment, its position is wrong — and now you know which one."
    },
    { key: "done", n: 6, title: "Done", teach: "" }
  ];

  function stepByKey(k) {
    for (var i = 0; i < WIZARD_STEPS.length; i++) if (WIZARD_STEPS[i].key === k) return WIZARD_STEPS[i];
    return WIZARD_STEPS[0];
  }

  /* The lamps the wizard actually walks through: ones we drive AND that can receive
     light. Walking K. through placing a lamp that can never light would be a worse tool,
     not a better one — so unreachable lamps are excluded from every later step and are
     the entire subject of step 1. */
  function wizardLamps(lights) {
    return lights.filter(function (l) { return l.selected && l.streaming; });
  }
  function unreachableLamps(lights) {
    return lights.filter(function (l) { return l.selected && !l.streaming; });
  }

  /* Per-step completion, so the wizard can show progress and refuse to skip ahead. */
  function stepState(key, ctx) {
    var lamps = wizardLamps(ctx.lights);
    var unreachable = unreachableLamps(ctx.lights);
    switch (key) {
      case "check":
        return {
          done: ctx.status && ctx.status.connected && unreachable.length === 0,
          blocked: !(ctx.status && ctx.status.connected),
          count: unreachable.length,
          detail: !ctx.status ? "waiting for the app"
            : !ctx.status.connected ? "the Hue app is not streaming"
            : unreachable.length ? unreachable.length + " lamps cannot receive colour"
            : "every lamp can receive colour"
        };
      case "meet": {
        var seen = lamps.filter(function (l) { return ctx.seen[l.id]; }).length;
        return { done: lamps.length > 0 && seen === lamps.length, seen: seen,
                 total: lamps.length, detail: seen + " of " + lamps.length + " identified" };
      }
      case "place": {
        var placed = lamps.filter(function (l) { return l.positioned; }).length;
        return { done: lamps.length > 0 && placed === lamps.length, placed: placed,
                 total: lamps.length, detail: placed + " of " + lamps.length + " placed" };
      }
      case "quiz": {
        var asked = ctx.quiz.asked, right = ctx.quiz.right;
        return { done: asked > 0 && asked >= Math.min(4, lamps.length) && right === asked,
                 asked: asked, right: right,
                 detail: asked ? right + " right out of " + asked : "not tried yet" };
      }
      case "sweep":
        return { done: !!ctx.sweepJudged, detail: ctx.sweepJudged || "not watched yet" };
      default:
        return { done: false, detail: "" };
    }
  }

  /* Which step the wizard should be on if nobody has clicked anything: the first one that
     is not finished. Forced order is the point — it is a procedure, not a menu. */
  function firstUnfinished(ctx) {
    for (var i = 0; i < WIZARD_STEPS.length - 1; i++) {
      var s = WIZARD_STEPS[i];
      if (!stepState(s.key, ctx).done) return s.key;
    }
    return "done";
  }

  /* The quiz picks the lamp K. is most likely to have wrong: the one he has been asked
     about least, tie-broken deterministically by id. No Math.random — a quiz that cannot
     be replayed cannot be tested, and a "random" that repeats the same lamp four times
     reads as broken. */
  function quizPick(lamps, askedCounts) {
    if (!lamps.length) return null;
    var best = null, bestN = Infinity;
    lamps.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (l) {
      var n = askedCounts[l.id] || 0;
      if (n < bestN) { bestN = n; best = l; }
    });
    return best;
  }

  function gradeGuess(actualId, guessId) { return actualId === guessId; }

  var CORE = {
    WIZARD_STEPS: WIZARD_STEPS, stepByKey: stepByKey,
    wizardLamps: wizardLamps, unreachableLamps: unreachableLamps,
    stepState: stepState, firstUnfinished: firstUnfinished,
    quizPick: quizPick, gradeGuess: gradeGuess,
    normFromCm: normFromCm, cmFromNorm: cmFromNorm, isAtOrigin: isAtOrigin,
    roomToCanvas: roomToCanvas, canvasToRoom: canvasToRoom, clamp: clamp,
    describeHeight: describeHeight, parseMaybeJson: parseMaybeJson,
    findOrigin: findOrigin, predictSweep: predictSweep, predictDetail: predictDetail,
    reachAt: reachAt, attackAt: attackAt, ATTACK_SECONDS: ATTACK_SECONDS,
    samplePalette: samplePalette, lerpHsv: lerpHsv, hexToRgb: hexToRgb,
    SWEEP_MODES: SWEEP_MODES, modeByKey: modeByKey,
    classify: classify, buildPositionsBody: buildPositionsBody, topWarning: topWarning
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = CORE; return; }

  /* ── browser ───────────────────────────────────────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    lights: [], status: null, room: [520, 430, 240], config: "", sel: null,
    // sweep test: t0 = when the tide was (re)started, so reach is knowable
    sweep: { t0: 0, speed: 0.18, spread: 0.35, running: false, mode: "zones" },
    // wizard
    step: null,                 // null = follow firstUnfinished()
    seen: {},                   // lamp id -> confirmed identified
    quiz: { asked: 0, right: 0, counts: {}, current: null, last: null },
    sweepJudged: null,
    cursor: 0,                  // which lamp within a step
    free: false                 // "let me poke at it" mode
  };

  function ctx() {
    return { lights: state.lights, status: state.status, seen: state.seen,
             quiz: state.quiz, sweepJudged: state.sweepJudged };
  }
  function curStep() { return state.step || firstUnfinished(ctx()); }

  function selected() {
    for (var i = 0; i < state.lights.length; i++)
      if (state.lights[i].id === state.sel) return state.lights[i];
    return null;
  }

  /* The height control must SHOW the selected lamp's height, not the last value anyone
     picked. It previously did not, which made a per-lamp setting read as a global one —
     K.: "doesnt really seem to be aplied. it seems to be a global setting?" It was, in
     effect: a write-only widget that also silently no-opped when nothing was selected. */
  function syncHeight() {
    var l = selected(), el = $("height"), lab = $("heightVal");
    if (!el) return;
    el.disabled = !l;
    el.value = l ? l.z : 0;
    lab.textContent = l ? (l.name + ": " + (+el.value).toFixed(2) + " — " + describeHeight(+el.value))
                        : "select a lamp first";
  }

  /* A 200 with an EMPTY body is normal here and must not be an error.
     `POST /api/effects/run` returns Results.Ok() with no payload, so calling r.json()
     on it throws "unexpected end of data" — which surfaced as "sweep failed" and left
     the map with nothing to draw. Two symptoms, one cause: never assume a body. */
  function api(path, opts) {
    return fetch(path, opts || {}).then(function (r) {
      if (!r.ok) throw new Error(path + " -> " + r.status);
      return r.text().then(function (t) { return parseMaybeJson(t); });
    });
  }

  function refresh() {
    return Promise.all([
      api("/api/lights").catch(function () { return null; }),
      api("/api/status").catch(function () { return null; })
    ]).then(function (res) {
      if (res[0]) {
        state.lights = res[0].lights || [];
        state.room = res[0].roomDimensions || state.room;
        state.config = res[0].config || res[0].activeConfig || "";
        state.source = res[0].positionSource;
      }
      state.status = res[1];
      render();
    });
  }

  function render() {
    renderWizard();
    renderBanner();
    renderStats();
    renderList();
    syncHeight();
    draw();
    $("free").style.display = state.free ? "block" : "none";
    $("freeToggle").textContent = state.free ? "hide the controls" : "let me poke at it myself";
  }

  /* ── wizard rendering ──────────────────────────────────────────────────── */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function bigButton(label, fn, kind) {
    var b = el("button", "big" + (kind ? " " + kind : ""), label);
    b.onclick = fn;
    return b;
  }

  function renderWizard() {
    var key = curStep(), step = stepByKey(key), c = ctx(), st = stepState(key, c);
    var lamps = wizardLamps(state.lights);

    // The rail: every step, its number, and whether it is done. Progress you can see is
    // half of what makes this a procedure rather than a page.
    var rail = $("rail"); rail.innerHTML = "";
    WIZARD_STEPS.forEach(function (s) {
      if (s.key === "done") return;
      var d = stepState(s.key, c);
      var dot = el("span", "railstep" + (s.key === key ? " on" : "") + (d.done ? " ok" : ""),
                   d.done ? "✓" : String(s.n));
      dot.title = s.title;
      dot.onclick = function () { state.step = s.key; state.cursor = 0; render(); };
      rail.appendChild(dot);
    });

    $("stepTitle").textContent = step.n + ". " + step.title;
    $("stepTeach").textContent = step.teach;
    $("stepDetail").textContent = st.detail || "";

    var box = $("stepBody"); box.innerHTML = "";
    ({ check: wizCheck, meet: wizMeet, place: wizPlace,
       quiz: wizQuiz, sweep: wizSweep, done: wizDone })[key](box, lamps, st);
  }

  function advance(next) {
    state.step = next; state.cursor = 0; render();
  }

  /* Step 1 — the only thing that cannot be fixed from this page. */
  function wizCheck(box, lamps, st) {
    var bad = unreachableLamps(state.lights);
    if (!state.status || !state.status.connected) {
      box.appendChild(el("p", "warnline",
        "The Hue app is not streaming. Start it the normal way and click reconnect — " +
        "started with `dotnet run` it answers every call and drives nothing."));
      box.appendChild(bigButton("check again", refresh));
      return;
    }
    if (bad.length) {
      box.appendChild(el("p", "warnline",
        bad.length + " lamps cannot receive colour at all, because they are not in the Hue " +
        "entertainment area:"));
      var ul = el("ul", "plain");
      bad.forEach(function (l) { ul.appendChild(el("li", null, l.name)); });
      box.appendChild(ul);
      box.appendChild(el("p", "small",
        "Fix in the Hue phone app → Entertainment areas → add them, then reconnect here. " +
        "Plugs and white-ambiance lamps cannot be added at all — untick those below instead, " +
        "so this stops asking."));
      box.appendChild(bigButton("I've changed it — check again", refresh));
      box.appendChild(bigButton("skip these lamps and carry on", function () {
        // Unticking is the honest way to proceed: it records "we do not drive this",
        // rather than silently walking K. past a lamp that can never light.
        bad.forEach(function (l) { l.selected = false; });
        saveSelection(); advance("meet");
      }, "ghost"));
      return;
    }
    box.appendChild(el("p", "goodline", "Every lamp we drive can receive colour. " + lamps.length + " to set up."));
    box.appendChild(bigButton("start →", function () { advance("meet"); }));
  }

  /* Step 2 — names to bulbs. */
  function wizMeet(box, lamps) {
    var todo = lamps.filter(function (l) { return !state.seen[l.id]; });
    if (!todo.length) {
      box.appendChild(el("p", "goodline", "All identified."));
      box.appendChild(bigButton("next → put them on the map", function () { advance("place"); }));
      return;
    }
    var l = todo[Math.min(state.cursor, todo.length - 1)];
    box.appendChild(el("p", "lampname", l.name));
    box.appendChild(el("p", "small", "Blinking now. Which bulb is it?"));
    box.appendChild(bigButton("blink it again", function () { identify(l); }, "ghost"));
    box.appendChild(bigButton("got it ✓", function () {
      state.seen[l.id] = true; state.cursor = 0; render();
    }));
    box.appendChild(bigButton("I saw nothing", function () {
      state.seen[l.id] = "unseen"; state.cursor = 0;
      $("say").textContent = l.name + " marked as not seen — check it is powered and reachable";
      render();
    }, "ghost"));
    identifyOnce(l);
  }

  /* Step 3 — place them, one at a time, in a forced order. */
  function wizPlace(box, lamps) {
    var todo = lamps.filter(function (l) { return !l.positioned; });
    if (!todo.length) {
      box.appendChild(el("p", "goodline", "Every lamp is on the map."));
      box.appendChild(bigButton("next → test yourself", function () { advance("quiz"); }));
      return;
    }
    var l = todo[0];
    state.sel = l.id;
    box.appendChild(el("p", "lampname", l.name));
    box.appendChild(el("p", "small",
      "It is blinking. Tap the map where this lamp really is — " + todo.length + " to go."));
    box.appendChild(bigButton("blink it again", function () { identify(l); }, "ghost"));
    identifyOnce(l);
  }

  /* Step 4 — THE testing ground: the only step where K. can be wrong and be told so. */
  function wizQuiz(box, lamps) {
    var placed = lamps.filter(function (l) { return l.positioned; });
    if (placed.length < 2) {
      box.appendChild(el("p", "warnline", "Place at least two lamps first."));
      box.appendChild(bigButton("back to placing", function () { advance("place"); }, "ghost"));
      return;
    }
    if (state.quiz.last) {
      var r = state.quiz.last;
      box.appendChild(el("p", r.correct ? "goodline" : "warnline",
        r.correct ? "Right — that was " + r.actualName + "."
                  : "Not quite. That was " + r.actualName + ", you tapped " + r.guessName + "."));
      if (!r.correct)
        box.appendChild(el("p", "small",
          "Two possibilities, and they need different fixes: the dots are swapped on the " +
          "map, or the name does not mean what you think. Blink them both and find out."));
    }
    box.appendChild(el("p", "small",
      "Score: " + state.quiz.right + " / " + state.quiz.asked));
    if (!state.quiz.current) {
      box.appendChild(bigButton(state.quiz.asked ? "another one" : "blink one — I'll guess", function () {
        var pick = quizPick(placed, state.quiz.counts);
        state.quiz.current = pick.id; state.quiz.last = null;
        state.quiz.counts[pick.id] = (state.quiz.counts[pick.id] || 0) + 1;
        identify(pick);
        $("say").textContent = "tap the dot you think just blinked";
        render();
      }));
    } else {
      box.appendChild(el("p", "lampname", "…which one was it?"));
      box.appendChild(el("p", "small", "Tap its dot on the map."));
    }
    if (state.quiz.asked >= 2)
      box.appendChild(bigButton("next → watch the sweep", function () { advance("sweep"); }, "ghost"));
  }

  /* Step 5 — the whole-room check. */
  function wizSweep(box) {
    box.appendChild(el("p", "small",
      "Zones colours each lamp by how far it is from the screen. Run it and watch the room " +
      "against the map: same order means the positions are right."));
    box.appendChild(bigButton(state.sweep.running ? "restart the sweep" : "run the sweep", function () {
      state.sweep.mode = "zones"; startSweep().then(render);
    }));
    if (state.sweep.running) {
      box.appendChild(bigButton("they matched ✓", function () {
        state.sweepJudged = "matched"; stopSweep(); advance("done");
      }));
      box.appendChild(bigButton("something was off", function () {
        state.sweepJudged = "mismatch"; stopSweep();
        $("say").textContent = "note which lamp, then go back to step 3 and move it";
        state.step = "place"; state.cursor = 0; render();
      }, "ghost"));
    }
  }

  function wizDone(box, lamps) {
    box.appendChild(el("p", "goodline", "Set up. " + lamps.length + " lamps placed and checked."));
    box.appendChild(el("p", "small",
      "The layout is saved and in version control. If you move furniture, come back to " +
      "step 3. If a lamp stops responding, step 1."));
    box.appendChild(bigButton("run it again", function () {
      state.seen = {}; state.quiz = { asked: 0, right: 0, counts: {}, current: null, last: null };
      state.sweepJudged = null; advance("check");
    }, "ghost"));
  }

  /* ── the sweep test ────────────────────────────────────────────────────────
   * Start a fresh Superfluid with a known speed and a single colour, note the moment it
   * started, and animate the map from the same maths the layer runs. Single colour on
   * purpose: with a palette the hue travels and BRIGHTNESS barely moves (brightBand
   * compresses it toward the midpoint), so the sweep would be nearly invisible — the
   * opposite of what a sweep test needs. brightBand 1.0 for the same reason.
   */
  function startSweep() {
    var s = state.sweep, m = modeByKey(s.mode);
    var body = {
      AmbientType: "Superfluid",
      AmbientParams: {
        color: "00BFFF", palette: m.palette.join(","),
        speed: String(s.speed), spread: String(s.spread),
        flowIntensity: "1.0", colorSpan: String(m.colorSpan),
        colorDrift: String(m.colorDrift), brightBand: String(m.brightBand)
      }
    };
    return api("/api/effects/run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function () {
      s.t0 = Date.now(); s.running = true;
      $("say").textContent = "sweep running — compare the map against the room";
    }).catch(function (e) { $("say").textContent = "sweep failed: " + e.message; });
  }

  function stopSweep() {
    state.sweep.running = false;
    $("say").textContent = "sweep stopped — the room keeps the last state";
  }

  function sweepNow() {
    var s = state.sweep;
    if (!s.running) return null;
    var t = (Date.now() - s.t0) / 1000;
    return { t: t, reach: reachAt(t, s.speed), attack: attackAt(t) };
  }

  function renderBanner() {
    var w = topWarning(state.status), el = $("banner");
    if (!w) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.className = "banner " + w.tone;
    el.textContent = w.text;
  }

  function renderStats() {
    var s = state.status;
    $("conn").className = s && s.connected ? "on" : "off";
    $("conn").textContent = s ? (s.connected ? "streaming " + s.streaming + "/" + s.lights : "not connected") : "…";
    $("stats").textContent = s
      ? "positions from: " + (state.source || "?") + (state.config ? " (" + state.config + ")" : " (no config)") +
        " · room " + state.room.join("×") + " cm"
      : "";
  }

  function renderList() {
    var box = $("list");
    box.innerHTML = "";
    state.lights.forEach(function (l) {
      var c = classify(l);
      var row = document.createElement("div");
      row.className = "lamp" + (state.sel === l.id ? " sel" : "");

      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!l.selected; cb.title = "drive this lamp at all";
      cb.onchange = function () { l.selected = cb.checked; saveSelection(); };

      var nm = document.createElement("div");
      nm.className = "nm";
      // The numbers, not just a dot. A coordinate you can read is how you notice that
      // two lamps you know are metres apart are sitting on top of each other.
      var where = l.positioned
        ? "x " + l.x.toFixed(2) + "  y " + l.y.toFixed(2) + "  z " + l.z.toFixed(2)
        : "unplaced";
      nm.innerHTML = "<b>" + esc(l.name) + "</b>" +
        "<span class='tag " + c.tone + "'>" + c.label + "</span>" +
        "<span class='tag dim'>" + where + "</span>";
      nm.onclick = function () { state.sel = l.id; render(); };

      var flash = document.createElement("button");
      flash.textContent = "flash";
      flash.disabled = !(state.status && state.status.connected);
      flash.onclick = function () { identify(l); };

      row.appendChild(cb); row.appendChild(nm); row.appendChild(flash);
      box.appendChild(row);
    });
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  /* The wizard calls this from inside render(), and render() runs on every 5s poll — so
     without a guard the current lamp would be re-blinked forever and the room would
     strobe. Only a CHANGE of subject re-fires; "blink it again" forces it. */
  function identifyOnce(l) {
    if (!l || state.lastIdentified === l.id) return;
    state.lastIdentified = l.id;
    identify(l);
  }

  function identify(l) {
    state.lastIdentified = l.id;
    $("say").textContent = "flashing " + l.name + " — which bulb is it?";
    // Fire and forget: the endpoint returns immediately and the layer runs on. A
    // blocking call would exceed serve.py's deliberate 2.5s proxy timeout.
    api("/api/lights/" + l.id + "/identify?seconds=8", { method: "POST" })
      .catch(function (e) { $("say").textContent = "identify failed: " + e.message; });
  }

  function saveSelection() {
    var ids = state.lights.filter(function (l) { return l.selected; }).map(function (l) { return l.id; });
    api("/api/lights/selection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lightIds: ids })
    }).then(function () {
      $("say").textContent = ids.length + " lamps driven (applies on next reconnect)";
    });
  }

  function savePosition(l) {
    var body = buildPositionsBody(state.config || "party-room", state.room,
      [{ id: l.id, x: l.x, y: l.y, z: l.z }]);
    api("/api/lights/positions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function () {
      l.positioned = !isAtOrigin(l.x, l.y, l.z);
      $("say").textContent = "saved " + l.name;
      render();
    }).catch(function (e) { $("say").textContent = "SAVE FAILED: " + e.message; });
  }

  /* ── the floorplan ─────────────────────────────────────────────────────── */

  var PAD = 26;

  function draw() {
    var cv = $("plan"); if (!cv) return;
    var w = cv.width = cv.clientWidth, h = cv.height = Math.round(cv.clientWidth * 0.72);
    var g = cv.getContext("2d");
    g.clearRect(0, 0, w, h);

    g.strokeStyle = "rgba(150,170,220,0.28)"; g.lineWidth = 1;
    g.strokeRect(PAD, PAD, w - 2 * PAD, h - 2 * PAD);

    // The screen edge. The flood's origin is the lamp nearest the screen, so which way
    // this faces is not decoration — it is the direction everything radiates from.
    g.fillStyle = "rgba(90,170,220,0.5)";
    g.fillRect(PAD, PAD - 6, w - 2 * PAD, 4);
    g.fillStyle = "#8b9ac0"; g.font = "11px ui-monospace, monospace";
    g.fillText("SCREEN / TV", PAD, PAD - 11);

    var sw = sweepNow();
    var mode = modeByKey(state.sweep.mode);
    // Colour means POSITION, so it is painted whether or not a sweep is running — at
    // rest the map is a still spatial ruler. K.: "I dont see anything in the ui that
    // indicates color or position" — it only coloured while sweeping, which made the
    // one fact the map exists to show invisible most of the time.
    var pred = predictDetail(state.lights, sw ? sw.reach : 0.5, state.sweep.spread);

    // The origin — everything radiates from here, and it is CHOSEN BY NAME (or the
    // centroid of placed lamps). Drawing it matters because it moves as you place lamps:
    // a newly placed lamp can shift the centroid, and the whole flood re-aims.
    if (state.lights.some(function (l) { return l.positioned; })) {
      var o = findOrigin(state.lights);
      var op = roomToCanvas(o.x, o.y, w, h, PAD);
      g.beginPath(); g.arc(op.cx, op.cy, 5, 0, Math.PI * 2);
      g.strokeStyle = "#5ad"; g.lineWidth = 1.5; g.stroke();
      g.setLineDash([3, 4]);
      g.beginPath(); g.arc(op.cx, op.cy, 9, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#5ad"; g.font = "10px ui-monospace, monospace";
      g.fillText("origin", op.cx - 16, op.cy - 14);
    }

    state.lights.forEach(function (l) {
      if (!l.positioned) return;
      var p = roomToCanvas(l.x, l.y, w, h, PAD);
      var c = classify(l);
      var r = state.sel === l.id ? 11 : 8;

      // During a sweep the dot's SIZE and GLOW are the predicted intensity, so the map
      // animates exactly as the room is meant to. Side by side, a lamp that lights at
      // the wrong moment is obvious; from the room alone it is not.
      var d = pred[l.id];
      var swept = (d && sw) ? d.intensity * sw.attack : 0;
      // The dot wears the colour the LAMP should be wearing, from the same palette maths
      // the layer runs. That makes the check independent of timing: with Zones running,
      // a lamp whose hue disagrees with its dot is mis-placed even while nothing moves.
      var col = (d && mode.palette.length) ? samplePalette(mode.palette, d.colorT) : null;

      if (sw && d) {
        g.beginPath(); g.arc(p.cx, p.cy, r + 4 + swept * 16, 0, Math.PI * 2);
        g.fillStyle = col
          ? "rgba(" + col.r + "," + col.g + "," + col.b + "," + (0.10 + 0.5 * swept).toFixed(3) + ")"
          : "rgba(90,170,220," + (0.10 + 0.45 * swept).toFixed(3) + ")";
        g.fill();
      }

      g.beginPath(); g.arc(p.cx, p.cy, r, 0, Math.PI * 2);
      g.fillStyle = col ? "rgb(" + col.r + "," + col.g + "," + col.b + ")"
                  : c.tone === "bad" ? "rgba(224,138,138,0.85)"
                  : c.tone === "warn" ? "rgba(255,216,144,0.85)"
                  : c.tone === "dim" ? "rgba(139,154,192,0.4)" : "rgba(127,224,160,0.85)";
      g.fill();
      // Keep the health badge readable even while the dot is showing palette colour —
      // a mis-placed lamp and an unreachable lamp must never look the same.
      if (col && c.tone !== "good") {
        g.strokeStyle = c.tone === "bad" ? "#e08a8a" : c.tone === "warn" ? "#ffd890" : "#8b9ac0";
        g.lineWidth = 3; g.stroke();
      }
      if (state.sel === l.id) { g.strokeStyle = "#5ad"; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = "#dce6fb"; g.font = "11px ui-sans-serif, system-ui";
      var label = l.name + (sw && d ? "  " + Math.round(swept * 100) + "%" : "");
      g.fillText(label, p.cx + 13, p.cy + 4);
    });

    // The ruler itself. Without a legend, "this dot is amber" means nothing — with it,
    // amber is a distance, and a lamp's colour can be checked against where it sits.
    if (mode.palette.length) {
      var lx = PAD, ly = h - 40, lw = Math.min(180, w - 2 * PAD);
      for (var i = 0; i <= lw; i++) {
        var cc = samplePalette(mode.palette, (i / lw) * mode.colorSpan);
        g.fillStyle = "rgb(" + cc.r + "," + cc.g + "," + cc.b + ")";
        g.fillRect(lx + i, ly, 1, 7);
      }
      g.fillStyle = "#8b9ac0"; g.font = "10px ui-monospace, monospace";
      g.fillText("near", lx, ly - 4);
      g.fillText("far", lx + lw - 16, ly - 4);
    }

    // The tray: lamps with no position yet, waiting to be dragged in. They are shown
    // OUTSIDE the room rather than stacked at its centre, because a pile of dots at the
    // origin is exactly the picture that made five missing lamps invisible for a month.
    var tray = state.lights.filter(function (l) { return !l.positioned; });
    if (tray.length) {
      g.fillStyle = "#8b9ac0"; g.font = "11px ui-monospace, monospace";
      g.fillText("not placed — drag in:", PAD, h - 6);
      tray.forEach(function (l, i) {
        var cx = PAD + 130 + i * 26, cy = h - 10;
        g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2);
        g.strokeStyle = state.sel === l.id ? "#5ad" : "rgba(150,170,220,0.6)";
        g.lineWidth = state.sel === l.id ? 2 : 1; g.stroke();
        l._tray = { cx: cx, cy: cy };
      });
    }
  }

  function hit(mx, my, w, h) {
    var best = null, bestD = 18 * 18;
    state.lights.forEach(function (l) {
      var p = l.positioned ? roomToCanvas(l.x, l.y, w, h, PAD) : (l._tray ? { cx: l._tray.cx, cy: l._tray.cy } : null);
      if (!p) return;
      var d = (p.cx - mx) * (p.cx - mx) + (p.cy - my) * (p.cy - my);
      if (d < bestD) { bestD = d; best = l; }
    });
    return best;
  }

  function wirePlan() {
    var cv = $("plan"); if (!cv) return;
    var dragging = null;
    function pos(ev) {
      var r = cv.getBoundingClientRect();
      var t = ev.touches ? ev.touches[0] : ev;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    cv.addEventListener("pointerdown", function (ev) {
      var p = pos(ev), step = curStep();

      // QUIZ: a tap is an ANSWER, not a selection. This is the one place the tool can
      // tell K. he is wrong, which is what makes it a test rather than a display.
      if (step === "quiz" && state.quiz.current) {
        var guess = hit(p.x, p.y, cv.width, cv.height);
        if (!guess) return;
        var actual = state.lights.filter(function (x) { return x.id === state.quiz.current; })[0];
        var correct = gradeGuess(state.quiz.current, guess.id);
        state.quiz.asked++; if (correct) state.quiz.right++;
        state.quiz.last = { correct: correct, actualName: actual ? actual.name : "?", guessName: guess.name };
        state.quiz.current = null;
        render();
        return;
      }

      // PLACE: tapping empty space drops the current lamp there. Without this the step
      // would require finding a dot that does not exist yet — the tray was fine for a
      // free-form page and is friction inside a forced sequence.
      if (step === "place") {
        var todo = wizardLamps(state.lights).filter(function (x) { return !x.positioned; });
        if (todo.length) {
          var target = todo[0];
          var r0 = canvasToRoom(p.x, p.y, cv.width, cv.height, PAD);
          target.x = r0.x; target.y = r0.y; target.z = target.z || 0;
          target.positioned = true;
          state.sel = target.id;
          savePosition(target);
          state.lastIdentified = null;   // next lamp should blink
          render();
          return;
        }
      }

      var l = hit(p.x, p.y, cv.width, cv.height);
      if (!l) return;
      state.sel = l.id; dragging = l; cv.setPointerCapture(ev.pointerId);
      identify(l);              // grabbing a lamp flashes it — you always know what you are moving
      render();
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var p = pos(ev), r = canvasToRoom(p.x, p.y, cv.width, cv.height, PAD);
      dragging.x = r.x; dragging.y = r.y;
      if (!dragging.positioned) { dragging.z = HEIGHTS[$("height").value] || 0; dragging.positioned = true; }
      draw();
    });
    cv.addEventListener("pointerup", function () {
      if (!dragging) return;
      savePosition(dragging);   // save on drop, so there is no button to forget
      dragging = null;
    });
  }

  function boot() {
    wirePlan();

    // input = drag (local only, redraw), change = release (one save). Saving on every
    // input event would fire a write per pixel of slider travel.
    $("height").addEventListener("input", function () {
      var l = selected(); if (!l) return;
      l.z = +$("height").value;
      syncHeight(); draw();
    });
    $("height").addEventListener("change", function () {
      var l = selected(); if (!l) return;
      savePosition(l);
    });

    renderModes();
    $("sweepRun").onclick = function () { startSweep().then(render); };
    $("sweepStop").onclick = function () { stopSweep(); render(); };
    $("sweepSpeed").addEventListener("input", function () {
      state.sweep.speed = +$("sweepSpeed").value;
      $("sweepSpeedVal").textContent = state.sweep.speed.toFixed(2) +
        "  (" + (2 * Math.PI / state.sweep.speed).toFixed(0) + "s per breath)";
    });
    $("sweepSpread").addEventListener("input", function () {
      state.sweep.spread = +$("sweepSpread").value;
      $("sweepSpreadVal").textContent = state.sweep.spread.toFixed(2) +
        (state.sweep.spread < 0.2 ? "  (tight band — easiest to follow)" : "");
    });

    $("refresh").onclick = refresh;
    $("freeToggle").onclick = function () { state.free = !state.free; render(); };
    refresh();
    setInterval(refresh, 5000);   // slow: the lamp list is not a live instrument

    // The map, however, IS live while a sweep runs — it has to be, or there is nothing
    // to compare the room against.
    (function tick() {
      if (state.sweep.running) { draw(); renderSweepReadout(); }
      requestAnimationFrame(tick);
    })();

    window.addEventListener("resize", draw);
  }

  function renderModes() {
    var box = $("modes"); if (!box) return;
    box.innerHTML = "";
    SWEEP_MODES.forEach(function (m) {
      var b = document.createElement("button");
      b.textContent = m.name;
      if (m.key === state.sweep.mode) b.style.borderColor = "var(--accent)";
      // A swatch of the mode's own palette, so the choice is visible rather than named.
      if (m.palette.length) {
        var sw = document.createElement("span");
        sw.style.cssText = "display:inline-block;width:34px;height:8px;margin-left:8px;border-radius:3px;" +
          "background:linear-gradient(90deg," + m.palette.map(function (h) { return "#" + h; }).join(",") + ")";
        b.appendChild(sw);
      }
      b.onclick = function () {
        state.sweep.mode = m.key;
        $("modeHint").textContent = m.hint;
        renderModes();
        // Changing mode mid-run restarts the tide: palette and brightBand are set at
        // /effects/run, and a fresh run is also what makes t0 (and therefore reach)
        // knowable again. Without the restart the map and the room would disagree.
        if (state.sweep.running) startSweep();
      };
      box.appendChild(b);
    });
    $("modeHint").textContent = modeByKey(state.sweep.mode).hint;
  }

  function renderSweepReadout() {
    var sw = sweepNow(); if (!sw) return;
    $("sweepState").textContent =
      "t+" + sw.t.toFixed(1) + "s · reach " + sw.reach.toFixed(2) +
      (sw.attack < 0.999 ? "  · easing in (" + Math.round(sw.attack * 100) + "%)" : "");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
