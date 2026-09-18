# PARTY WEEKEND — the one place to go

_Central hub. We're working **async** (K. + friend, remote then in-person), so everything —
findings, goals, reaches, decisions — lands here first. If it matters, it's in this file or
linked from it. Started 2026-09-18._

---

## The gig
- **WHITE CAT CALLING** — Meow Party scene set on the **beamer**, autoplay, phone as remote.
- **Friend visits 2026-09-19** as **story collaborator** — their job is the *scene story* (which
  scenes, what order, the arc). Not a spectator. Working mode: **prompt-as-tooling** (Claude drives
  the build live; K. + friend steer).

## North star
Not "pick 8 scenes" — **find the STATES worth living in, and the paths between them.** Deep-House is
ONE organism with a shared state; a scene is just what a state looks like on an exhibit. See
[`STATES.md`](STATES.md) for the 8 states + handles.

---

## GOALS (must-have for the weekend)
- [ ] **Canon player runs on the beamer at stable 60fps** (the hard de-risk — [`GIG-BUILD-ORDER.md`](GIG-BUILD-ORDER.md) step 0). K.'s hardware call.
- [ ] **6–8 scenes handpicked** into the rotation (`web/player.html`, director factories).
- [ ] **Live-recolor palette picker** working — pick a scheme → running scene recolors instantly. Spec: [`PALETTE-PICKER-SPEC.md`](PALETTE-PICKER-SPEC.md).
- [ ] **A story/sequence** written with the friend — `scenes/story.md` is the workspace.
- [ ] **Beamer runbook** — fullscreen + `?autoplay=1`, find-IP/QR remote, hotkeys, single-safe-scene fallback.

## REACHES (stretch — only if the goals land)
- [x] **Live mic beat-sync + mic desk** — the room mic punches the show on each kick, with a standalone
  scope/BPM/parameter desk on the phone. **BUILT 2026-09-18.** Files: `web/mic-sync.js` (engine, on the
  display page) + `web/mic.html` + `web/mic.js` (the desk). See LOG + the mic note below.
- [ ] **Mathematically exact boundaries** — outgoing final equation = incoming first equation;
  no crossfade or rendered-layer overlap.
- [ ] **Gig palette re-grade** — forest-green / cream / pastel-neon.
- [ ] **Custom palette authoring** (beyond the 12-atlas) + per-scene colour memory.
- [ ] **Train clock** as physical loop-tempo body ([`docs/TRAIN-CLOCK.md`](docs/TRAIN-CLOCK.md)) — post-gig hardware.
- [ ] **Pendulum Well** judged live by eye, ported if it earns a slot (`scenes/scene-01-pendulum-well.html`).

---

## CANON DECISIONS (so async work doesn't diverge)
- **Canon player = `web/player.html`** (director-host: one canvas, one loop, mid-frame swap, shared
  Party runtime). Files: `player.js`, `scene-registry.js`, `scene-party-baseline.js`.
- **Scenes are director factories** — `SCENES.register(id, label, factory)`. Adding a scene = one
  factory. Five live now: `party` (baseline), `meowparty`, `treasure-chest`,
  `butterfly-wing-dive`, and `flower-of-life`.
- **PARKED (redundant):** the iframe player `web/meowparty-player.html` + `web/scenes.json`. K. may delete.
- **The butterfly now has an arc:** `treasure-chest` reveals it, then `butterfly-wing-dive`
  stays centred on its heart, discovers the sacred geometry in the overlap, and morphs into two
  counter-spinning lemniscates. Party business continuously drives their breath, spin, overlap,
  colour and echoes. Both are deterministic, seekable director scenes. The original standalone HTML remains a
  candidate single-safe-scene fallback. _Decision pending: keep as fallback or retire._
- **Hard constraint (K.):** stable 60fps ALWAYS. It's all JS; layering kills fps. Only ONE live
  scene loop at any instant. `dispose()` on swap is mandatory (present in `player.js`).

## FINDINGS (from QA, 2026-09-18)
- ✅ All player and scene JavaScript syntax-clean.
- ✅ `dispose()`-on-swap present (the fps-death fix). Per-scene `duration`, 20s default dwell.
- ⚠ **Autoplay is OFF unless `?autoplay=1`** — kiosk URL must include it.
- ✅ Curated autoplay cycles exactly three build scenes: Treasure Chest → Infinity Heart → Flower.
- ✅ No crossfade/snapshot in `player.js`: swaps are intentionally atomic to prevent layer
  distortion. Exact geometry at each boundary remains a tuning requirement.
- ⚠ **Palette-picker gotcha:** set `PARTY.apply({cmd:"auto",value:false})` BEFORE pinning, or auto-mode clobbers the pin on next dwell.

---

## OPEN QUESTIONS
- Standalone butterfly HTML — keep as fallback, or retire now that the factory is canon?
- Which of the 8 states are day-one vs later? (drives which scenes we build first)
- Custom gig palette — author in `palettes.js` SCHEMES, or `PALETTES.generate()`?

