/* game-dissolve.js — the solve transition: the puzzle is SUCKED INTO the spiral.
 *
 * On solve the shell snapshots the live puzzle ONCE into an offscreen canvas, samples its
 * lit pixels into a point cloud, and then animates that cloud instead of the game's own
 * draw(): the points spiral inward toward the canvas centre, the whole field zooms out,
 * and each point DISINTEGRATES AS IT NEARS THE CENTRE — jitter rises, alpha and size decay,
 * so the puzzle is faint at the rim and gone by the middle. The reward spiral draws on top
 * and blooms out of the collapse.
 *
 * The disintegration is SPATIAL, not a timed fade: it is keyed to a point's distance to the
 * centre, so a point that is already near the middle breaks up immediately while an outlying
 * one stays coherent until it arrives. That is the whole difference from a crossfade.
 *
 * BROWSER-ONLY internals. The snapshot needs a real canvas (document + getImageData), so
 * snapshot() returns null under node and every consumer must treat null as "no effect" —
 * the headless suite drives shellSolve() and must not care. The SAMPLER is pure and is
 * exported separately (buildCloud) so it can be tested against a mock ImageData.
 *
 * Determinism (house law): no bare Math.random. Per-point scatter comes from a hash of the
 * point's index, so the same cloud always breaks apart the same way.
 *
 * Dual export as `root.GameDissolve`.
 */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  /* ── tunables ──────────────────────────────────────────────────────────────
   * All of these are shape-of-the-gesture knobs, safe to live-tune.            */
  var BUF_MAX = 220;        // offscreen snapshot's long edge (px). Small = fast getImageData.
  var MAX_POINTS = 1800;    // cloud size ceiling; the per-frame cost is one loop over this.
  var LUM_MIN = 90;         // r+g+b floor for "this pixel is part of the puzzle"
  var ALPHA_MIN = 24;       // and it must actually be painted, not transparent background
  var TURNS = 2.0;          // how far a point rotates on its way in (revolutions)
  var ZOOM_OUT = 0.26;      // the field also shrinks by this fraction as it collapses
  var BREAK_RADIUS = 0.42;  // proximity ramp starts here (× min(w,h)) — the spiral's rim
  var JITTER = 0.10;        // scatter at full break-up (× min(w,h))
  var DOT = 5.0;            // point size in px at full coherence (K. live-tune: 2.2 → 5.0, too small to see)

  // deterministic per-point noise in [-1,1] — replaces Math.random so a cloud always
  // disintegrates identically (and so this is testable at all).
  function hash1(i, salt) {
    var x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }

  /* ── the sampler (PURE — this is the headless-testable half) ─────────────── */

  // buildCloud(data, bw, bh, n) — data is an RGBA Uint8ClampedArray (an ImageData.data, or a
  // plain array in a test). Returns a cloud, or null if nothing was lit.
  //
  // Positions are stored in UNIT space relative to the buffer centre (−0.5..0.5 on each axis)
  // so the cloud replays correctly at any canvas size and aspect: the snapshot buffer keeps
  // the canvas's aspect ratio, so ux×w / uy×h maps a point straight back to where it was drawn.
  function buildCloud(data, bw, bh, n) {
    if (!data || !bw || !bh || data.length < bw * bh * 4) return null;
    n = n || MAX_POINTS;

    var xs = [], ys = [], cols = [];
    // stride so a big buffer doesn't collect far more candidates than we can use
    var step = Math.max(1, Math.floor(Math.sqrt((bw * bh) / (n * 3))));
    for (var y = 0; y < bh; y += step) {
      for (var x = 0; x < bw; x += step) {
        var o = (y * bw + x) * 4;
        if (data[o + 3] < ALPHA_MIN) continue;
        var r = data[o], g = data[o + 1], b = data[o + 2];
        if (r + g + b < LUM_MIN) continue;
        xs.push(x / bw - 0.5);
        ys.push(y / bh - 0.5);
        // quantize to 32 levels/channel: neighbouring points share a fillStyle, so the
        // draw loop can set colour once per bucket instead of once per point.
        cols.push("rgb(" + (r & 248) + "," + (g & 248) + "," + (b & 248) + ")");
      }
    }
    var total = xs.length;
    if (!total) return null;

    var count = Math.min(total, n);
    var ux = new Float32Array(count), uy = new Float32Array(count);
    var order = new Array(count);
    for (var k = 0; k < count; k++) {
      var src = Math.floor(k / count * total);
      ux[k] = xs[src]; uy[k] = ys[src];
      order[k] = { i: k, c: cols[src] };
    }
    // group by colour so draw() sets fillStyle once per run, not once per point
    order.sort(function (p, q) { return p.c < q.c ? -1 : p.c > q.c ? 1 : 0; });
    var idx = new Int32Array(count), colOf = new Array(count);
    for (var m = 0; m < count; m++) { idx[m] = order[m].i; colOf[m] = order[m].c; }

    return { count: count, ux: ux, uy: uy, idx: idx, col: colOf };
  }

  /* ── the snapshot (BROWSER-ONLY) ─────────────────────────────────────────── */

  // snapshot(drawFn, w, h) — run drawFn ONCE into an offscreen canvas at the live aspect
  // ratio and sample it. Called exactly once per solve, never per frame. Returns null on
  // any failure (no document, tainted/blocked getImageData, nothing lit) — callers treat
  // null as "no dissolve", and the deploy simply has no puzzle layer.
  function snapshot(drawFn, w, h) {
    if (typeof drawFn !== "function") return null;
    if (typeof document === "undefined" || !document.createElement) return null;
    if (!(w > 0) || !(h > 0)) return null;
    try {
      var scale = BUF_MAX / Math.max(w, h);
      var bw = Math.max(8, Math.round(w * scale)), bh = Math.max(8, Math.round(h * scale));
      var cv = document.createElement("canvas");
      cv.width = bw; cv.height = bh;
      var bx = cv.getContext("2d");
      if (!bx) return null;
      // deliberately NO background fill — the puzzle lands on transparent black, so the
      // alpha channel alone separates "drawn" from "empty" and no threshold guessing is needed.
      bx.save();
      bx.scale(bw / w, bh / h);          // the game draws in real canvas coordinates
      drawFn(bx, w, h, 1 / 60);
      bx.restore();
      var img = bx.getImageData(0, 0, bw, bh);
      return buildCloud(img.data, bw, bh, MAX_POINTS);
    } catch (e) {
      return null;                        // never let a snapshot failure break the solve
    }
  }

  /* ── the animation ───────────────────────────────────────────────────────── */

  // draw(ctx, w, h, cloud, t) — t ∈ [0,1] is the SUCK progress (its own clock, independent of
  // the deploy's σ ramp). At t=0 the cloud sits exactly where the puzzle was; at t=1 it is
  // fully consumed. Safe to call with a null cloud or t ≥ 1 (both are no-ops).
  function draw(ctx, w, h, cloud, t) {
    if (!ctx || !cloud || !cloud.count) return;
    t = clamp(t, 0, 1);
    if (t >= 1) return;

    var cx = w / 2, cy = h / 2, mn = Math.min(w, h);
    var breakR = BREAK_RADIUS * mn, jit = JITTER * mn;
    // ease-in on the travel: the pull starts gently and accelerates — it reads as suction
    // rather than a linear slide.
    var e = t * t * (3 - 2 * t) * (0.35 + 0.65 * t);
    var zoom = 1 - ZOOM_OUT * t;
    var spin = TURNS * TAU * e;
    var fade = 1 - 0.15 * t;               // a whisper of global decay on top of the spatial one

    var prevAlpha = ctx.globalAlpha;
    var run = null;
    ctx.save();
    for (var k = 0; k < cloud.count; k++) {
      var i = cloud.idx[k];
      var px = cloud.ux[i] * w, py = cloud.uy[i] * h;
      var r0 = Math.sqrt(px * px + py * py);
      var a0 = Math.atan2(py, px);

      // travel: inward along a spiral, the whole field shrinking as it goes
      var r = r0 * (1 - e) * zoom;
      var a = a0 + spin;
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;

      // DISINTEGRATION — keyed to where the point IS, not to how long it has travelled.
      // 0 out at the rim, 1 at the centre. This is the effect's whole point.
      var near = 1 - clamp(r / breakR, 0, 1);
      if (near > 0) {
        var s = near * near * jit;
        x += hash1(i, 1.7) * s;
        y += hash1(i, 4.3) * s;
      }
      var alpha = (1 - near) * (1 - near) * fade;
      if (alpha <= 0.012) continue;        // fully broken up — stop paying for it
      var size = DOT * (0.35 + 0.65 * (1 - near));

      var c = cloud.col[k];
      if (c !== run) { ctx.fillStyle = c; run = c; }
      ctx.globalAlpha = alpha;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
  }

  var GameDissolve = {
    snapshot: snapshot,
    buildCloud: buildCloud,
    draw: draw,
    MAX_POINTS: MAX_POINTS
  };

  root.GameDissolve = GameDissolve;
  if (typeof module !== "undefined" && module.exports) module.exports = GameDissolve;
})(typeof window !== "undefined" ? window : globalThis);
