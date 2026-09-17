/* roomhost.js — the BIG-SCREEN HOST for phone-controller party games.
 *
 * The counterpart to play.js (the phone). play.js renders whatever the host DECLARES and
 * sends intents back; this file is the host that declares, reads intents, owns the players
 * and the scoreboard, and runs a RoomGame (roomgames/registry.js) as a state machine. Same
 * split as every shell here: a DOM-free PURE CORE (createHost) the tests drive headless, plus
 * browser wiring that connects the relay, renders the stage on a canvas, and runs the loop.
 *
 * WIRE (controller/serve.py "PLAY RELAY"):
 *   GET  /play/sub?room=&role=host          -> SSE  {type:"join",player} | {type:"intent",player,id,value}
 *   POST /play/pub {room, player?, type:"declare", input, prompt}   -- player omitted = whole room
 *   GET  /play/stat?room=                    -> {phones, host}
 * A room exists only while this host's stream is open; phones /join it by its 4-char code.
 *
 * Dual export as root.RoomHost. The pure core has NO DOM/fetch — publish + now are injected.
 */
(function (root) {
  "use strict";

  // player identity without any typed text (the relay firewall forbids strings crossing the
  // wire, and the display firewall forbids prose about people) — a critter + colour, assigned
  // by join order, is the whole identity. Deterministic so the same seat always looks the same.
  var CRITTERS = [
    ["🦊", "Fox", "#f2994a"], ["🐸", "Frog", "#6fcf60"],
    ["🦉", "Owl", "#bb6bd9"], ["🐙", "Octo", "#eb5757"],
    ["🦁", "Lion", "#f2c94c"], ["🐧", "Penguin", "#56ccf2"],
    ["🦄", "Uni", "#ff8fd0"], ["🐢", "Turtle", "#27ae60"],
    ["🦎", "Gecko", "#a0e070"], ["🦈", "Shark", "#2f80ed"],
    ["🐝", "Bee", "#f6d247"], ["🦋", "Fly", "#9b51e0"],
    ["🐬", "Dolph", "#4fc3e8"], ["🦩", "Mingo", "#ff6f91"],
    ["🐺", "Wolf", "#9aa6c8"], ["🦥", "Sloth", "#c9a06a"]
  ];

  function createHost(opts) {
    opts = opts || {};
    var publish = opts.publish || function () {};
    var now = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
    var onChange = opts.onChange || function () {};

    var S = {
      players: [], byId: {},
      game: null, round: 0, phase: "lobby",
      g: {}, banner: "", phaseAt: now()
    };

    function assign(id) {
      var seq = S.players.length;
      var c = CRITTERS[seq % CRITTERS.length];
      var tier = Math.floor(seq / CRITTERS.length);
      return { id: id, seq: seq, emoji: c[0], name: c[1] + (tier ? String(tier + 1) : ""),
               color: c[2], score: 0, present: true };
    }

    var H = {
      now: now,
      get phase() { return S.phase; },
      get round() { return S.round; },
      get rounds() { return S.game ? (S.game.rounds || 1) : 0; },
      get game() { return S.game; },
      get g() { return S.g; },
      get banner() { return S.banner; },

      players: function () { return S.players.filter(function (p) { return p.present; }); },
      allPlayers: function () { return S.players.slice(); },
      player: function (id) { return S.byId[id] || null; },
      count: function () { return H.players().length; },
      leader: function () {
        return S.players.slice().sort(function (a, b) { return b.score - a.score; })[0] || null;
      },
      standings: function () {
        return S.players.slice().sort(function (a, b) { return b.score - a.score; });
      },

      say: function (line) { S.banner = line || ""; onChange(); },
      setPhase: function (name) { S.phase = name; S.phaseAt = now(); onChange(); },
      phaseAge: function () { return now() - (S.phaseAt || now()); },
      score: function (id, delta) { var p = S.byId[id]; if (p) p.score += delta; return p ? p.score : 0; },

      /* ── declaring controls to phones ─────────────────────────────────── */
      declare: function (playerId, input, prompt) {
        publish({ type: "declare", input: input || [], prompt: prompt || "" }, playerId || null);
      },
      declareAll: function (input, prompt) { H.declare(null, input, prompt); },
      wait: function (playerId, msg) {
        H.declare(playerId, [{ intent: "commit", id: "noop", label: "👀" }], msg || "watch the big screen");
      },
      declareEach: function (fn) {
        H.players().forEach(function (p) { var d = fn(p) || {}; H.declare(p.id, d.input || [], d.prompt || ""); });
      },

      /* ── events, routed into the current game ─────────────────────────── */
      join: function (id) {
        var p = S.byId[id];
        if (!p) { p = assign(id); S.players.push(p); S.byId[id] = p; }
        else p.present = true;
        if (S.game && S.game.onJoin) { try { S.game.onJoin(H, p); } catch (e) {} }
        onChange();
      },
      intent: function (id, cid, value) {
        if (cid === "exit" || cid === "noop") return;   // chrome, never a game action
        if (S.game && S.game.onIntent) { try { S.game.onIntent(H, id, cid, value); } catch (e) {} }
        onChange();
      },
      advance: function () {
        if (S.game && S.game.advance) { try { S.game.advance(H); } catch (e) {} onChange(); }
      },

      /* ── match lifecycle ──────────────────────────────────────────────── */
      startGame: function (def) {
        S.game = def; S.round = 1; S.g = {};
        S.players.forEach(function (p) { p.score = 0; });
        try { def.start(H); } catch (e) {}
        onChange();
      },
      nextRound: function () {
        if (!S.game) return;
        if (S.round >= (S.game.rounds || 1)) return H.finish();
        S.round += 1; S.g = {};
        try { S.game.start(H); } catch (e) {}
        onChange();
      },
      finish: function () { S.phase = "final"; S.phaseAt = now(); onChange(); },
      toLobby: function () {
        S.game = null; S.round = 0; S.phase = "lobby"; S.g = {}; S.banner = "";
        H.declareAll([], "");
        onChange();
      },

      _state: S
    };
    return H;
  }

  var RoomHost = { createHost: createHost, CRITTERS: CRITTERS };
  root.RoomHost = RoomHost;
  if (typeof module !== "undefined" && module.exports) module.exports = RoomHost;

  /* ══ browser wiring (node require never reaches here) ══════════════════════ */
  if (typeof window === "undefined" || typeof document === "undefined") return;

  /* shared draw helpers, exposed so game render() functions can compose a consistent look */
  var U = {
    ink: "#e7edfb", dim: "#94a0c2", line: "rgba(150,170,220,0.20)",
    bg0: "#0a0f20", bg1: "#04050b",
    teal: "#35d0c0", violet: "#8a6cff", gold: "#f2c94c", rose: "#ff6f91", green: "#43d17a",
    round: function (X, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      X.beginPath();
      X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r);
      X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath();
    },
    text: function (X, s, x, y, size, color, align, weight) {
      X.fillStyle = color || U.ink; X.textAlign = align || "center"; X.textBaseline = "middle";
      X.font = (weight || 600) + " " + size + "px 'Segoe UI',system-ui,sans-serif";
      X.fillText(s, x, y);
    },
    // ease helpers for juice
    clamp01: function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; },
    easeOut: function (t) { return 1 - Math.pow(1 - U.clamp01(t), 3); }
  };
  root.RoomUI = U;

  window.addEventListener("DOMContentLoaded", function () {
    var RoomGameReg = root.RoomGame;
    var canvas = document.getElementById("stage");
    var lobby = document.getElementById("lobby");
    if (!canvas || !lobby) return;
    var X = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2), W = 0, Hh = 0;

    // 4-char room code, no vowels/ambiguous chars so it can't spell anything or misread
    var ALPH = "BCDFGHJKLMNPQRSTVWXYZ23456789";
    function makeCode() { var s = ""; for (var i = 0; i < 4; i++) s += ALPH[(Math.random() * ALPH.length) | 0]; return s; }
    // ?room=CODE pins the code (a fixed venue room / a scriptable test); else a fresh random one
    var forced = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    var ROOM = forced.length === 4 ? forced : makeCode();

    var host = RoomHost.createHost({
      publish: function (msg, player) {
        var body = { room: ROOM, type: msg.type, input: msg.input, prompt: msg.prompt };
        if (player) body.player = player;
        fetch("/play/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(function () {});
      },
      onChange: syncLobby
    });
    root.__host = host;   // handy for a console / screenshot poke

    /* ── host SSE (reconnecting, same backoff shape as play.js) ───────────── */
    var es = null;
    function connect(delay) {
      try { if (es) es.close(); } catch (e) {}
      es = new EventSource("/play/sub?room=" + encodeURIComponent(ROOM) + "&role=host");
      es.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type === "join") host.join(m.player);
        else if (m.type === "intent") host.intent(m.player, m.id, m.value);
      };
      es.onopen = function () { delay = 1000; };
      es.onerror = function () { try { es.close(); } catch (e) {} setTimeout(function () { connect(Math.min((delay || 1000) * 2, 8000)); }, delay || 1000); };
    }
    connect(1000);

    /* ── lobby DOM (code, join URL, player chips, game picker) ────────────── */
    // The join URL must be one a PHONE can reach. This tab is usually opened on
    // 127.0.0.1, and printing that on the TV sends every guest to their own phone —
    // the whole lobby silently fails. Ask the controller which interface it is
    // actually reachable on and re-render once the answer lands.
    var joinHost = location.host;
    var joinURL = "http://" + joinHost + "/play.html?code=" + ROOM;
    if (/^(127\.|localhost|\[?::1)/.test(location.hostname)) {
      fetch("/lan").then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.ip || d.ip === "127.0.0.1") return;
        joinHost = d.ip + ":" + (d.port || location.port || 80);
        joinURL = "http://" + joinHost + "/play.html?code=" + ROOM;
        syncLobby();
      }).catch(function () {});
    }
    function syncLobby() {
      var inLobby = host.phase === "lobby";
      lobby.classList.toggle("hidden", !inLobby);
      canvas.classList.toggle("hidden", inLobby);
      if (!inLobby) { fit(); return; }   // canvas was display:none at first paint — size it now it's shown
      document.getElementById("code").textContent = ROOM.split("").join(" ");
      document.getElementById("join-url").textContent = joinURL.replace(/^https?:\/\//, "");
      var grid = document.getElementById("players");
      grid.innerHTML = "";
      host.players().forEach(function (p) {
        var d = document.createElement("div"); d.className = "pchip";
        d.style.borderColor = p.color;
        d.innerHTML = '<span class="pe">' + p.emoji + '</span><span class="pn" style="color:' + p.color + '">' + p.name + '</span>';
        grid.appendChild(d);
      });
      document.getElementById("pcount").textContent = host.count();
    }
    (function buildPicker() {
      var pick = document.getElementById("picker");
      (RoomGameReg ? RoomGameReg.all() : []).forEach(function (def, i) {
        var b = document.createElement("button");
        b.className = "gcard";
        b.innerHTML = '<span class="gk">' + (i + 1) + '</span><span class="gt">' + def.title +
                      '</span><span class="gb">' + def.blurb + '</span>';
        b.addEventListener("click", function () { if (host.count() >= 1) host.startGame(def); });
        pick.appendChild(b);
      });
    })();

    /* ── render loop ──────────────────────────────────────────────────────── */
    function fit() {
      var r = canvas.getBoundingClientRect(); W = r.width; Hh = r.height;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(Hh * DPR);
      X.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener("resize", fit); fit();

    var last = performance.now();
    function frame(t) {
      var dt = Math.min(50, t - last); last = t;
      if (host.phase !== "lobby") draw(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function draw(dt) {
      // ground
      var g = X.createRadialGradient(W / 2, Hh * 0.42, 0, W / 2, Hh * 0.42, Math.max(W, Hh) * 0.75);
      g.addColorStop(0, U.bg0); g.addColorStop(1, U.bg1);
      X.fillStyle = g; X.fillRect(0, 0, W, Hh);

      var header = 92, footer = 116, stage = { x: 40, y: header, w: W - 80, h: Hh - header - footer, cx: W / 2, cy: header + (Hh - header - footer) / 2 };

      // header: game title + round, and the MC banner
      var def = host.game;
      U.text(X, def ? def.title.toUpperCase() : "", 40, 40, 26, U.dim, "left", 700);
      if (host.phase !== "final" && host.rounds > 1)
        U.text(X, "ROUND " + host.round + " / " + host.rounds, W - 40, 40, 18, U.dim, "right", 600);
      if (host.banner) U.text(X, host.banner, W / 2, 66, 22, U.gold, "center", 600);

      if (host.phase === "final") drawFinal(stage);
      else if (def && def.render) { try { def.render(host, X, stage, dt); } catch (e) {} }

      // footer: player chips w/ scores + persistent join hint so people can still join
      drawPlayers(footer);
    }

    function drawPlayers(footerH) {
      var y = Hh - footerH, ps = host.players();
      X.fillStyle = "rgba(255,255,255,0.02)"; X.fillRect(0, y, W, footerH);
      X.strokeStyle = U.line; X.beginPath(); X.moveTo(0, y + 0.5); X.lineTo(W, y + 0.5); X.stroke();
      var n = Math.max(1, ps.length), cw = Math.min(150, (W - 260) / n), x0 = 30;
      ps.forEach(function (p, i) {
        var x = x0 + i * cw, cy = y + footerH / 2;
        U.text(X, p.emoji, x + cw / 2, cy - 16, 26, "#fff", "center");
        U.text(X, p.name, x + cw / 2, cy + 14, 14, p.color, "center", 600);
        U.text(X, String(p.score), x + cw / 2, cy + 34, 15, U.ink, "center", 700);
      });
      U.text(X, "join: " + joinURL.replace(/^https?:\/\//, "") + "   code " + ROOM,
             W - 30, y + footerH / 2, 15, U.dim, "right", 600);
    }

    function drawFinal(stage) {
      U.text(X, "🏆  FINAL", stage.cx, stage.y + 40, 40, U.gold, "center", 800);
      var st = host.standings().filter(function (p) { return true; });
      var y = stage.y + 110;
      st.forEach(function (p, i) {
        var rowW = Math.min(560, stage.w * 0.7), x = stage.cx - rowW / 2;
        var barMax = st[0].score || 1, w = rowW * U.clamp01(p.score / barMax);
        U.round(X, x, y, rowW, 40, 10); X.fillStyle = "rgba(255,255,255,0.05)"; X.fill();
        U.round(X, x, y, Math.max(40, w), 40, 10); X.fillStyle = p.color; X.globalAlpha = 0.8; X.fill(); X.globalAlpha = 1;
        U.text(X, (i + 1) + ".", x - 24, y + 20, 18, U.dim, "right", 700);
        U.text(X, p.emoji + " " + p.name, x + 14, y + 20, 18, "#06101c", "left", 700);
        U.text(X, String(p.score), x + rowW - 14, y + 20, 18, "#06101c", "right", 800);
        y += 52;
      });
      U.text(X, "press SPACE for a new game", stage.cx, Hh - 150, 16, U.dim, "center", 600);
    }

    /* ── host operator input: SPACE advances / restarts, digits pick, ESC = lobby ── */
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { host.toLobby(); return; }
      if (host.phase === "lobby") {
        var n = parseInt(e.key, 10);
        if (n >= 1 && RoomGameReg && RoomGameReg.all()[n - 1] && host.count() >= 1) host.startGame(RoomGameReg.all()[n - 1]);
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (host.phase === "final") host.toLobby();
        else host.advance();
      }
    });
    canvas.addEventListener("pointerdown", function () {
      if (host.phase === "final") host.toLobby(); else host.advance();
    });

    window.addEventListener("pagehide", function () { try { if (es) es.close(); } catch (e) {} });
    syncLobby();
  });
})(typeof window !== "undefined" ? window : globalThis);
