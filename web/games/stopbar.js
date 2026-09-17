/* games/stopbar.js — ENGINE 9 of Tier 1A: Stop the Bar.
 *
 * A marker sweeps back and forth; freeze it inside the glowing band. Three stops win.
 *   ‹enter› freeze   ▲/▼ inert   ‹back› not consumed (shell exits)
 *
 * LATENCY. The band is deliberately WIDE (BAND of the full sweep) because dt is clamped to
 * 0.05 s and the physical remote adds Wi-Fi latency on top — a twitchy band would read as a
 * broken button, not as difficulty. A miss resets the run of three and locks the button for
 * a moment — the cost stays inside the game, and never reaches host.attemptFailed(), which
 * is machine-wide. See ARMING below for why a miss has to cost anything at all.
 *
 * TIMING + DETERMINISM. Every band is a genuine target seeded in enter() from
 * host.rng(host.seed + salt) — none of them is pinned to where the marker happens to be, so
 * every round is a real reaction and mashing ‹enter› does not clear the game. That is only
 * possible because solution() may return `{ wait: ms }` entries: the headless suite advances
 * the shell clock through them in ≤50 ms sub-steps, exactly the cadence the floor gives, so
 * the winning line proves the real game rather than a degenerate frozen state of it. The
 * earlier anchored-band shape here was a workaround for a harness limitation; the harness
 * was fixed instead (architect's ruling, BUILD-PLAN precedent P-2).
 *
 * IF YOU RESKIN OR COPY THIS ENGINE, two constraints are load-bearing:
 *  1. Bands must be seeded at least 1.2 band-widths apart (including from the marker's start
 *     position). Overlapping bands make a round UNREACHABLE, because the arming rule holds
 *     the button inert until the marker has left the band it just caught. This is the easiest
 *     thing to reintroduce by accident and it produces an unwinnable game, not a hard one.
 *     The 0.15..0.85 clamp on target positions is load-bearing for a second reason: the
 *     sweep is a TRIANGLE, so the marker reflects at 0 and 1 rather than decelerating. A
 *     band seeded near either extreme gets entered, exited and re-entered on the turn, which
 *     makes that round markedly more generous than a mid-sweep one. Arming still holds (the
 *     marker does leave), so this is difficulty evenness, not correctness — but a reskin that
 *     narrows BAND or raises ROUNDS should keep the clamp rather than widen it.
 *  2. Prove it the way this one was proved: mashing ‹enter› at frame rate must win ZERO times
 *     across a dozen seeds while solution() wins every time. A timing game that a masher
 *     clears is not a game, and nothing in the suite catches that on its own.
 */
