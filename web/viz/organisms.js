/* organisms.js — living render modes for the party ambient.
 *
 * Ports web/organisms.html (the SUB node-graph skeleton + the Synaptic / Slime /
 * Superfluid renderers) into a module the AmbientDirector draws OVER the spiral,
 * plus a 4th mode (Vicsek murmuration, added in a later commit). One shared skeleton,
 * several bodies, mixed by weight.
 *
 * DE-RANDOMISED — party.js and its tests are deterministic by contract, so every
 * random here flows through ONE seeded rng (`S.rnd`). The lab had four `Math.random`
 * sites (Syn spontaneous ignition, Fluid edge fallback, init, regen); none survive.
 *
 * HEADLESS SPLIT — the expensive compute (agent stepping, the slime grid diffusion)
 * lives in `step()` and uses arrays only, so the perf smoke can measure it under node.
 * Only `draw()` touches a canvas / `document`; it is a no-op headless.
 *
 * NO dependency on symmetry.js: the palette arrives as an array of hex strings each
 * frame (the party's active light-scene), so the organism wears the same colours as
 * the lamps. Browser (window.ORGANISMS) + bare node (module.exports), guarded — same
 * dual-export discipline as palettes.js / party.js.
 */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : globalThis;
  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hexRgb(h) { h = (h || "8E7CC3").replace("#", ""); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }

  // Below this effective weight a mode is neither stepped nor drawn (the lab's perf
  // trick, extended: nothing costs anything when its slider is down).
  var GATE = 0.01;

  // A ramp over an arbitrary palette (array of [r,g,b]). t 0..1 across the scheme.
  function makeRamp(cols) {
    var n = cols.length;
    return function (t) {
      t = clamp(t, 0, 1) * (n - 1);
      var i = Math.floor(t), f = smooth(t - i), a = cols[i], b = cols[Math.min(n - 1, i + 1)];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
  }

  // ── the shared skeleton: nodes + edges, wobbling at chaos, locked at order ──────
  function buildSUB(seed, S) {
    var rnd = mulberry32(seed), N = 108, pts = [], tries = 0, minD = 0.135, i, j;
    while (pts.length < N && tries < 9000) { tries++;
      var a = rnd() * TAU, r = Math.sqrt(rnd()) * 0.9, p = [Math.cos(a) * r, Math.sin(a) * r], ok = true;
      for (i = 0; i < pts.length; i++) { var dx = pts[i][0] - p[0], dy = pts[i][1] - p[1]; if (dx * dx + dy * dy < minD * minD) { ok = false; break; } }
      if (ok) pts.push(p);
    }
    N = pts.length;
    var edges = [], seen = {}, adj = []; for (i = 0; i < N; i++) adj.push([]);
    for (i = 0; i < N; i++) {
      var d = []; for (j = 0; j < N; j++) { if (j === i) continue; var ex = pts[i][0] - pts[j][0], ey = pts[i][1] - pts[j][1]; d.push([ex * ex + ey * ey, j]); }
      d.sort(function (u, v) { return u[0] - v[0]; });
      for (var k = 0; k < 3 && k < d.length; k++) { var jj = d[k][1], key = Math.min(i, jj) + "_" + Math.max(i, jj);
        if (seen[key]) continue; seen[key] = 1; edges.push([i, jj]); adj[i].push(jj); adj[jj].push(i); }
    }
    var wob = []; for (i = 0; i < N; i++) wob.push([rnd() * TAU, 0.05 + rnd() * 0.09, rnd() * TAU]);
    return {
      N: N, base: pts, edges: edges, adj: adj, wob: wob, seed: seed,
      deg: pts.map(function (_, ii) { return adj[ii].length; }),
      // node position in normalized [-1,1] space, given σ + time (chaos wobbles, order stills)
      pos: function (i, sigma, t) {
        var b = this.base[i], w = this.wob[i], amp = (1 - sigma) * w[1];
        return [b[0] + Math.cos(w[0] + t * 0.7) * amp, b[1] + Math.sin(w[2] + t * 0.6) * amp];
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  A — SYNAPTIC : neurons firing along the web (echoes the constellation look)
  // ═══════════════════════════════════════════════════════════════════════════════
  function makeSyn(SUB) {
    return {
      sig: [], refr: new Float32Array(SUB.N), fire: new Float32Array(SUB.N), _pace: 0,
      reset: function () { this.sig = []; this.refr = new Float32Array(SUB.N); this.fire = new Float32Array(SUB.N); this._pace = 0; },
      step: function (dt, S) {
        var N = SUB.N, sigma = S.sigma, i;
        for (i = 0; i < N; i++) { if (this.refr[i] > 0) this.refr[i] -= dt; if (this.fire[i] > 0) this.fire[i] = Math.max(0, this.fire[i] - dt * 2.2); }
        // spontaneous ignition: chaos = scattered (seeded) random, order = a pacemaker beating in rhythm
        this._pace += dt * (0.5 + sigma * 0.9);
        var wantOrder = sigma > 0.5 && (this._pace % 1) < dt * (0.5 + sigma * 0.9) * 1.02;
        if (wantOrder) { this._ignite((SUB.seed >> 3) % N, S); }
        if (S.rnd() < (0.9 * (1 - sigma) + 0.05) * dt * 12) { this._ignite((S.rnd() * N) | 0, S); }  // was Math.random — seeded
        var out = [];
        for (i = 0; i < this.sig.length; i++) { var s = this.sig[i]; s.u += dt * s.v;
          if (s.u >= 1) { this._arrive(s.to, s.from, S); } else out.push(s); }
        this.sig = out.length > 600 ? out.slice(out.length - 600) : out;
      },
      _ignite: function (i, S) { if (this.refr[i] > 0) return; this._arrive(i, -1, S); },
      _arrive: function (i, from, S) {
        if (this.refr[i] > 0) return;
        this.fire[i] = 0.5; this.refr[i] = 0.32 + (1 - S.sigma) * 0.4;
        var nb = SUB.adj[i], prob = 0.55 + S.sigma * 0.4;
        for (var k = 0; k < nb.length; k++) { var j = nb[k]; if (j === from) continue; if (S.rnd() < prob && this.sig.length < 600)
          this.sig.push({ from: i, to: j, u: 0, v: (1.1 + S.sigma * 1.6) }); }
      },
      draw: function (ctx, M, S, alpha, ramp) {
        var N = SUB.N, sigma = S.sigma, t = S.t, e, i, s;
        ctx.lineWidth = M.R * 0.003;
        for (e = 0; e < SUB.edges.length; e++) { var a = SUB.edges[e][0], b = SUB.edges[e][1];
          var pa = M.px(SUB.pos(a, sigma, t)), pb = M.px(SUB.pos(b, sigma, t));
          var col = ramp(0.25 + 0.4 * Math.sin(e * 0.3 + t * 0.2));
          ctx.strokeStyle = rgba(col, (0.05 + 0.10 * sigma) * alpha);
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        }
        for (s = 0; s < this.sig.length; s++) { var sg = this.sig[s];
          var pa2 = SUB.pos(sg.from, sigma, t), pb2 = SUB.pos(sg.to, sigma, t);
          var x = lerp(pa2[0], pb2[0], sg.u), y = lerp(pa2[1], pb2[1], sg.u), p = M.px([x, y]);
          var col2 = ramp(0.7 + 0.3 * Math.sin(sg.from));
          ctx.fillStyle = rgba(col2, 0.85 * alpha);
          ctx.beginPath(); ctx.arc(p[0], p[1], M.R * 0.006, 0, TAU); ctx.fill();
        }
        for (i = 0; i < N; i++) { var p2 = M.px(SUB.pos(i, sigma, t)), deg = SUB.deg[i];
          var rr = M.R * (0.006 + 0.012 * Math.pow(Math.min(deg, 6) / 6, 0.6)) * (1 + this.fire[i] * 1.6);
          var col3 = ramp(0.15 + 0.7 * (deg / 6));
          // somata: a tighter glow (×2.3, was ×3) at a calmer resting alpha (0.32, was 0.5) so a
          // frame full of them reads as a fine web of points, not a scatter of blown-white orbs —
          // the fire flash still punches through when a neuron actually spikes.
          var g = ctx.createRadialGradient(p2[0], p2[1], 0, p2[0], p2[1], rr * 2.3);
          g.addColorStop(0, rgba(col3, (0.32 + 0.5 * this.fire[i]) * alpha)); g.addColorStop(1, rgba(col3, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p2[0], p2[1], rr * 2.3, 0, TAU); ctx.fill();
        }
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  B — SLIME MOLD : Physarum agents grow veins onto the node food (Jones 2010)
  //  step() is array-only (headless-measurable); draw() is browser-only.
  // ═══════════════════════════════════════════════════════════════════════════════
  function makeSlime(SUB, S) {
    // Party grid is a touch lighter than the lab's 200×140 / 2200 — bounded compute,
    // so a full-weight slime alongside the heaviest exhibit can't run away. Still reads.
    var GW = 180, GH = 126, A = 1800;
    return {
      ok: false, gw: GW, gh: GH, buf: null, _fw: 1, spiralFood: null, possess: 0,
      reset: function () {
        var L = GW * GH, i;
        this.trail = new Float32Array(L); this.tmp = new Float32Array(L); this.food = new Float32Array(L);
        for (i = 0; i < SUB.N; i++) { var b = SUB.base[i];
          var fx = (b[0] * 0.9 * 0.5 + 0.5) * GW, fy = (b[1] * 0.9 * 0.5 + 0.5) * GH;
          for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var x = (fx + dx) | 0, y = (fy + dy) | 0;
            if (x < 0 || y < 0 || x >= GW || y >= GH) continue; var d2 = dx * dx + dy * dy; this.food[y * GW + x] += Math.exp(-d2 / 8); } }
        this.ag = new Float32Array(A * 3); var rnd = mulberry32(SUB.seed ^ 0x9e37);
        for (i = 0; i < A; i++) { var nb = SUB.base[(rnd() * SUB.N) | 0];
          this.ag[i * 3] = (nb[0] * 0.9 * 0.5 + 0.5) * GW + (rnd() - 0.5) * 10;
          this.ag[i * 3 + 1] = (nb[1] * 0.9 * 0.5 + 0.5) * GH + (rnd() - 0.5) * 10;
          this.ag[i * 3 + 2] = rnd() * TAU; }
        this.buf = null; this.ok = true;                 // ok regardless of document — step() needs no canvas
      },
      _sense: function (x, y) { var GW = this.gw, GH = this.gh; var ix = ((x + GW) % GW) | 0, iy = ((y + GH) % GH) | 0, idx = iy * GW + ix;
        var v = this.trail[idx] + this.food[idx] * this._fw;
        if (this.spiralFood) v += this.spiralFood[idx] * this.possess * 0.5;   // the spiral is a gentle extra food → Physarum drifts onto its bright curves (kept low: too strong saturates the whole field to white + can run away)
        return v; },
      step: function (dt, S) {
        if (!this.ok) return; var GW = this.gw, GH = this.gh, ag = this.ag, A = ag.length / 3, sigma = S.sigma, i;
        var SD = 3.2, SA = 0.5 - sigma * 0.18, turn = 0.5 + sigma * 0.9, rndturn = (1 - sigma) * 0.9, stp = 0.9 + sigma * 0.5;
        this._fw = 0.6 + sigma * 1.4;
        for (i = 0; i < A; i++) { var x = ag[i * 3], y = ag[i * 3 + 1], h = ag[i * 3 + 2];
          var fl = this._sense(x + Math.cos(h - SA) * SD, y + Math.sin(h - SA) * SD);
          var fc = this._sense(x + Math.cos(h) * SD, y + Math.sin(h) * SD);
          var fr = this._sense(x + Math.cos(h + SA) * SD, y + Math.sin(h + SA) * SD);
          if (fc >= fl && fc >= fr) {} else if (fl > fr) h -= turn * dt * 6; else if (fr > fl) h += turn * dt * 6; else h += (S.rnd() - 0.5) * turn;
          h += (S.rnd() - 0.5) * rndturn;
          x += Math.cos(h) * stp; y += Math.sin(h) * stp;
          if (x < 0) x += GW; else if (x >= GW) x -= GW; if (y < 0) y += GH; else if (y >= GH) y -= GH;
          ag[i * 3] = x; ag[i * 3 + 1] = y; ag[i * 3 + 2] = h;
          this.trail[(y | 0) * GW + (x | 0)] += 1.0;
        }
        var tr = this.trail, tm = this.tmp, decay = 0.90 + sigma * 0.055;
        for (var yy = 0; yy < GH; yy++) { var y0 = ((yy - 1 + GH) % GH) * GW, y1 = yy * GW, y2 = ((yy + 1) % GH) * GW;
          for (var xx = 0; xx < GW; xx++) { var xm = (xx - 1 + GW) % GW, xp = (xx + 1) % GW;
            var s = tr[y0 + xm] + tr[y0 + xx] + tr[y0 + xp] + tr[y1 + xm] + tr[y1 + xx] + tr[y1 + xp] + tr[y2 + xm] + tr[y2 + xx] + tr[y2 + xp];
            tm[y1 + xx] = (s / 9) * decay; } }
        this.trail = tm; this.tmp = tr;
      },
      draw: function (ctx, M, S, alpha, ramp) {
        if (!this.ok || typeof document === "undefined") return;         // browser-only: needs a canvas
        var GW = this.gw, GH = this.gh, tr = this.trail;
        if (!this.buf) { this.buf = document.createElement("canvas"); this.buf.width = GW; this.buf.height = GH; this.bx = this.buf.getContext("2d");
          this.img = this.bx.createImageData(GW, GH); }
        var d = this.img.data, lo = ramp(0.1), hi = ramp(0.9);
        // RADIAL VIGNETTE, placement-aware: fade the buffer's alpha toward the box edges so the
        // raster field reads as a soft disc (no hard square). The fade radius grows with placement
        // so at place 0 it's a soft CENTRE blob, and at place 1 (box = full frame) it pushes out
        // past the diagonal corners (ρ≈1.41) so the grown field actually FILLS the corners.
        var place = (S && S.place) || 0, vIn = 0.62 + 0.78 * place, vOut = 1.0 + 0.82 * place, vSpan = vOut - vIn;
        for (var yy = 0; yy < GH; yy++) { var ny = (yy / (GH - 1)) * 2 - 1;
          for (var xx = 0; xx < GW; xx++) { var nx = (xx / (GW - 1)) * 2 - 1, rr = Math.sqrt(nx * nx + ny * ny);
            var vig = rr <= vIn ? 1 : (rr >= vOut ? 0 : smooth(1 - (rr - vIn) / vSpan));
            var i = yy * GW + xx, v = tr[i]; if (v > 3) v = 3; var tt = smooth(v / 3);
            var o = i * 4; d[o] = lo[0] + (hi[0] - lo[0]) * tt; d[o + 1] = lo[1] + (hi[1] - lo[1]) * tt; d[o + 2] = lo[2] + (hi[2] - lo[2]) * tt; d[o + 3] = (tt * 255 * alpha * vig * 0.28) | 0; } }   // 0.28: additive over the spiral saturates to white — kept low so the whole weight slider stays gentle
        this.bx.putImageData(this.img, 0, 0);
        var prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
        ctx.drawImage(this.buf, M.x0, M.y0, M.w0, M.h0); ctx.imageSmoothingEnabled = prev;
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  C — SUPERFLUID : light flooding the channels + breathing node blooms
  // ═══════════════════════════════════════════════════════════════════════════════
  function makeFluid(SUB, S) {
    return {
      p: [],
      reset: function () { var P = 520; this.p = []; var rnd = mulberry32(SUB.seed ^ 0x51ed);
        for (var i = 0; i < P; i++) { var e = (rnd() * SUB.edges.length) | 0; this.p.push({ e: e, u: rnd(), v: 0.4 + rnd() * 0.8, off: (rnd() - 0.5), ph: rnd() * TAU }); } },
      step: function (dt, S) { var sigma = S.sigma;
        for (var i = 0; i < this.p.length; i++) { var pt = this.p[i]; pt.u += dt * pt.v * (0.5 + sigma * 0.8);
          if (pt.u >= 1) { pt.u -= 1; var cur = SUB.edges[pt.e][1]; var nb = SUB.adj[cur];
            pt.e = this._edgeTo(cur, nb.length ? nb[(S.rnd() * nb.length) | 0] : SUB.edges[pt.e][0], S); pt.off = (S.rnd() - 0.5); } }
      },
      _edgeTo: function (from, to, S) { for (var e = 0; e < SUB.edges.length; e++) { var a = SUB.edges[e][0], b = SUB.edges[e][1];
        if (a === from && b === to) return e; if (a === to && b === from) return e; } return (S.rnd() * SUB.edges.length) | 0; },  // was Math.random — seeded
      draw: function (ctx, M, S, alpha, ramp) {
        var sigma = S.sigma, t = S.t, i, s;
        for (i = 0; i < SUB.N; i++) { var np = SUB.pos(i, sigma, t), p = M.px(np), deg = SUB.deg[i];
          var glow = (S.terrainAtNorm && S.possess > 0) ? 1 + S.terrainAtNorm(np[0], np[1]) * S.possess * 0.6 : 1;   // POSSESSION: bloom a touch brighter on the spiral's bright pixels (kept gentle — 1.8 blew out to white)
          var br = M.R * (0.03 + 0.05 * (deg / 6)) * (0.8 + 0.3 * Math.sin(t * 1.3 + i)), col = ramp(0.4 + 0.4 * (deg / 6));
          var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], br);
          g.addColorStop(0, rgba(col, (0.10 + 0.14 * sigma) * alpha * glow)); g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], br, 0, TAU); ctx.fill();
        }
        for (s = 0; s < this.p.length; s++) { var pt = this.p[s], ed = SUB.edges[pt.e];
          var pa = SUB.pos(ed[0], sigma, t), pb = SUB.pos(ed[1], sigma, t);
          var dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
          var wob = pt.off * (1 - sigma) * 0.12 * Math.sin(t * 3 + pt.ph);
          var x = lerp(pa[0], pb[0], pt.u) + nx * wob, y = lerp(pa[1], pb[1], pt.u) + ny * wob, p2 = M.px([x, y]);
          var col2 = ramp(0.55 + 0.4 * pt.u);
          ctx.fillStyle = rgba(col2, (0.5 + 0.4 * sigma) * alpha);
          ctx.beginPath(); ctx.arc(p2[0], p2[1], M.R * 0.0055, 0, TAU); ctx.fill();
        }
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  D — VICSEK MURMURATION : self-propelled agents align with their neighbours.
  //  The order parameter φ (how aligned the flock is) IS σ — so σ literally sets the
  //  chaos↔symmetry the whole piece runs on. TOPOLOGICAL neighbours (k-nearest, not a
  //  metric radius): Ballerini 2008 found real starlings track ~7 nearest birds
  //  regardless of distance — the one change that separates "toy model" from footage.
  // ═══════════════════════════════════════════════════════════════════════════════
  function makeVicsek(SUB, S) {
    var A = 150, K = 7, ag = null, nh = null, bD = null, bI = null;
    function reset() {
      ag = new Float32Array(A * 3); nh = new Float32Array(A);
      bD = new Float32Array(K); bI = new Int32Array(K);         // reused scratch — no per-frame allocation
      for (var i = 0; i < A; i++) { var a = S.rnd() * TAU, r = Math.sqrt(S.rnd()) * 0.85;
        ag[i * 3] = Math.cos(a) * r; ag[i * 3 + 1] = Math.sin(a) * r; ag[i * 3 + 2] = S.rnd() * TAU; }
    }
    return {
      reset: reset,
      step: function (dt, S) {
        if (!ag) reset();
        var sigma = S.sigma, noise = (1 - sigma) * 2.4, mv = (0.10 + sigma * 0.10) * dt * 3.0, i, j, k;
        for (i = 0; i < A; i++) {
          var xi = ag[i * 3], yi = ag[i * 3 + 1];
          for (k = 0; k < K; k++) { bD[k] = Infinity; bI[k] = -1; }
          for (j = 0; j < A; j++) { var dx = ag[j * 3] - xi, dy = ag[j * 3 + 1] - yi, dd = dx * dx + dy * dy;
            if (dd < bD[K - 1]) { var m = K - 1; while (m > 0 && bD[m - 1] > dd) { bD[m] = bD[m - 1]; bI[m] = bI[m - 1]; m--; } bD[m] = dd; bI[m] = j; } }
          var sx = 0, sy = 0;
          for (k = 0; k < K; k++) { if (bI[k] < 0) continue; var hh = ag[bI[k] * 3 + 2]; sx += Math.cos(hh); sy += Math.sin(hh); }
          nh[i] = Math.atan2(sy, sx) + (S.rnd() - 0.5) * noise;    // align to the k-nearest mean heading + Vicsek noise
          if (S.terrainAtNorm && S.possess > 0) {                  // POSSESSION: steer toward the spiral's bright ridges
            var e = 0.03;
            var gx = S.terrainAtNorm(xi + e, yi) - S.terrainAtNorm(xi - e, yi);
            var gy = S.terrainAtNorm(xi, yi + e) - S.terrainAtNorm(xi, yi - e);
            if (gx * gx + gy * gy > 1e-8) {
              var dd = Math.atan2(Math.sin(Math.atan2(gy, gx) - nh[i]), Math.cos(Math.atan2(gy, gx) - nh[i]));
              nh[i] += dd * S.possess * 0.35;                       // rotate the target heading uphill (toward brighter spiral)
            }
          }
        }
        for (i = 0; i < A; i++) { var h = nh[i];
          var x = ag[i * 3] + Math.cos(h) * mv, y = ag[i * 3 + 1] + Math.sin(h) * mv, rr = Math.sqrt(x * x + y * y);
          if (rr > 0.95) { h = Math.atan2(-y, -x) + (S.rnd() - 0.5) * 0.4; x = x / rr * 0.95; y = y / rr * 0.95; }  // soft containment in the disc
          ag[i * 3] = x; ag[i * 3 + 1] = y; ag[i * 3 + 2] = h;
        }
      },
      draw: function (ctx, M, S, alpha, ramp) {
        if (!ag) return; var sigma = S.sigma;
        ctx.lineWidth = M.R * 0.004;
        for (var i = 0; i < A; i++) { var x = ag[i * 3], y = ag[i * 3 + 1], h = ag[i * 3 + 2], p = M.px([x, y]);
          var len = M.R * 0.035, tx = Math.cos(h) * len, ty = Math.sin(h) * len;
          // hue by heading: aligned flock (order) → one colour; scattered (chaos) → a spread
          var col = ramp(0.5 + 0.45 * Math.sin(h));
          ctx.strokeStyle = rgba(col, (0.30 + 0.45 * sigma) * alpha);
          ctx.beginPath(); ctx.moveTo(p[0] - tx * 0.5, p[1] - ty * 0.5); ctx.lineTo(p[0] + tx, p[1] + ty); ctx.stroke();
          var col2 = ramp(0.7 + 0.3 * Math.sin(h));
          ctx.fillStyle = rgba(col2, (0.5 + 0.4 * sigma) * alpha);
          ctx.beginPath(); ctx.arc(p[0] + tx, p[1] + ty, M.R * 0.006, 0, TAU); ctx.fill();
        }
      }
    };
  }

  // ── the organism: one skeleton, the bodies, one seeded rng ──────────────────────
  function Organism(seed) {
    this.seed = (seed >>> 0) || 7;
    this.t = 0;
    // The engine's own LCG rng (matches the lab's S) — every random flows through this.
    this.S = { sigma: 0.8, t: 0, seed: this.seed, _r: this.seed >>> 0,
      rnd: function () { this._r = (this._r * 1664525 + 1013904223) >>> 0; return this._r / 4294967296; } };
    this.SUB = buildSUB(this.seed, this.S);
    this.syn = makeSyn(this.SUB); this.syn.reset();
    this.slime = makeSlime(this.SUB, this.S); this.slime.reset();
    this.fluid = makeFluid(this.SUB, this.S); this.fluid.reset();
    this.vicsek = makeVicsek ? makeVicsek(this.SUB, this.S) : null; if (this.vicsek) this.vicsek.reset();
    // WIRING (viz/wiring.js) is a 5th mode with its OWN skeleton -- it grows its graph
    // rather than drawing over SUB's fixed one, which is the whole point of it. Resolved
    // lazily and defensively: a page that never loads wiring.js (or its measured motion
    // data) simply has no wiring mode, exactly as pages without organisms.js have no
    // organism. Same seed as the rest of this organism, so a replay is a replay.
    this.wiring = null;
    this._palRef = null; this._ramp = null;
    // placement + possession controls (set per-frame by the director); all 0 = today's look
    this.place = 0; this.placeMode = 0; this.possess = 0;
    this.terrain = null; this.tgw = 0; this.tgh = 0;
  }
  // Called each frame by the director before step/draw. place 0..1 (0 = centre disc, 1 = the whole
  // organism grown out to fill the frame into the corners), placeMode: 3 = breathe the reach in/out;
  // others = steady grow. possess 0..1 (how much the spiral's pixels drive the sim — see setTerrain).
  // Returns the wiring organism, building it on first use. Null forever if the module or
  // its motion data is absent -- callers must treat null as "this mode does not exist".
  Organism.prototype._wiring = function () {
    if (this.wiring !== null || this._noWiring) return this.wiring;
    var W = root.WIRING, motion = root.CELL_MOTION;
    if ((!W || !motion) && typeof module !== "undefined" && module.exports) {
      try {                                   // bare node: pull them in directly
        W = W || require("./wiring.js");
        motion = motion || require("./cell-motion.js");
      } catch (e) { W = W || null; motion = motion || null; }
    }
    if (!W || !motion) { this._noWiring = true; return null; }
    this.wiring = W.create(this.seed ^ 0x7717, motion);
    return this.wiring;
  };
  // ═══════════════════════════════════════════════════════════════════════════════
  //  FERROFLUID (rough WIP) : a spiked black membrane on a "speaker" — thorns rise with
  //  the bass. Audio isn't wired yet, so amplitude = business + a synthetic 4-on-floor
  //  kick; swapping those two lines for a real bass envelope is the only change to sync it.
  // ═══════════════════════════════════════════════════════════════════════════════
  Organism.prototype._drawFerro = function (ctx, M, S, alpha, ramp) {
    var cx = M.cx, cy = M.cy, t = this.t, TAU2 = Math.PI * 2;
    var biz = (root.PARTY && root.PARTY.business != null) ? clamp(root.PARTY.business, 0, 1) : 0.5;
    var kick = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 3.1)), 4);   // fake kick until audio is in
    var amp = clamp(0.22 + biz * 0.95, 0, 1.2) * kick;
    var base = M.R * 0.16, reach = M.R * 0.66;
    var midCol = ramp(0.55);
    // DIFFUSION FILL (her "slime in the gap", now baked in so she needs no second knob):
    // a soft palette bloom drawn UNDER the black membrane, additive — the centre still
    // goes dark below, but the spaces between the thorns and the rim glow instead of
    // reading as a bare black blob. Subtle: peaks at ~0.18α so a low weight stays gentle.
    var diffR = base + reach * amp;
    var dg = ctx.createRadialGradient(cx, cy, base * 0.4, cx, cy, diffR * 1.25);
    dg.addColorStop(0, rgba(midCol, 0.18 * alpha));
    dg.addColorStop(0.6, rgba(midCol, 0.10 * alpha));
    dg.addColorStop(1, rgba(midCol, 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath(); ctx.arc(cx, cy, diffR * 1.25, 0, TAU2); ctx.fillStyle = dg; ctx.fill();
    function rAt(a) {
      var thorn = Math.pow(Math.abs(Math.sin(6 * a + t * 1.7)), 6) * 0.75
                + Math.pow(Math.abs(Math.sin(11 * a - t * 2.3)), 12) * 0.55
                + Math.pow(Math.abs(Math.sin(17 * a + t * 0.9)), 16) * 0.40;
      return base + reach * amp * thorn;
    }
    var tip = ramp(0.9), STEPS = 240, s, a, r, x, y;
    ctx.beginPath();
    for (s = 0; s <= STEPS; s++) {
      a = s / STEPS * TAU2; r = rAt(a);
      x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    // BLACK GOO body: source-over so it actually OCCLUDES the spiral — additive black is
    // invisible. Opacity is decoupled from brightness (the goo is solid even when dim);
    // all the light lives in the tips below.
    var bodyA = clamp(0.4 + alpha * 1.8, 0, 0.97), tipA = clamp(0.25 + alpha * 1.6, 0, 1);
    ctx.globalCompositeOperation = "source-over";
    var g = ctx.createRadialGradient(cx, cy, base * 0.25, cx, cy, base + reach * amp);
    g.addColorStop(0, rgba([2, 3, 6], bodyA));
    g.addColorStop(0.72, rgba([5, 7, 13], bodyA * 0.95));
    g.addColorStop(1, rgba([9, 12, 20], 0));
    ctx.fillStyle = g; ctx.fill();
    // GLOWING TIPS: additive rim in palette + a hot white specular line right on the edge,
    // so the thorns read as wet, lit points against the black membrane.
    ctx.globalCompositeOperation = "lighter"; ctx.lineJoin = "round";
    ctx.lineWidth = M.R * 0.008; ctx.strokeStyle = rgba(tip, 0.85 * tipA); ctx.stroke();
    ctx.lineWidth = M.R * 0.003; ctx.strokeStyle = rgba([255, 255, 255], 0.45 * tipA); ctx.stroke();
  };
  Organism.prototype.setControls = function (place, placeMode, possess) {
    this.place = clamp(place || 0, 0, 1);
    this.placeMode = (placeMode || 0) | 0;
    this.possess = clamp(possess || 0, 0, 1);
  };
  // POSSESSION: the director hands in a luminance grid sampled from the ALREADY-DRAWN spiral
  // (gw×gh, values 0..1). The sim feeds on it — slime crawls the bright curves, the flock
  // traces the ridges, fluid blooms light up on the structure. Null (headless / possess 0) =
  // every coupling no-ops, preserving the array-only step the perf smoke depends on.
  Organism.prototype.setTerrain = function (terr, gw, gh) {
    this.terrain = terr; this.tgw = gw; this.tgh = gh;
  };
  Organism.prototype._rampFor = function (palette) {
    if (palette === this._palRef && this._ramp) return this._ramp;
    var cols = (palette && palette.length) ? palette.map(hexRgb) : ["5B6CE8", "C77DBB", "4A8B8C", "F2C94C", "8E7CC3"].map(hexRgb);
    this._palRef = palette; this._ramp = makeRamp(cols); return this._ramp;
  };
  // weights = { syn, slime, fluid, vicsek } — EFFECTIVE alphas (caller has already
  // multiplied by orgAmount). Each mode is stepped only when its weight clears GATE.
  Organism.prototype.step = function (dt, sigma, weights) {
    this.t += dt; this.S.t = this.t; this.S.sigma = clamp(sigma, 0, 1);
    if (weights.syn > GATE) this.syn.step(dt, this.S);
    if (weights.slime > GATE) this.slime.step(dt, this.S);
    if (weights.fluid > GATE) this.fluid.step(dt, this.S);
    if (this.vicsek && weights.vicsek > GATE) this.vicsek.step(dt, this.S);
    if (weights.wiring > GATE) { var wr = this._wiring(); if (wr) wr.step(dt); }
  };
  // Draws additively over whatever is on the canvas; restores compositing on exit.
  Organism.prototype.draw = function (ctx, w, h, sigma, palette, weights) {
    var ramp = this._rampFor(palette);
    var cx = w / 2, cy = h / 2, Rd = Math.min(w, h) * 0.46;
    this.S.t = this.t; this.S.sigma = clamp(sigma, 0, 1);
    // PLACEMENT = GROW & FILL (like the bloom flooding centre→corners). place 0 = a centre disc
    // (today); place 1 = the WHOLE organism — slime included — grown out to fill the frame into
    // the corners. Uniform anisotropic scale: every vector mode AND the slime blit ride the same
    // sx/sy, so it grows/shrinks as one and edges scale together (no cross-screen stretch).
    // placeMode 3 breathes the reach in and out with time.
    var t = clamp(this.place || 0, 0, 1);
    this.S.place = t;
    var reach = ((this.placeMode || 0) | 0) === 3 ? 1 + 0.12 * Math.sin(this.t * 0.7) : 1;
    var sx = lerp(Rd, (w / 2) * 1.06 * reach, t), sy = lerp(Rd, (h / 2) * 1.06 * reach, t);
    // feature scale barely grows (was ×1.5): when the organism spreads to fill the frame you want
    // MORE fine detail, not ballooned blobs — so somata/particles/line-widths stay near base size.
    var Rf = lerp(Rd, Rd * 1.08, t);
    // slime rides the grow too — x0/y0/w0/h0 follow sx/sy, so it fills toward the corners instead
    // of sitting as a blob in the middle.
    var M = { R: Rf, cx: cx, cy: cy, x0: cx - sx, y0: cy - sy, w0: 2 * sx, h0: 2 * sy,
      px: function (n) { return [cx + n[0] * sx, cy + n[1] * sy]; } };
    // POSSESSION. terrain sampler in NORMALIZED coords (node/agent → screen via the affine →
    // terrain) for fluid.draw (this frame) and vicsek.step (next frame); bake a slime-grid-aligned
    // spiral-food array over the grown box.
    var self = this, poss = clamp(this.possess || 0, 0, 1);
    this.S.possess = poss;
    this.S.terrainAtNorm = (this.terrain && poss > 0) ? function (nx, ny) {
      var pxs = cx + nx * sx, pys = cy + ny * sy;
      var ix = (pxs / w * self.tgw) | 0, iy = (pys / h * self.tgh) | 0;
      if (ix < 0 || iy < 0 || ix >= self.tgw || iy >= self.tgh) return 0;
      return self.terrain[iy * self.tgw + ix];
    } : null;
    if (this.terrain && poss > 0 && weights.slime > GATE) {
      var GW = this.slime.gw, GH = this.slime.gh, sf = this.slime.spiralFood;
      if (!sf || sf.length !== GW * GH) sf = this.slime.spiralFood = new Float32Array(GW * GH);
      for (var gy = 0; gy < GH; gy++) {
        var scy = M.y0 + (gy + 0.5) / GH * M.h0, tiy = (scy / h * this.tgh) | 0;   // slime cell → grown-box screen → terrain
        for (var gx = 0; gx < GW; gx++) {
          var scx = M.x0 + (gx + 0.5) / GW * M.w0, tix = (scx / w * this.tgw) | 0;
          sf[gy * GW + gx] = (tix >= 0 && tiy >= 0 && tix < this.tgw && tiy < this.tgh) ? this.terrain[tiy * this.tgw + tix] : 0;
        }
      }
      this.slime.possess = poss;
    } else { this.slime.spiralFood = null; }
    var prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
    // BLEND: 0 = "lighter" (additive — today's look, clips hard to white on overlap);
    // 1 = "screen" (soft roll-off toward white, no harsh clip/plateau). Live-switchable
    // via PARTY.config.orgBlend; headless / no-PARTY keeps the additive default.
    var blend = (root.PARTY && root.PARTY.config && root.PARTY.config.orgBlend === 1) ? "screen" : "lighter";
    // slime is a filled field → drawn first, then the line/point work on top
    if (weights.slime > GATE) { ctx.globalCompositeOperation = blend; this.slime.draw(ctx, M, this.S, weights.slime, ramp); }
    ctx.globalCompositeOperation = blend; ctx.globalAlpha = 1;
    if (weights.fluid > GATE) this.fluid.draw(ctx, M, this.S, weights.fluid, ramp);
    if (this.vicsek && weights.vicsek > GATE) this.vicsek.draw(ctx, M, this.S, weights.vicsek, ramp);
    if (weights.syn > GATE) this.syn.draw(ctx, M, this.S, weights.syn, ramp);
    // wiring draws last: it is additive line/halo work like syn, and it carries its own
    // colour (a rainbow it generates, not the light-scene palette -- deliberate, K.'s call
    // 2026-09-02), so it must not be tinted by the shared ramp.
    if (weights.wiring > GATE) {
      var wr2 = this._wiring();
      if (wr2) wr2.draw(ctx, w, h, palette, { M: M, alpha: weights.wiring });
    }
    // FERROFLUID (rough WIP, 2026-09-03 "wing it", uncommitted): a dark spiked membrane,
    // thorns rising from a core with amplitude standing in for bass (business + a synthetic
    // kick) until real audio is wired. Same blend/placement/palette as the other bodies.
    if (weights.ferro > GATE) { ctx.globalCompositeOperation = blend; this._drawFerro(ctx, M, this.S, weights.ferro, ramp); }
    ctx.globalCompositeOperation = prevOp; ctx.globalAlpha = prevA;
  };

  root.ORGANISMS = {
    create: function (seed) { return new Organism(seed); },
    // exposed for the headless smoke — lets it reach the renderers directly
    _internals: { buildSUB: buildSUB, makeSyn: makeSyn, makeSlime: makeSlime, makeFluid: makeFluid }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.ORGANISMS;
})();
