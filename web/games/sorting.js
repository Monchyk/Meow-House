/* games/sorting.js — ENGINE 2 of Tier 1A: Sorting.
 *
 * Five bars in a scrambled order; put them in order.
 *   ▲/▼ move the cursor   ‹enter› pick up / drop (swaps the two positions)
 *   ‹back› undo the last swap — CONSUMED (returns true) while the stack has anything;
 *          falsy on an empty stack so the shell's exit still works. This is the #1 trap.
 *
 * Deterministic: the scramble is drawn in enter() from host.rng(host.seed + salt) and is
 * guaranteed not to be already sorted.
 */
(function (root) {
  "use strict";
  var Game = root.Game;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    var N = cfg.count || 5;

    return function (host) {
      var arr = [], cur = 0, held = -1, undo = [], clock = 0;

      function sorted(a) { for (var i = 1; i < a.length; i++) if (a[i] < a[i - 1]) return false; return true; }
      function swap(a, i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 419));
          arr = []; for (var i = 0; i < N; i++) arr.push(i);
          for (var k = N - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)); swap(arr, k, j); }
          if (sorted(arr)) swap(arr, 0, N - 1);              // never deal a solved board
          cur = 0; held = -1; undo = []; clock = 0;
          host.text([cfg.prompt, "‹enter› lift / place   ‹back› undo"]);
        },
        input: function (a) {
          if (a === "up") cur = mod(cur - 1, N);
          else if (a === "down") cur = mod(cur + 1, N);
          else if (a === "enter") {
            if (held < 0) held = cur;
            else {
              if (held !== cur) { swap(arr, held, cur); undo.push([held, cur]); }
              held = -1;
              if (sorted(arr)) host.solve();
            }
          } else if (a === "back") {
            if (held >= 0) { held = -1; return true; }        // cancel the lift
            if (undo.length) { var m = undo.pop(); swap(arr, m[0], m[1]); return true; }
            return false;                                     // nothing to undo → shell exits
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
          var gap = Math.min(w / (N + 1), h * 0.28), x0 = w / 2 - gap * (N - 1) / 2;
          var base = h * 0.72, unit = h * 0.42 / N;
          for (var i = 0; i < N; i++) {
            var x = x0 + i * gap, bh = unit * (arr[i] + 1);
            var lift = i === held ? unit * 0.6 : 0;
            ctx.fillStyle = i === cur ? ink.mark(1) : ink.dim(0);
            ctx.fillRect(x - gap * 0.22, base - bh - lift, gap * 0.44, bh);
            if (i === cur) {
              ctx.beginPath(); ctx.arc(x, base + unit * 0.5, gap * 0.05, 0, Math.PI * 2);
              ctx.fillStyle = ink.accent(); ctx.fill();
            }
          }
        },
        exit: function () { arr = []; undo = []; },
        solution: function () {
          // selection sort, replayed as cursor moves + lift/place pairs.
          var a = arr.slice(), c = cur, seq = [];
          if (held >= 0) seq.push("back");                    // start from a clean hand
          function moveTo(i) { while (c !== i) { seq.push("down"); c = mod(c + 1, N); } }
          for (var i = 0; i < N; i++) {
            var m = i; for (var j = i + 1; j < N; j++) if (a[j] < a[m]) m = j;
            if (m === i) continue;
            moveTo(m); seq.push("enter");
            moveTo(i); seq.push("enter");
            swap(a, i, m);
          }
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "sorting", title: "In Order", salt: 419, count: 5,
    prompt: "smallest to largest",
    deploy: { exhibit: "Fermat spiral", palette: 2, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