(function (root) {
  "use strict";
  var Game = root.Game, SWEEP_MS = 2600, SCAN_MS = 10, MISS_LOCK_MS = 400;

  function makeEngine(cfg) {
    var BAND = cfg.band || 0.22, ROUNDS = cfg.rounds || 3;

    return function (host) {
      var targets = [], hits = 0, clock = 0, flash = 0;
      var lockUntil = 0, caught = null;   // the miss lockout, and the band just caught

      // triangle sweep on the shell clock: 0 → 1 → 0, forever.
      function posAt(ms) {
        var t = (ms % SWEEP_MS) / SWEEP_MS;
        return t < 0.5 ? t * 2 : 2 - t * 2;
      }
      function pos() { return posAt(host.now()); }
      function target() { return targets[Math.min(hits, ROUNDS - 1)]; }
      function say() { host.text([cfg.prompt, hits + " / " + ROUNDS]); }

      // ARMING — what makes this a reaction game rather than a mash.
      // A wide band on a repeating sweep is cleared by any masher given a second, because a
      // miss costs nothing and the marker re-enters the band every pass. So: a miss RESETS
      // the run and locks the button briefly, and after a catch the button stays inert until
      // the marker has actually left the band it caught. A press while inert is ignored
      // outright — no penalty — so a fumbled double-tap never punishes anyone; only a real,
      // deliberate press at the wrong moment costs the run.
      function armed(ms) {
        if (ms < lockUntil) return false;
        return caught === null || Math.abs(posAt(ms) - caught) > BAND / 2;
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + (cfg.salt || 1117));
          // 0.15..0.85 so a band always sits somewhere the sweep actually reaches. Each one
          // must also clear the PREVIOUS band (and the start position) by more than a band
          // width: bands that overlap would leave the next round unreachable, because the
          // arming rule holds the button inert until the marker has left the band it caught.
          targets = [];
          var prev = posAt(host.now());
          for (var i = 0; i < ROUNDS; i++) {
            var t = 0.15 + rnd() * 0.7, guard = 0;
            while (Math.abs(t - prev) < BAND * 1.2 && guard++ < 32) t = 0.15 + rnd() * 0.7;
            if (Math.abs(t - prev) < BAND * 1.2) t = prev > 0.5 ? 0.15 : 0.85;   // last resort
            targets.push(t); prev = t;
          }
          hits = 0; clock = 0; flash = 0; lockUntil = 0; caught = null;
          say();
        },
        input: function (a) {
          if (a !== "enter") return;            // back: shell exits; arrows inert
          if (!armed(host.now())) return;       // inert: ignored outright, costs nothing
          if (Math.abs(pos() - target()) <= BAND / 2) {
            caught = target(); hits++; flash = 1;
            if (hits >= ROUNDS) { host.solve(); return; }
          } else {
            hits = 0; caught = null; flash = -1;
            lockUntil = host.now() + MISS_LOCK_MS;
          }
          say();
        },
        update: function (dt) { clock += dt; if (flash) flash *= 0.9; },
        draw: function (ctx, w, h, dt) {
          var ink = host.ink;
          // The backdrop is the SHELL's, drawn once before this runs (game.js owns the one
          // alpha). host.spiralPreview() used to be called here too, which is why the
          // puzzle sat on a doubled backdrop; it is now idempotent, so a copy of this
          // engine that reinstates the call is harmless rather than a regression.
          // Marks come from host.ink, pre-floored at FULL alpha — never dim with
          // globalAlpha, that compounding is what put the old marks under the floor.
          ctx.globalCompositeOperation = "source-over";
          var x0 = w * 0.12, x1 = w * 0.88, span = x1 - x0, y = h * 0.5;

          ctx.strokeStyle = "rgba(138,147,180,0.3)"; ctx.lineWidth = 2;      // the track
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();

          var bx = x0 + (target() - BAND / 2) * span, bw = BAND * span;      // the band
          var g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          var col = ink.accent();
          g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, col); g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.35; ctx.fillStyle = g;
          ctx.fillRect(bx, y - h * 0.06, bw, h * 0.12); ctx.globalAlpha = 1;

          var mx = x0 + pos() * span;                                        // the marker
          ctx.strokeStyle = flash > 0 ? col : ink.mark(1);
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(mx, y - h * 0.09); ctx.lineTo(mx, y + h * 0.09); ctx.stroke();

          var pr = Math.min(w, h) * 0.012, gap = pr * 4, px0 = w / 2 - gap * (ROUNDS - 1) / 2;
          for (var k = 0; k < ROUNDS; k++) {                                 // the round pips
            ctx.beginPath(); ctx.arc(px0 + k * gap, h * 0.78, pr, 0, Math.PI * 2);
            ctx.fillStyle = k < hits ? col : ink.dim(0); ctx.fill();
          }
        },
        exit: function () { targets = []; caught = null; },
        solution: function () {
          // For each remaining round: wait to the first instant that is both armed and on
          // target, then press. Aiming at the MIDDLE of the band (a quarter of its width,
          // not its edge) leaves room for the sub-step clock accumulation in the driver.
          // Never presses while inert, so it never misses and never resets its own run.
          var seq = [], t = host.now(), held = caught, lock = lockUntil;
          for (var r = hits; r < ROUNDS; r++) {
            var c = targets[r], d = 0;
            // ONE wait per round, to the first instant that is both armed AND on target.
            // Waiting for those two separately is wrong: the marker can drift back into the
            // caught band while you wait for the next one, and the press is then inert.
            while (d <= SWEEP_MS * 3) {
              var ms = t + d;
              var isArmed = ms >= lock && (held === null || Math.abs(posAt(ms) - held) > BAND / 2);
              if (isArmed && Math.abs(posAt(ms) - c) <= BAND * 0.25) break;
              d += SCAN_MS;
            }
            if (d > 0) { seq.push({ wait: d }); t += d; }
            seq.push("enter");
            held = c; lock = 0;
          }
          return seq;
        }
      };
    };
  }

  Game.registerSkins(makeEngine, [{
    id: "stopbar", title: "Stop It There", salt: 1117, band: 0.22, rounds: 3,
    prompt: "freeze it in the light",
    deploy: { exhibit: "Euler spiral", palette: 7, organism: { syn: 0, slime: 0, fluid: 0.4, vicsek: 0 } }
  }]);
})(typeof window !== "undefined" ? window : globalThis);
