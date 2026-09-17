/* games/seed.js — THE SEED: grow the sunflower.  (Tier 3, bespoke — not an engine.)
 *
 * The player never draws a sunflower. They choose the ANGLE between one seed and the
 * next, and the flower emerges from that choice by itself. The payoff is the moment
 * after the last placement, when the system takes over and pours out hundreds of seeds
 * in the pattern the player stumbled into. That pause is the game. Everything here is
 * arranged around protecting it.
 *
 *   ▲/▼  choose the angle   ‹enter› plant   ‹back› undo the last seed (CONSUMED)
 *
 * THE RULE (Vogel): seed n sits at r = scale·√n, θ = θ(n-1) + angle. The player owns
 * only the angle; the radius is automatic. A rational fraction of a turn lines the seeds
 * up into radial lanes you can see within six placements — 90° gives four spokes, 180° a
 * line. The golden angle 137.5° (360°/φ²) is the "most irrational" rotation, so no lane
 * ever repeats and the packing closes up. Nothing on screen ever says that. Watching the
 * gaps IS the lesson; naming it would spend the discovery.
 *
 * PHASES. 1–12 offer the four angles as glowing positions on the next ring (never as a
 * lecture). 13–24 take the choices away and hand over a continuous ±0.5° nudge, starting
 * from whatever the player used most — they have to infer that the rule should continue.
 * 25 is the last placement. Then the bloom.
 *
 * TIMING. The bloom is non-interactive, so it lives under the ~12 s ceiling the 25 s
 * idle→ATTRACT clock imposes: 0.8 s of held silence, then ~4.9 s of pouring. host.solve()
 * fires when the last seed lands, never at the start — the reward is the filling, and
 * cutting to DEPLOY early would throw away the thing this game exists for.
 *
 * Deterministic: the only randomness is one cosmetic starting rotation from
 * host.rng(host.seed + 997). Wrong angles are never attemptFailed() — a bad angle is the
 * teaching, not a loss, and that call is machine-wide.
 */
