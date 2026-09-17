/* games/simon.js — ENGINE 5 of Tier 1A: Simon.
 *
 * Four lamps blink a sequence, then you repeat it. Three steps, growing to seven.
 *   ▲/▼ move the cursor over the lamps   ‹enter› play the lit lamp
 *   ‹back› not consumed (shell exits) — there is no undo in a recall game.
 *
 * TIMING, and why it is shaped this way:
 *  · Playback rides host.now() only. STEP_MS × MAX_STEPS = 9.1 s, comfortably inside the
 *    ~12 s ceiling the 25 s idle→ATTRACT clock imposes on any non-interactive phase.
 *  · Playback is VISUAL ONLY — it never gates input. The spec said "input ignored during
 *    playback"; ignoring it would silently swallow an early presser's answer AND make the
 *    game unwinnable headless (the suite dispatches without ticking, so playback would
 *    never end and every press would vanish). Accepting the press loses nothing: an early
 *    answer is still the right answer, and a wrong one restarts the round exactly as it
 *    would have. Ruled on by the architect: accepted, with the refinement that the first
 *    press CUTS playback short so the display can never disagree with the state.
 *
 * Deterministic: the whole sequence is drawn once in enter() from host.rng(host.seed + salt).
 */
(function (root) {
  "use strict";
  var Game = root.Game, LAMPS = 4, STEP_MS = 1300;
  function mod(x, m) { return ((x % m) + m) % m; }

  function makeEngine(cfg) {
    var START = cfg.start || 3, MAX = cfg.max || 7;

    return function (host) {
      var seq = [], round = START, at = 0, cur = 0, playUntil = 0, clock = 0;

      function startPlayback() { playUntil = host.now() + round * STEP_MS; at = 0; }
      function playing() { return host.now() < playUntil; }
      function litStep() {
        var left = playUntil - host.now();
        var i = round - Math.ceil(left / STEP_MS);
        return (i >= 0 && i < round) ? seq[i] : -1;
      }
      function say() { host.text([cfg.prompt, round + " long"]); }

      function press(lamp) {
        if (lamp !== seq[at]) { at = 0; startPlayback(); return; }   // wrong: replay, internal only
        at++;
        if (at >= round) {
          if (round >= MAX) { host.solve(); return; }
          round++; at = 0; startPlayback(); say();
        }
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 727));
          seq = []; for (var i = 0; i < MAX; i++) seq.push(Math.floor(rnd() * LAMPS));
          round = START; at = 0; cur = 0; clock = 0;
          startPlayback(); say();
        },
        input: function (a) {
          if (a === "up") { cur = mod(cur - 1, LAMPS); return; }
          if (a === "down") { cur = mod(cur + 1, LAMPS); return; }
          if (a !== "enter") return;                       // back: not consumed → shell exits
          // First press during playback CUTS playback short. Without this the lamps keep
          // running a sequence the game has already stopped treating as playback, and a
          // screen that disagrees with the state reads as a dropped button on a kiosk.
          if (playing()) playUntil = host.now();
          press(cur);                                      // accepted during playback — see header
        },
        update: function (dt) { clock += dt; },
        draw: function (ctx, w, h, dt) {
          var ink = host.ink;
          // The backdrop is the SHELL's, drawn once before this runs (game.js owns the one
          // alpha). host.spiralPreview() used to be called here too, which is why the
          // puzzle sat on a doubled backdrop; it is now idempotent, so a copy of this
          // engine that reinstates the call is harmless rather than a regression.
          // Marks come from host.ink, pre-floored at FULL alpha — never dim with
          // globalAlpha, that compounding is what put the old marks under the floor.
          ctx.globalCompositeOperation = "source-over";
          var show = playing() ? litStep() : -1;
          var r = Math.min(w, h) * 0.09, gap = r * 2.6, x0 = w / 2 - gap * (LAMPS - 1) / 2, y = h / 2;
          for (var i = 0; i < LAMPS; i++) {
            var x = x0 + i * gap, on = i === show;
            var g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
            // the GLOW is a gradient and stays alpha-driven — that is a light effect, not
            // a legibility state. The lamp's own ring is ink, at full alpha either way.
            var col = ink.mark(i);
            g.addColorStop(0, on ? col : "rgba(138,147,180,0.18)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = on ? 3 : 2;
            ctx.strokeStyle = on ? col : ink.dim(i);
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
            if (!playing() && i === cur) {
              ctx.beginPath(); ctx.arc(x, y + r * 1.5, r * 0.12, 0, Math.PI * 2);
              ctx.fillStyle = ink.accent(); ctx.fill();
            }
          }
        },
        exit: function () { seq = []; },
        solution: function () {
          // from the current cursor and round: walk to each lamp in turn and press it,
          // all the way up to the final round. Valid at any point in the playback cycle,
          // because playback never gates input.
          var out = [], c = cur, r = round, i = at;
          for (; r <= MAX; r++) {
            for (; i < r; i++) {
              while (c !== seq[i]) { out.push("down"); c = mod(c + 1, LAMPS); }
              out.push("enter");
            }
            i = 0;
          }
          return out;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "simon", title: "Repeat After", salt: 727, start: 3, max: 7,
    prompt: "say it back",
    deploy: { exhibit: "Standing wave", palette: 5, organism: { syn: 0.6, slime: 0, fluid: 0, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
