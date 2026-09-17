/* games/lightpath.js — LIGHT PATH → "String art"  (loose pairing; K. may repoint).
 *
 * A beam enters the left edge and bends through four rotatable mirrors. Turn them so the beam
 * lands on the target — the traced beam is the caustic the string art draws. Built from a KNOWN
 * solution, so it is always solvable: the target is wherever the beam exits when every mirror
 * is at its solution orientation.
 *
 *   ▲/▼ select mirror   ‹enter› flip ╱↔╲   ‹back› select-previous   WIN: beam exits at target
 *
 * Deterministic beam trace (bounded, loop-safe); solution() flips each mirror toward its
 * solution orientation.
 */
(function (root) {
  "use strict";
  var Game = root.Game;
  var GW = 7, GH = 5, ROW = 2;
  // four mirror cells + the solution orientation that threads all four and exits West row 1.
  var MIR = [[2, 2], [2, 4], [5, 4], [5, 1]];
  var SOL = ["\\", "\\", "/", "\\"];

  function trace(orients) {
    var x = 0, y = ROW, dx = 1, dy = 0, steps = 0;
    while (steps++ < 200) {
      for (var i = 0; i < 4; i++) if (MIR[i][0] === x && MIR[i][1] === y) {
        if (orients[i] === "/") { var t = -dy; dy = -dx; dx = t; }   // E↔N, W↔S
        else { var t2 = dy; dy = dx; dx = t2; }                       // E↔S, W↔N
        break;
      }
      x += dx; y += dy;
      if (x < 0) return "W:" + y;
      if (x >= GW) return "E:" + y;
      if (y < 0) return "N:" + x;
      if (y >= GH) return "S:" + x;
    }
    return "none";                                                    // trapped in a loop → no exit
  }

  Game.register({
    id: "lightpath",
    title: "Light Path",
    deploy: { exhibit: "String art", palette: 9, organism: { syn: 0, slime: 0, fluid: 0.5, vicsek: 0 } },

    create: function (host) {
      var orient = [], sel = 0, target = trace(SOL);
      function check() { if (trace(orient) === target) host.solve(); }
      return {
        enter: function () {
          var rnd = host.rng(host.seed + 404);
          // scramble from the solution; ensure it isn't already solved
          orient = SOL.slice();
          for (var i = 0; i < 4; i++) if (rnd() < 0.6) orient[i] = orient[i] === "/" ? "\\" : "/";
          if (trace(orient) === target) orient[0] = orient[0] === "/" ? "\\" : "/";
          sel = 0;
          host.text(["aim the beam at the mark", "‹enter› flip a mirror"]);
        },
        input: function (a) {
          if (a === "up") sel = (sel - 1 + 4) % 4;
          else if (a === "down") sel = (sel + 1) % 4;
          else if (a === "enter") { orient[sel] = orient[sel] === "/" ? "\\" : "/"; check(); }
          else if (a === "back") { sel = (sel - 1 + 4) % 4; return true; }   // select-previous (no undo state)
        },
        update: function (dt) {},
        draw: function (ctx, w, h, dt) {
          ctx.globalCompositeOperation = "source-over";
          var cell = Math.min(w / (GW + 2), h / (GH + 2)), ox = (w - cell * GW) / 2, oy = (h - cell * GH) / 2;
          function cx(gx) { return ox + (gx + 0.5) * cell; }
          function cy(gy) { return oy + (gy + 0.5) * cell; }
          // beam path
          var x = 0, y = ROW, dx = 1, dy = 0, steps = 0, pts = [[ox, cy(ROW)]];
          while (steps++ < 200) {
            for (var i = 0; i < 4; i++) if (MIR[i][0] === x && MIR[i][1] === y) {
              if (orient[i] === "/") { var t = -dy; dy = -dx; dx = t; } else { var t2 = dy; dy = dx; dx = t2; } break;
            }
            pts.push([cx(x), cy(y)]);
            x += dx; y += dy;
            if (x < 0 || x >= GW || y < 0 || y >= GH) { pts.push([cx(x), cy(y)]); break; }
          }
          ctx.strokeStyle = "rgba(242,201,76,0.85)"; ctx.lineWidth = 2; ctx.beginPath();
          for (var k = 0; k < pts.length; k++) ctx[k ? "lineTo" : "moveTo"](pts[k][0], pts[k][1]);
          ctx.stroke();
          // mirrors
          for (var m = 0; m < 4; m++) {
            var mx = cx(MIR[m][0]), my = cy(MIR[m][1]), s = cell * 0.32, slash = orient[m] === "/";
            ctx.strokeStyle = m === sel ? "#b8a9e0" : "rgba(200,210,235,0.8)"; ctx.lineWidth = 3;
            ctx.beginPath();
            if (slash) { ctx.moveTo(mx - s, my + s); ctx.lineTo(mx + s, my - s); }
            else { ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s); }
            ctx.stroke();
          }
          // target mark (West, row 1)
          var tgt = target.split(":"), ty = +tgt[1];
          ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(ox, cy(ty), cell * 0.16, 0, Math.PI * 2); ctx.fill();
        },
        exit: function () {},
        // flip each mirror that differs from its solution orientation.
        solution: function () {
          var seq = [], s = sel, o = orient.slice();
          for (var i = 0; i < 4; i++) {
            while (s !== i) { seq.push("down"); s = (s + 1) % 4; }
            if (o[i] !== SOL[i]) { seq.push("enter"); o[i] = SOL[i]; }
          }
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
