/* game-ink.js — the PUZZLE LAYER's legible derivative of an atlas palette.
 *
 * THE SPLIT, and it is the whole point: `host.palette` keeps meaning "atlas truth, for
 * the lamps and the spiral" and palettes.js is NOT touched — the atlas stays the lamp
 * authority. `host.ink` is a derived, floored view of the same palette, for marks a
 * visitor has to READ. A lamp can be any colour it likes; a cursor cannot.
 *
 * WHAT WAS WRONG. Measured on the shipped roster: puzzle marks sat as low as ~2.4:1, and
 * a mark drawn at globalAlpha 0.45 fell to ~1.3:1. Alpha compounding was half the defect,
 * so dimming becomes a ROLE here, not a multiply — ink.dim(i) is a pre-floored colour at
 * FULL alpha, and engines stop reaching for globalAlpha to say "inert".
 *
 * WHAT IT IS MEASURED AGAINST. Not the bare shell background: no puzzle mark is ever drawn
 * on it. The backdrop spiral sits in front of it at the PLAY alpha, so a mark that clears
 * 4.5:1 over near-black can sit far lower over a lit spiral pixel. Everything here floors
 * against BACKDROP_REF — the shell background composited with the palette's mean at the
 * backdrop alpha, which the shell can compute because it owns that number.
 *
 * DIM IS A BAND, NOT JUST A FLOOR. A colour that already cleared 4.5:1 used to come back
 * unchanged from both mark() and dim() — individually legible, and identical. Engines that
 * tell state apart by role INDEX never noticed; engines that tell mark from dim at the SAME
 * index broke outright (simon's lamps looked the same lit or unlit on one scheme, memory's
 * matched pairs looked unmatched on another). So dim is pinned to the dim floor and mark is
 * pushed above it by DIM_LUM_RATIO, and the two can never be equal on any scheme at any
 * index. No contrast measurement can see that failure, which is why it belongs here rather
 * than in each engine's index discipline.
 *
 * THE FLOORS ARE A TASTE DIAL, NOT A LAW. Two named constants, in this one file, tunable
 * after K.'s A/B. They are a standards-derived starting point, nothing more.
 *
 * Hue and saturation are preserved; only luminance is lifted. "0000ff" becomes a mid blue
 * that is still Deep Ocean.
 *
 * PLAY ONLY. DEPLOY is deliberately untouched — its alpha 0.3→1.0 bloom is the reward
 * moment and already correct, and a blind floor would fight it.
 *
 * Dual export (house convention): window in the browser, globalThis/module in node.
 */
