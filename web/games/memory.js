/* games/memory.js — ENGINE 6 of Tier 1A: Memory / Matching.
 *
 * Six cards, three pairs. Find them all. Six, not sixteen — kiosk pacing.
 *   ▲/▼ move the cursor   ‹enter› flip the card under it
 *   ‹back› not consumed (shell exits) — a flip is not undoable, that is the game.
 *
 * A mismatched pair stays face-up until the NEXT flip, then turns back. No timer: the
 * turn-back is driven by the player's own next press, so it behaves identically headless
 * (where the clock is never ticked) and on the floor. A wrong pair is internal state and
 * never touches host.attemptFailed().
 */
(function (root) {
  "use strict";
  var Game = root.Game;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    var PAIRS = cfg.pairs || 3, N = PAIRS * 2;

    return function (host) {
      var face = [], up = [], done = [], cur = 0, clock = 0;

      function solved() { return done.length === PAIRS; }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 809));
          face = []; for (var i = 0; i < PAIRS; i++) { face.push(i); face.push(i); }
          for (var k = N - 1; k > 0; k--) {                       // deterministic shuffle
            var j = Math.floor(rnd() * (k + 1)), t = face[k]; face[k] = face[j]; face[j] = t;
          }
          up = []; done = []; cur = 0; clock = 0;
          host.text([cfg.prompt, PAIRS + " pairs"]);
        },
        input: function (a) {
          if (a === "up") return void (cur = mod(cur - 1, N));
          if (a === "down") return void (cur = mod(cur + 1, N));
          if (a !== "enter") return;                              // back: shell exits
          if (up.length === 2) up = [];                           // the turn-back, on the next press
          if (done.indexOf(face[cur]) !== -1) return;             // already matched
          if (up.indexOf(cur) !== -1) return;                     // already face-up this turn
          up.push(cur);
          if (up.length === 2) {
            if (face[up[0]] === face[up[1]]) {
              done.push(face[up[0]]); up = [];
              if (solved()) host.solve();
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
          var cols = N, gap = Math.min(w / (cols + 1), h * 0.3);
          var x0 = w / 2 - gap * (cols - 1) / 2, y = h / 2, s = gap * 0.36;
          for (var i = 0; i < N; i++) {
            var x = x0 + i * gap;
            var shown = up.indexOf(i) !== -1 || done.indexOf(face[i]) !== -1;
            var matched = done.indexOf(face[i]) !== -1;
            // a matched pair goes QUIET by dropping to the dim ink, not by fading out.
            ctx.lineWidth = i === cur ? 3 : 1.5;
            ctx.strokeStyle = i === cur ? ink.accent() : (matched ? ink.dim(0) : ink.mark(0));
            ctx.strokeRect(x - s, y - s * 1.4, s * 2, s * 2.8);
            if (shown) {                                          // the face: n-fold rosette
              var n = face[i] + 2;
              ctx.beginPath();
              for (var k = 0; k <= 96; k++) {
                var th = k / 96 * Math.PI * 2, rd = s * 0.8 * Math.abs(Math.cos(n * th / 2));
                var px = x + Math.cos(th) * rd, py = y + Math.sin(th) * rd;
                if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
              }
              ctx.strokeStyle = matched ? ink.dim(face[i] + 1) : ink.mark(face[i] + 1);
              ctx.lineWidth = 1.8; ctx.stroke();
            }
          }
        },
        exit: function () { face = []; up = []; done = []; },
        solution: function () {
          var c = cur, seq = [], d = done.slice(), open = up.slice();
          function goTo(i) { while (c !== i) { seq.push("down"); c = mod(c + 1, N); } }
          if (open.length === 2) { goTo(open[0]); seq.push("enter"); open = [c]; }  // clears the turn-back
          for (var v = 0; v < PAIRS; v++) {
            if (d.indexOf(v) !== -1) continue;
            var a = -1, b = -1;
            for (var i = 0; i < N; i++) if (face[i] === v) { if (a < 0) a = i; else b = i; }
            if (open.length === 1 && open[0] === a) { goTo(b); seq.push("enter"); }
            else if (open.length === 1 && open[0] === b) { goTo(a); seq.push("enter"); }
            else { goTo(a); seq.push("enter"); goTo(b); seq.push("enter"); }
            open = [];
          }
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "memory", title: "Pairs", salt: 809, pairs: 3,
    prompt: "find the matching pairs",
    deploy: { exhibit: "Mystic rose", palette: 1, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
