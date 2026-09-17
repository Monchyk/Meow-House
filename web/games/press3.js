/* games/press3.js — Phase-1 reference game: the smallest thing that proves the contract.
 *
 * Timing-FREE by design (architect's call): "press ‹enter› three times". Up/Down are inert,
 * Back is the shell's exit. It exercises the whole enter→solve→deploy path and the host API
 * (text + solve) with zero surface, so the framework itself is what's under test, not a
 * puzzle. The first real timing game (Orbit/Clockwork) is what will exercise host.now().
 *
 * Firewall: on-screen text is a number and a feeling-word — never prose about anyone.
 */
(function (root) {
  "use strict";
  var Game = root.Game;

  Game.register({
    id: "press3",
    title: "Three",
    // what a win unlocks — the reward target, decoupled from this game's own visuals.
    deploy: { exhibit: "Lissajous", palette: 0, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0 } },

    create: function (host) {
      var count = 0;
      function say() { host.text(["press ‹enter› three times", count + " / 3"]); }
      return {
        enter: function () { count = 0; say(); },
        input: function (action) {
          if (action === "enter") {
            count++;
            say();
            if (count >= 3) host.solve();
          }
          // up / down: inert. back: not consumed (input returns falsy), so the shell's
          // default fires and Back exits PLAY — the reference game has no undo stack.
        },
        update: function (dt) { /* no animation state */ },
        draw: function (ctx, w, h, dt) {
          // three pips, filled as they're earned — a legible read of progress.
          ctx.globalCompositeOperation = "source-over";
          var r = Math.min(w, h) * 0.03, gap = r * 3, y = h * 0.5;
          var x0 = w / 2 - gap;
          for (var i = 0; i < 3; i++) {
            var x = x0 + i * gap, on = i < count;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = on ? "#f2c94c" : "rgba(138,147,180,0.25)";
            ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = on ? "#f2c94c" : "#3a466e"; ctx.stroke();
          }
        },
        exit: function () { count = 0; }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
