/* game-spiral.js — the reward binding: a chosen exhibit drawn faint (dormant preview)
 * or ramped to its full σ-resolved loop (deploy). No party director; just the exact
 * 4-line render contract the labs already use over SYM.makeExhibit.
 *
 *   preview : low alpha + held-low σ → chaotic, faint, never completing (what you unlock)
 *   deploy  : alpha 0.3→1 and σ 0→1 swept over ~1.5s → the spiral resolves and loops
 *
 * Owns its own background handling per the developer read: non-opaque exhibits only
 * trail-fade, so the SHELL clears the frame each pass and this draws additively on top.
 * ~10 exhibits are opaque:true (they hard-clear themselves) — harmless here, they just
 * own their frame. Dual browser/node export; draw() is only ever called with a real ctx.
 */
(function (root) {
  "use strict";

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  // The exhibit draws itself to fill the whole canvas (its centre is w/2,h/2). To sit the
  // reward spiral inside a margin ("zoomed out"), scale the ctx about the canvas centre
  // before the exhibit draws, then restore. The menu backdrop passes no zoom → full size.
  var SPIRAL_ZOOM = 0.82;
  function drawScaled(ctx, w, h, zoom, fn) {
    if (!zoom || zoom === 1) { fn(); return; }
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); ctx.translate(-w / 2, -h / 2);
    fn();
    ctx.restore();
  }

  var SpiralView = {
    // A live view over one exhibit. Cache one per title in the shell so the exhibit
    // keeps its internal animation state (_t etc.) across frames.
    create: function (title) {
      var SYM = root.SYM;
      var ex = SYM ? SYM.makeExhibit(title) : null;   // null if title unknown / SYM absent
      return {
        title: title,
        ex: ex,
        ok: function () { return !!ex; },

        // dormant preview: faint, chaotic, held just off the floor so it breathes but
        // never resolves. pal = hex[] (no '#'), the atlas colours for this spiral.
        preview: function (ctx, w, h, dt, pal, alpha) {
          this.atSigma(ctx, w, h, dt, pal, alpha == null ? 0.3 : alpha, 0.2, SPIRAL_ZOOM);
        },

        // the general form host.spiralPreview() drives: draw the exhibit at an ARBITRARY σ
        // and alpha. preview() is just this pinned at σ=0.2; deploy() sweeps σ itself.
        // zoom (optional) sits the spiral inside a margin; omitted (menu backdrop) = full size.
        atSigma: function (ctx, w, h, dt, pal, alpha, sigma, zoom) {
          if (!ex) return;
          var s = clamp(sigma == null ? 0.2 : sigma, 0, 1);
          drawScaled(ctx, w, h, zoom, function () {
            ex.update(dt, s * 2 - 1); ex.q = s;
            ex.draw(ctx, w, h, dt, { alpha: alpha == null ? 0.3 : alpha, fade: 0.2, color: root.SYM.orderColor(s, pal), tint: null });
          });
        },

        // deploy at progress p ∈ [0,1]: alpha and σ both ramp; at p=1 the spiral holds
        // its resolved loop. Caller runs p from 0→1 over DEPLOY_MS then pins it at 1.
        deploy: function (ctx, w, h, dt, pal, p) {
          if (!ex) return;
          var sigma = clamp(p, 0, 1);
          var alpha = 0.3 + 0.7 * sigma;              // 0.3 → 1.0
          drawScaled(ctx, w, h, SPIRAL_ZOOM, function () {
            ex.update(dt, sigma * 2 - 1); ex.q = sigma;
            ex.draw(ctx, w, h, dt, { alpha: alpha, fade: 0.05, color: root.SYM.orderColor(sigma, pal), tint: null });
            // The superfluid bloom is the screen mirror of the lamp flood — only meaningful
            // once order is climbing, so gate it past the midpoint.
            if (sigma > 0.4 && root.SYM.drawSuperfluidBloom) {
              root.SYM.drawSuperfluidBloom(ctx, w, h, sigma, root.SYM.orderColor(sigma, pal), (ex._t || 0), (sigma - 0.4) / 0.6, 0, null);
            }
          });
        }
      };
    }
  };

  root.SpiralView = SpiralView;
  if (typeof module !== "undefined" && module.exports) module.exports = SpiralView;
})(typeof window !== "undefined" ? window : globalThis);
