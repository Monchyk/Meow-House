/* viz/ulam.js — Ulam spiral, drawing itself live.
 *
 * Integers spiral out from the centre of the screen; primes IGNITE (bright
 * glowing dots), composites fall in as faint ash. The famous diagonal prime
 * streaks emerge on their own — no trickery, just arithmetic. When the
 * spiral outgrows the screen it exhales and starts over.
 */
(function () {
  "use strict";

  function isPrime(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    if (n % 3 === 0) return n === 3;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }

  class UlamSpiral {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.reset();
    }

    reset() {
      this.n = 1;
      this.x = 0; this.y = 0;              // grid coords, centre = (0,0)
      this.dx = 1; this.dy = 0;            // heading: right
      this.legLen = 1; this.legStep = 0; this.legsDone = 0;
      this.cell = 7;
      this.primeCount = 0;
      this.sparks = [];                    // freshly-ignited primes (glow decay)
      this.speed = 60;                     // numbers per second (ramps up)
      this.acc = 0;
      this.fading = false;
      this.fadeT = 0;
      this._clear = true;
    }

    _step() {
      // advance spiral position (square spiral walk)
      this.x += this.dx; this.y += this.dy;
      this.legStep++;
      if (this.legStep === this.legLen) {
        this.legStep = 0;
        // turn left: (dx,dy) -> (-dy,dx)
        const t = this.dx; this.dx = -this.dy; this.dy = t;
        this.legsDone++;
        if (this.legsDone === 2) { this.legsDone = 0; this.legLen++; }
      }
      this.n++;
    }

    draw(dt) {
      const { ctx, canvas } = this;
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;

      if (this._clear) {
        ctx.fillStyle = "#04050a";
        ctx.fillRect(0, 0, w, h);
        this._clear = false;
        // plot n = 1 at centre
        ctx.fillStyle = "rgba(180,190,220,0.25)";
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }

      if (this.fading) {
        this.fadeT += dt;
        ctx.fillStyle = `rgba(4,5,10,${Math.min(0.12, dt * 2)})`;
        ctx.fillRect(0, 0, w, h);
        if (this.fadeT > 2.2) { this.reset(); }
        return;
      }

      // ramp speed: starts contemplative, ends brrr
      this.speed = Math.min(2400, this.speed * (1 + dt * 0.35));
      this.acc += dt * this.speed;
      let steps = Math.floor(this.acc);
      this.acc -= steps;

      const half = Math.max(Math.abs(this.x), Math.abs(this.y)) * this.cell;
      if (half > Math.min(w, h) / 2 - 20) { this.fading = true; this.fadeT = 0; return; }

      while (steps-- > 0) {
        this._step();
        const px = cx + this.x * this.cell;
        const py = cy + this.y * this.cell;
        if (isPrime(this.n)) {
          this.primeCount++;
          this.sparks.push({ x: px, y: py, life: 1 });
          ctx.fillStyle = "rgba(242,201,76,0.95)";
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        } else {
          ctx.fillStyle = "rgba(90,100,130,0.13)";
          ctx.fillRect(px - 0.5, py - 0.5, 1.5, 1.5);
        }
        const boundHalf = Math.max(Math.abs(this.x), Math.abs(this.y)) * this.cell;
        if (boundHalf > Math.min(w, h) / 2 - 20) { this.fading = true; this.fadeT = 0; break; }
      }

      // glow decay on fresh primes
      ctx.globalCompositeOperation = "lighter";
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= dt * 1.8;
        if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 10 * s.life);
        g.addColorStop(0, `rgba(255,220,120,${0.5 * s.life})`);
        g.addColorStop(1, "rgba(255,220,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 10 * s.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // readout — math is allowed on screen; prose is not.
      ctx.fillStyle = "rgba(4,5,10,0.85)";
      ctx.fillRect(0, h - 44, w, 44);
      ctx.fillStyle = "rgba(200,210,235,0.8)";
      ctx.font = `${Math.max(14, h * 0.02)}px "Cascadia Code", Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`n = ${this.n.toLocaleString("en")}    π(n) = ${this.primeCount.toLocaleString("en")}    density ≈ ${(this.primeCount / this.n * 100).toFixed(1)}%`, w / 2, h - 16);
    }

    /* Ulam needs its own persistent canvas — tell the host not to clear. */
    get ownsCanvas() { return true; }
  }

  window.UlamSpiral = UlamSpiral;
})();
