/* games/sequence.js — ENGINE 3 of Tier 1A: Sequence / What Comes Next.
 *
 * Three states of one parametric rose family (n = a, a+d, a+2d); supply the fourth.
 *   ▲/▼ cycle the candidates   ‹enter› pick   ‹back› not consumed (shell exits)
 *
 * A wrong pick is INTERNAL state — it dims that candidate and costs a try; it never calls
 * host.attemptFailed() (machine-wide). When only one candidate is left it IS the answer,
 * so the kiosk never dead-ends. Deterministic from host.rng(host.seed + salt) in enter().
 */
(function (root) {
  "use strict";
  var Game = root.Game, CANDS = 4;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    return function (host) {
      var shown = [], cands = [], answer = 0, sel = 0, dead = [], clock = 0;

      // `col` arrives pre-floored from host.ink; alpha is only ever used to strike a
      // candidate OUT (a spent guess), never to say "this one is merely unselected".
      function rose(c, x, y, r, n, col, alpha) {
        c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
        for (var s = 0; s <= 200; s++) {
          var th = s / 200 * Math.PI * 2, rd = r * Math.abs(Math.cos(n * th / 2));
          var px = x + Math.cos(th) * rd, py = y + Math.sin(th) * rd;
          if (s === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke(); c.globalAlpha = 1;
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 523));
          var a = 2 + Math.floor(rnd() * 3), d = 1 + Math.floor(rnd() * 2);
          shown = [a, a + d, a + 2 * d];
          var truth = a + 3 * d;
          cands = [truth];
          var guard = 0;
          while (cands.length < CANDS && guard++ < 64) {
            var c = truth + (Math.floor(rnd() * 5) - 2);
            if (c > 1 && cands.indexOf(c) === -1) cands.push(c);
          }
          while (cands.length < CANDS) cands.push(truth + cands.length + 2);
          for (var k = cands.length - 1; k > 0; k--) {                 // deterministic shuffle
            var j = Math.floor(rnd() * (k + 1)), t = cands[k]; cands[k] = cands[j]; cands[j] = t;
          }
          answer = cands.indexOf(truth);
          sel = 0; dead = []; clock = 0;
          host.text([cfg.prompt, "‹enter› to choose"]);
        },
        input: function (a) {
          if (a === "up") sel = mod(sel - 1, CANDS);
          else if (a === "down") sel = mod(sel + 1, CANDS);
          else if (a === "enter") {
            if (sel === answer) host.solve();
            else if (dead.indexOf(sel) === -1) {
              dead.push(sel);
              if (dead.length >= CANDS - 1) { answer = sel; host.solve(); }   // never a dead end
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
          var i, rr = Math.min(w, h) * 0.075;
          for (i = 0; i < 4; i++) {                                    // the three given + the gap
            var x = w / 2 + (i - 1.5) * rr * 2.6, y = h * 0.33;
            if (i < 3) rose(ctx, x, y, rr, shown[i], ink.mark(0), 1);
            else {
              ctx.strokeStyle = ink.accent(); ctx.lineWidth = 2;
              ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
              ctx.stroke(); ctx.setLineDash([]);
            }
          }
          for (i = 0; i < CANDS; i++) {                                // the candidates
            var cx = w / 2 + (i - (CANDS - 1) / 2) * rr * 2.6, cy = h * 0.7, on = i === sel;
            var gone = dead.indexOf(i) !== -1;
            // spent candidates keep their alpha strike-out; live ones are a full-alpha
            // ink change (mark vs dim), so an unselected candidate is still readable.
            rose(ctx, cx, cy, rr * 0.85, cands[i], on ? ink.mark(1) : ink.dim(0), gone ? 0.15 : 1);
          }
        },
        exit: function () { shown = []; cands = []; },
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
    id: "sequence", title: "What Comes Next", salt: 523,
    prompt: "the family keeps going",
    deploy: { exhibit: "Maurer rose", palette: 6, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
