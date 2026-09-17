/* games/clockwork.js — CLOCKWORK → "Epicycloid gears".
 *
 * A driver gear turns; the middle gears are lifted out of mesh; the final gear is dead. Drop
 * every middle gear into the train and drive reaches the end — which IS the gear ratios
 * locking to integers (the epicycloid resolving).
 *
 *   ▲/▼ select gear   ‹enter› ENGAGE (drop into mesh)   ‹back› LIFT (undo)   WIN: all engaged
 *
 * The director split engage/lift so ‹back› is a true undo (it returns truthy → the shell does
 * not treat it as exit). Deterministic; solution() drives it to a win.
 */
(function (root) {
  "use strict";
  var Game = root.Game, GEARS = 3;

  Game.register({
    id: "clockwork",
    title: "Clockwork",
    deploy: { exhibit: "Epicycloid gears", palette: 3, organism: { syn: 0.5, slime: 0, fluid: 0, vicsek: 0 } },

    create: function (host) {
      var engaged = [false, false, false], sel = 0, spin = 0;
      function won() { return engaged.every(function (e) { return e; }); }
      return {
        enter: function () {
          engaged = [false, false, false]; sel = 0; spin = 0;
          host.text(["engage every gear", "‹enter› drop in   ‹back› lift"]);
        },
        input: function (a) {
          if (a === "up") sel = (sel - 1 + GEARS) % GEARS;
          else if (a === "down") sel = (sel + 1) % GEARS;
          else if (a === "enter") { engaged[sel] = true; if (won()) host.solve(); }
          else if (a === "back") { engaged[sel] = false; return true; }  // lift = true undo
        },
        update: function (dt) { spin += dt * (won() ? 2.2 : 0.6); },
        draw: function (ctx, w, h, dt) {
          ctx.globalCompositeOperation = "source-over";
          var y = h / 2, r = Math.min(w, h) * 0.09, gap = r * 2.1, x0 = w / 2 - gap * 1.5;
          // driver (0-th visual), then the 3 middles
          for (var i = 0; i < GEARS; i++) {
            var x = x0 + (i + 1) * gap, on = engaged[i], picked = i === sel;
            ctx.save(); ctx.translate(x, on ? y : y - r * 0.9); ctx.rotate(on ? spin * (i % 2 ? -1 : 1) : 0);
            ctx.strokeStyle = on ? "rgba(242,201,76,0.95)" : (picked ? "rgba(184,169,224,0.9)" : "rgba(138,147,180,0.45)");
            ctx.lineWidth = 3; ctx.beginPath();
            for (var t = 0; t < 8; t++) { var a = t / 8 * Math.PI * 2, rr = r * (t % 2 ? 1 : 0.8); ctx[t ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath(); ctx.stroke(); ctx.restore();
          }
        },
        exit: function () {},
        solution: function () {
          var seq = [], s = sel;
          for (var i = 0; i < GEARS; i++) {
            if (engaged[i]) continue;
            while (s !== i) { seq.push("down"); s = (s + 1) % GEARS; }
            seq.push("enter");
          }
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
