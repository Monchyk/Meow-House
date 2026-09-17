# Part Game #6 — "The Seed / Grow the Sunflower"

K.'s design, captured verbatim 2026-09-01 (advisor session). This is the build spec for the
crew's next Part Game. NOT yet built. Deploy exhibit = the existing **phyllotaxis** exhibit
(`web/viz/symmetry.js`, already in the catalog — no new/shared-exhibit work). Same 4-button shell
+ `Game.register` contract as the five shipped games; the autonomous bloom is the deploy reward.

The psychological payoff K. is protecting: **the players don't "draw the sunflower" — they discover
the placement rule that makes the sunflower emerge.** Do not add a "use the golden angle" prompt or
any instruction that gives the discovery away.

---

## K.'s spec (verbatim)

Underlying inspiration: phyllotaxis / Vogel's model / Fermat's spiral. The catalog identifies the
radial growth + golden-angle mechanism as the source of the sunflower-like packing and its visible
spiral families.

**Opening**
- A completely black screen. One seed sits exactly in the centre. Text: **GROW**.
- A faint ring surrounds it. Four possible planting positions are shown around the seed.
- Nothing explains why they are good or bad.

**Controls**
- ↑ / ↓ cycles through four angular offsets.
- Enter plants the next seed.
- Back removes the last seed.

**The rule**
- Every new seed must be placed on the next ring outward. The player chooses only the angular offset.
- Initially offered: **90° · 120° · 137.5° · 180°**.
- They place a few seeds. Bad choices visibly create gaps. Good choices distribute seeds around the centre.

**Puzzle**
- The target is NOT shown as a sunflower. The game says: **MAKE THE GAPS EVEN.**
- Players quickly discover some angles create ugly radial lanes. With two people, one naturally starts
  saying "try the weird one." They discover ~137.5° creates much more even packing.

**Escalation**
- At 12 seeds, the game stops telling them which angle choices remain. Now they must infer the same
  rule should continue.
- At 24 seeds, faint spiral arms begin appearing.
- At 40, the board looks unmistakably like a phyllotactic system.

**Completion**
- Final requirement: **PLACE THE LAST SEED WITHOUT MAKING THE BIGGEST GAP LARGER.**
- One final choice. Enter. Pause.
- Then the system autonomously continues planting hundreds of seeds. The field blooms into a huge
  sunflower-like packing. The camera pulls back. The spiral families become visible.
- Unlocked: the phyllotaxis / sunflower spiral visual.

---

## Translation notes — resolved + open (for the architect pass, NOT decided by the advisor)

RESOLVED by the spec:
- **"Solved" for this discovery game** = complete the 40-seed sequence ending with the final
  constrained placement → autonomous bloom. `markSolved(id)` fires at the bloom, same single-write-site
  as every other game. This unblocks the completion-% model (the earlier open question).
- Deploy exhibit = **phyllotaxis** (existing). No symmetry.js change.
- Fits the 4-button contract (↑↓ cycle / Enter plant / Back remove) + universal exit.

RESOLVED by the architect (2026-09-02, HIGH confidence) — K. confirms, then dev deep-house-80 builds:

1. **The "even gaps" metric.** Seeds live in Vogel form: `r_n = c·√n` (radius), `θ_n` = cumulative
   sum of chosen offsets. To score evenness, take all placed angles, sort them → N **wrap-around
   angular gaps** → `Evenness = CV = std(gaps)/mean(gaps)` (lower = more even). **Radial-lane
   detection:** bucket θ to ~2° bins; flag a lane when distinct angular classes ≤6 while seed
   count > distinct classes (i.e. seeds stacking on a few spokes). Feedback is **visual only** —
   colour each seed by its local gap, dim-wedge the current biggest gap under the standing prompt
   **MAKE THE GAPS EVEN**. Never name or display 137.5.
2. **The 12-seed escalation.** Keep the **same 4 discrete offsets** [90, 120, 137.5, 180]; at 12
   seeds simply **drop the on-screen labels**. No continuous/finer mode — the discovery is "keep
   picking the weird one," and continuous choice would dilute it.
