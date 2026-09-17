/* game.js — the Part Game shell.
 *
 * A standalone 4-button arcade over Deep-House's spiral engine: preview → solve → deploy.
 * The installation (party.js) is untouched; this is a separate, reversible surface.
 *
 *   ATTRACT ─enter→ BROWSE ─enter→ PLAY ─solve→ DEPLOY ─exit→ BROWSE
 *                     ▲  └─exit→ ATTRACT  └─2 fails (machine-wide)→ COOLDOWN ─any→ BROWSE
 *   · idle ~25s → ATTRACT (kiosk walk-off); DEPLOY gets a longer 60s leash so an admiring
 *     visitor isn't yanked out of the bloom mid-bask (reviewer's call)
 *   · a universal EXIT gesture (keyboard Escape / remote long-press 'tap') leaves PLAY/DEPLOY
 *     from anywhere, which frees single BACK to be a pure per-game action (undo, rotate−1, …).
 *
 * Two responsibilities live here:
 *   1. INPUT — normalize keyboard + the /nav remote into one vocabulary (up|down|enter|back)
 *      plus the shell-level EXIT, and funnel both into dispatch(). (Precedent: brain.js:432-465.)
 *   2. SHELL — the state machine, a GLOBAL in-memory cooldown, the idle reset, the deploy
 *      animation, and the host API handed to every game.
 *
 * TIME is shell-controlled. A game reads the clock ONLY through host.now() (ms) or the `dt`
 * passed to update/input/draw (seconds). No file reads the wall clock directly — production
 * advances the clock from RAF, the headless suite drives it deterministically. (Determinism is
 * a house law: no bare Math.random either; games seed through host.rng(host.seed).)
 *
 * The core below is DOM-free so node can require it; the browser wiring is guarded at the end.
 * Dual export as `root.GameShell`.
 */
