/* menu.js — the Deep House game menu shell (framework baseline).
 *
 * A category-organised "rooms + hub" menu over the SAME 4-button controller as the
 * arcade (game.js). Each room shows a FILLING SPIRAL + a % number — the reward read
 * K. asked for (the glow alone was too subtle; the spiral winding up is the payout).
 * DATA-DRIVEN: rooms come from MenuData (menu-data.js). This shell hard-codes no room.
 *
 * SCOPE — smallest extensible skeleton, grown over time:
 *   · the HUB lists the rooms; each row is that room's filling spiral + name + %.
 *   · entering a ROOM shows its big filling spiral + % (its pointed-at exhibit faint
 *     behind), and a "template room" note — the 5 shipped games are NOT wired in yet.
 *   · the MASTER hub spiral (one spiral summing every room) is DEFERRED — a later
 *     yes/no, not built here.
 *
 * Input matches the arcade exactly: up|down|enter|back + a shell-only EXIT (keyboard
 * Escape / remote long-press 'tap'). TIME is shell-owned (host clock advanced from RAF
 * in the browser, driven deterministically by a headless smoke). The core below is
 * DOM-free so node can require it; browser wiring is guarded at the end.
 * Dual export as root.MenuShell.
 */
(function (root) {
  "use strict";

  /* ── input normalization (same vocabulary as game.js) ──────────────────────── */
  var KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", Enter: "enter", Space: "enter",
    Backspace: "back", Escape: "exit",
    Digit1: "up", Digit2: "down", Digit3: "enter", Digit4: "back",
    Numpad1: "up", Numpad2: "down", Numpad3: "enter", Numpad4: "back"
  };
  // THIS SURFACE'S MAPPING of the wire vocabulary. The vocabulary is documented in
  // exactly ONE place — controller/serve.py, above publish_input() — and is a superset:
  // `hue` rides the wire and this shell has no use for it. Same reading as the arcade,
  // on purpose (game.test.js and menu.test.js assert the two maps stay identical).
  //   up→up  down→down  select→enter  back→back  tap→exit  (hue: ignored)
  var NAV_MAP = { up: "up", down: "down", select: "enter", back: "back", tap: "exit" };

  // Who this page is to the server-side nav arbiter. See serve.py for the focus rules.
  var NAV_OWNER = "menu";
  var FOCUS_HEARTBEAT_MS = 10000;   // refresh well inside serve.py's 30s TTL
  var FOCUS_IDLE_MS = 25000;        // hand the remote back after this long untouched
  var ACTIONS = ["up", "down", "enter", "back"];
  function isAction(a) { return ACTIONS.indexOf(a) !== -1; }
  function normalizeKey(code) { return KEYMAP.hasOwnProperty(code) ? KEYMAP[code] : null; }
  function normalizeNav(a) { return NAV_MAP.hasOwnProperty(a) ? NAV_MAP[a] : null; }

  var BG = "#04050a";
  var FALLBACK_PAL = ["8E7CC3", "4A8B8C", "C77DBB", "F2C94C", "5B6CE8"];

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  // atlas palette colours (hex, no '#') for a category — mirrors game.js paletteFor.
  function paletteFor(cat) {
    try {
      if (root.PALETTES && root.PALETTES.all) {
        var all = root.PALETTES.all();
        var i = (cat && cat.palette | 0) || 0;
        var s = all[((i % all.length) + all.length) % all.length];
        if (s && s.colors && s.colors.length >= 2) return s.colors.slice(0, 5);
      }
    } catch (e) {}
    return FALLBACK_PAL;
  }
  // a single meter colour for progress p, drifting toward "order" as the room fills.
  function meterColor(p, pal) {
    try { if (root.SYM && root.SYM.orderColor) return root.SYM.orderColor(clamp(p, 0, 1), pal); } catch (e) {}
    return "#" + pal[Math.min(pal.length - 1, Math.round(clamp(p, 0, 1) * (pal.length - 1)))];
  }

  /* ── the shell ─────────────────────────────────────────────────────────────── */
  function createMenu(opts) {
    opts = opts || {};
    var data = opts.data || root.MenuData;
    var registry = opts.registry || root.Game || null;   // game defs, for display names
    // The nav-focus transport, injected so the shell stays DOM-free and the claim /
    // release behaviour is testable headless. {claim(owner), release(owner)}; absent →
    // focus is never claimed and the party keeps the remote, the safe way to fail.
    var focus = opts.focus || null;
    var focusHeld = false, focusBeat = 0, lastInput = 0;
    // the solved-store the menu READS (the arcade writes it). Injectable for headless tests.
    var store = opts.store || (root.MenuProgress && root.MenuProgress.createStore(opts)) || null;

    // derived completion — never a stored field. 0 when the progress module/store is absent.
    function prog(cat) { return (root.MenuProgress && store) ? root.MenuProgress.roomProgress(cat, store) : 0; }
    function gprog() { return (root.MenuProgress && store) ? root.MenuProgress.globalProgress(roster(), store) : 0; }
    function solvedIn(cat) {
      return (root.MenuProgress && store) ? root.MenuProgress.countSolvedIn(cat.games || [], store) : 0;
    }

    var S = {
      state: "hub",      // "hub" | "room"
      clock: 0,          // ms, shell-owned
      cursor: 0,         // hub selection index into the roster
      openId: null,      // id of the open room (state === "room")
      roomCursor: 0,     // selection index into the open room's games list
      launch: null,      // { gameId } once 'enter' selects a game — browser wiring reads + clears
      views: {},         // exhibit title → SpiralView (keeps the faint backdrop animating)
      w: 0, h: 0, ctx: null
    };

    function roster() { return data ? data.all() : []; }
    function openCat() { return S.openId && data ? data.get(S.openId) : null; }
    function viewFor(title) {
      if (!S.views[title] && root.SpiralView) S.views[title] = root.SpiralView.create(title);
      return S.views[title] || null;
    }
    // a game's display name — the registry (K.-authored titles), falling back to its id
    // when the registry isn't loaded (e.g. a headless test that never required it).
    function gameName(id) {
      try {
        if (registry && registry.get) { var def = registry.get(id); if (def && def.title) return def.title; }
      } catch (e) {}
      return id;
    }

    /* ── nav focus ───────────────────────────────────────────────────────────
     * The menu has no ATTRACT state to hang this off, so it claims the remote on the
     * first recognised press and hands it back after FOCUS_IDLE_MS untouched. The
     * kiosk leaves this page open all evening; claiming on load would mean the party
     * never gets the remote back at all. Releasing on idle is the same promise the
     * arcade makes with its walk-off, expressed in the state this shell actually has. */
    function claimFocus() {
      if (!focus || typeof focus.claim !== "function") return;
      focusHeld = true; focusBeat = S.clock;
      focus.claim(NAV_OWNER);
    }
    function releaseFocus() {
      if (!focusHeld) return;
      focusHeld = false; focusBeat = 0;
      if (focus && typeof focus.release === "function") focus.release(NAV_OWNER);
    }

    /* ── input routing ── */
    function dispatch(action) {
      var known = action === "exit" || isAction(action);
      if (!known) return;                       // closed vocabulary — stray gestures inert
      lastInput = S.clock;
      if (!focusHeld) claimFocus();
      if (action === "exit") { if (S.state === "room") { S.state = "hub"; S.openId = null; S.roomCursor = 0; } return; }

      if (S.state === "hub") {
        var list = roster(), n = list.length;
        if (action === "up") S.cursor = n ? (S.cursor - 1 + n) % n : 0;
        else if (action === "down") S.cursor = n ? (S.cursor + 1) % n : 0;
        else if (action === "enter") {
          if (list[S.cursor]) { S.openId = list[S.cursor].id; S.state = "room"; S.roomCursor = 0; }
        }
        // 'back' at the hub is inert — the hub is the top of the menu.
      } else if (S.state === "room") {
        if (action === "back") { S.state = "hub"; S.openId = null; S.roomCursor = 0; return; }
        var c = openCat(), glist = (c && c.games) || [], gn = glist.length;
        if (action === "up") S.roomCursor = gn ? (S.roomCursor - 1 + gn) % gn : 0;
        else if (action === "down") S.roomCursor = gn ? (S.roomCursor + 1) % gn : 0;
        else if (action === "enter") { if (glist[S.roomCursor]) S.launch = { gameId: glist[S.roomCursor] }; }
      }
    }

    /* ── time (drives the backdrop spiral animation only) ── */
    function tick(dt) {
      S.clock += dt * 1000;
      // heartbeat, then the walk-off: an unrefreshed claim expires server-side, which
      // is what recovers the room from a page that dies without releasing.
      if (!focusHeld) return;
      if ((S.clock - lastInput) >= FOCUS_IDLE_MS) return releaseFocus();
      if ((S.clock - focusBeat) >= FOCUS_HEARTBEAT_MS) claimFocus();
    }

    /* ── the filling spiral meter — the reward read ──────────────────────────────
     * An Archimedean spiral wound from the centre out; the first `progress` fraction
     * is drawn bright (the fill), the rest a faint track. Self-contained (ctx only). */
    function drawFillSpiral(ctx, cx, cy, radius, progress, color, lineWidth) {
      var TURNS = 3.5, TMAX = TURNS * Math.PI * 2, STEPS = 240;
      progress = clamp(progress, 0, 1);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // faint full track
      ctx.strokeStyle = "rgba(120,130,165,0.22)"; ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (var i = 0; i <= STEPS; i++) {
        var th = (i / STEPS) * TMAX, r = radius * (i / STEPS);
        var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
        ctx[i ? "lineTo" : "moveTo"](x, y);
      }
      ctx.stroke();
      // bright fill up to progress, with a soft glow
      var fillSteps = Math.round(STEPS * progress);
      if (fillSteps > 0) {
        ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
        ctx.shadowColor = color; ctx.shadowBlur = lineWidth * 2.2;
        ctx.beginPath();
        for (var j = 0; j <= fillSteps; j++) {
          var t2 = (j / STEPS) * TMAX, r2 = radius * (j / STEPS);
          var x2 = cx + r2 * Math.cos(t2), y2 = cy + r2 * Math.sin(t2);
          ctx[j ? "lineTo" : "moveTo"](x2, y2);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function pctLabel(ctx, cx, topY, progress, size) {
      ctx.globalCompositeOperation = "source-over";
      ctx.textAlign = "center"; ctx.fillStyle = "#e8ecf7";
      ctx.font = "700 " + Math.round(size) + "px 'Cascadia Code', ui-monospace, monospace";
      ctx.fillText(Math.round(clamp(progress, 0, 1) * 100) + "%", cx, topY);
    }

    /* ── render (browser + headless smoke; a mock ctx is fine) ── */
    function render(ctx, w, h, dt) {
      S.ctx = ctx; S.w = w; S.h = h;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
      var min = Math.min(w, h);

      if (S.state === "hub") {
        var list = roster();
        ctx.globalCompositeOperation = "source-over";
        ctx.textAlign = "center"; ctx.fillStyle = "#b8a9e0";
        ctx.font = "600 " + Math.round(min * 0.045) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText("DEEP HOUSE", w / 2, Math.round(h * 0.12));
        // global completion — the whole-menu fill, count-weighted over every game.
        ctx.fillStyle = "rgba(184,169,224,0.75)";
        ctx.font = "500 " + Math.round(min * 0.026) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText(Math.round(gprog() * 100) + "% complete", w / 2, Math.round(h * 0.165));

        if (!list.length) {
          ctx.fillStyle = "#8a93b4"; ctx.font = Math.round(min * 0.03) + "px 'Cascadia Code', ui-monospace, monospace";
          ctx.fillText("no rooms yet", w / 2, h / 2);
        } else {
          // one row per room: filling spiral + name + %. The selected row is brighter.
          var n = list.length;
          var top = h * 0.24, rowH = Math.min(h * 0.5, (h * 0.62) / Math.max(1, n));
          var icon = Math.min(rowH * 0.36, min * 0.09);
          for (var k = 0; k < n; k++) {
            var cat = list[k], sel = (k === S.cursor);
            var ry = top + rowH * (k + 0.5);
            var ix = w * 0.30;
            var pal = paletteFor(cat);
            var p = prog(cat);
            drawFillSpiral(ctx, ix, ry, icon, p, meterColor(p, pal), Math.max(2, icon * 0.10));
            ctx.textAlign = "left";
            ctx.fillStyle = sel ? "#f2c94c" : "#c8d2eb";
            ctx.font = (sel ? "700 " : "500 ") + Math.round(min * 0.034) + "px 'Cascadia Code', ui-monospace, monospace";
            ctx.fillText((sel ? "› " : "  ") + cat.name, w * 0.42, ry + min * 0.012);
            ctx.textAlign = "right"; ctx.fillStyle = sel ? "#e8ecf7" : "#8a93b4";
            ctx.fillText(Math.round(p * 100) + "%", w * 0.92, ry + min * 0.012);
          }
        }
        // nav hint
        ctx.globalCompositeOperation = "source-over";
        ctx.textAlign = "center"; ctx.fillStyle = "rgba(138,147,180,0.7)";
        ctx.font = Math.round(min * 0.024) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText("‹▲▼› choose room    ‹enter› open", w / 2, Math.round(h * 0.94));

      } else if (S.state === "room") {
        var c = openCat();
        if (!c) { S.state = "hub"; S.openId = null; return render(ctx, w, h, dt); }
        var p = prog(c), palC = paletteFor(c);
        // the room's pointed-at spiral, faint behind the meter — σ wound by the room's own fill.
        var v = viewFor(c.exhibit);
        if (v && v.ok && v.ok()) v.atSigma(ctx, w, h, dt, palC, 0.16, p);
        // the big filling spiral + % above it — lifted into the upper third so the
        // name/solved-count/game-list stack below it stays on-screen and the whole
        // composition balances around the vertical centre (was h*0.52 + rad*0.26:
        // bottom-heavy, the list ran off the foot of a landscape screen).
        var cx = w / 2, cy = h * 0.34, rad = min * 0.18;
        pctLabel(ctx, cx, cy - rad - min * 0.045, p, min * 0.07);
        drawFillSpiral(ctx, cx, cy, rad, p, meterColor(p, palC), Math.max(3, min * 0.012));
        // name + solved-count (or template note if a room has no games) + how to leave
        ctx.globalCompositeOperation = "source-over";
        ctx.textAlign = "center"; ctx.fillStyle = "#c8d2eb";
        ctx.font = "600 " + Math.round(min * 0.04) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText(c.name, cx, cy + rad + min * 0.07);
        ctx.fillStyle = "rgba(138,147,180,0.75)"; ctx.font = Math.round(min * 0.024) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText(c.games.length ? (solvedIn(c) + " / " + c.games.length + " solved") : "template room — games plug in here", cx, cy + rad + min * 0.11);

        // the room's game list — each game's display name + a ✓ if the store says solved.
        // the selected row (S.roomCursor) is brighter, same convention as the hub rows.
        if (c.games.length) {
          var glY = cy + rad + min * 0.18, glRowH = Math.max(min * 0.048, h * 0.052);
          for (var gi = 0; gi < c.games.length; gi++) {
            var gid = c.games[gi], gsel = (gi === S.roomCursor), gsolved = !!(store && store.solved(gid));
            var gy = glY + glRowH * gi;
            ctx.textAlign = "center";
            ctx.fillStyle = gsel ? "#f2c94c" : "#c8d2eb";
            ctx.font = (gsel ? "700 " : "500 ") + Math.round(min * 0.03) + "px 'Cascadia Code', ui-monospace, monospace";
            var label = (gsel ? "› " : "  ") + gameName(gid) + (gsolved ? " ✓" : "");
            ctx.fillText(label, cx, gy);
          }
        }

        ctx.textAlign = "right"; ctx.fillStyle = "rgba(106,114,144,0.55)";
        ctx.font = Math.round(min * 0.022) + "px 'Cascadia Code', ui-monospace, monospace";
        ctx.fillText("‹back› or ‹esc› to the hub", Math.round(w * 0.97), Math.round(h * 0.06));
      }
    }

    return {
      dispatch: dispatch, tick: tick, render: render,
      holdsFocus: function () { return focusHeld; },
      releaseFocus: releaseFocus,          // page unload calls this
      state: function () { return S.state; },
      cursor: function () { return S.cursor; },
      openId: function () { return S.openId; },
      roomCursor: function () { return S.roomCursor; },
      // the launch intent: { gameId } once 'enter' selects a game inside a room, else null.
      // the DOM-free core never navigates itself — browser wiring reads this and clears it.
      launch: function () { return S.launch; },
      clearLaunch: function () { S.launch = null; },
      now: function () { return S.clock; },
      _S: S
    };
  }

  var MenuShell = {
    createMenu: createMenu,
    KEYMAP: KEYMAP, NAV_MAP: NAV_MAP, ACTIONS: ACTIONS,
    normalizeKey: normalizeKey, normalizeNav: normalizeNav
  };
  root.MenuShell = MenuShell;
  if (typeof module !== "undefined" && module.exports) module.exports = MenuShell;

  /* ── browser wiring (guarded: node require never reaches this) ─────────────── */
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      var canvas = document.getElementById("stage");
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      var DPR = Math.min(2, window.devicePixelRatio || 1);
      function fit() {
        var w = Math.max(2, (canvas.clientWidth * DPR) | 0), h = Math.max(2, (canvas.clientHeight * DPR) | 0);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      }
      window.addEventListener("resize", fit); fit();

      // the real focus transport: one POST per claim/release, fire-and-forget. A failed
      // claim must never block the menu — it just means the party keeps the remote.
      function postFocus(body) {
        try {
          fetch("/nav/focus", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), keepalive: true   // survives the unload
          }).catch(function () {});
        } catch (e) {}
      }
      var menu = createMenu({ focus: {
        claim: function (owner) { postFocus({ owner: owner }); },
        release: function (owner) { postFocus({ owner: owner, release: true }); }
      } });
      window.MENU = menu;

      window.addEventListener("keydown", function (e) {
        if (e.repeat && (e.code === "Enter" || e.code === "Escape" || e.code === "Space")) return;
        var a = normalizeKey(e.code);
        if (a) { e.preventDefault(); menu.dispatch(a); }
      });

      // physical remote: listen.py → POST /input → serve.py stamps focus → SSE /nav/stream.
      // One filter line: an event addressed to another surface is not ours to act on.
      (function connectNav() {
        if (!("EventSource" in window)) return;
        try {
          var es = new EventSource("/nav/stream?owner=" + NAV_OWNER);
          es.onmessage = function (ev) {
            try {
              var m = JSON.parse(ev.data);
              if (m.focus && m.focus !== NAV_OWNER) return;   // not addressed to us
              var a = normalizeNav(m.action);
              if (a) menu.dispatch(a);
            } catch (e) {}
          };
          es.onerror = function () { /* keyboard still works */ };
        } catch (e) {}
      })();

      window.addEventListener("pagehide", function () { menu.releaseFocus(); });

      var last = 0;
      function loop(nowMs) {
        var dt = Math.min(0.05, (nowMs - last) / 1000 || 0.016); last = nowMs;
        fit();
        menu.tick(dt);
        // a game was selected in a room — the shell only recorded the intent; navigate here.
        var launch = menu.launch();
        if (launch && launch.gameId) {
          menu.clearLaunch();
          window.location.href = "/game.html?game=" + encodeURIComponent(launch.gameId);
          return;   // navigating away — no more frames needed
        }
        menu.render(ctx, canvas.width, canvas.height, dt);
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
