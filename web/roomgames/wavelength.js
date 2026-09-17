/* roomgames/wavelength.js — WAVELENGTH.
 *
 * Hidden information made into a game: one player (the Oracle) privately sees a target on a
 * spectrum and says ONE word aloud — the clue never crosses the wire (the relay forbids text,
 * and it shouldn't: a spoken clue in the room is the whole social act). Everyone else dials
 * where they think the target is. Score by closeness; the Oracle scores by how well the room
 * read them, so a good clue pays. The Oracle rotates each round.
 *
 * The target is sent to the Oracle's phone ONLY (per-player declare) — the big screen never
 * shows it until the reveal, because the screen is public. Phases: clue -> guess -> reveal.
 */
(function (root) {
  "use strict";
  var RoomGame = root.RoomGame || (typeof require !== "undefined" && require("./registry.js"));

  var SPECTRA = [
    ["CHAOS", "ORDER"], ["COLD", "HOT"], ["BORING", "EXCITING"], ["EVIL", "GOOD"],
    ["CHEAP", "LUXURY"], ["QUIET", "LOUD"], ["OLD-SCHOOL", "FUTURISTIC"], ["UNDERRATED", "OVERRATED"],
    ["WEIRD", "NORMAL"], ["USELESS", "ESSENTIAL"], ["GUILTY PLEASURE", "GENUINELY GOOD"], ["TEMPORARY", "FOREVER"]
  ];

  function degToPct(v) { var d = ((v % 360) + 360) % 360; return Math.max(0, Math.min(100, Math.round(d / 3.6))); }
  function guessers(H) { return H.players().filter(function (p) { return p.id !== H.g.oracle; }); }
  function nLocked(H) { return Object.keys(H.g.locked || {}).length; }

  function toClue(H) {
    var ps = H.players();
    H.g.oracle = ps.length ? ps[(H.round - 1) % ps.length].id : null;
    H.g.spectrum = SPECTRA[(Math.random() * SPECTRA.length) | 0];
    H.g.target = 8 + Math.floor(Math.random() * 85);   // 8..92, never a trivial extreme
    H.g.guess = {}; H.g.locked = {};
    H.setPhase("clue");
    var orc = H.player(H.g.oracle);
    H.say((orc ? orc.emoji + " " + orc.name : "the Oracle") + " sees the target — listen for their word");
    H.players().forEach(function (p) {
      if (p.id === H.g.oracle) {
        H.declare(p.id, [{ intent: "commit", id: "ready", label: "I GAVE MY CLUE →" }],
          "TARGET ▸ " + H.g.target + "%  (" + H.g.spectrum[0] + " ⟶ " + H.g.spectrum[1] + ") — say ONE word out loud");
      } else {
        H.wait(p.id, "👂 the Oracle is about to speak");
      }
    });
  }
  function toGuess(H) {
    H.setPhase("guess");
    H.say("dial where the clue lands — " + H.g.spectrum[0] + " ⟷ " + H.g.spectrum[1]);
    guessers(H).forEach(function (p) {
      if (H.g.guess[p.id] == null) H.g.guess[p.id] = 50;
      H.declare(p.id, [
        { intent: "angle", id: "guess", label: "GUESS", range: [0, 100] },
        { intent: "commit", id: "lock", label: "LOCK IT IN" }
      ], H.g.spectrum[0] + "  ⟵ dial ⟶  " + H.g.spectrum[1]);
    });
    if (H.g.oracle) H.wait(H.g.oracle, "you gave your word — watch them squirm");
  }
  function toReveal(H) {
    var t = H.g.target, gs = guessers(H), sum = 0, k = 0;
    H.g.pts = {};
    gs.forEach(function (p) {
      var gp = H.g.guess[p.id]; if (gp == null) return;
      var err = Math.abs(gp - t);
      var pts = err <= 5 ? 100 : err <= 12 ? 66 : err <= 20 ? 33 : 0;
      H.g.pts[p.id] = pts; H.score(p.id, pts); sum += pts; k++;
    });
    var orcPts = k ? Math.round(sum / k) : 0;
    if (H.g.oracle) { H.g.pts[H.g.oracle] = orcPts; H.score(H.g.oracle, orcPts); }
    H.g.oraclePts = orcPts;
    H.setPhase("reveal");
    H.say("target was " + t + "%  —  the room read the Oracle " + (orcPts >= 66 ? "loud and clear 🎯" : orcPts >= 33 ? "so-so" : "not at all 😬"));
    H.players().forEach(function (p) { H.wait(p.id, "look up 👆"); });
  }

  RoomGame.register({
    id: "wavelength",
    title: "Wavelength",
    blurb: "The Oracle says one word. Read them — dial the hidden target.",
    minPlayers: 2,
    rounds: 4,

    start: function (H) { toClue(H); },

    onIntent: function (H, pid, id, value) {
      if (H.phase === "clue") {
        if (id === "ready" && pid === H.g.oracle) toGuess(H);
      } else if (H.phase === "guess") {
        if (pid === H.g.oracle) return;
        if (id === "guess") H.g.guess[pid] = degToPct(value);
        else if (id === "lock") {
          H.g.locked[pid] = true;
          H.wait(pid, "locked at " + (H.g.guess[pid] || 0) + "%");
          if (nLocked(H) >= guessers(H).length && guessers(H).length > 0) toReveal(H);
        }
      }
    },

    advance: function (H) {
      if (H.phase === "clue") toGuess(H);
      else if (H.phase === "guess") toReveal(H);
      else if (H.phase === "reveal") H.nextRound();
    },

    render: function (H, X, S) {
      var U = root.RoomUI, g = H.g;
      var y = S.cy + 40, x0 = S.cx - 440, x1 = S.cx + 440, w = x1 - x0;
      function px(pct) { return x0 + w * (pct / 100); }
      // the spectrum bar
      var grad = X.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, U.violet); grad.addColorStop(0.5, U.teal); grad.addColorStop(1, U.gold);
      X.strokeStyle = grad; X.lineWidth = 10; X.lineCap = "round";
      X.beginPath(); X.moveTo(x0, y); X.lineTo(x1, y); X.stroke();
      if (g.spectrum) {
        U.text(X, g.spectrum[0], x0, y + 34, 20, U.violet, "left", 700);
        U.text(X, g.spectrum[1], x1, y + 34, 20, U.gold, "right", 700);
      }

      var orc = H.player(g.oracle);
      if (H.phase === "clue") {
        U.text(X, "🔮", S.cx, S.y + 40, 44, U.ink);
        U.text(X, (orc ? orc.emoji + " " + orc.name : "the Oracle") + " is choosing a word…", S.cx, S.y + 100, 26, U.teal, "center", 700);
        U.text(X, "everyone else: listen, then you'll dial", S.cx, S.y + 140, 16, U.dim);
      } else if (H.phase === "guess") {
        drawPins(X, U, H, px, y, false);
        U.text(X, nLocked(H) + " / " + guessers(H).length + " locked", S.cx, S.y + 40, 24, U.gold, "center", 700);
        if (orc) U.text(X, "🔮 " + orc.name + " gave the clue — now read them", S.cx, S.y + 76, 16, U.dim);
      } else if (H.phase === "reveal") {
        drawPins(X, U, H, px, y, true);
        // target zone (bullseye bands), animated in
        var a = U.easeOut(H.phaseAge() / 900), tx = px(g.target);
        [[20, 0.10, U.dim], [12, 0.16, U.teal], [5, 0.30, U.gold]].forEach(function (b) {
          var bw = w * (b[0] / 100) * a;
          X.fillStyle = b[2]; X.globalAlpha = b[1];
          X.fillRect(tx - bw, y - 60, bw * 2, 120); X.globalAlpha = 1;
        });
        X.strokeStyle = U.gold; X.lineWidth = 3;
        X.beginPath(); X.moveTo(tx, y - 70); X.lineTo(tx, y + 70); X.stroke();
        U.text(X, "🎯 " + g.target + "%", tx, y - 86, 22, U.gold, "center", 800);
        U.text(X, "SPACE for next round →", S.cx, S.y + S.h - 16, 15, U.dim);
      }
    }
  });

  function drawPins(X, U, H, px, y, reveal) {
    var g = H.g;
    H.players().forEach(function (p, i) {
      if (p.id === g.oracle) return;
      var gp = g.guess ? g.guess[p.id] : null; if (gp == null) return;
      var x = px(gp), locked = g.locked && g.locked[p.id], yy = y - 40 - (i % 3) * 26;
      X.strokeStyle = p.color; X.globalAlpha = (locked || reveal) ? 1 : 0.45; X.lineWidth = 2;
      X.beginPath(); X.moveTo(x, y); X.lineTo(x, yy + 8); X.stroke();
      U.text(X, p.emoji, x, yy, 22, "#fff", "center");
      if (reveal && g.pts) U.text(X, "+" + (g.pts[p.id] || 0), x, yy - 20, 14, U.green, "center", 700);
      X.globalAlpha = 1;
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
