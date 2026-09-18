# TRAIN CLOCK — the loop is a real toy train

_Creative capture, 2026-09-18 (K.). The physical timekeeper of the piece._

> **MOVED 2026-09-18 → its own dedicated flow tab.** The train no longer draws on the show; it lives
> on `web/flow.html`, owns the master clock, and drives `player.html` over the `/party` relay. `T`
> hides the view (clock keeps running), `H` holds the whole show (phase kept, no reset). Full spec +
> the source quotes behind the decision: `docs/PARTY-WEEKEND.md`.

> **The engraving train BUILT 2026-09-18** — `web/train-clock.js`, loaded in `web/player.html`.
> A single bright point loops a closed Lissajous path over the whole field and **engraves its
> trail** — a self-contained pocket universe (the story train). **It runs itself on load — no
> tapping.** Its lap IS the clock: one loop sets the master period (`config.bpm`), so the
> single-tempo spine breathes every spiral + lamp state off it (a longer lap slows the whole
> organism in lockstep). A gentle speed surge near the turns gives the _chugga_. Slow by
> default — a **24 s lap** (~16 bpm), the room's crawling heartbeat. Controls: **t** toggles the
> whole tempo train **on/off** (it's our clock — off wipes the engraving and holds the last
> tempo); **SPACE SPACE** optionally sets the lap length by hand. Each lap fires a window
> `trainlap` event for a future BANG-on-pass, and it
> listens on `/party/sub` for `{"type":"lap"}` so reed-switch hardware is plug-and-play, zero
> code change. Watch it at `http://127.0.0.1:8800/player.html`.
>
> _Superseded the tap-only stub (K.: a perpetuum mobile shouldn't make you tap space)._

## The idea (K.'s words, sharpened)

A real toy train runs a loop on a plateau/table **in the room** — not on screen, not a
metaphor. A physical object doing laps. The train is **passenger _and_ driver**: it carries
a rider *and* it sets the pace. **Its lap time IS the loop tempo** — the master clock the whole
projection breathes to. **Extend the track → longer lap → the whole piece slows, in lockstep.**
Shorten it → it quickens. The tempo control becomes a physical thing you rearrange in the room.

## The soul — a self-interacting clock (K., 2026-09-18)

The "interactive" requirement was always a bit imaginary — it doesn't need a person poking it.
**It interacts with itself.** The train is a **pendulum clock**: _chugga chugga chugga_ is the
tick of an escapement, and everything in the room is **constantly pulling on each other** — the
harmonograph's coupled pendulums, the chaos↔symmetry swing, the lamp states, the train. Set it
going and it feeds itself: **a perpetuum mobile.** That closed loop of mutual pull IS the
interactivity; a human just leans on a system that was never going to stop moving.

**Implication for the build.** What's shipped is a **one-way** clock (train → tempo →
everything), which is the minimal, stable version. The soul above points one step further:
**mutual coupling** — the room pulls back on the train a hair, the swing and the train entrain
toward each other — so the motion sustains itself rather than being dictated. That's where
"alive" and "unstable" live next door, and it fights _less-is-more / save-FPS_ if overbuilt, so
the minimal form is a **single gentle feedback term**, not a physics engine. Parked as a
deliberate fork, not done fast.

## Why it fits — it's not a bolt-on, it's the missing body of a clock we already have

- The engine already runs on **one master tempo**: `party-main.js` scales the director's `dt` by
  `PARTY.tempo()`, so every shape, the lamp rates and the chaos↔symmetry swing all slow and quicken
  **together** ("one organism, one breath"). The train just becomes the **source** of that tempo.
- It's the literal, physical embodiment of the **ebb-and-flow / loop-reloop** K. keeps chasing —
  the swell that recedes and returns, now a train you watch come round again.
- Chaos→symmetry thesis: a steady loop is the **symmetry anchor**; the room can churn against a
  rhythm that's visibly, reliably keeping time in the corner.

## The mechanism (small, because the tap infra already exists)

1. **Magnet on the train + a reed switch** at one point on the track → one clean pulse per lap.
   (Reed+magnet = cheapest, most reliable. Alt: hall sensor / IR beam-break.)
2. Pulse → **microcontroller** (ESP32 / RPi Pico — cheap, K. already price-watching) → serial or
   websocket → `controller/serve.py`.
3. serve.py emits each lap as a **tap** on the party channel. The engine ALREADY has tap-tempo
   (the `T` key) and `PARTY.tempo()` — **a lap pulse is just an external tap.** Two laps = a period
   = tempo. That's the whole wire.
4. **Extend track = longer measured period = slower tempo, automatically, no config.**

**Software hook now (tiny, optional):** add an external-tap endpoint to serve.py so the train is
plug-and-play the moment the hardware arrives — even before there's a train.

## Passenger + driver (the physical layer)

The rider can be **the cat** — a little figure on the train, so the same cat that scoots the spiral
on screen literally scoots the room. Bigger move: a sensor pass could also **trigger a beat/BANG on
screen as the train reaches the "front,"** so the train's *position* maps to a moment in the loop,
not just its speed. Then the on-screen loop and the physical loop are the same loop.

## Placement

- **Gig this week:** almost certainly NOT — it's hardware, needs the train + sensor + a wiring
  dry-run, and DIRECTION is beamer-standalone. Post-gig, unless the parts are already on hand.
- **Post-gig build:** sensor + mount + rider-cat + position-triggered beats. Reuses the existing
  tempo spine, so it's a small, high-payoff first hardware step.

## ⚠ Known item for the HARDWARE phase (not tonight)

**Suppress the self-run while real laps arrive.** The sim `start()` runs a `setInterval`;
once real `{type:"lap"}` pulses arrive, each also calls `tap()→start()`, so the sim interval
keeps firing *phantom* laps between the real ones. Tempo is self-correcting (harmless for bpm),
but the `trainlap` event double-fires — which a **BANG-on-pass would fire on phantom laps.**
Fix when wiring the reed switch: hardware laps ARE the beat, so stop the interval and drive
`lap()` only from the real pulses. File this with the BANG/position work. (Caught in review,
2026-09-18.)

## Open questions for K.

- One sensor (lap = tempo), or several around the loop (position = phase of the visual loop)?
- Does the pass **trigger events** (a BANG at the front) or only **set tempo**?
- Who rides — the cat? Is the rider the star, or is the train itself the star the audience watches?
