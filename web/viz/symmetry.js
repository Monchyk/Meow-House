/* viz/symmetry.js — the Math Gallery: CHAOS → SYMMETRY.
 *
 * The visual thesis of DEEP HOUSE. Every exhibit starts turbulent and asymmetric
 * and RESOLVES into clean symmetry as an order-parameter σ (0..1) rises. σ is the
 * nervous system finding its baseline: it drives the picture, the on-screen
 * formula simplifying, and the Hue lights (σ→PAD, cool+steady as order grows).
 *
 * Regulation is EARNED, not automatic: the player nudges `tune` (−1 chaos .. +1
 * symmetry); σ eases toward (tune+1)/2. Reaching σ>0.9 is a lock — it blooms the
 * lights and pays out a clue fragment (wired in brain.js).
 *
 * Two consumers, one exhibit set:
 *   SymmetryGallery — foreground, interactive, HUD (the "math room").
 *   AmbientDirector — the always-on background layer in every menu room; runs on
 *                     autopilot (σ breathes on its own), dim, no HUD, optional tint.
 *
 * Exhibit contract (each factory returns):
 *   { title, formula(q), q, update(dt, tune), sigma()→0..1, draw(ctx,w,h,dt,opts) }
 *   opts = { alpha, fade, color, tint }
 *
 * Pure canvas-2D, no deps. Every exhibit is self-contained —
 * add/remove freely, the gallery just walks whatever's in EXHIBITS.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const TAU = Math.PI * 2;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function ease(cur, tgt, dt, rate) { return cur + (tgt - cur) * Math.min(1, dt * rate); }
  function hexToRgb(hex) {
    const h = (hex || "#8E7CC3").replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  // Ambient spiral colour by order-parameter σ.
  //  • Party path — second arg is a role palette [primary, secondary, bridge, accent, …]:
  //      secondary = chaos end (σ→0), primary = order end (σ→1), bridge = the mid-σ
  //      hand-off that prevents a hard jump (the role the atlas already assigns it).
  //      The accent is NOT blended here — it only tints the press-flare in the bloom.
  //  • Legacy path — second arg is a hex tint (or null): the original cool→warm ramp.
  /* The palette laid out as a loop: primary → bridge → secondary → bridge → (wrap).
   * There-and-back for the same reason the lamps use it — sampling wraps from the
   * last entry back to the first, and a plain p/s/b list puts a hard hue jump there. */
  /* K.: "a lot of them show pretty unicoloured… I love it when the spirals and bloom
     have 4 or more different colours, 2 being a lower bound."
     The ramp used to be primary → bridge → secondary → bridge: THREE hues, and the
     scheme's accent (and the generated schemes' fifth "breath" role) never reached the
     screen at all — they existed only in the press-flare. Now every role is on the
     loop, so a 5-role scheme puts five hues on screen at once.

     The accent needs care rather than exclusion. Several atlas schemes carry a
     deliberately near-BLACK accent (`accentDark`, luminance 0.03); dropped straight
     into the loop it reads as a hole in the picture, not as a colour. Anything that
     dark is lifted toward the bridge until it is a dim version of the scheme instead
     of an absence. Bright near-white accents are left alone — those land as highlights,
     which is what an accent is for. */
  function usable(rgb, toward) {
    const lum = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) / 255;
    if (lum >= 0.12) return rgb;
    const t = 1 - lum / 0.12;                       // fully dark → fully lifted
    return { r: lerp(rgb.r, toward.r, t * 0.75) | 0,
             g: lerp(rgb.g, toward.g, t * 0.75) | 0,
             b: lerp(rgb.b, toward.b, t * 0.75) | 0 };
  }
  function paletteRamp(pal) {
    const hx = i => hexToRgb("#" + pal[i]);
    const primary = hx(0), secondary = hx(1);
    const bridge = pal[2] ? hx(2) : secondary;
    const stops = [primary, bridge, secondary];
    // accent, then breath (5-role generated schemes only) — each lifted if near-black.
    if (pal[3]) stops.push(usable(hx(3), bridge));
    if (pal[4]) stops.push(usable(hx(4), bridge));
    // There-and-back through the bridge for the same reason the lamps do it: sampling
    // wraps from the last stop back to the first, and without a hand-off that wrap is
    // a hard hue jump. With the accent on the loop, the jump would be the worst one.
    stops.push(bridge);
    // WHERE THE SECONDARY SITS on the loop. It used to be exactly halfway (a 4-stop
    // ramp), and the chaos end hard-coded 0.5 to centre on it. With the accent and
    // breath roles added the loop is 5 or 6 long, so that constant would centre chaos
    // on whatever role happened to land mid-list. Carried with the ramp instead.
    stops.sec = 2 / stops.length;
    return stops;
  }
  function sampleRamp(ramp, t) {
    t -= Math.floor(t);                       // wrap into [0,1)
    const scaled = t * ramp.length;
    const i = Math.floor(scaled) % ramp.length, n = (i + 1) % ramp.length;
    const f = scaled - Math.floor(scaled), sm = f * f * (3 - 2 * f);   // smoothstep, no banding
    return { r: lerp(ramp[i].r, ramp[n].r, sm) | 0,
             g: lerp(ramp[i].g, ramp[n].g, sm) | 0,
             b: lerp(ramp[i].b, ramp[n].b, sm) | 0 };
  }

  // How wide a slice of the ramp the picture spans, at chaos vs at order. Chaos shows
  // the WHOLE scheme; symmetry converges toward the primary — so σ is legible as colour
  // unity, not just as shape. Never reaches 0: a fully monochrome resolve is what the
  // screen already looked like, and that was the complaint.
  // Live-tunable from the dashboard ("The colours"), because how many colours are on
  // screen at once turned out to be a taste dial, not a constant. The order end no
  // longer collapses to one hue: 0.55 of the loop still shows two or three roles as it
  // resolves — K.'s stated lower bound is two, not one.
  const SPREAD_CHAOS = 1.0, SPREAD_ORDER = 0.66;   // wider ordered-hue slice → more colour on screen at rest (K.: "blow up the colours")
  function spreadEnds() {
    const c = root.PARTY && root.PARTY.config;
    return [c && c.colorSpreadChaos != null ? c.colorSpreadChaos : SPREAD_CHAOS,
            c && c.colorSpreadOrder != null ? c.colorSpreadOrder : SPREAD_ORDER];
  }

  function orderColor(sigma, tintOrPalette) {
    const s = clamp(sigma, 0, 1);
    if (Array.isArray(tintOrPalette) && tintOrPalette.length >= 2) {
      const pal = tintOrPalette;
      const chaos = hexToRgb("#" + pal[1]);            // secondary → chaos
      const order = hexToRgb("#" + pal[0]);            // primary → order
      const bridge = hexToRgb("#" + (pal[2] || pal[1])); // bridge → mid-σ hand-off
      let r, g, b;
      if (s < 0.5) { const t = s / 0.5; r = lerp(chaos.r, bridge.r, t); g = lerp(chaos.g, bridge.g, t); b = lerp(chaos.b, bridge.b, t); }
      else { const t = (s - 0.5) / 0.5; r = lerp(bridge.r, order.r, t); g = lerp(bridge.g, order.g, t); b = lerp(bridge.b, order.b, t); }
      const out = { r: r | 0, g: g | 0, b: b | 0 };

      /* The SPATIAL sampler. Everything above returns one colour for one σ, which is
       * why the screen was monochrome at any instant however rich the scheme was.
       * `at(u)` gives an exhibit a colour per ELEMENT — petal, arm, ring, cell — so
       * the whole scheme can be on screen at once. u is 0..1 across the exhibit's own
       * elements; phase is an optional extra offset (animate it to make colour travel).
       * Exhibits that never call it keep the old single colour, so this is additive. */
      const ramp = paletteRamp(pal);
      const ends = spreadEnds();
      const spread = ends[0] + (ends[1] - ends[0]) * s;
      // Centre of the slice: secondary at chaos → primary (ramp 0) at order.
      const centre = ramp.sec * (1 - s);
      out.at = function (u, phase) {
        return sampleRamp(ramp, centre + ((u || 0) - 0.5) * spread + (phase || 0));
      };
      return out;
    }
    // legacy: cool slate/violet → warm gold, optional hex tint biases the ramp
    const chaos = [96, 104, 150], order = [242, 201, 120];
    let r = lerp(chaos[0], order[0], s), g = lerp(chaos[1], order[1], s), b = lerp(chaos[2], order[2], s);
    const tint = tintOrPalette;
    if (tint) { const t = hexToRgb(tint); r = lerp(r, t.r, 0.45); g = lerp(g, t.g, 0.45); b = lerp(b, t.b, 0.45); }
    const out = { r: r | 0, g: g | 0, b: b | 0 };
    // Off the party branch there is no scheme to spread, so the sampler is the identity.
    // Exhibits can therefore call at() unconditionally and stay correct in Deep House,
    // where colour deliberately means one feeling (σ→PAD) and must NOT free-cycle.
    out.at = function () { return out; };
    return out;
  }

  /* Colour for element i of n. The half-step keeps the first and last element off the
   * exact ends of the slice, so an N-fold shape doesn't put two near-identical colours
   * next to each other at the seam. */
  function colorOfN(color, i, n, phase) {
    if (!color || !color.at || n <= 1) return color;
    return color.at((i + 0.5) / n, phase);
  }

  /* A LOOKUP TABLE across the slice, built once per frame.
   *
   * The per-cell exhibits (Julia, Mandelbrot, Newton, moiré) colour by escape time or
   * by field value, which means one colour per CELL: at cell size 4 that is ~57 000
   * sampler calls and 57 000 short-lived objects a frame, on the exhibit whose own
   * comment already says it lags. The colour only needs to be as fine as the eye can
   * see a band, so it is sampled `n` times up front and indexed after. Same picture,
   * one allocation per frame instead of tens of thousands. */
  function rampLUT(color, n, phase) {
    const N = n || 64, out = new Array(N);
    for (let i = 0; i < N; i++) out[i] = colorAtU(color, i / (N - 1), phase);
    out.pick = function (u) { return out[clamp(u * (N - 1), 0, N - 1) | 0]; };
    return out;
  }

  /* Colour at a CONTINUOUS position u ∈ [0,1] — for exhibits whose elements sit on a
   * smooth coordinate (radius, height, time) rather than an integer index. */
  function colorAtU(color, u, phase) {
    if (!color || !color.at) return color;
    return color.at(clamp(u, 0, 1), phase);
  }

  /* Stroke an ALREADY-COMPUTED polyline as coloured bands. The parametric cousin
   * (strokeRamp) recomputes points from u; several exhibits build their path first
   * (recursive subdivision, an integrated curve, a bit-trick walk) and only need it
   * coloured. One stroke per band, each band starting on its neighbour's last point so
   * the bands read as one continuous line rather than as dashes.
   *
   * Half the gallery used to draw in ONE colour per frame — K.: "a lot of them show
   * pretty unicoloured." This is the fix for the path-shaped half of them. */
  function strokeSegments(ctx, color, alpha, pts, bands, phase) {
    if (!pts || pts.length < 2) return;
    const B = Math.max(1, Math.min(bands || 48, pts.length - 1));
    const per = Math.ceil((pts.length - 1) / B);
    for (let b = 0; b * per < pts.length - 1; b++) {
      const from = b * per, to = Math.min(pts.length - 1, from + per);
      ctx.strokeStyle = rgba(colorOfN(color, b, B, phase), alpha);
      ctx.beginPath();
      ctx.moveTo(pts[from][0], pts[from][1]);
      for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  /* Stroke a parametric curve as coloured segments: pt(u) → [x, y] for u ∈ [0,1].
   * The curve walks the palette ramp as it is drawn, so a single continuous line
   * carries the whole scheme. One stroke per sample would be thousands of draw calls
   * a frame, hence SEG chunks; each chunk overshoots its neighbour by one sample,
   * without which the segments read as dashes. */
  function strokeRamp(ctx, color, alpha, pt, seg, phase, perSeg) {
    const S = seg || 64, N = perSeg || 20;
    for (let s = 0; s < S; s++) {
      ctx.strokeStyle = rgba(colorOfN(color, s, S, phase), alpha);
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const p = pt((s + j / N) / S);
        j === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
  }

  // The party palette + accent this frame, or null when party.js isn't present.
  function partySpiral() {
    return (root.PARTY && root.PARTY.activeSpiral) ? root.PARTY.activeSpiral() : null;
  }

  // Stable string→[0,n) index, so a party spiral id maps to a repeatable exhibit.
  function hashIndex(str, n) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return n > 0 ? (h >>> 0) % n : 0;
  }
  function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${a})`; }
  // deterministic per-cell noise in [0,1) — stable across frames (used to ease chaos→order)
  function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }

  // σ (0..1) → PAD. Chaos: negative valence, high arousal, low dominance (overload).
  // Order: warm valence, low arousal, dominant (calm/regulated).
  function sigmaToPad(sigma) {
    return { v: lerp(-0.6, 0.6, sigma), a: lerp(0.8, -0.3, sigma), d: lerp(-0.5, 0.4, sigma) };
  }

  /* Superfluid bloom — the screen mirror of the lamp flood. Light rises from the
   * shape (screen centre) and flows out to the four corners; reach + brightness
   * grow with σ (chaos = a tight turbulent well; symmetry = a serene flood that
   * reaches the corners). Same feeling the real lamps carry via SuperfluidFlowLayer.
   * Purely additive; save/restore leaves ctx composite exactly as it found it. */
  /* Every number below used to be a literal. They are the nucleus's whole look, and
     K. is the operator, so they live in PARTY.config where the dashboard can reach
     them (brief §14.3). Read through this helper so the file keeps working with no
     PARTY at all — brain.js and the headless suites use exactly these defaults.
     Each pair is the σ range: `…Lo` at chaos, `…Hi` at order. */
  const BLOOM = {
    coreLo: 0.10, coreHi: 0.44,          // central well radius, as a fraction of min(w,h)
    coreAlphaLo: 0.03, coreAlphaHi: 0.12,
    reachLo: 0.34, reachHi: 1.0,         // how far the streams get toward the corners
    flowLo: 0.55, flowHi: 0.22,          // stream speed — chaos races, order glides (Lo > Hi)
    drops: 5,                            // travelling fronts per stream
    dropRadLo: 0.06, dropRadHi: 0.16,
    dropAlphaLo: 0.02, dropAlphaHi: 0.085,
    // NEGATIVE on purpose: the corner glow stays fully dark until σ climbs past ~⅓.
    // Not a typo — clamping it to 0 lights the corners in the chaos phase.
    cornerAlphaLo: -0.04, cornerAlphaHi: 0.085,
    cornerRadLo: 0.12, cornerRadHi: 0.30,
    flareAmp: 1.6, flareReach: 0.28,     // the press flare's extra brightness + shove
  };
  function bloomCfg() {
    const c = (root.PARTY && root.PARTY.config) || null;
    if (!c) return BLOOM;
    const o = {};
    for (const k in BLOOM) {
      const v = c["bloom" + k.charAt(0).toUpperCase() + k.slice(1)];
      o[k] = (typeof v === "number" && isFinite(v)) ? v : BLOOM[k];
    }
    return o;
  }

  function drawSuperfluidBloom(ctx, w, h, sigma, color, t, strength, pulse, accent) {
    const B = bloomCfg();
    const s = clamp(sigma, 0, 1);
    const pop = pulse || 0;                          // a press flare: brighter + reaches further for a beat
    // The accent (atlas "scream") only ever appears on the flare, never ambiently.
    if (accent && pop > 0) {
      const a = hexToRgb("#" + accent), k = clamp(pop, 0, 1) * 0.6;
      color = { r: lerp(color.r, a.r, k) | 0, g: lerp(color.g, a.g, k) | 0, b: lerp(color.b, a.b, k) | 0 };
    }
    const amp = (strength == null ? 1 : strength) * (1 + pop * B.flareAmp);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // 1. the source — a central well that widens and brightens as order grows
    const coreR = R * lerp(B.coreLo, B.coreHi, s);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, rgba(color, lerp(B.coreAlphaLo, B.coreAlphaHi, s) * amp));
    core.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = core; ctx.fillRect(0, 0, w, h);

    // 2. four streams flowing centre → corners (the "superfluid")
    const corners = [[0, 0], [w, 0], [w, h], [0, h]];
    const reach = clamp(lerp(B.reachLo, B.reachHi, s) + pop * B.flareReach, 0, 1.15);  // a press shoves the flood outward

    const flowSpeed = lerp(B.flowLo, B.flowHi, s);   // chaos races, order glides
    const drops = Math.max(1, Math.round(B.drops));
    for (let ci = 0; ci < 4; ci++) {
      const gx = corners[ci][0], gy = corners[ci][1];
      const dx = gx - cx, dy = gy - cy;
      // Each corner draws its own role from the scheme, drifting — so the screen bloom
      // carries the same "colour travels outward" gesture the lamps now make in the room.
      // The flare still overrides everything with the accent (see `color` above).
      const cc = colorOfN(color, ci, 4, t * 0.03);
      for (let k = 0; k < drops; k++) {
        // …and each pulse ALONG a stream takes the next role, so a single arm is a
        // gradient rather than a line of identical dots. With five roles on the loop
        // that is what puts four-plus colours in the frame at any instant.
        const dc = colorOfN(color, ci * drops + k, 4 * drops, t * 0.03);
        const p = ((t * flowSpeed) + k / drops + ci * 0.13) % 1;   // travelling front
        const along = p * reach;
        const x = cx + dx * along, y = cy + dy * along;
        const env = Math.sin(Math.min(1, p / reach) * Math.PI);    // bright mid-flight, fades at reach
        const a = lerp(B.dropAlphaLo, B.dropAlphaHi, s) * env * amp;
        if (a <= 0.002) continue;
        const rad = R * lerp(B.dropRadLo, B.dropRadHi, s) * (0.6 + 0.4 * env);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, rgba(dc, a));
        g.addColorStop(1, rgba(dc, 0));
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      // 3. corner arrival glow — the flood reaching the room's corner (dark until σ climbs)
      const ca = lerp(B.cornerAlphaLo, B.cornerAlphaHi, s) * amp;
      if (ca > 0.002) {
        const cr = R * lerp(B.cornerRadLo, B.cornerRadHi, s);
        const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, cr);
        cg.addColorStop(0, rgba(cc, ca));
        cg.addColorStop(1, rgba(cc, 0));
        ctx.fillStyle = cg; ctx.fillRect(gx - cr, gy - cr, cr * 2, cr * 2);
      }
    }
    ctx.restore();
  }

  /* A tiny base: eases an internal q∈[0,1] toward (tune+1)/2, exposes σ=q. Each
   * exhibit reads this.q to interpolate its own chaos→symmetry parameters. */
  function base(extra) {
    const o = Object.assign({
      q: 0.06,
      update(dt, tune) { this.q = ease(this.q, (clamp(tune, -1, 1) + 1) / 2, dt, 0.9); this._t = (this._t || 0) + dt; if (this._sub) this._sub(dt); },
      sigma() { return this.q; },
      formula(q) { return this._f ? this._f(q) : ""; }
    }, extra);
    return o;
  }

  /* ── SMOOTH FIELD: the fix for "it looks very pixelated" ────────────────────
     The escape-time exhibits (Julia, Mandelbrot, Newton) evaluate one sample per
     `cell` and paint it as a cell×cell block — 5×5 for Newton — so the blocks are
     plainly visible. K. asked to zoom out; the actual cause is the block size.

     Rendering finer would cost 3–6× more, and Mandelbrot already lags. So instead:
     write each sample as ONE PIXEL into a small offscreen buffer, then stretch that
     buffer up to full size with smoothing on. Bilinear interpolation turns the blocks
     into a continuous field. **Exactly the same number of escape evaluations** — the
     cost does not move, only the presentation.

     Implemented as a paint TARGET rather than a rewrite: it exposes `fillStyle` and
     `fillRect` with the same shapes the loops already use, so the three exhibits keep
     their existing code and cannot drift from each other.

     Returns null when there is no DOM to build a buffer with (the headless suites run
     in a bare vm), and every caller falls back to painting blocks straight to ctx. */
  function smoothField(host, w, h, cs) {
    let doc = null;
    try { doc = root.document; } catch (e) { return null; }
    if (!doc || typeof doc.createElement !== "function") return null;
    const bw = Math.max(1, Math.ceil(w / cs)), bh = Math.max(1, Math.ceil(h / cs));
    let B = host._field;
    if (!B || B.w !== bw || B.h !== bh) {
      try {
        const cv = doc.createElement("canvas"); cv.width = bw; cv.height = bh;
        const bx = cv.getContext("2d");
        if (!bx || typeof bx.createImageData !== "function") return null;
        const img = bx.createImageData(bw, bh);
        if (!img || !img.data) return null;
        B = host._field = { cv, bx, img, w: bw, h: bh, cs };
      } catch (e) { return null; }
    }
    B.cs = cs;
    const d = B.img.data;
    // fillStyle is set once per cell and parsed here; cache the last one because long
    // runs of identical colour (the interior of a set) are the common case.
    let lastStr = null, lr = 0, lg = 0, lb = 0, la = 255;
    const target = {
      _px: 0,
      set fillStyle(v) {
        if (v === lastStr) return;
        lastStr = v;
        const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(v);
        if (m) { lr = +m[1]; lg = +m[2]; lb = +m[3]; la = Math.round((m[4] == null ? 1 : +m[4]) * 255); }
        else if (typeof v === "string" && v.charAt(0) === "#") {
          const n = parseInt(v.slice(1), 16);
          lr = (n >> 16) & 255; lg = (n >> 8) & 255; lb = n & 255; la = 255;
        }
      },
      get fillStyle() { return lastStr; },
      fillRect(x, y) {
        const bxi = (x / B.cs) | 0, byi = (y / B.cs) | 0;
        if (bxi < 0 || byi < 0 || bxi >= B.w || byi >= B.h) return;
        const o = (byi * B.w + bxi) * 4;
        d[o] = lr; d[o + 1] = lg; d[o + 2] = lb; d[o + 3] = la;
      },
      flush(ctx) {
        B.bx.putImageData(B.img, 0, 0);
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(B.cv, 0, 0, B.w, B.h, 0, 0, w, h);
        ctx.imageSmoothingEnabled = prev;
      },
    };
    return target;
  }

  // shared background fade (trails) + returns the current draw colour
  function frame(ctx, w, h, opts) {
    // fade 0 = "someone else owns the frame this frame" (the overlap path hoists the
    // single fade up to the director). Skipping the fill is not just tidiness: it is a
    // full-canvas paint per layer per frame at 1080p.
    if (opts.fade > 0) {
      ctx.fillStyle = `rgba(4,5,10,${opts.fade})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = "lighter";
  }
  function endFrame(ctx) { ctx.globalCompositeOperation = "source-over"; }

  /* ── exhibits ────────────────────────────────────────────────────────── */

  // 1. Lissajous — detuned ratio (open tangle) → integer ratio (closed figure)
  function lissajous() {
    return base({
      title: "Lissajous", _t: 0,
      _f(q) { const b = lerp(2.62, 3, q).toFixed(2); return `x=sin(3t+φ)   y=sin(${b}·t)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, a = 3, b = lerp(2.62, 3, q), phase = this._t * lerp(0.5, 0.06, q);
        const c = opts.color, R = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
        ctx.lineWidth = 1.4;
        strokeRamp(ctx, c, 0.5 * opts.alpha,
          u => { const t = u * TAU; return [cx + Math.sin(a * t + phase) * R, cy + Math.sin(b * t) * R]; },
          64, this._t * 0.03);
        endFrame(ctx);
      }
    });
  }

  // 2. Harmonograph — damped pendulums; detuned → integer ratio closes the loop
  function harmonograph() {
    return base({
      title: "Harmonograph", _t: 0,
      // A real harmonograph is TWO pendulums per axis — four decaying sine terms, not two.
      // The detuning δ is what σ controls: chaos = the second pendulum sits just off an
      // integer ratio so the figure never closes and slowly precesses; order = it snaps to
      // the ratio and the loop shuts. Drawn as two layered passes (a bright recent pass
      // over a faint older one) so it reads like ink built up over time, not a wire.
      _f(q) { const dt = lerp(0.06, 0, q); return `x,y = Σ sin(fₙt+φ)e^(−dₙt)   δ→${dt.toFixed(3)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, det = lerp(0.06, 0, q);
        const R = Math.min(w, h) * 0.34, cx = w / 2, cy = h / 2;
        // Four base ratios (2:3 lateral, 2:3 rotary is the classic rich figure); the second
        // term on each axis carries the detune so σ opens/closes the curve. Precession from
        // _t drifts every phase, so the whole figure turns slowly and never lands twice.
        const pr = this._t * 0.18;
        const fx1 = 2, fx2 = 3 + det, fy1 = 3, fy2 = 2 + det * 1.3;
        const d1 = 0.005, d2 = 0.011;                      // two decay rates = depth
        // "Unwrap": a slow breath opens the trace length from a tight knot to a loose
        // figure and back, so she is never a dense static ball. This is the small-scale
        // preview of the time-scale mechanic (ROADMAP A) — swap _t for a developDuration
        // phase and the same unwrap plays over 8 hours instead of ~40s.
        const openBreath = 0.5 + 0.5 * Math.sin(this._t * 0.05);   // 0..1, slow
        const span = lerp(34, 58, openBreath);                     // fewer windings = more open
        const pt = (u, lead) => {
          const t = u * span, e1 = Math.exp(-d1 * t), e2 = Math.exp(-d2 * t);
          const x = cx + (Math.sin(fx1 * t + pr) * e1 + Math.sin(fx2 * t + 1.7 + lead) * e2) * 0.5 * R;
          const y = cy + (Math.sin(fy1 * t + 0.6 - pr) * e1 + Math.sin(fy2 * t + 1.1 + lead) * e2) * 0.5 * R;
          return [x, y];
        };
        // Older, wider pass underneath — the ink that has "dried".
        ctx.lineWidth = 2.2;
        strokeRamp(ctx, c, 0.16 * opts.alpha, u => pt(u, 0.9), 90, this._t * 0.015, 30);
        // Bright recent pass on top; colour walks the ramp with the damping, as before.
        ctx.lineWidth = 1.1;
        strokeRamp(ctx, c, 0.5 * opts.alpha, u => pt(u, 0), 96, this._t * 0.024, 30);
        endFrame(ctx);
      }
    });
  }

  // 3. Rose curve r=cos(kθ) — k drifts irrational → integer, petals snap to n-fold
  function rose() {
    return base({
      title: "Rose curve", _t: 0,
      _f(q) { return `r = cos(${lerp(3.38, 4, q).toFixed(2)}·θ)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, k = lerp(3.38, 4, q), c = opts.color;
        const R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2, spin = this._t * lerp(0.4, 0.05, q);
        ctx.lineWidth = 1.4;
        // Swept in coloured segments rather than as one path: the curve walks the ramp
        // as it winds, so successive petals land on different roles. SEG is a cost/benefit
        // pick — one stroke per sample would be ~5000 draw calls a frame.
        const end = (q > 0.98) ? TAU : TAU * 8, SEG = 72, step = end / SEG;
        const drift = this._t * 0.03;
        for (let s = 0; s < SEG; s++) {
          ctx.strokeStyle = rgba(colorOfN(c, s, SEG, drift), 0.5 * opts.alpha);
          ctx.beginPath();
          // +1 sample of overlap, otherwise the segments show as dashes.
          for (let j = 0; j <= 1; j += 0.02) {
            const th = (s + j) * step;
            const r = Math.cos(k * th) * R, x = cx + r * Math.cos(th + spin), y = cy + r * Math.sin(th + spin);
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 4. Roots of unity — scattered points spiral onto the unit n-gon
  function rootsOfUnity() {
    const n = 9, seed = [];
    for (let i = 0; i < n; i++) seed.push({ a: Math.sin(i * 12.9898) * 43758.5453 % 1, r: 0.3 + (Math.cos(i * 4.1) * 0.5 + 0.5) * 0.7 });
    return base({
      title: "Roots of unity", n,
      _f(q) { return `zⁿ = 1,  n = ${n}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, R = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
        const pts = [];
        for (let i = 0; i < n; i++) {
          const exact = (i / n) * TAU, chaosAng = exact + seed[i].a * 3, ang = lerp(chaosAng, exact, q);
          const rad = lerp(seed[i].r, 1, q) * R;
          pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
        }
        // Each edge takes its own root's colour, so the n-gon is drawn as n segments
        // rather than one path — the polygon itself carries the scheme round the circle.
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], nx = pts[(i + 1) % pts.length];
          ctx.strokeStyle = rgba(colorOfN(c, i, n), 0.3 * q * opts.alpha);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx.x, nx.y); ctx.stroke();
        }
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], pc = colorOfN(c, i, n);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
          g.addColorStop(0, rgba(pc, 0.9 * opts.alpha)); g.addColorStop(1, rgba(pc, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill();
        }
        endFrame(ctx);
      }
    });
  }

  // 5. Phyllotaxis — golden angle; off-angle moiré chaos → perfect sunflower packing
  function phyllotaxis() {
    return base({
      title: "Phyllotaxis", N: 620,
      _f(q) { return `θ = n · ${lerp(131.2, 137.5, q).toFixed(1)}°`; },
      draw(ctx, w, h, dt, opts) {
        if (opts.fade > 0) { ctx.fillStyle = `rgba(4,5,10,${Math.min(1, opts.fade * 3)})`; ctx.fillRect(0, 0, w, h); }
        ctx.globalCompositeOperation = "lighter";
        // A CONTRIBUTED spiral pins its own angle (and optionally seed count) through
        // opts.params — the guest's discovered value literally becomes the flower on the
        // wall. With no params this is the σ-driven exhibit, byte for byte as before: off-angle
        // moiré at chaos, the golden 137.5° packing at order. This is the one parameter
        // channel the "becomes real" loop needs; only THIS exhibit reads it.
        const p = opts.params || null;
        const q = this.q;
        const angDeg = (p && p.angleDeg != null) ? p.angleDeg : lerp(131.2, 137.507, q);
        const ang = angDeg * Math.PI / 180, c = opts.color;
        const N = (p && p.N) ? p.N : this.N;
        const cx = w / 2, cy = h / 2, scale = Math.min(w, h) * 0.02;
        this._ct = (this._ct || 0) + dt;
        const drift = this._ct * 0.05;              // colour creeps outward through the seeds
        for (let i = 0; i < N; i++) {
          const r = scale * Math.sqrt(i), a = i * ang, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          const s = lerp(0.15, 0.5, q);
          // Seed index → ramp position: the scheme reads as rings travelling out from
          // the centre, which is the same gesture the lamps make screen→corners.
          ctx.fillStyle = rgba(colorOfN(c, i, N, drift), (0.25 + 0.5 * s) * opts.alpha);
          ctx.beginPath(); ctx.arc(x, y, 1.6 + q * 1.2, 0, TAU); ctx.fill();
        }
        endFrame(ctx);
      }
    });
  }

  // generic strange-attractor exhibit (Clifford / De Jong / Hopalong share this)
  function attractor(title, formulaFn, chaosP, symP, iterFn) {
    return base({
      title, x: 0.1, y: 0.1, _f: formulaFn,
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.24;
        const P = chaosP.map((v, i) => lerp(v, symP[i], q));
        this._ct = (this._ct || 0) + dt;
        for (let i = 0; i < 900; i++) {
          const n = iterFn(this.x, this.y, P); this.x = n[0]; this.y = n[1];
          const px = cx + this.x * S, py = cy + this.y * S;
          // Coloured by distance from the centre: the attractor's lobes and its dense
          // core end up in different roles, so the STRUCTURE is what carries the scheme.
          // (Colouring by iteration index instead would just strobe — successive points
          // jump all over the figure.)
          const rr = Math.hypot(this.x, this.y) / 2.4;
          ctx.fillStyle = rgba(colorAtU(c, rr, this._ct * 0.03), (0.05 + 0.06 * q) * opts.alpha);
          ctx.fillRect(px, py, 1.2, 1.2);
        }
        endFrame(ctx);
      }
    });
  }
  // 6. Clifford
  function clifford() {
    return attractor("Clifford attractor",
      q => `xₙ₊₁=sin(a·y)+c·cos(a·x)`,
      [-1.7, 1.8, -1.9, -0.4], [-1.4, -2.0, 1.0, 0.7],
      (x, y, P) => [Math.sin(P[0] * y) + P[2] * Math.cos(P[0] * x), Math.sin(P[1] * x) + P[3] * Math.cos(P[1] * y)]);
  }
  // 7. De Jong
  function deJong() {
    return attractor("De Jong attractor",
      q => `xₙ₊₁=sin(a·y)−cos(b·x)`,
      [-2.7, -0.1, -1.9, 2.0], [1.641, 1.902, 0.316, 1.525],
      (x, y, P) => [Math.sin(P[0] * y) - Math.cos(P[1] * x), Math.sin(P[2] * x) - Math.cos(P[3] * y)]);
  }
  // 8. Hopalong (Barry Martin)
  function hopalong() {
    return base({
      title: "Hopalong", x: 0, y: 0,
      _f(q) { return `xₙ₊₁ = yₙ − sgn(x)·√|b·x−c|`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.018;
        const a = lerp(0.4, 2.0, q), b = lerp(1.1, 1.0, q), cc = lerp(0.3, 0.0, q);
        for (let i = 0; i < 1400; i++) {
          const xx = this.y - Math.sign(this.x) * Math.sqrt(Math.abs(b * this.x - cc));
          const yy = a - this.x; this.x = xx; this.y = yy;
          // The orbit walks the scheme as it is drawn. One colour per 128-point band,
          // not per point: 1400 fillStyle changes a frame is the cost of a repaint.
          if ((i & 127) === 0) ctx.fillStyle = rgba(colorOfN(c, i, 1400, this._t * 0.02), 0.06 * opts.alpha);
          ctx.fillRect(cx + this.x * S, cy + this.y * S, 1, 1);
        }
        endFrame(ctx);
      }
    });
  }

  // 9. Superformula (Gielis) — organic blob → n-fold star as m locks to integer
  function superformula() {
    return base({
      title: "Superformula", _t: 0,
      _f(q) { return `r(θ) = f(m=${lerp(5.4, 6, q).toFixed(2)}, n₁, n₂, n₃)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, m = lerp(5.4, 6, q), n1 = lerp(0.3, 1.0, q), n2 = 1.7, n3 = 1.7, c = opts.color;
        const R = Math.min(w, h) * 0.34, cx = w / 2, cy = h / 2, spin = this._t * lerp(0.35, 0.05, q);
        ctx.lineWidth = 1.6;
        // One colour per lobe-ish slice of the outline, so the n-fold star's arms differ.
        strokeRamp(ctx, c, 0.55 * opts.alpha, u => {
          const th = u * TAU;
          const t1 = Math.pow(Math.abs(Math.cos(m * th / 4)), n2);
          const t2 = Math.pow(Math.abs(Math.sin(m * th / 4)), n3);
          const r = Math.pow(t1 + t2, -1 / n1) * R * 0.5;
          return [cx + r * Math.cos(th + spin), cy + r * Math.sin(th + spin)];
        }, 72, this._t * 0.03);
        endFrame(ctx);
      }
    });
  }

  // 10. Chladni plate — standing waves; detuned frequencies → integer (m,n) nodal lattice
  function chladni() {
    return base({
      title: "Chladni plate", grid: 46,
      _f(q) { const m = lerp(3.3, 3, q).toFixed(2), n = lerp(4.4, 4, q).toFixed(2); return `cos(mπx)cos(nπy) − cos(nπx)cos(mπy),  m=${m} n=${n}`; },
      draw(ctx, w, h, dt, opts) {
        if (opts.fade > 0) { ctx.fillStyle = `rgba(4,5,10,${Math.min(1, opts.fade * 4)})`; ctx.fillRect(0, 0, w, h); }
        const q = this.q, m = lerp(3.3, 3, q), n = lerp(4.4, 4, q), c = opts.color;
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42, g = this.grid, step = (R * 2) / g;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i <= g; i++) for (let j = 0; j <= g; j++) {
          const x = (i / g) * 2 - 1, y = (j / g) * 2 - 1;
          const f = Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
          if (Math.abs(f) < 0.14) {
            // Nodal cells coloured by radius — the standing wave's rings pick up
            // successive palette roles as they spread outward from the plate centre.
            const rr = Math.hypot(x, y) / 1.414;
            ctx.fillStyle = rgba(colorAtU(c, rr, this._t * 0.04), (0.35 + 0.5 * q) * opts.alpha);
            ctx.fillRect(cx + x * R - step / 2, cy + y * R - step / 2, step, step);
          }
        }
        endFrame(ctx);
      }
    });
  }

  function isPrime(n) { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true; }

  // 11. Ulam spiral — integers walked on a square spiral, primes igniting. ANIMATED: a
  //     comet head winds the spiral outward over ~16 s, laying a dim trail and lighting
  //     primes as it passes, then loops. Watching it drawn is what reveals the diagonal
  //     prime streaks (prime-rich quadratics like n²+n+41). σ held mid — contemplative.
  function primeSpiral() {
    return base({
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      // K., live, 2026-07-25: "the zooming on it can be a bit weird… it warps the
      // field a little." Right, and for the same reason the automaton and the
      // escape-time exhibits already carry this: the picture IS a fixed grid of
      // integers, so magnifying the middle bends a lattice that only means anything
      // straight. The dive skips it now.
      noZoom: true,
      title: "Ulam spiral", _t: 0,
      _f(q) { return `n ↦ square-spiral walk · primes ignite`; },
      draw(ctx, w, h, dt, opts) {
        this.q = 0.5;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        const c = opts.color, cx = w / 2, cy = h / 2, cell = 6, maxR = Math.min(w, h) / 2 - 14;
        const span = Math.floor(maxR / cell) * 2, maxCells = span * span;
        const reveal = Math.max(2, Math.floor(((this._t % 16) / 16) * maxCells));
        let x = 0, y = 0, dx = 1, dy = 0, legLen = 1, legStep = 0, legs = 0, nn = 1, hx = cx, hy = cy;
        const primes = [];
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = rgba(c, 0.16 * opts.alpha); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let k = 0; k < reveal; k++) {
          const px = cx + x * cell, py = cy + y * cell;
          ctx.lineTo(px, py); hx = px; hy = py;
          if (isPrime(nn)) primes.push(px, py);
          x += dx; y += dy;
          if (++legStep === legLen) { legStep = 0; const t = dx; dx = -dy; dy = t; if (++legs === 2) { legs = 0; legLen++; } }
          nn++;
          if (Math.max(Math.abs(x), Math.abs(y)) * cell > maxR) break;
        }
        ctx.stroke();
        // Primes coloured by how far along the walk they were found, so the diagonal
        // streaks read as bands of colour instead of one flat field of dots.
        const PB = 14, pper = Math.max(1, Math.ceil(primes.length / 2 / PB));
        for (let i = 0; i < primes.length; i += 2) {
          const pi = i / 2;
          if (pi % pper === 0) ctx.fillStyle = rgba(colorOfN(c, (pi / pper) | 0, PB, this._t * 0.02), 0.85 * opts.alpha);
          ctx.fillRect(primes[i] - 1.2, primes[i + 1] - 1.2, 2.6, 2.6);
        }
        /* THE SERPENT — K., live, 2026-07-25: "what I would add is more diagonal
           lighting up, make the snake go around like that but at the same time have
           another comet trail that bounces over all the already revealed primes in a
           serpenty way."

           A second head, running over the primes ALREADY FOUND, in the order they were
           found. That order is the point: consecutive primes sit far apart on a square
           spiral, so joining them hop by hop throws long diagonal chords across the
           field — which is exactly the structure (prime-rich quadratics like n²+n+41)
           that the still picture only hints at. It laps faster than the discovery comet,
           so the two are never in step and the field keeps re-lighting behind the sweep.

           It draws only over `primes`, so it can never run ahead of what has been
           revealed — the serpent cannot spoil the comet. */
        const np = primes.length / 2;
        if (np > 6) {
          const TAIL = 18;                                   // segments of the snake
          const head = (this._t * 7) % np;                   // ~7 primes a second
          for (let s = 0; s < TAIL; s++) {
            const a0 = (Math.floor(head) - s + np * 2) % np;
            const a1 = (a0 + 1) % np;
            if (a1 < a0 && a1 === 0) continue;               // don't wrap the last to the first
            const fade = 1 - s / TAIL;
            ctx.strokeStyle = rgba(colorOfN(c, s, TAIL, this._t * 0.05), 0.5 * fade * fade * opts.alpha);
            ctx.lineWidth = 0.7 + 1.8 * fade;
            ctx.beginPath();
            ctx.moveTo(primes[a0 * 2], primes[a0 * 2 + 1]);
            ctx.lineTo(primes[a1 * 2], primes[a1 * 2 + 1]);
            ctx.stroke();
          }
          // …and its own bright head, so the eye has something to follow rather than a
          // line that merely exists.
          const si = Math.floor(head) % np;
          const sx = primes[si * 2], sy = primes[si * 2 + 1];
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
          sg.addColorStop(0, rgba(colorOfN(c, 0, TAIL, this._t * 0.05), 0.9 * opts.alpha));
          sg.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = sg; ctx.fillRect(sx - 9, sy - 9, 18, 18);
        }

        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 11);  // comet head
        g.addColorStop(0, rgba(c, 0.95 * opts.alpha)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(hx - 11, hy - 11, 22, 22);
        endFrame(ctx);
      }
    });
  }

  // 11b. Sacks spiral — the Archimedean cousin of Ulam: integer n at radius √n, angle
  //      2π√n (one perfect square per turn). Unlike Ulam's square grid, this genuinely
  //      spirals, and it "joins Ulam's broken diagonals into continuous arcs" — prime-rich
  //      polynomials appear as smooth curves. Same animated comet march + slow rotation.
  function sacksSpiral() {
    return base({
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Sacks spiral", _t: 0,
      _f(q) { return `n at (√n, 2π√n) · polynomials → arcs`; },
      draw(ctx, w, h, dt, opts) {
        this.q = 0.5;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        const c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
        const maxN = 2600, s = R / Math.sqrt(maxN), spin = this._t * 0.05;
        const LUT = rampLUT(c, 32, this._t * 0.02);      // per FRAME, not per point
        const reveal = Math.max(4, Math.floor(((this._t % 16) / 16) * maxN));
        let hx = cx, hy = cy;
        ctx.globalCompositeOperation = "lighter";
        for (let n = 1; n <= reveal; n++) {
          const rt = Math.sqrt(n), r = rt * s, ang = TAU * rt + spin;
          const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
          // Coloured by radius: each turn of the spiral arrives in the next role.
          if (isPrime(n)) {
            ctx.fillStyle = rgba(LUT.pick(rt / Math.sqrt(maxN)), 0.85 * opts.alpha);
            ctx.fillRect(px - 1, py - 1, 2.4, 2.4);
          }
          else { ctx.fillStyle = rgba({ r: 90, g: 100, b: 130 }, 0.09 * opts.alpha); ctx.fillRect(px, py, 1, 1); }
          hx = px; hy = py;
        }
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 11);
        g.addColorStop(0, rgba(c, 0.95 * opts.alpha)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(hx - 11, hy - 11, 22, 22);
        endFrame(ctx);
      }
    });
  }

  // 12. Maurer rose — a rose sampled at fixed degree steps, walked as one path.
  //     Non-integer petal count → drifting asymmetric web; integer → clean n-fold weave.
  function maurerRose() {
    return base({
      title: "Maurer rose",
      _f(q) { return `r = cos(${lerp(5.55, 6, q).toFixed(2)}·θ),  step 29°`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, n = lerp(5.55, 6, q), c = opts.color;
        const R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2, spin = this._t * lerp(0.3, 0.04, q);
        const d = 29 * Math.PI / 180;
        ctx.lineWidth = 1;
        // The walk is 360 straight hops; colouring along it makes the weave's own
        // traversal order visible, which is the thing a Maurer rose is actually about.
        strokeRamp(ctx, c, 0.4 * opts.alpha, u => {
          const th = u * 360 * d, r = Math.cos(n * th) * R;
          return [cx + r * Math.cos(th + spin), cy + r * Math.sin(th + spin)];
        }, 60, this._t * 0.025, 12);
        endFrame(ctx);
      }
    });
  }

  // 13. Times-table cardioid — N points on a circle, each i joined to (k·i mod N).
  //     Fractional k → smeared envelope; k→2 draws a crisp cardioid caustic.
  function timesTable() {
    return base({
      title: "Times-table cardioid",
      _f(q) { return `i ↦ ${lerp(2.5, 2, q).toFixed(2)}·i  (mod N)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, mult = lerp(2.5, 2, q), c = opts.color, N = 220;
        const R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2, spin = this._t * lerp(0.25, 0.03, q);
        ctx.lineWidth = 0.8;
        // 220 chords batched into bands round the circle — the cardioid caustic is an
        // envelope of these lines, so banding them makes the envelope's structure read.
        const BANDS = 40, per = Math.ceil(N / BANDS);
        for (let b = 0; b < BANDS; b++) {
          ctx.strokeStyle = rgba(colorOfN(c, b, BANDS, this._t * 0.03), 0.16 * opts.alpha);
          ctx.beginPath();
          for (let i = b * per; i < Math.min(N, (b + 1) * per); i++) {
            const a1 = (i / N) * TAU + spin, a2 = ((mult * i) / N) * TAU + spin;
            ctx.moveTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
            ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
          }
          ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 14. Spirograph (hypotrochoid) — a point on a circle rolling inside another.
  //     Irrational ratio never closes (fills an annulus); integer ratio locks a rosette.
  function spirograph() {
    return base({
      title: "Spirograph",
      _f(q) { return `hypotrochoid, ratio → ${lerp(4.42, 5, q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, p = lerp(4.42, 5, q), c = opts.color;
        const R = Math.min(w, h) * 0.22, cx = w / 2, cy = h / 2, spin = this._t * lerp(0.3, 0.04, q);
        ctx.lineWidth = 1.3;
        const end = (q > 0.98) ? TAU : TAU * 18;   // integer ratio closes after one turn
        strokeRamp(ctx, c, 0.5 * opts.alpha, u => {
          const t = u * end;
          return [cx + (Math.cos(t + spin) + Math.cos(p * t) / 1.7) * R,
                  cy + (Math.sin(t + spin) + Math.sin(p * t) / 1.7) * R];
        }, 72, this._t * 0.03, 26);
        endFrame(ctx);
      }
    });
  }

  // 15. Star polygon {7/3} — scattered vertices spiral onto a regular heptagram.
  function starPolygon() {
    const P = 7, seed = [];
    for (let i = 0; i < P; i++) seed.push(Math.sin(i * 78.233) * 43758.5453 % 1);
    return base({
      title: "Star polygon", P,
      _f(q) { return `{7/${lerp(2.6, 3, q).toFixed(1)}}  heptagram`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2;
        const spin = this._t * lerp(0.3, 0.04, q), stride = lerp(2.6, 3, q), pts = [];
        for (let i = 0; i < P; i++) {
          const exact = (i / P) * TAU, ang = exact + seed[i] * 1.6 * (1 - q) + spin;
          const rad = lerp(0.6 + seed[i] * 0.4, 1, q) * R;
          pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
        }
        // One chord per step of the stride, each in its own colour — the star is drawn
        // by a line that changes hue as it hops, so the {7/3} weave is legible as colour.
        ctx.lineWidth = 1.4;
        for (let k = 0; k < P; k++) {
          const p = pts[Math.round(k * stride) % P], n = pts[Math.round((k + 1) * stride) % P];
          ctx.strokeStyle = rgba(colorOfN(c, k, P), 0.55 * opts.alpha);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke();
        }
        for (let i = 0; i < pts.length; i++) {
          ctx.fillStyle = rgba(colorOfN(c, i, P), 0.8 * opts.alpha);
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 3 + q * 2, 0, TAU); ctx.fill();
        }
        endFrame(ctx);
      }
    });
  }

  // 16. Cellular automaton — a 1D universe rebuilt from a single seed cell each frame.
  //     Per cell, σ is the probability it obeys Rule 90 (draws the Sierpiński triangle)
  //     instead of Rule 30 (pseudo-random noise). Chaos literally reorganises into a
  //     fractal as order rises — the house teaching itself a rule.
  function cellular() {
    return base({
      noZoom: true,  // grid-locked — zooming crops the grid and the pattern stops being the pattern
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Cellular automaton", cell: 5,
      _f(q) { return `Rule 30 → Rule 90 (Sierpiński) · ${(q * 100) | 0}% ordered`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, cs = this.cell, c = opts.color;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        const cols = Math.floor(w / cs), rows = Math.floor(h / cs);
        let row = new Uint8Array(cols); row[cols >> 1] = 1;
        // One colour per generation, so the Sierpinski triangle is built out of the
        // whole scheme top to bottom rather than in one flat tone.
        for (let r = 0; r < rows; r++) {
          ctx.fillStyle = rgba(colorAtU(c, r / rows, this._t * 0.03), (0.45 + 0.45 * q) * opts.alpha);
          for (let i = 0; i < cols; i++) if (row[i]) ctx.fillRect(i * cs, r * cs, cs - 0.6, cs - 0.6);
          const nxt = new Uint8Array(cols);
          for (let i = 0; i < cols; i++) {
            const idx = (row[(i - 1 + cols) % cols] << 2) | (row[i] << 1) | row[(i + 1) % cols];
            const rule = hash2(r, i) < q ? 90 : 30;
            nxt[i] = (rule >> idx) & 1;
          }
          row = nxt;
        }
      }
    });
  }

  // 17. Flocking (boids) — 70 agents on three local rules. Chaos: they wander and jitter.
  //     Order: alignment/cohesion strengthen and a shared centripetal pull forms one
  //     rotating mill — global symmetry with no leader. (The house as a crowd finding itself.)
  function boids() {
    const N = 70; let P = null;
    return base({
      title: "Flocking",
      _f(q) { return `${N} agents · local rules → one mill`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
        if (!P) { P = []; for (let i = 0; i < N; i++) P.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 }); }
        const speed = lerp(28, 66, q), D = Math.min(0.05, dt);
        for (const b of P) {
          let avx = 0, avy = 0, mx = 0, my = 0, sx = 0, sy = 0, cnt = 0;
          for (const o of P) {
            if (o === b) continue;
            const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 < 14400) { avx += o.vx; avy += o.vy; mx += o.x; my += o.y; cnt++; if (d2 < 1024) { sx -= dx; sy -= dy; } }
          }
          if (cnt) { avx /= cnt; avy /= cnt; mx /= cnt; my /= cnt; b.vx += ((avx - b.vx) * 0.05 + (mx - b.x) * 0.001) * q; b.vy += ((avy - b.vy) * 0.05 + (my - b.y) * 0.001) * q; }
          b.vx += sx * 0.02; b.vy += sy * 0.02;
          const rx = b.x - cx, ry = b.y - cy, rl = Math.hypot(rx, ry) || 1;
          b.vx += (-ry / rl) * q * 26 * D - (rl - R) * (rx / rl) * q * 0.5 * D;
          b.vy += (rx / rl) * q * 26 * D - (rl - R) * (ry / rl) * q * 0.5 * D;
          b.vx += (Math.random() - 0.5) * (1 - q) * 70 * D; b.vy += (Math.random() - 0.5) * (1 - q) * 70 * D;
          const s = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / s * speed; b.vy = b.vy / s * speed;
          b.x += b.vx * D; b.y += b.vy * D;
          if (b.x < 0) b.x += w; else if (b.x > w) b.x -= w; if (b.y < 0) b.y += h; else if (b.y > h) b.y -= h;
        }
        // Per-bird colour: the flock carries the whole scheme, and because each bird keeps
        // its own role you can actually see the flock mix as it forms and breaks up.
        ctx.lineWidth = 1;
        for (let i = 0; i < P.length; i++) {
          const b = P[i], bc = colorOfN(c, i, P.length);
          ctx.strokeStyle = rgba(bc, 0.22 * opts.alpha);
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.07, b.y - b.vy * 0.07); ctx.stroke();
          ctx.fillStyle = rgba(bc, 0.75 * opts.alpha);
          ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, TAU); ctx.fill();
        }
        endFrame(ctx);
      }
    });
  }

  // 18. Game of Life — Conway's B3/S23 on a torus, seeded with a 4-fold mirror-symmetric
  //     soup. Life is isotropic, so a symmetric seed stays symmetric forever: it breathes
  //     as oscillators without ever breaking symmetry. σ tunes seed density (turbulent → calm).
  function life() {
    const G = 64; let grid = null, buf = null, acc = 0, age = 0;
    function seed(q) {
      grid = new Uint8Array(G * G); const d = lerp(0.30, 0.13, q), H = G >> 1;
      for (let j = 0; j < H; j++) for (let i = 0; i < H; i++) if (Math.random() < d) {
        grid[j * G + i] = 1; grid[j * G + (G - 1 - i)] = 1; grid[(G - 1 - j) * G + i] = 1; grid[(G - 1 - j) * G + (G - 1 - i)] = 1;
      }
    }
    return base({
      noZoom: true,  // grid-locked — zooming crops the grid and the pattern stops being the pattern
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Game of Life",
      _f(q) { return `B3/S23 · 4-fold symmetric soup`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color;
        if (!grid) seed(q);
        acc += dt; age += dt;
        if (acc > 0.11) {
          acc = 0; buf = buf || new Uint8Array(G * G); let pop = 0;
          for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
            let n = 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; n += grid[((j + dj + G) % G) * G + ((i + di + G) % G)]; }
            const a = grid[j * G + i], nv = (a && (n === 2 || n === 3)) || (!a && n === 3) ? 1 : 0; buf[j * G + i] = nv; pop += nv;
          }
          const t = grid; grid = buf; buf = t;
          if (pop < 8 || age > 15) { age = 0; seed(q); }
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        const cs = Math.min(w, h) / G * 0.92, ox = (w - cs * G) / 2, oy = (h - cs * G) / 2;
        // Colour by row — a glider crossing the grid changes colour as it travels.
        for (let j = 0; j < G; j++) {
          ctx.fillStyle = rgba(colorAtU(c, j / G, this._t * 0.02), (0.5 + 0.4 * q) * opts.alpha);
          for (let i = 0; i < G; i++) if (grid[j * G + i]) ctx.fillRect(ox + i * cs, oy + j * cs, cs - 0.6, cs - 0.6);
        }
      }
    });
  }

  // 19. Lorenz attractor — deterministic chaos with a hidden two-lobed symmetry. σ pulls
  //     out injected jitter so the butterfly's bilateral form condenses out of the fog.
  function lorenz() {
    let x = 0.1, y = 0, z = 0;
    return base({
      title: "Lorenz attractor",
      _f(q) { return `ẋ=σ(y−x)  ẏ=x(ρ−z)−y  ż=xy−βz`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h * 0.58, S = Math.min(w, h) * 0.017;
        const sg = 10, rho = 28, be = 8 / 3, jit = (1 - q) * 7;
        this._ct = (this._ct || 0) + dt;
        for (let k = 0; k < 16; k++) {
          const dh = 0.006;
          x += sg * (y - x) * dh; y += (x * (rho - z) - y) * dh; z += (x * y - be * z) * dh;
          const px = cx + (x + (Math.random() - 0.5) * jit) * S, py = cy - (z - 27 + (Math.random() - 0.5) * jit) * S;
          // Coloured by HEIGHT (z): the butterfly's two lobes sit at different z bands,
          // so the bilateral form the exhibit is about is exactly what the palette marks.
          ctx.fillStyle = rgba(colorAtU(c, (z - 5) / 40, this._ct * 0.03), 0.5 * opts.alpha);
          ctx.fillRect(px, py, 1.3, 1.3);
        }
        endFrame(ctx);
      }
    });
  }

  // 20. Truchet tiles — each cell draws one of two arc pairs. Chaos: orientation is random
  //     (a maze). Order: each tile aligns to a smooth angular field, so the arcs join into
  //     coherent flowing loops across the whole plane.
  function truchet() {
    return base({
      noZoom: true,  // grid-locked — zooming crops the grid and the pattern stops being the pattern
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Truchet tiles",
      _f(q) { return `random arcs → aligned weave`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color, cs = Math.min(w, h) / 12;
        const rows = Math.ceil(h / cs) + 1, cols = Math.ceil(w / cs) + 1, spin = this._t * 0.1;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = Math.max(1.5, cs * 0.09);
        const HP = Math.PI / 2;
        const diagN = rows + cols;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const x = i * cs, y = j * cs;
          const field = Math.sin(Math.atan2(j - rows / 2, i - cols / 2) * 2 + spin) > 0 ? 1 : 0;
          const orient = hash2(i, j) < q ? field : (hash2(i, j) < 0.5 ? 1 : 0);
          // Coloured along the DIAGONAL, so the scheme sweeps across the weave as a
          // band rather than colouring each tile independently (which reads as noise).
          ctx.strokeStyle = rgba(colorOfN(c, i + j, diagN, this._t * 0.03), 0.6 * opts.alpha);
          ctx.beginPath();
          if (orient) { ctx.arc(x, y, cs / 2, 0, HP); ctx.moveTo(x + cs, y + cs); ctx.arc(x + cs, y + cs, cs / 2, Math.PI, Math.PI * 1.5); }
          else { ctx.arc(x + cs, y, cs / 2, HP, Math.PI); ctx.moveTo(x, y + cs); ctx.arc(x, y + cs, cs / 2, Math.PI * 1.5, TAU); }
          ctx.stroke();
        }
      }
    });
  }

  // 21. Julia set — zₙ₊₁ = zₙ² + c, escape-time. c travels from a value giving disconnected
  //     "dust" (chaos) to a connected, 180°-symmetric Julia (order). The plane itself sets.
  function julia() {
    return base({
      noZoom: true,  // per-pixel escape-time at a fixed scale — magnifies pixels, not detail
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Julia set", cell: 6,
      _f(q) { return `zₙ₊₁ = zₙ² + c · dust → connected`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color, cs = this.cell;
        ctx.globalCompositeOperation = "source-over";
        const T = smoothField(this, w, h, cs) || ctx;
        const cr = lerp(0.37, -0.8, q), ci = lerp(0.32, 0.156, q), maxI = Math.floor(lerp(18, 44, q));
        const LUT = rampLUT(c, 48, this._t * 0.02);      // per FRAME, not per cell
        const scale = 3.0 / Math.min(w, h);
        for (let py = 0; py < h; py += cs) for (let px = 0; px < w; px += cs) {
          let zx = (px - w / 2) * scale, zy = (py - h / 2) * scale, i = 0;
          for (; i < maxI; i++) { const xt = zx * zx - zy * zy + cr; zy = 2 * zx * zy + ci; zx = xt; if (zx * zx + zy * zy > 4) break; }
          // Escape time IS a colour coordinate: the halo bands by how long each point
          // took to leave, which is exactly the structure the set is about.
          if (i === maxI) T.fillStyle = rgba(LUT.pick(1), 0.9 * opts.alpha);
          else if (i > 1) T.fillStyle = rgba(LUT.pick(i / maxI), 0.11 * (i / maxI) * opts.alpha);
          else { T.fillStyle = "#04050a"; }
          T.fillRect(px, py, cs, cs);
        }
        if (T !== ctx) T.flush(ctx);
      }
    });
  }

  // 22. Moiré interference — two concentric ring gratings beat against each other.
  //     Chaos: the centres are split and the second grating is detuned, so hyperbolic
  //     interference fringes sweep the field. As σ rises the centres slide together and
  //     the frequencies lock — the beat vanishes into one clean concentric bullseye.
  //     (Playbook §1.18 / Table B: Woah 8 at Cost 2, pure 2D canvas.)
  function moire() {
    return base({
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Moiré interference", cell: 5, _t: 0,
      _f(q) { return `cos(k·r₁)·cos(${lerp(1.14, 1, q).toFixed(2)}·k·r₂),  Δ→0`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color, cs = this.cell;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h);
        const k = 0.16;                              // ring frequency
        const off = lerp(Math.min(w, h) * 0.16, 0, q); // centre separation shrinks to 0
        const kr = lerp(1.14, 1, q);                 // second grating detune → match
        const spin = this._t * lerp(0.25, 0.03, q);  // the split centre orbits, slowing as it locks
        const ax = w / 2 - off, ay = h / 2;
        const bx = w / 2 + off * Math.cos(spin), by = h / 2 + off * Math.sin(spin);
        ctx.globalCompositeOperation = "lighter";
        const LUT = rampLUT(c, 48, this._t * 0.03);      // per FRAME, not per cell
        for (let py = 0; py < h; py += cs) for (let px = 0; px < w; px += cs) {
          const r1 = Math.hypot(px - ax, py - ay), r2 = Math.hypot(px - bx, py - by);
          const v = Math.cos(r1 * k) * Math.cos(r2 * k * kr);   // moiré product ∈ [−1,1]
          const a = (v > 0 ? v : 0) * (0.25 + 0.45 * q) * opts.alpha;  // bright fringes only
          if (a <= 0.01) continue;
          // Fringe order picks the role, so the beat is legible as colour banding and
          // not only as brightness.
          ctx.fillStyle = rgba(LUT.pick(v), a);
          ctx.fillRect(px, py, cs, cs);
        }
        endFrame(ctx);
      }
    });
  }

  // 23. Mandelbrot set — z→z²+c escape-time. σ eases a DEEP chaotic zoom into the
  //     Seahorse Valley boundary (turbulent asymmetric filaments) OUT to the whole set,
  //     whose bilateral symmetry about the real axis is the "order." A rotating palette
  //     offset makes the contours flow. The hard one (Catalog Cat 5; Woah 10, Cost 8).
  function mandelbrot() {
    return base({
      noZoom: true,  // eases its OWN deep zoom from σ (halfW); a second zoom fights it
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Mandelbrot set", cell: 4, _t: 0,
      _f(q) { return `zₙ₊₁ = zₙ² + c · seahorse → whole set`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color, cs = this.cell;
        ctx.globalCompositeOperation = "source-over";
        const T = smoothField(this, w, h, cs) || ctx;
        const cxp = lerp(-0.745, -0.5, q), cyp = lerp(0.113, 0.0, q);   // seahorse → set centre
        const halfW = lerp(0.018, 1.7, q), halfH = halfW * h / w;       // deep zoom → full view
        const maxI = Math.floor(lerp(150, 70, q));                      // deep detail needs more iters
        const po = this._t * 0.15;                                      // rotating palette → flowing contours
        const LUT = rampLUT(c, 64, po * 0.1);                           // per FRAME, not per cell
        for (let py = 0; py < h; py += cs) for (let px = 0; px < w; px += cs) {
          const x0 = cxp + (px / w * 2 - 1) * halfW, y0 = cyp + (py / h * 2 - 1) * halfH;
          let zx = 0, zy = 0, i = 0;
          for (; i < maxI; i++) { const xt = zx * zx - zy * zy + x0; zy = 2 * zx * zy + y0; zx = xt; if (zx * zx + zy * zy > 4) break; }
          if (i === maxI) { T.fillStyle = "#04050a"; T.fillRect(px, py, cs, cs); continue; }
          const mu = i + 1 - Math.log(Math.log(Math.sqrt(zx * zx + zy * zy)) || 1) / Math.log(2);
          const band = 0.5 + 0.5 * Math.sin(mu * 0.5 + po);             // cyclic contour brightness
          // The contour band already cycles — give it the palette instead of one hue.
          T.fillStyle = rgba(LUT.pick(band), (0.12 + 0.8 * band) * opts.alpha);
          T.fillRect(px, py, cs, cs);
        }
        if (T !== ctx) T.flush(ctx);
      }
    });
  }

  // 24. Logarithmic spiral — scattered points spiral onto ARMS clean r=a·e^{bθ} arms
  //     (a "galaxy") as σ rises: chaos = a smeared cloud, order = crisp equiangular arms.
  function logSpiral() {
    const ARMS = 5, N = 900, seed = [];
    for (let i = 0; i < N; i++) seed.push(hash2(i, 7));
    return base({
      title: "Logarithmic spiral", _t: 0,
      _f(q) { return `r = a·e^{bθ},  ${ARMS} arms lock`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
        const b = 0.18, spin = this._t * lerp(0.5, 0.12, q);
        const ARMC = [];                                  // five arms, five colours, once
        for (let a = 0; a < ARMS; a++) ARMC.push(colorOfN(c, a, ARMS, this._t * 0.03));
        for (let i = 0; i < N; i++) {
          const arm = i % ARMS, tt = (i / N) * 6.0;
          const rr = R * Math.exp(b * (tt - 6.0));                      // equiangular growth outward
          const baseAng = tt + arm * (TAU / ARMS) + spin;
          const ang = baseAng + (seed[i] - 0.5) * 6.0 * (1 - q);        // chaos scatters, order snaps
          const rad = rr * lerp(0.4 + seed[i] * 1.2, 1, q);
          // One role per ARM. Five arms, five colours: the galaxy's structure IS the
          // colour, which is what makes the resolve worth watching.
          ctx.fillStyle = rgba(ARMC[arm], (0.2 + 0.6 * q) * opts.alpha);
          ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 1.6, 1.6);
        }
        endFrame(ctx);
      }
    });
  }

  // 25. Koch snowflake — each segment grows a bump. Chaos: the bump angle is jittered
  //     per segment (a ragged random coastline). Order: every bump locks to exactly 60°,
  //     resolving the true 6-fold-symmetric snowflake. (Catalog Cat 5.)
  function koch() {
    const DEPTH = 4;
    return base({
      title: "Koch snowflake", _t: 0,
      _f(q) { return `bump ∠ → 60°,  depth ${DEPTH}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
        const spin = this._t * lerp(0.3, 0.05, q);
        let pts = [];
        for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3 - Math.PI / 2; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
        pts.push(pts[0]);
        for (let d = 0; d < DEPTH; d++) {
          const np = [];
          for (let i = 0; i < pts.length - 1; i++) {
            const x1 = pts[i][0], y1 = pts[i][1], x2 = pts[i + 1][0], y2 = pts[i + 1][1];
            const dx = (x2 - x1) / 3, dy = (y2 - y1) / 3;
            const ax = x1 + dx, ay = y1 + dy, bx = x1 + 2 * dx, by = y1 + 2 * dy;
            const jitter = (hash2(i, d) - 0.5) * 2.2 * (1 - q);          // random coastline at chaos
            const th = Math.atan2(by - ay, bx - ax) - (Math.PI / 3) * q + jitter;  // → 60° apex at order
            const len = Math.hypot(bx - ax, by - ay);
            np.push([x1, y1], [ax, ay], [ax + Math.cos(th) * len, ay + Math.sin(th) * len], [bx, by]);
          }
          np.push(pts[pts.length - 1]);
          pts = np;
        }
        // Stroked in bands, so the six-fold symmetry shows in colour too: opposite
        // arms of the snowflake land on the same role.
        ctx.lineWidth = 1.2;
        strokeSegments(ctx, c, 0.6 * opts.alpha, pts, 36, this._t * 0.03);
        endFrame(ctx);
      }
    });
  }

  // 26. Newton fractal — Newton's method on z³−1; each pixel colours by which of the 3
  //     roots it converges to. The three basins meet in 3-fold symmetry; σ slows an
  //     injected spin and deepens the iteration so the coarse chaotic basins sharpen.
  function newton() {
    const roots = [[1, 0], [-0.5, 0.8660254], [-0.5, -0.8660254]], shade = [1.0, 0.62, 0.32];
    return base({
      noZoom: true,  // per-pixel escape-time at a fixed scale — magnifies pixels, not detail
      opaque: true,  // repaints the WHOLE frame — can only ever be the bottom overlap layer
      title: "Newton fractal", cell: 5, _t: 0,
      _f(q) { return `z − (z³−1)/3z² · 3 basins`; },
      draw(ctx, w, h, dt, opts) {
        const q = this.q, c = opts.color, cs = this.cell;
        ctx.globalCompositeOperation = "source-over";
        const T = smoothField(this, w, h, cs) || ctx;
        // Widened from 3.0 — K. asked to zoom out, and more of the three-basin
        // structure on screen means more to look at per frame.
        const scale = 4.2 / Math.min(w, h), rot = this._t * lerp(0.5, 0.05, q);
        const ca = Math.cos(rot), sa = Math.sin(rot), maxI = Math.floor(lerp(9, 26, q));
        const BAS = [0, 1, 2].map(r => colorOfN(c, r, 3, this._t * 0.02));   // per FRAME, not per cell
        for (let py = 0; py < h; py += cs) for (let px = 0; px < w; px += cs) {
          let zx = (px - w / 2) * scale, zy = (py - h / 2) * scale;
          const rx = zx * ca - zy * sa, ry = zx * sa + zy * ca; zx = rx; zy = ry;
          let it = 0, root = -1;
          for (; it < maxI; it++) {
            const x2 = zx * zx - zy * zy, y2 = 2 * zx * zy;      // z²
            const x3 = x2 * zx - y2 * zy, y3 = x2 * zy + y2 * zx; // z³
            const nx = x3 - 1, ny = y3, dx = 3 * x2, dy = 3 * y2, dd = dx * dx + dy * dy || 1e-9;
            zx = zx - (nx * dx + ny * dy) / dd; zy = zy - (ny * dx - nx * dy) / dd;
            for (let r = 0; r < 3; r++) { const ex = zx - roots[r][0], ey = zy - roots[r][1]; if (ex * ex + ey * ey < 1e-4) { root = r; break; } }
            if (root >= 0) break;
          }
          if (root < 0) { T.fillStyle = "#04050a"; T.fillRect(px, py, cs, cs); continue; }
          const bri = lerp(0.25, 0.9, 1 - it / maxI) * shade[root];
          // Colour BY BASIN. Three roots, three roles: the 3-fold symmetry stops being
          // a brightness difference and becomes three colours meeting along the fractal.
          T.fillStyle = rgba(BAS[root], bri * (0.5 + 0.5 * q) * opts.alpha);
          T.fillRect(px, py, cs, cs);
        }
        if (T !== ctx) T.flush(ctx);
      }
    });
  }

  // point-cloud spiral helper: N points ease from a scattered cloud onto an exact curve.
  function spiralCloud(title, formula, radiusFn, seedSalt) {
    const N = 1000, seed = [];
    for (let i = 0; i < N; i++) seed.push(hash2(i, seedSalt));
    return base({
      title, _t: 0, _f: formula,
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.47;
        const spin = this._t * lerp(0.4, 0.05, q);
        const LUT = rampLUT(c, 32, this._t * 0.02);      // per FRAME, not per point
        for (let i = 0; i < N; i++) {
          const rc = radiusFn(i, R); if (!rc) continue;
          const ang = rc.th + spin + (seed[i] - 0.5) * 5.5 * (1 - q);
          const rad = rc.r * lerp(0.4 + seed[i] * 1.1, 1, q);
          // Colour along the curve — the arm shows where it is in its own sweep.
          ctx.fillStyle = rgba(LUT.pick((i + 0.5) / N), (0.22 + 0.55 * q) * opts.alpha);
          ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 1.5, 1.5);
        }
        endFrame(ctx);
      }
    });
  }
  // 27. Fermat spiral r=a√θ — two arms (±), equal area per turn (the phyllotaxis skeleton).
  function fermatSpiral() {
    const A = 1;
    return spiralCloud("Fermat spiral", q => `r = a·√θ  (equal area/turn)`,
      (i, R) => { const th = i * 0.3; return { th: th + (i % 2 ? Math.PI : 0), r: (R / 18) * Math.sqrt(th) }; }, 3);
  }
  // 28. Hyperbolic spiral r=a/θ — winds inward toward an asymptote.
  function hyperbolicSpiral() {
    return spiralCloud("Hyperbolic spiral", q => `r = a/θ  (asymptotic)`,
      (i, R) => { const th = 0.3 + i * 0.05, r = R * 0.5 / th; return r < 2 ? null : { th, r: Math.min(r, R * 1.3) }; }, 5);
  }

  // 29. Euler spiral (Cornu clothoid) — curvature grows linearly with arc length, via the
  //     Fresnel integrals. Its double-S is the highway/rollercoaster transition curve.
  function eulerSpiral() {
    return base({
      title: "Euler spiral", _t: 0,
      _f(q) { return `clothoid · ∫cos(t²), ∫sin(t²)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.85;
        const spin = this._t * lerp(0.3, 0.04, q), steps = 600, ds = 7.2 / steps;
        const pts = []; let fx = 0, fy = 0, s = -3.6;
        for (let i = 0; i < steps; i++) { s += ds; fx += Math.cos(s * s) * ds; fy += Math.sin(s * s) * ds; pts.push([fx, fy]); }
        const mx = pts[steps >> 1][0], my = pts[steps >> 1][1];
        // The clothoid's curvature grows along its length, so colouring along it puts
        // the tight inner coils and the straight middle in different colours.
        ctx.lineWidth = 1.4;
        const path = [];
        for (let i = 0; i < steps; i++) {
          const jr = (hash2(i, 2) - 0.5) * 0.05 * (1 - q) * S;
          const px = (pts[i][0] - mx) * S + jr, py = (pts[i][1] - my) * S + jr;
          const rx = px * Math.cos(spin) - py * Math.sin(spin), ry = px * Math.sin(spin) + py * Math.cos(spin);
          path.push([cx + rx, cy + ry]);
        }
        strokeSegments(ctx, c, 0.5 * opts.alpha, path, 48, this._t * 0.03);
        endFrame(ctx);
      }
    });
  }

  // 30. Spiral of Theodorus — contiguous unit-legged right triangles; hypotenuses √n.
  function theodorus() {
    const N = 42;
    return base({
      title: "Spiral of Theodorus", _t: 0,
      _f(q) { return `√n triangles · hypotenuse = √n`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, U = Math.min(w, h) * 0.05;
        let ang = this._t * lerp(0.3, 0.05, q);
        // One role per triangle, so the sqrt(n) growth is countable by eye.
        ctx.lineWidth = 1.1;
        for (let n = 1; n < N; n++) {
          ang += Math.atan(1 / Math.sqrt(n)) * lerp(0.5 + hash2(n, 1), 1, q);   // jittered angle at chaos → exact
          const r = U * Math.sqrt(n + 1), nx = cx + Math.cos(ang) * r, ny = cy + Math.sin(ang) * r;
          ctx.strokeStyle = rgba(colorOfN(c, n, N, this._t * 0.02), 0.5 * opts.alpha);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();   // spoke
        }
        endFrame(ctx);
      }
    });
  }

  // 31. Heighway dragon — the folded-paper fractal. σ eases the fold angle to a clean 90°.
  function dragon() {
    const ITER = 11, n = 1 << ITER;
    return base({
      title: "Dragon curve", _t: 0,
      _f(q) { return `Heighway dragon · fold ∠ → 90°`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, A = lerp(1.05, Math.PI / 2, q);
        const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
        let x = 0, y = 0, dir = 0, minx = 0, maxx = 0, miny = 0, maxy = 0;
        for (let i = 1; i <= n; i++) {
          const left = (((i & -i) << 1) & i) === 0;
          dir += left ? A : -A; x += Math.cos(dir); y += Math.sin(dir);
          xs[i] = x; ys[i] = y;
          if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
        const sc = Math.min(w * 0.8 / (maxx - minx || 1), h * 0.8 / (maxy - miny || 1));
        const ox = w / 2 - (minx + maxx) / 2 * sc, oy = h / 2 - (miny + maxy) / 2 * sc;
        // The fold order becomes the colour: each self-similar half takes its own
        // role, which is how the recursion shows in a curve that never crosses itself.
        ctx.lineWidth = 1;
        const path = [];
        for (let i = 0; i <= n; i++) path.push([xs[i] * sc + ox, ys[i] * sc + oy]);
        strokeSegments(ctx, c, 0.5 * opts.alpha, path, 64, this._t * 0.02);
        endFrame(ctx);
      }
    });
  }

  // 32. Hilbert curve — a space-filling path. σ dissolves per-vertex jitter so the curve
  //     literally organises itself out of noise into the ordered fill.
  function hilbert() {
    const ORD = 5, n = 1 << ORD, total = n * n;
    function d2xy(d) {
      let rx, ry, x = 0, y = 0, t = d;
      for (let s = 1; s < n; s *= 2) {
        rx = 1 & (t / 2 | 0); ry = 1 & (t ^ rx);
        if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
        x += s * rx; y += s * ry; t = Math.floor(t / 4);
      }
      return [x, y];
    }
    return base({
      title: "Hilbert curve", _t: 0,
      _f(q) { return `space-filling · order ${ORD}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, size = Math.min(w, h) * 0.82, ox = (w - size) / 2, oy = (h - size) / 2, cell = size / n;
        // Colour along the path is the classic way to read a space-filling curve —
        // it shows which part of the square the walk is in at any moment.
        ctx.lineWidth = 1.2;
        const path = [];
        for (let d = 0; d < total; d++) {
          const p = d2xy(d), jr = (hash2(d, 4) - 0.5) * cell * 2.4 * (1 - q);
          path.push([ox + (p[0] + 0.5) * cell + jr, oy + (p[1] + 0.5) * cell + jr]);
        }
        strokeSegments(ctx, c, 0.5 * opts.alpha, path, 64, this._t * 0.02);
        endFrame(ctx);
      }
    });
  }

  // 33. Hypocycloid — a circle rolling inside another; ratio k=R/r → integer closes an
  //     n-cusped astroid/star. Non-integer k smears a dense annular caustic.
  function hypocycloid() {
    return base({
      title: "Hypocycloid", _t: 0,
      _f(q) { return `k = R/r → ${lerp(4.4, 5, q).toFixed(2)} (5 cusps)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
        const k = lerp(4.4, 5, q), spin = this._t * lerp(0.3, 0.04, q);
        // The caustic is many overlapping passes; colouring along the parameter makes
        // each pass a different role, which is what turns the smear into depth.
        ctx.lineWidth = 1.4;
        const end = (q > 0.98) ? TAU : TAU * 12;
        strokeRamp(ctx, c, 0.5 * opts.alpha, u => {
          const t = u * end;
          return [cx + R * ((k - 1) / k * Math.cos(t + spin) + 1 / k * Math.cos((k - 1) * t)),
                  cy + R * ((k - 1) / k * Math.sin(t + spin) - 1 / k * Math.sin((k - 1) * t))];
        }, 60, this._t * 0.03, 26);
        endFrame(ctx);
      }
    });
  }

  // 34. Lemniscate of Bernoulli r²=a²cos(2θ) — the ∞ figure. σ removes an angular wobble
  //     that warps the two lobes at chaos, leaving a clean symmetric figure-eight.
  function lemniscate() {
    return base({
      title: "Lemniscate", _t: 0,
      _f(q) { return `r² = a²·cos(2θ)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
        const spin = this._t * lerp(0.3, 0.05, q), wob = (1 - q) * 0.6;
        // The two lobes take opposite ends of the slice, so the figure-eight's
        // bilateral symmetry is marked by colour as well as by shape. Banded rather
        // than per-sample: one stroke every 24 samples, not 1570 of them.
        ctx.lineWidth = 1.5;
        const STEP = 0.004, BAND = STEP * 24;
        let started = false, since = 0;
        for (let th = 0; th <= TAU; th += STEP) {
          const cc = Math.cos(2 * th + wob * Math.sin(5 * th));
          if (cc < 0) { if (started) { ctx.stroke(); started = false; } continue; }
          const r = R * Math.sqrt(cc), x = cx + r * Math.cos(th + spin), y = cy + r * Math.sin(th + spin);
          if (!started || since >= BAND) {
            if (started) { ctx.lineTo(x, y); ctx.stroke(); }
            ctx.strokeStyle = rgba(colorAtU(c, th / TAU, this._t * 0.03), 0.55 * opts.alpha);
            ctx.beginPath(); ctx.moveTo(x, y); started = true; since = 0;
          } else { ctx.lineTo(x, y); since += STEP; }
        }
        if (started) ctx.stroke();
        endFrame(ctx);
      }
    });
  }

  // 35. Mystic rose — every one of P points on a circle joined to every other (the
  //     complete graph K_P). Scattered vertices spiral onto the regular P-gon.
  function mysticRose() {
    const P = 18, seed = [];
    for (let i = 0; i < P; i++) seed.push(hash2(i, 9));
    return base({
      title: "Mystic rose", P, _t: 0,
      _f(q) { return `K₁₈ · every vertex joined`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
        const spin = this._t * lerp(0.25, 0.03, q), pts = [];
        for (let i = 0; i < P; i++) {
          const ang = (i / P) * TAU + seed[i] * 2 * (1 - q) + spin, rad = lerp(0.5 + seed[i] * 0.6, 1, q) * R;
          pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
        }
        // Chords batched by their ORIGIN vertex — K₁₈ is 153 lines, so one stroke per
        // chord would be 153 draw calls; per-vertex is 18 and reads the same.
        ctx.lineWidth = 0.7;
        for (let i = 0; i < P; i++) {
          ctx.strokeStyle = rgba(colorOfN(c, i, P), 0.13 * opts.alpha);
          ctx.beginPath();
          for (let j = i + 1; j < P; j++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
          ctx.stroke();
        }
        for (let i = 0; i < P; i++) {
          ctx.fillStyle = rgba(colorOfN(c, i, P), 0.7 * opts.alpha);
          ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 2.5, 0, TAU); ctx.fill();
        }
        endFrame(ctx);
      }
    });
  }

  // 36. Chaos game — a point jumps a fraction of the way to a random triangle vertex each
  //     step. At ratio ½ the attractor IS the Sierpiński triangle; σ tunes the ratio to ½.
  function chaosGame() {
    return base({
      title: "Chaos game", _t: 0, _seeded: false, x: 0, y: 0,
      _f(q) { return `midpoint jump, ratio → ½ (Sierpiński)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.45;
        if (!this._seeded) { this.x = cx; this.y = cy; this._seeded = true; }
        const V = [[cx, cy - R], [cx - R * 0.87, cy + R * 0.5], [cx + R * 0.87, cy + R * 0.5]], ratio = lerp(0.42, 0.5, q);
        // Colour by WHICH vertex was jumped toward. Three vertices, three roles: the
        // Sierpinski triangle's three sub-triangles come out in three colours, which is
        // the structure the game is generating.
        const VC = [0, 1, 2].map(vi => colorOfN(c, vi, 3, this._t * 0.02));   // once, not 1400×
        for (let i = 0; i < 1400; i++) {
          const vi = (Math.random() * 3) | 0, v = V[vi];
          this.x += (v[0] - this.x) * ratio; this.y += (v[1] - this.y) * ratio;
          ctx.fillStyle = rgba(VC[vi], (0.05 + 0.05 * q) * opts.alpha);
          ctx.fillRect(this.x, this.y, 1.2, 1.2);
        }
        endFrame(ctx);
      }
    });
  }

  // 37. Ford circles — for each reduced fraction p/q in [0,1], a circle of radius 1/(2q²)
  //     resting on the axis; neighbours are exactly tangent. σ removes radius jitter so the
  //     kissing-circle packing snaps true.
  function fordCircles() {
    const Q = 14;
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    return base({
      title: "Ford circles", _t: 0,
      _f(q) { return `tangent circles · r = 1/2q²`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, c = opts.color, Wd = Math.min(w, h) * 0.92, ox = (w - Wd) / 2, oy = h * 0.6;
        ctx.lineWidth = 1;
        this._ct = (this._ct || 0) + dt;
        // Coloured by DENOMINATOR: every circle in a Farey level shares a role, so the
        // packing's arithmetic structure is what you see, not just its geometry.
        for (let den = 1; den <= Q; den++) {
          ctx.strokeStyle = rgba(colorOfN(c, den - 1, Q, this._ct * 0.04), 0.5 * opts.alpha);
          ctx.beginPath();
          for (let num = 0; num <= den; num++) {
            if (!(num === 0 && den === 1) && gcd(num, den) !== 1) continue;
            const jit = (hash2(num, den) - 0.5) * 0.4 * (1 - q), rr = (1 / (2 * den * den)) * Wd * lerp(1 + jit, 1, q);
            if (rr < 0.6) continue;
            const X = ox + (num / den) * Wd, Y = oy - rr;
            ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, TAU);
          }
          ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 38. Double helix — two 3-D helical strands a half-turn (π) apart with base-pair rungs,
  //     projected side-on and spinning about its vertical axis. DEPTH (sin φ) drives each
  //     segment's width + brightness: a strand fattens and brightens swinging toward you and
  //     thins passing behind, so the two backbones WEAVE over and under as the ladder turns.
  //     A rung's on-screen span breathes 2R→0 as its pair rotates broadside→edge-on — the
  //     classic DNA-twist silhouette. The near strand z-occludes the far one at each
  //     crossover, glowing nodes sit at each base-pair end, and a soft core column glows
  //     down the axis; the two strands take complementary (warm/cool) halves of the palette.
  //
  //     MOTION (cfg.motion × cfg.rhythm): an extra motion on top of the spin — stretch /
  //     rock / sway, driven by a self timer / the room zoom-pendulum / σ. The GALLERY DEFAULT
  //     is "A3" — stretch driven by σ (K.'s pick 2026-08-13): the helix breathes taller/thin
  //     at order, short/fat at chaos, in step with the room's own regulation.
  //     PHASE 2 (cfg.deconstruct): the σ-driven fall-apart. MODE-SELECTABLE — distinct ways the
  //     helix comes apart as σ falls and re-forms as it rises (compared in helix-lab3.html):
  //       'unwind'  — the twist relaxes toward a flat ladder (depth = cfg.unwindDepth), re-coils.
  //       'merge'   — two straight lines at the sides slide together into the helix.
  //       'gravity' — tight helix up top, strands pulled apart toward the bottom.
  //       'orbit'   — the thread unravels into spiral arms round two orbiting planets (cfg.arm).
  //       'unzip'   — base pairs release from the bottom, strands splay loose.
  //       'decohere'— uniform noise (may compose with the above via '+' / an array).
  //     Dials: cfg.spread (reach), cfg.arm (orbit spiral), cfg.unwindDepth, cfg.decAmp.
  //     The winner becomes the default cfg once K. picks.
  function doubleHelix(cfg) {
    cfg = cfg || {};
    // Self-serve overrides from the Helix Tuner (helix-tuner.html) persist in localStorage and
    // apply to the gallery too; an explicit cfg (the labs, the tuner's own live preview) wins.
    try { if (root.localStorage) { const sv = JSON.parse(root.localStorage.getItem('helixCfg') || '{}'); if (sv && typeof sv === 'object') cfg = Object.assign({}, sv, cfg); } } catch (e) {}
    const motion = cfg.motion !== undefined ? cfg.motion : null;   // extra motion (stretch/rock/sway); orbit needs none
    const rhythm = cfg.rhythm || 'sigma';     // 'self' | 'room' | 'sigma' — drives `motion`
    // DEFAULT = 'orbit' (K.'s 2026-08-13 pick): the gallery Double helix unravels into two
    // orbiting spiral arms — a triangle-of-rungs at chaos that winds up into the helix at order.
    const decon = cfg.deconstruct !== undefined ? cfg.deconstruct : 'orbit';  // string ('unwind'|'orbit'|…) | array | null
    const decSet = Array.isArray(decon) ? decon : (decon ? String(decon).split('+') : []);
    const hasDec = k => decSet.indexOf(k) >= 0;
    const decAmp = cfg.decAmp != null ? cfg.decAmp : 1;  // how VIOLENT unzip/decohere get (unwind ignores it)
    const unwindDepth = cfg.unwindDepth != null ? cfg.unwindDepth : 1;  // how FLAT unwind relaxes (0..1)
    // Defaults are K.'s tuned config (2026-08-13, via helix-tuner.html).
    const spread = cfg.spread != null ? cfg.spread : 1;      // how far the arms reach (× half-width) at full unravel
    const arm = cfg.arm != null ? cfg.arm : 0.28;           // orbit bend CEILING: 0 = straight triangle, rising as it winds
    const orbitRate = cfg.orbitRate != null ? cfg.orbitRate : 0.26;  // how fast the two planets orbit
    const openEase = cfg.openEase != null ? cfg.openEase : 2.1;     // >1 = the HELIX holds over more of the σ swing
    const amp = cfg.amp != null ? cfg.amp : 1;
    const rate = cfg.rate != null ? cfg.rate : 0.12;
    const N = 150, seed = [];
    const TURNS = cfg.twists != null ? cfg.twists : 1.75;          // helix twists over its height
    const RUNGS = cfg.rungs != null ? Math.round(cfg.rungs) : 32;   // base-pair rungs
    const radFrac = cfg.radFrac != null ? cfg.radFrac : 0.13;       // helix radius (× min(w,h))
    const heightFrac = cfg.heightFrac != null ? cfg.heightFrac : 0.78;  // helix height (× h)
    const spinRate = cfg.spinRate != null ? cfg.spinRate : 0.5;         // spin speed
    for (let i = 0; i < N; i++) seed.push(hash2(i, 12));
    return base({
      title: cfg.title || "Double helix", _t: 0,
      _f(q) { return `x = R·cos(φ) · two arms orbiting → helix`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const c = opts.color, cx = w / 2;
        // drive signal d∈[−1,1] for whatever extra motion is active, from the chosen rhythm.
        let d = 0;
        if (rhythm === 'room') {                             // the room's zoom pendulum, or a slow proxy off-party
          const z = (root.PARTY && root.PARTY.spiralZoom) ? root.PARTY.spiralZoom() : null;
          d = (z != null && isFinite(z)) ? clamp((z - 1) * 2 - 1, -1, 1) : Math.sin(this._t * 0.28 * TAU);
        } else if (rhythm === 'sigma') d = this.q * 2 - 1;   // chaos −1 … order +1
        else d = Math.sin(this._t * rate * TAU);             // 'self' — own timer
        // ── σ-driven deconstruction — MODE-SELECTABLE (compared in helix-lab3) ─────────
        // prim = the chosen mode; each is a distinct way the helix comes apart as σ falls and
        // re-forms as it rises. deco(t,sgn) returns per-point { rel:twist-keep, dx, dy, op:open }.
        //   unwind   — the twist relaxes to a flat ladder, then re-coils (smooth).
        //   merge    — two straight lines at the sides slide together into the helix.
        //   gravity  — tight up top, strands pulled apart toward the bottom.
        //   orbit    — the thread unravels into spiral arms round two orbiting planets.
        //   unzip    — base pairs release from the bottom, strands splay loose.
        const prim = decSet[0] || null;
        const recon = decSet.length > 0;
        const qs = this.q, sC = 1 - qs, openG = Math.pow(sC * sC * (3 - 2 * sC), openEase);   // smoothstep(1−σ)^ease: helix holds longer
        const orbitθ = this._t * orbitRate;                   // the two orbiting planets (gentle)
        const decT = recon ? sC : 0;
        const chaos = hasDec('decohere') ? decT : 0;          // uniform noise (lab extra)
        const turnsFloor = TURNS - (TURNS - 0.16) * unwindDepth;
        const turns = prim === 'unwind' ? lerp(turnsFloor, TURNS, qs) : TURNS;
        // reach is a SPIRAL-CLOCK patch: it breathes with the room's energy when live (busy
        // room → arms fan wider), constant off-party so the labs render unchanged.
        const energy = (root.PARTY && root.PARTY.effectiveEnergy) ? root.PARTY.effectiveEnergy() : null;
        const reachMul = (energy != null && isFinite(energy)) ? (0.45 + 0.85 * energy) : 1;
        const REACH = (w * 0.5) * spread * reachMul;
        const radFac = motion === 'stretch' ? 1 - 0.16 * amp * d : 1;
        const breathe = motion === 'stretch' ? 1 + 0.34 * amp * d : 1;
        const R = Math.min(w, h) * radFrac * radFac;
        const H = h * heightFrac * breathe, top = (h - H) / 2;
        const tilt = motion === 'sway' ? 0.16 * amp * d : 0;
        const rock = motion === 'rock' ? 0.9 * amp * d : 0;
        const spin = this._t * spinRate + rock;
        const midY = top + H / 2, ct = Math.cos(tilt), st = Math.sin(tilt);
        const drift = this._t * 0.04;

        // per-point deconstruction. rel = fraction of twist kept (1 wound, 0 released);
        // dx/dy = displacement off the helix; op = openness for the rung/node fade.
        function deco(t, sgn) {
          if (prim === 'merge')   { const o = openG;                              return { rel: 1 - o, dx: sgn * o * REACH, dy: 0, op: o }; }
          if (prim === 'gravity') { const o = clamp((1 - qs) * Math.pow(t, 1.6), 0, 1); return { rel: 1 - o, dx: sgn * o * REACH, dy: 0, op: o }; }
          if (prim === 'orbit')   { const o = openG;
                                    // bend is 0 at chaos (a straight-armed TRIANGLE) and rises to ≤`arm`
                                    // (≈0.2) as it winds back toward the helix — K.'s call.
                                    const a = orbitθ + (sgn > 0 ? Math.PI : 0) + t * arm * (1 - o) * TAU, r = o * REACH * t;
                                    return { rel: 1 - o, dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.6, op: o * t }; }
          if (prim === 'unzip')   { const s = clamp((t - (1 - openG)) / 0.12, 0, 1);   // seam opening bottom→up
                                    return { rel: 1, dx: sgn * s * REACH * 0.5, dy: 0, op: s }; }  // strands keep their coil, splay loose
          return { rel: 1, dx: 0, dy: 0, op: 0 };              // 'unwind' (turns handles it) / none
        }

        // integrated coil: twist accrues, scaled per-point by deco.rel so it releases where a
        // mode opens the thread. (deco.rel is sgn-independent, so either strand's is fine.)
        const coil = new Array(N);
        { let ph = spin; const base = turns * TAU / (N - 1);
          for (let i = 0; i < N; i++) { const t = i / (N - 1); coil[i] = ph; ph += base * deco(t, 1).rel; } }

        // one strand → [x, y, front∈0..1, t, open]. sgn (∓1) is which way this mode sends it.
        function strand(ph0, sgn) {
          const pts = [];
          for (let i = 0; i < N; i++) {
            const t = i / (N - 1), D = deco(t, sgn);
            const ph = coil[i] + ph0
                     + Math.sin(t * 9 + seed[i] * 6) * chaos * 1.7 * decAmp
                     + (seed[i] - 0.5) * 3.4 * chaos * decAmp;
            const rad = R * D.rel * (1 - chaos * decAmp * (0.5 - seed[i] * 0.8));  // coil amplitude releases with twist
            let x = cx + D.dx
                  + Math.sin(t * 4.3 + spin * 0.6) * R * 1.3 * chaos * decAmp   // decohere axis wander (lab)
                  + Math.cos(ph) * rad;
            let y = top + t * H + D.dy;
            if (tilt) { const ddx = x - cx, ddy = y - midY; x = cx + ddx * ct - ddy * st; y = midY + ddx * st + ddy * ct; }
            pts.push([x, y, (Math.sin(ph) + 1) / 2, t, D.op]);
          }
          return pts;
        }
        const A = strand(0, -1), B = strand(Math.PI, 1);     // the two strands, sent opposite ways by the mode
        // Strand A walks the WARM half of the ramp, B the COOL half — complementary strands,
        // and with the bridging rungs the whole scheme is on screen at once (Opus-5's split).
        const uA = t => t * 0.5, uB = t => 0.5 + t * 0.5;

        // central glow column — a soft additive core down the axis that ties the two
        // strands into one glowing object rather than two separate ribbons. (Axis-aligned,
        // so it's skipped while the column is swaying — it would read as a stray vertical.)
        if (!tilt) {
          const gw = R * 0.95, mid = colorAtU(c, 0.5, drift);
          const gg = ctx.createLinearGradient(cx - gw, 0, cx + gw, 0);
          const gAlpha = 0.06 * opts.alpha * (recon ? 1 - openG : 1);  // core dims as the helix comes apart
          gg.addColorStop(0, rgba(mid, 0)); gg.addColorStop(0.5, rgba(mid, gAlpha)); gg.addColorStop(1, rgba(mid, 0));
          ctx.fillStyle = gg; ctx.fillRect(cx - gw, top, gw * 2, H);
        }

        // rungs (behind the backbones): base pair k joins A[i]↔B[i] level. Brightness
        // follows the twist — boldest broadside (full 2R span), gone edge-on — colour
        // bridges the two halves of the ramp across the ladder.
        ctx.lineWidth = 1.2;
        for (let k = 0; k < RUNGS; k++) {
          const t = (k + 0.5) / RUNGS, i = Math.round(t * (N - 1));
          const jb = Math.max(0, Math.min(N - 1, i + Math.round((seed[k % N] - 0.5) * 8 * chaos)));
          const a = A[i], b = B[jb];
          const sinp = 2 * a[2] - 1;                                          // a[2] = (sin φ + 1)/2
          const foreshorten = Math.sqrt(Math.max(0, 1 - sinp * sinp));        // |cos φ|: 1 broadside … 0 edge-on
          // the base pair disintegrates inside the break — rungs vanish where the strand has
          // opened (a[4]=open), so the ladder dissolves from the centre out and reassembles in.
          const al = (0.05 + 0.3 * foreshorten) * opts.alpha * (1 - (a[4] || 0));
          if (al <= 0.01) continue;
          ctx.strokeStyle = rgba(colorAtU(c, t, drift + 0.5), al);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }

        /* the two backbones, z-SORTED far→near, so the front strand genuinely OCCLUDES the
         * back one at every crossover — real weave, not implied. Additive "lighter" can't
         * hide light on its own, so each near-half segment first lays a background-coloured
         * under-stroke (source-over) that erases the far glow beneath it, then its own glow
         * on top. A sharp front glint (f⁸) crawls along the strand as it spins, which is the
         * cue that reads unmistakably as ROTATION rather than a shimmering static wave.
         * (Design pass with Opus 5, 2026-08-13 — occlusion was its #1 call.) */
        const segs = [];
        const push = (pts, uf) => { for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], n = pts[i + 1]; segs.push([p[0], p[1], n[0], n[1], (p[2] + n[2]) / 2, uf(p[3])]); } };
        push(A, uA); push(B, uB);
        segs.sort((s1, s2) => s1[4] - s2[4]);                // far (low front-ness) first
        for (let s = 0; s < segs.length; s++) {
          const g = segs[s], f = g[4], lw = lerp(0.8, 3.6, f), spec = Math.pow(f, 8);
          if (f > 0.5) {                                     // near half erases what's behind it
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = lw + 2.2; ctx.strokeStyle = "rgba(4,5,10,0.72)";
            ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke();
            ctx.globalCompositeOperation = "lighter";
          }
          ctx.lineWidth = lw;
          ctx.strokeStyle = rgba(colorAtU(c, g[5], drift), (0.26 + 0.6 * f + 0.5 * spec) * opts.alpha);
          ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke();
        }

        // base-pair nodes — a glint at each rung end, bigger/brighter in front; they flash
        // as they swing broadside, and the side-to-side swing of the glints is the rotation
        // made legible bead by bead.
        function nodes(pts, uf) {
          for (let k = 0; k < RUNGS; k++) {
            const t = (k + 0.5) / RUNGS, p = pts[Math.round(t * (N - 1))], f = p[2];
            const rad = lerp(1.6, 4.4, f);
            const a = (0.22 + 0.7 * f) * opts.alpha * (1 - (p[4] || 0));  // fades where its pair has opened
            if (a <= 0.01) continue;
            const col = colorAtU(c, uf(t), drift);
            const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
            g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
          }
        }
        nodes(A, uA);
        nodes(B, uB);
        endFrame(ctx);
      }
    });
  }

  // 40. Galaxy — a scattered star cloud (chaos) winds into tight logarithmic arms (order).
  //     σ tightens the arm pitch and pulls the scatter in; a bright core glows at centre.
  function galaxy() {
    const N = 460, ARMS = 3, seed = [];
    for (let i = 0; i < N; i++) seed.push({ r: hash2(i, 3), arm: i % ARMS, j: hash2(i, 11) - 0.5, tw: hash2(i, 17) });
    return base({
      title: "Galaxy", _t: 0,
      _f(q) { return `r=e^{bθ},  ${ARMS} arms   pitch b→${lerp(0.9, 3.4, q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;
        const spin = this._t * 0.05, twist = lerp(0.9, 3.4, q), scatter = lerp(0.55, 0.04, q);
        for (let i = 0; i < N; i++) {
          const s = seed[i], rr = Math.pow(s.r, 0.72);
          const theta = s.arm * TAU / ARMS + rr * TAU * twist + spin + s.j * scatter * 3.2;
          const rad = rr * R * (1 + s.j * scatter);
          const x = cx + Math.cos(theta) * rad, y = cy + Math.sin(theta) * rad * 0.62;
          const c = colorAtU(opts.color, rr, this._t * 0.02);
          ctx.fillStyle = rgba(c, (0.3 + 0.55 * (1 - rr)) * opts.alpha);
          ctx.beginPath(); ctx.arc(x, y, lerp(2.3, 0.6, rr) * (0.7 + s.tw), 0, TAU); ctx.fill();
        }
        const cc = colorAtU(opts.color, 0, 0);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3);
        g.addColorStop(0, rgba(cc, 0.5 * opts.alpha)); g.addColorStop(1, rgba(cc, 0));
        ctx.fillStyle = g; ctx.fillRect(cx - R * 0.3, cy - R * 0.3, R * 0.6, R * 0.6);
        endFrame(ctx);
      }
    });
  }

  // helper: rotate a 3-vector about Y then tilt about X, orthographic-project to screen.
  //   returns [screenX, screenY, depth] with depth in −1..1 (near = +1).
  function project3(x, y, z, spin, tiltCos, tiltSin) {
    const xr = x * Math.cos(spin) + z * Math.sin(spin);
    const zr = -x * Math.sin(spin) + z * Math.cos(spin);
    const yt = y * tiltCos - zr * tiltSin, zt = y * tiltSin + zr * tiltCos;
    return [xr, yt, zt];
  }

  // 41. Spherical spiral (Clélie) — a thread winds pole-to-pole around a sphere. σ sets the
  //     wind count: few loose loops (chaos) → many even loops (order). Slowly turns in 3-D.
  function sphericalSpiral() {
    const N = 760;
    return base({
      title: "Spherical spiral", _t: 0,
      _f(q) { return `θ=c·φ on a sphere   winds c→${Math.round(lerp(3, 16, q))}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
        const winds = lerp(3, 16, q), spin = this._t * 0.25, tc = Math.cos(0.42), ts = Math.sin(0.42);
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const phi = i / N * Math.PI, theta = winds * phi;
          const p = project3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta), spin, tc, ts);
          pts.push([cx + p[0] * R, cy + p[1] * R]);
        }
        ctx.lineWidth = 1.6;
        strokeSegments(ctx, opts.color, 0.6 * opts.alpha, pts, 96, this._t * 0.03);
        endFrame(ctx);
      }
    });
  }

  // 42. Torus knot — a (p,q) knot threads a torus. σ detunes q off an integer (an open,
  //     drifting tangle) up to a closed, resolved (2,5) knot. Turns slowly in 3-D.
  function torusKnot() {
    const N = 900, P = 2, Rt = 0.62, rt = 0.3;
    return base({
      title: "Torus knot", _t: 0,
      _f(q) { return `(p,q)=(2, ${lerp(4.55, 5, q).toFixed(2)}) on a torus`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
        const Q = lerp(4.55, 5, q), spin = this._t * 0.2, tc = Math.cos(0.5), ts = Math.sin(0.5);
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N * TAU, ring = Rt + rt * Math.cos(Q * t);
          const p = project3(ring * Math.cos(P * t), rt * Math.sin(Q * t), ring * Math.sin(P * t), spin, tc, ts);
          pts.push([cx + p[0] * R, cy + p[1] * R]);
        }
        ctx.lineWidth = 1.8;
        strokeSegments(ctx, opts.color, 0.6 * opts.alpha, pts, 110, this._t * 0.04);
        endFrame(ctx);
      }
    });
  }

  // 43. Guilloché — the interference rosette on a banknote: nested rings of two beating
  //     frequencies. σ pulls the ratio onto an integer, so a drifting weave crisps into a
  //     stable rosette. Each ring is offset in phase for depth.
  function guilloche() {
    const RINGS = 6, SEG = 240;
    return base({
      title: "Guilloché", _t: 0,
      _f(q) { return `x=A cos t + B cos(f t),  f→${lerp(6.6, 7, q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
        const f = lerp(6.6, 7, q), drift = this._t * 0.05;
        ctx.lineWidth = 1.2;
        for (let m = 0; m < RINGS; m++) {
          const A = R * lerp(0.66, 0.62, m / RINGS), B = R * (0.22 + 0.06 * m / RINGS);
          const ph = m * TAU / RINGS + drift;
          strokeRamp(ctx, opts.color, (0.28 + 0.12 * (1 - m / RINGS)) * opts.alpha,
            u => { const t = u * TAU; return [cx + A * Math.cos(t) + B * Math.cos(f * t + ph), cy + A * Math.sin(t) + B * Math.sin(f * t + ph)]; },
            SEG, this._t * 0.03 + m * 0.15);
        }
        endFrame(ctx);
      }
    });
  }

  // 44. Torus — a glowing donut of longitude rings, spinning in 3-D. σ calms it: at chaos
  //     the tube breathes and wobbles out of true, at order it settles into a clean torus.
  function torus() {
    const NU = 26, NV = 22, R = 0.6, r = 0.26;
    return base({
      title: "Torus", _t: 0,
      _f(q) { return `((R+r cos v)cos u, r sin v, (R+r cos v)sin u)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.46;
        const spin = this._t * 0.3, tc = Math.cos(1.05), ts = Math.sin(1.05), wob = (1 - q) * 0.55;
        ctx.lineWidth = 1.4;
        for (let iu = 0; iu < NU; iu++) {
          const u = iu / NU * TAU, pts = [];
          let depth = 0;
          for (let iv = 0; iv <= NV; iv++) {
            const v = iv / NV * TAU;
            const rr = r * (1 + wob * Math.sin(v * 3 + u * 2 + this._t * 1.3));
            const ring = R + rr * Math.cos(v);
            const p = project3(ring * Math.cos(u), rr * Math.sin(v), ring * Math.sin(u), spin, tc, ts);
            pts.push([cx + p[0] * S, cy + p[1] * S]); depth += p[2];
          }
          const near = (depth / (NV + 1) + 1) / 2;                 // 0 far … 1 near
          strokeSegments(ctx, opts.color, (0.14 + 0.5 * near) * opts.alpha, pts, NV, u / TAU + this._t * 0.02);
        }
        endFrame(ctx);
      }
    });
  }

  // 45. Superellipse bloom — nested rounded-square rings that inflate from vicious concave
  //     throwing-stars (chaos, each ring detuned) into one clean set of circles → plump
  //     squares (order). One exponent, huge morph. (Opus 4.6's #1 woah-per-line pick.)
  function superellipseBloom() {
    const N = 13;
    function sp(ang, e) { const c = Math.cos(ang); return Math.sign(c) * Math.pow(Math.abs(c), e); }
    return base({
      title: "Superellipse bloom", _t: 0,
      _f(q) { return `|cos θ|^{2/n}·sgn,  n→${lerp(0.4, 4, q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42, n = lerp(0.4, 4, q);
        ctx.lineWidth = 1.3;
        for (let k = 0; k < N; k++) {
          const rk = (k + 1) / N * R, nk = Math.max(0.22, n + hash2(k, 0) * (1 - q) * 2);
          const e = 2 / nk, off = this._t * 0.2 + k * 0.4;
          strokeRamp(ctx, opts.color, (0.18 + 0.16 * (1 - k / N)) * opts.alpha,
            u => { const t = u * TAU + off; return [cx + rk * sp(t, e), cy + rk * sp(t + Math.PI / 2, e)]; },
            72, this._t * 0.03 + k * 0.1);
        }
        endFrame(ctx);
      }
    });
  }

  // 46. Kuramoto fireflies — a ring of oscillators blinking out of sync (chaos) that snap
  //     into one breathing heartbeat (order). σ is the coupling K; the lock is real physics
  //     (mean-field order parameter R). This IS the room's business, made literal.
  function kuramoto() {
    const N = 64;
    return base({
      title: "Kuramoto fireflies", _t: 0,
      _f(q) { return `dφ=ω+K·R·sin(ψ−φ),  K→${lerp(0, 6, q).toFixed(1)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        if (!this._ph) { this._ph = []; for (let i = 0; i < N; i++) this._ph.push(hash2(i, 5) * TAU); }
        const q = this.q, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.36, K = lerp(0, 6, q), ph = this._ph;
        let sx = 0, sy = 0;
        for (let i = 0; i < N; i++) { sx += Math.cos(ph[i]); sy += Math.sin(ph[i]); }
        sx /= N; sy /= N;
        const Rord = Math.sqrt(sx * sx + sy * sy), psi = Math.atan2(sy, sx);
        for (let i = 0; i < N; i++) {
          const om = 0.6 + hash2(i, 0) * (1 - q) * 3;
          ph[i] += (om + K * Rord * Math.sin(psi - ph[i])) * dt;
        }
        const rad = R0 * (0.72 + 0.28 * Rord);
        for (let i = 0; i < N; i++) {
          const a = i / N * TAU, br = 0.5 + 0.5 * Math.sin(ph[i]);
          const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
          const c = colorAtU(opts.color, br, this._t * 0.02);
          ctx.fillStyle = rgba(c, (0.12 + 0.85 * br) * opts.alpha);
          ctx.beginPath(); ctx.arc(x, y, 2 + 3 * br, 0, TAU); ctx.fill();
        }
        // a soft core throb that swells as the ring locks
        const cc = colorAtU(opts.color, 0.5, 0);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.5);
        g.addColorStop(0, rgba(cc, 0.28 * Rord * opts.alpha)); g.addColorStop(1, rgba(cc, 0));
        ctx.fillStyle = g; ctx.fillRect(cx - R0 * 0.5, cy - R0 * 0.5, R0, R0);
        endFrame(ctx);
      }
    });
  }

  // 47. Quasicrystal — five plane waves interfering into an impossible 5-fold starfield.
  //     Chaos jitters the wave angles into a mushy moiré; order snaps them evenly spaced
  //     and in phase for a sharp Penrose-like crystal. (Opus 4.6 idea.)
  function quasicrystal() {
    const NW = 5, COLS = 64;
    return base({
      title: "Quasicrystal", _t: 0,
      _f(q) { return `Σ cos(k·(x cosθⱼ+y sinθⱼ)+φ),  ${NW}-fold`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, rows = Math.max(1, Math.round(COLS * h / w)), cw = w / COLS, ch = h / rows;
        const k = lerp(2.2, 5.5, q), phi = this._t * 0.6, jit = (1 - q) * 0.9;
        const ang = [];
        for (let j = 0; j < NW; j++) ang.push(j * Math.PI / NW + hash2(j, 3) * jit);
        for (let iy = 0; iy < rows; iy++) {
          for (let ix = 0; ix < COLS; ix++) {
            const x = (ix / COLS - 0.5) * 10, y = (iy / rows - 0.5) * 10 * h / w;
            let f = 0;
            for (let j = 0; j < NW; j++) f += Math.cos(k * (x * Math.cos(ang[j]) + y * Math.sin(ang[j])) + phi);
            let b = f / NW * 0.5 + 0.5; b = b * b * (3 - 2 * b);   // smoothstep for crisp fringes
            const c = colorAtU(opts.color, b, 0);
            ctx.fillStyle = rgba(c, (0.05 + 0.7 * b) * opts.alpha);
            ctx.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
          }
        }
        endFrame(ctx);
      }
    });
  }

  // 48. Epicycloid gears — a chain of circles-on-circles (a Fourier machine) with its arms
  //     visible like clockwork. Chaos detunes the gear ratios so the traced curve never
  //     closes (a wandering scribble); order integer-locks them into a crisp flower.
  function epicycloidGears() {
    const K = 5;
    return base({
      title: "Epicycloid gears", _t: 0,
      _f(q) { return `P=Σ rⱼ·e^{i fⱼ t},  fⱼ=2j−1 ${q > 0.9 ? "(locked)" : "(detuned)"}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
        const f = [], rj = [];
        let norm = 0;
        for (let j = 0; j < K; j++) { f.push((2 * j + 1) + hash2(j, 0) * (1 - q) * 0.9); rj.push(1 / (2 * j + 1)); norm += rj[j]; }
        const sc = R / norm;
        // traced path (bright): one period of t
        ctx.lineWidth = 1.6;
        strokeRamp(ctx, opts.color, 0.55 * opts.alpha,
          u => { const t = u * TAU; let x = 0, y = 0; for (let j = 0; j < K; j++) { x += rj[j] * Math.cos(f[j] * t); y += rj[j] * Math.sin(f[j] * t); } return [cx + x * sc, cy + y * sc]; },
          200, this._t * 0.03);
        // the visible arm chain at the current animated angle
        const base = this._t * 0.5;
        let px = cx, py = cy;
        ctx.lineWidth = 1;
        for (let j = 0; j < K; j++) {
          const nx = px + rj[j] * Math.cos(f[j] * base) * sc, ny = py + rj[j] * Math.sin(f[j] * base) * sc;
          const c = colorAtU(opts.color, j / K, 0);
          ctx.strokeStyle = rgba(c, 0.4 * opts.alpha);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
          ctx.fillStyle = rgba(c, 0.5 * opts.alpha);
          ctx.beginPath(); ctx.arc(nx, ny, 2.2, 0, TAU); ctx.fill();
          px = nx; py = ny;
        }
        endFrame(ctx);
      }
    });
  }

  /* ── autonomous colours+spirals batch (2026-08-18) ─────────────────────────
     Twelve new exhibits, same base()/frame()/endFrame() contract, same
     chaos(σ=0)→symmetry(σ=1) morph, coloured through opts.color's at() sampler.
     All pure vector/gradient draws (no getImageData) so the headless suites run
     them clean, and none can diverge the frame. */

  // 49. Aizawa attractor — a 3-D orbit winding a sphere. Chaos frays the shell with
  //     jitter; order tightens it into one clean woven ball. Slowly turns in 3-D.
  function aizawa() {
    return base({
      title: "Aizawa attractor", x: 0.1, y: 0, z: 0,
      _f(q) { return `ẋ=(z−b)x−dy … Aizawa (3-D)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.34;
        const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1, step = 0.01;
        const spin = (this._t || 0) * 0.22, tc = Math.cos(0.95), ts = Math.sin(0.95), jit = (1 - q) * 0.06;
        for (let i = 0; i < 720; i++) {
          const X = this.x, Y = this.y, Z = this.z;
          this.x = X + ((Z - b) * X - d * Y) * step;
          this.y = Y + (d * X + (Z - b) * Y) * step;
          this.z = Z + (c + a * Z - Z * Z * Z / 3 - (X * X + Y * Y) * (1 + e * Z) + f * Z * X * X * X) * step;
          const jx = (hash2(i, 1) - 0.5) * jit, jy = (hash2(i, 2) - 0.5) * jit;
          const p = project3(this.x + jx, this.y + jy, this.z - 1, spin, tc, ts);
          const rr = clamp((this.z + 0.3) / 2, 0, 1);
          ctx.fillStyle = rgba(colorAtU(opts.color, rr, this._t * 0.03), (0.05 + 0.10 * q) * opts.alpha);
          ctx.fillRect(cx + p[0] * S, cy + p[1] * S, 1.3, 1.3);
        }
        endFrame(ctx);
      }
    });
  }

  // 50. Thomas attractor — cyclically symmetric 3-D flow. Small damping (chaos) makes a
  //     tangled web; more damping (order) settles it into a clean symmetric limit cycle.
  function thomas() {
    return base({
      title: "Thomas attractor", x: 0.1, y: 0.15, z: 0.2,
      _f(q) { return `ẋ=sin y − b·x  (cyclic),  b→${lerp(0.19, 0.33, q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.09;
        const b = lerp(0.19, 0.33, q), step = 0.08;
        const spin = (this._t || 0) * 0.2, tc = Math.cos(0.9), ts = Math.sin(0.9);
        for (let i = 0; i < 820; i++) {
          const X = this.x, Y = this.y, Z = this.z;
          this.x = X + (Math.sin(Y) - b * X) * step;
          this.y = Y + (Math.sin(Z) - b * Y) * step;
          this.z = Z + (Math.sin(X) - b * Z) * step;
          const p = project3(this.x, this.y, this.z, spin, tc, ts);
          const rr = clamp(this.z / 8 + 0.5, 0, 1);
          ctx.fillStyle = rgba(colorAtU(opts.color, rr, this._t * 0.03), (0.05 + 0.08 * q) * opts.alpha);
          ctx.fillRect(cx + p[0] * S, cy + p[1] * S, 1.3, 1.3);
        }
        endFrame(ctx);
      }
    });
  }

  // 51. Flow field — particles ride a vector field. Chaos = a turbulent field of crossing
  //     sines (streams tangle); order = one clean rotation (they lock into concentric rings).
  function flowField() {
    const N = 150;
    return base({
      title: "Flow field", _t: 0,
      _f(q) { return q > 0.5 ? `laminar: one vortex` : `turbulent Σ sin field`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46, t = this._t;
        if (!this._p) { this._p = []; for (let i = 0; i < N; i++) this._p.push({ x: hash2(i, 1) * w, y: hash2(i, 2) * h, life: hash2(i, 3) * 4 }); }
        const ps = this._p, sp = Math.min(w, h) * 0.9;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < N; i++) {
          const P = ps[i], nx = (P.x - cx) / R, ny = (P.y - cy) / R;
          const turb = Math.sin(nx * 3 + t * 0.4) * 1.6 + Math.cos(ny * 3 - t * 0.3) * 1.6 + hash2(i, 4) * TAU;
          const lam = Math.atan2(ny, nx) + Math.PI / 2;
          const ang = lerp(turb, lam, q), vx = Math.cos(ang), vy = Math.sin(ang);
          const nX = P.x + vx * sp * dt, nY = P.y + vy * sp * dt;
          const c = colorAtU(opts.color, Math.atan2(ny, nx) / TAU + 0.5, t * 0.02);
          ctx.strokeStyle = rgba(c, 0.5 * opts.alpha);
          ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(nX, nY); ctx.stroke();
          P.x = nX; P.y = nY; P.life -= dt;
          if (P.life <= 0 || P.x < 0 || P.x > w || P.y < 0 || P.y > h) {
            const seed = (t * 7 | 0) + i;
            P.x = cx + (hash2(seed, 5) - 0.5) * 2 * R; P.y = cy + (hash2(seed, 6) - 0.5) * 2 * R; P.life = 2 + hash2(i, 7) * 3;
          }
        }
        endFrame(ctx);
      }
    });
  }

  // 52. Metaballs — soft wells drifting. Chaos scatters them at random radii; order spaces
  //     them evenly on a ring so they merge into one symmetric glowing flower.
  function metaballs() {
    const N = 7;
    return base({
      title: "Metaballs", _t: 0,
      _f(q) { return `Σ r²/‖x−xᵢ‖²,  ${N} wells → ring`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3, t = this._t;
        for (let i = 0; i < N; i++) {
          const b0 = i / N * TAU;
          const chR = (0.35 + hash2(i, 1) * 0.95) * R, chA = b0 + (hash2(i, 2) - 0.5) * 4 + t * (0.2 + hash2(i, 3) * 0.5);
          const rr = lerp(chR, R, q), aa = lerp(chA, b0 - t * 0.15, q);
          const x = cx + Math.cos(aa) * rr, y = cy + Math.sin(aa) * rr;
          const rad = Math.min(w, h) * (0.16 + 0.05 * Math.sin(t * 0.7 + i));
          const c = colorAtU(opts.color, i / N, t * 0.02);
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, rgba(c, 0.5 * opts.alpha)); g.addColorStop(0.5, rgba(c, 0.16 * opts.alpha)); g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
        const cc = colorAtU(opts.color, 0.5, 0);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
        cg.addColorStop(0, rgba(cc, 0.22 * q * opts.alpha)); cg.addColorStop(1, rgba(cc, 0));
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, TAU); ctx.fill();
        endFrame(ctx);
      }
    });
  }

  // 53. Mandala — a rose-window of nested N-fold petal rings. Chaos detunes each ring so the
  //     symmetry breaks into a wobble; order snaps every ring to a clean ${8}-fold bloom.
  function mandala() {
    const N = 8, RINGS = 6;
    return base({
      title: "Mandala", _t: 0,
      _f(q) { return `${N}-fold rose window,  detune→${(1 - q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44, t = this._t, STEPS = 180;
        ctx.lineWidth = 1.3;
        for (let k = 1; k <= RINGS; k++) {
          const rr = k / RINGS * R, c = colorAtU(opts.color, k / RINGS, t * 0.03);
          ctx.strokeStyle = rgba(c, (0.13 + 0.13 * q) * opts.alpha);
          ctx.beginPath();
          for (let j = 0; j <= STEPS; j++) {
            const a = j / STEPS * TAU;
            const jitp = (1 - q) * 0.4 * Math.sin(a * N * 1.37 + hash2(k, 1) * TAU);
            const amp = 0.12 + 0.10 * Math.sin(t * 0.3 + k);
            const wob = 1 + amp * Math.cos(N * a + t * 0.4 * (k % 2 ? 1 : -1)) + jitp;
            const x = cx + Math.cos(a) * rr * wob, y = cy + Math.sin(a) * rr * wob;
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 54. String art — curve-stitch caustics between rotating rails. Chaos jitters each
  //     thread's endpoint into a tangle; order lands them exactly for crisp parabolic stars.
  function stringArt() {
    const N = 26, ARMS = 6;
    return base({
      title: "String art", _t: 0,
      _f(q) { return `curve-stitch envelopes,  ${ARMS} rails`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44, t = this._t, spin = t * 0.08;
        ctx.lineWidth = 1;
        for (let s = 0; s < ARMS; s++) {
          const a0 = s / ARMS * TAU + spin, a1 = (s + 1) / ARMS * TAU + spin, c = colorAtU(opts.color, s / ARMS, t * 0.03);
          ctx.strokeStyle = rgba(c, (0.10 + 0.14 * q) * opts.alpha);
          for (let i = 0; i <= N; i++) {
            const u = clamp(i / N + (1 - q) * (hash2(s, i) - 0.5) * 0.5, 0, 1);
            const ax = cx + Math.cos(a0) * R * u, ay = cy + Math.sin(a0) * R * u;
            const bx = cx + Math.cos(a1) * R * (1 - u), by = cy + Math.sin(a1) * R * (1 - u);
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
        endFrame(ctx);
      }
    });
  }

  // 55. Standing wave — a circular drumhead. Chaos superposes four detuned modes into a
  //     churning mess; order lets a single clean nodal mode (concentric rings + spokes) win.
  function membrane() {
    const RINGS = 26, SPOKES = 72;
    const MODES = [{ m: 5, k: 9, ph: 0 }, { m: 3, k: 6, ph: 1.3 }, { m: 7, k: 12, ph: 2.1 }, { m: 2, k: 15, ph: 0.7 }];
    return base({
      title: "Standing wave", _t: 0,
      _f(q) { return `J_m(k·r)·cos(mθ),  modes→${q > 0.5 ? 1 : 4}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44, t = this._t, osc = Math.sin(t * 1.4);
        const wt = [1, 1 - q, 1 - q, 1 - q];
        for (let ir = 1; ir <= RINGS; ir++) {
          const r = ir / RINGS;
          for (let is = 0; is < SPOKES; is++) {
            const th = is / SPOKES * TAU;
            let A = 0, wsum = 0;
            for (let mi = 0; mi < MODES.length; mi++) { const M = MODES[mi]; A += wt[mi] * Math.cos(M.k * r + M.ph) * Math.cos(M.m * th + M.ph); wsum += wt[mi]; }
            A = A / (wsum || 1) * osc;
            const b = Math.abs(A);
            if (b < 0.06) continue;
            const x = cx + Math.cos(th) * r * R, y = cy + Math.sin(th) * r * R;
            const c = colorAtU(opts.color, 0.5 + 0.5 * A, t * 0.02);
            ctx.fillStyle = rgba(c, (0.08 + 0.7 * b) * opts.alpha);
            ctx.beginPath(); ctx.arc(x, y, 1.4 + 2.2 * b, 0, TAU); ctx.fill();
          }
        }
        endFrame(ctx);
      }
    });
  }

  // 56. Voronoi shatter — nearest-site cells with lit cracks. Chaos scatters the sites into
  //     jagged shards; order relaxes them toward a lattice so the cells even out.
  function voronoi() {
    const N = 14, COLS = 48;
    return base({
      title: "Voronoi shatter", _t: 0,
      _f(q) { return `nearest-site cells,  ${N} sites → lattice`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t, rows = Math.max(1, Math.round(COLS * h / w)), cw = w / COLS, ch = h / rows, drift = t * 0.03;
        const sx = [], sy = [], sc = [], perRow = 4, rowsN = Math.ceil(N / perRow);
        for (let i = 0; i < N; i++) {
          const chx = hash2(i, 1) * w, chy = hash2(i, 2) * h;
          const gx = i % perRow, gy = (i / perRow | 0);
          const orx = (gx + 0.5 + ((gy % 2) ? 0.5 : 0)) / (perRow + 0.5) * w, ory = (gy + 0.5) / rowsN * h;
          sx.push(lerp(chx, orx, q) + Math.cos(drift + i) * 8 * (1 - q));
          sy.push(lerp(chy, ory, q) + Math.sin(drift + i) * 8 * (1 - q));
          sc.push(colorAtU(opts.color, i / N, drift));
        }
        for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < COLS; ix++) {
          const px = (ix + 0.5) * cw, py = (iy + 0.5) * ch;
          let best = 0, bd = 1e9, bd2 = 1e9;
          for (let i = 0; i < N; i++) { const dx = px - sx[i], dy = py - sy[i], d = dx * dx + dy * dy; if (d < bd) { bd2 = bd; bd = d; best = i; } else if (d < bd2) bd2 = d; }
          const edge = Math.sqrt(bd2) - Math.sqrt(bd), eb = edge < cw * 1.1;
          ctx.fillStyle = rgba(sc[best], (eb ? 0.6 : 0.15) * opts.alpha);
          ctx.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
        }
        endFrame(ctx);
      }
    });
  }

  // 57. Barnsley fern — a self-similar IFS. Order draws the exact fern; chaos jitters the
  //     affine maps so the frond frays into a green mist. Deterministic selector (no random).
  function fern() {
    return base({
      title: "Barnsley fern", x: 0, y: 0, _i: 0,
      _f(q) { return `4 affine maps (IFS),  detune→${(1 - q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, t = this._t, S = Math.min(w, h) * 0.9 / 11, baseY = h * 0.96, jit = (1 - q) * 0.4;
        for (let n = 0; n < 1400; n++) {
          const i = this._i++, r = hash2(i * 0.0173, 3), X = this.x, Y = this.y;
          let nx, ny;
          if (r < 0.01) { nx = 0; ny = 0.16 * Y; }
          else if (r < 0.86) { nx = 0.85 * X + 0.04 * Y; ny = -0.04 * X + 0.85 * Y + 1.6; }
          else if (r < 0.93) { nx = 0.2 * X - 0.26 * Y; ny = 0.23 * X + 0.22 * Y + 1.6; }
          else { nx = -0.15 * X + 0.28 * Y; ny = 0.26 * X + 0.24 * Y + 0.44; }
          this.x = nx + (hash2(i, 1) - 0.5) * jit; this.y = ny + (hash2(i, 2) - 0.5) * jit;
          const c = colorAtU(opts.color, clamp(this.y / 11, 0, 1), t * 0.02);
          ctx.fillStyle = rgba(c, (0.06 + 0.10 * q) * opts.alpha);
          ctx.fillRect(cx + this.x * S, baseY - this.y * S, 1.1, 1.1);
        }
        endFrame(ctx);
      }
    });
  }

  // 58. Supershape — Gielis superformula lifted to 3-D as latitude rings. Chaos detunes the
  //     symmetry m so the bloom goes lumpy; order integer-locks it into a symmetric flower-ball.
  function supershape3d() {
    const NLAT = 22, NLON = 40;
    function sf(ang, m, n1, n2, n3) {
      const t = m * ang / 4, a = Math.pow(Math.abs(Math.cos(t)), n2) + Math.pow(Math.abs(Math.sin(t)), n3);
      return Math.min(2.5, Math.pow(a < 1e-6 ? 1e-6 : a, -1 / n1));
    }
    return base({
      title: "Supershape", _t: 0,
      _f(q) { return `Gielis 3-D,  m→${lerp(3.4, 6, q).toFixed(1)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.32, t = this._t;
        const m = lerp(3.4, 6, q), n1 = lerp(0.3, 0.6, q) + 0.2, n2 = 1.7, n3 = 1.7;
        const spin = t * 0.3, tc = Math.cos(0.9), ts = Math.sin(0.9);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < NLAT; i++) {
          const lat = -Math.PI / 2 + (i + 0.5) / NLAT * Math.PI, r2 = sf(lat, m, n1, n2, n3), pts = [];
          for (let jl = 0; jl <= NLON; jl++) {
            const lon = jl / NLON * TAU, r1 = sf(lon, m, n1, n2, n3);
            const p = project3(r1 * Math.cos(lon) * r2 * Math.cos(lat), r1 * Math.sin(lon) * r2 * Math.cos(lat), r2 * Math.sin(lat), spin, tc, ts);
            pts.push([cx + p[0] * S, cy + p[1] * S]);
          }
          strokeSegments(ctx, opts.color, (0.14 + 0.14 * q) * opts.alpha, pts, NLON, i / NLAT + t * 0.02);
        }
        endFrame(ctx);
      }
    });
  }

  // 59. Reaction–diffusion — a Gray–Scott chemical field. Chaos params keep it churning in
  //     turbulent waves; order params settle it into a still lattice of hexagonal spots.
  function reactionDiffusion() {
    const GW = 64, GH = 48, LEN = GW * GH;
    return base({
      title: "Reaction diffusion", _t: 0,
      _f(q) { return `Gray–Scott,  f/k → ${q > 0.5 ? "stable spots" : "turbulent"}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t;
        let U = this._u, V = this._v;
        if (!U) {
          U = this._u = new Float64Array(LEN).fill(1); V = this._v = new Float64Array(LEN);
          for (let s = 0; s < 24; s++) {
            const gx = (hash2(s, 1) * GW) | 0, gy = (hash2(s, 2) * GH) | 0;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = gx + dx, yy = gy + dy; if (xx >= 0 && xx < GW && yy >= 0 && yy < GH) V[yy * GW + xx] = 1; }
          }
        }
        const f = lerp(0.026, 0.037, q), k = lerp(0.051, 0.061, q), Du = 0.16, Dv = 0.08;
        for (let it = 0; it < 2; it++) {
          const nu = new Float64Array(LEN), nv = new Float64Array(LEN);
          for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
            const i = y * GW + x, xm = (x - 1 + GW) % GW, xp = (x + 1) % GW, ym = (y - 1 + GH) % GH, yp = (y + 1) % GH;
            const lu = U[y * GW + xm] + U[y * GW + xp] + U[ym * GW + x] + U[yp * GW + x] - 4 * U[i];
            const lv = V[y * GW + xm] + V[y * GW + xp] + V[ym * GW + x] + V[yp * GW + x] - 4 * V[i];
            const uvv = U[i] * V[i] * V[i];
            nu[i] = U[i] + (Du * lu - uvv + f * (1 - U[i]));
            nv[i] = V[i] + (Dv * lv + uvv - (f + k) * V[i]);
          }
          U = nu; V = nv;
        }
        this._u = U; this._v = V;
        const cw = w / GW, ch = h / GH;
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          const v = V[y * GW + x]; if (v < 0.08) continue;
          const c = colorAtU(opts.color, clamp(v * 2.2, 0, 1), t * 0.02);
          ctx.fillStyle = rgba(c, (0.1 + 0.8 * clamp(v * 2, 0, 1)) * opts.alpha);
          ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
        }
        endFrame(ctx);
      }
    });
  }

  // 60. Icosahedron — the 12 golden-ratio vertices + 30 edges, turning in 3-D. Chaos pushes
  //     each vertex out along a frozen random offset (a frayed cage); order is the exact solid.
  function icosahedron() {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const V = [[0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI], [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]];
    const E = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const dx = V[i][0] - V[j][0], dy = V[i][1] - V[j][1], dz = V[i][2] - V[j][2]; if (Math.abs(dx * dx + dy * dy + dz * dz - 4) < 0.01) E.push([i, j]); }
    return base({
      title: "Icosahedron", _t: 0,
      _f(q) { return `12 vertices · 30 edges,  fray→${(1 - q).toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, S = Math.min(w, h) * 0.2, t = this._t;
        const spin = t * 0.4, tc = Math.cos(0.62 + t * 0.05), ts = Math.sin(0.62 + t * 0.05);
        const proj = V.map((v, i) => { const s = 1 + (1 - q) * hash2(i, 1) * 1.4; const p = project3(v[0] * s, v[1] * s, v[2] * s, spin, tc, ts); return [cx + p[0] * S, cy + p[1] * S, p[2]]; });
        ctx.lineWidth = 1.4;
        for (let e = 0; e < E.length; e++) {
          const a = proj[E[e][0]], b = proj[E[e][1]], near = clamp((a[2] + b[2]) / (4 * PHI) + 0.5, 0, 1);
          ctx.strokeStyle = rgba(colorAtU(opts.color, near, t * 0.03), (0.12 + 0.5 * near) * opts.alpha);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        for (let i = 0; i < 12; i++) { const p = proj[i]; ctx.fillStyle = rgba(colorAtU(opts.color, i / 12, t * 0.03), 0.6 * opts.alpha); ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, TAU); ctx.fill(); }
        endFrame(ctx);
      }
    });
  }

  /* ── batch 2 (2026-08-18): six more from the catalog-miner's high-woah picks,
     distinct from the 60 above, all headless-safe procedural draws. ───────── */

  // 61. Plasma — the demoscene sum-of-sines field. Chaos randomises the four phase
  //     offsets into an incoherent churn; order zeroes them so the sines lock into
  //     clean travelling/standing waves.
  function plasma() {
    const COLS = 72;
    return base({
      title: "Plasma", _t: 0,
      _f(q) { return `Σ sin(f·x+φ),  phases lock→${q.toFixed(2)}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t, rows = Math.max(1, Math.round(COLS * h / w)), cw = w / COLS, ch = h / rows, jit = 1 - q;
        const p1 = jit * hash2(1, 1) * TAU, p2 = jit * hash2(2, 2) * TAU, p3 = jit * hash2(3, 3) * TAU, p4 = jit * hash2(4, 4) * TAU;
        const cy10 = 5 * h / w;
        for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < COLS; ix++) {
          const x = ix / COLS * 10, y = iy / rows * 10 * h / w;
          const v = Math.sin(x * 1.2 + t * 0.7 + p1) + Math.sin(y * 1.5 - t * 0.5 + p2) + Math.sin((x + y) * 0.9 + t * 0.6 + p3) + Math.sin(Math.hypot(x - 5, y - cy10) * 1.4 - t * 0.8 + p4);
          const b = v / 4 * 0.5 + 0.5;
          ctx.fillStyle = rgba(colorAtU(opts.color, b, t * 0.02), (0.12 + 0.6 * b) * opts.alpha);
          ctx.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
        }
        endFrame(ctx);
      }
    });
  }

  // 62. Kaleidoscope — a procedural pattern folded into a mirrored wedge. Chaos keeps the
  //     fold to a 2-fold mirror (loose); order ramps it to a 16-fold mandala. The universal
  //     "make it trippy" amplifier, done without a feedback buffer so it stays headless-safe.
  function kaleidoscope() {
    const COLS = 72;
    return base({
      title: "Kaleidoscope", _t: 0,
      _f(q) { return `${Math.round(lerp(2, 16, q))}-fold mirror fold`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.5;
        const rows = Math.max(1, Math.round(COLS * h / w)), cw = w / COLS, ch = h / rows, wedge = TAU / Math.round(lerp(2, 16, q));
        for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < COLS; ix++) {
          const px = (ix + 0.5) * cw - cx, py = (iy + 0.5) * ch - cy, r = Math.hypot(px, py) / R;
          if (r > 1.02) continue;
          let a = Math.atan2(py, px);
          a = Math.abs(((a % wedge) + wedge) % wedge - wedge / 2);
          const v = 0.5 + 0.5 * Math.sin(r * 10 - t * 0.9 + Math.cos(a * 6 + t * 0.4) * 2.2);
          ctx.fillStyle = rgba(colorAtU(opts.color, v, t * 0.02), (0.10 + 0.6 * v) * opts.alpha);
          ctx.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
        }
        endFrame(ctx);
      }
    });
  }

  // 63. Doyle spiral — circles packed on golden-angle logarithmic arms, each scaled to its
  //     distance from centre (sacred-geometry phyllotaxis). Chaos jitters angle + radius into
  //     a scatter; order lands the exact log-spiral packing.
  function doyleSpiral() {
    const N = 260, GA = Math.PI * (3 - Math.sqrt(5));
    return base({
      title: "Doyle spiral", _t: 0,
      _f(q) { return `log-spiral circle packing (φ)`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.47, t = this._t, rot = t * 0.06;
        ctx.lineWidth = 1.2;
        for (let n = 1; n <= N; n++) {
          const frac = n / N, ang = n * GA + rot + (1 - q) * (hash2(n, 1) - 0.5) * 0.7, rad = R * Math.pow(frac, 0.62);
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
          const cr = Math.max(0.5, rad * 0.13 * (1 + (1 - q) * (hash2(n, 2) - 0.5)));
          ctx.strokeStyle = rgba(colorAtU(opts.color, frac, t * 0.03), (0.16 + 0.2 * q) * opts.alpha);
          ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 64. Recamán — the sequence a(n)=a±n drawn as alternating semicircles (the iconic
  //     tangled-yarn viz). σ grows the term count from a sparse handful to a dense weave.
  function recaman() {
    const MAX = 900;
    return base({
      title: "Recamán", _t: 0,
      _f(q) { return `a(n)=a±n,  ${Math.round(lerp(24, MAX, q))} terms`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t, terms = Math.round(lerp(24, MAX, q));
        const seq = [0], seen = { 0: 1 }; let cur = 0, mx = 0;
        for (let n = 1; n < terms; n++) { let nx = cur - n; if (nx < 0 || seen[nx]) nx = cur + n; seq.push(nx); seen[nx] = 1; if (nx > mx) mx = nx; cur = nx; }
        const pad = Math.min(w, h) * 0.06, sc = (w - 2 * pad) / (mx || 1), midY = h * 0.55;
        ctx.lineWidth = 1.1;
        for (let i = 1; i < seq.length; i++) {
          const a = seq[i - 1], b = seq[i], x0 = pad + Math.min(a, b) * sc, x1 = pad + Math.max(a, b) * sc, rr = (x1 - x0) / 2, up = (i % 2 === 0);
          ctx.strokeStyle = rgba(colorAtU(opts.color, i / seq.length, t * 0.03), (0.2 + 0.25 * q) * opts.alpha);
          ctx.beginPath(); ctx.arc((x0 + x1) / 2, midY, rr, up ? Math.PI : 0, up ? TAU : Math.PI); ctx.stroke();
        }
        endFrame(ctx);
      }
    });
  }

  // 65. Involute spiral — the string-unwinding curve, in a rotating fan of arms. Chaos
  //     detunes each arm's base angle into a tangle; order spaces them evenly for a clean
  //     gear-tooth rosette.
  function involute() {
    const ARMS = 5;
    return base({
      title: "Involute spiral", _t: 0,
      _f(q) { return `x=r(cosθ+θsinθ),  ${ARMS} arms`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, cx = w / 2, cy = h / 2, t = this._t;
        const thMax = lerp(2.2, 5, q) * TAU, base0 = Math.min(w, h) * 0.028, spin = t * 0.1;
        ctx.lineWidth = 1.3;
        for (let s = 0; s < ARMS; s++) {
          const off = s / ARMS * TAU + spin + (1 - q) * (hash2(s, 1) - 0.5) * 1.2, ca = Math.cos(off), sa = Math.sin(off);
          strokeRamp(ctx, opts.color, (0.16 + 0.16 * q) * opts.alpha,
            u => { const th = u * thMax, x = base0 * (Math.cos(th) + th * Math.sin(th)), y = base0 * (Math.sin(th) - th * Math.cos(th)); return [cx + x * ca - y * sa, cy + x * sa + y * ca]; },
            90, s / ARMS + t * 0.02);
        }
        endFrame(ctx);
      }
    });
  }

  // 66. Sierpiński carpet — the 3×3 remove-the-centre fractal. Chaos shakes every leaf square
  //     off its grid position (a rattled mosaic); order snaps them back to the crisp carpet.
  function sierpinskiCarpet() {
    const DEPTH = 4;
    return base({
      title: "Sierpiński carpet", _t: 0,
      _f(q) { return `3×3 remove-centre,  depth ${DEPTH}`; },
      draw(ctx, w, h, dt, opts) {
        frame(ctx, w, h, opts);
        const q = this.q, t = this._t, S = Math.min(w, h) * 0.86, x0 = (w - S) / 2, y0 = (h - S) / 2, jit = (1 - q) * 0.5;
        let idx = 0;
        const rec = (x, y, s, d) => {
          if (d === 0) {
            const jx = (hash2(idx, 1) - 0.5) * jit * s, jy = (hash2(idx, 2) - 0.5) * jit * s; idx++;
            ctx.fillStyle = rgba(colorAtU(opts.color, (x - x0) / S * 0.5 + (y - y0) / S * 0.5, t * 0.03), (0.14 + 0.5 * q) * opts.alpha);
            ctx.fillRect(x + jx, y + jy, s * 0.98, s * 0.98);
            return;
          }
          const ss = s / 3;
          for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) { if (gx === 1 && gy === 1) continue; rec(x + gx * ss, y + gy * ss, ss, d - 1); }
        };
        rec(x0, y0, S, DEPTH);
        endFrame(ctx);
      }
    });
  }

  const EXHIBITS = [lissajous, harmonograph, rose, rootsOfUnity, phyllotaxis, clifford, deJong, hopalong, superformula, chladni, primeSpiral, maurerRose, timesTable, spirograph, starPolygon, cellular, boids, life, lorenz, truchet, julia, moire, mandelbrot, logSpiral, koch, newton, fermatSpiral, hyperbolicSpiral, eulerSpiral, theodorus, dragon, hilbert, hypocycloid, lemniscate, mysticRose, chaosGame, fordCircles, sacksSpiral, doubleHelix, galaxy, sphericalSpiral, torusKnot, guilloche, torus, superellipseBloom, kuramoto, quasicrystal, epicycloidGears, aizawa, thomas, flowField, metaballs, mandala, stringArt, membrane, voronoi, fern, supershape3d, reactionDiffusion, icosahedron, plasma, kaleidoscope, doyleSpiral, recaman, involute, sierpinskiCarpet];

  /* ── the zoom pendulum (party only) ────────────────────────────────────────
     PARTY.spiralZoom() is the second swing on the same pendulum as σ — see
     party.js and PARTY-BRIEF §17. Applied here as a canvas transform about the
     centre, deliberately NOT as an offscreen blit: a blit would go mushy at
     exactly the depth where the dive is meant to reveal the most detail, while
     the transform stays vector-crisp at any zoom.

     Only ever magnifies (z >= 1). That is what keeps it safe: scaling UP about
     the centre also enlarges each exhibit's own background/fade rect, so it
     still over-covers the canvas and no stale border can appear. A z < 1 would
     shrink that rect inside the canvas and leave an un-faded ring — hence the
     clamp, not a config nicety.

     Per-exhibit opt-out via `ex.noZoom`; per-instance opt-in via `this.zoom`
     (the party projection wants it, the room background behind text does not). */
  function zoomFor(host, ex, pp) {
    if (!host.zoom || !pp || !ex || ex.noZoom) return 1;
    if (!root.PARTY || !root.PARTY.spiralZoom) return 1;
    const z = root.PARTY.spiralZoom();
    return (isFinite(z) && z > 1) ? z : 1;
  }
  function withZoom(ctx, w, h, z, fn) {
    if (z === 1) return fn();
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
    try { fn(); } finally { ctx.restore(); }
  }

  /* ── the LENS: magnify the middle, leave the frame alone ───────────────────
     K., on the uniform transform: *"the zoom is a bit harsh — is there a way to
     mostly magnify the middle rather than zooming in like this?"* Right reading:
     a uniform scale drags the whole frame outward, so the periphery rushes off
     the edges and the eye is pulled outward at the exact moment the dive is
     supposed to pull it IN.

     So instead of scaling the canvas, we scale each POINT by how close it is to
     the centre:  p' = c + (p - c) · s(u),  u = |p - c| / R,
     s(u) = 1 + (Z-1)·(1-u)^k   →   Z at the centre, easing to 1 at the corners.
     The frame stays put, the middle swells. That is a true centre magnification,
     not a crop.

     Why a ctx PROXY and not a pixel remap: a real fisheye needs a per-pixel
     resample (~900k px/frame) and would go soft exactly where it magnifies. The
     exhibits, though, draw in absolute canvas coordinates with NO internal
     translate/rotate/scale (audited: 0 of 36 draw functions use one), and they
     draw dense short segments and dots. So mapping each point as it is handed to
     the context gives the same result, stays vector-crisp, and costs one sqrt per
     point. Long straight lines cannot bow — they have no midpoints to bend — but
     no exhibit draws the long-line kind through this path.

     Two things the proxy must NOT map, or the screen breaks:
       - a full-canvas rect is a fade/clear, not content. Mapped, it would shrink
         inside the canvas and leave the un-faded ring (see the z>=1 note above).
         Detected by size and passed straight through.
       - radii (arc, radial gradients) scale by the LOCAL s at their centre, or
         the comet heads and dots would stay small inside a swollen field. */
  function lensScale(u, Z, k) { return 1 + (Z - 1) * Math.pow(Math.max(0, 1 - u), k); }

  function makeLens(ctx) {
    const L = { _ctx: ctx, _z: 1, _k: 2.2, _cx: 0, _cy: 0, _R: 1 };
    L.set = function (z, k, w, h) {
      // Both clamps guard the SAME failure: r'(r) = r·s(r/R) must stay monotonic, or
      // the field folds back through itself and creases visibly. Depth is capped at
      // 3.5, and a too-soft falloff folds too — measured: k must be >= 1.0 at Z=2,
      // 1.4 at Z=3, 1.7 at Z=3.5. `0.45·z + 0.15` sits just above that line, so the
      // "zoom spread" slider cannot be dragged into a crease at any depth.
      this._uniform = false;
      this._z = Math.min(3.5, z);
      this._k = Math.max(k, 0.45 * this._z + 0.15);
      this._geom(w, h);
    };
    // In-frame breathing: ONE scale for every point, about the centre. Kept on the
    // same proxy purely so the full-canvas fade rect still passes through unmapped —
    // a plain ctx.scale(s<1) would shrink the fade rect and leave an un-faded ring,
    // the exact z<1 failure the proxy was built to dodge. s<=1 here, so nothing can
    // ever leave the frame.
    L.setUniform = function (s, w, h) { this._uniform = true; this._us = s; this._geom(w, h); };
    L._geom = function (w, h) {
      this._cx = w / 2; this._cy = h / 2;
      this._R = Math.hypot(w, h) / 2;                 // corners, so s→1 at the frame
      this._w = w; this._h = h;
    };
    L._s = function (x, y) {
      if (this._uniform) return this._us;
      const dx = x - this._cx, dy = y - this._cy;
      return lensScale(Math.hypot(dx, dy) / this._R, this._z, this._k);
    };
    L._x = function (x, y) { return this._cx + (x - this._cx) * this._s(x, y); };
    L._y = function (x, y) { return this._cy + (y - this._cy) * this._s(x, y); };

    // point-mapped
    ["moveTo", "lineTo"].forEach(m => {
      L[m] = function (x, y) { ctx[m](this._x(x, y), this._y(x, y)); };
    });
    L.arc = function (x, y, r, a0, a1, ccw) {
      const s = this._s(x, y);
      ctx.arc(this._x(x, y), this._y(x, y), Math.max(0.1, r * s), a0, a1, ccw);
    };
    L.quadraticCurveTo = function (cx, cy, x, y) {
      ctx.quadraticCurveTo(this._x(cx, cy), this._y(cx, cy), this._x(x, y), this._y(x, y));
    };
    L.bezierCurveTo = function (a, b, c, d, x, y) {
      ctx.bezierCurveTo(this._x(a, b), this._y(a, b), this._x(c, d), this._y(c, d),
                        this._x(x, y), this._y(x, y));
    };
    ["fillRect", "strokeRect"].forEach(m => {
      L[m] = function (x, y, rw, rh) {
        // a full-canvas rect is the trail fade / clear — never distort it
        if (x <= 0.5 && y <= 0.5 && rw >= this._w - 1 && rh >= this._h - 1) return ctx[m](x, y, rw, rh);
        const mx = x + rw / 2, my = y + rh / 2, s = this._s(mx, my);
        ctx[m](this._x(mx, my) - rw * s / 2, this._y(mx, my) - rh * s / 2, rw * s, rh * s);
      };
    });
    L.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
      const s = this._s(x1, y1);
      return ctx.createRadialGradient(this._x(x0, y0), this._y(x0, y0), r0 * s,
                                      this._x(x1, y1), this._y(x1, y1), r1 * s);
    };
    L.fillText = function (t, x, y) { ctx.fillText(t, this._x(x, y), this._y(x, y)); };

    // straight passthrough
    ["beginPath", "closePath", "stroke", "fill", "clip", "save", "restore", "rotate",
     "translate", "scale", "setTransform", "putImageData", "createLinearGradient",
     "getImageData", "measureText", "ellipse", "arcTo", "rect", "drawImage"].forEach(m => {
      L[m] = function () { return ctx[m].apply(ctx, arguments); };
    });
    ["fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "globalCompositeOperation",
     "font", "textAlign", "lineCap", "lineJoin", "shadowBlur", "shadowColor",
     "imageSmoothingEnabled"].forEach(p => {
      Object.defineProperty(L, p, { get: () => ctx[p], set: v => { ctx[p] = v; } });
    });
    Object.defineProperty(L, "canvas", { get: () => ctx.canvas });
    return L;
  }

  // `z` is the pendulum DEPTH (1 = rest … zoomMax = deepest). How it becomes pixels
  // depends on config.zoomOffscreen:
  //
  //   in-frame (default) — the whole picture stays visible. Depth maps to a uniform
  //     scale in [zoomFit, 1]: rest fills the frame, the deepest dive shrinks it to
  //     zoomFit. Nothing ever crosses the edge. This is what K. asked for — "zoom
  //     out and in where everything stays inside the frame."
  //   off-screen — the old dive that may magnify past the edge, either as the
  //     centre-weighted lens (zoomMode 0) or a flat whole-frame scale (zoomMode 1).
  function drawZoomed(host, ctx, w, h, z, draw) {
    if (z === 1) return draw(ctx);
    const cfg = (root.PARTY && root.PARTY.config) || {};

    if (!cfg.zoomOffscreen) {
      // depth 1..zoomMax  →  scale 1..zoomFit  (grow to fill / shrink toward centre)
      const hi = (cfg.zoomMax == null ? 3.2 : cfg.zoomMax);
      const fit = (cfg.zoomFit == null ? 0.4 : cfg.zoomFit);
      const t = (hi > 1) ? clamp((z - 1) / (hi - 1), 0, 1) : 0;
      const s = 1 - t * (1 - fit);
      if (s >= 0.999) return draw(ctx);              // effectively full frame
      host._lens = host._lens || makeLens(ctx);
      host._lens.setUniform(s, w, h);
      return draw(host._lens);
    }

    if (cfg.zoomMode === 1) return withZoom(ctx, w, h, z, () => draw(ctx));
    host._lens = host._lens || makeLens(ctx);
    host._lens.set(z, cfg.zoomFalloff || 2.2, w, h);
    draw(host._lens);
  }

  /* ── OVERLAP: two exhibits in one frame ────────────────────────────────────
     Request 14.2, and K.'s *"a toggle to leave the previous effect spiral on the
     background of the next"* — the same mechanism, one as a transition and one
     sustained. `overlapMode`: 0 off · 1 transition (the underlay decays away) ·
     2 persistent (it stays for the whole dwell).

     ⚠ TWO TRAPS, and they dictate the shape of this code.

     1. DOUBLE-DARKENING. Most exhibits call frame(), which paints a per-frame
        rgba(4,5,10,fade) rect to make trails decay. Two layers = two fade rects =
        trails dying twice as fast and BOTH patterns looking thin and starved. So
        exactly ONE fade happens per frame, here, and both layers are handed
        `fade: 0`. The layers never fade the canvas themselves while overlapping.

     2. THE OPAQUE NINE. primeSpiral, sacksSpiral, cellular, life, truchet, julia,
        moire, mandelbrot and newton repaint the entire frame every tick and ignore
        opts.fade — they ERASE whatever is under them. So an opaque exhibit can only
        ever be the BOTTOM layer, and when it is there it owns the frame (no extra
        fade — it is already clearing). Two opaque candidates cannot be combined at
        all: whichever draws second wipes the first, so overlap is skipped and the
        top one simply plays alone. That is a mechanical constraint, not a taste
        call — ignoring it renders one exhibit and reads as a bug. */
  function overlapCfg() {
    const c = (root.PARTY && root.PARTY.config) || {};
    return {
      mode:   c.overlapMode   == null ? 0    : c.overlapMode,
      amount: c.overlapAmount == null ? 0.45 : c.overlapAmount,
      secs:   c.overlapFade   == null ? 12   : c.overlapFade,
    };
  }

  // Decide the frame's layers. Returns { under, top, ownsFrame } where `ownsFrame`
  // means the bottom layer is opaque and will clear the canvas itself.
  function layersFor(host, ex, level) {
    const o = overlapCfg();
    const allow = t => !(root.PARTY && root.PARTY.overlapAllowed) || root.PARTY.overlapAllowed(t);
    let under = (o.mode && level > 0.001 && host._under && host._under !== ex) ? host._under : null;
    // Either exhibit can veto being layered (the expensive ones are the likely
    // customers — overlap roughly doubles render cost).
    if (under && (!allow(under.title) || !allow(ex.title))) under = null;
    if (!under) return { under: null, top: ex, ownsFrame: !!ex.opaque, amount: 0 };
    // Both opaque → no pairing exists that shows both. Drop the underlay.
    if (under.opaque && ex.opaque) return { under: null, top: ex, ownsFrame: true, amount: 0 };
    // An opaque exhibit must be underneath, whichever one it is.
    if (ex.opaque) return { under: ex, top: under, ownsFrame: true, amount: level * o.amount, swapped: true };
    return { under, top: ex, ownsFrame: !!under.opaque, amount: level * o.amount };
  }

  // Called by a host when it switches exhibit. Keeps the OUTGOING INSTANCE, not a
  // fresh one — its accumulated state (a Life board mid-generation, an attractor's
  // point cloud, a boid flock) is exactly what makes an underlay worth looking at.
  function pushUnder(host, prevEx) {
    if (!prevEx) return;
    host._under = prevEx;
    host._underLevel = 1;
  }
  function underTick(host, dt, tune) {
    const o = overlapCfg();
    if (!o.mode || !host._under) { host._underLevel = 0; return; }
    if (o.mode === 1) {                                  // transition: decay away
      host._underLevel = Math.max(0, (host._underLevel || 0) - dt / Math.max(0.1, o.secs));
      if (host._underLevel <= 0) { host._under = null; return; }
    } else {
      host._underLevel = 1;                              // persistent: hold
    }
    host._under.update(dt, tune);   // keep it alive, or the underlay is a frozen still
  }

  /* Draw one or two layers. The single-layer path is deliberately byte-identical to
     what it was before overlap existed — the exhibit still owns its own fade — so
     turning overlap off cannot change how anything looks. */
  function drawLayers(host, ctx, w, h, dt, ex, pp, opts) {
    const L = layersFor(host, ex, host._underLevel || 0);
    if (!L.under) {
      drawZoomed(host, ctx, w, h, zoomFor(host, ex, pp), c => ex.draw(c, w, h, dt, opts));
      return L;
    }
    // ONE fade for the frame — never one per layer (see the double-darkening note).
    // Skipped when the bottom layer is opaque, since it hard-clears anyway.
    if (!L.ownsFrame) { ctx.fillStyle = `rgba(4,5,10,${opts.fade})`; ctx.fillRect(0, 0, w, h); }
    const under = Object.assign({}, opts, { alpha: opts.alpha * L.amount, fade: 0 });
    const top   = Object.assign({}, opts, { fade: 0 });
    drawZoomed(host, ctx, w, h, zoomFor(host, L.under, pp), c => L.under.draw(c, w, h, dt, under));
    drawZoomed(host, ctx, w, h, zoomFor(host, L.top, pp),   c => L.top.draw(c, w, h, dt, top));
    return L;
  }

  /* ── SymmetryGallery: foreground, interactive ──────────────────────────── */
  class SymmetryGallery {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext("2d");
      this.exhibits = EXHIBITS.map(f => f());
      this.index = 0; this.tune = -0.7; this.locked = false;
      this._clearNext = true;
      this.zoom = true;          // foreground, no text over it — the dive belongs here
    }
    get ownsCanvas() { return true; }
    get current() { return this.exhibits[this.index]; }
    reset() { this._clearNext = true; this._bloomFade = 0; }   // bloom eases up on entering, never snaps
    pop(a) { this._pulse = Math.min(1.4, (this._pulse || 0) + (a == null ? 0.6 : a)); }
    nudge(dir) { this.tune = clamp(this.tune + dir * 0.16, -1, 1); }
    next() {
      pushUnder(this, this.current);
      this.index = (this.index + 1) % this.exhibits.length; this.tune = -0.7; this.locked = false;
      // Only hard-clear when nothing is meant to survive the switch — a clear would
      // wipe the underlay we just kept.
      this._clearNext = !overlapCfg().mode;
    }
    sigma() { return this.current.sigma(); }
    draw(dt) {
      const { ctx, canvas } = this, w = canvas.width, h = canvas.height, ex = this.current;
      if (this._clearNext) { ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h); this._clearNext = false; }
      const pp = partySpiral();
      if (pp && root.PARTY && root.PARTY.spiralTune) this.tune = root.PARTY.spiralTune(); // σ breathes with the swing
      ex.update(dt, this.tune);
      underTick(this, dt, this.tune);
      const sig = ex.sigma(), color = orderColor(sig, pp ? pp.palette : null);
      // Exhibit dives; HUD and bloom stay outside the transform — the bloom is a
      // screen-space glow and the σ meter must not fly off-screen.
      drawLayers(this, ctx, w, h, dt, ex, pp, { alpha: 1, fade: 0.08, color });
      this._bt = (this._bt || 0) + dt;
      this._pulse = Math.max(0, (this._pulse || 0) - dt * 2.6);   // press flare decays fast
      this._bloomFade = ease(this._bloomFade || 0, 1, dt, 0.5);   // slow rise-in on entrance (~4s to full)
      drawSuperfluidBloom(ctx, w, h, sig, color, this._bt, this._bloomFade, this._pulse, pp ? pp.palette[3] : null);
      this._hud(ctx, w, h, ex, sig, color);
    }
    _hud(ctx, w, h, ex, sig, color) {
      const mono = `"Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(color, 0.9); ctx.font = `${Math.max(15, h * 0.026)}px ${mono}`;
      ctx.fillText(ex.title, w / 2, h * 0.12);
      ctx.fillStyle = "rgba(200,210,235,0.8)"; ctx.font = `${Math.max(13, h * 0.02)}px ${mono}`;
      ctx.fillText(ex.formula(sig), w / 2, h * 0.17);
      // σ meter — the "order" bar
      const bw = w * 0.34, bx = (w - bw) / 2, by = h * 0.9;
      ctx.strokeStyle = "rgba(90,100,130,0.4)"; ctx.strokeRect(bx, by, bw, 10);
      ctx.fillStyle = rgba(color, 0.9); ctx.fillRect(bx, by, bw * sig, 10);
      ctx.fillStyle = "rgba(150,160,190,0.7)"; ctx.font = `${Math.max(11, h * 0.016)}px ${mono}`;
      ctx.fillText(`σ = ${sig.toFixed(2)}   ${sig > 0.9 ? "— symmetry reached —" : "chaos → symmetry"}`, w / 2, by - 10);
    }
  }

  /* ── AmbientDirector: always-on background, autopilot, dim ──────────────── */
  class AmbientDirector {
    constructor(canvas, opts) {
      this.canvas = canvas; this.ctx = canvas.getContext("2d");
      // its own instances. TWO HATS, and they want different pools:
      //   default (brain.js) — a calm rotation, skipping the loud prime spiral, because
      //     there it is the dim background BEHIND readable menu text.
      //   { full: true } (party-main.js) — all 66, because there it IS the projection.
      // Without the opt-in the party could only ever show 13 of 66; the other 53 (every
      // fractal, every named spiral) were unreachable. Same split as `this.zoom`.
      this.pool = (opts && opts.full)
        ? EXHIBITS.map(f => f())
        : [lissajous(), harmonograph(), rose(), phyllotaxis(), clifford(), superformula(), chladni(), maurerRose(), spirograph(), timesTable(), boids(), lorenz(), truchet()];
      this.index = 0; this._t = 0; this._dwell = 26; this.tint = null; this._clearNext = true;
      // OFF by default. This same class is the dim background behind menu rooms
      // (brain.js) with readable text on top, where a shape swelling to 3× is just
      // a moving smear. party-main.js — where it IS the whole projection — opts in.
      this.zoom = false;
    }
    setTint(hex) { this.tint = hex || null; }
    // Title → pool index. Falls back to the old hash so an unknown id still resolves to
    // *something* rather than freezing on index 0.
    indexOfTitle(title) {
      const i = this.pool.findIndex(ex => ex.title === title);
      return i >= 0 ? i : hashIndex(title, this.pool.length);
    }
    pop(a) { this._pulse = Math.min(1.4, (this._pulse || 0) + (a == null ? 0.6 : a)); }
    draw(dt) {
      const { ctx, canvas } = this, w = canvas.width, h = canvas.height;
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight; this._clearNext = true;
      }
      if (this._clearNext) { ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, w, h); this._clearNext = false; }
      this._t += dt;
      const pp = partySpiral();
      if (pp && root.PARTY) {
        // Party drives the SHAPE: cycling changes activeSpiralId → a different exhibit,
        // eased in (bloomFade reset, no hard clear) so the swap crossfades, not cuts.
        // The id IS the exhibit title, so this is a lookup, not a hash — "Julia set"
        // draws the Julia set. hashIndex stays only as the fallback for an id this pool
        // doesn't contain (the calm 13-exhibit hat, or a stale saved name).
        const idx = this.indexOfTitle(root.PARTY.activeSpiralId || "");
        if (idx !== this.index) { pushUnder(this, this.pool[this.index]); this.index = idx; this._bloomFade = 0; }
      } else if (this._t > this._dwell) {
        this._t = 0; pushUnder(this, this.pool[this.index]);
        this.index = (this.index + 1) % this.pool.length;
        this._clearNext = !overlapCfg().mode;   // a clear would wipe the underlay
        this._bloomFade = 0;
      }
      const ex = this.pool[this.index];
      // party: σ breathes with the swing; standalone: slow autopilot chaos→symmetry sweep
      const autoTune = (pp && root.PARTY && root.PARTY.spiralTune) ? root.PARTY.spiralTune() : Math.sin(this._t * 0.14) * 0.9;
      ex.update(dt, autoTune);
      underTick(this, dt, autoTune);
      const color = orderColor(ex.sigma(), pp ? pp.palette : this.tint);
      // THE ORGANISM MIX (party only — web/viz/organisms.js). In the main house there is
      // no PARTY, so orgFade stays 0 and this director draws EXACTLY as before: a pure
      // no-op, and this._org is never even allocated (house-safe).
      let orgFade = 0, orgW = null, bloomCede = 1, orgPlace = 0, orgPlaceMode = 0, orgPossess = 0;
      // root.ORGANISMS gate is load-bearing, not just tidy: without it a page that runs the
      // party ambient but never loads organisms.js would fade the spiral yet draw no body —
      // a black screen. If the module is absent, orgFade stays 0 and the spiral stays whole.
      // Same gate is why bloomCede is a LOCAL (default 1): reading root.PARTY.config at the
      // unconditional bloom line below would throw in the main house where PARTY is absent.
      if (pp && root.PARTY && root.PARTY.config && root.ORGANISMS) {
        const c = root.PARTY.config;
        const oa = clamp(c.orgAmount || 0, 0, 1);
        const wS = clamp(c.orgSyn || 0, 0, 1), wM = clamp(c.orgSlime || 0, 0, 1),
              wF = clamp(c.orgFluid || 0, 0, 1), wV = clamp(c.orgVicsek || 0, 0, 1),
              wW = clamp(c.orgWiring || 0, 0, 1), wFerro = clamp(c.orgFerro || 0, 0, 1);
        const raw = wS + wM + wF + wV + wW + wFerro;
        orgPlace = clamp(c.orgPlace || 0, 0, 1);
        orgPlaceMode = (c.orgPlaceMode || 0) | 0;
        orgPossess = clamp(c.orgPossess || 0, 0, 1);
        if (oa > 0 && raw > 0) {
          // RISK 1 (Fable): derive the spiral fade from ACTUAL organism content on screen,
          // never the raw orgAmount knob — else orgAmount=1 with every weight 0 (reachable
          // via reset/dice/a bad preset) fades the spiral to nothing with no organism drawn:
          // a dead black screen mid-party. min(1,Σw) guarantees the spiral only recedes as
          // far as a body actually fills in.
          // MASTER BRIGHTNESS first — the guards below must key off the organism ACTUALLY drawn
          // (glow-scaled), not raw presence (Fable Risk 1): otherwise a low orgGlow fades the
          // spiral AND cedes the bloom while drawing almost nothing → a screen darker than
          // organisms-off. `vis` is how much organism is really on screen.
          // GAMMA on the master brightness: the bodies composite ADDITIVELY (organisms.js
          // "lighter"), so a linear glow saturated to white by ~0.5 — the top half of the
          // slider did nothing but clip harder. Squaring maps the slider's default 0.5 to an
          // effective 0.25, moving the hot response up-slider so the whole travel is usable.
          // vis (spiral fade + bloom-cede) rides the SAME curved value, so they stay in step.
          const glowRaw = clamp(c.orgGlow == null ? 0.5 : c.orgGlow, 0, 1);
          // orgCeiling is the gentle-peak cap: fold it in HERE, before the composite, so it
          // scales the drawn bodies AND vis (spiral fade / bloom-cede) together — a lower
          // ceiling makes the whole top end softer without desyncing the crossfade.
          const ceiling = clamp(c.orgCeiling == null ? 1 : c.orgCeiling, 0, 1);
          const glow = glowRaw * glowRaw * ceiling;
          const vis = glow * Math.min(1, raw);
          orgW = { syn: oa * wS * glow, slime: oa * wM * glow, fluid: oa * wF * glow,
                   vicsek: oa * wV * glow, wiring: oa * wW * glow, ferro: oa * wFerro * glow };
          // NEVER-BLANK: the spiral only recedes as far as VISIBLE organism fills in; the extra
          // (1-0.4*place) keeps ≥40% of the spiral showing through the grown fill.
          orgFade = oa * vis * (1 - 0.4 * orgPlace);
          // BLOOM CEDE: the side-orbs recede only as the (visible) organism grows out to own them.
          bloomCede = 1 - orgPlace * vis * 0.85;
        }
      }
      // alpha 0.5→0.72 is the biggest single vividness win (the party spiral read pastel
      // at 50%); fade 0.05→0.035 keeps trails a touch crisper so colour doesn't grey toward
      // the #04050a background. Party-only — the room background director keeps its own alpha.
      // The (1−orgFade) factor crossfades the spiral UNDER the organism.
      // params rides through to ex.draw so a CONTRIBUTED spiral renders at the guest's own
      // value (e.g. Phyllotaxis at the angle they found) — the party-only "becomes real" path.
      drawLayers(this, ctx, w, h, dt, ex, pp, { alpha: 0.72 * (1 - orgFade), fade: 0.035, color, tint: this.tint, params: pp ? pp.params : null });
      // PROTOTYPE — substrate image override (neon-cat Option A, 2026-09-11). party-main sets
      // `director.substrate` from an image the operator loads. When present it is blitted over
      // the spiral so the possession sample (below) and the organism attach to THIS picture — a
      // cat / hand-drawn spiral — instead of the procedural exhibit. Drawn BEFORE the possession
      // sample so it is what gets sampled. Default (unset) = byte-for-byte the old behaviour.
      if (this.substrate && this.substrate.complete && this.substrate.naturalWidth) {
        const iw = this.substrate.naturalWidth, ih = this.substrate.naturalHeight;
        const sc = Math.max(w / iw, h / ih), dw = iw * sc, dh = ih * sc;   // cover the whole frame
        const _pOp = ctx.globalCompositeOperation, _pA = ctx.globalAlpha;
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.drawImage(this.substrate, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.globalCompositeOperation = _pOp; ctx.globalAlpha = _pA;
      }
      // the living body, additive, over the faded spiral and under the bloom
      if (orgW && root.ORGANISMS) {
        if (!this._org) this._org = root.ORGANISMS.create(20250820);
        this._org.setControls(orgPlace, orgPlaceMode, orgPossess);
        // POSSESSION: sample the ALREADY-DRAWN spiral (painted by drawLayers just above) into a
        // luminance terrain the sim feeds on. Throttled every 4th frame; guarded; browser-only
        // (headless has no canvas → terrain stays null → every coupling no-ops).
        if (orgPossess > 0 && typeof document !== "undefined") {
          this._pfc = ((this._pfc || 0) + 1) % 4;
          if (this._pfc === 0 || !this._org.terrain) {
            try {
              const TG = 120;
              if (!this._pbuf) { this._pbuf = document.createElement("canvas"); this._pbuf.width = TG; this._pbuf.height = TG; this._pbx = this._pbuf.getContext("2d"); }
              this._pbx.drawImage(canvas, 0, 0, TG, TG);
              const pd = this._pbx.getImageData(0, 0, TG, TG).data;
              let terr = (this._org.terrain && this._org.tgw === TG) ? this._org.terrain : new Float32Array(TG * TG);
              let mean = 0;
              for (let i = 0; i < TG * TG; i++) { const o = i * 4; const l = (0.299 * pd[o] + 0.587 * pd[o + 1] + 0.114 * pd[o + 2]) / 255; terr[i] = l; mean += l; }
              mean /= TG * TG;
              // CONTRAST, not absolute brightness: subtract the frame average so possession responds
              // to where the spiral is brighter THAN its surroundings (its curves/arms), not to flat
              // fill. Fixes the "big-bright exhibit (Mandelbrot interior) floods the whole field to
              // white" — a uniformly-lit frame now has near-zero terrain everywhere. (vicsek uses the
              // gradient, unaffected by the constant offset; this only tames slime-food + fluid-glow.)
              for (let i = 0; i < TG * TG; i++) { const v = (terr[i] - mean) * 2.2; terr[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
              this._org.setTerrain(terr, TG, TG);
            } catch (e) { /* tainted / unsupported — skip possession this frame */ }
          }
        }
        this._org.step(dt, ex.sigma(), orgW);
        this._org.draw(ctx, w, h, ex.sigma(), pp.palette, orgW);
      }
      this._bt = (this._bt || 0) + dt;
      this._pulse = Math.max(0, (this._pulse || 0) - dt * 2.6);
      this._bloomFade = ease(this._bloomFade || 0, 1, dt, 0.4);   // gentle rise-in on each exhibit switch
      drawSuperfluidBloom(ctx, w, h, ex.sigma(), color, this._bt, 0.55 * this._bloomFade * bloomCede, this._pulse, pp ? pp.palette[3] : null);
    }
  }

  root.SymmetryGallery = SymmetryGallery;
  root.AmbientDirector = AmbientDirector;
  // EXHIBIT_TITLES is the authority on what shapes exist. party.js keeps its own copy
  // (it must stay dependency-free for the node tests); catalog.test.js asserts the two
  // agree. That test is the guard — 25 exhibits went missing precisely because two
  // lists drifted apart with nothing checking.
  // LAZY on purpose: reading a title means building the exhibit, and some are expensive
  // (Chladni's 46² grid, the Life soup, the escape-time buffers). spread.test.js
  // re-evaluates this module once per exhibit, so an eager list cost 38×38 builds and
  // hung the suite. Cached after the first read.
  let _titles = null;
  root.SYM = { sigmaToPad, orderColor, drawSuperfluidBloom,
               buildHelix: doubleHelix,  // configured instances for helix-lab.html
               _layersFor: layersFor,   // exposed for overlap.test.js
               // makeExhibit(i) → a fresh instance of EXHIBITS[i], index-aligned with
               // EXHIBIT_TITLES. Lets a standalone lab page (experiments.html) render any
               // exhibit without going through the director. Accepts an index or a title.
               makeExhibit(idx) {
                 const i = typeof idx === "number" ? idx : this.EXHIBIT_TITLES.indexOf(idx);
                 return EXHIBITS[i] ? EXHIBITS[i]() : null;
               },
               get EXHIBIT_TITLES() { return _titles || (_titles = EXHIBITS.map(f => f().title)); } };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SYM;
})();
