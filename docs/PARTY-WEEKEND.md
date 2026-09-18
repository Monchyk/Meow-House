# PARTY WEEKEND — scene player + train clock (the working doc)

_The MD for this weekend (2026-09-18). Scene player + train clock, extracted and pinned so it
stops pivoting. When a session starts re-deciding the player architecture or "what the train is,"
read this first — the answers are already built and shipped. The drift was **semantic, not
structural.**_

---

## TL;DR — nothing needs rebuilding

Two things exist, work, and are correct. They just weren't written down in one place, so
every session re-derived (or re-argued) them and pivoted.

1. **The scene player** = a single **director-host** that swaps scenes live on one canvas.
   Canon files: `web/player.html` + `web/player.js` + `web/scene-registry.js` +
   `web/scene-party-baseline.js`. (The iframe player `meowparty-player.html` + `scenes.json`
   is the **parked wrong turn** — redundant, may be deleted.)
2. **The train** = the **loop / tempo / pacing spine**, not a decoration. Its lap **is** the
   master period. It now lives on its **own dedicated, toggleable flow tab** (`web/flow.html`) — a
   way to *see* the rhythm and tempo — which owns the clock and broadcasts it to the show; the show
   just follows. **BUILT 2026-09-18.** Canon files: `web/flow.html` (the tab) + `web/train-clock.js`
   (engine + render + a pluggable `sink`) + `web/party-main.js` (the show, now a follower) +
   `docs/TRAIN-CLOCK.md`. (See "the dedicated flow tab" in Part 2.)

---

## PART 1 — THE SCENE PLAYER

### What it is
A **host that swaps directors**. `party-main.js` only ever does `new AmbientDirector(canvas, opts)`
once, then calls `director.draw(dt)` / `director.pop(a)` and sets `director.zoom` / `.substrate`.
`player.js` installs a `SceneHost` **as** `AmbientDirector`: it builds the selected scene's real
director *inside itself* and forwards that tiny surface. **Swapping a scene = rebuild the inner
director from another registered factory.** No reload, no re-boot — `party-main.js` can't tell.

