/* games/oddone.js — ENGINE 1 of Tier 1A: Odd One Out.
 *
 * Four figures; three obey one rule, one doesn't. Pick the outlier.
 *   ▲/▼ move the selection   ‹enter› commit   ‹back› not consumed (shell exits)
 *
 * Wrong pick is INTERNAL state only — the counter re-rolls the board, it never calls
 * host.attemptFailed() (that is machine-wide and cools the whole cabinet down).
 * Deterministic: every choice comes from host.rng(host.seed + k) in enter().
 *
 * Engine + skins (P0-3): makeEngine(config) → create(host). `config.trait` names the
 * visual rule; the shape is drawn from a single integer per item, so a reskin is data.
 */
(function (root) {
  "use strict";
  var Game = root.Game, N = 4, MAX_ROLLS = 4;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    var LO = cfg.lo || 3, HI = cfg.hi || 9;

    return function (host) {
      var vals = [], odd = 0, sel = 0, rolls = 0, clock = 0, rnd = null;

      function deal() {
        var base = LO + Math.floor(rnd() * (HI - LO));          // the shared rule
        var other = base;
        while (other === base) other = LO + Math.floor(rnd() * (HI - LO + 1));
        odd = Math.floor(rnd() * N);
        vals = [];
        for (var i = 0; i < N; i++) vals.push(i === odd ? other : base);
        sel = 0;
      }
      function say() { host.text([cfg.prompt, "‹enter› to choose"]); }

      return {
        enter: function () {
          rnd = host.rng(host.seed + (cfg.salt || 311));
          rolls = 0; clock = 0; deal(); say();
        },
        input: function (a) {
          if (a === "up") sel = mod(sel - 1, N);
          else if (a === "down") sel = mod(sel + 1, N);
          else if (a === "enter") {
            if (sel === odd) host.solve();
            else if (++rolls >= MAX_ROLLS) { odd = sel; host.solve(); }  // mercy: never a dead end
            else deal();                                                 // wrong: internal only
          }
          // back: not consumed — no undo stack here, so the shell's exit is correct.
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
          var gap = Math.min(w / (N + 1), h * 0.4), x0 = w / 2 - gap * (N - 1) / 2;
          var y = h / 2, r = gap * 0.3;
          for (var i = 0; i < N; i++) {
            var x = x0 + i * gap, k = vals[i], on = i === sel;
            ctx.beginPath();
            for (var s = 0; s <= 128; s++) {
              var th = s / 128 * Math.PI * 2;
              var rr = r * (0.62 + 0.38 * Math.cos(k * th + clock * 0.4));
              var px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
              if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            // selected vs not is a WIDTH and an INK change, never an alpha fade: a floored
            // colour at globalAlpha 0.55 lands back under the floor, which is the defect.
            ctx.lineWidth = on ? 3 : 1.5;
            ctx.strokeStyle = on ? ink.mark(1) : ink.dim(0);
            ctx.stroke();
            if (on) {
              ctx.beginPath(); ctx.arc(x, y + r * 1.7, r * 0.09, 0, Math.PI * 2);
              ctx.fillStyle = ink.accent(); ctx.fill();
            }
          }
        },
        exit: function () { vals = []; },
        solution: function () {
          var seq = [], s = sel;
          while (s !== odd) { seq.push("down"); s = mod(s + 1, N); }
          seq.push("enter");
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "oddone", title: "Odd One Out", salt: 311, lo: 3, hi: 9,
    prompt: "one of these breaks the rule",
    deploy: { exhibit: "Voronoi shatter", palette: 4, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0.3 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
