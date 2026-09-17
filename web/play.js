/* play.js — Deep House PHONE CONTROLLER.
 *
 * A phone joins a room by 4-char code and renders whatever controls the game on
 * the big screen DECLARES over the play relay (controller/serve.py, "PLAY RELAY"
 * section) — this page owns no game logic of its own. Same split as every other
 * shell here (see menu.js): a DOM-free PURE CORE (PlayController) that turns a
 * declaration into a control MODEL and a touch into an intent MESSAGE, plus thin
 * browser wiring that renders that model and pushes/pulls the wire.
 *
 * WIRE (owned by controller/serve.py, "PLAY RELAY" section — read it before
 * changing this file):
 *   POST /join {room}                                 -> {player, room} | 404 {error:"no screen"}
 *   GET  /play/sub?room=&role=phone&player=            -> SSE, host -> phone messages
 *     {type:"declare", input:[{intent,id,label,range}], prompt}   -- render these controls
 *     (any other `type` is ignored -- forward compatible with types this page doesn't know yet)
 *   POST /intent {room, player, id, value}              -- one interaction. value is ALWAYS
 *     numeric/bool/{x,y}/array -- NEVER a string (the relay 400s strings; no free text
 *     crosses phone -> host). This page therefore has no text inputs anywhere, including
 *     its own room-code entry (a tap keypad, not a text field).
 *
 * Dual export as root.PlayController, same convention as menu.js / game.js.
 */
