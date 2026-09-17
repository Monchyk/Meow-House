/* roomgames/fractaldive.js — FRACTAL DIVE.
 *
 * Not a puzzle — an exploration. The screen shows a living fractal; the phone says GO DEEPER.
 * A player taps WHERE on the fractal to fall, the camera travels into that point, new structure
 * resolves, and the depth counter climbs. There's no correct location — "this looks interesting,
 * let's look there." The output is depthReached, which (later) feeds the installation's global
 * zoom. It maintains a real mathematical viewport (a Mandelbrot set), so the player genuinely
 * keeps diving into the same object; they never learn it's a Mandelbrot — the maths is hidden.
 *
 * One big screen → ONE shared descent (per-player independent dives can't all display): solo you
 * drive alone; with others it's a no-coordination collaborative fall. Needs the phone's `pad`
 * control (a tap surface → {x,y}); the aim/dive maths is pure (node-tested), the pixels are
 * browser-only (progressive render + a zoom-into-the-point transition). P0/P1 scope: finite
 * double-precision depth, depth→contribution; interest-scoring (P3) and the live engine (P4) later.
 */
(function (root) {
  "use strict";
  var RoomGame = root.RoomGame || (typeof require !== "undefined" && require("./registry.js"));

  var ZOOM = 4.5;               // magnification per dive (depth d ≈ 4.5^d ×)
  var DIVE_MS = 950;            // travel time — you must FEEL the fall
  var MIN_SCALE = 5e-13;        // double-precision floor; past it we stop tightening (graceful)
  var START = { cx: -0.6, cy: 0, scale: 1.35 };   // the whole world, deterministic
  var IDLE_MS = 60000;          // auto-finish a stalled dive so the slideshow can move on

  /* ── pure viewport maths (node-testable) ──────────────────────────────── */
  function screenToFractal(view, nx, ny, aspect) {
    return {
      re: view.cx + (nx - 0.5) * 2 * view.scale * aspect,
      im: view.cy + (ny - 0.5) * 2 * view.scale
    };
  }
  function diveTarget(view, aim, aspect, zoom) {
    var f = screenToFractal(view, aim.x, aim.y, aspect);
    var ns = view.scale / (zoom || ZOOM);
    return { cx: f.re, cy: f.im, scale: ns < MIN_SCALE ? MIN_SCALE : ns };
  }
  function contribution(depth) { return Math.round(depth * 1.2); }

  function finish(H) {
    H.g.depthReached = H.g.depth;
    H.g.contribution = contribution(H.g.depth);
    H.players().forEach(function (p) { H.score(p.id, H.g.contribution); });   // a shared achievement
    H.setPhase("result");
    H.say("you fell to depth " + H.g.depth + "  ·  zoom +" + H.g.contribution);
    H.players().forEach(function (p) { H.wait(p.id, "look up 👆  depth " + H.g.depth); });
  }

  RoomGame.register({
    id: "fractaldive",
    title: "Fractal Dive",
    blurb: "Tap where it looks interesting. Fall in. Go deeper.",
    minPlayers: 1,
    rounds: 1,

    start: function (H) {
      H.g.view = { cx: START.cx, cy: START.cy, scale: START.scale };
      H.g.depth = 0;
      H.g.aim = { x: 0.5, y: 0.5 };
      H.g.aspect = H.g.aspect || 16 / 9;
      H.g.diveAt = 0;
      H.g.renderKey = 0;          // bumps on every dive so the renderer picks up the new view
      H.g.lastAct = H.now();
      H.setPhase("dive");
      H.say("tap where it looks interesting — then GO DEEPER");
      H.declareAll([
        { intent: "pad", id: "aim", label: "tap where to dive" },
        { intent: "commit", id: "deeper", label: "GO DEEPER ↓" },
        { intent: "commit", id: "done", label: "DONE" }
      ], "tap the world, then GO DEEPER");
    },

    onIntent: function (H, pid, id, value) {
      if (H.phase !== "dive") return;
      if (id === "aim" && value && typeof value.x === "number") {
        H.g.aim = { x: Math.max(0, Math.min(1, value.x)), y: Math.max(0, Math.min(1, value.y)) };
        H.g.lastAct = H.now();
      } else if (id === "deeper") {
        if (H.now() - (H.g.diveAt || 0) < DIVE_MS) return;   // still falling — ignore a mash
        H.g.from = H.g.view;
        H.g.view = diveTarget(H.g.view, H.g.aim, H.g.aspect, ZOOM);
        H.g.depth += 1;
        H.g.diveAt = H.now(); H.g.lastAct = H.now();
        H.g.renderKey += 1;      // the browser reads this to start rendering the new view + animate
      } else if (id === "done") {
        finish(H);
      }
    },

    advance: function (H) {
      if (H.phase === "dive") finish(H);        // host force-ends
      else if (H.phase === "result") H.finish();
    },

    // ── rendering: browser-only (a real Mandelbrot, progressive, with a zoom-into-the-tap fall) ──
    render: function (H, X, S) {
      if (typeof document === "undefined") return;
      var U = root.RoomUI, g = H.g;
      var R = getRenderer(S.w | 0, S.h | 0);
      g.aspect = S.w / S.h;

      // idle auto-finish (browser owns the clock/timer)
      if (H.phase === "dive" && g.depth > 0 && (H.now() - (g.lastAct || 0)) > IDLE_MS) { finish(H); return; }

      if (H.phase === "result") {
        R.drawInto(X, S);   // keep the last frame under the card
        var a = U.easeOut(H.phaseAge() / 700);
        X.fillStyle = "rgba(4,5,11," + (0.55 * a) + ")"; X.fillRect(S.x, S.y, S.w, S.h);
        U.text(X, "🌀 DEPTH " + g.depth, S.cx, S.cy - 30, 60 * a + 8, U.gold, "center", 800);
        U.text(X, "zoom +" + (g.contribution || 0) + " to the house", S.cx, S.cy + 40, 24, U.teal, "center", 600);
        U.text(X, "SPACE to surface →", S.cx, S.y + S.h - 16, 15, U.dim);
        return;
      }

      // sync the renderer to the current viewport; a bumped key = a new dive to animate
      R.sync(g, X, S);
      R.step();                 // progress the progressive render a few bands
      R.draw(X, S, H, g);       // draw the world / the fall / the reticle

      // HUD
      U.text(X, "DEPTH " + g.depth, S.x + 8, S.y + 22, 22, U.gold, "left", 800);
      U.text(X, "≈ " + zoomLabel(g.view.scale) + " ×", S.x + 8, S.y + 46, 15, U.dim, "left", 600);
      if (g.depth === 0) U.text(X, "on your phone: tap the world, then GO DEEPER", S.cx, S.y + S.h - 16, 16, U.dim);
    }
  });

  function zoomLabel(scale) {
    var z = START.scale / scale;
    if (z < 1000) return Math.round(z).toLocaleString();
    var e = Math.floor(Math.log10(z));
    return (z / Math.pow(10, e)).toFixed(1) + "e" + e;
  }

  /* ── the Mandelbrot renderer (browser singleton, lazily built) ─────────── */
  var _R = null;
  function getRenderer(w, h) {
    if (_R && _R.W === w && _R.H === h) return _R;
    var RW = 560, RH = Math.max(120, Math.round(RW * h / Math.max(1, w)));
    var lut = buildLUT();
    function mkc() { var c = document.createElement("canvas"); c.width = RW; c.height = RH; return c; }
    _R = {
      W: w, H: h, RW: RW, RH: RH, lut: lut,
      committed: null, from: null, job: null, key: -1, anim: null,
      sync: syncR, step: stepR, draw: drawR, drawInto: drawIntoR
    };
    return _R;
  }

  function syncR(g, X, S) {
    var R = _R;
    if (R.key === g.renderKey && R.job) return;      // a job for this view already exists (rendering or done) — don't restart it
    // a new view (dive or first frame). Snapshot the current committed frame to fall away from.
    if (R.committed && g.renderKey > 0) {
      R.from = R.committed.canvas;
      R.anim = { aim: { x: g.aim.x, y: g.aim.y }, start: performance.now(), newReady: false, fadeStart: 0 };
    }
    R.job = newJob(R, g.view);
    R.key = g.renderKey;
  }

  function newJob(R, view) {
    var c = document.createElement("canvas"); c.width = R.RW; c.height = R.RH;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(R.RW, R.RH);
    var depthGuess = Math.max(0, Math.round(Math.log(START.scale / view.scale) / Math.log(ZOOM)));
    var iters = Math.min(900, 110 + depthGuess * 40);
    return { canvas: c, ctx: ctx, img: img, view: view, y: 0, iters: iters, done: false };
  }

  function stepR() {
    var R = _R, job = R.job; if (!job || job.done) return;
    var RW = R.RW, RH = R.RH, data = job.img.data, lut = R.lut, L = lut.length / 3;
    var v = job.view, iters = job.iters, aspect = RW / RH;
    var rows = 28;   // bands per frame — resolves a view in ~10 frames (~0.2s) at 60fps
    for (var r = 0; r < rows && job.y < RH; r++, job.y++) {
      var py = job.y, ny = (py + 0.5) / RH;
      var im0 = v.cy + (ny - 0.5) * 2 * v.scale;
      for (var px = 0; px < RW; px++) {
        var nx = (px + 0.5) / RW;
        var re0 = v.cx + (nx - 0.5) * 2 * v.scale * aspect;
        var zx = 0, zy = 0, i = 0, zx2 = 0, zy2 = 0;
        while (zx2 + zy2 <= 4 && i < iters) { zy = 2 * zx * zy + im0; zx = zx2 - zy2 + re0; zx2 = zx * zx; zy2 = zy * zy; i++; }
        var o = (py * RW + px) * 4, ci;
        if (i >= iters) { data[o] = 6; data[o + 1] = 7; data[o + 2] = 16; }   // the set body — dark
        else {
          var mu = i + 1 - Math.log(Math.log(Math.sqrt(zx2 + zy2))) / Math.log(2);
          var tt = (Math.sqrt(mu) * 0.14) % 1; if (tt < 0) tt += 1;   // cyclic → vivid rings across the exterior
          ci = ((tt * L) | 0) * 3;
          data[o] = lut[ci]; data[o + 1] = lut[ci + 1]; data[o + 2] = lut[ci + 2];
        }
        data[o + 3] = 255;
      }
    }
    job.ctx.putImageData(job.img, 0, 0);
    if (job.y >= RH) {
      job.done = true;
      if (R.anim) R.anim.newReady = true;
      else R.committed = { canvas: job.canvas, view: job.view };   // first render, no fall
    }
  }

  function drawR(X, S, H, g) {
    var R = _R;
    if (R.anim) {
      var t = R.anim.start ? (performance.now() - R.anim.start) / DIVE_MS : 1;
      if (t < 1) { drawFall(X, S, R.from, R.anim.aim, t); return; }
      // travel done — reveal the new frame when it's ready, with a short crossfade
      if (R.job && R.job.done) {
        if (!R.anim.fadeStart) R.anim.fadeStart = performance.now();
        var f = Math.min(1, (performance.now() - R.anim.fadeStart) / 260);
        drawFall(X, S, R.from, R.anim.aim, 1);
        X.globalAlpha = f; drawScaled(X, R.job.canvas, S); X.globalAlpha = 1;
        if (f >= 1) { R.committed = { canvas: R.job.canvas, view: R.job.view }; R.anim = null; }
      } else {
        drawFall(X, S, R.from, R.anim.aim, 1);   // hold the zoomed frame until detail resolves
      }
      return;
    }
    if (R.committed) drawScaled(X, R.committed.canvas, S);
    else if (R.job) drawScaled(X, R.job.canvas, S);
    // reticle where the next dive lands
    if (H.phase === "dive") {
      var rx = S.x + g.aim.x * S.w, ry = S.y + g.aim.y * S.h;
      var pr = 20 + Math.sin(performance.now() / 320) * 5;
      X.strokeStyle = "rgba(242,201,76,0.9)"; X.lineWidth = 2;
      X.beginPath(); X.arc(rx, ry, pr, 0, 6.283); X.stroke();
      X.beginPath(); X.moveTo(rx - 8, ry); X.lineTo(rx + 8, ry); X.moveTo(rx, ry - 8); X.lineTo(rx, ry + 8); X.stroke();
    }
  }

  function drawIntoR(X, S) { var R = _R; if (R && R.committed) drawScaled(X, R.committed.canvas, S); }

  function drawScaled(X, canvas, S) { X.imageSmoothingEnabled = true; X.drawImage(canvas, S.x, S.y, S.w, S.h); }

  // the fall: draw the old frame zooming into the aim point (see file header maths)
  function drawFall(X, S, canvas, aim, t) {
    if (!canvas) return;
    var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOut
    var f = Math.pow(ZOOM, e);
    var ax = S.x + aim.x * S.w, ay = S.y + aim.y * S.h;
    var posx = ax + (S.x + S.w / 2 - ax) * e, posy = ay + (S.y + S.h / 2 - ay) * e;
    var dw = S.w * f, dh = S.h * f;
    var dx = posx - f * (aim.x * S.w), dy = posy - f * (aim.y * S.h);
    X.save(); X.beginPath(); X.rect(S.x, S.y, S.w, S.h); X.clip();
    X.imageSmoothingEnabled = true; X.drawImage(canvas, dx, dy, dw, dh);
    X.restore();
  }

  function buildLUT() {
    // fully vivid + cyclic (no dark stop): even the fast-escaping exterior gets real colour
    var stops = [[47, 107, 255], [53, 208, 192], [242, 201, 76], [255, 111, 145], [138, 108, 255], [47, 107, 255]];
    var N = 64, out = new Uint8ClampedArray(N * (stops.length - 1) * 3), k = 0;
    for (var s = 0; s < stops.length - 1; s++) {
      var a = stops[s], b = stops[s + 1];
      for (var j = 0; j < N; j++) {
        var u = j / N;
        out[k++] = a[0] + (b[0] - a[0]) * u;
        out[k++] = a[1] + (b[1] - a[1]) * u;
        out[k++] = a[2] + (b[2] - a[2]) * u;
      }
    }
    return out;
  }

  // expose the pure bits for the headless test
  RoomGame.get("fractaldive")._pure = { screenToFractal: screenToFractal, diveTarget: diveTarget, contribution: contribution, ZOOM: ZOOM };
})(typeof window !== "undefined" ? window : globalThis);
