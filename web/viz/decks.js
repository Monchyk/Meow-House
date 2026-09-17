/* viz/decks.js — beat-locked visual for The Decks.
 *
 * Renders phase-locked to (bpm, beatEpoch): a breathing kick-ring, radial
 * shockwaves on each beat, and — when the host hands us live FFT data (the
 * master window with mic access) — a spectrum ring. Display windows get no
 * mic; they stay locked purely off the broadcast bpm + epoch, so all screens
 * pulse together.
 */
(function () {
  "use strict";

  class DecksViz {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.bpm = 120;
      this.beatEpoch = Date.now();
      this.lastBeatIndex = -1;
      this.waves = [];
      this.spectrum = null;   // Uint8Array, optional (master only)
      this.hue = { r: 242, g: 201, b: 76 };
    }

    setTempo(bpm, epoch) {
      this.bpm = Math.max(40, Math.min(240, bpm || 120));
      if (epoch) this.beatEpoch = epoch;
    }

    setSpectrum(arr) { this.spectrum = arr; }

    draw(dt) {
      const { ctx, canvas } = this;
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;
      const beatLen = 60000 / this.bpm;
      const tms = Date.now() - this.beatEpoch;
      const beatIndex = Math.floor(tms / beatLen);
      const phase = ((tms % beatLen) + beatLen) % beatLen / beatLen; // 0..1

      // spawn a shockwave exactly on the beat
      if (beatIndex !== this.lastBeatIndex) {
        this.lastBeatIndex = beatIndex;
        this.waves.push({ r: 0, life: 1, big: beatIndex % 4 === 0 });
      }

      ctx.fillStyle = "rgba(4,5,10,0.32)";
      ctx.fillRect(0, 0, w, h);

      const punch = Math.pow(1 - phase, 3);            // sharp decay after the hit
      const base = Math.min(w, h) * 0.16;
      const R = base * (1 + punch * 0.35);

      ctx.globalCompositeOperation = "lighter";

      // shockwaves
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const wv = this.waves[i];
        wv.r += dt * Math.min(w, h) * (wv.big ? 0.9 : 0.6);
        wv.life -= dt * 0.9;
        if (wv.life <= 0) { this.waves.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(${this.hue.r},${this.hue.g},${this.hue.b},${0.35 * wv.life})`;
        ctx.lineWidth = wv.big ? 5 * wv.life : 2.5 * wv.life;
        ctx.beginPath();
        ctx.arc(cx, cy, base + wv.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // kick ring
      const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.6);
      g.addColorStop(0, `rgba(${this.hue.r},${this.hue.g},${this.hue.b},${0.10 + punch * 0.25})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(${this.hue.r},${this.hue.g},${this.hue.b},${0.5 + punch * 0.5})`;
      ctx.lineWidth = 3 + punch * 9;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // spectrum ring (master only — live FFT bars radiating outward)
      if (this.spectrum) {
        const bins = 96;
        const step = Math.floor(this.spectrum.length * 0.7 / bins);
        for (let i = 0; i < bins; i++) {
          const v = this.spectrum[i * step] / 255;
          const ang = (i / bins) * Math.PI * 2 - Math.PI / 2;
          const r0 = R * 1.25;
          const r1 = r0 + v * Math.min(w, h) * 0.22;
          ctx.strokeStyle = `rgba(${this.hue.r},${this.hue.g},${this.hue.b},${0.12 + v * 0.5})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
          ctx.stroke();
        }
      }
      ctx.lineWidth = 1;
      ctx.globalCompositeOperation = "source-over";

      // BPM readout
      ctx.fillStyle = "rgba(230,235,250,0.9)";
      ctx.font = `600 ${Math.max(28, h * 0.05)}px "Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(this.bpm)} BPM`, cx, cy + Math.max(8, h * 0.012));
    }

    get ownsCanvas() { return true; }
  }

  window.DecksViz = DecksViz;
})();
