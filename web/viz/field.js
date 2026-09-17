/* viz/field.js — FeelingField
 *
 * Generative particle colour-field for the Feelings Room (and the lobby's
 * dim idle drift). One feeling = one hue; PAD drives behaviour:
 *   arousal  → particle speed + breathing rate
 *   valence  → brightness / warmth of the field
 *   dominance→ how tightly particles cohere vs scatter
 * Colour transitions are smoothed so switching feelings reads as the room
 * "changing its mind", not a hard cut.
 */
(function () {
  "use strict";

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  class FeelingField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.color = { r: 40, g: 46, b: 60 };      // current (smoothed)
      this.target = { r: 40, g: 46, b: 60 };     // target hue
      this.pad = { v: 0, a: -0.2, d: 0 };
      this.targetPad = { v: 0, a: -0.2, d: 0 };
      this.intensity = 0.4;                       // lobby idle = dim
      this.targetIntensity = 0.4;
      this.t = 0;
      this._seed(360);
    }

    _seed(n) {
      this.particles = [];
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: Math.random(), y: Math.random(),
          vx: (Math.random() - 0.5) * 0.0006,
          vy: (Math.random() - 0.5) * 0.0006,
          r: 0.6 + Math.random() * 2.4,
          phase: Math.random() * Math.PI * 2,
          drift: 0.5 + Math.random()
        });
      }
    }

    /* Set the field to a feeling (or null → idle drift). */
    setFeeling(feeling, intensity = 1.0) {
      if (!feeling) {
        this.target = { r: 40, g: 46, b: 60 };
        this.targetPad = { v: 0, a: -0.2, d: 0 };
        this.targetIntensity = 0.4;
        return;
      }
      this.target = hexToRgb(feeling.hex);
      this.targetPad = { ...feeling.pad };
      this.targetIntensity = intensity;
    }

    draw(dt) {
      const { ctx, canvas } = this;
      const w = canvas.width, h = canvas.height;
      this.t += dt;

      // Smooth colour / PAD / intensity toward targets (~2s settle).
      const k = Math.min(1, dt * 1.6);
      for (const ch of ["r", "g", "b"]) this.color[ch] = lerp(this.color[ch], this.target[ch], k);
      for (const ax of ["v", "a", "d"]) this.pad[ax] = lerp(this.pad[ax], this.targetPad[ax], k);
      this.intensity = lerp(this.intensity, this.targetIntensity, k);

      const arousal01 = (this.pad.a + 1) / 2;               // 0..1
      const speed = 0.2 + arousal01 * 1.6;                  // motion scale
      const breathe = 0.75 + 0.25 * Math.sin(this.t * (0.25 + arousal01 * 1.4));
      const bright = (0.55 + 0.45 * ((this.pad.v + 1) / 2)) * this.intensity * breathe;

      // Background wash — deep version of the hue.
      ctx.fillStyle = `rgb(${(this.color.r * 0.07) | 0},${(this.color.g * 0.07) | 0},${(this.color.b * 0.09) | 0})`;
      ctx.fillRect(0, 0, w, h);

      // Central glow.
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, `rgba(${this.color.r | 0},${this.color.g | 0},${this.color.b | 0},${0.16 * bright})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Particles. Dominance pulls them toward centre (empowered = cohesive),
      // negative dominance scatters them wide (overwhelmed = diffuse).
      const cohere = this.pad.d * 0.00012;
      ctx.globalCompositeOperation = "lighter";
      for (const p of this.particles) {
        p.phase += dt * p.drift * (0.4 + arousal01 * 2.2);
        p.x += (p.vx * speed + Math.cos(p.phase) * 0.00035 * speed + (0.5 - p.x) * cohere);
        p.y += (p.vy * speed + Math.sin(p.phase * 0.9) * 0.00035 * speed + (0.5 - p.y) * cohere);
        if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;

        const a = bright * (0.10 + 0.22 * Math.abs(Math.sin(p.phase)));
        ctx.fillStyle = `rgba(${this.color.r | 0},${this.color.g | 0},${this.color.b | 0},${a})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * (1 + arousal01), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  window.FeelingField = FeelingField;
})();
