/* games/higherlower.js — ENGINE 7 of Tier 1A: Higher / Lower.
 *
 * A parameter value is showing. Is the next one higher or lower? Five right in a row wins.
 *   ▲ higher   ▼ lower   ‹enter› inert (the two arrows ARE the answer)
 *   ‹back› not consumed (shell exits).
 *
 * The whole value ladder is drawn once in enter() from host.rng(host.seed + salt), so the
 * run is deterministic and solution() can simply read it off. Consecutive values are never
 * equal, so there is always a right answer. A wrong call resets the streak — internal state
 * only, never host.attemptFailed().
 */
(function (root) {
  "use strict";
  var Game = root.Game;

  function makeEngine(cfg) {
    var NEED = cfg.need || 5, STEPS = (cfg.need || 5) * 6, LO = 1, HI = 12;

    return function (host) {
      var vals = [], at = 0, streak = 0, last = 0, clock = 0;

      function say() { host.text([cfg.prompt, streak + " / " + NEED]); }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 907));
          vals = [LO + Math.floor(rnd() * (HI - LO + 1))];
          for (var i = 1; i < STEPS + 1; i++) {
            var v = LO + Math.floor(rnd() * (HI - LO + 1));
            if (v === vals[i - 1]) v = v < HI ? v + 1 : v - 1;      // never a tie: always answerable
            vals.push(v);
          }
          at = 0; streak = 0; last = 0; clock = 0; say();
        },
        input: function (a) {
          if (a !== "up" && a !== "down") return;                   // back: shell exits
          var right = (vals[at + 1] > vals[at]) === (a === "up");
          last = right ? 1 : -1;
          at = (at + 1) % STEPS;
          streak = right ? streak + 1 : 0;
          if (streak >= NEED) { host.solve(); return; }
          say();
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
          // the value as a ring of arms — bigger number, more arms. No digits, no prose.
          var r = Math.min(w, h) * 0.2, n = vals[at] || 1;
          ctx.strokeStyle = last > 0 ? ink.accent() : ink.mark(0);
          ctx.lineWidth = 2;
          for (var i = 0; i < n; i++) {
            var th = i / n * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(w / 2 + Math.cos(th) * r * 0.35, h * 0.45 + Math.sin(th) * r * 0.35);
            ctx.lineTo(w / 2 + Math.cos(th) * r, h * 0.45 + Math.sin(th) * r);
            ctx.stroke();
          }
          // the streak pips
          var pr = Math.min(w, h) * 0.012, gap = pr * 4, x0 = w / 2 - gap * (NEED - 1) / 2;
          for (var k = 0; k < NEED; k++) {
            ctx.beginPath(); ctx.arc(x0 + k * gap, h * 0.82, pr, 0, Math.PI * 2);
            ctx.fillStyle = k < streak ? ink.accent() : ink.dim(0);
            ctx.fill();
          }
        },
        exit: function () { vals = []; },
        solution: function () {
          var seq = [], i = at, s = streak;
          while (s < NEED) {
            seq.push(vals[i + 1] > vals[i] ? "up" : "down");
            s++; i = (i + 1) % STEPS;
          }
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "higherlower", title: "Higher or Lower", salt: 907, need: 5,
    prompt: "is the next one more, or less",
    deploy: { exhibit: "Ulam spiral", palette: 3, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
