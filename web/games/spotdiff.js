/* games/spotdiff.js — ENGINE 10 of Tier 1A: Spot the Difference.
 *
 * Two frames of the same figure. Exactly one parameter moved. Which one?
 *   ▲/▼ cycle the candidate parameters   ‹enter› pick   ‹back› not consumed (shell exits)
 *
 * The parameters are drawn as four labelled-by-shape dials under each frame, so the "what
 * changed" question is answerable by looking, with no words on screen. A wrong pick dims
 * that dial and costs a try — internal state, never host.attemptFailed(). When one dial is
 * left it is the answer, so the kiosk never dead-ends.
 */
(function (root) {
  "use strict";
  var Game = root.Game, PARAMS = 4;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    return function (host) {
      var a = [], b = [], answer = 0, sel = 0, dead = [], clock = 0;

      function figure(ctx, cx, cy, r, p, col, alpha) {
        // p = [lobes, twist, radius-bias, thickness] — four visibly separable dials.
        ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 1 + p[3] * 0.5;
        ctx.beginPath();
        for (var s = 0; s <= 240; s++) {
          var th = s / 240 * Math.PI * 2;
          var rd = r * (0.45 + 0.1 * p[2]) * (1 + 0.35 * Math.cos(p[0] * th + p[1] * 0.5));
          var px = cx + Math.cos(th) * rd, py = cy + Math.sin(th) * rd;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 1223));
          a = [3 + Math.floor(rnd() * 4), Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 4)];
          answer = Math.floor(rnd() * PARAMS);
          b = a.slice();
          b[answer] = a[answer] + (rnd() < 0.5 ? -2 : 2);
          if (b[answer] < 1) b[answer] = a[answer] + 2;               // stay in a drawable range
          sel = 0; dead = []; clock = 0;
          host.text([cfg.prompt, "‹enter› to choose"]);
        },
        input: function (act) {
          if (act === "up") sel = mod(sel - 1, PARAMS);
          else if (act === "down") sel = mod(sel + 1, PARAMS);
          else if (act === "enter") {
            if (sel === answer) host.solve();
            else if (dead.indexOf(sel) === -1) {
              dead.push(sel);
              if (dead.length >= PARAMS - 1) { answer = sel; host.solve(); }
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
          var r = Math.min(w * 0.22, h * 0.26);
          // both frames at FULL alpha: comparing them IS the game, so neither may be the
          // faded one. They are told apart by ink role, not by opacity.
          figure(ctx, w * 0.3, h * 0.4, r, a, ink.mark(0), 1);
          figure(ctx, w * 0.7, h * 0.4, r, b, ink.mark(1), 1);

          // the four dials: a filled arc per parameter, the selected one ringed.
          var dr = Math.min(w, h) * 0.035, gap = dr * 3.4, x0 = w / 2 - gap * (PARAMS - 1) / 2;
          for (var i = 0; i < PARAMS; i++) {
            var x = x0 + i * gap, y = h * 0.8, on = i === sel, gone = dead.indexOf(i) !== -1;
            ctx.globalAlpha = gone ? 0.15 : 1;      // strike-out only; never a "quieter" fade
            ctx.strokeStyle = on ? ink.mark(0) : ink.dim(0); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, dr, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();                                          // the dial's own shape hint
            ctx.arc(x, y, dr * 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((i + 1) / PARAMS));
            ctx.strokeStyle = ink.accent(); ctx.lineWidth = 3; ctx.stroke();
            if (on) {
              ctx.lineWidth = 2; ctx.strokeStyle = ink.accent();
              ctx.beginPath(); ctx.arc(x, y, dr * 1.4, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
        },
        exit: function () { a = []; b = []; },
        solution: function () {
          var seq = [], s = sel;
          while (s !== answer) { seq.push("down"); s = mod(s + 1, PARAMS); }
          seq.push("enter");
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "spotdiff", title: "What Moved", salt: 1223,
    prompt: "one dial changed",
    deploy: { exhibit: "Moiré interference", palette: 0, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