One canvas, one animation loop at any instant. This is the hard-60fps answer (layering two live
loops kills fps — that's why the iframe version was parked).

### The registry contract (`scene-registry.js`)
A scene announces itself once, at load:
```js
SCENES.register(id, label, factory, opts);
//   factory: function(canvas, opts) -> director instance
//   director must expose: draw(dt), pop(amount), and mutable props zoom, substrate
//   opts.duration (optional): autoplay dwell in seconds for THIS scene
```
- First registration wins (idempotent).
- **Adding a scene = one `register()` line** in a scene module, loaded in `player.html`
  *after* `scene-registry.js` and *before* `player.js`.

Load order (non-negotiable): `scene-registry.js` → scene modules → `player.js` → `party-main.js`.

### The agentic control surface — `window.SCENE_CONTROL`  ← THIS is "change params & play scenes"
Already exposed by `player.js`. This is the hook for driving the show programmatically /
agentically. It was undocumented, which is why it keeps getting reinvented:
```js
SCENE_CONTROL.scene()            // -> current scene id
SCENE_CONTROL.seek(seconds)      // jump the active scene's timeline
SCENE_CONTROL.play()             // resume
SCENE_CONTROL.pause()            // hold
SCENE_CONTROL.set(key, value)    // set one tunable param on the active director
SCENE_CONTROL.state()            // serialize the active scene (params + time)
SCENE_CONTROL.restore(state)     // restore a serialized scene
```
Each call forwards to the inner director iff it implements the matching method
(`seek` / `setPlaying` / `setControl` / `serialize` / `restore`). Scenes that don't implement a
method simply no-op — safe to call blind.

**"Take scenes and play them in hand"** = pick by id (`load`/pills/number keys), drive params via
`SCENE_CONTROL.set()`, snapshot with `.state()`, replay with `.restore()`.

### Promptable / tunable scenes (the on-screen tuning panel)
A director opts in to the transport + tuning UI by implementing:
`seek`, `getDuration`, `getTime`, `isPlaying`, `setPlaying`, and `getControls()` returning
`[{ key, label, min, max, step }]` plus `getControlValue(key)` / `setControl(key, value)`.
When present, `#scene-controls` (timeline scrubber + play/restart + a "tune" drawer of sliders)
binds automatically. Scenes without it leave that surface hidden. **Same schema an agent reads
via `getControls()` to know which params exist.**

### Autoplay
- Off unless `?autoplay=1`. **Dwell is not tempo** — just how long each scene holds before the
  next (per-scene `duration`, else `DEFAULT_DWELL = 20s`; override with `?dwell=N`).
- One scene registered → cycling is skipped (would dispose+rebuild the same scene for nothing).

### Keys / URL
| Key | Action |
|---|---|
| `[` / `]` | previous / next scene |
| `1`..`9` | jump to scene N |
| `a` | toggle autoplay |
| (pills, bottom-left) | click to load; click "▶ auto" to toggle autoplay |

URL params: `?scene=<id>` (deep-link a scene), `?autoplay=1`, `?dwell=<seconds>`.
The active scene id is written back to the URL on every swap (`replaceState`).

### The dispose() rule (fps survival)
On every swap, the host calls `inner.dispose()` if present, **before** replacing the director.
A ported standalone study that owns its own `rAF`/timers/listeners **must** implement `dispose()`
to release them — otherwise its loop orphans on each swap and fps collapses over a long night.
Scenes with no self-driven loop need no `dispose()`.

---

## PART 2 — THE TRAIN CLOCK (the loop / tempo / pacing)

### The semantic that keeps getting mangled — fixed here
The train is **the loop.** Its lap time **is** the master period of the whole piece. Read this
plainly: *the train is a tempo/flow indicator that also happens to be drawn on screen.* The
on-screen glowing point is the **optional visualization** of that flow — "oh, this is the flow,
this is the pace." It is **not** a literal toy-train prop and it is **not** decoration you bolt on.

- Every time the point completes its loop = **one full loop of everything.** That sets the
  **scale, the time, and the pacing** of the whole room.
- Extend the lap → the whole organism slows, in lockstep. Shorten it → it quickens.
- `T` toggles the on-screen train **on/off**. Off = the visual disappears and the room **holds its
  last tempo** (the flow persists; you just stopped drawing the indicator). This is the "extra tab
  that sets the tempo/pace" you described — the visual is expendable, the pacing role is not.

### How it actually wires (already true, in code)
`train-clock.js`:
- Self-runs on load (`running: true`) — no tapping. A single bright point rides a closed
  **Lissajous** path over the whole field and engraves a fading trail (a self-contained pocket
  universe / "story train"). Slow by design: **24 s lap ≈ 16 bpm**, the room's crawling heartbeat.
- `setPeriod(lap)` → `PARTY.config.bpm = bpmFor(lap)`. `party-main.js` scales every director's
  `dt` by `PARTY.tempo()`, so **every spiral, lamp state, and the chaos↔symmetry swing breathe off
  this one number** ("one organism, one breath"). The train is the **source** of that tempo.
- A gentle speed surge near the turns gives the *chugga* (pull–ease–pull). Cosmetic only; tempo is
  the lap.
- Each lap fires a `window` `"trainlap"` event (hook for a future BANG-on-pass).

### Controls
| Input | Action |
|---|---|
| `T` | toggle the tempo train on/off (off wipes the engraving, holds last tempo) |
| `SPACE SPACE` | optional — two taps set the lap length by hand (chug faster/slower) |
| badge (bottom-right `◉ train`) | whispers whether the heartbeat is running |

### Hardware plug-and-play (post-gig, already stubbed)
A lap `POST {"type":"lap"}` to `/party/pub` is heard on `/party/sub` (EventSource) and drives
`tap()` — so a reed-switch + magnet on a real track is **zero code change**. Real train's lap =
external tap = tempo. Extend the physical track → longer measured lap → slower whole, no config.

> ⚠ **Known hardware-phase item** (from `TRAIN-CLOCK.md`): the sim `setInterval` self-run keeps
> firing *phantom* laps between real pulses. Harmless for bpm (self-correcting), but a
> BANG-on-pass would double-fire. When wiring the reed switch: stop the sim interval, drive `lap()`
> only from real pulses.

### The "dedicated page/tab" question — DECIDED + BUILT: dedicated flow tab (K., 2026-09-18)
> **BUILT 2026-09-18.** `web/flow.html` is live: open it on a second screen; it owns the clock and
> drives `player.html` over the `/party` relay. Kept as ONE file `train-clock.js` with a pluggable
> `sink` (not a physical engine/render split — the sink is the seam). Relay fan-out verified
> end-to-end (tempo/hold/resume reach a subscriber in order; `/party/stat` preflight works).
> Live eyes-on the beamer + a real second screen is the only check left — K.'s call.

The train is **no longer an overlay on the show.** It becomes its own page — a **dedicated flow tab**
you open on a second screen / phone / corner monitor: it shows the train doing its lap, big and
legible — *"this is the flow, this is the pace."* It's **a way to SEE the rhythm and tempo** at a
glance, and it's **toggleable** — pull it up when you want to read the pace, hide it when you don't
(the flow keeps running underneath either way). It **owns the master clock and broadcasts it**;
`player.html` (the beamer show) just **follows**. The tempo mechanism is unchanged; only *where the
train is drawn and how the number travels* changes. This also protects the beamer's hard-60 — one
live loop on the show, the train's loop lives on the other screen.

**Build spec — `web/flow.html` (new) + a small split of `train-clock.js`:**

1. **Split `train-clock.js` into engine + render.**
   - *Engine* (phase, `lap()`, `period ↔ bpm`, `setPeriod`, tap) — pure, no canvas.
   - *Render + transport* (the Lissajous point, the fading trail, `T`, `SPACE SPACE`) — used **only**
     by the flow tab now.
2. **`flow.html` = the flow tab.** Runs the engine + render full-page. Self-runs on load
   (perpetuum mobile). Shows: the looping train, a big **lap → bpm** readout, and a visible
   **loop-progress** so the room reads the *phase* ("we're here in the loop").

   **Two separate actions — do NOT conflate them (this is where it drifts):**
   - **`T` = hide the view.** Just the visual goes; the clock **keeps running and keeps
     broadcasting.** The room's flow is unaffected — you've only stopped *looking* at it. This is
     the "toggle it, a good way to see rhythm and tempo" move.
   - **Pause / hold = hold the train.** Because the train IS the master clock, **holding the train
     holds the whole show** — everything freezes on its current phase. Critically it **HOLDS, it
     does not reload/restart** (K.: "it doesn't load though" — same anti-reset rule as § D). Resume
     picks up exactly where it was held. Broadcast `{ "type":"hold" }` / `{ "type":"resume" }` (or
     simply stop sending advancing tempo) so followers freeze with it.

   **When held, all the information is there** (the "hold the train and read it" panel):
   - **loops done** — a running **lap counter** (how many full loops it's completed).
   - **lap → bpm** — the current period and its tempo.
   - **spread** — the one big parameter: **"how much time do you want to spread this loop over"** =
     the lap length, framed as *spread/duration* not a raw bpm number. Drag it (or `SPACE SPACE`)
     to stretch or compress the whole loop; broadcast on change.
   - **phase** — where in the loop we are right now.
3. **Broadcast tempo over the relay that already exists.** On each lap and on any lap-length change,
   the flow tab **POSTs `/party/pub`**: `{ "type": "tempo", "bpm": <n> }` (and `{ "type":"lap" }`
   for a future BANG-on-pass). No new server code — `controller/serve.py` already relays pub→sub.
4. **`player.html` becomes a pure follower.** It already opens an `EventSource("/party/sub")` in
   `train-clock.js`; keep only that listener, extend it to accept `{type:"tempo",bpm}` →
   `PARTY.config.bpm = bpm`, `{type:"hold"}` → freeze (`PARTY.tempo()`→0 / pause the director),
   `{type:"resume"}` → continue from the held phase (**no reload**), and **remove the `#train-layer`
   overlay + self-run from the show.** No tempo feed → the show **holds its last bpm** (matches "off
   holds last tempo").
5. **Static fallback (no relay):** when served by a plain static server, fall back to a same-origin
   **`BroadcastChannel`** so `flow.html` + `player.html` on one machine still sync (neon-cat already
   uses this pattern — see its README "renderer + phone dashboard").

**Net:** `flow.html` is the tempo source and the "flow" view; `player.html` is the show and a
follower. Same one clock, now on its own tab, exactly as asked. The hardware reed-switch path
(§ above) plugs into the **flow tab** instead of the show — `{type:"lap"}` still just works.

> **Open sub-choices for the builder (don't silently pick):** (a) does the show keep a *tiny* corner
> phase indicator, or nothing at all? (b) is `flow.html` also the place the physical train's sensor
> reports to, or does that stay on `serve.py` only? Neither blocks the build; flag at the seam.

---

## Why this kept pivoting (so it stops)
1. **Two players existed** — the parked iframe kiosk (`meowparty-player.html`) vs. the canon
   director-host (`player.html`). Sessions kept re-litigating which is real. **Canon = director-host.**
2. **The train's semantic was never written down** — so each session re-guessed "literal prop?
   decoration? tempo?" It is: **the loop/tempo spine, optionally visualized, `T`-toggleable.**
3. **`SCENE_CONTROL` was undocumented** — so "agentically change params" read as unbuilt. It's built.

## Files (canon)
- `web/player.html` — the player page (stage canvas, toasts, picker, controls, train badge, load order)
- `web/player.js` — the SceneHost swap engine + `SCENE_CONTROL` + autoplay + tuning UI
- `web/scene-registry.js` — the `SCENES.register()` contract
- `web/scene-party-baseline.js`, `web/meowparty-scene.js`, `web/scene-treasure-chest.js` — scene modules
- `web/train-clock.js` — the tempo/loop spine
- `docs/TRAIN-CLOCK.md` — the creative capture (the "soul": self-interacting clock, perpetuum mobile)
- `GIG-BUILD-ORDER.md` — the RECONCILIATION note where director-host was declared canon

## Run it
`python controller/serve.py` → `http://127.0.0.1:8800/player.html`
(one scene plays; cycling starts once the registry has 2+ and autoplay is on).

---

## K.'S WORDS — the source quotes (mined from the Meow House + neon-cat sessions)
_Verbatim (voice-transcribed), lightly de-ummed, cited by date · session. This is the intent the
build must not drift from — read these when a decision "feels" open; K. already said it._

### A · What a "scene" is, and why a player at all  (the origin)
> "There's a storytelling we're gonna do… we're blending our spirals together to create a story…
> like the different scenes. **The scene player is something we're gonna make** … right now we're
> writing the storybook — writing down how some of the spirals interact and consider them **scenes**.
> Make a folder `scenes`, put some **one-shot HTML pages in there with controls for the scenes.**
> This is where we're going to start."  — _meow · 2026-09-17_

→ A scene = a saved spiral/organism combination with controls. The player exists to string those
scenes into a story. This is the whole mandate; everything below serves it.

### B · The train = the tempo / scale, and it TOGGLES  (the North Star)
> "If I were to say to you, **develop the North Star, the toy train** — how's that gonna look?"
> — _meow · 2026-09-18_

> "It gives the timing to everything but **this is our scale.** It'd be interesting to have this as
> a **toggleable feature on or off, because this is our tempo train** — I think we should **slow this
> down by a lot more.**"  — _meow · 2026-09-18_

→ Confirms every canon claim in Part 2: train = master scale/tempo, `T`-toggleable, slow by design
(→ the 24 s / ~16 bpm default). Not decoration.

### C · "Interactive" was imaginary — it interacts with ITSELF  (the perpetuum mobile)
> "The string was somewhat imaginary… it was embedded in the rules that it needs to be interactive,
> but **it interacts with itself** — we have a **pendulum clock that is the train**, chugga chugga
> chugga, everything is constantly pulling on each other, **there's a perpetuum mobile in there.**"
> — _meow · 2026-09-18_

→ This is why "make it interactive" kept mis-landing as a literal poke-able prop. The interactivity
is the *closed loop of mutual pull*, not a person tapping. (See `TRAIN-CLOCK.md` "the soul.")

### D · The loop must EBB AND FLOW — not hard-reset  (the closing loop)
> "It still has that **reset thing where it just always restarts the loop.** What we had at the party
> setup wasn't like that. I'm letting the party setup **describe its ebb-and-flow magic** to you."
> — _neon · 2026-09-12_

> "When the cat spins inwards, that's when we **zoom in**; spins outwards, we **zoom out** — that's
> the **push and pull.** We pull that in from the **party dashboard, it has a really nice clock to it.**"
> — _neon · 2026-09-16_

→ "Every train lap = the full loop" must read as a swell that recedes and returns, not a hard cut on
wrap. The train's *position* (not just its speed) is meant to map to the phase of the visual loop.

### E · The agentic control surface — presets, swap, sliders, "try whatever"
> "A few spirals and then an organism at certain settings — I already **saved it as a preset** …
> the business zoom and attraction mechanics, it keeps going a bit **back and forth.**"
> — _neon · 2026-09-15_

> "Make it so we can **swap them out** — reset one, reset two — where we can just **choose** … give me
> the working engine and the place to just drop them in … **make it so I can just try whatever.**"
> — _neon · 2026-09-15_

> "I'm still **missing some sliders and the dashboard.** Is that already built, or set in state and
> **waiting execution**?"  — _neon · 2026-09-15_

> "Since it's **mostly agentic** and lots of local generation on my rig…"  — _neon · 2026-09-13_

→ This is exactly `SCENE_CONTROL` + `getControls()` + the tuning drawer (Part 1). "Saved preset",
"choose", "swap", "sliders", "try whatever", "agentic" = a named, serializable param set the player
(or an agent) loads, tweaks, snapshots. Built. Just wasn't labelled as the thing he was asking for.

### The through-line
Story of scenes (A) → paced by one master clock that is the train (B) → whose interactivity is
self-sustaining, not poked (C) → looping as ebb-and-flow, not a reset (D) → each scene a saved,
swappable, slider-tunable preset (E). Every one of these already has a home in the code above.
