/* games/mastermind.js — ENGINE 4 of Tier 1A: Mastermind.
 *
 * A hidden 4-slot combination of 4 palette modes. Set a row, commit it, read the pegs.
 *   ▲/▼ cycle the value in the ACTIVE slot   ‹enter› advance a slot / commit the last one
 *   ‹back› step back a slot — CONSUMED (returns true) whenever there is a slot to step
 *          back to; falsy only at slot 0, so the shell's exit still works.
 *
 * Feedback is the classic two-peg read: how many are exactly right, how many are the right
 * value in the wrong slot. Wrong guesses are INTERNAL state; host.attemptFailed() fires at
 * most ONCE, when the last of GUESSES rows is spent — a genuine run-ending loss. It is
 * machine-wide, so it must never fire per guess.
 */
(function (root) {
  "use strict";
  var Game = root.Game, SLOTS = 4;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    var VALUES = cfg.values || 4, GUESSES = cfg.guesses || 8;

    return function (host) {
      var secret = [], row = [], slot = 0, history = [], lost = false, clock = 0;

      function score(g) {
        var exact = 0, i, sc = [0, 0, 0, 0, 0, 0, 0, 0], gc = sc.slice();
        for (i = 0; i < SLOTS; i++) {
          if (g[i] === secret[i]) exact++;
          else { sc[secret[i]]++; gc[g[i]]++; }
        }
        var near = 0;
        for (i = 0; i < VALUES; i++) near += Math.min(sc[i], gc[i]);
        return { exact: exact, near: near };
      }
      function say() {
        host.text([cfg.prompt, (GUESSES - history.length) + " left"]);
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 631));
          secret = []; for (var i = 0; i < SLOTS; i++) secret.push(Math.floor(rnd() * VALUES));
          row = [0, 0, 0, 0];
          if (secret.every(function (v) { return v === 0; })) secret[1] = 1;   // never pre-solved
          slot = 0; history = []; lost = false; clock = 0;
          say();
        },
        input: function (a) {
          if (lost) return;
          if (a === "up") row[slot] = mod(row[slot] - 1, VALUES);
          else if (a === "down") row[slot] = mod(row[slot] + 1, VALUES);
          else if (a === "enter") {
            if (slot < SLOTS - 1) { slot++; return; }
            var s = score(row);
            history.push({ row: row.slice(), exact: s.exact, near: s.near });
            if (s.exact === SLOTS) { host.solve(); return; }
            slot = 0;
            if (history.length >= GUESSES) {
              lost = true;
              host.attemptFailed();      // the ONLY call: the run is genuinely over
              // A spent run must SAY there is a way out. ‹back› already falls through
              // falsy below, so the shell exits — but a frozen board with nothing on it
              // just sits there until the 25s attract, which reads as a hang.
              host.text([cfg.spent || cfg.prompt, "‹back›"]);
              return;
            }
            say();
          } else if (a === "back") {
            if (slot > 0) { slot--; return true; }   // consumed as "step back a slot"
            return false;                            // at slot 0 there is no undo → shell exits
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
          if (lost) ctx.globalAlpha = 0.3;                      // the board goes quiet
          var r = Math.min(w, h) * 0.045, gap = r * 2.8;
          var x0 = w / 2 - gap * (SLOTS - 1) / 2, i, j;

          for (j = 0; j < history.length; j++) {                 // spent rows, oldest at the top
            var hy = h * 0.16 + j * r * 1.5;
            for (i = 0; i < SLOTS; i++) {
              // spent rows are the DIM ink at full alpha, not the live ink faded out:
              // the feedback pegs are the whole game and have to stay readable.
              ctx.beginPath();
              ctx.arc(x0 + i * gap, hy, r * 0.32, 0, Math.PI * 2);
              ctx.fillStyle = ink.dim(history[j].row[i]); ctx.fill();
            }
            for (i = 0; i < history[j].exact; i++) {             // the two pegs
              ctx.beginPath(); ctx.arc(x0 + SLOTS * gap + i * r * 0.5, hy - r * 0.2, r * 0.14, 0, Math.PI * 2);
              ctx.fillStyle = ink.accent(); ctx.fill();
            }
            for (i = 0; i < history[j].near; i++) {
              ctx.beginPath(); ctx.arc(x0 + SLOTS * gap + i * r * 0.5, hy + r * 0.3, r * 0.14, 0, Math.PI * 2);
              ctx.strokeStyle = ink.mark(1); ctx.lineWidth = 1.5; ctx.stroke();
            }
          }

          var y = h * 0.74;                                      // the live row
          for (i = 0; i < SLOTS; i++) {
            var x = x0 + i * gap, on = i === slot;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = on ? ink.mark(row[i]) : ink.dim(row[i]);
            ctx.fill();
            if (on) {
              ctx.lineWidth = 3; ctx.strokeStyle = ink.accent();
              ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, Math.PI * 2); ctx.stroke();
            }
          }
          if (lost) {
            // the one lit thing left on a spent board: the way out.
            ctx.globalAlpha = 1;
            ctx.strokeStyle = ink.accent(); ctx.lineWidth = 3;
            var ax = w / 2, ay = h * 0.9, a = r * 0.5;
            ctx.beginPath();
            ctx.moveTo(ax + a, ay - a); ctx.lineTo(ax - a, ay); ctx.lineTo(ax + a, ay + a);
            ctx.stroke();
          }
        },
        exit: function () { history = []; },
        solution: function () {
          // walk the live row onto the secret, then commit it — one guess, from here.
          var seq = [], s = slot, cur = row.slice();
          function goTo(i) { while (s > i) { seq.push("back"); s--; } while (s < i) { seq.push("enter"); s++; } }
          for (var i = 0; i < SLOTS; i++) {
            goTo(i);
            var need = mod(secret[i] - cur[i], VALUES);
            for (var k = 0; k < need; k++) { seq.push("down"); cur[i] = mod(cur[i] + 1, VALUES); }
          }
          goTo(SLOTS - 1);
          seq.push("enter");                                     // commit
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "mastermind", title: "The Combination", salt: 631, values: 4, guesses: 8,
    prompt: "find the hidden four", spent: "the lock holds",
    deploy: { exhibit: "Quasicrystal", palette: 8, organism: { syn: 0.4, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