(function (root) {
  "use strict";
  var Game = root.Game, TAU = Math.PI * 2, D2R = Math.PI / 180;

  var CHOICES = [90, 120, 137.5, 180];   // degrees; 137.5 is index 2
  var GUIDED_END = 12;                   // phase 1: the four choices are offered
  var INFER_END = 24;                    // phase 2: continuous nudge, choices hidden
  var LAST_SEED = 25;                    // phase 3: one more, then the bloom
  var NUDGE = 0.5;                       // degrees per press in phase 2
  var BLOOM_TOTAL = 420;                 // seeds in the finished flower
  var HOLD_MS = 800;                     // the held breath before the pour. Sacred.

  // The pour, as a piecewise rate. The ticket's own arithmetic did not close (50 seeds at
  // 8/s is 6.25 s on its own, past the stated 4–5 s total), so the shape is kept — slow
  // and countable, then flowing, then overwhelming — and the numbers are made to fit:
  // 1.5 s + 2.1 s + ~1.3 s = ~4.9 s, plus the 0.8 s hold, ~5.7 s inside the 12 s ceiling.
  var RATES = [[15, 10], [100, 40], [BLOOM_TOTAL, 250]];   // [up to n, seeds per second]

  function rateAt(n) {
    for (var i = 0; i < RATES.length; i++) if (n < RATES[i][0]) return RATES[i][1];
    return RATES[RATES.length - 1][1];
  }

  Game.register({
    id: "seed",
    title: "The Seed",
    deploy: { exhibit: "Phyllotaxis", palette: 0, organism: { syn: 0, slime: 0.4, fluid: 0, vicsek: 0 } },
    // A phone renders these instead of the 4 buttons: a continuous DIAL for the angle
    // (the whole game is choosing it) and a PLANT button. The dial doesn't lay a seed —
    // it aims the next one, and a faint ghost shows where continuing at this angle goes,
    // so the choice is legible before you commit. See intent() below.
    input: [
      { intent: "angle",  id: "theta", label: "the angle", range: [0, 360] },
      { intent: "commit", id: "plant", label: "plant" },
    ],

    create: function (host) {
      // seeds[i] = cumulative theta of seed i. Seed 0 is the origin, at the centre.
      var seeds = [], picks = [], sel = 0, angle = CHOICES[2], rot0 = 0;
      var bloom = 0, bloomAt = 0, blooming = false, solved = false, clock = 0, flash = 0;

      function planted() { return seeds.length - 1; }          // the origin doesn't count
      function phase() {
        if (blooming) return 4;
        if (planted() < GUIDED_END) return 1;
        if (planted() < INFER_END) return 2;
        return 3;
      }
      function nextTheta(deg) { return (seeds[seeds.length - 1] || 0) + deg * D2R; }

      // The angle the player leaned on in phase 1 — what phase 2 starts from, so the
      // continuous nudge begins where their own habit left it rather than at a default.
      function favourite() {
        var best = CHOICES[2], count = -1;
        for (var i = 0; i < CHOICES.length; i++) {
          var c = 0;
          for (var j = 0; j < picks.length; j++) if (picks[j] === i) c++;
          if (c > count) { count = c; best = CHOICES[i]; }
        }
        return best;
      }

      // The angle the DIAL currently aims at: phase 1 snaps to the highlighted choice,
      // from phase 2 on it is the freely-nudged angle. Drives the ghost preview.
      function previewAngle() { return phase() === 1 ? CHOICES[sel] : angle; }
      // nearest of the four offered choices to a dialed degree (circular distance).
      function nearestChoice(deg) {
        var best = 0, bd = 1e9;
        for (var i = 0; i < CHOICES.length; i++) {
          var raw = Math.abs(deg - CHOICES[i]) % 360, d = Math.min(raw, 360 - raw);
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      }

      function say() {
        if (phase() === 1) host.text(["GROW", "make the gaps even"]);
        else if (phase() === 2) host.text(["keep going", angle.toFixed(1) + "°"]);
        else if (phase() === 3) host.text(["one more", angle.toFixed(1) + "°"]);
        else host.text([""]);
      }

      function plant(deg) {
        seeds.push(nextTheta(deg));
        flash = 1;                                   // the gap-flash: look at the spacing
        if (planted() >= LAST_SEED) { blooming = true; bloomAt = host.now(); bloom = 0; }
        say();
      }

      // widest angular gap between consecutive seeds on the outer edge — what the
      // gap-flash points at, and the only "score" this game has. Never shown as a number.
      function widestGap() {
        if (seeds.length < 3) return null;
        var a = seeds.slice(1).map(function (t) { return ((t % TAU) + TAU) % TAU; }).sort(function (x, y) { return x - y; });
        var best = 0, at = 0;
        for (var i = 0; i < a.length; i++) {
          var next = i === a.length - 1 ? a[0] + TAU : a[i + 1];
          if (next - a[i] > best) { best = next - a[i]; at = a[i] + (next - a[i]) / 2; }
        }
        return { size: best, mid: at };
      }

      return {
        enter: function () {
          var rnd = host.rng(host.seed + 997);
          rot0 = rnd() * TAU;                        // cosmetic only — the flower's facing
          seeds = [rot0];                            // the first seed, dead centre
          picks = []; sel = 0; angle = CHOICES[2];
          bloom = 0; bloomAt = 0; blooming = false; solved = false; clock = 0; flash = 0;
          say();
        },

        input: function (a) {
          // The bloom is not skippable. Back is CONSUMED here on purpose: unconsumed, it
          // falls through to the shell and ejects the visitor to BROWSE mid-pour, which
          // throws away the one moment this game exists for. The universal EXIT gesture
          // still leaves, so nobody is ever trapped — only the undo button is deaf.
          if (blooming) return a === "back" ? true : undefined;
          var p = phase();
          if (a === "up") {
            if (p === 1) sel = (sel + CHOICES.length - 1) % CHOICES.length;
            else { angle += NUDGE; say(); }
          } else if (a === "down") {
            if (p === 1) sel = (sel + 1) % CHOICES.length;
            else { angle -= NUDGE; say(); }
          } else if (a === "enter") {
            if (p === 1) { picks.push(sel); plant(CHOICES[sel]); if (planted() === GUIDED_END) angle = favourite(); }
            else plant(angle);
          } else if (a === "back") {
            // CONSUMED while there is anything to undo — falsy only when just the origin
            // is left, so the shell's exit still works from a board the player never used.
            if (seeds.length > 1) { seeds.pop(); picks.pop(); flash = 0; say(); return true; }
            return false;
          }
        },

        // Rich-controller entry (a phone): the dial AIMS the next seed, the button PLANTS.
        // It never lays a seed itself — planting stays the one discrete commit, so undo,
        // solution() and the phase machine are all untouched. Values guarded; unknown ids
        // ignored. Steering is dead during the bloom, exactly like the buttons.
        intent: function (id, value) {
          if (blooming) return;
          if (id === "theta") {
            var deg = ((+value % 360) + 360) % 360;
            if (phase() === 1) sel = nearestChoice(deg);   // phase 1: the dial picks a choice
            else { angle = deg; say(); }                   // phase 2+: a free angle
          } else if (id === "plant") {
            this.input("enter");                           // plant = the shell's enter
          }
        },

        update: function (dt) {
          clock += dt;
          if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
          if (!blooming || solved) return;
          var since = host.now() - bloomAt;
          if (since < HOLD_MS) return;               // the held breath. Do not fill it.
          // integrate the pour at the current rate; dt is clamped to 0.05s by the shell,
          // so this steps rather than jumps even if a frame is late.
          bloom = Math.min(BLOOM_TOTAL, bloom + rateAt(bloom) * dt);
          if (bloom >= BLOOM_TOTAL) {
            solved = true;
            // The angle the player discovered becomes a real spiral in the room — geometry only,
            // never text (firewall). Guarded: some test hosts have no contribute().
            if (host.contribute) host.contribute({ spiral: "Phyllotaxis", params: { angleDeg: angle }, palette: 0 });
            host.solve();
          }
        },

        draw: function (ctx, w, h, dt) {
          var ink = host.ink;
          // the deploy target, faint, behind the puzzle. The shell already drew the one
          // backdrop this frame, so this call is a no-op — kept because the ticket asks
          // for it and because it is the documented way to say "this belongs behind".
          host.spiralPreview(ctx, 0.22, 0.2, dt);
          ctx.globalCompositeOperation = "source-over";

          var cx = w / 2, cy = h * 0.48;
          var shown = seeds.length + Math.floor(bloom);
          // the field zooms OUT as it fills, so early seeds are big and readable and the
          // finished flower still fits the frame. Eased, so the bloom feels like growth.
          var span = Math.max(GUIDED_END, shown);
          var R = Math.min(w, h) * 0.42, scale = R / Math.sqrt(span);
          var dot = Math.max(1.5, Math.min(w, h) * 0.055 / Math.sqrt(Math.max(6, span)) * 2.2);

          function at(i, theta) {
            var r = scale * Math.sqrt(i);
            return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
          }

          // the gap-flash: the widest gap on the board pulses after a placement. It is
          // the teaching signal — it points at what a bad angle keeps doing.
          var gap = flash > 0 ? widestGap() : null;
          if (gap) {
            var gp = at(seeds.length + 2, gap.mid);
            ctx.strokeStyle = ink.mark(1);
            ctx.lineWidth = 2; ctx.globalAlpha = flash * 0.7;   // a fading PULSE, not a dim state
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gp[0], gp[1]); ctx.stroke();
            ctx.globalAlpha = 1;
          }

          var i, p;
          for (i = 0; i < seeds.length; i++) {                  // the planted seeds
            p = at(i, seeds[i]);
            ctx.beginPath(); ctx.arc(p[0], p[1], dot, 0, TAU);
            ctx.fillStyle = (i === seeds.length - 1 && !blooming) ? ink.mark(0) : ink.dim(0);
            ctx.fill();
          }

          if (blooming) {                                       // the pour
            var last = seeds[seeds.length - 1], n = Math.floor(bloom);
            for (i = 1; i <= n; i++) {
              p = at(seeds.length + i - 1, last + i * angle * D2R);
              ctx.beginPath(); ctx.arc(p[0], p[1], dot, 0, TAU);
              ctx.fillStyle = ink.mark(0); ctx.fill();
            }
            return;                                             // no candidates during the bloom
          }

          // GHOST: a faint trace of where the next seeds land if you keep this angle — the
          // dial (or ▲▼) visibly moves it, so the choice reads BEFORE you plant. This is
          // what makes the angle a real choice on a phone, not one drifting dot. Reuses the
          // pour's shape at low alpha; non-bloom only.
          var ga = previewAngle() * D2R, glast = seeds[seeds.length - 1] || 0;
          ctx.globalAlpha = 0.28;
          for (i = 1; i <= 18; i++) {
            p = at(seeds.length + i - 1, glast + i * ga);
            ctx.beginPath(); ctx.arc(p[0], p[1], dot * 0.6, 0, TAU);
            ctx.fillStyle = ink.dim(1); ctx.fill();
          }
          ctx.globalAlpha = 1;

          if (phase() === 1) {                                  // the four offered angles
            for (i = 0; i < CHOICES.length; i++) {
              p = at(seeds.length, nextTheta(CHOICES[i]));
              var on = i === sel;
              ctx.beginPath(); ctx.arc(p[0], p[1], dot * (on ? 1.6 : 1.1), 0, TAU);
              ctx.fillStyle = on ? ink.accent() : ink.dim(0);
              ctx.fill();
            }
          } else {                                              // the nudged angle
            p = at(seeds.length, nextTheta(angle));
            ctx.beginPath(); ctx.arc(p[0], p[1], dot * 1.6, 0, TAU);
            ctx.fillStyle = ink.accent(); ctx.fill();
          }

          // the ring the next seed will land on — a faint promise of where growth goes
          ctx.strokeStyle = ink.dim(1); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, scale * Math.sqrt(seeds.length), 0, TAU); ctx.stroke();
        },

        exit: function () { seeds = []; picks = []; },

        solution: function () {
          // Phase 1: walk to 137.5 (index 2) once — the selection persists — and plant
          // twelve. Phase 2 and 3: the angle carried over from the favourite, so just
          // keep planting. Then WAIT out the hold and the pour: the win fires when the
          // last seed lands, so a solution that stops at the final press has not won.
          var seq = [], s = sel, i;
          while (s !== 2) { seq.push("down"); s = (s + 1) % CHOICES.length; }
          for (i = 0; i < GUIDED_END; i++) seq.push("enter");
          for (i = GUIDED_END; i < LAST_SEED; i++) seq.push("enter");
          var pour = 0, t = 0;
          while (pour < BLOOM_TOTAL) { pour += rateAt(pour) * 0.05; t += 50; }
          seq.push({ wait: HOLD_MS + t + 200 });
          return seq;
        }
      };
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
