/* games/lockpick.js — LOCKPICK → "Kaleidoscope".
 *
 * Three concentric rings, each with a gap at one of 12 notches, misaligned. Line every gap
 * up at notch 0 and the lock opens — which IS the kaleidoscope resolving into radial symmetry.
 *
 *   ▲/▼ select ring   ‹enter› rotate +1   ‹back› rotate −1   WIN: all gaps at notch 0
 *
 * Deterministic + seedable (host.rng(host.seed)); exposes solution() so the headless suite can
 * drive it to a win without duplicating the rules.
 */
(function (root) {
  "use strict";
  var Game = root.Game, N = 12, RINGS = 3;
  function mod(x, m) { return ((x % m) + m) % m; }

  Game.register({
    id: "lockpick",
    title: "Lockpick",
    deploy: { exhibit: "Kaleidoscope", palette: 5, organism: { syn: 0, slime: 0, fluid: 0.5, vicsek: 0 } },

    create: function (host) {
      var gaps = [0, 0, 0], sel = 0;
      function won() { return gaps[0] === 0 && gaps[1] === 0 && gaps[2] === 0; }
      function check() { if (won()) host.solve(); }
      return {
        enter: function () {
          var rnd = host.rng(host.seed + 101);
          for (var i = 0; i < RINGS; i++) gaps[i] = 1 + Math.floor(rnd() * (N - 1)); // 1..11, never pre-solved
          sel = 0;
          host.text(["align every gap to the top", "‹enter› +  ‹back› −"]);
        },
        input: function (a) {
          if (a === "up") sel = mod(sel - 1, RINGS);
          else if (a === "down") sel = mod(sel + 1, RINGS);
          else if (a === "enter") { gaps[sel] = mod(gaps[sel] + 1, N); check(); }
          else if (a === "back") { gaps[sel] = mod(gaps[sel] - 1, N); check(); return true; } // consume Back
        },
        update: function (dt) {},
        draw: function (ctx, w, h, dt) {
          ctx.globalCompositeOperation = "source-over";
          var cx = w / 2, cy = h / 2, base = Math.min(w, h) * 0.14;
          for (var i = 0; i < RINGS; i++) {
            var r = base + i * base * 0.7, on = i === sel;
            ctx.lineWidth = base * 0.34;
            ctx.strokeStyle = on ? "rgba(242,201,76,0.9)" : "rgba(138,147,180,0.5)";
            // notch 0 must sit at the TOP tick (12 o'clock) — the instruction says "align to the
            // top" and won() checks notch 0, so 0 has to be where the target tick is drawn. Canvas
            // angle 0 is the +x axis (3 o'clock); the -π/2 rotation puts notch 0 at the top instead.
            // Without it, following the on-screen instruction sets the gaps to notch 9 and the lock
            // can never open (the headless suite missed this: it drives the logical solution, not the
            // drawn target).
            var gapA = (gaps[i] / N) * Math.PI * 2 - Math.PI / 2, half = 0.32;
            ctx.beginPath(); ctx.arc(cx, cy, r, gapA + half, gapA - half + Math.PI * 2); ctx.stroke();
            // a tick at notch 0 (the target)
            ctx.strokeStyle = "rgba(184,169,224,0.7)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy - r - base * 0.2); ctx.lineTo(cx, cy - r + base * 0.2); ctx.stroke();
          }
        },
        exit: function () {},
        // the winning sequence from the CURRENT state: select each ring, rotate its gap to 0.
        solution: function () {
          var seq = [], s = sel, g = gaps.slice();
          for (var i = 0; i < RINGS; i++) {
            while (s !== i) { seq.push("down"); s = mod(s + 1, RINGS); }
            var need = mod(N - g[i], N);
            for (var k = 0; k < need; k++) { seq.push("enter"); g[i] = mod(g[i] + 1, N); }
          }
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
