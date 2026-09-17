/* DEEP HOUSE — THE ARCADE  (web/games.js)
 *
 * Five tiny 4-button minigames. Solving each one IS the σ sweep of the spiral it
 * unlocks: the dormant preview is the paired exhibit at chaos (σ≈0, faint); the
 * moment you solve, that SAME exhibit ramps to full symmetry (σ=1) and loops. No
 * fake reward animation — the real gallery spiral deploys, via SYM.makeExhibit().
 *
 *   INPUT — exactly four buttons (physical Hue remote relays these; keyboard mirrors):
 *     ▲ up      ▼ down      Enter select/commit      Back undo/exit
 *
 * Coupling to each exhibit (why the pairing earns its place):
 *   Lockpick      → Kaleidoscope      aligning rings IS rising radial symmetry
 *   Clockwork     → Epicycloid gears  meshing the train IS the ratios integer-locking
 *   Spiral Weaver → Logarithmic spiral the line you draw IS the spiral
 *   Fireflies     → Kuramoto fireflies phase-lock IS the order parameter → 1
 *   Light Path    → String art        the traced beam IS the caustic  (loose: repointable)
 *
 * PROTOTYPE NOTES (for the architect's pluggable contract + for K.'s eyes):
 *   - Each game is a plain object: reset / onUp / onDown / onEnter / onBack / solved /
 *     draw / labels. That IS the minigame interface — drop a new one into GAMES and it
 *     works. Games never touch the exhibit; the shell owns preview + deploy.
 *   - GAME_UNLOCKS is the game→exhibit cross-reference the architect keys off; pairings
 *     are data, so any game can be repointed at one of K.'s "good spirals" freely.
 *   - Anti-spam: two tries, then a short "temporary equilibrium" lockout during which
 *     you can still watch previews (LOCK_MS is short here for playtesting — the
 *     installation wants a few minutes).
 *   - Visuals are functional, not final. Feel first; taste needs K.'s eyes, not Fable.
 */
