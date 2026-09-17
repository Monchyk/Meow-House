/* roomgames/guesspionage.js — PREDICT THE ROOM.
 *
 * Guesspionage's DNA, aimed at your own crowd instead of a survey: everyone secretly answers
 * a yes/no, then everyone guesses what % of THE ROOM said yes. You score by reading people,
 * not by being objectively right — the truth IS the room's own hidden answers. Phone controls
 * are only what the relay offers (commit buttons + one angle dial), and no free text crosses.
 *
 * Phases: answer -> predict -> reveal.  Logic hooks are pure (mutate H.g, call H.declare/score);
 * render is browser-only. Registered on load into RoomGame.
 */
(function (root) {
  "use strict";
  var RoomGame = root.RoomGame || (typeof require !== "undefined" && require("./registry.js"));

  var PROMPTS = [
    "Have you ever ghosted someone?",
    "Would you survive a week with no phone?",
    "Do you sing in the shower?",
    "Have you cried at an animated film?",
    "Is a hotdog a sandwich?",
    "Have you re-read a text to check it wasn't weird?",
    "Do you talk to pets like they understand?",
    "Would you eat a bug for €100?",
    "Have you faked being busy to avoid someone?",
    "Do you dance when nobody's watching?",
    "Have you fallen asleep in a cinema?",
    "Is cereal a soup?",
    "Have you googled yourself?",
    "Would you read your partner's texts if you could?"
  ];

  function pickPrompt(H) {
    var used = H.g.__used || (H.g.__used = []);
    // deterministic-ish: rotate by round, skip repeats within a match
    var idx = ((H.round - 1) * 5 + 3) % PROMPTS.length;
    for (var k = 0; k < PROMPTS.length && used.indexOf(idx) !== -1; k++) idx = (idx + 1) % PROMPTS.length;
    used.push(idx);
    return PROMPTS[idx];
  }

  function total(H) { return H.count(); }
  function nAnswered(H) { return Object.keys(H.g.ans || {}).length; }
  function nLocked(H) { return Object.keys(H.g.locked || {}).length; }
  function truthPct(H) {
    var ans = H.g.ans || {}, ids = Object.keys(ans), yes = 0;
    ids.forEach(function (id) { if (ans[id]) yes++; });
    return ids.length ? Math.round(yes / ids.length * 100) : 0;
  }
  function degToPct(v) { var d = ((v % 360) + 360) % 360; return Math.max(0, Math.min(100, Math.round(d / 3.6))); }

  function toAnswer(H) {
    H.g.ans = {}; H.g.guess = {}; H.g.locked = {};
    H.g.prompt = pickPrompt(H);
    H.setPhase("answer");
    H.say("secretly… " + (Math.random() < 0.5 ? "no lying." : "be honest."));
    H.declareAll([
      { intent: "commit", id: "yes", label: "YES" },
      { intent: "commit", id: "no", label: "NO" }
    ], H.g.prompt);
  }
  function toPredict(H) {
    H.setPhase("predict");
    H.say("now — how did the ROOM answer?");
    H.players().forEach(function (p) { if (H.g.guess[p.id] == null) H.g.guess[p.id] = 50; });
    H.declareAll([
      { intent: "angle", id: "guess", label: "% YES", range: [0, 100] },
      { intent: "commit", id: "lock", label: "LOCK IT IN" }
    ], "dial your guess, then lock");
  }
  function toReveal(H) {
    var t = truthPct(H); H.g.truth = t;
    var best = null;
    H.players().forEach(function (p) {
      var gpct = H.g.guess[p.id]; if (gpct == null) return;
      var err = Math.abs(gpct - t);
      var pts = err <= 3 ? 100 : err <= 7 ? 70 : err <= 12 ? 45 : err <= 20 ? 25 : err <= 30 ? 10 : 0;
      H.g.pts = H.g.pts || {}; H.g.pts[p.id] = pts;
      H.score(p.id, pts);
      if (!best || err < best.err) best = { id: p.id, err: err, name: p.name };
    });
    H.g.best = best;
    H.setPhase("reveal");
    H.say("the room said " + t + "% YES" + (best ? " — " + best.name + " nailed it" : ""));
    H.players().forEach(function (p) { H.wait(p.id, "look up 👆"); });
  }

  RoomGame.register({
    id: "guesspionage",
    title: "Predict the Room",
    blurb: "Answer secretly, then guess how the whole room answered.",
    minPlayers: 1,
    rounds: 5,

    start: function (H) { toAnswer(H); },

    onIntent: function (H, pid, id, value) {
      if (H.phase === "answer") {
        if (id === "yes" || id === "no") {
          H.g.ans[pid] = (id === "yes");
          H.wait(pid, "locked in — hold tight");
          if (nAnswered(H) >= total(H) && total(H) > 0) toPredict(H);
        }
      } else if (H.phase === "predict") {
        if (id === "guess") H.g.guess[pid] = degToPct(value);
        else if (id === "lock") {
          H.g.locked[pid] = true;
          H.wait(pid, "locked at " + (H.g.guess[pid] || 0) + "%");
          if (nLocked(H) >= total(H) && total(H) > 0) toReveal(H);
        }
      }
    },

    advance: function (H) {
      if (H.phase === "answer") toPredict(H);
      else if (H.phase === "predict") toReveal(H);
      else if (H.phase === "reveal") H.nextRound();
    },

    render: function (H, X, S) {
      var U = root.RoomUI, g = H.g;
      if (H.phase === "answer") {
        U.text(X, "❝", S.cx, S.y + 30, 40, U.dim);
        wrapText(X, U, g.prompt || "", S.cx, S.cy - 30, Math.min(900, S.w), 38, U.ink);
        U.text(X, nAnswered(H) + " / " + total(H) + " answered", S.cx, S.cy + 90, 26, U.teal, "center", 700);
        // little filling dots for suspense
        var dots = total(H), a = nAnswered(H);
        for (var i = 0; i < dots; i++) {
          var x = S.cx - (dots - 1) * 16 + i * 32;
          X.beginPath(); X.arc(x, S.cy + 140, 8, 0, 6.283);
          X.fillStyle = i < a ? U.green : "rgba(255,255,255,0.12)"; X.fill();
        }
        U.text(X, "on your phone: YES or NO", S.cx, S.y + S.h - 20, 16, U.dim);
      } else if (H.phase === "predict") {
        wrapText(X, U, g.prompt || "", S.cx, S.y + 40, Math.min(820, S.w), 24, U.dim);
        drawScale(X, U, S, null, H, false);
        U.text(X, nLocked(H) + " / " + total(H) + " locked", S.cx, S.y + S.h - 20, 22, U.gold, "center", 700);
      } else if (H.phase === "reveal") {
        var shown = U.easeOut(H.phaseAge() / 1100) * (g.truth || 0);
        drawScale(X, U, S, shown, H, true);
        U.text(X, Math.round(shown) + "%", S.cx, S.cy - 6, 72, U.gold, "center", 800);
        U.text(X, "said YES", S.cx, S.cy + 50, 22, U.dim, "center", 600);
        U.text(X, "SPACE for next round", S.cx, S.y + S.h - 16, 15, U.dim);
      }
    }
  });

  // a horizontal 0..100 scale with each player's guess as a coloured pin, and (on reveal) the truth line
  function drawScale(X, U, S, truth, H, reveal) {
    var g = H.g, y = S.cy + 120, x0 = S.cx - 420, x1 = S.cx + 420, w = x1 - x0;
    function px(pct) { return x0 + w * (pct / 100); }
    // track
    var grad = X.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, U.violet); grad.addColorStop(1, U.gold);
    X.strokeStyle = grad; X.lineWidth = 6; X.lineCap = "round";
    X.beginPath(); X.moveTo(x0, y); X.lineTo(x1, y); X.stroke();
    U.text(X, "0%", x0, y + 28, 14, U.dim); U.text(X, "100%", x1, y + 28, 14, U.dim);
    // guess pins
    H.players().forEach(function (p, i) {
      var gp = g.guess ? g.guess[p.id] : null; if (gp == null) return;
      var x = px(gp), locked = g.locked && g.locked[p.id];
      var yy = y - 26 - (i % 3) * 22;
      X.strokeStyle = p.color; X.globalAlpha = locked || reveal ? 1 : 0.5; X.lineWidth = 2;
      X.beginPath(); X.moveTo(x, y); X.lineTo(x, yy + 8); X.stroke();
      U.text(X, p.emoji, x, yy, 20, "#fff", "center"); X.globalAlpha = 1;
    });
    // truth line
    if (reveal && truth != null) {
      var tx = px(truth);
      X.strokeStyle = U.green; X.lineWidth = 3; X.setLineDash([6, 5]);
      X.beginPath(); X.moveTo(tx, y - 120); X.lineTo(tx, y + 16); X.stroke(); X.setLineDash([]);
    }
  }

  function wrapText(X, U, s, cx, y, maxw, size, color) {
    X.font = "700 " + size + "px 'Segoe UI',system-ui,sans-serif";
    var words = String(s).split(" "), line = "", lines = [];
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (X.measureText(test).width > maxw && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    lines.forEach(function (ln, i) { U.text(X, ln, cx, y + i * (size + 8), size, color || U.ink, "center", 700); });
    return lines.length;
  }
})(typeof window !== "undefined" ? window : globalThis);
