/* MeowParty Scene 01: the butterfly is already here; the harmonograph is its disguise.
 * Loaded after symmetry.js and before party-main.js. The Party host remains unchanged. */
(function (root) {
  "use strict";

  var PartyDirector = root.AmbientDirector;
  if (!PartyDirector) return;

  var TAU = Math.PI * 2;
  var PHI = (1 + Math.sqrt(5)) / 2;
  var VERTICES = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
  ];
  var EDGES = [];

  for (var i = 0; i < VERTICES.length; i++) {
    var n = Math.hypot(VERTICES[i][0], VERTICES[i][1], VERTICES[i][2]);
    VERTICES[i] = VERTICES[i].map(function (v) { return v / n; });
  }
  for (var a = 0; a < VERTICES.length; a++) {
    for (var b = a + 1; b < VERTICES.length; b++) {
      var dx = VERTICES[a][0] - VERTICES[b][0];
      var dy = VERTICES[a][1] - VERTICES[b][1];
      var dz = VERTICES[a][2] - VERTICES[b][2];
      if (Math.hypot(dx, dy, dz) < 1.08) EDGES.push([a, b]);
    }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a0, b0, t) { return a0 + (b0 - a0) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rgba(hex, alpha) {
    if (!hex || typeof hex !== "string") return "rgba(190,170,255," + alpha + ")";
    var h = hex.replace("#", "");
    if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  function rotate(v, ax, ay, az) {
    var x = v[0], y = v[1], z = v[2], c, s, q;
    c = Math.cos(ax); s = Math.sin(ax); q = y * c - z * s; z = y * s + z * c; y = q;
    c = Math.cos(ay); s = Math.sin(ay); q = x * c + z * s; z = -x * s + z * c; x = q;
    c = Math.cos(az); s = Math.sin(az); q = x * c - y * s; y = x * s + y * c; x = q;
    return [x, y, z];
  }

  class MeowPartyDirector {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._partyCanvas = document.createElement("canvas");
    this._party = new PartyDirector(this._partyCanvas, opts);
    this.zoom = true;
    this.substrate = null;
    this._meowT = 0;
    this._touchPhase = -1;
    this._touchEdge = 0;
    this._scenePulse = 0;
  }

  pop(amount) { this._party.pop(amount); }

  draw(dt) {
    this._meowT += dt;

    /* Make the canonical Party renderer play Harmonograph, while keeping every other
       part of Party live: palette, swing, zoom, trails, bloom and organism mixer. */
    var previous = root.PARTY && root.PARTY.activeSpiralId;
    if (root.PARTY) root.PARTY.activeSpiralId = "Harmonograph";
    this._party.zoom = this.zoom;
    this._party.substrate = this.substrate;
    try {
      this._party.draw(dt);
    } finally {
      if (root.PARTY) root.PARTY.activeSpiralId = previous;
    }

    /* Party remains the renderer; we only place its finished frame inside the cage.
       This makes both cage and Harmonograph genuinely petite on entry without cloning
       any of Party's trails, zoom, bloom or organism implementation. */
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    var tune = root.PARTY && root.PARTY.spiralTune ? root.PARTY.spiralTune() : 0;
    var q = clamp((tune + 1) / 2, 0, 1);
    var intro = smooth(this._meowT / 18);
    var sceneScale = lerp(0.38, 1, intro) * lerp(0.94, 1, q);
    var dw = w * sceneScale, dh = h * sceneScale;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.98;
    ctx.drawImage(this._partyCanvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();

    this._drawScene(dt);
  }

  _zoomPoint(x, y, w, h, z) {
    var cfg = (root.PARTY && root.PARTY.config) || {};
    var cx = w / 2, cy = h / 2, scale = 1;
    if (!cfg.zoomOffscreen) {
      var hi = cfg.zoomMax == null ? 3.2 : cfg.zoomMax;
      var fit = cfg.zoomFit == null ? 0.4 : cfg.zoomFit;
      var p = hi > 1 ? clamp((z - 1) / (hi - 1), 0, 1) : 0;
      scale = 1 - p * (1 - fit);
    } else if (cfg.zoomMode === 1) {
      scale = z;
    } else {
      var radius = Math.hypot(w, h) / 2;
      var u = Math.hypot(x - cx, y - cy) / radius;
      var k = Math.max(cfg.zoomFalloff || 2.2, 0.45 * Math.min(3.5, z) + 0.15);
      scale = 1 + (Math.min(3.5, z) - 1) * Math.pow(Math.max(0, 1 - u), k);
    }
    return [cx + (x - cx) * scale, cy + (y - cy) * scale, scale];
  }

  _drawScene(dt) {
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    if (!w || !h || !root.PARTY) return;

    var tune = root.PARTY.spiralTune ? root.PARTY.spiralTune() : 0;
    var q = clamp((tune + 1) / 2, 0, 1);
    var reveal = smooth((q - 0.34) / 0.62);
    var intro = smooth(this._meowT / 18);
    var active = root.PARTY.activeSpiral ? root.PARTY.activeSpiral() : null;
    var palette = active && active.palette ? active.palette : ["#7ddcff", "#d2a8ff", "#ff77ca", "#fff5b8"];
    var color = root.SYM && root.SYM.orderColor ? root.SYM.orderColor(q, palette) : palette[1];
    var accent = palette[3] || palette[1] || color;
    var speed = active && active.speed ? active.speed : 1;
    var z = root.PARTY.spiralZoom ? root.PARTY.spiralZoom() : 1;
    var beat = Math.pow(Math.max(0, Math.sin(this._meowT * (1.45 + speed * 0.2))), 10);
    var cageR = Math.min(w, h) * lerp(0.16, 0.39, intro) * lerp(0.82, 1, q);
    var creatureR = Math.min(w, h) * lerp(0.07, 0.30, intro) * lerp(0.78, 1.06, reveal) * (1 + beat * 0.055);

    var rx = this._meowT * 0.12 * speed + Math.sin(this._meowT * 0.17) * 0.18;
    var ry = this._meowT * 0.17 * speed;
    var rz = this._meowT * 0.07;
    var points = VERTICES.map(function (v) {
      var r = rotate(v, rx, ry, rz);
      var perspective = 3.7 / (3.7 - r[2]);
      var x = w / 2 + r[0] * cageR * perspective;
      var y = h / 2 + r[1] * cageR * perspective;
      var m = this._zoomPoint(x, y, w, h, z);
      return { x: m[0], y: m[1], z: r[2], s: m[2] };
    }, this);

    /* Contact is a repeating event near the ordered/grown end of the Party swing. */
    if (intro > 0.9 && q > 0.74 && this._touchPhase < 0) {
      this._touchPhase = 0;
      this._touchEdge = (this._touchEdge + 7) % EDGES.length;
      this._scenePulse = 1;
      this.pop(0.34);
    }
    if (this._touchPhase >= 0) {
      this._touchPhase += dt * 0.48;
      if (this._touchPhase > 1) this._touchPhase = -1;
    }
    if (q < 0.58) this._touchPhase = -1;
    this._scenePulse = Math.max(0, this._scenePulse - dt * 0.8);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    /* The icosahedron — still called the cube in the scene language. */
    for (var e = 0; e < EDGES.length; e++) {
      var edge = EDGES[e], p0 = points[edge[0]], p1 = points[edge[1]];
      var depth = clamp((p0.z + p1.z + 2) / 4, 0, 1);
      var impulse = 0;
      if (this._touchPhase >= 0) {
        var distance = Math.min((e - this._touchEdge + EDGES.length) % EDGES.length,
                                (this._touchEdge - e + EDGES.length) % EDGES.length);
        impulse = Math.max(0, 1 - Math.abs(distance - this._touchPhase * 13) / 3.5) * (1 - this._touchPhase * 0.5);
      }
      ctx.strokeStyle = impulse > 0.02 ? rgba(accent, 0.34 + impulse * 0.66) : rgba(color, 0.10 + depth * 0.28);
      ctx.lineWidth = (0.7 + depth * 1.35 + impulse * 3.2) * (p0.s + p1.s) * 0.5;
      ctx.shadowColor = rgba(impulse > 0.02 ? accent : color, 1);
      ctx.shadowBlur = impulse * 19;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    /* Butterfly equation from Spiral Mash. At low reveal it is only a faint truth
       under the Harmonograph; at high reveal the disguise folds open into wings. */
    ctx.shadowColor = rgba(color, 1);
    ctx.shadowBlur = 10 + beat * 20;
    ctx.lineWidth = 1.05 + reveal * 1.15;
    var loops = lerp(3, 6, reveal);
    for (var echo = 0; echo < 3; echo++) {
      var echoAlpha = (0.05 + reveal * 0.32) * (1 - echo * 0.23);
      ctx.strokeStyle = rgba(palette[(echo + 1) % palette.length] || color, echoAlpha);
      ctx.beginPath();
      for (var j = 0; j <= 620; j++) {
        var u = j / 620;
        var t = u * TAU * loops;
        var rad = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin(t / 12), 5);
        var drift = (1 - q) * 0.13 * Math.sin(t * 1.7 + this._meowT * 0.6 + echo);
        var x = w / 2 + (rad * Math.sin(t + drift) * 0.28) * creatureR + Math.sin(t * 0.5 + echo) * echo * 2.5;
        var y = h / 2 - (rad * Math.cos(t - drift) * 0.28) * creatureR;
        var mp = this._zoomPoint(x, y, w, h, z);
        if (j === 0) ctx.moveTo(mp[0], mp[1]); else ctx.lineTo(mp[0], mp[1]);
      }
      ctx.stroke();
    }

    /* One tiny nucleus makes the disguised entity read as a heartbeat at both ends. */
    var centre = this._zoomPoint(w / 2, h / 2, w, h, z);
    var rr = (2.4 + beat * 6 + this._scenePulse * 5) * centre[2];
    ctx.fillStyle = rgba(accent, 0.55 + beat * 0.4);
    ctx.shadowColor = rgba(accent, 1); ctx.shadowBlur = 18 + beat * 30;
    ctx.beginPath(); ctx.arc(centre[0], centre[1], rr, 0, TAU); ctx.fill();
    ctx.restore();
  }
  }

  root.AmbientDirector = MeowPartyDirector;
})(typeof window !== "undefined" ? window : globalThis);
