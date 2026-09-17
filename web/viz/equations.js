/* viz/equations.js — equations resolving themselves, live.
 *
 * Each act: a famous series/iteration accumulates term by term on screen,
 * the running value ticks toward its limit, and a convergence trace draws
 * the error shrinking. Pure math on screen — numbers are allowed to talk.
 */
(function () {
  "use strict";

  const ACTS = [
    {
      title: "π  —  Leibniz",
      formula: "π = 4 · ( 1 − 1/3 + 1/5 − 1/7 + … )",
      limit: Math.PI,
      term(k) { return 4 * ((k % 2 === 0 ? 1 : -1) / (2 * k + 1)); },
      perSec: 40
    },
    {
      title: "π²/6  —  Basel problem",
      formula: "Σ 1/n²  =  π²/6",
      limit: Math.PI * Math.PI / 6,
      term(k) { const n = k + 1; return 1 / (n * n); },
      perSec: 30
    },
    {
      title: "e  —  the series",
      formula: "e = Σ 1/n!  =  1 + 1 + 1/2 + 1/6 + 1/24 + …",
      limit: Math.E,
      term(k) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return 1 / f; },
      perSec: 2.2,
      maxTerms: 18
    },
    {
      title: "φ  —  the golden ratio",
      formula: "φ = 1 + 1/(1 + 1/(1 + 1/(1 + …)))",
      limit: (1 + Math.sqrt(5)) / 2,
      iterate: true,               // x ← 1 + 1/x
      iter(x) { return 1 + 1 / x; },
      start: 1,
      perSec: 1.6,
      maxTerms: 24
    },
    {
      title: "√2  —  Newton's method",
      formula: "xₙ₊₁ = (xₙ + 2/xₙ) / 2",
      limit: Math.SQRT2,
      iterate: true,
      iter(x) { return (x + 2 / x) / 2; },
      start: 2,
      perSec: 0.8,
      maxTerms: 8
    }
  ];

  class Equations {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.actIndex = 0;
      this._startAct(0);
    }

    _startAct(i) {
      this.actIndex = i % ACTS.length;
      this.act = ACTS[this.actIndex];
      this.k = 0;
      this.value = this.act.iterate ? this.act.start : 0;
      this.acc = 0;
      this.actTime = 0;
      this.errors = [];          // log10 |error| samples for the trace
      this.display = this.value;
    }

    next() { this._startAct(this.actIndex + 1); }

    draw(dt) {
      const { ctx, canvas, act } = this;
      const w = canvas.width, h = canvas.height;
      this.actTime += dt;

      // advance terms
      this.acc += dt * act.perSec;
      let steps = Math.floor(this.acc);
      this.acc -= steps;
      const cap = act.maxTerms || 4000;
      while (steps-- > 0 && this.k < cap) {
        if (act.iterate) this.value = act.iter(this.value);
        else this.value += act.term(this.k);
        this.k++;
        const err = Math.abs(this.value - act.limit);
        this.errors.push(err > 0 ? Math.log10(err) : -16);
        if (this.errors.length > 240) this.errors.shift();
      }
      // rotate acts: done converging + a beat of stillness
      if ((this.k >= cap || this.actTime > 26) && this.actTime > 8) this.next();

      // eased display value
      this.display += (this.value - this.display) * Math.min(1, dt * 6);

      // ---- render ----
      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, w, h);
      const mono = `"Cascadia Code", Consolas, monospace`;

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(142,124,195,0.9)";
      ctx.font = `${Math.max(16, h * 0.028)}px ${mono}`;
      ctx.fillText(act.title, w / 2, h * 0.16);

      ctx.fillStyle = "rgba(200,210,235,0.85)";
      ctx.font = `${Math.max(18, h * 0.034)}px ${mono}`;
      ctx.fillText(act.formula, w / 2, h * 0.26);

      // the big number, ticking toward truth
      const digits = this.display.toFixed(10);
      ctx.fillStyle = "rgba(242,201,76,0.95)";
      ctx.font = `600 ${Math.max(34, h * 0.085)}px ${mono}`;
      ctx.fillText(digits, w / 2, h * 0.46);

      ctx.fillStyle = "rgba(120,130,160,0.7)";
      ctx.font = `${Math.max(13, h * 0.02)}px ${mono}`;
      const label = act.iterate ? `iteration ${this.k}` : `${this.k.toLocaleString("en")} terms`;
      ctx.fillText(`${label}    →    ${act.limit.toFixed(10)}…`, w / 2, h * 0.53);

      // convergence trace: log10(error) marching right, sinking down
      if (this.errors.length > 1) {
        const gx = w * 0.18, gw = w * 0.64, gy = h * 0.62, gh = h * 0.24;
        ctx.strokeStyle = "rgba(90,100,130,0.35)";
        ctx.strokeRect(gx, gy, gw, gh);
        ctx.beginPath();
        const lo = -14, hi = 1; // log10 error range
        this.errors.forEach((e, i) => {
          const x = gx + (i / (this.errors.length - 1)) * gw;
          const yy = gy + ((hi - Math.max(lo, Math.min(hi, e))) / (hi - lo)) * gh;
          i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        });
        ctx.strokeStyle = "rgba(74,139,140,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgba(120,130,160,0.6)";
        ctx.font = `${Math.max(11, h * 0.016)}px ${mono}`;
        ctx.textAlign = "left";
        ctx.fillText("log₁₀ |error|", gx, gy - 8);
        ctx.textAlign = "center";
      }
    }

    get ownsCanvas() { return true; }
  }

  window.Equations = Equations;
})();