3. **The final constraint.** Adding a point to a circle can only ever **split** one gap, so "without
   making the biggest gap larger" = the last seed's angle must land **inside the current largest
   gap interval (a,b)**. Gate the final Enter: reject an out-of-interval choice **without** calling
   `host.attemptFailed()` (don't burn the 2-fail cooldown on a teaching move). 137.5° always
   bisects the largest gap, so the "weird one" always passes — reinforcing the discovery.
4. **The autonomous bloom.** **BASELINE (ship this):** hand off to the existing **Phyllotaxis**
   exhibit deploy — `deploy: { exhibit: "Phyllotaxis", palette: <int> }`. Zero shell edit, symmetry.js
   untouched, confirmed a real exhibit title at `symmetry.js:545`.
   ⚠ **`deploy.palette` is an INTEGER index** into `PALETTES.all()` (`game.js:88`, `def.deploy.palette | 0`),
   NOT a colour array or name — pick an int, e.g. `palette: 3`.
   **⚑ FLAGGED ENHANCEMENT (needs K.'s explicit sign-off — touches tested game.js):** the bespoke
   "keep planting 40 → ~600 seeds + camera pull-back" signature moment. Requires a new
   `game.deployDraw(ctx, w, h, dt, progress)` hook (game.js:312-337, because `game.draw()` runs
   only in PLAY, never DEPLOY) + a new `web/games/seed-bloom.js` + a new test. Do NOT build this
   without K. saying yes.
5. **`solution()` for the headless suite.** Golden angle is **index 2** in [90, 120, 137.5, 180].
   Emit ↑/↓ to move the cursor to index 2, then `"enter"` ×40; the 40th enter calls `host.solve()`
   synchronously (passes test #8 no-tick and #10 headless).
6. **Interaction with the suck-into-spiral finish (game-dissolve.js).** **Retained, not replaced** —
   the player's seed field is dissolved (suck-into-spiral) INTO the Phyllotaxis exhibit bloom. The
   generic DEPLOY dissolve still runs; the exhibit it forms into is the sunflower.

**New files:** `web/games/seed.js` + one line in `web/games/manifest.js`. Do NOT hand-add a `<script>` tag to `game.html` or `menu.html`: the manifest emits them, and hand-kept copies of that roster are what left the menu loading 5 of 15 games (fixed 2026-09-02, commit `242125d`). The game must also be placed in a `menu-data.js` room — an unplaced game is unreachable from the front door, and `game.test.js` fails on it.

**✅ K. APPROVED all 6 points 2026-09-02 — including the ⚑ #4 enhancement** (bespoke bloom:
keep planting 40 → ~600 seeds + camera pull-back, via a new `game.deployDraw(ctx,w,h,dt,progress)`
hook in game.js + new `web/games/seed-bloom.js` + a new test). Build the full thing, not just the
baseline.

Next action: a crew dev builds `web/games/seed.js` (+ the #4 bloom files) from this spec.

---

## Build guardrails (architect, 2026-09-02)

Audit baseline (architect re-checked the five shipped games first): zero `Math.random` in
`web/games/`; zero `Date.now`/`performance.now`/`setTimeout`/`setInterval`/`requestAnimationFrame`
in any game file (rAF lives only in the `game.js` shell loop, lines 458/460); all six files go
through `Game.register`, which `registry.js:34` validates for shape + duplicate ids. **The contract
is currently unviolated — `seed.js` must not be the first break.**

1. **Determinism.** No bare `Math.random` in `seed.js` or `seed-bloom.js`. All randomness through
   `host.rng(host.seed)`.
2. **Clock.** No `Date.now`, `performance.now`, `setTimeout`, `setInterval`, or
   `requestAnimationFrame` inside a game file. Time comes only from `host.now()` or the `dt` passed
   to `draw()`. The shell owns the loop.
3. **Registration.** `Game.register({ id, title, deploy:{exhibit,palette}, create })`.
   `deploy.palette` is an INTEGER index into `PALETTES.all()` (`game.js:88` does
   `def.deploy.palette | 0`) — not a name or colour array. `exhibit` must be the exact string
   `"Phyllotaxis"` (`symmetry.js:545`).
4. **Blast radius.** `party.js` and `web/viz/symmetry.js` stay untouched. The only sanctioned
   `game.js` edit is the K.-approved `deployDraw(ctx,w,h,dt,progress)` hook: strictly additive, must
   not change existing PLAY or DEPLOY behaviour for the five shipped games, and ships with its own
   test. A dev editing anything else in `game.js` should stop and escalate to the architect.
5. **`solution()`.** Drive the cursor to index 2 of `[90,120,137.5,180]` via up/down, then
   `"enter"` ×40, with the 40th enter calling `host.solve()` synchronously so the no-tick and
   headless tests pass.
6. **Failure semantics.** Rejecting an out-of-interval final placement must NOT call
   `host.attemptFailed()` — it is a teaching move and must not burn the 2-fail cooldown.
7. **Display firewall.** On-screen text stays feeling-words, math, and the Guide. Never render
   `137.5` or any label naming the golden angle — that is the discovery the whole game protects.

**Definition of done:** `seed.js` + `seed-bloom.js` + one `<script>` line in `game.html` + tests for
the `deployDraw` hook and the headless `solution()` path; the existing suite still green; a grep for
`Math.random`/`Date.now`/`performance.now`/timers/rAF across `web/games/` returns nothing.