(function () {
  "use strict";
  var SYM = window.SYM, PALETTES = window.PALETTES;

  // ── palette helpers (12-scheme atlas; graceful default) ────────────────────
  var SCHEMES = [];
  try {
    if (PALETTES && typeof PALETTES.all === "function") {
      PALETTES.all().forEach(function (s) {
        if (s && s.colors && s.colors.length >= 2) SCHEMES.push(s.colors.slice(0, 5));
      });
    }
  } catch (e) {}
  if (!SCHEMES.length) SCHEMES = [["8E7CC3", "4A8B8C", "C77DBB", "F2C94C", "5B6CE8"]];
  function scheme(i) { return SCHEMES[((i % SCHEMES.length) + SCHEMES.length) % SCHEMES.length]; }
  function hex(h) { return "#" + h; }

  // ── the five games' spiral unlocks (cross-reference the architect keys off) ──
  var GAME_UNLOCKS = {
    "Lockpick": "Kaleidoscope",
    "Clockwork": "Epicycloid gears",
    "Spiral Weaver": "Logarithmic spiral",
    "Fireflies": "Kuramoto fireflies",
    "Light Path": "String art"
  };

  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function circDiff(a, b) { var d = Math.abs(a - b) % 1; return d > 0.5 ? 1 - d : d; }

  /* ════════════════════════════════════════════════════════════════════════
     GAME 1 — LOCKPICK  →  Kaleidoscope
     Concentric rings, each with a gap, all misaligned. Rotate them so every gap
     lines up at the top and a beam falls to the centre. Aligning the rings IS
     driving σ from chaos → radial symmetry.
     ════════════════════════════════════════════════════════════════════════ */
  var Lockpick = {
    name: "Lockpick", NOTCHES: 12, sel: 0, rings: [],
    labels: function () { return { up: "prev ring", down: "next ring", enter: "turn ►", back: "turn ◄" }; },
    reset: function () {
      this.sel = 0; this.rings = [];
      for (var i = 0; i < 3; i++) this.rings.push({ gap: 1 + Math.floor(Math.random() * (this.NOTCHES - 1)) });
    },
    onUp: function () { this.sel = (this.sel + this.rings.length - 1) % this.rings.length; },
    onDown: function () { this.sel = (this.sel + 1) % this.rings.length; },
    onEnter: function () { var r = this.rings[this.sel]; r.gap = (r.gap + 1) % this.NOTCHES; },
    onBack: function () { var r = this.rings[this.sel]; r.gap = (r.gap + this.NOTCHES - 1) % this.NOTCHES; },
    solved: function () { return this.rings.every(function (r) { return r.gap === 0; }); },
    draw: function (g, cx, cy, R, col, t) {
      var self = this, N = this.rings.length, gapW = TAU / this.NOTCHES * 0.85;
      // beam probes from the top; reaches as deep as the first ring whose gap is at top
      var reach = 0; for (var k = 0; k < N; k++) { if (this.rings[N - 1 - k].gap === 0) reach = k + 1; else break; }
      var solved = this.solved();
      this.rings.forEach(function (r, i) {
        var rad = R * (0.42 + i * 0.24);
        var a0 = -Math.PI / 2 + r.gap * (TAU / self.NOTCHES);  // gap centre angle (top = notch 0)
        g.lineWidth = R * 0.11; g.lineCap = "round";
        g.strokeStyle = i === self.sel ? hex(col[3]) : hex(col[i % col.length]);
        g.globalAlpha = i === self.sel ? 1 : 0.7;
        g.beginPath(); g.arc(cx, cy, rad, a0 + gapW / 2, a0 - gapW / 2 + TAU); g.stroke();
      });
      g.globalAlpha = 1;
      // the descending beam
      var top = cy - R * (0.42 + (N - 1) * 0.24) - R * 0.2;
      var depth = solved ? cy : cy - R * (0.42 + (N - reach - 0.5) * 0.24);
      g.strokeStyle = hex(col[3]); g.lineWidth = 3;
      g.globalAlpha = solved ? 1 : 0.55 + 0.25 * Math.sin(t * 4);
      g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, depth); g.stroke();
      g.globalAlpha = 1;
      if (solved) { g.fillStyle = hex(col[3]); g.beginPath(); g.arc(cx, cy, R * 0.06, 0, TAU); g.fill(); }
    },
    caption: "THE LOCK OPENS"
  };

  /* ════════════════════════════════════════════════════════════════════════
     GAME 2 — CLOCKWORK  →  Epicycloid gears
     A driver gear turns; the last gear is dead. Engage the loose middle gears so
     the whole train meshes and the final gear turns. Completing the chain IS the
     epicycloid's ratios integer-locking.
     ════════════════════════════════════════════════════════════════════════ */
  var Clockwork = {
    name: "Clockwork", N: 6, sel: 1, on: [], spin: 0,
    labels: function () { return { up: "◄ gear", down: "gear ►", enter: "engage / lift", back: "gear ►" }; },
    reset: function () {
      this.on = []; this.spin = 0; this.sel = 1;
      for (var i = 0; i < this.N; i++) this.on.push(i === 0 || i === this.N - 1);  // driver + target seated
      // disengage the middles (raised); ensure not pre-solved
      for (var j = 1; j < this.N - 1; j++) this.on[j] = false;
    },
    _mids: function () { var a = []; for (var i = 1; i < this.N - 1; i++) a.push(i); return a; },
    onUp: function () { var m = this._mids(); this.sel = m[(m.indexOf(this.sel) + m.length - 1) % m.length]; },
    onDown: function () { var m = this._mids(); this.sel = m[(m.indexOf(this.sel) + 1) % m.length]; },
    onEnter: function () { this.on[this.sel] = !this.on[this.sel]; },
    onBack: function () { this.onDown(); },
    solved: function () { return this.on.every(Boolean); },
    update: function (dt) { this.spin += dt * 1.4; },
    draw: function (g, cx, cy, R, col, t) {
      var self = this, N = this.N, span = R * 2.0, x0 = cx - span / 2, step = span / (N - 1), r = R * 0.16;
      // how far the drive reaches along the row (contiguous engaged from gear 0)
      var reach = 0; for (var k = 0; k < N; k++) { if (this.on[k]) reach = k; else break; }
      for (var i = 0; i < N; i++) {
        var seated = this.on[i], gx = x0 + i * step, gy = cy + (seated ? 0 : -R * 0.42);
        var driven = i <= reach, dir = i % 2 ? -1 : 1;
        var ang = driven ? this.spin * dir : 0;
        g.save(); g.translate(gx, gy); g.rotate(ang);
        g.strokeStyle = i === 0 ? hex(col[3]) : (i === this.sel ? hex(col[3]) : hex(col[i % col.length]));
        g.globalAlpha = driven ? 1 : (i === this.sel ? 0.9 : 0.55);
        g.lineWidth = R * 0.045;
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
        for (var tth = 0; tth < 8; tth++) {  // teeth
          var a = tth / 8 * TAU; g.beginPath();
          g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28); g.stroke();
        }
        g.restore();
        if (i === this.sel) {  // selection caret
          g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); g.fillStyle = hex(col[3]);
          g.beginPath(); g.moveTo(gx, gy - r * 1.7); g.lineTo(gx - 6, gy - r * 1.7 - 10);
          g.lineTo(gx + 6, gy - r * 1.7 - 10); g.fill(); g.globalAlpha = 1;
        }
      }
      // baseline the seated gears rest on
      g.globalAlpha = 0.25; g.strokeStyle = hex(col[0]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0 - r, cy + r * 1.4); g.lineTo(x0 + span + r, cy + r * 1.4); g.stroke();
      g.globalAlpha = 1;
    },
    caption: "THE TRAIN LOCKS"
  };

  /* ════════════════════════════════════════════════════════════════════════
     GAME 3 — SPIRAL WEAVER  →  Logarithmic spiral
     Nodes sit on a log spiral. Connect them all with one line that never crosses
     itself. The only non-crossing path is the spiral order — the line you draw IS
     the spiral.
     ════════════════════════════════════════════════════════════════════════ */
  var Weaver = {
    name: "Spiral Weaver", nodes: [], path: [], cand: 0, flash: 0,
    labels: function () { return { up: "prev node", down: "next node", enter: "connect", back: "undo" }; },
    reset: function () {
      this.nodes = []; this.path = [0]; this.cand = 1; this.flash = 0;
      var K = 6, a = 0.16, b = 0.30;
      for (var i = 0; i < K; i++) {
        var th = i * 0.9, rr = a * Math.exp(b * i);        // log spiral r = a·e^{bθ}
        this.nodes.push({ x: Math.cos(th) * rr, y: Math.sin(th) * rr, th: th });
      }
    },
    _unvisited: function () {
      var p = this.path, out = [];
      for (var i = 0; i < this.nodes.length; i++) if (p.indexOf(i) < 0) out.push(i);
      return out;
    },
    onUp: function () { var u = this._unvisited(); if (!u.length) return; this.cand = u[(u.indexOf(this.cand) + u.length - 1) % u.length]; },
    onDown: function () { var u = this._unvisited(); if (!u.length) return; this.cand = u[(u.indexOf(this.cand) + 1) % u.length]; },
    onEnter: function () {
      var u = this._unvisited(); if (u.indexOf(this.cand) < 0) return;
      var cur = this.path[this.path.length - 1];
      if (this._crosses(cur, this.cand)) { this.flash = 0.4; return; }  // illegal: would cross
      this.path.push(this.cand);
      var nu = this._unvisited(); this.cand = nu.length ? nu[0] : this.cand;
    },
    onBack: function () { if (this.path.length > 1) { this.path.pop(); var u = this._unvisited(); this.cand = u.length ? u[0] : this.cand; } },
    _crosses: function (i, j) {
      var A = this.nodes[i], B = this.nodes[j], p = this.path;
      for (var s = 0; s + 1 < p.length; s++) {
        var C = this.nodes[p[s]], D = this.nodes[p[s + 1]];
        if (p[s] === i || p[s + 1] === i || p[s] === j || p[s + 1] === j) continue; // share endpoint
        if (segInt(A, B, C, D)) return true;
      }
      return false;
    },
    solved: function () { return this.path.length === this.nodes.length; },
    update: function (dt) { if (this.flash > 0) this.flash -= dt; },
    draw: function (g, cx, cy, R, col, t) {
      var self = this, S = R * 1.7;
      function P(n) { return { x: cx + n.x * S, y: cy + n.y * S }; }
      // committed path
      g.strokeStyle = hex(col[3]); g.lineWidth = R * 0.02; g.lineCap = "round"; g.beginPath();
      this.path.forEach(function (idx, k) { var p = P(self.nodes[idx]); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
      g.stroke();
      // candidate preview segment
      if (!this.solved()) {
        var cur = P(this.nodes[this.path[this.path.length - 1]]), cp = P(this.nodes[this.cand]);
        g.globalAlpha = this.flash > 0 ? 1 : 0.45;
        g.strokeStyle = this.flash > 0 ? "#e05a6a" : hex(col[4] || col[1]);
        g.setLineDash([6, 6]); g.beginPath(); g.moveTo(cur.x, cur.y); g.lineTo(cp.x, cp.y); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
      }
      // nodes
      this.nodes.forEach(function (n, i) {
        var p = P(n), visited = self.path.indexOf(i) >= 0, isCand = i === self.cand && !self.solved();
        g.fillStyle = visited ? hex(col[3]) : (isCand ? hex(col[4] || col[1]) : hex(col[0]));
        g.globalAlpha = visited || isCand ? 1 : 0.6;
        g.beginPath(); g.arc(p.x, p.y, R * (isCand ? 0.055 : 0.04), 0, TAU); g.fill();
        g.globalAlpha = 1;
      });
    },
    caption: "THE LINE CLOSES"
  };
  function segInt(a, b, c, d) {
    function ccw(p, q, r) { return (r.y - p.y) * (q.x - p.x) - (q.y - p.y) * (r.x - p.x); }
    var d1 = ccw(c, d, a), d2 = ccw(c, d, b), d3 = ccw(a, b, c), d4 = ccw(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  /* ════════════════════════════════════════════════════════════════════════
     GAME 4 — FIREFLIES  →  Kuramoto fireflies
     Blinkers pulse out of phase. Tap each to nudge its phase until they all flash
     as one. Getting them in phase IS the Kuramoto order parameter → 1.
     ════════════════════════════════════════════════════════════════════════ */
  var Fireflies = {
    // Phases are quantised to SLOTS so nudges (one slot) can actually reach exact
    // sync — a continuous-phase version is unsolvable with discrete taps. A single
    // shared `clock` advances all of them; each firefly carries an integer offset,
    // so "in phase" == "all offsets equal", and the pulse still drifts smoothly.
    name: "Fireflies", M: 4, SLOTS: 12, freq: 2.0, clock: 0, off: [], sel: 0,
    labels: function () { return { up: "prev", down: "next", enter: "nudge ►", back: "nudge ◄" }; },
    reset: function () {
      this.off = []; this.sel = 0; this.clock = 0;
      for (var i = 0; i < this.M; i++) this.off.push(Math.floor(Math.random() * this.SLOTS));
      // guarantee it doesn't start solved (spread the offsets apart)
      for (var j = 1; j < this.M; j++) this.off[j] = (this.off[0] + 2 + j) % this.SLOTS;
    },
    _phase: function (i) { return ((this.clock + this.off[i]) % this.SLOTS) / this.SLOTS; },
    onUp: function () { this.sel = (this.sel + this.M - 1) % this.M; },
    onDown: function () { this.sel = (this.sel + 1) % this.M; },
    onEnter: function () { this.off[this.sel] = (this.off[this.sel] + 1) % this.SLOTS; },
    onBack: function () { this.off[this.sel] = (this.off[this.sel] + this.SLOTS - 1) % this.SLOTS; },
    update: function (dt) { this.clock = (this.clock + this.freq * dt) % this.SLOTS; },
    solved: function () {
      for (var i = 1; i < this.M; i++) if (this.off[i] !== this.off[0]) return false;
      return true;
    },
    _R: function () {  // Kuramoto order parameter magnitude
      var sx = 0, sy = 0; for (var i = 0; i < this.M; i++) { sx += Math.cos(this._phase(i) * TAU); sy += Math.sin(this._phase(i) * TAU); }
      return Math.sqrt(sx * sx + sy * sy) / this.M;
    },
    draw: function (g, cx, cy, R, col, t) {
      var self = this, ring = R * 0.8;
      // order-parameter halo
      var Rp = this._R();
      g.globalAlpha = 0.10 + 0.35 * Rp; g.fillStyle = hex(col[3]);
      g.beginPath(); g.arc(cx, cy, R * (0.2 + 0.8 * Rp), 0, TAU); g.fill(); g.globalAlpha = 1;
      for (var i = 0; i < this.M; i++) {
        var a = -Math.PI / 2 + i / this.M * TAU, x = cx + Math.cos(a) * ring, y = cy + Math.sin(a) * ring;
        var lum = 0.5 + 0.5 * Math.sin(this._phase(i) * TAU);
        g.globalAlpha = 0.25 + 0.75 * lum;
        g.fillStyle = i === this.sel ? hex(col[3]) : hex(col[i % col.length]);
        g.beginPath(); g.arc(x, y, R * (0.06 + 0.05 * lum), 0, TAU); g.fill();
        if (i === this.sel) { g.globalAlpha = 0.8; g.strokeStyle = hex(col[3]); g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, R * 0.13, 0, TAU); g.stroke(); }
        g.globalAlpha = 1;
      }
    },
    caption: "ONE HEARTBEAT"
  };

  /* ════════════════════════════════════════════════════════════════════════
     GAME 5 — LIGHT PATH  →  String art   (loose pairing: repointable to any exhibit)
     A beam, a target, a few rotatable mirrors on a small grid. Flip the mirrors so
     the beam reaches the target; the traced path stitches into the caustic.
     ════════════════════════════════════════════════════════════════════════ */
  var LightPath = {
    name: "Light Path", G: 5, sel: 0, mirrors: [], srcRow: 2, tgt: null,
    labels: function () { return { up: "prev mirror", down: "next mirror", enter: "flip ╱╲", back: "flip ╲╱" }; },
    reset: function () {
      // Fixed mirror cells; player flips orientation. The TARGET is derived from a
      // known solution orientation so a solution provably exists, then we scramble.
      this.mirrors = [ { c: 1, r: 2, o: 0 }, { c: 1, r: 0, o: 0 }, { c: 3, r: 0, o: 0 }, { c: 3, r: 4, o: 0 } ];
      this.sel = 0; this.srcRow = 2;
      var self = this;
      // a random solution set → wherever its beam exits becomes the target
      this.mirrors.forEach(function (m) { m.o = Math.random() < 0.5 ? 0 : 1; });
      this.tgt = this._trace().exit;                       // solvable by construction
      // scramble away from the solution; ensure not already solved
      var guard = 0;
      do { this.mirrors.forEach(function (m) { m.o = Math.random() < 0.5 ? 0 : 1; }); guard++; }
      while (this.solved() && guard < 40);
    },
    onUp: function () { this.sel = (this.sel + this.mirrors.length - 1) % this.mirrors.length; },
    onDown: function () { this.sel = (this.sel + 1) % this.mirrors.length; },
    onEnter: function () { var m = this.mirrors[this.sel]; m.o ^= 1; },
    onBack: function () { var m = this.mirrors[this.sel]; m.o ^= 1; },
    _mirrorAt: function (c, r) { for (var i = 0; i < this.mirrors.length; i++) if (this.mirrors[i].c === c && this.mirrors[i].r === r) return this.mirrors[i]; return null; },
    _trace: function () {
      var G = this.G, c = 0, r = this.srcRow, dc = 1, dr = 0, pts = [{ c: -0.5, r: r }], steps = 0;
      while (steps++ < 64) {
        var m = this._mirrorAt(c, r);
        if (m) {  // reflect: o=0 is '╲' (E<->S, W<->N), o=1 is '╱' (E<->N, W<->S)
          if (m.o === 0) { var t = dc; dc = dr; dr = t; }
          else { var t2 = dc; dc = -dr; dr = -t2; }
          pts.push({ c: c, r: r });
        }
        c += dc; r += dr;
        if (c < 0 || c >= G || r < 0 || r >= G) {
          pts.push({ c: c, r: r });
          return { pts: pts, exit: { c: c, r: r } };
        }
      }
      return { pts: pts, exit: null };
    },
    solved: function () { var e = this._trace().exit; return !!(e && this.tgt && e.c === this.tgt.c && e.r === this.tgt.r); },
    draw: function (g, cx, cy, R, col, t) {
      var self = this, G = this.G, cell = (R * 2) / G, ox = cx - R, oy = cy - R;
      function CX(c) { return ox + (c + 0.5) * cell; } function CY(r) { return oy + (r + 0.5) * cell; }
      // grid
      g.globalAlpha = 0.15; g.strokeStyle = hex(col[0]); g.lineWidth = 1;
      for (var i = 0; i <= G; i++) {
        g.beginPath(); g.moveTo(ox + i * cell, oy); g.lineTo(ox + i * cell, oy + G * cell); g.stroke();
        g.beginPath(); g.moveTo(ox, oy + i * cell); g.lineTo(ox + G * cell, oy + i * cell); g.stroke();
      }
      g.globalAlpha = 1;
      // beam
      var tr = this._trace(), hit = this.solved();
      g.strokeStyle = hex(col[3]); g.lineWidth = 3; g.globalAlpha = hit ? 1 : 0.75;
      g.beginPath();
      tr.pts.forEach(function (p, k) { var x = CX(p.c), y = CY(p.r); if (k) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke(); g.globalAlpha = 1;
      // source marker (left edge)
      g.fillStyle = hex(col[1]); g.beginPath();
      g.arc(ox - cell * 0.15, CY(this.srcRow), 4, 0, TAU); g.fill();
      // mirrors
      this.mirrors.forEach(function (m, i) {
        var x = CX(m.c), y = CY(m.r), hh = cell * 0.34;
        g.strokeStyle = i === self.sel ? hex(col[3]) : hex(col[1]); g.lineWidth = i === self.sel ? 4 : 3;
        g.beginPath();
        if (m.o === 0) { g.moveTo(x - hh, y - hh); g.lineTo(x + hh, y + hh); }   // ╲
        else { g.moveTo(x - hh, y + hh); g.lineTo(x + hh, y - hh); }             // ╱
        g.stroke();
        if (i === self.sel) { g.globalAlpha = 0.5; g.strokeStyle = hex(col[3]); g.lineWidth = 1;
          g.strokeRect(x - cell / 2, y - cell / 2, cell, cell); g.globalAlpha = 1; }
      });
      // target marker — clamped onto whichever edge the solution beam exits
      if (this.tgt) {
        var tc = clamp(this.tgt.c, -0.5, G - 0.5), trr = clamp(this.tgt.r, -0.5, G - 0.5);
        var tx = CX(tc), ty = CY(trr);
        if (this.tgt.r >= G) ty = oy + G * cell + cell * 0.28;
        else if (this.tgt.r < 0) ty = oy - cell * 0.28;
        else if (this.tgt.c >= G) tx = ox + G * cell + cell * 0.28;
        else if (this.tgt.c < 0) tx = ox - cell * 0.28;
        g.fillStyle = hit ? hex(col[3]) : hex(col[4] || col[1]);
        g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
        g.beginPath(); g.arc(tx, ty, 6, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    },
    caption: "THE BEAM LANDS"
  };

  var GAMES = [Lockpick, Clockwork, Weaver, Fireflies, LightPath];
  // per-game anti-spam state
  GAMES.forEach(function (gm, i) { gm._attempts = 0; gm._lockUntil = 0; gm._palIdx = i; });
  var LOCK_MS = 12000;     // brief wants a few minutes; short here for playtesting
  var MAX_TRIES = 2;

  // ── SHELL ──────────────────────────────────────────────────────────────────
  var cv = document.getElementById("cv"), g = cv.getContext("2d");
  var statusEl = document.getElementById("status"), capEl = document.getElementById("caption");
  var labUp = document.getElementById("lab-up"), labDown = document.getElementById("lab-down"),
      labEnter = document.getElementById("lab-enter"), labBack = document.getElementById("lab-back");

  var screen = "menu", menuIdx = 0, game = null, gi = 0;
  var previewEx = null, deployEx = null, deploySigma = 0, deployHold = 0;
  var menuPreviewEx = null, menuPreviewFor = -1;

  function fit() {
    var w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", fit); fit();

  function setLabels(l) { labUp.textContent = l.up; labDown.textContent = l.down; labEnter.textContent = l.enter; labBack.textContent = l.back; }
  function showCaption(txt) { capEl.textContent = txt; capEl.style.opacity = "1"; }
  function hideCaption() { capEl.style.opacity = "0"; }

  function locked(gm) { return performance.now() < gm._lockUntil; }
  function lockLeft(gm) { return Math.max(0, Math.ceil((gm._lockUntil - performance.now()) / 1000)); }

  function openMenu() {
    screen = "menu"; game = null; deployEx = null; hideCaption();
    setLabels({ up: "prev game", down: "next game", enter: "play", back: "—" });
    statusEl.textContent = "the arcade · solve a game to unlock its spiral";
  }
  function enterGame(idx) {
    gi = idx; game = GAMES[idx];
    if (locked(game)) { statusEl.textContent = "temporary equilibrium — watch the preview"; }
    game.reset();
    previewEx = SYM.makeExhibit(GAME_UNLOCKS[game.name]);
    if (previewEx) { previewEx.q = 0.12; }
    deployEx = null; deploySigma = 0; hideCaption();
    screen = "play"; setLabels(game.labels());
    statusEl.textContent = game.name + "  →  unlocks: " + GAME_UNLOCKS[game.name];
  }
  function leaveGameUnsolved() {
    if (game && !game.solved()) {
      game._attempts++;
      if (game._attempts >= MAX_TRIES) { game._lockUntil = performance.now() + LOCK_MS; game._attempts = 0; }
    }
    openMenu();
  }
  function winGame() {
    screen = "deploy"; game._attempts = 0; game._lockUntil = 0;
    deployEx = SYM.makeExhibit(GAME_UNLOCKS[game.name]); deploySigma = 0; deployHold = 0;
    showCaption(game.caption);
    setLabels({ up: "—", down: "—", enter: "—", back: "back to arcade" });
    statusEl.textContent = GAME_UNLOCKS[game.name] + " — deployed";
    // clear the canvas once so the exhibit's own trailing fade starts clean
    g.clearRect(0, 0, cv.width, cv.height);
  }

  // ── input ───────────────────────────────────────────────────────────────────
  function act(a) {
    if (screen === "menu") {
      if (a === "up") menuIdx = (menuIdx + GAMES.length - 1) % GAMES.length;
      else if (a === "down") menuIdx = (menuIdx + 1) % GAMES.length;
      else if (a === "enter") enterGame(menuIdx);
      return;
    }
    if (screen === "play") {
      if (locked(game)) { if (a === "back") openMenu(); return; }  // during lockout only Back works
      if (a === "up") game.onUp();
      else if (a === "down") game.onDown();
      else if (a === "enter") { game.onEnter(); if (game.solved()) winGame(); }
      else if (a === "back") {
        // Back is the game's undo; a second Back on a fresh/again state exits to menu
        if (game.onBack) game.onBack();
        else leaveGameUnsolved();
      }
      return;
    }
    if (screen === "deploy") { if (a === "back") openMenu(); }
  }
  // A dedicated "exit" gesture so Back-as-undo doesn't trap you: Esc / on-screen only.
  function exitToMenu() { if (screen === "play") leaveGameUnsolved(); else if (screen === "deploy") openMenu(); }

  window.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); act("up"); }
    else if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); act("down"); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); act("enter"); }
    else if (k === "Backspace" || k === "ArrowLeft") { e.preventDefault(); act("back"); }
    else if (k === "Escape") { e.preventDefault(); exitToMenu(); }
  });
  document.querySelectorAll(".btn").forEach(function (b) {
    b.addEventListener("click", function () { act(b.getAttribute("data-act")); });
    // right-click / long-press the Back button = hard exit
  });
  document.querySelector('.btn[data-act="back"]').addEventListener("contextmenu", function (e) { e.preventDefault(); exitToMenu(); });

  // ── render loop ───────────────────────────────────────────────────────────
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now, t = now / 1000;
    var w = window.innerWidth, h = window.innerHeight, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.30;

    if (screen === "menu") {
      g.clearRect(0, 0, w, h);
      var gm = GAMES[menuIdx], pal = scheme(gm._palIdx);
      // faint dormant preview of the selected game's exhibit as a backdrop
      if (menuPreviewFor !== menuIdx) { menuPreviewEx = SYM.makeExhibit(GAME_UNLOCKS[gm.name]); menuPreviewFor = menuIdx; }
      if (menuPreviewEx) {
        var sg = 0.12; menuPreviewEx.update(dt, sg * 2 - 1); menuPreviewEx.q = sg;
        g.globalAlpha = 0.30;
        menuPreviewEx.draw(g, w, h, dt, { alpha: 0.4, fade: 0.5, color: SYM.orderColor(sg, pal), tint: null });
        g.globalAlpha = 1;
      }
      // list
      g.textAlign = "center"; g.textBaseline = "middle";
      GAMES.forEach(function (gg, i) {
        var y = cy - (GAMES.length - 1) * 26 + i * 52, on = i === menuIdx;
        g.font = (on ? "600 " : "400 ") + (on ? 26 : 18) + "px 'Cascadia Code', monospace";
        g.fillStyle = on ? hex(scheme(gg._palIdx)[3]) : "#6a7290";
        var tag = locked(gg) ? "  ⏸ " + lockLeft(gg) + "s" : "";
        g.fillText((on ? "▸ " : "  ") + gg.name + "  →  " + GAME_UNLOCKS[gg.name] + tag, cx, y);
      });
      requestAnimationFrame(loop); return;
    }

    if (screen === "play") {
      g.clearRect(0, 0, w, h);
      var pal2 = scheme(game._palIdx);
      // dormant preview of the paired exhibit, very faint behind the puzzle
      if (previewEx) {
        var s0 = 0.12; previewEx.update(dt, s0 * 2 - 1); previewEx.q = s0;
        g.globalAlpha = 0.16;
        previewEx.draw(g, w, h, dt, { alpha: 0.35, fade: 0.55, color: SYM.orderColor(s0, pal2), tint: null });
        g.globalAlpha = 1;
      }
      if (game.update) game.update(dt);
      game.draw(g, cx, cy, R, pal2, t);
      if (locked(game)) {
        g.globalAlpha = 0.9; g.fillStyle = "#04050ac0"; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = hex(pal2[3]); g.font = "600 20px 'Cascadia Code', monospace";
        g.fillText("the system has reached a temporary equilibrium", cx, cy - 14);
        g.fillStyle = "#7a8299"; g.font = "14px 'Cascadia Code', monospace";
        g.fillText(lockLeft(game) + "s — watch the preview, then try again", cx, cy + 16);
      }
      requestAnimationFrame(loop); return;
    }

    if (screen === "deploy") {
      var pal3 = scheme(game._palIdx);
      deploySigma += (1 - deploySigma) * Math.min(1, dt * 0.9);   // σ ramps chaos → symmetry
      if (deploySigma > 0.985) deployHold += dt;
      var sg2 = clamp(deploySigma, 0, 1);
      if (deployEx) {
        deployEx.update(dt, sg2 * 2 - 1); deployEx.q = sg2;
        deployEx.draw(g, w, h, dt, { alpha: 0.9, fade: 0.12, color: SYM.orderColor(sg2, pal3), tint: null });
      }
      requestAnimationFrame(loop); return;
    }
    requestAnimationFrame(loop);
  }
  var t = 0;
  openMenu(); requestAnimationFrame(loop);

  // expose for a headless logic smoke + the architect's contract
  window.ARCADE = { GAMES: GAMES, GAME_UNLOCKS: GAME_UNLOCKS };
})();