---

## DOC INDEX (the scattered pieces this hub points at)
| Doc | What it holds |
|---|---|
| [`GIG-BUILD-ORDER.md`](GIG-BUILD-ORDER.md) | Risk-first build order + progress log |
| [`FRIEND-VISIT-PREP.md`](FRIEND-VISIT-PREP.md) | The visit plan, roles, first move |
| [`STATES.md`](STATES.md) | The 8 playable states + parametric handles |
| [`PALETTE-PICKER-SPEC.md`](PALETTE-PICKER-SPEC.md) | Palette-picker technical spec |
| [`WOW-MOMENTS.md`](WOW-MOMENTS.md) · [`WOW-QUERY-KIT.md`](WOW-QUERY-KIT.md) | The moments to chase / how to find them |
| [`MEOWPARTY-CD-BRIEF.md`](MEOWPARTY-CD-BRIEF.md) | Creative-direction brief |
| [`docs/EXPERIENCE-HIGHLIGHTS.md`](docs/EXPERIENCE-HIGHLIGHTS.md) · [`scenes/story.md`](scenes/story.md) | Highlights / story workspace |

---

## LOG
### 2026-09-18
- Committed all WIP (`b8fc7a1`, 24 files). QA passed headless (see Findings).
- Created this hub.
- Ported the standalone Beating Treasure Chest into the canon director-host and added the generic
  seek/play/tuning contract (`SCENE_CONTROL`) for promptable scenes.
- Added `butterfly-wing-dive`, then corrected its meaning: full butterfly → centred heart dive →
  two overlapping lemniscates. Its story timeline can pause; its Party-driven life keeps moving.
- Added `flower-of-life`: the lemniscates phase-lock, leave circular orbits, and unfold into a
  19-circle breathing field whose motion remains coupled to Party business.
- Set the curated MeowParty autoplay story to exactly three build scenes:
  `treasure-chest → butterfly-wing-dive → flower-of-life`. Party baseline and the older
  MeowParty butterfly remain manually selectable references and do not enter the show cycle.
- Scene boundaries are atomic mid-frame swaps. The rejected snapshot dissolve blended coordinate
  systems and caused layer distortion. Continuity must come from matching equations, scale, phase,
  palette and organism state through `acceptHandoff()`; shared Party business never resets.
- Added the generic timeline slider to the older `meowparty` butterfly too. Its story position
  controls disguise → reveal, while a tunable amount of Party swing keeps that position alive.
- Added `?kiosk=1` background-art mode: all controls, labels, drawers, toasts and the cursor
  disappear. Flower of Life contracts into a central seed before
  the loop returns to the petite Treasure Chest, closing the three-scene cycle.
- Removed the train overlay and all Space/T input from the canon player; the separate clock
  visualization remains separate work.
- Scene-player organism build committed in `ba84535` (the shared worktree folded it into the
  simultaneous mic-desk commit): promptable timelines, three-scene autoplay, Infinity Heart,
  Flower of Life, kiosk mode, state handoff, and atomic mathematical scene boundaries.
- **Mic beat-sync, reworked into a real instrument + standalone desk.** `web/mic-sync.js` (loaded on
  `player.html`/`party.html`/`meowparty.html`) now: FFT bass/mid/high split, a low-latency kick
  detector on the bass band, selectable drive source (full spectrum vs bass-only), a beat "punch"
  into `business`, and a rolling-median **BPM** estimate. It publishes ~20 Hz telemetry and accepts
  live `{type:"miccmd"}` over the existing `/party` relay — no `serve.py` change.
  - New **mic desk**: `web/mic.html` + `web/mic.js` — a phone/laptop remote (thin client, same
    reconnect discipline as `dashboard.js`). Live scope (level + peak-hold, 3-band bars, beat flash),
    big **BPM** readout, device picker (`arm once → names appear`), rescan, and faders for
    gain/depth/floor/attack/release/beat-sens/beat-punch. Captures nothing itself — the display page's
    `mic-sync` is the single source of truth.
  - **Arming is now remote** — no more URL editing. `?mic=1` still auto-arms on load; otherwise the
    desk's **arm** button opens the mic. Latency of the punch is display-side and same-frame; the desk
    only *watches*.
  - **Key gotcha (surfaced in-app now):** `getUserMedia` needs a **secure context** — the display page
    must be `http://localhost:PORT` (or https), NOT the LAN IP, or the mic silently never starts. The
    engine now reports the reason to the desk instead of failing quietly. The **display/player tab** is
    the one that must be granted mic permission; the mic desk never prompts.
  - Relationship to the train clock: this is a **second, audio-driven** tempo/punch source (reactive,
    threshold-based), distinct from the train's self-running master period. Not phase-locked (punches
    on the kick, doesn't predict ahead) — a PLL is a possible future add if we want it to hold tempo
    through a breakdown.