(function (root) {
  "use strict";

  /* ── input normalization ─────────────────────────────────────────────────── */

  // keyboard code → action. Arrows + Enter/Space + Backspace are the four game buttons;
  // Escape is the shell EXIT (not 'back'). Digit/Numpad 1-4 mirror the four (as brain.js does).
  var KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", Enter: "enter", Space: "enter",
    Backspace: "back", Escape: "exit",
    Digit1: "up", Digit2: "down", Digit3: "enter", Digit4: "back",
    Numpad1: "up", Numpad2: "down", Numpad3: "enter", Numpad4: "back"
  };
  // /nav SSE action → our vocabulary. The remote speaks up|down|select|back|tap; select IS
  // enter, and 'tap' (its Enter/Select LONG-press, already whitelisted in listen.py) is the
  // universal EXIT — so no controller change is needed for a walk-up "how do I leave?".
  // THIS SURFACE'S MAPPING of the wire vocabulary. The vocabulary itself is documented
  // in exactly ONE place — controller/serve.py, above publish_input() — and it is a
  // superset: `hue` exists on the wire and this shell simply has no use for it. Each
  // surface names its own reading here; divergence is fine, UNDISCOVERABLE divergence
  // is what cost a session to a wrong root-cause trace.
  //   up→up  down→down  select→enter  back→back  tap→exit  (hue: ignored)
  var NAV_MAP = { up: "up", down: "down", select: "enter", back: "back", tap: "exit" };

  // Who this page is, to the server-side nav arbiter. One owner holds the remote at a
  // time; events stamped for anyone else are dropped. See serve.py for the focus rules.
  var NAV_OWNER = "arcade";

  var ACTIONS = ["up", "down", "enter", "back"];   // the game vocabulary; 'exit' is shell-only
  function isAction(a) { return ACTIONS.indexOf(a) !== -1; }
  function normalizeKey(code) { return KEYMAP.hasOwnProperty(code) ? KEYMAP[code] : null; }
  function normalizeNav(a) { return NAV_MAP.hasOwnProperty(a) ? NAV_MAP[a] : null; }

  /* ── tunables ────────────────────────────────────────────────────────────── */
  var DEPLOY_MS = 7000;                 // spiral resolve/bloom duration
  var SUCK_MS = 3000;                   // the puzzle is drawn into the spiral over this long.
  // SUCK_MS runs inside DEPLOY's first ~40%, so while the puzzle collapses the spiral is
  // still at low σ (deployProgress ≈ 0→0.40) and the superfluid bloom (gated σ>0.4) has not
  // fired yet — the bloom then resolves OUT of the implosion instead of competing with it.
  // The suck/deploy ratio (~0.4) is the invariant; scale both together to keep the bloom
  // landing as the implosion completes. (K. live-tune: 1100/3000 → 2000/5000, dissolve was
  // too fast to see → 3000/7000, still too fast + too small.)

  // ease-in-out applied to the VISUAL deploy value only. deployProgress() stays exactly
  // linear — the markSolved gate and the idle leash read raw time, and game.test.js pins it.
  function easeInOut(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }
  var COOLDOWN_MS = 90000;              // GLOBAL "temporary equilibrium" — 90s, machine-wide
  var MAX_ATTEMPTS = 2;                 // failed tries (anywhere) before the machine cools down
  var IDLE_MS = 25000;                  // no input this long → ATTRACT (walk-off)
  var DEPLOY_IDLE_MS = 60000;           // DEPLOY's longer leash — don't yank an admirer mid-bask

  var FALLBACK_PAL = ["8E7CC3", "4A8B8C", "C77DBB", "F2C94C", "5B6CE8"];
  var BG = "#04050a";

  // THE backdrop alpha for PLAY. One number, owned by the shell, drawn ONCE per frame.
  // It used to be drawn twice — here and again inside every engine's own
  // host.spiralPreview() call — which is why the puzzle sat on a backdrop twice as bright
  // as anyone intended. Lowering this is now a one-line taste dial. DEPLOY does not use it:
  // its 0.3→1.0 bloom is the reward moment and is deliberately left alone.
  var BACKDROP_ALPHA = 0.22;

  // seeded PRNG (mulberry32) — the only randomness a game gets, so every puzzle replays.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function paletteFor(def) {
    try {
      if (root.PALETTES && root.PALETTES.all) {
        var all = root.PALETTES.all();
        var i = (def && def.deploy && def.deploy.palette | 0) || 0;
        var s = all[((i % all.length) + all.length) % all.length];
        if (s && s.colors && s.colors.length >= 2) return s.colors.slice(0, 5);
      }
    } catch (e) {}
    return FALLBACK_PAL;
  }

  /* ── the shell ───────────────────────────────────────────────────────────── */

  // createShell(opts) — opts.registry (defaults to root.Game), opts.getSize()→{w,h}.
  // No DOM is touched here; render(ctx,...) is the only thing that needs a canvas.
  function createShell(opts) {
    opts = opts || {};
    var registry = opts.registry || root.Game;
    // the solved-store: the arcade's DEPLOY is the ONLY write site for menu completion %.
    // Injectable (headless tests pass a MemStore); absent module → null → the mark is a no-op.
    var store = opts.store || (root.MenuProgress && root.MenuProgress.createStore(opts)) || null;
    // SINGLE-GAME mode (arrived via menu.html → game.html?game=<id>): opts.onExit, if given,
    // is called by the universal EXIT gesture instead of the normal PLAY/DEPLOY→BROWSE fold —
    // the DOM-free core never navigates itself; browser wiring supplies the callback.
    var onExit = typeof opts.onExit === "function" ? opts.onExit : null;
    // The nav-focus transport, injected so the state machine stays DOM-free and the
    // claim/release behaviour is testable headless. {claim(owner), release(owner)};
    // absent (a test that does not care, or file://) → focus is simply never claimed
    // and the party keeps the remote, which is the safe direction to fail.
    var focus = opts.focus || null;
    // The phone-controller transport, injected like focus so the core stays DOM-free and
    // testable. { declare(decl) } — the shell announces the controls a phone should render
    // on every state change; absent → no phones, and the arcade behaves exactly as before.
    var play = opts.play || null;

    var S = {
      state: "attract",
      clock: 0,             // ms, shell-owned; advanced by tick()
      lastInput: 0,         // ms of the last recognized input (idle-reset clock)
      cursor: 0,            // browse selection index into the roster
      def: null,            // active game definition
      game: null,           // active game instance
      playCount: 0,         // per-play seed source (deterministic, varies per play)
      deployStart: 0,       // ms when DEPLOY began
      dissolve: null,       // point cloud of the solved puzzle, sucked into the spiral (browser only)
      deployMarked: false,  // guard: markSolved fires once per DEPLOY, when the bloom lands
      globalAtt: 0,         // failed attempts since the last win / cooldown (machine-wide)
      cdUntil: 0,           // ms the global cooldown runs until
      text: [],             // instruction/status lines from the active game
      backdropFrame: -1,    // which frame the PLAY backdrop was drawn on (idempotency guard)
      frame: 0,             // render frame counter; only the backdrop guard reads it
      ink: null,            // host.ink for the active game (rebuilt when the def changes)
      inkFor: null,         // which def id S.ink was built for
      focusHeld: false,     // does this page currently hold the remote?
      focusBeat: 0,         // ms of the last claim/heartbeat sent
      views: {},            // exhibit title → SpiralView cache (keeps animation state)
      w: 0, h: 0, ctx: null
    };

    function roster() { return registry ? registry.all() : []; }

    function inCooldown() { return S.cdUntil > S.clock; }
    function cooldownRemaining() { return Math.max(0, S.cdUntil - S.clock); }

    function viewFor(title) {
      if (!S.views[title] && root.SpiralView) S.views[title] = root.SpiralView.create(title);
      return S.views[title] || null;
    }

    // host.ink, cached per game definition — the floor maths is a binary search per colour
    // and the palette cannot change mid-play, so building it once per game is right.
    function inkFor(def) {
      if (!root.GameInk) return null;
      var id = def ? def.id : null;
      if (S.ink && S.inkFor === id) return S.ink;
      var pal = paletteFor(def);
      S.ink = root.GameInk.makeInk(pal, root.GameInk.backdropRef(BG, pal, BACKDROP_ALPHA));
      S.inkFor = id;
      return S.ink;
    }

    /* ── the host API handed to each game ── */
    var host = {
      get ctx() { return S.ctx; },
      get w() { return S.w; },
      get h() { return S.h; },
      get palette() { return paletteFor(S.def); },
      get seed() { return S.playCount; },            // per-play seed → host.rng(host.seed)
      now: function () { return S.clock; },          // ms, the ONLY clock a game may read
      rng: function (seed) { return mulberry32((seed || 0) >>> 0); },
      // Draw the deploy-target spiral behind the puzzle — "what you're unlocking".
      //
      // IDEMPOTENT: a no-op after the first call in a frame. The shell now draws the
      // backdrop itself before every game's draw(), so this is already spent by the time
      // an engine calls it. That is the load-bearing half of the fix: deleting the ten
      // calls only cleans today's roster, and the Phase 1.5 reskins are written by copying
      // an existing engine — so a copied call must be HARMLESS, not merely absent.
      spiralPreview: function (ctx, alpha, sigma, dt) {
        if (!S.def || S.backdropFrame === S.frame) return;
        S.backdropFrame = S.frame;
        var v = viewFor(S.def.deploy.exhibit);
        if (v) v.atSigma(ctx, S.w, S.h, dt == null ? 0.016 : dt, paletteFor(S.def),
                         alpha == null ? BACKDROP_ALPHA : alpha, sigma == null ? 0.2 : sigma);
      },
      // The LEGIBLE derivative of host.palette, for marks a visitor has to read. Floored
      // against the composited backdrop this shell owns, not against bare #04050a — no
      // puzzle mark is ever drawn on bare background. See web/game-ink.js for the floors
      // and why dimming is a role here rather than a globalAlpha multiply.
      get ink() { return inkFor(S.def); },
      solve: function () { shellSolve(); },
      // contribute(): the ONE crossing from a game into the living room. A won game hands the
      // party visual (a SEPARATE page, party.html) a spiral to keep — the "becomes real" moment.
      // Rides the existing /party/pub relay; from:"arcade" bypasses the remote-focus filter.
      // Guarded for node (game.test.js constructs this host headless, where fetch is absent).
      contribute: function (payload) {
        try {
          if (typeof fetch !== "function") return;
          fetch("/party/pub", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "arcade", type: "cmd", cmd: "contribute",
              spiral: payload.spiral, params: payload.params || {},
              palette: payload.palette | 0, t: S.clock
            })
          });
        } catch (e) {}
      },
      attemptFailed: function () { shellFail(); },
      text: function (lines) { S.text = Array.isArray(lines) ? lines.slice() : [String(lines)]; }
    };

    /* ── transitions ── */
    /* ── nav focus: claim while playing, hand it back when idle ──────────────
     * The rule is "focus follows shell state", and the shell already owns that state:
     * ATTRACT means nobody is here, so the party gets the remote back. Everything else
     * means a visitor is at the machine. Nobody has to remember to hand it over — the
     * 25s idle walk-off does it, and the server's TTL does it again if this page dies
     * without ever releasing. Both directions matter: a crashed arcade tab holding the
     * room's remote hostage is a worse failure than the one this arbitration fixes. */
    var FOCUS_HEARTBEAT_MS = 10000;      // refresh well inside serve.py's 30s TTL

    function claimFocus() {
      if (!focus || typeof focus.claim !== "function") return;
      S.focusHeld = true; S.focusBeat = S.clock;
      focus.claim(NAV_OWNER);
    }
    function releaseFocus() {
      if (!S.focusHeld) return;
      S.focusHeld = false; S.focusBeat = 0;
      if (focus && typeof focus.release === "function") focus.release(NAV_OWNER);
    }

    // What a phone should render RIGHT NOW: a playing game's declared controls, else the
    // default d-pad (an empty list — the phone falls back to up/down/enter/back). Announced
    // on every transition (via the injected play seam) so the phone always mirrors the
    // screen; a late joiner is caught up by re-announcing on its join event (browser side).
    function declarationFor() {
      return (S.state === "play" && S.def && S.def.input) ? S.def.input : [];
    }
    function announce() {
      if (play && typeof play.declare === "function") play.declare(declarationFor());
    }

    function go(state) {
      S.state = state;
      if (state === "attract") releaseFocus();
      else if (!S.focusHeld) claimFocus();
      announce();
    }

    function startPlay(def) {
      S.def = def;
      S.text = [];
      S.playCount++;
      S.game = def.create(host);
      if (S.game && S.game.enter) S.game.enter();
      go("play");
    }
    function leavePlay() {
      if (S.game && S.game.exit) S.game.exit();
      S.game = null; S.def = null; S.text = []; S.dissolve = null;
    }
    function shellSolve() {
      S.globalAtt = 0;                 // a win clears the machine's failure count
      // Snapshot the solved puzzle ONCE, here — the getImageData is a few ms and must never
      // happen per frame. Returns null under node (no document) and on any canvas failure,
      // in which case DEPLOY simply has no puzzle layer; nothing below depends on it.
      S.dissolve = null;
      if (root.GameDissolve && S.game && S.game.draw) {
        S.dissolve = root.GameDissolve.snapshot(function (bx, bw, bh, bdt) {
          S.game.draw(bx, bw, bh, bdt);
        }, S.w, S.h);
      }
      S.deployStart = S.clock;
      S.deployMarked = false;          // arm the single markSolved for this deploy
      go("deploy");
    }
    function shellFail() {
      // failures are counted MACHINE-WIDE now: two anywhere cool the whole thing down.
      S.globalAtt++;
      if (S.globalAtt >= MAX_ATTEMPTS) {
        S.cdUntil = S.clock + COOLDOWN_MS;
        S.globalAtt = 0;
        leavePlay();
        go("cooldown");
      }
    }
    function universalExit() {
      // the walk-up "leave" gesture — out of PLAY/DEPLOY/COOLDOWN, back to BROWSE from anywhere.
      // in single-game mode (opts.onExit given) EXIT leaves the arcade entirely, from any state —
      // there's no BROWSE worth returning to when the roster is one game deep.
      if (onExit) { leavePlay(); onExit(); return; }
      if (S.state !== "attract") { leavePlay(); go("browse"); }
    }

    /* ── input routing ── */
    function dispatch(action) {
      var known = action === "exit" || isAction(action);
      if (!known) return;               // closed vocabulary — a stray gesture is inert
      S.lastInput = S.clock;            // any recognized input resets the idle clock
      if (action === "exit") { universalExit(); return; }

      switch (S.state) {
        case "attract":
          if (action === "enter") { S.cursor = 0; go("browse"); }
          break;
        case "browse": {
          var list = roster(), n = list.length;
          if (action === "up") S.cursor = n ? (S.cursor - 1 + n) % n : 0;
          else if (action === "down") S.cursor = n ? (S.cursor + 1) % n : 0;
          else if (action === "back") go("attract");
          else if (action === "enter") {
            // during the global cooldown, previews stay explorable but nothing can be played.
            if (!inCooldown() && list[S.cursor]) startPlay(list[S.cursor]);
          }
          break;
        }
        case "play":
          // up/down/enter are pure game input. 'back' is offered to the game FIRST: truthy =
          // consumed (undo / rotate−1 / …); falsy = shell default (exit PLAY → BROWSE), which
          // keeps a no-undo game like press3 leaving on Back. The universal EXIT gesture is the
          // other way out and works even when a game consumes every Back.
          if (action === "back") {
            var handled = (S.game && S.game.input) ? S.game.input("back") : false;
            if (!handled) { leavePlay(); go("browse"); }
          } else if (S.game && S.game.input) {
            S.game.input(action);
          }
          break;
        case "deploy":
          // hold the resolved loop; leaving is the EXIT gesture (or Back, treated as exit here)
          if (action === "back") { leavePlay(); go("browse"); }
          break;
        case "cooldown":
          // the notice is dismissable by anything → BROWSE, where the lock + countdown shows.
          go("browse");
          break;
      }
    }

    // A rich controller (a phone) delivering input — the sibling of dispatch(). It keeps
    // the idle clock alive like any press (R1: a player who only DIALS is never walked off
    // to ATTRACT mid-game), then routes: in PLAY a game that declares intents handles its
    // own; everything else (the d-pad default, or navigating outside PLAY) carries a nav
    // action as its id and goes through dispatch(). Browser wiring calls THIS, never S.game.
    function shellIntent(id, value, player) {
      S.lastInput = S.clock;
      // NAV and EXIT always go through the shell, even for a game that declares its own
      // intents — otherwise a player on a phone can never back out of or leave a declared
      // game (its intent() handler would swallow 'back'/'exit'). A declared intent (theta,
      // plant, …) is never one of the four nav actions, so the split is unambiguous.
      if (id === "exit" || isAction(id)) { dispatch(id); return; }
      if (S.state === "play" && S.game && S.game.intent) S.game.intent(id, value, player);
    }

    /* ── time ── */
    // advance the shell clock by dt seconds, run the idle reset, then step the live game.
    function tick(dt) {
      S.clock += dt * 1000;
      // Heartbeat, and it does double duty. A claim that is not refreshed expires
      // server-side, which is what recovers the room from a crashed tab. But this also
      // RE-ASSERTS the claim on every beat while the shell is on screen and out of
      // ATTRACT — so a claim lost to a race (another surface claimed after us, our POST
      // was dropped, the page loaded while someone else was mid-claim) self-heals within
      // one heartbeat instead of persisting until somebody notices the buttons are dead.
      // Together with the idle reset below, the escape hatch stops depending on the
      // arbiter being right and starts depending on this clock, which the shell owns.
      if (S.state !== "attract" && (S.clock - S.focusBeat) >= FOCUS_HEARTBEAT_MS) claimFocus();
      if (S.state !== "attract") {
        // DEPLOY gets a longer leash so an admiring visitor isn't yanked out of the bloom;
        // every other state resets at IDLE_MS. Both still recover the kiosk for the next visitor.
        var idle = S.state === "deploy" ? DEPLOY_IDLE_MS : IDLE_MS;
        // THE FLOOR under the whole arbitration. An arcade receiving no input reaches
        // ATTRACT and releases focus, with nobody pressing anything — so even a shell
        // that has frozen out of its own state machine hands the remote back within
        // IDLE_MS. Worst case is bounded at 25s and clears itself.
        if ((S.clock - S.lastInput) >= idle) { leavePlay(); go("attract"); S.lastInput = S.clock; }
      }
      // single write site: once the deploy bloom has fully landed, record the solve.
      if (S.state === "deploy" && !S.deployMarked && deployProgress() >= 1) {
        S.deployMarked = true;
        if (store && S.def) store.markSolved(S.def.id);
      }
      if (S.state === "play" && S.game && S.game.update) S.game.update(dt);
    }

    function deployProgress() {
      if (S.state !== "deploy") return 0;
      var p = (S.clock - S.deployStart) / DEPLOY_MS;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /* ── render (browser only; tests never call this) ── */
    function render(ctx, w, h, dt) {
      S.ctx = ctx; S.w = w; S.h = h; S.frame++;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);   // shell owns the clear (see game-spiral.js)

      var list = roster();
      if (S.state === "attract") {
        if (list.length) {
          var idx = Math.floor(S.clock / 4000) % list.length;
          var v = viewFor(list[idx].deploy.exhibit);
          if (v) v.preview(ctx, w, h, dt, paletteFor(list[idx]), 0.28);
        }
        centerText(ctx, w, h, ["DEEP HOUSE", "press ‹enter› to begin"]);
      } else if (S.state === "browse") {
        var def = list[S.cursor];
        if (def) {
          var vb = viewFor(def.deploy.exhibit);
          if (vb) vb.preview(ctx, w, h, dt, paletteFor(def), 0.35);
          var lines = [def.title];
          if (inCooldown()) lines.push("temporary equilibrium · " + Math.ceil(cooldownRemaining() / 1000) + "s");
          else lines.push("‹enter› to play   ‹▲▼› to browse");
          cornerText(ctx, w, h, lines, S.cursor + 1, list.length);
        } else {
          centerText(ctx, w, h, ["no spirals loaded"]);
        }
      } else if (S.state === "play") {
        // ONE backdrop, drawn here, before the puzzle. Claiming the frame at the same time
        // makes any host.spiralPreview() call inside the game a no-op — including one
        // copied into a future reskin, which is the point of the guard.
        if (S.def) {
          S.backdropFrame = S.frame;
          var vp = viewFor(S.def.deploy.exhibit);
          if (vp) vp.preview(ctx, w, h, dt, paletteFor(S.def), BACKDROP_ALPHA);
        }
        if (S.game && S.game.draw) S.game.draw(ctx, w, h, dt);
        if (S.text.length) cornerText(ctx, w, h, S.text, null, null);
        exitHint(ctx, w, h);
      } else if (S.state === "deploy") {
        // The puzzle doesn't cut out — it gets DRAWN IN. The cloud snapshotted at solve
        // spirals toward the centre, zooms out, and breaks apart as it nears the spiral.
        // Its own clock (SUCK_MS off deployStart) — deployProgress() stays raw linear for
        // the markSolved gate and the idle leash.
        var suck = (S.clock - S.deployStart) / SUCK_MS;
        suck = suck < 0 ? 0 : suck > 1 ? 1 : suck;
        if (S.def) {
          var vd = viewFor(S.def.deploy.exhibit);
          if (vd) vd.deploy(ctx, w, h, dt, paletteFor(S.def), easeInOut(deployProgress()));
        }
        // The cloud draws ON TOP of the forming spiral, not under it. Under is invisible on
        // any exhibit that paints the whole frame — Kaleidoscope (lockpick's reward) redraws
        // a full mirror grid every pass, and ~10 exhibits are opaque:true and hard-clear —
        // so the spiral simply painted over the points. Over is also the truer read: during
        // the suck window deployProgress is still low, so the points spiral in across a faint,
        // forming spiral and have broken up by the time the bloom takes the frame.
        if (S.dissolve && suck < 1 && root.GameDissolve) {
          root.GameDissolve.draw(ctx, w, h, S.dissolve, suck);
        }
        exitHint(ctx, w, h);
      } else if (S.state === "cooldown") {
        centerText(ctx, w, h, ["the system has reached", "a temporary equilibrium",
          Math.ceil(cooldownRemaining() / 1000) + "s"]);
      }
    }

    // minimal text zones — feeling-words / math / the Guide ONLY (display firewall).
    function centerText(ctx, w, h, lines) {
      ctx.globalCompositeOperation = "source-over";
      ctx.textAlign = "center"; ctx.fillStyle = "#c8d2eb";
      ctx.font = "600 " + Math.round(Math.min(w, h) * 0.045) + "px 'Cascadia Code', ui-monospace, monospace";
      var y = h / 2 - (lines.length - 1) * 0.5 * Math.min(w, h) * 0.07;
      for (var i = 0; i < lines.length; i++) {
        ctx.fillStyle = i === 0 ? "#b8a9e0" : "#8a93b4";
        ctx.fillText(lines[i], w / 2, y + i * Math.min(w, h) * 0.07);
      }
    }
    function cornerText(ctx, w, h, lines, pos, total) {
      ctx.globalCompositeOperation = "source-over";
      ctx.textAlign = "left"; ctx.font = Math.round(Math.min(w, h) * 0.03) + "px 'Cascadia Code', ui-monospace, monospace";
      var x = Math.round(w * 0.04), y = Math.round(h * 0.9);
      for (var i = 0; i < lines.length; i++) {
        ctx.fillStyle = i === 0 ? "#f2c94c" : "#8a93b4";
        ctx.fillText(lines[i], x, y + i * Math.min(w, h) * 0.04);
      }
      if (pos != null) { ctx.fillStyle = "#6a7290"; ctx.textAlign = "right"; ctx.fillText(pos + " / " + total, w * 0.96, y); }
    }
    // An always-present "how to leave", so a visitor is never trapped in a puzzle.
    // It used to render at ~2.4:1 — the EXIT signage has been on screen all along, below
    // the legibility floor, which is indistinguishable from absent. Now drawn at the mark
    // floor, at FULL alpha: the alpha multiply was most of what buried it. This is a
    // control affordance, not narration, so there is no firewall question here.
    function exitHint(ctx, w, h) {
      ctx.globalCompositeOperation = "source-over";
      var ink = inkFor(S.def);
      ctx.textAlign = "right";
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink ? ink.mark(1) : "#c8d2eb";
      ctx.font = Math.round(Math.min(w, h) * 0.022) + "px 'Cascadia Code', ui-monospace, monospace";
      ctx.fillText("hold ‹enter› or ‹esc› to exit", Math.round(w * 0.97), Math.round(h * 0.06));
    }

    // public surface — tests reach in through state()/dispatch()/tick(); browser adds render().
    return {
      dispatch: dispatch,
      intent: shellIntent,
      tick: tick,
      render: render,
      host: host,
      // introspection for the harness + the render loop
      state: function () { return S.state; },
      cursor: function () { return S.cursor; },
      activeId: function () { return S.def ? S.def.id : null; },
      activeGame: function () { return S.game; },     // the live instance (for test solution())
      attempts: function () { return S.globalAtt; },
      holdsFocus: function () { return S.focusHeld; },
      releaseFocus: releaseFocus,          // page unload calls this

      inCooldown: inCooldown,
      cooldownRemaining: cooldownRemaining,
      deployProgress: deployProgress,
      now: function () { return S.clock; },
      _S: S                                           // escape hatch for tests/debug
    };
  }

  var GameShell = {
    createShell: createShell,
    KEYMAP: KEYMAP, NAV_MAP: NAV_MAP, ACTIONS: ACTIONS,
    normalizeKey: normalizeKey, normalizeNav: normalizeNav,
    mulberry32: mulberry32,
    DEPLOY_MS: DEPLOY_MS, COOLDOWN_MS: COOLDOWN_MS, MAX_ATTEMPTS: MAX_ATTEMPTS,
    IDLE_MS: IDLE_MS, DEPLOY_IDLE_MS: DEPLOY_IDLE_MS, NAV_OWNER: NAV_OWNER,
    BACKDROP_ALPHA: BACKDROP_ALPHA, BG: BG
  };
  root.GameShell = GameShell;
  if (typeof module !== "undefined" && module.exports) module.exports = GameShell;

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

      // ?game=<id> — arrived from the menu's room list. Single-game mode: the roster is
      // filtered to just that one def, and EXIT leaves the arcade back to the menu instead
      // of folding to BROWSE (there's no browsing worth doing over a roster of one).
      // a read-only registry view over a fixed subset of defs — the shape createShell wants.
      function subRegistry(defs) {
        return { all: function () { return defs.slice(); },
                 get: function (id) { return defs.filter(function (d) { return d.id === id; })[0] || null; } };
      }

      var shellOpts = {};
      try {
        var qs = new URLSearchParams(window.location.search);
        var gameId = qs.get("game");
        if (gameId && root.Game && root.Game.get(gameId)) {
          var only = root.Game.get(gameId);
          shellOpts.registry = subRegistry([only]);
          shellOpts.onExit = function () { window.location.href = "/menu.html"; };
        } else {
          // ?room=<id> — arrived from a menu room. ROOM mode: BROWSE still browses, but only
          // over that room's games (menu-data.js owns the membership), so a fifty-game roster
          // never becomes forty ▼ presses. Unfiltered browse stays the attract fallback.
          var roomId = qs.get("room");
          var room = roomId && root.MenuData ? root.MenuData.get(roomId) : null;
          // Arriving with ANY ?room= means the visitor came from the menu, so the way back
          // is the menu even when the id is stale or mistyped. Falling through to the
          // fold-to-BROWSE exit reads as "the button is broken" on a kiosk.
          if (roomId) shellOpts.onExit = function () { window.location.href = "/menu.html"; };
          if (room) {
            var defs = room.games.map(function (id) { return root.Game.get(id); })
                                 .filter(function (d) { return !!d; });
            if (defs.length) shellOpts.registry = subRegistry(defs);
          }
        }
      } catch (e) {}

      // the real focus transport: a POST per claim/release. Fire-and-forget — a failed
      // claim must never block play, it just means the party keeps the remote.
      shellOpts.focus = {
        claim: function (owner) { postFocus({ owner: owner }); },
        release: function (owner) { postFocus({ owner: owner, release: true }); }
      };
      function postFocus(body) {
        try {
          fetch("/nav/focus", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body), keepalive: true   // survives the unload
          }).catch(function () {});
        } catch (e) {}
      }

      // ── phone controllers: a room over the LAN, SEPARATE from /nav focus ──────────
      // Phones join a 4-char code, render the game's declared controls, and POST intents.
      // Entirely separate from the physical-remote focus above — many phones, each addressed
      // by player id, no arbitration (the party keeps owning the one dimmer). Firewall: only
      // numbers/geometry cross; the relay rejects any string value, so no text reaches here.
      var playCode = null, lastDecl = [];
      try {
        var storedCode = window.sessionStorage ? sessionStorage.getItem("deephouse.arcade.code") : null;
        playCode = ((qs.get("code") || storedCode || "") + "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      } catch (e) {}
      if (!playCode || playCode.length < 4) {
        var CODE_AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no ambiguous O/0/I/1
        // crypto, not the bare global RNG — game.js is source-scanned for it (games must
        // seed through host.rng). This is a join code, not game state, but the rule holds.
        var rb = new Uint8Array(4);
        try { (window.crypto || window.msCrypto).getRandomValues(rb); }
        catch (e) { rb = [7, 13, 21, 3]; }                 // last-ditch fixed code, never blocks
        playCode = "";
        for (var ci = 0; ci < 4; ci++) playCode += CODE_AL[rb[ci] % CODE_AL.length];
      }
      try { if (window.sessionStorage) sessionStorage.setItem("deephouse.arcade.code", playCode); } catch (e) {}

      function playPub(obj) {
        try {
          obj.room = playCode;
          fetch("/play/pub", { method: "POST", headers: { "Content-Type": "application/json" },
                               body: JSON.stringify(obj) }).catch(function () {});
        } catch (e) {}
      }
      // opts.play seam: the core calls declare() on every transition; we cache the last one
      // so a late joiner / reconnecting phone gets the current controls on its join event.
      shellOpts.play = {
        declare: function (decl) { lastDecl = decl || []; playPub({ type: "declare", input: lastDecl }); }
      };

      var shell = createShell(shellOpts);
      window.GAME = shell;   // hand for console / the reviewer

      // the host's inbound stream: join announcements (re-declare so a newcomer sees the
      // current controls) and player intents (fed into the shell's rich-input seam). This is
      // a SECOND EventSource beside /nav/stream — the phone channel and the remote never mix.
      (function connectPlay() {
        if (!("EventSource" in window)) return;
        try {
          var pes = new EventSource("/play/sub?room=" + playCode + "&role=host");
          pes.onmessage = function (ev) {
            try {
              var m = JSON.parse(ev.data);
              if (m.type === "join") playPub({ type: "declare", input: lastDecl });
              else if (m.type === "intent") shell.intent(m.id, m.value, m.player);
            } catch (e) {}
          };
          pes.onerror = function () { /* serve.py down / file:// — remote + keyboard still work */ };
        } catch (e) {}
      })();

      // a small JOIN badge — the code + URL a phone uses. Shown only when nobody is mid-game
      // (ATTRACT/BROWSE), so it never sits over a puzzle. location.host is whatever the arcade
      // was opened at, so on the LAN IP it is the address a real phone can reach.
      var joinBadge = document.createElement("div");
      joinBadge.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:30;pointer-events:none;" +
        "font:600 14px/1.5 'Cascadia Code',ui-monospace,monospace;color:#bcd0ee;white-space:pre;" +
        "background:rgba(6,9,18,0.62);padding:9px 13px;border-radius:10px;border:1px solid rgba(140,160,210,0.25);";
      joinBadge.textContent = "phone → " + location.host + "/play.html?code=" + playCode + "\njoin code   " + playCode;
      document.body.appendChild(joinBadge);

      // keyboard → dispatch (brain.js:432-465 shape)
      window.addEventListener("keydown", function (e) {
        if (e.repeat && (e.code === "Enter" || e.code === "Escape" || e.code === "Space")) return;
        var a = normalizeKey(e.code);
        if (a) { e.preventDefault(); shell.dispatch(a); }
      });

      // physical remote: listen.py → POST /input → serve.py stamps focus → SSE /nav/stream.
      // ?owner names this page so the server can route a `tap` (EXIT) here regardless of
      // who holds focus — the escape hatch must not depend on the arbiter being right.
      (function connectNav() {
        if (!("EventSource" in window)) return;
        try {
          var es = new EventSource("/nav/stream?owner=" + NAV_OWNER);
          es.onmessage = function (ev) {
            try {
              var m = JSON.parse(ev.data);
              if (m.focus && m.focus !== NAV_OWNER) return;   // not addressed to us
              var a = normalizeNav(m.action);
              if (a) shell.dispatch(a);
            } catch (e) {}
          };
          es.onerror = function () { /* served from file:// or serve.py down — keyboard still works */ };
        } catch (e) {}
      })();

      // Hand the remote back when the page goes away. The server's TTL covers a crash;
      // this covers the ordinary case in well under the 30s that would take.
      window.addEventListener("pagehide", function () { shell.releaseFocus(); });

      var last = 0;
      function loop(nowMs) {
        var dt = Math.min(0.05, (nowMs - last) / 1000 || 0.016); last = nowMs;
        fit();
        shell.tick(dt);
        shell.render(ctx, canvas.width, canvas.height, dt);
        var st = shell.state();
        joinBadge.style.display = (st === "play" || st === "deploy") ? "none" : "block";
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
