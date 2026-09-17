/* games/fireflies.js — FIREFLIES → "Kuramoto fireflies".
 *
 * Four blinkers, each on a shared advancing clock plus its own integer phase offset (phase is
 * QUANTIZED to 12 slots — the director's fix that makes it exactly solvable rather than a
 * fuzzy chase). Line every offset up and they blink as one — which IS the Kuramoto order
 * parameter R → 1.
 *
 *   ▲/▼ select firefly   ‹enter› nudge +1 slot   ‹back› nudge −1 slot   WIN: all offsets equal
 *
 * Deterministic; solution() brings every offset to firefly 0's.
 */
(function (root) {
  "use strict";
  var Game = root.Game, SLOTS = 12, FLIES = 4;
  function mod(x, m) { return ((x % m) + m) % m; }

  Game.register({
    id: "fireflies",
    title: "Fireflies",
    deploy: { exhibit: "Kuramoto fireflies", palette: 7, organism: { syn: 0, slime: 0, fluid: 0, vicsek: 0.6 } },

    create: function (host) {
      var off = [0, 0, 0, 0], sel = 0, clock = 0;
      function won() { return off.every(function (o) { return o === off[0]; }); }
      function check() { if (won()) host.solve(); }
      return {
        enter: function () {
          var rnd = host.rng(host.seed + 202);
          for (var i = 0; i < FLIES; i++) off[i] = Math.floor(rnd() * SLOTS);
          // guarantee it isn't pre-solved: if all equal, bump one
          if (won()) off[1] = mod(off[1] + 1, SLOTS);
          sel = 0; clock = 0;
          host.text(["make them blink as one", "‹enter› +  ‹back› −"]);
        },
        input: function (a) {
          if (a === "up") sel = mod(sel - 1, FLIES);
          else if (a === "down") sel = mod(sel + 1, FLIES);
          else if (a === "enter") { off[sel] = mod(off[sel] + 1, SLOTS); check(); }
          else if (a === "back") { off[sel] = mod(off[sel] - 1, SLOTS); check(); return true; }
        },
        update: function (dt) { clock += dt * 0.9; },
        draw: function (ctx, w, h, dt) {
          ctx.globalCompositeOperation = "source-over";
          var y = h / 2, gap = Math.min(w, h) * 0.18, x0 = w / 2 - gap * 1.5, r = Math.min(w, h) * 0.05;
          for (var i = 0; i < FLIES; i++) {
            var x = x0 + i * gap;
            var phase = mod(clock + off[i] / SLOTS, 1);              // shared clock + integer offset
            var glow = 0.15 + 0.85 * Math.pow(Math.max(0, Math.cos(phase * Math.PI * 2)), 4);
            var g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
            g.addColorStop(0, "rgba(242,201,76," + glow.toFixed(3) + ")"); g.addColorStop(1, "rgba(242,201,76,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
            if (i === sel) { ctx.strokeStyle = "rgba(184,169,224,0.9)"; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.stroke(); }
          }
        },
        exit: function () {},
        solution: function () {
          var seq = [], s = sel, target = off[0], r = off.slice();
          for (var i = 1; i < FLIES; i++) {
            while (s !== i) { seq.push("down"); s = mod(s + 1, FLIES); }
            var need = mod(target - r[i], SLOTS);
            for (var k = 0; k < need; k++) { seq.push("enter"); r[i] = mod(r[i] + 1, SLOTS); }
          }
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
