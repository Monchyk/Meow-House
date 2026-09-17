/* games/spiralweaver.js — SPIRAL WEAVER → "Logarithmic spiral".
 *
 * Six nodes sit on a logarithmic spiral. Join them all into one path without the line ever
 * crossing itself — and the path you draw IS the spiral. Connecting them in spiral order is the
 * one clean solution; any chord that would cross the existing thread is refused.
 *
 *   ▲/▼ cycle the candidate node   ‹enter› connect current→candidate   ‹back› undo last
 *   WIN: all six joined, no self-crossing.
 *
 * The candidate cursor walks all six nodes; ‹enter› on an already-used node (or a crossing
 * chord) is simply refused. Deterministic (seeded rotation only — cosmetic, keeps the
 * spiral-order solution valid); solution() drives it to a win.
 */
(function (root) {
  "use strict";
  var Game = root.Game, TAU = Math.PI * 2, N = 6;
  function mod(x, m) { return ((x % m) + m) % m; }
  // proper segment intersection — strict, so a shared endpoint (adjacent edges) is NOT a cross.
  function ccw(a, b, c) { return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]); }
  function crosses(p1, p2, p3, p4) {
    var d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
    return (d1 * d2 < 0) && (d3 * d4 < 0);
  }

  Game.register({
    id: "spiralweaver",
    title: "Spiral Weaver",
    deploy: { exhibit: "Logarithmic spiral", palette: 0, organism: { syn: 0, slime: 0.6, fluid: 0, vicsek: 0 } },

    create: function (host) {
      var pos = [], path = [0], visited = [], cand = 1;
      function segCrosses(cur, c) {
        for (var k = 0; k < path.length - 1; k++)
          if (crosses(pos[cur], pos[c], pos[path[k]], pos[path[k + 1]])) return true;
        return false;
      }
      return {
        enter: function () {
          var rnd = host.rng(host.seed + 303), rot = rnd() * TAU;
          pos = []; for (var i = 0; i < N; i++) {
            var th = rot + i * 0.8, r = 0.15 * Math.exp(0.38 * i);
            pos.push([Math.cos(th) * r, Math.sin(th) * r]);
          }
          path = [0]; visited = [true, false, false, false, false, false]; cand = 1;
          host.text(["thread every node — no crossings", "‹enter› join   ‹back› undo"]);
        },
        input: function (a) {
          var cur = path[path.length - 1];
          if (a === "up") cand = mod(cand - 1, N);
          else if (a === "down") cand = mod(cand + 1, N);
          else if (a === "enter") {
            if (!visited[cand] && !segCrosses(cur, cand)) {           // refuse used nodes + crossings
              path.push(cand); visited[cand] = true;
              if (path.length === N) host.solve();
            }
          } else if (a === "back") {
            if (path.length > 1) { var last = path.pop(); visited[last] = false; cand = last; }
            return true;
          }
        },
        update: function (dt) {},
        draw: function (ctx, w, h, dt) {
          ctx.globalCompositeOperation = "source-over";
          var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
          function px(p) { return [cx + p[0] * R, cy + p[1] * R]; }
          ctx.strokeStyle = "rgba(242,201,76,0.9)"; ctx.lineWidth = 2; ctx.beginPath();
          for (var k = 0; k < path.length; k++) { var q = px(pos[path[k]]); ctx[k ? "lineTo" : "moveTo"](q[0], q[1]); }
          ctx.stroke();
          var cur = px(pos[path[path.length - 1]]), cp = px(pos[cand]);
          ctx.strokeStyle = "rgba(184,169,224,0.5)"; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(cur[0], cur[1]); ctx.lineTo(cp[0], cp[1]); ctx.stroke(); ctx.setLineDash([]);
          for (var i = 0; i < N; i++) { var p = px(pos[i]);
            ctx.fillStyle = visited[i] ? "#f2c94c" : (i === cand ? "#b8a9e0" : "rgba(138,147,180,0.6)");
            ctx.beginPath(); ctx.arc(p[0], p[1], Math.min(w, h) * 0.015, 0, TAU); ctx.fill(); }
        },
        exit: function () {},
        // spiral order (ascending index) is the guaranteed non-crossing solution.
        solution: function () {
          var seq = [], c = cand, rem = [];
          for (var i = 0; i < N; i++) if (!visited[i]) rem.push(i);
          rem.sort(function (a, b) { return a - b; });
          for (var j = 0; j < rem.length; j++) {
            var t = rem[j], steps = mod(t - c, N);
            for (var k = 0; k < steps; k++) seq.push("down");
            c = t; seq.push("enter");
          }
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