(function (root) {
  "use strict";

  var THROTTLE_DEG = 1;      // an angle drag only re-sends past this many degrees...
  var THROTTLE_MS = 50;      // ...or this many ms, whichever comes first -- keeps a
                              // drag from flooding the relay's maxsize-64 queue.

  var DEFAULT_DPAD = [
    { type: "dpad", id: "up", label: "UP" },
    { type: "dpad", id: "down", label: "DOWN" },
    { type: "dpad", id: "enter", label: "ENTER" },
    { type: "dpad", id: "back", label: "BACK" }
  ];

  /* ── the pure core: a control MODEL + intent MESSAGES, no DOM, no fetch ────── */
  function createController(opts) {
    opts = opts || {};
    var now = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
    var S = { model: DEFAULT_DPAD.slice(), lastAngle: {}, lastPad: {} };

    function findControl(id) {
      for (var i = 0; i < S.model.length; i++) if (S.model[i].id === id) return S.model[i];
      return null;
    }

    // input: [{intent, id, label, range}] declared by the game. Unknown intents are
    // dropped, never thrown -- a future intent type must degrade safely here. Empty
    // input (or nothing left once unknowns are dropped) falls back to the d-pad.
    function setDeclaration(input) {
      var controls = [];
      if (Array.isArray(input)) {
        input.forEach(function (item) {
          if (!item || typeof item !== "object" || !item.id) return;
          if (item.intent === "angle") {
            controls.push({ type: "angle", id: item.id, label: item.label || item.id,
                             range: item.range || [0, 360] });
          } else if (item.intent === "commit") {
            controls.push({ type: "commit", id: item.id, label: item.label || item.id });
          } else if (item.intent === "pad") {
            // a 2D tap surface -> an {x,y} normalized coordinate (a "point at the screen" control:
            // Fractal Dive's dive target, a map pin). {x,y} is a relay-legal value; text still can't cross.
            controls.push({ type: "pad", id: item.id, label: item.label || item.id });
          }
          // any other intent (pick/scalar/future) -- skipped on purpose, see file header.
        });
      }
      S.model = controls.length ? controls : DEFAULT_DPAD.slice();
      S.lastAngle = {}; S.lastPad = {};   // a fresh declaration invalidates any in-flight throttle state
      return S.model;
    }

    // a commit button or a d-pad button -- both are one-shot presses. The WHICH is the
    // control `id` (up/down/enter/back for the d-pad); the value is a plain `true` for
    // both. Value must never be a string: the relay's firewall rejects string values so
    // no free text can cross to the screen, and a d-pad action is carried by id, not value.
    function press(id) {
      var c = findControl(id);
      if (!c) return null;
      if (c.type === "commit" || c.type === "dpad") return { id: id, value: true };
      return null;   // an angle control has no press -- drive it with setAngle
    }

    // a dial's continuous drag, throttled HERE so it's testable headless: emits only
    // once the angle has moved >= THROTTLE_DEG or >= THROTTLE_MS has passed since the
    // last emit, otherwise returns null (nothing to send). The first call for an id
    // always emits -- there is no prior state to compare against.
    function setAngle(id, deg) {
      var c = findControl(id);
      if (!c || c.type !== "angle") return null;
      var last = S.lastAngle[id], t = now();
      if (last && Math.abs(deg - last.deg) < THROTTLE_DEG && (t - last.t) < THROTTLE_MS) return null;
      S.lastAngle[id] = { deg: deg, t: t };
      return { id: id, value: deg };
    }

    // a pad's tap/drag, throttled like setAngle: emits an {x,y} in 0..1 only once it has moved
    // >= 0.01 in either axis or >= THROTTLE_MS since the last emit. The first call always emits
    // (a plain tap must register). Value is an {x,y} object of numbers — a relay-legal shape.
    function setPad(id, x, y) {
      var c = findControl(id);
      if (!c || c.type !== "pad") return null;
      var last = S.lastPad[id], t = now();
      if (last && Math.abs(x - last.x) < 0.01 && Math.abs(y - last.y) < 0.01 && (t - last.t) < THROTTLE_MS) return null;
      S.lastPad[id] = { x: x, y: y, t: t };
      return { id: id, value: { x: x, y: y } };
    }

    return {
      setDeclaration: setDeclaration,
      model: function () { return S.model; },
      press: press,
      setAngle: setAngle,
      setPad: setPad
    };
  }

  var PlayController = { createController: createController, DEFAULT_DPAD: DEFAULT_DPAD };
  root.PlayController = PlayController;
  if (typeof module !== "undefined" && module.exports) module.exports = PlayController;

  /* ── browser wiring (guarded: node require never reaches this) ─────────────── */
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      var CODE_KEY = "dh-play-room";
      var KEYPAD_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

      var joinScreen = document.getElementById("join");
      var playScreen = document.getElementById("play");
      var joinMsg = document.getElementById("join-msg");
      var codeDisplay = document.getElementById("code-display");
      var keypad = document.getElementById("keypad");
      var playPrompt = document.getElementById("play-prompt");
      var controlsEl = document.getElementById("controls");
      if (!joinScreen || !playScreen) return;   // not this page

      var ctl = PlayController.createController();
      var state = { room: null, player: null, typed: "", es: null };

      function showJoin(msg) {
        playScreen.classList.add("hidden");
        joinScreen.classList.remove("hidden");
        if (msg) joinMsg.textContent = msg;
      }
      function showPlay() {
        joinScreen.classList.add("hidden");
        playScreen.classList.remove("hidden");
      }

      /* ── code entry: a tap keypad, never a text input (see file header) ────── */
      function renderCodeDisplay() {
        var s = (state.typed + "____").slice(0, 4).split("").join(" ");
        codeDisplay.textContent = s;
      }
      function typeChar(ch) {
        if (state.typed.length >= 4) return;
        state.typed += ch;
        renderCodeDisplay();
        if (state.typed.length === 4) join(state.typed);
      }
      function backspace() {
        state.typed = state.typed.slice(0, -1);
        renderCodeDisplay();
      }
      (function buildKeypad() {
        KEYPAD_CHARS.forEach(function (ch) {
          var b = document.createElement("button");
          b.className = "key"; b.textContent = ch;
          b.addEventListener("click", function () { typeChar(ch); });
          keypad.appendChild(b);
        });
        var back = document.createElement("button");
        back.className = "key wide"; back.textContent = "⌫";
        back.addEventListener("click", backspace);
        keypad.appendChild(back);
      })();

      // A persistent way OUT — ONLY exit, always on the play screen no matter what the game
      // declares. Deliberately NOT a "Back" button: 'back' is a per-game action (lockpick
      // rotates a ring, clockwork lifts a gear, SEED undoes a seed), so a chrome "Back" that
      // silently does game-specific things reads as broken. Back stays a game control (the
      // d-pad for simple games; a declared game owns its own). Exit is the one universal
      // guarantee: 'exit' bypasses the game (universalExit) so a player is never stranded.
      (function buildExitBar() {
        var bar = document.createElement("div");
        bar.style.cssText = "display:flex;margin-top:18px";
        var b = document.createElement("button");
        b.textContent = "✕ Exit";
        b.style.cssText = "flex:1;min-height:52px;font:600 15px system-ui,sans-serif;" +
          "color:#9fb0d0;background:#141a2c;border:1px solid #2a3350;border-radius:10px;";
        b.addEventListener("click", function () { sendIntent({ id: "exit", value: true }); });
        bar.appendChild(b);
        playScreen.appendChild(bar);
      })();

      /* ── join + reconnecting SSE (backoff pattern matches party-main.js connectParty) ── */
      function postJSON(url, body) {
        return fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      function join(code) {
        code = String(code || "").toUpperCase();
        if (!code) return;
        joinMsg.textContent = "joining " + code + "…";
        postJSON("/join", { room: code }).then(function (res) {
          if (res.status === 404) {
            sessionStorage.removeItem(CODE_KEY);
            state.typed = ""; renderCodeDisplay();
            return showJoin("no screen found — check the code");
          }
          if (!res.ok) return showJoin("couldn't join — try again");
          return res.json().then(function (data) {
            state.room = data.room || code; state.player = data.player;
            try { sessionStorage.setItem(CODE_KEY, state.room); } catch (e) {}
            showPlay();
            renderControls(ctl.model(), "");   // default d-pad until the screen declares
            connectPlay(1000);
          });
        }).catch(function () { showJoin("couldn't reach the house — try again"); });
      }

      function connectPlay(delay) {
        try {
          if (state.es) { try { state.es.close(); } catch (e) {} }
          var url = "/play/sub?room=" + encodeURIComponent(state.room) +
                     "&role=phone&player=" + encodeURIComponent(state.player);
          state.es = new EventSource(url);
          state.es.onmessage = function (ev) {
            var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
            if (!m || m.type !== "declare") return;   // unknown types ignored, forward-safe
            ctl.setDeclaration(m.input);
            renderControls(ctl.model(), m.prompt || "");
          };
          state.es.onopen = function () { delay = 1000; };
          state.es.onerror = function () {
            try { state.es.close(); } catch (e) {}
            setTimeout(function () { connectPlay(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
          };
        } catch (e) {
          setTimeout(function () { connectPlay(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
        }
      }

      function sendIntent(msg) {
        if (!msg || !state.room) return;
        postJSON("/intent", { room: state.room, player: state.player, id: msg.id, value: msg.value }).catch(function () {});
      }

      /* ── rendering the control model the game declared ──────────────────────── */
      function renderControls(model, prompt) {
        playPrompt.textContent = prompt || "";
        controlsEl.innerHTML = "";
        (model || []).forEach(function (c) {
          if (c.type === "angle") controlsEl.appendChild(buildDial(c));
          else if (c.type === "pad") controlsEl.appendChild(buildPad(c));
          else controlsEl.appendChild(buildButton(c));   // commit + dpad both render as a button
        });
      }

      function buildPad(c) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:100%;max-width:340px;aspect-ratio:1/1;margin:6px auto;" +
          "border:1px solid var(--line);border-radius:14px;touch-action:none;overflow:hidden;" +
          "background:radial-gradient(circle at 50% 45%,#12203a,#0a1020)";
        var label = document.createElement("div");
        label.textContent = c.label || c.id;
        label.style.cssText = "position:absolute;top:8px;left:0;right:0;text-align:center;color:var(--dim);font-size:13px;pointer-events:none";
        var dot = document.createElement("div");
        dot.style.cssText = "position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;" +
          "border-radius:50%;border:2px solid var(--accent);box-shadow:0 0 14px rgba(242,201,76,.6);pointer-events:none";
        wrap.appendChild(label); wrap.appendChild(dot);
        function at(e) {
          var r = wrap.getBoundingClientRect();
          var x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          var y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          dot.style.left = (x * 100) + "%"; dot.style.top = (y * 100) + "%";
          var msg = ctl.setPad(c.id, x, y); if (msg) sendIntent(msg);
        }
        wrap.addEventListener("pointerdown", function (e) {
          e.preventDefault(); try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
          at(e); wrap.addEventListener("pointermove", at);
        });
        function end(e) { wrap.removeEventListener("pointermove", at); try { wrap.releasePointerCapture(e.pointerId); } catch (err) {} }
        wrap.addEventListener("pointerup", end); wrap.addEventListener("pointercancel", end);
        return wrap;
      }

      function buildButton(c) {
        var b = document.createElement("button");
        b.className = "ctl-btn " + c.type;
        b.textContent = c.label || c.id;
        var fire = function (e) { e.preventDefault(); sendIntent(ctl.press(c.id)); };
        b.addEventListener("pointerdown", fire);
        return b;
      }

      function buildDial(c) {
        var wrap = document.createElement("div");
        wrap.className = "dial";
        var face = document.createElement("div");
        face.className = "dial-face";
        var handle = document.createElement("div");
        handle.className = "dial-handle";
        face.appendChild(handle);
        var label = document.createElement("div");
        label.className = "dial-label";
        label.textContent = c.label || c.id;
        wrap.appendChild(face); wrap.appendChild(label);

        var range = c.range || [0, 360];
        var deg = range[0];
        function place(d) {
          var r = Math.max(0, face.clientWidth / 2 - 14);
          var rad = (d - 90) * Math.PI / 180;   // 0deg points up, matches a clock/dial feel
          var cx = face.clientWidth / 2, cy = face.clientHeight / 2;
          handle.style.left = (cx + r * Math.cos(rad) - 9) + "px";
          handle.style.top = (cy + r * Math.sin(rad) - 9) + "px";
        }
        function angleFromEvent(e) {
          var rect = face.getBoundingClientRect();
          var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
          var d = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
          if (d < 0) d += 360;
          return d % 360;
        }
        function onMove(e) {
          e.preventDefault();
          deg = angleFromEvent(e);
          place(deg);
          var msg = ctl.setAngle(c.id, deg);
          if (msg) sendIntent(msg);
        }
        face.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          try { face.setPointerCapture(e.pointerId); } catch (err) {}
          onMove(e);
          face.addEventListener("pointermove", onMove);
        });
        function endDrag(e) {
          face.removeEventListener("pointermove", onMove);
          try { face.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        face.addEventListener("pointerup", endDrag);
        face.addEventListener("pointercancel", endDrag);

        requestAnimationFrame(function () { place(deg); });
        return wrap;
      }

      window.addEventListener("pagehide", function () {
        if (state.es) { try { state.es.close(); } catch (e) {} }
      });

      /* ── boot: ?code= overrides, else remembered code, else the keypad ──────── */
      var qsCode = new URLSearchParams(window.location.search).get("code");
      var initial = (qsCode ? qsCode.toUpperCase() : "").slice(0, 4);
      if (!initial) { try { initial = sessionStorage.getItem(CODE_KEY) || ""; } catch (e) {} }
      renderCodeDisplay();
      if (initial && initial.length === 4) join(initial);
      else showJoin("enter the room code");
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
