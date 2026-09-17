/* roomgames/theminds.js — THE MIND → BLOOM.
 *
 * Cooperative silent synchronisation (The Mind), paid off in the house's own SEED language.
 * Each phone holds ONE secret number (sent to that phone only — the per-player lane). With NO
 * talking, everyone must PLANT in ascending order. Plant when you believe your number is the
 * lowest still unplanted and a flower blooms; plant too early and every lower number burns and
 * the garden loses a life. Clear them all and the whole thing blooms. One round per… round.
 */
(function (root) {
  "use strict";
  var RoomGame = root.RoomGame || (typeof require !== "undefined" && require("./registry.js"));

  function deal(H) {
    var ps = H.players(), used = {}, nums = {};
    ps.forEach(function (p) {
      var n; do { n = 1 + Math.floor(Math.random() * 99); } while (used[n]); used[n] = 1; nums[p.id] = n;
    });
    return nums;
  }

  function startRound(H) {
    H.g.num = deal(H);
    H.g.played = [];      // [{id,num,ok}] in the order planted
    H.g.burned = [];      // numbers lost to an early plant
    H.g.lives = H.g.lives != null ? H.g.lives : 2;
    H.g.flash = 0;        // wilt flash timer (ms), driven by phaseAge on last event
    H.g.lastAt = H.now();
    H.setPhase("plant");
    H.say("no talking. plant low → high. trust the room.");
    H.players().forEach(function (p) {
      H.declare(p.id, [{ intent: "commit", id: "plant", label: "PLANT 🌱" }],
        "your seed:  " + H.g.num[p.id] + "   ·   (1 low … 99 high)");
    });
  }

  function unplanted(H) {
    var played = {}; H.g.played.forEach(function (x) { played[x.id] = 1; });
    var burned = {}; H.g.burned.forEach(function (n) { burned[n] = 1; });
    return H.players().filter(function (p) { return !played[p.id] && !burned[H.g.num[p.id]]; });
  }

  function finishRound(H, cleared) {
    H.g.cleared = cleared;
    H.setPhase("result");
    H.say(cleared ? "🌻 the whole garden bloomed — as one" : "🥀 it wilted. lower seeds burned.");
    H.players().forEach(function (p) { H.wait(p.id, cleared ? "you did it 🌻" : "watch the screen"); });
  }

  RoomGame.register({
    id: "themind",
    title: "The Mind → Bloom",
    blurb: "Secret numbers, no talking. Plant low→high. Together, or not at all.",
    minPlayers: 1,
    rounds: 4,

    start: function (H) { startRound(H); },

    onIntent: function (H, pid, id) {
      if (H.phase !== "plant" || id !== "plant") return;
      var g = H.g, mine = g.num[pid];
      if (g.played.some(function (x) { return x.id === pid; })) return;   // already planted

      // the lowest number still in play across all UNplanted players
      var rest = unplanted(H).map(function (p) { return g.num[p.id]; });
      var lowest = Math.min.apply(null, rest.concat([mine]));
      var ok = (mine === lowest);
      g.played.push({ id: pid, num: mine, ok: ok });
      g.lastAt = H.now();

      if (ok) {
        H.score(pid, 25);
        H.wait(pid, "planted 🌱 — nice");
      } else {
        // every unplanted number lower than mine is lost; a life goes
        unplanted(H).forEach(function (p) { if (g.num[p.id] < mine) g.burned.push(g.num[p.id]); });
        g.lives -= 1; g.flashAt = H.now();
        H.wait(pid, "too soon 😬 lower seeds burned");
      }

      if (g.lives <= 0) return finishRound(H, false);
      if (unplanted(H).length === 0) {
        var allOk = g.played.every(function (x) { return x.ok; }) && g.burned.length === 0;
        H.players().forEach(function (p) { H.score(p.id, allOk ? 30 : 8); });   // clear bonus
        return finishRound(H, allOk);
      }
    },

    advance: function (H) {
      if (H.phase === "plant") finishRound(H, false);   // host force-ends a stalled round
      else if (H.phase === "result") { H.g.lives = 2; H.nextRound(); }
    },

    render: function (H, X, S) {
      var U = root.RoomUI, g = H.g;
      // lives as hearts, top-right of stage
      var lives = g.lives == null ? 2 : g.lives;
      var hearts = ""; for (var i = 0; i < 2; i++) hearts += i < lives ? "💚" : "🖤";
      U.text(X, hearts, S.x + S.w - 20, S.y + 20, 26, U.ink, "right");

      // soil line
      var soilY = S.y + S.h - 70;
      X.strokeStyle = U.line; X.lineWidth = 2; X.beginPath(); X.moveTo(S.x, soilY); X.lineTo(S.x + S.w, soilY); X.stroke();

      // planted flowers along the soil, in order
      var played = g.played || [], total = H.count();
      var span = Math.min(S.w - 120, Math.max(total, 1) * 130), x0 = S.cx - span / 2;
      played.forEach(function (rec, i) {
        var x = x0 + (i + 0.5) * (span / Math.max(total, 1));
        drawBloom(X, U, x, soilY, rec, H.player(rec.id));
      });

      // wilt flash
      if (g.flashAt && (H.now() - g.flashAt) < 500) {
        X.fillStyle = "rgba(255,80,110," + (0.35 * (1 - (H.now() - g.flashAt) / 500)) + ")";
        X.fillRect(0, 0, S.x * 2 + S.w, S.y * 2 + S.h);
      }

      if (H.phase === "plant") {
        U.text(X, "🌱  " + played.length + " / " + total + " planted", S.cx, S.y + 34, 30, U.teal, "center", 800);
        U.text(X, "everyone holds one number — no talking — plant low to high", S.cx, S.y + 74, 16, U.dim);
      } else if (H.phase === "result") {
        if (g.cleared) {
          U.text(X, "🌻 IN SYNC", S.cx, S.y + 40, 44, U.gold, "center", 800);
          U.text(X, "the whole room bloomed as one", S.cx, S.y + 92, 20, U.dim);
        } else {
          U.text(X, "🥀 OUT OF SYNC", S.cx, S.y + 40, 40, U.rose, "center", 800);
          U.text(X, "seeds burned: " + (g.burned || []).join("  "), S.cx, S.y + 92, 18, U.dim);
        }
        U.text(X, "SPACE for the next round →", S.cx, S.y + S.h - 16, 15, U.dim);
      }
    }
  });

  function drawBloom(X, U, x, soilY, rec, p) {
    var col = p ? p.color : U.teal, ok = rec.ok;
    // stem
    X.strokeStyle = ok ? U.green : "#7a5a5a"; X.lineWidth = 3;
    X.beginPath(); X.moveTo(x, soilY); X.lineTo(x, soilY - 60); X.stroke();
    // bloom (a tiny phyllotaxis nod for the correct ones, a droop for the wrong)
    var cy = soilY - 66;
    if (ok) {
      for (var k = 0; k < 8; k++) {
        var a = k * 2.399963;
        X.beginPath();
        X.fillStyle = col;
        X.arc(x + Math.cos(a) * 9, cy + Math.sin(a) * 9, 5, 0, 6.283); X.fill();
      }
      X.beginPath(); X.fillStyle = U.gold; X.arc(x, cy, 6, 0, 6.283); X.fill();
    } else {
      X.beginPath(); X.fillStyle = "#8a6b6b"; X.arc(x, cy + 6, 7, 0, 6.283); X.fill();
    }
    U.text(X, rec.num, x, soilY - 96, 16, ok ? U.ink : U.dim, "center", 700);
    U.text(X, p ? p.emoji : "", x, soilY + 18, 18, "#fff", "center");
  }
})(typeof window !== "undefined" ? window : globalThis);