(function (root) {
  "use strict";

  // ── the taste dial ──────────────────────────────────────────────────────
  var MARK_FLOOR = 4.5;      // active marks, cursors, anything being read
  var DIM_FLOOR = 3.0;       // inert / unselected — still legible, clearly quieter
  // dim is a BAND, not just a floor: it must also be at most this fraction of mark's
  // luminance. Without it, any atlas colour that ALREADY cleared 4.5:1 came back from
  // both mark(i) and dim(i) unchanged — two individually legible colours that are the
  // same string. Engines that separate state by role INDEX survived that; engines that
  // separate mark-from-dim at the SAME index did not, and it made simon's lamps identical
  // lit or unlit on Solar Temple, mastermind's active slot indistinguishable on Toxic
  // Reactor, and memory's matched pairs look unmatched on Aurora. Contrast numbers cannot
  // see this failure, which is why it is a property of THIS file rather than of each
  // engine's index discipline. 0.55 sits just under the ~0.60 the two floors already imply
  // when both are at their minimum, so it costs nothing there and only bites when the raw
  // colour is bright enough to have collapsed.
  var DIM_LUM_RATIO = 0.55;
  var HOUSE_ACCENT = "#f2c94c";   // 12.8:1; the fallback every engine already reached for
  // An atlas accent this dark is the `accentDark` case (palettes.js bakes it at luminance
  // 0.03). Lifting one to 4.5:1 would destroy the hue identity it was given for, so the
  // accent role falls back to the house accent instead. Detected by luminance rather than
  // by reading a flag, so a future dark accent is caught without touching palettes.js.
  var ACCENT_DARK_LUM = 0.06;

  /* ── colour maths (pure; all of this is unit-tested) ── */

  function parseHex(c) {
    if (typeof c !== "string") return null;
    var h = c.charAt(0) === "#" ? c.slice(1) : c;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    return "#" + rgb.map(function (v) {
      var n = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return n.length === 1 ? "0" + n : n;
    }).join("");
  }
  function relLum(rgb) {                       // WCAG relative luminance
    var c = rgb.map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = relLum(a), lb = relLum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // src over dst at alpha — how the backdrop actually reaches the eye.
  function composite(src, dst, alpha) {
    return [0, 1, 2].map(function (i) { return src[i] * alpha + dst[i] * (1 - alpha); });
  }

  function rgbToHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var l = (mx + mn) / 2, h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(hsl) {
    var h = hsl[0], s = hsl[1], l = hsl[2];
    if (!s) { var v = l * 255; return [v, v, v]; }
    function hue(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
  }

  /* lift() — raise LIGHTNESS only, until the colour clears `target` against `bg`.
   *
   * Hue and saturation are held, so the palette still reads as itself: this is a
   * legibility floor, not a recolour. A binary search over lightness rather than a
   * formula, because the WCAG curve is not invertible in HSL space and 24 steps
   * resolves it well past display precision. If even white cannot clear the target
   * (a pale backdrop), white is returned — the best available, never a crash. */
  function lift(color, target, bg) {
    var rgb = parseHex(color);
    if (!rgb) return null;
    var bgRgb = Array.isArray(bg) ? bg : parseHex(bg);
    if (!bgRgb) return toHex(rgb);
    if (contrast(rgb, bgRgb) >= target) return toHex(rgb);

    var hsl = rgbToHsl(rgb);
    // Which way is legibility? Against a dark backdrop, up. Against a light one, down.
    var up = relLum(bgRgb) < 0.5;
    var lo = up ? hsl[2] : 0, hi = up ? 1 : hsl[2];
    var best = up ? [255, 255, 255] : [0, 0, 0];
    if (contrast(best, bgRgb) < target) return toHex(best);   // unreachable: give the extreme
    for (var i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      var cand = hslToRgb([hsl[0], hsl[1], mid]);
      if (contrast(cand, bgRgb) >= target) { best = cand; if (up) hi = mid; else lo = mid; }
      else if (up) lo = mid; else hi = mid;
    }
    // The search runs in continuous HSL; the answer ships as 8-bit hex. That rounding can
    // land a hair UNDER the target (measured: 4.47 against a 4.5 floor), and a floor you
    // miss by 0.03 is still a floor you miss. So step the quantised colour until it clears.
    var out = toHex(best), l = rgbToHsl(best)[2];
    for (var n = 0; n < 40 && contrast(parseHex(out), bgRgb) < target; n++) {
      l = up ? Math.min(1, l + 0.004) : Math.max(0, l - 0.004);
      out = toHex(hslToRgb([hsl[0], hsl[1], l]));
    }
    return out;
  }

  /* lumFor() — the relative luminance a colour needs to hit `target` against `bg`.
   * Inverts the WCAG ratio directly; only valid for a colour LIGHTER than the backdrop,
   * which is the case for every mark in this piece (the shell background is #04050a). */
  function lumFor(target, bg) {
    var bgRgb = Array.isArray(bg) ? bg : parseHex(bg);
    return target * (relLum(bgRgb) + 0.05) - 0.05;
  }

  /* atLum() — the same hue and saturation, moved to a target LUMINANCE.
   * A binary search over lightness, like lift(), because luminance is not linear in HSL.
   * Used to place mark and dim on their band; hue and saturation never change. */
  function atLum(color, lum) {
    var rgb = parseHex(color);
    if (!rgb) return null;
    var hsl = rgbToHsl(rgb), lo = 0, hi = 1, best = rgb;
    for (var i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      var cand = hslToRgb([hsl[0], hsl[1], mid]);
      best = cand;
      if (relLum(cand) < lum) lo = mid; else hi = mid;
    }
    // quantise upward if 8-bit rounding dropped it under the target it was aiming at
    var out = toHex(best), l = rgbToHsl(best)[2];
    for (var n = 0; n < 40 && relLum(parseHex(out)) < lum; n++) {
      l = Math.min(1, l + 0.004);
      out = toHex(hslToRgb([hsl[0], hsl[1], l]));
    }
    return out;
  }

  /* backdropRef() — what a puzzle mark is ACTUALLY drawn on top of.
   *
   * The shell background with the deploy-target exhibit's palette mean composited over it
   * at the PLAY backdrop alpha. A mean rather than a worst case on purpose: the spiral is
   * thin line-work over mostly-background, so flooring against its brightest pixel would
   * blow every mark out to near-white and cost the palette its identity. */
  function backdropRef(bgHex, palette, alpha) {
    var bg = parseHex(bgHex) || [4, 5, 10];
    var cols = (palette || []).map(parseHex).filter(Boolean);
    if (!cols.length) return bg;
    var mean = [0, 1, 2].map(function (i) {
      return cols.reduce(function (a, c) { return a + c[i]; }, 0) / cols.length;
    });
    return composite(mean, bg, alpha == null ? 0.22 : alpha);
  }

  /* makeInk() — the object handed to games as host.ink.
   *
   * Every entry is PRE-FLOORED at full alpha. An engine draws a mark with ink.mark(i) and
   * an inert one with ink.dim(i); it never multiplies either by globalAlpha to say
   * "quieter", because that is precisely what put the marks under the floor. */
  function makeInk(palette, ref) {
    var pal = (palette || []).slice();
    var marks = [], dims = [];

    /* Build BOTH states of one role together, because they are a band and neither is
     * meaningful alone.
     *   dim  sits exactly at DIM_FLOOR — the quietest thing that is still readable.
     *   mark sits at whichever is highest of: the mark floor, the colour's own natural
     *        luminance (so a bright role keeps its character), and whatever the band
     *        requires above dim.
     * Doing it in that order means the two can never come back equal, on any scheme, at
     * any index — which is the failure that got past a page of correct contrast numbers. */
    function build(i) {
      var n = pal.length || 1, k = ((i | 0) % n + n) % n;
      if (marks[k]) return k;
      var raw = parseHex(pal[k]);
      if (!raw) { marks[k] = "#c8d2eb"; dims[k] = "#8a93b4"; return k; }
      var dimLum = lumFor(DIM_FLOOR, ref);
      var markLum = Math.max(lumFor(MARK_FLOOR, ref), relLum(raw), dimLum / DIM_LUM_RATIO);
      dims[k] = atLum(pal[k], dimLum) || "#8a93b4";
      marks[k] = atLum(pal[k], markLum) || "#c8d2eb";
      return k;
    }
    function at(list, floor, i) { return list[build(i)]; }
    var accent = null;
    return {
      mark: function (i) { return at(marks, MARK_FLOOR, i); },
      dim: function (i) { return at(dims, DIM_FLOOR, i); },
      accent: function () {
        if (accent) return accent;
        var a = parseHex(pal[3]);
        // accentDark schemes: the house accent, NOT a floor-lifted near-black. Lifting one
        // would make the marks in five of fifteen games worse than the bug being fixed.
        accent = (!a || relLum(a) < ACCENT_DARK_LUM) ? HOUSE_ACCENT : (lift(pal[3], MARK_FLOOR, ref) || HOUSE_ACCENT);
        return accent;
      },
      ref: ref
    };
  }

  var GameInk = {
    MARK_FLOOR: MARK_FLOOR, DIM_FLOOR: DIM_FLOOR,
    HOUSE_ACCENT: HOUSE_ACCENT, ACCENT_DARK_LUM: ACCENT_DARK_LUM,
    parseHex: parseHex, toHex: toHex, relLum: relLum, contrast: contrast,
    composite: composite, lift: lift, atLum: atLum, lumFor: lumFor,
    backdropRef: backdropRef, makeInk: makeInk, DIM_LUM_RATIO: DIM_LUM_RATIO,
    // contrast between two things named however the caller has them (hex or rgb triple)
    ratio: function (a, b) {
      var x = Array.isArray(a) ? a : parseHex(a), y = Array.isArray(b) ? b : parseHex(b);
      return (x && y) ? contrast(x, y) : 0;
    }
  };

  root.GameInk = GameInk;
  if (typeof module !== "undefined" && module.exports) module.exports = GameInk;
})(typeof window !== "undefined" ? window : globalThis);
