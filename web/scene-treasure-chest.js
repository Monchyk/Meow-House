/* Scene 01: The Beating Treasure Chest.
 *
 * Director-host port of scenes/scene-01-icosahedron-butterfly.html and
 * scenes/treasure-chest.js. The player owns the canvas and animation loop; this
 * scene only advances and draws, so swapping it cannot leave an orphaned rAF.
 */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;
  var PHI = (1 + Math.sqrt(5)) / 2;
  var VERTS = [
    [0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI],
    [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]
  ];
  var EDGES = [];
  var SAMPLES = [];

  VERTS.forEach(function (a, i) {
    VERTS.forEach(function (b, j) {
      var distance = a.reduce(function (sum, v, k) { return sum + Math.pow(v - b[k], 2); }, 0);
      if (j > i && Math.abs(distance - 4) < 0.01) EDGES.push([i, j]);
    });
  });

  /* The curve's spatial frequencies never change, only its time phase. */
  for (var sample = 0; sample <= 1152; sample++) {
    var tt = sample / 1152 * 48;
    var b = sample / 1152 * TAU * 6;
    var e1 = Math.exp(-0.005 * tt), e2 = Math.exp(-0.011 * tt);
    var r = (Math.exp(Math.cos(b)) - 2 * Math.cos(4 * b) + Math.pow(Math.sin(b / 12), 5)) * 0.28;
    SAMPLES.push([
      Math.sin(2 * tt) * e1, Math.cos(2 * tt) * e1, Math.sin(3 * tt + 1.7) * e2,
      Math.sin(3 * tt + 0.6) * e1, Math.cos(3 * tt + 0.6) * e1, Math.sin(2 * tt + 1.1) * e2,
      r * Math.sin(b), -r * Math.cos(b)
    ]);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rgba(c, a) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")"; }
  function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
  function hull(points) {
    var sorted = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var lower = [], upper = [];
    sorted.forEach(function (v) {
      while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], v) <= 0) lower.pop();
      lower.push(v);
    });
    sorted.reverse().forEach(function (v) {
      while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], v) <= 0) upper.pop();
      upper.push(v);
    });
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  function TreasureChestDirector(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.zoom = false;
    this.substrate = null;
    this.time = 0;
    this.duration = 80;
    this.playing = true;
    this.p = {
      speed: 0.65, growth: 18, delay: 3, cage: 0.8, heart: 0.75, bpm: 48,
      spin: 0.12, zoom: 1, release: 9, glow: 0.6, hue: 0.15
    };
    this.contact = null;
    this.contactScale = 0;
    this.phaseTime = NaN;
    this.phaseSin = 0;
    this.phaseCos = 1;
    this.wingMotion = 0;
    this.palettes = root.PALETTES ? root.PALETTES.all() : [];
    this.paletteIndex = Math.max(0, this.palettes.findIndex(function (palette) {
      return palette.id === "Aurora";
    }));
    this._findContact();
  }

  TreasureChestDirector.prototype.pop = function () {};
  TreasureChestDirector.prototype.dispose = function () {};
  TreasureChestDirector.prototype.acceptHandoff = function (handoff) {
    var state = handoff && handoff.state;
    if (state && state.paletteIndex != null) {
      this.paletteIndex = clamp(Math.round(state.paletteIndex), 0, this.palettes.length - 1);
    }
  };

  /* Promptable-scene contract. The host uses the same methods as an autonomous
     controller, so every visible control is also available as plain data/API. */
  TreasureChestDirector.prototype.getDuration = function () { return this.duration; };
  TreasureChestDirector.prototype.getTime = function () { return this.time; };
  TreasureChestDirector.prototype.seek = function (seconds) {
    this.time = clamp(Number(seconds) || 0, 0, this.duration);
  };
  TreasureChestDirector.prototype.isPlaying = function () { return this.playing; };
  TreasureChestDirector.prototype.setPlaying = function (playing) {
    this.playing = !!playing;
    if (this.playing && this.time >= this.duration) this.time = 0;
  };
  TreasureChestDirector.prototype.getControls = function () {
    return [
      { key: "speed", label: "speed", min: 0.1, max: 1.5, step: 0.05 },
      { key: "growth", label: "ico growth", min: 8, max: 28, step: 1 },
      { key: "delay", label: "follow delay", min: 1, max: 7, step: 0.5 },
      { key: "cage", label: "ico limit", min: 0.55, max: 0.95, step: 0.01 },
      { key: "heart", label: "heartbeat", min: 0, max: 1, step: 0.05 },
      { key: "bpm", label: "heart tempo", min: 24, max: 80, step: 1 },
      { key: "spin", label: "rotation", min: 0, max: 0.4, step: 0.01 },
      { key: "zoom", label: "zoom", min: 0.6, max: 1.25, step: 0.01 },
      { key: "release", label: "opening time", min: 4, max: 16, step: 0.5 },
      { key: "glow", label: "light", min: 0, max: 1, step: 0.05 },
      { key: "hue", label: "colour drift", min: 0, max: 1, step: 0.01 }
    ];
  };
  TreasureChestDirector.prototype.getControlValue = function (key) { return this.p[key]; };
  TreasureChestDirector.prototype.setControl = function (key, value) {
    var spec = this.getControls().find(function (item) { return item.key === key; });
    if (!spec) return false;
    this.p[key] = clamp(Number(value), spec.min, spec.max);
    if (["growth", "delay", "cage", "heart", "bpm", "spin"].indexOf(key) >= 0) this._findContact();
    return true;
  };
  TreasureChestDirector.prototype.serialize = function () {
    var params = {};
    for (var key in this.p) if (Object.prototype.hasOwnProperty.call(this.p, key)) params[key] = this.p[key];
    return { scene: "treasure-chest", time: this.time, playing: this.playing,
      params: params, paletteIndex: this.paletteIndex };
  };
  TreasureChestDirector.prototype.restore = function (state) {
    if (!state || typeof state !== "object") return false;
    var self = this;
    if (state.params) Object.keys(state.params).forEach(function (key) {
      self.setControl(key, state.params[key]);
    });
    if (state.paletteIndex != null) this.paletteIndex = clamp(Math.round(state.paletteIndex), 0, this.palettes.length - 1);
    if (state.time != null) this.seek(state.time);
    if (state.playing != null) this.playing = !!state.playing;
    return true;
  };

  TreasureChestDirector.prototype._setPhase = function (t) {
    if (this.phaseTime === t) return;
    this.phaseTime = t;
    this.phaseSin = Math.sin(t * 0.07);
    this.phaseCos = Math.cos(t * 0.07);
    this.wingMotion = Math.sin(t * 1.1);
  };

  TreasureChestDirector.prototype._pulse = function (t) {
    var phase = (t * this.p.bpm / 60) % 1;
    return Math.exp(-Math.pow((phase - 0.18) / 0.075, 2)) +
      0.55 * Math.exp(-Math.pow((phase - 0.38) / 0.09, 2));
  };
  TreasureChestDirector.prototype._heartbeat = function (t) {
    return 1 + this.p.heart * 0.15 * this._pulse(t);
  };
  TreasureChestDirector.prototype._cageSize = function (t) {
    return mix(0.23, this.p.cage, ease((t - 1) / this.p.growth));
  };
  TreasureChestDirector.prototype._innerSize = function (t) {
    return mix(0.09, this.p.cage * 1.85, ease((t - 1 - this.p.delay) / (this.p.growth * 1.85)));
  };
  TreasureChestDirector.prototype._cagePoints = function (t) {
    var yaw = t * this.p.spin * 0.34;
    var pitch = 0.62 + Math.sin(t * this.p.spin * 0.19) * 0.12;
    var scale = 0.27 * this._cageSize(t);
    return VERTS.map(function (v) {
      var x = v[0] * Math.cos(yaw) - v[2] * Math.sin(yaw);
      var z = v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw);
      var y = v[1] * Math.cos(pitch) - z * Math.sin(pitch);
      var zz = v[1] * Math.sin(pitch) + z * Math.cos(pitch);
      var perspective = 1 / (1 + (zz + 2) * 0.045);
      return [x * scale * perspective, y * scale * perspective, zz];
    });
  };
  TreasureChestDirector.prototype._curve = function (u, t, morph) {
    this._setPhase(t);
    var a = SAMPLES[Math.round(u * 1152)];
    var x = 0.5 * (a[0] * this.phaseCos + a[1] * this.phaseSin + a[2]);
    var y = 0.5 * (a[3] * this.phaseCos - a[4] * this.phaseSin + a[5]);
    return [
      mix(x, a[6] * (1 - 0.06 * this.wingMotion * morph), morph),
      mix(y, a[7], morph)
    ];
  };

  TreasureChestDirector.prototype._findContact = function () {
    this.contact = null;
    for (var tick = 0; tick <= 2400; tick++) {
      var t = tick / 30;
      var border = hull(this._cagePoints(t));
      var scale = 0.35 * this._innerSize(t) * this._heartbeat(t);
      this._setPhase(t);
      var bounds = border.map(function (a, k) {
        var b = border[(k + 1) % border.length];
        return [b[0] - a[0], b[1] - a[1], a[0], a[1]];
      });
      for (var j = 0; j <= 384; j++) {
        var a = SAMPLES[j * 3];
        var x = 0.5 * (a[0] * this.phaseCos + a[1] * this.phaseSin + a[2]) * scale;
        var y = 0.5 * (a[3] * this.phaseCos - a[4] * this.phaseSin + a[5]) * scale;
        for (var k = 0; k < bounds.length; k++) {
          var edge = bounds[k];
          if (edge[0] * (y - edge[3]) - edge[1] * (x - edge[2]) < 0) {
            this.contact = t;
            this.contactScale = this._innerSize(t);
            return;
          }
        }
      }
    }
  };

  TreasureChestDirector.prototype._stateAt = function (t) {
    var after = this.contact === null ? 0 : Math.max(0, t - this.contact);
    return {
      after: after,
      release: ease(after / this.p.release),
      morph: ease((after - 0.4) / (this.p.release * 1.2)),
      scale: this.contact === null || t < this.contact ? this._innerSize(t) :
        mix(this.contactScale, 0.82, ease(after / (this.p.release * 1.4)))
    };
  };

  TreasureChestDirector.prototype.draw = function (dt) {
    if (!this.ctx || !root.SYM || !this.palettes.length) return;
    if (this.playing) {
      this.time = Math.min(this.duration, this.time + Math.min(0.05, dt) * this.p.speed);
      if (this.time >= this.duration) this.playing = false;
    }

    var canvas = this.canvas, ctx = this.ctx, p = this.p;
    var w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 1.5);
    var unit = Math.min(w, h) * p.zoom;
    var cx = w / 2, cy = h * 0.46;
    var state = this._stateAt(this.time);
    var beat = this._pulse(this.time);
    var points = this._cagePoints(this.time);
    var pal = this.palettes[this.paletteIndex].colors;
    var color = root.SYM.orderColor(0.86, pal);
    var self = this;
    function ink(u) { return color.at(u * 0.28 + p.hue + state.morph * 0.16, self.time * 0.002); }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#04050a";
    ctx.fillRect(0, 0, w, h);
    var light = (0.045 + beat * 0.025 + Math.exp(-state.after * 0.7) * (state.after > 0 ? 0.12 : 0)) * p.glow;
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.65);
    glow.addColorStop(0, rgba(ink(0.5), light));
    glow.addColorStop(1, rgba(ink(0.5), 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(unit, unit);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (state.release < 1) EDGES.forEach(function (edge, i) {
      var a = points[edge[0]], b = points[edge[1]];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var travel = state.release * 1.5;
      var angle = state.release * (i % 2 ? 1 : -1) * 0.8;
      var dx = (b[0] - a[0]) / 2, dy = (b[1] - a[1]) / 2;
      var rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      var ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      var x = mx * (1 + travel), y = my * (1 + travel);
      var depth = clamp((a[2] + b[2]) / (4 * PHI) + 0.5, 0, 1), c = ink(i / EDGES.length);
      ctx.strokeStyle = rgba(c, (0.22 + depth * 0.42 + beat * 0.1) * (1 - state.release));
      ctx.lineWidth = (0.8 + depth * 0.6) * dpr / unit;
      ctx.beginPath(); ctx.moveTo(x - rx, y - ry); ctx.lineTo(x + rx, y + ry); ctx.stroke();
    });

    var size = 0.35 * state.scale * this._heartbeat(this.time);
    var segments = 12, sub = 96;
    for (var s = 0; s < segments; s++) {
      var c = ink(s / segments);
      ctx.beginPath();
      for (var j = 0; j <= sub; j++) {
        var v = this._curve((s + j / sub) / segments, this.time, state.morph);
        if (j === 0) ctx.moveTo(v[0] * size, v[1] * size);
        else ctx.lineTo(v[0] * size, v[1] * size);
      }
      if (p.glow > 0) {
        ctx.strokeStyle = rgba(c, p.glow * (0.07 + beat * 0.025));
        ctx.lineWidth = 4 * dpr / unit;
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(c, 0.78);
      ctx.lineWidth = 1.15 * dpr / unit;
      ctx.stroke();
    }
    ctx.restore();
  };

  if (root.SCENES && root.SCENES.register) {
    root.SCENES.register("treasure-chest", "The beating treasure chest", function (canvas) {
      return new TreasureChestDirector(canvas);
    }, { duration: 124, show: true });
  }
})(typeof window !== "undefined" ? window : globalThis);
