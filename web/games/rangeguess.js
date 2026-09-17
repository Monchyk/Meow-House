/* games/rangeguess.js — ENGINE 8 of Tier 1A: Guess the Range.
 *
 * Four samples fall out of one hidden band. Which band were they drawn from?
 *   ▲/▼ cycle the candidate bands   ‹enter› pick   ‹back› not consumed (shell exits)
 *
 * The four candidates are disjoint, and only the true band contains every sample — so the
 * puzzle is decidable from what is on screen, not a coin flip. A wrong pick dims that band
 * and costs a try (internal state only, never host.attemptFailed()); when one band is left
 * it is the answer, so the kiosk never dead-ends.
 */
(function (root) {
  "use strict";
  var Game = root.Game, CANDS = 4, SAMPLES = 4, SPAN = 24;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    return function (host) {
      var bands = [], samples = [], answer = 0, sel = 0, dead = [], clock = 0;

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 1013));
          var width = SPAN / CANDS;
          bands = [];
          for (var i = 0; i < CANDS; i++) bands.push([i * width, (i + 1) * width]);
          answer = Math.floor(rnd() * CANDS);
          var b = bands[answer];
          samples = [];
          for (var k = 0; k < SAMPLES; k++) samples.push(b[0] + rnd() * (b[1] - b[0]));
          // pin one sample near each edge so the band is readable, not guessable
          samples[0] = b[0] + width * 0.08;
          samples[SAMPLES - 1] = b[1] - width * 0.08;
          // never start parked on the answer — a blind ‹enter› must not win.
          sel = mod(answer + 1 + Math.floor(rnd() * (CANDS - 1)), CANDS);
          dead = []; clock = 0;
          host.text([cfg.prompt, "‹enter› to choose"]);
        },
        input: function (a) {
          if (a === "up") sel = mod(sel - 1, CANDS);
          else if (a === "down") sel = mod(sel + 1, CANDS);
          else if (a === "enter") {
            if (sel === answer) host.solve();
            else if (dead.indexOf(sel) === -1) {
              dead.push(sel);
              if (dead.length >= CANDS - 1) { answer = sel; host.solve(); }
            }
          }
        },
        update: function (dt) { clock += dt; },
        draw: function (ctx, w, h, dt) {
          var ink = host.ink;
          // The backdrop is the SHELL's, drawn once before this runs (game.js owns the one
          // alpha). host.spiralPreview() used to be called here too, which is why the
          // puzzle sat on a doubled backdrop; it is now idempotent, so a copy of this
          // engine that reinstates the call is harmless rather than a regression.
          // Marks come from host.ink, pre-floored at FULL alpha — never dim with
          // globalAlpha, that compounding is what put the old marks under the floor.
          ctx.globalCompositeOperation = "source-over";
          var x0 = w * 0.12, x1 = w * 0.88, span = x1 - x0, i;
          function px(v) { return x0 + (v / SPAN) * span; }

          ctx.strokeStyle = "rgba(138,147,180,0.35)"; ctx.lineWidth = 1;   // the axis
          ctx.beginPath(); ctx.moveTo(x0, h * 0.42); ctx.lineTo(x1, h * 0.42); ctx.stroke();

          for (i = 0; i < samples.length; i++) {                          // the samples
            ctx.beginPath(); ctx.arc(px(samples[i]), h * 0.42, Math.min(w, h) * 0.014, 0, Math.PI * 2);
            ctx.fillStyle = ink.accent(); ctx.fill();
          }
          for (i = 0; i < CANDS; i++) {                                   // the candidate bands
            var y = h * 0.6 + i * h * 0.07, on = i === sel, gone = dead.indexOf(i) !== -1;
            // a REFUSED band keeps its alpha strike-out; a merely unselected one is the
            // dim ink at full alpha, because the visitor still has to compare it.
            ctx.globalAlpha = gone ? 0.15 : 1;
            ctx.strokeStyle = on ? ink.mark(1) : ink.dim(0);
            ctx.lineWidth = on ? 4 : 2;
            ctx.beginPath();
            ctx.moveTo(px(bands[i][0]), y); ctx.lineTo(px(bands[i][1]), y); ctx.stroke();
            ctx.globalAlpha = 1;
          }
        },
        exit: function () { bands = []; samples = []; },
        solution: function () {
          var seq = [], s = sel;
          while (s !== answer) { seq.push("down"); s = mod(s + 1, CANDS); }
          seq.push("enter");
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "rangeguess", title: "Where It Lives", salt: 1013,
    prompt: "which band did these come from",
    deploy: { exhibit: "Chaos game", palette: 9, organism: { syn: 0, slime: 0.4, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
