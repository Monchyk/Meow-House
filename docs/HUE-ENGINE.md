# The Hue Engine — the probability organ

The Hue Dimmer Switch has four real buttons: **Power**, **▲ (Bright-Up)**,
**▼ (Bright-Down)**, and the **Hue** button at the bottom. This doc is about that
bottom button — the one people instinctively spam. Philips accidentally made it
the most inviting button on the remote, and DEEP HOUSE leans all the way in.

## The core idea

The Hue button does **not** dispense secrets and is **not** a slot machine. Every
press **stirs the organism**. Internally it raises a hidden `attention` accumulator
that **decays** when you stop. Higher attention quietly **re-weights rare events** —
it changes *probability*, never announces itself.

> The reward is that the world gets **stranger**, not that you won a prize.

No jackpots — deliberately. Jackpots train a spam-to-win mindset ("I'll mash until I
hit it"). Probability-drift keeps the button exploratory: you press it because you're
curious how the house will respond next, and the house becomes **more opinionated**
the more you engage.

## What a press can do

| Outcome | When | What the player sees |
|---|---|---|
| **micro** | ~always | a quick bloom on the stage (brighter when the spot is "warm"), a breath of dopamine into the endocrine lights, a little novelty/curiosity |
| **slip** | rare — odds scale with `attention² × warmth` and repeated presses on a warm spot | a **reality slip**: something on screen is quietly, briefly *wrong* (a glyph jitters; the extension point is where a changed date / a smiling picture goes). Nobody is told. A slip also *settles* the system (attention drops), so it self-paces. |
| **poke** | only at high sustained rapport (`attention > 0.7`) | the **house pokes back** unbidden — a heavier chromatic glitch, and internally `lightingStability↓ entropy↑` so the lamps flicker on their own. Interaction becomes two-way. |

## Warmer / colder (why some secrets take many runs)

`HOUSE.hue.warmth(spot)` is a hidden 0..1 field. It is **seeded per run** and **drifts
slowly over the session** (`sin(hash(spot) + t·0.03)`). Warm = "something is near";
repeated presses on a warm spot **escalate** subtle → unmistakable. Cold spots just
shrug (odds sit at the ~0.8% floor).

Because the seed changes each run and the field drifts, **a cold spot today runs warm
tomorrow.** That is the entire mechanism behind "some secrets take quite a few more
runs to find" — no per-secret counters, no unlock flags. `brain.js` tells the engine
"where" the player is via `setContext(spotKey)` (room + exhibit + beat), so the field
has a location to drift around.

## Where the code lives

- **`web/house.js` → `HOUSE.hue`** — owns all hidden state: `attention`, the per-run
  `_seed`, the current `_spot`, `_spotPresses`, `_pokeCd`. Methods: `setContext`,
  `warmth`, `decay` (called every frame from `brain.js`), `press` (returns the
  outcome). Pure logic — never touches the DOM, never throws when Hue is offline.
- **`web/brain.js` → `huePress()` / `realitySlip()`** — dress the outcome up on
  screen. `hueSpotKey()` builds the location key. `huePress` adds the `.hue-pop`
  bloom (brightness scaled by `--hue-warm`); slips/pokes add the `.hue-slip` glitch.
  **`realitySlip()` is the extension point** for richer per-room slips.
- **`web/style.css`** — `.hue-pop` / `.hue-slip` keyframes (+ `prefers-reduced-motion`
  opt-out).

## Firewall (non-negotiable)

`realitySlip()` only mutates **passive surface text** (hints/title), self-reverting.
It must **never** touch private source material. Slips make the *house's* surface
strange — they never expose anything real about anyone.

## Wiring the physical button

Keyboard already works: **H** or **5** = the Hue press. On the physical Dimmer, map
the bottom **Hue** button to the action string `"hue"` in `controller/listen.py`'s
`BUTTON_MAP` (the relay forwards any `action`, so no other code changes). Suggested
full Dimmer mapping: **▲**→`up`, **▼**→`down`, **Power**→`select` (toggle/commit),
**Hue**→`hue`.

## Tuning knobs (all in `HOUSE.hue.press` / `decay`)

- attention gain per press: `+0.06`; decay: `−0.035/s` (≈ 23s to fully forget from full).
- slip floor: `0.008` (the "99% micro" number); warm-spot ceiling climbs via
  `attention²·0.18·warmth + min(spotPresses,12)·0.004·warmth`.
- poke gate: `attention > 0.7`, 20% roll, 6s cooldown.
- Raise the drift rate (`t·0.03` in `warmth`) to make warm/cold zones move faster
  between runs.

## Not yet built (Phase B remainder)

The other three Dimmer buttons' deeper semantics — **▲/▼ = emotional arousal** along
the PAD map, **Power = the live mask toggle** — plus the **"how are you arriving
today?"** opening and **visitor profiling** layer. Direction is resolved in
**`ROADMAP.md`** (repo root — "Step 2: Phase B remainder", including the design razor
and the build order); the Hue engine shipped first because it's self-contained and
carries zero firewall risk.
