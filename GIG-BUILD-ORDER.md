# GIG BUILD ORDER — WHITE CAT CALLING (beamer, <24h)

_Meow Party scene set. Gig-critical, risk-first. Written 2026-09-18, night before._

**The deliverable:** `meowparty.html` cycling **6–8 handpicked scenes** on the beamer,
autoplay, phone dashboard as remote. Scene 1 = the butterfly-out-of-the-box
(`scene-01-icosahedron-butterfly.html`) — already beautiful, already a scene.

**The insight (K.):** what we have is pretty; the work is *handpicking combinations* and
*untangling* the existing engines into named scenes — same move for the spirals visually.

---

## 0. TRIAL TONIGHT (K., before sleep) — the only hard de-risk
Run **one** scene fullscreen on the **actual beamer laptop** at 60fps:
`python controller/serve.py` → `http://127.0.0.1:8800/scenes/scene-01-icosahedron-butterfly.html` → F11.
If the beamer can't drive it, nothing else matters — flag it and everything below re-plans around fps.

## 1. SCENE PLAYER / AUTOPLAY ENGINE  ← the missing gig-critical piece (mostly non-taste)
A surface that cycles a **registry** of scenes: load director → hold for per-scene duration →
crossfade to next; manual ◀ ▶, autoplay toggle, keyboard + phone-remote hooks. Reuses
`party-main.js` unchanged (scenes inherit real Party runtime). Build against scene-01 + stubs;
headless-verify it parses and loops. **This is THE build — the rest is filling it.**

## 2. SCENE REGISTRY + CANDIDATE CATALOG (non-taste)
Define a scene = `{ id, director, params, duration, transition }`. Untangle what already exists
(`web/experiments.html`, `web/spirals.html`, the scene studies, Pendulum Well) into a ranked
**shortlist of 8–12 pretty combinations with their exact configs** → K. handpicks 6–8 in the AM.

## 3. FILL THE 6–8 SCENES (taste — K.'s morning eyes)
Each scene = a handpicked param combination. Scene 1 = butterfly-box. Approve/tweak from the
catalog; drop the misses. This is the taste-gated part that waits for K.

## 4. SCENE-TO-SCENE TRANSITIONS ("untangle the spirals visually")
Crossfade/morph between directors on the shared Party swing so the set reads as one story,
not a slideshow. The butterfly-box burst is the model beat.

## 5. BEAMER RUNBOOK + PHONE REMOTE
Fullscreen + autoplay start, find-IP + QR launcher, hotkeys, and a **single-safe-scene fallback**
if the cycle misbehaves live. (Runbook doc — non-taste, can be pre-written.)

## 6. RE-GRADE TO GIG PALETTE (polish)
Forest-green / cream / pastel-neon per DIRECTION. Last, only if time.

---

## Overnight autonomous cycle can safely do: **1, 2, 5** (build + verify headlessly, no taste gate).
## K.'s morning, in order: **0 (tonight) → 3 → 4 → 6**, driving the player built overnight.

**First action tomorrow AM:** open the scene-player the overnight run built, load the candidate
catalog, and start handpicking scenes into the registry.

---

## PROGRESS LOG

### 2026-09-18 (night, tandem w/ K.)
- **DECISION: Option A** — iframe kiosk player (reuse scenes as-is, no refactor). Option B
  (single-canvas directors on Party runtime) = post-gig.
- **HARD CONSTRAINT (K.): stable 60fps always.** It's all JS; layering kills fps. So the
  crossfade is a **SNAPSHOT-CROSSFADE — only ONE live scene loop at any instant.** Freeze
  outgoing to a still (canvas snapshot) → navigate the single iframe (old rAF dies) → fade the
  still away over the live incoming. Never two animation loops.
- **BUILT — step 1 (scene player):** `web/meowparty-player.html` + `web/scenes.json` registry.
  - One iframe + snapshot overlay; kiosk CSS injected same-origin to hide each scene's own controls
    (scene pages untouched). Autoplay (per-scene `duration`), ← / → / Space / tap nav, **P** pause,
    **F** fullscreen, **I** fps HUD, **C** cursor. Remote-ready (defensive `/party/sub` listener).
  - Registry seeded with scene-01 (butterfly, `duration: 42`). **Adding a scene = one line.**
  - VERIFIED headless: `scenes.json` parses; inline player JS passes `node --check`. Live 60fps +
    look = K.'s eyes.
- **RUN IT:** `python controller/serve.py` → `http://127.0.0.1:8800/meowparty-player.html`
  (F = fullscreen, I = fps HUD to confirm 60). Right now it plays the one scene; it starts cycling
  as soon as the registry has 2+.
- **NEW PIECE captured:** `docs/TRAIN-CLOCK.md` — a real toy train as the physical loop-tempo clock
  (lap = tap on the existing `PARTY.tempo()` spine; extend track = slower loop). Post-gig hardware.

### RECONCILIATION (2026-09-18, later) — CANON DECIDED
- **The executor chat (`meow-house-9b`) is canon.** Its **director-host** player is the real surface:
  `web/player.html` + `player.js` + `scene-registry.js` + `scene-party-baseline.js`. One canvas,
  one loop, mid-frame swap, shares the Party runtime — the right answer for the hard-60 rule.
- **My iframe player (`meowparty-player.html` + `scenes.json`) is PARKED** (redundant; K. may delete).
- **This session's role = QUALITY ADVISOR**, not builder. Review sent to the executor; punch-list:
  (1) `dispose()` on swap or ported studies orphan their rAF → fps death, (2) autoplay+duration,
  (3) seam-free transition (snapshot-crossfade offered), (4) porting.
- **Pendulum Well: RECONSIDERED (2026-09-18).** "AI-generated" is not a reason to drop a scene —
  K. called this out and he's right; judge on merit. And the merit is real: a four-pendulum
  harmonograph inside a Doyle circle-packing **gravity well**, ORIGIN→DEVELOPMENT→EXTREME→RETURN,
  "attraction becoming inevitability… briefly reads as a single thinking mechanism, then releases,"
  and its best find — moderate chaos AND symmetry together = a strained, almost-locked pendulum
  "more alive than either endpoint." That IS the chaos↔symmetry thesis, with depth and no tunnel
  mesh. **Back in the candidate pool** — judge by eye in the live session, on the idea, not its birth.
  (Lives at repo-root `scenes/scene-01-pendulum-well.html`; copy into `web/scenes/` to run it.)

### NEXT (whenever, not tonight)
- Scenes come from the **director-host** (register() factories), not the parked iframe registry.
- The butterfly is already a director scene ("meowparty"); more scenes = handpick pretty presets and
  port them as factories — taste-gated, K.'s eyes, tomorrow.
