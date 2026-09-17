# PARTY INSTALLATION — architect handoff brief

> **For Fable.** Pre-compressed. Everything below is grounded in the actual code
> (Deep-House `web/`, and the **`party-effects`** branch of the C# `Hue program`
> repo) — file paths and excerpts are real, checked 2026-07-23. Four prior
> hand-written light docs were wrong; this one quotes source. If a fact here
> looks off, the code changed — re-check, don't assume.
>
> **What we need from you:** the six architectural calls in §6, then a phased
> plan. Not effects design (that's triaged in §5), not the interaction model
> (that's pinned in §2). The one call K. already delegates to you explicitly is
> **Q1 — where the engine lives.**

---

## 1. The piece in one paragraph

A **party sibling** of Deep House: same DNA (one organism, one shared decaying
state, feelings carried by light + math + music, never by prose). Two surfaces —
a **screen spiral** (`web/viz`) and the **physical Hue lamps** (C# app) — driven
by one brain. It is **always decaying toward stillness**; left alone ~30–60 min
it winds down and dies. People push back against the decay with the Hue remote.
**Atmospheric, not a carnival** — almost everything slow and steady; rare, subtle
flair; the decay + attention-pull systems are the only sanctioned motion spikes.

---

## 2. Interaction model — PINNED with K. (do not reopen)

**Remote = the 4-button Hue dimmer** (Power, Bright↑, Bright↓, Hue), each with
short-press + long-hold = 8 signals. `controller/listen.py` already reads
short_release vs long_press and relays to the web layer.

**Two modes, toggled by Power-short. The mode names the thing you sculpt:**

| Gesture | **Spiral mode** (default) | **Light mode** |
|---|---|---|
| Power short | → toggle to Light mode | → toggle to Spiral mode |
| Bright ↑ hold | spin engine **up** | dial **business/vividness/warmth ↑** |
| Bright ↓ hold | spin engine **down** | dial business/vividness/warmth ↓ |
| Hue short | cycle through spirals | cycle through palettes |
| Hue hold | **add current spiral** to spiral playlist | **add current light-scene** to light playlist |
| Power hold | wipe playlist *(PARKED — K. unsure it's wanted)* | same |
| Bright short | *(dead for now)* | *(dead)* |

- **Brightness = "business," not lamp brightness.** Up = faster/more vivid/warmer
  (dysregulated/"crazy"); down = slower/cooler/mellow (calm). Push all the way
  down and it **auto-climbs back up slowly** — the hand can't flatline it.
- **Two separate playlists** (spirals, light-scenes) that **cycle independently
  and phase** against each other — uneven lengths (e.g. 5 spirals × 3 scenes)
  each advancing one per cycle, so pairings recombine for a long time (Reich-style
  phasing). This **replaces** the branch's existing `AutoMoodScheduler`.
- **Playlist = a curated subset.** The catalog is the raw pool (some entries
  **locked**); the playlist is what a curator has switched **on**. "Add to
  playlist" and "toggle on" are the **same action**.
- **Unlock = progressive reward.** Every palette/spiral a curator commits unlocks
  a new one. Exploring grows the catalog. (Unlock *store* is Q4.)
- **Screen toasts** — subtle, ephemeral, **decay after a few seconds**: current
  mode on button-press, and "new spiral/palette unlocked." Rewarding, never
  invasive, never persistent. (Fits the display firewall — mode words + reward
  cues only, no prose.)
- **Decay ≈ 30–60 min, one tunable engagement knob** (not a hard number). Whole
  engine floor auto-recovers.
- **The spiral shares the lamp palette** — recolors with the lights (see §3.2).
- **Spiral toggleable modifiers** (curator flips each): arms/symmetry (2/3/5/7),
  chaos amount, spin direction, energy-breath, bloom/trails, depth-pull (the
  latter doubles as the idle "flash inward toward the screen" attention cue).

---

## 3. What already exists — DO NOT REBUILD

### 3.1 C# `party-effects` branch — the chosen base

**`SceneParams` IS the three dials** (`Hue program/Scenes/SceneParams.cs`):
```csharp
public readonly record struct SceneParams(double Energy, double Warmth, double Brightness)
//   Energy 0..1  — drift/sweep speed, drop rate, motion intensity
//   Warmth -1..1 — palette temperature nudge
//   Brightness 0..1 — overall light level
//   .Speed(base) => base * (0.5 + E*1.3)   .Bri(min,max) => lerp by Brightness
```

**`SceneRenderer.GlobalEnergy` (default 0.2) is the master calm↔energy governor —
the spin-up/decay graft point already exists** (`Hue program/Services/SceneRenderer.cs`):
- Drives a **per-frame slew limiter**: caps how fast any light may change — "calm
  = gentle, energetic = snappier." *This is the "not a carnival" governor, already
  built at the render level.* Nothing can pop when GlobalEnergy is low.
- Is **folded into every scene's Energy at build** (`GenerativeScene.Tune()`:
  `factor = 0.4 + GlobalEnergy*1.2`).
- **The decay engine just needs to drive this one variable over time.**

**`SceneCatalog` already embodies the ethos** (`Hue program/Scenes/SceneCatalog.cs`
+ `AtmosphereCatalog`): each `GenerativeScene` stacks any number of layers, shaped
by `SceneParams`. Existing scenes and their author's own comments:
- Moods: **Calm Tide** ("barely moving"), **Glow** ("*present but never flashy*"),
  Cozy, Drift, Dream, Fireplace.
- Weather: On-Switch Cloud, Moving Clouds, **Rainy Day** (comment: *"no sun breaks
  — kills the warm colour-flash… soft even illumination — no blinking"*), Sunset Drift.
- `SceneCategory.Party` exists but is **hidden in v1** (`Visible` filters it out).

**Layer roster** (`Hue program UI/Services/LayerRegistry.cs`) — **13 ambient + 20
effect layers**, each with typed params + factory. Full triage in §5.

**Position data already exists** (`Hue program/LightPositionMapper.cs`,
`Models/PositionConfig.cs`, `Models/MappedLight.cs`):
- Each light has `Position = double[3]`, normalized **[-1..1]** per axis
  (`Normalize(cm, roomCm) = 2*(cm/roomCm) - 1`); center = 0.
- Saved per setup as `positions/{name}.json` (RoomDimensions cm + per-id xyz).
- `MappedLight` also carries Name, Brightness, IsOn, CurrentColor.
- Effects `Bounce` (`useYAxis`), `Wave`, `Ripple`, `Scanner`, `Comet`, `Meteor`
  already consume position/ordering → position-aware effects are partly there.

**Removed on this branch vs `feature/transient-effects`** (the graft cost):
`SuperfluidFlowLayer`, `EnvelopeLayer`, `SustainLayer`, `/api/effects/pulse`
reward channel, the whole emotion engine + paint mode. ~14.6k lines deleted,
~4.9k added. `SuperfluidFlowLayer.cs` (167 lines) exists on `feature/transient-effects`
and must be **ported back** (Q6).

### 3.2 Deep House `web/` — the orchestrator already lives here

- **`web/house.js`** — "THE STATE BIBLE." Shared state with **per-variable decay
  physics** (`CFG`: `rest, up, down, decay, threshold, feedback`), a house-pulse
  clock, endocrine light field. Runs in browser **and a bare `vm`** (node-testable,
  headless). *The decaying-energy engine pattern the party branch needs already
  exists as this shape.*
- **`web/viz/symmetry.js`** — the spiral (the "Math Gallery, CHAOS → SYMMETRY").
  Order-param **σ (0..1)** eases toward `(tune+1)/2`; drives the picture, the
  formula, and lamps via `σ→PAD`. **σ is exactly the spiral symmetry↔chaos dial.**
  - Spiral color = `orderColor(sigma, tint)` — a **2-point** chaos→order lerp
    (slate/violet → gold) with a single optional tint. **This is the "spiral is
    only 1 color" spot** — regraft target for palette-driven multi-color.
  - `drawSuperfluidBloom(...)` already renders "the screen mirror of the lamp
    flood… same feeling the real lamps carry via `SuperfluidFlowLayer`."
- **`web/hue.js`** — the client to the C# app; `Hue.energy()`, `Hue.mood()`,
  `Hue.runEffect()`, `Hue.bpm()`. **The web layer already pushes to the lamps.**
- **`web/brain.js`** — index.html interaction engine; already routes the remote's
  **Hue button** (`action === "hue" → huePress()`), already calls `Hue.energy(0.3/0.7)`,
  `Hue.mood("Clouds")`, runs `LivingColor + BeatPulse` effects.

**Implication (evidence for Q1):** the web layer is *already* an authoritative
decaying-state orchestrator that pushes to both the screen (canvas) and the lamps
(C# via `hue.js`). The C# app is *already* a render slave (`GlobalEnergy` + slew).

---

## 4. Decisions K. already made (locked)

1. **Base = `party-effects`** (not `transient-effects`).
2. **Curator can toggle scenes on/off** from the selection (= the playlist mechanism).
3. **Regraft `SuperfluidFlowLayer` + the spin-up/decay engine onto `SceneParams`.**
4. Effects are "**dull**" today AND "**~80% too flashy**" on `party-effects` →
   curate to the calm subset + downtune the rest; richer *slow* generative work is
   in scope. Not a contradiction: today's Deep-House lamps are dull; party-effects
   has vivid layers but most are too loud for this room. Target the middle.
5. **Positions feed effects**, not just the room map.

---

## 5. Effects triage — the 80/20 (calm-first)

Room lamps are **very present**. Default posture: **almost everything slow.**
Proposed split of the 33 layers (Fable/K. can adjust; this is the starting gate):

**KEEP — calm, default-eligible for light-scenes:**
- Ambient: `AmbientBreath`, `ColorCycle` (long period), `Aurora`, `LivingColor`,
  `DriftingClouds`, `CloudySky`, `OnSwitchCloud`, `Plasma` (low speed), `Fire`,
  `AmbientStatic`, **`Superfluid`** (after regraft).
- Effect (used sparingly, low rate): `Wave` (slow), `Ripple` (slow), `Sparkle`
  (sparse), `Rain` (soft/mono), `RainbowArc` (long sweep), `Pulse` (gentle),
  `Comet` (slow).

**GATE OFF by default — too flashy for ambient; reserve for attention-pull or
the hidden Party scene only:**
- `Strobe`, `Disco`, `Fireworks`, `Siren`, `BeatPulse`, `Heartbeat`,
  `TheaterChase`, `Chase` (fast), `ColorSwap`, `Lightning`, `Scanner` (fast),
  `Meteor` (fast), `Bounce` (fast), `RainbowWave` (fast), `Twinkle` (busy).

**The two sanctioned motion exceptions:**
- **Decay tells:** decorative lamps flicker/desaturate first (Q5) — a *gentle*
  `Twinkle`/`Sparkle` or brightness sag, well below "flash."
- **Attention-pull (only after long idle):** directional inward sweep toward the
  screen — `Comet`/`Meteor`/`Scanner` aimed by position (Q5). This is the one
  time the piece is allowed to raise its voice.

---

## 6. OPEN ARCHITECTURAL QUESTIONS — your calls, Fable

**Q1 (K. delegates this explicitly). Where does the engine live?**
The "engine" = the decaying energy state + the two phasing playlists + mode state
+ unlock ledger + the mapping from all that to `GlobalEnergy`/`SceneParams`/effects.
- **Option A — web-authoritative** (`house.js`-style module owns state; pushes
  `GlobalEnergy`, active scene, and effect params to C# via `hue.js`/`/api`; also
  drives the screen spiral directly). Evidence: §3.2 — this pattern already exists
  and already spans both surfaces; node-testable; keeps C# a dumb, smooth renderer.
- **Option B — C#-authoritative** (engine in the app; screen becomes a viewer).
  Evidence against: screen spiral logic (σ, superfluid bloom) already lives in JS;
  would duplicate.
- Recommendation to pressure-test: **A**, but you decide. Name the state owner,
  the push cadence, and what (if anything) moves into C#.

**Q2. How do the two surfaces stay in sync?** Given Q1's owner — what's the
transport (existing `/nav` SSE? new endpoint? poll?), and the tick model so the
spiral's σ/energy and the lamps' `GlobalEnergy` never diverge visibly.

**Q3. Playlists + phasing over the catalog.** Where do the two ordered lists,
their independent cursors, the phase-advance rule, and per-list slide/dwell speed
live (backend web interface controls this per §2)? Relationship of a *saved*
playlist entry to a *catalog* `GenerativeScene`/spiral (pointer + tuning override,
or a copy?).

**Q4. Unlock + persistence.** Where is the "unlocked set" and the committed
playlists stored (localStorage like house.js memory? a JSON on the controller?
C# `positions/`-style file?), and what's the unlock rule precisely (1 commit → 1
new unlock; which next item — sequential, random-from-locked, curated order?).

**Q5. Position model for roles + attention-pull.** From `positions/{name}.json`
[-1..1] xyz: (a) which axis faces the screen (so "inward" is defined); (b) how
**decorative vs in-sight** is tagged per light (extend the selection/config? new
field on `MappedLight`/a sidecar?), given decorative lamps react *sooner* and
flicker first; (c) the "simple room schema" (L/R/U/D) K. wants — derived view over
positions, and whether it needs a small mapping UI in v1 or a stub.

**Q6. Superfluid regraft mechanics.** Cleanest way to bring `SuperfluidFlowLayer.cs`
(+ any `EnvelopeLayer` dep) from `feature/transient-effects` onto `party-effects`
and register it in `LayerRegistry` as a calm ambient — cherry-pick, port, or
reimplement against the current `SceneLayer`/render contract (they diverged).

---

## 7. Constraints & invariants

- **Not a carnival** is load-bearing, not a preference. Lamps are physically
  dominant in the room. Default to slow; motion spikes must be *earned* (decay/
  attention only). Keep the `GlobalEnergy` slew governor central — do not bypass it.
- **Brightness bands stay moderate** — no extremes; "brightness" buttons drive
  *business*, not raw output.
- **Display firewall holds** (Deep-House `CLAUDE.md`): on-screen text = mode words,
  feeling-words, math, reward cues only. **No AI-authored prose about anyone.**
  Toasts fit this; keep them generic.
- **Repo/branch hygiene:** the party branch is a natural candidate to stay *clean*
  of `extracted/` corpus-derived material (it needs none), which keeps it closer to
  shareable than main Deep House. Flag if the design pulls anything corpus-derived —
  it shouldn't.
- **C# side must be on a branch that has the grafted Superfluid + the chosen base**
  — i.e. a new branch off `party-effects` with Superfluid re-added, not either
  existing branch as-is.

---

## 8. Appendix — file index (for verification)

**Deep-House `web/`:** `house.js` (state+decay physics), `viz/symmetry.js` (spiral,
σ, orderColor, superfluid bloom), `hue.js` (C# client), `brain.js` (remote+rooms),
`viz/ulam.js` (UlamSpiral exhibit). `controller/listen.py` (remote→web),
`controller/serve.py` (:8800 origin+proxy).

**C# `Hue program` @ `party-effects`:** `Scenes/SceneParams.cs`,
`Scenes/GenerativeScene.cs`, `Scenes/SceneCatalog.cs`, `Scenes/AtmosphereCatalog.cs`,
`Scenes/Moods.cs`, `Services/SceneRenderer.cs` (GlobalEnergy+slew),
`Services/SceneController.cs`, `UI/Services/LayerRegistry.cs`, `LightPositionMapper.cs`,
`Models/PositionConfig.cs`, `Models/MappedLight.cs`, `Layers/*` (Cloud/Rain/Field/
RainbowArc/etc). **On `feature/transient-effects` only:** `Layers/SuperfluidFlowLayer.cs`,
`Layers/EnvelopeLayer.cs`.

---

## 9. RESOLVED — Fable's calls + K.'s answers (2026-07-23)

Architect (Fable) decided all six, **confidence: high** on the web-side calls
(verified against real code, no discrepancies); C#-side details of Q5/Q6 rest on
this brief's embedded facts and want a spot-check when the Hue repo is next opened.

- **Q1 — web-authoritative. Engine = new `web/party.js`, a sibling to `house.js`
  (not a modification — different organism).** localStorage-backed; pushes to lamps
  via the same adaptive throttle as `house.js` `emitLights` (~7Hz ceiling,
  only-on-change gate, soft-patch default, hard-switch on scene/advance boundaries).
  C# gains nothing new; stays a smooth renderer gated by the `GlobalEnergy` slew.
- **Q2 — no new transport.** Spiral + lamps share one tick in one process; spiral
  reads state directly, lamps get the existing HTTP push. Can't diverge by
  construction. `/nav` SSE stays as-is for remote→browser only.
- **Q3 — playlist entries are pointers into the catalog, not copies.** Independent
  cursors, no per-entry tuning override in v1 (additive later).
  **→ K. CONFIRMED: phase-advance is tied to the engine's decay-trough** (one
  clock; phasing falls out of the organism's own breathing), not a separate timer.
- **Q4 — localStorage (`deephouse.party`)**, same pattern as house.js memory.
  Unlock = 1 commit → next locked entry, **sequential in calm-first catalog order**.
- **Q5 — `Role` field on the light (decorative/in-sight); L/R/U/D is a derived
  zone function (computed, no UI in v1); `screenAxis` is a config field.**
  **→ K. CONFIRMED: screen-facing axis is set per-install at the calibration step**
  (different every time by design) — never hardcoded.
- **Q6 — manual port** of `SuperfluidFlowLayer.cs` (branches diverged too far to
  cherry-pick; reimplement would lose the tuned tide feel). Verify whether
  `EnvelopeLayer` is a hard dep. Register as a calm ambient. Own phase + checkpoint.
- **Dead-browser backstop — K. CONFIRMED IN v1:** a tiny local decay-toward-floor
  on C# `GlobalEnergy`, so a dead browser tab winds the room down gracefully
  instead of freezing at last-pushed state.

**Reserved gesture (K.'s call, 2026-07-23):** Power-hold stays **unbound in v1 —
deliberately held as a backup slot** for a feature that hasn't arrived yet (was
proposed as playlist-wipe; not committing to that). Keep it free; don't wire it.

## 10. Phased plan (from Fable)

C# track `0→1→2`, web track `3` runs in parallel, then they meet.

0. **C# branch setup** — branch off `party-effects`. ✓ builds clean on base.
1. **Superfluid regraft (Q6)** — diff vs current `SceneLayer` contract, port,
   register in `LayerRegistry`. ✓ renders via manual trigger.
2. **External-drive API (Q1)** — soft-patch endpoint setting `GlobalEnergy` +
   `Energy/Warmth/Brightness` with no scene rebuild; **+ the local decay-floor
   backstop**. ✓ manual push moves lamps live, slew still gates (no pops).
3. **`web/party.js` scaffold (Q1/3/4)** — house.js module shape (IIFE, browser+vm,
   `root.PARTY`): one decaying business var → GlobalEnergy, mode state, two playlist
   arrays + cursors. ✓ headless `node` test: business up/down, decay-to-floor-then-recover.
4. **Remote wiring (Q1/2, §2 table)** — extend brain.js nav-switch with the 8-signal
   party table, Power-short mode toggle. ✓ remote/keyboard drives mode+business+playlist
   in a debug overlay before lamps move. *(Power-hold stays reserved/unbound — backup slot)*
5. **Lamp push (Q1/2)** — `party.js` emit modeled on `emitLights`; one guarded hue.js
   method → Phase 2 endpoint. ✓ business dial smoothly moves lamp energy, no pops.
6. **Spiral hookup (Q1/3)** — wire symmetry.js σ/orderColor/bloom to read party.js
   business; make `orderColor` palette-driven (multi-color, the "only 1 color" spot).
   ✓ σ tracks business; spiral recolors with active scene palette.
7. **Unlock ledger + persistence (Q4)** — localStorage save/load, sequential unlock.
   ✓ commit → unlock → reload → survives.
8. **Toasts (§2, firewall)** — reuse any existing transient-message mechanism first;
   ephemeral fade for mode + unlock cues. ✓ decays in a few seconds; mode words /
   reward cues only, no prose (firewall self-audit).
9. **Position roles + attention-pull (Q5)** — `Role` on `MappedLight`, `screenAxis`
   config, zone-derivation fn, decorative-flickers-first tells + long-idle inward
   sweep. ✓ decorative reacts before in-sight near floor; sweep fires once then stops.
10. **Effects triage (§5)** — GATE-OFF layers unreachable from default playlist pool.
    ✓ a freshly-unlocked playlist only surfaces calm-tier entries.

Deps: `0→1→2`; `3` ∥ `0-2`; `4`←`3`; `5`←`2+4`; `6`←`3`; `7/8/9/10` layer on once
`3-6` exist, roughly independent.

## 11. Iteration 2 — playtest divergences from the plan (2026-07-23)

First playtest drove four changes that supersede parts of the plan above. All
headless-tested; recorded here so the brief stays the source of truth.

- **Decay is a PENDULUM in σ, not a monotonic fade (K.'s model).** The pattern
  RESOLVES to symmetry then DISSOLVES to chaos and back — a clean σ oscillation
  (`spiralTune()`) whose width + rate scale with business, damping to a gentle sway.
  The "super slow fade back" is gone. `swingFreqBase/swingFreqGain` set the rate; the
  business decay physics underneath set the energy; the §2 trough-advance still fires.
  Per K.: "the swing is aimed at symmetry↔chaos — resolving and dissolving the pattern."
  (A first attempt physically ROTATED the spiral — `spiralAngle()` — kept in code but
  no longer applied; "fun for later" per K.)
- **Cycling (Hue-short) is live preview.** `activeSpiralId`/`activeLightId` — cycling
  swaps the shown spiral/palette instantly; commit pins what's shown. The
  AmbientDirector picks its exhibit from `activeSpiralId` (hash→pool) and
  **crossfades** (no hard clear), replacing the 26s auto-cut.
- **Lamp colour path (Phase 5) — built, but simplified.** `POST /api/effects/params`
  → `SceneRenderer.ApplyLiveParams` → the running `ILiveTunable` layer. Only
  Superfluid is tunable on this branch, so **the party lamps run one Superfluid
  flood recoloured by the active atlas palette + sped by business** — NOT the C#
  cloud/mood scenes. This makes Q3's "atlas owns colour" literally true for lamps
  today; per-scene layer variety (making clouds/etc `ILiveTunable`, or scene
  switching) is the deferred follow-up.
- **Pairing tweak:** Drift → Aurora (was Cosmic Void) so the first unlocks contrast
  on the lamps (Deep Ocean + Cosmic Void were both deep-blue primaries). Taste-call
  #2 (full reshuffle) still K.'s.

- **Curator DASHBOARD built** — the §2/§3 "backend web interface." `web/dashboard.html`
  + `dashboard.js`, a thin client (never runs the engine) on any device, relayed
  **cross-device** via serve.py `/party/pub` + `/party/sub` (mirrors the `/op` relay —
  BroadcastChannel was rejected as same-browser-only). Mirrors live state; edits both
  playlists (add/remove/reorder), browses the catalog (swatches), tunes config live.
  party.js gained pure `snapshot()`/`apply()`; party-main is the master (broadcasts
  state, applies commands). Logic headless-tested; live SSE round-trip needs the stack.

## 12. Iteration 3 — overnight burst (2026-07-24)

- **Pendulum corrected to FULL SPECTRUM.** Amplitude was scaled by business, parking
  σ near the middle at rest — wrong. Business now sets only the *rate*; the swing
  always traverses chaos↔symmetry end to end. New **`swingRange`** config (default
  1.0) narrows the band deliberately if wanted, exposed as a dashboard slider.
- **Unmapped lamps no longer sit dark.** `SuperfluidFlowLayer` now detects lights with
  null/all-zero positions and gives them a **steady fill** (breathing gently with the
  tide) instead of excluding them; `FindOrigin` ignores them so they can't drag the
  origin to the room centre and flatten the flood. K.'s room has 5 such lamps.
- **Neglect system built** (§2's "leave it too long and it asks for you"):
  `party.js` tracks `idle`, exposes **`attention()`** (0→1 ramp after `attentionAfter`,
  full over `attentionRamp`) and **`isDead()`** (`deathAfter`). Any touch — button,
  hold, or dashboard command — resets it. On screen, `party-main` fires the inward
  bloom pull more insistently as attention rises; HUD shows idle/attention/STANDSTILL.
  The *physical* inward-flash across lamps still needs Phase 9 positions + roles.
- **Phase 4 remote written** — `listen.py --party` publishes to `/party/pub` (not
  `/nav`, which can't express press-and-release). `party_action()` is a pure mapper,
  unit-tested: power-short=mode, ↑/↓ press=hold / release=stop, hue-short=cycle,
  hue-long=commit, **power-long deliberately unbound** (K.'s reserved gesture). Still
  needs the button resource ids filled in via `--discover` + a live test.
- Connection-starvation fixes: change-gated lamp pushes (idle room is silent on the
  wire), offline back-off, proxy timeout 6s→2.5s, SSE disconnect tracebacks silenced,
  explicit SSE reconnect on both sides.

**OPEN QUESTION K. raised (saved for later, not acted on):** *all lamps breathe and
show the same colour at once — intentional?* Partly: `SuperfluidFlowLayer` uses ONE
colour and varies **brightness** spatially, so same-hue is by design; the identical
*breathing* is because half the lamps are unmapped and collapse onto the origin.
Making distinct lamps carry distinct palette ROLES (so "only one colour screams" is
physically true) is exactly Fable's deferred escalation #3 — the natural next feature.

## 13. The flicker — root cause and fix (2026-07-24)

K.: *"all of the lights are way too flickery."* It was a **bug, not a taste problem.**

**Cause 1 — phase teleport (the big one).** The tide was
`reach = sin(_elapsed * _speed)`, with `_elapsed` growing forever while `party-main`
retunes `_speed` from business **up to 7×/second**. Changing the speed changes the
*argument*, so the phase jumps by `_elapsed × Δspeed`. Measured: after 5 min up,
holding the brightness button made the tide move **0.994 of its full range in a single
frame** — it teleported across the room every frame. Fixed by **integrating** the
phase (`_phase += _speed * dt`), so retuning changes the *rate*, never the position.
Same jump measured after the fix: **0.013/frame (~76× less)**.
→ **Rule: never compute an animation phase as `elapsed × rate` if the rate is live-tunable.**

**Cause 2 — lamps blinking to black.** `Update` did `States.Remove(light)` whenever
brightness hit 0. Superfluid is the *sole* ambient here, so removal = that lamp goes
dark: each lamp sat mostly off and flashed on as the band swept. Now every lamp
breathes between `BaseLevel` (0.42) and full — a swell, not a switch. Measured band at
flow 0.75: **32%…75%**.

**Cause 3 — too narrow/too fast.** Widened `spread` 0.35→0.60 (neighbouring lamps
overlap), slowed the tide (a full breath is 16s pumped, 79s calm), and added
**`energyCap` (0.65)** so the C# renderer's per-frame slew (anti-strobe) cap never
fully loosens no matter how hard the room is driven.

**The design principle, for future effects:** put the motion in **space, not in each
lamp's brightness**. A lamp swinging 0→100% reads as flashing; a room where each lamp
moves only within a narrow band, out of phase with its neighbours, reads as liquid and
alive. High spatial variance, low temporal variance per lamp.

**Neglect breathing (Phase 9, behavioural half — built).** As `attention()` rises the
lamps breathe **slower and deeper** (a ~14s swell that recedes and returns) and the
screen fires the inward bloom pull more often. It asks; it never shouts. Verified:
dips to 0.63 flow vs 0.73 calm, speed 0.146 vs 0.240, params stay in range, one touch
settles it. The *directional* inward flash still wants mapped positions + roles.

**Still not started (need the live stack / hardware):** Phase 9 position ROLES
(decorative vs in-sight) + directional attention-pull; per-scene lamp variety;
role-aware lamp colour (§12).

## 14. NEXT UP — K.'s three requests (2026-07-24, specified, NOT built)

A design workflow was started for these and **deliberately not finished** (session limit).
Nothing here is implemented. Specs below are enough to resume cold.

**14.1 — BUILT 2026-07-24.** See §15 below for what actually landed. 14.2 and 14.3 remain
unbuilt; their specs stand as written.

**14.1 Motion via COLOUR, not brightness** — K.: *"I would rather have them change color.
breathing in and out is a bit of a strobe anyway."* Correct, and it's the same root as
K.'s earlier "all lamps show the same colour" question. `SuperfluidFlowLayer` holds ONE
`_color` for every lamp and moves *brightness* spatially; any lamp going up/down reads as
blinking however slow. **Invert it:** hold each lamp's brightness in a narrow steady band
and move **colour** across the room instead.
- Wire format: extend `ApplyLiveParams` with a `palette` param (comma-separated hex, the
  same shape `ColorCycle`/`Aurora` already use) so the layer receives the whole atlas
  scheme rather than one colour.
- Map lamps → palette ROLES by position (primary / secondary / bridge), drifting slowly so
  colour travels like a tide. Keep **accent rare** — the atlas rule is only one colour
  screams at once; bind it to events, never ambient.
- This finally makes Fable's deferred escalation #3 (role-aware lamp colour) real.
- Reuse the integrated-phase rule (§13) for any drift — never `elapsed × rate`.

**14.2 Deliberate visual overlap** — K.: *"is there a possibility to make some of the
visuals overlap? I sometimes see some overlap."* What K. is seeing is the crossfade I
introduced: `AmbientDirector` stopped hard-clearing on exhibit change, so two exhibits
briefly coexist. Make it intentional: a persistent primary + secondary exhibit with an
independent blend weight and an `overlap` config (0 = single exhibit).
- **The trap:** each exhibit draws its own full-screen fade rect each frame; two of them
  double-darken / wash the canvas. Must be solved explicitly (one shared fade pass, or the
  secondary drawn without its own fade).
- Run the secondary at a different σ/phase so the two don't lock together.

**14.3 Full control of the NUCLEUS + documentation** — the "nucleus" is
`drawSuperfluidBloom` in `web/viz/symmetry.js`: a central radial well (widens/brightens
with σ) + **four streams centre→corners** + corner arrival glows, drawn in `lighter` over
the spiral. Almost everything is hardcoded (`coreR`, opacities, `drops = 5`, `flowSpeed`,
`reach`). Expose all of it through `PARTY.config` so it lands on the dashboard `TUNE[]`
sliders and persists: core size, core intensity, stream count, stream speed, stream reach,
stream size, corner-glow intensity, overall opacity, on/off.
- Signature note: `drawSuperfluidBloom` takes positional args and is called from **two**
  places — add a trailing options object rather than reordering.
- **Docs to write:** `docs/PARTY-VISUALS.md`, for K. as operator (not an API reference) —
  the lamp colour model, the overlap system, the nucleus and every knob, and how the screen
  and the lamps mirror each other.

---

## 15. THE COLOUR TIDE — 14.1 as built (2026-07-24)

The inversion K. asked for: brightness holds, **colour moves**. Nothing about the flood's
spatial model changed — the same screen→corners tide now carries hue instead of level.

**C# — `SuperfluidFlowLayer` (additive; with no palette the layer behaves exactly as before):**

| param | range | default | what it does |
|---|---|---|---|
| `palette` | comma-separated hex | *(empty)* | the whole scheme. Empty → old single-colour brightness mode. Unparseable entries are skipped, never thrown — one bad hex from the web side must not kill the ambient. |
| `colorSpan` | 0.1–4.0 | 1.0 | how many palette cycles fit across the room. 1 = one full sweep screen→far corner. |
| `colorDrift` | 0–1 | 0.05 | palette cycles per second travelling outward. |
| `brightBand` | 0–1 | 0.30 w/ palette, 1.0 without | how much of the spatial brightness swing survives. 0 = perfectly steady lamps. |

- Each lamp's colour = `SamplePalette(palette, normalizedDistanceFromScreen × colorSpan + colorPhase)`,
  looping HSV so there are no muddy RGB midpoints.
- The tide's own `reach` nudges `colorT` by ±0.075, so the hue front **advances and recedes
  with the swell** rather than sliding at a constant rate. Colour and motion stay one gesture.
- Brightness is compressed toward its own midpoint by `brightBand` — the swell is still there,
  just narrow enough to read as depth instead of blinking.
- **`_colorPhase` is INTEGRATED** (`+= drift * dt`), never `elapsed × drift`. Same rule as §13,
  same reason: the web retunes drift several times a second and elapsed×rate would teleport
  the hue. This is now the second place that rule has earned itself.
- **Unmapped lamps are spread around the palette by index** instead of all showing one colour.
  That is the direct answer to K.'s "why are all the lamps the same colour" — in a room with
  5 unmapped lamps they were, by construction, identical.

**Web — `party-main.js`:**
- `lampPalette()` sends **primary → bridge → secondary → bridge**. The there-and-back matters:
  `SamplePalette` loops last→first, so a plain p/s/b list puts a hard hue jump at the wrap.
- **Accent is deliberately absent.** Atlas rule: only one colour screams at once, and the
  scream belongs to events, never to the ambient.
- `colorDrift = 0.02 + business × 0.06` — a full pass takes ~50 s calm, ~13 s busy. **Business
  changes how fast colour MOVES, never how hard the lamps swing.** Neglect slows it by up to
  40% along with everything else.
- Palette + drift joined the change-gated diff, so an idle room is still silent on the wire.

**Registry:** the four params are on the `Superfluid` descriptor, so they also work from the
initial `runEffect` AmbientParams and from the C# UI's own layer editor.

**Verified:** core + UI compile clean (0 warnings, 0 errors); `party-main.js` syntax-clean.
**NOT yet verified on lamps** — needs the app restarted onto the new binary. The Web project's
build only failed to *copy* because the running app held the DLLs; the compile itself passed.

**After restarting the app, re-run `python tools/gen_light_reference.py`** — `docs/HUE-API.md`
is generated from the live registry and does not yet know these four params. Until then
`node tools/check_light_params.js` will flag them as unknown, and that is expected, not a bug.

---

## 16. THE SPATIAL PALETTE — the screen half of 14.1 (2026-07-24)

K. after the first colour-tide playtest: *"there isn't much colour scheming… only ever
really 1 or 2 colours."* Correct, and structural rather than a tuning miss.

**Root cause.** `orderColor(sigma, palette)` returns **one colour for one σ**. Both call
sites compute it once per frame and hand that single colour to the exhibit and the bloom.
So the palette was being used as a ramp over **time** (σ sliding chaos→order) and never
over **space** — at any given instant the picture was monochrome *by construction*,
however rich the scheme. The dashboard swatches showed 4–5 roles because the data was
always there; it died at the render. Same bug class as the lamps before 14.1: colour was
a function of one scalar instead of position.

**The fix — `color.at(u)`.** `orderColor` now attaches a sampler to the colour it returns.
`u ∈ [0,1]` indexes an exhibit's own elements (petal, arm, ring, chord, seed), with an
optional phase for animation. `colorOfN(color, i, n, phase)` is the half-step helper.
- The returned object is **still a plain `{r,g,b}`**, so all 38 exhibits keep working and
  upgrades are incremental — no big-bang rewrite.
- Ramp = **primary → bridge → secondary → bridge**, the same there-and-back the lamps use,
  for the same reason (sampling wraps last→first; a plain p/s/b list seams at the wrap).
  Measured worst adjacent step: 11/255. **Accent is absent** — the scream stays on events.
- **σ now controls colour UNITY, not just hue.** The slice of ramp the picture spans goes
  `SPREAD_CHAOS 1.0 → SPREAD_ORDER 0.34`, centred on secondary at chaos and primary at
  order. So chaos = the whole scheme scattered, symmetry = converged and nearly one hue.
  **It never reaches 0** — a fully monochrome resolve is exactly what K. complained about.
- **Off the party branch `at()` is the identity.** Deep House's σ→PAD "colour = one feeling"
  semantics are untouched, which was the standing objection to free-cycling colour.

**Upgraded so far (6 of 38):** rose (swept in 72 coloured segments), roots of unity
(per-root edges + glows), phyllotaxis (seed index → rings travelling outward), star polygon
(per-chord, so the {7/3} weave reads as colour), mystic rose (chords batched per origin
vertex — 18 draws, not 153), Ford circles (coloured by denominator, so the Farey structure
is what you see). Plus **`drawSuperfluidBloom`**: each of the four corner streams now draws
its own role, mirroring the room.
**The other 32 still render single-colour** and are a mechanical follow-up, not a redesign.

**Tests — `tools/party-tests/spread.test.js` (new, 14th suite; 15 suites all pass).** Tests the
sampler contract directly via the export, plus a 38-exhibit render smoke test.
**Three measurement traps found while writing it, worth not re-learning:**
1. Counting *distinct colours* cannot measure spread — a 9-element exhibit emits ~9 colours
   whether they span the scheme or a sliver. The metric saturates and passes silently.
2. Rendered **gamut** is polluted by the HUD's fixed greys and the background fade, which
   are identical at every σ and swamp the difference.
3. Even clean gamut saturates on densely-sampled exhibits, because the bloom's drifting
   phase can park a genuinely narrow arc across the two most distant ramp entries. The
   sampler's contract is tested directly for this reason; gamut is only a secondary check.

## 17. THE ZOOM PENDULUM — diving into the centre (2026-07-24, BUILT)

K.: *"a zoom fader for the spirals — zoom in and out, maybe even make it part of the
pendulum, diving deeper into the centre scale of the spiral."*

**Status: complete and headless-tested, not yet seen on a screen by K.**
`party.js` (drive) + `dashboard.js` (fader) + `viz/symmetry.js` (render) + `party-main.js`
(opt-in). Tests: `tools/party-tests/swing.test.js` covers the physics, the new
`tools/party-tests/zoom.test.js` covers the
render half. Reload `/party.html` hard — JS changed.

### 17.1 Why it rides `_swingPhase` (built)

The zoom is a **second swing on the same pendulum**, not a clock of its own:

```js
spiralZoom: function () {
  if (this.zoomManual != null) return this.zoomManual;
  var u = (Math.sin(this._swingPhase * c.zoomRatio + this._zoomPhase) + 1) / 2;
  return lo + (hi - lo) * u * this.business;
}
```

Consequences that are the point, not side effects:
- **Pumping business speeds up the dive** exactly as it speeds up resolve↔dissolve, because
  `_swingPhase`'s rate already scales with business. One physical object, two visible axes.
- **Depth scales with business** (the `* this.business` term), so a room at rest sits at
  full view and never dives. Verified: at full business the zoom spans ×1.00–3.18; at the
  energy floor it only reaches ×1.44. The dive is something you earn by pumping.
- `zoomRatio` 0.5 = one dive per two σ swings.

**`zoomInvert` (0/1) is the resolve-vs-dissolve toggle** K. asked for. It sets a target for
`_zoomPhase` (0 or π) which **eases over ~0.35 s in `tick()`** — snapping the phase mid-swing
jumps the zoom and reads as a glitch. Default 0 = **deepest AT symmetry**: order arrives and
you are closest to it. Flipped = you dive into the chaos and surface into order.

`zoomManual` lives on `PARTY` itself, **not in `config`** — `setConfig` coerces every value
with `+m.value`, which cannot express the `null` that means "hand it back to the pendulum".
Hence a dedicated `zoom` command: a number pins, absent/null releases.

### 17.2 Dashboard (built)

Live row: a zoom slider (`data-zoom`, ×1–6) that **pins** the value, an **auto** button
(disabled while already auto) that releases it, and a **resolve/dissolve** button
(`cmd: "zoomInvert"`). Plus `zoomMax` ("zoom depth") and `zoomRatio` ("zoom rate") in `TUNE`.
On auto the slider tracks the live pendulum, so grabbing it starts from wherever the dive
already is instead of jumping. `structKey` includes `zoomManual == null` so the auto button's
disabled state rebuilds.

### 17.3 Render — `web/viz/symmetry.js` (built)

`zoomFor(host, ex, pp)` + `withZoom(ctx, w, h, z, fn)`, wrapping `ex.draw` in both
`SymmetryGallery.draw` and `AmbientDirector.draw`. Six lines of transform, no per-exhibit
edits beyond the opt-out flags.

A **canvas transform, not an offscreen blit** — deliberately. A raster blit would go mushy
at exactly the depth where the dive is meant to show the most detail; the transform stays
vector-crisp at any zoom. HUD and `drawSuperfluidBloom` stay **outside** the transform: the
bloom is a screen-space glow and the σ meter must not fly off-screen.

**⚠ CORRECTION — the fade-rect problem does not exist, and the reason matters.**
The plan for this section (and an earlier draft of §17) claimed each exhibit's trail-fade
`fillRect(0,0,w,h)` would stop covering the canvas under scale, leaving a stale un-faded
border, and that fixing it needed a 38-exhibit audit. **That is backwards.** Scaling *up*
about the centre maps `(0,0,w,h)` to a rect of size `w·z × h·z` — the fade rect
**over**-covers, and nothing stale can survive. The un-faded ring is a **z < 1** failure.
So the zoom is clamped to `z >= 1` in `zoomFor`, and *that clamp is what makes the whole
thing safe* — it is load-bearing, not a config nicety. Anyone adding a zoom-OUT later must
solve the fade problem first (hoist the fade into the wrapper, pass `fade: 0` down).

The audit ran anyway and is worth keeping, since it is the map for that future work:
of 36 draw functions, **26 use the shared `frame()` helper**, **2 roll their own fade with a
multiplier** (phyllotaxis ×3, chladni ×4), and **9 opaque-clear every frame** (Ulam, Sacks,
cellular, life, truchet, julia, moiré, mandelbrot, newton — full repaints, no trail).

**Two real ones:**

1. **`lineWidth` scales with the transform**, so strokes thicken at depth. Probably reads as
   "getting closer" — shipped as-is, only worth fighting if it looks wrong at z≈3.
2. **Per-instance opt-in, because `AmbientDirector` wears two hats.** At `brain.js:121` it is
   the dim background behind menu rooms *with text on top* — a shape swelling to 3× behind
   readable text is a moving smear, and that layer's whole job is staying under attention.
   At `party-main.js:26` the same class **is** the entire projection, nothing competing.
   So `this.zoom = false` on the class, `director.zoom = true` in `party-main.js`. The
   gallery is foreground with no text over it and defaults to on.

**Per-exhibit opt-out — `ex.noZoom = true`** (K.: *"abide by the spirals' own needs"*):
- `mandelbrot` — already eases its own deep zoom from σ (`halfW = lerp(0.018, 1.7, q)`).
  Stacking a second zoom fights it.
- `julia`, `newton` — escape-time fields computed per pixel against a fixed
  `scale = 3.0 / min(w,h)`. Scaling the canvas magnifies pixels instead of revealing
  detail; it just goes blocky.
- `life`, `cellular`, `truchet` — grid-locked; zooming crops the grid to a corner and the
  pattern stops being the pattern.

The genuinely spiral-shaped exhibits (log, Fermat, hyperbolic, Euler, Theodorus, Sacks,
Ulam, phyllotaxis) are what the dive is *for* — real structure at the centre that gets
denser as you go in.

**Better second pass, deliberately deferred:** give the exhibit the zoom rather than the
canvas — `ex.update(dt, tune, zoom)`, with Mandelbrot folding it into its own `halfW`. Then
the fader drives a *true* deep zoom into the set instead of a magnified bitmap.

### 17.4 THE LENS — K.'s playtest: *"the zoom is a bit harsh"*

K., after seeing it run: *"is there a way to mostly magnify the middle rather than zooming
in like this?"* Correct diagnosis. A uniform scale drags the **whole frame** outward, so the
periphery rushes off the edges — the eye gets pulled OUT at the exact moment the dive is
meant to pull it IN. The dive was fighting its own intent.

**The fix — scale each point by how central it is, instead of scaling the canvas:**

```
p' = c + (p - c) · s(u),   u = |p - c| / R
s(u) = 1 + (Z-1)·(1 - u)^k          Z at the centre, easing to 1 at the corners
```

The frame stays put and the middle swells. At Z = 3.2 the centre is still ×3.2 but the
mid-field is only ×1.48 and the corners are ×1.00 — that ratio *is* the softness.

**Why a ctx proxy, not a pixel fisheye.** A true fisheye needs a per-pixel resample
(~900k px/frame) and goes soft precisely where it magnifies. But the exhibits draw in
absolute canvas coordinates with **no internal `translate`/`rotate`/`scale`** — audited: 0
of 36 draw functions use one — and they draw dense short segments and dots. So mapping each
point *as it is handed to the context* gives the same picture, stays vector-crisp, and costs
one `hypot` per point. `makeLens()` wraps the context; the exhibits are untouched.
Bonus: strokes no longer thicken, because `lineWidth` is never scaled now.

**Two things the proxy must not naively map, both found by writing the tests:**
1. **A full-canvas rect is the trail fade, not content.** Mapped, it would be displaced and
   scaled and stop covering the canvas — the stale-ring failure from §17.3 arriving through
   a different door. Detected by size, passed straight through.
2. **Radii scale by the LOCAL `s`** (`arc`, radial gradients), or the comet heads and dots
   stay small inside a swollen field.

**The fold, and the two clamps that prevent it.** `r'(r) = r·s(r/R)` must stay monotonic; if
it isn't, the field folds back through itself and creases visibly. Depth is capped at 3.5 —
and a *too-soft falloff* folds too, which is not obvious: measured, `k` must be ≥ 1.0 at
Z = 2, ≥ 1.4 at Z = 3, ≥ 1.7 at Z = 3.5. `makeLens` floors it at `0.45·z + 0.15`, just above
that line, so the **"zoom spread" slider cannot be dragged into a crease at any depth**.
A sweep of the whole reachable Z × k space is in the test suite.

**Both modes ship.** `config.zoomMode` — `0` = lens (default), `1` = uniform (the original).
Dashboard has a **centre/uniform** button next to resolve/dissolve, plus a **zoom spread**
slider (`zoomFalloff`, lower = the swell reaches further out, higher = a tighter bulge), so
K. can A/B the two live rather than take my word for which is better.

### 17.5 Tests — `tools/party-tests/zoom.test.js` (new suite)

The render half, against a ctx stub that records every `scale()` and the save/restore
depth: the gallery dives (max ×3.20) and **never scales below 1**; save/restore stays
balanced so the transform cannot leak into the HUD (an unbalanced one would walk the σ
meter off-screen a little further every frame); all six `noZoom` exhibits are never scaled;
`AmbientDirector` defaults to off and dives only once opted in; a dashboard pin renders
exactly, with no pendulum bleed-through.

One thing this suite cannot see: **whether the dive looks good.** Thickening strokes,
whether ×3.2 is too far, and whether the resolve-phase default beats dissolve are all
K.'s eye, not the tests'.

---

## 18. THE POOL MISS + NAMING (2026-07-24)

**The miss.** §16 upgraded 6 exhibits, but the party screen runs **`AmbientDirector`**,
whose pool is a fixed 13 — and only **two** of those 6 (rose, phyllotaxis) were in it.
Roots of unity, star polygon, mystic rose and Ford circles are foreground-gallery only, so
four of the six upgrades were invisible to the installation. K.: *"it all kinda looked cool
but still somewhat the same."* Correct — 11 of the 13 things on screen were untouched.

**Lesson worth keeping: `EXHIBITS` (38) is not what the party shows.** `AmbientDirector.pool`
(13) is. Anything aimed at the party screen must be checked against the pool, not the
gallery. `spread.test.js` now asserts the pool explicitly by name for this reason.

**All 13 pool exhibits are now polychrome:**

| exhibit | what carries the colour |
|---|---|
| lissajous, superformula, spirograph, rose | swept as coloured segments along the curve |
| harmonograph | colour follows the DAMPING — palette spirals inward with the pendulum |
| maurer rose | along the 360-hop walk, so the traversal order is visible |
| phyllotaxis | seed index → rings travelling outward (the screen's answer to the lamps) |
| clifford | distance from centre — lobes and dense core take different roles |
| chladni | nodal cells by radius, so the standing wave's rings pick up roles |
| times-table | 220 chords banded into 40 — bands the cardioid's envelope |
| boids | per-bird, so you can see the flock mix as it forms and breaks up |
| lorenz | by HEIGHT (z) — the butterfly's two lobes land in different roles |
| truchet | along the diagonal, a band sweeping the weave (per-tile reads as noise) |

New shared helpers in `symmetry.js`: **`strokeRamp(ctx, color, alpha, pt, seg, phase, perSeg)`**
for parametric curves (chunked — one stroke per sample would be thousands of draw calls;
each chunk overshoots by one sample or the segments read as dashes) and **`colorAtU`** for
continuous coordinates (radius, height) as against `colorOfN`'s integer index.
Colour choice per exhibit follows one rule: **bind the ramp to the exhibit's own structure**,
never to iteration order — colouring an attractor by iteration index just strobes, because
successive points jump all over the figure.

**Naming.** Generated schemes were `Gen-Aurora-42` and spirals `gen-spiral-7` — serial
numbers, which is what made cycling read as spam in the unlock toast.
- **Palettes** are now named from the primary's actual **hue** (12 words on 30° sectors)
  plus a deterministic form word: *Indigo Mirage, Ember Nocturne, Jade Cascade*. The name
  tells a curator what the colour is. Watch the sector alignment — a first pass had Gold
  sitting on 90–120° and christened a plainly green scheme "Gold Aria".
- **Spirals** use fold + form (`Twin/Trefoil/Pentad/Heptad` × `Weave/Coil/Helix/…`):
  *Pentad Filigree*. The **static five were renamed to match** (`gyre` → `Trefoil Gyre`),
  so hand-made and minted entries read as one catalog.
- `_uniqueId` guards collisions — the id is the playlist key, the localStorage key and the
  dashboard label, so a collision would silently merge two catalog entries.

**⚠ Renaming the static spirals changes their ids.** Any playlist saved in localStorage
before this points at `gyre`/`bloom`/… and will not resolve — clear it or re-commit.
It also reshuffles which pool exhibit each spiral maps to (`hashIndex(activeSpiralId)`).

**A test had to change, and it is worth saying why.** `party.integ` detected minted schemes
by matching `/gen|Gen/` on the id — the exact convention we deliberately removed. It now
detects them by *absence from the static catalog snapshot*, which is the real property and
survives the next naming change. Tests: **15 suites, all pass**; `spread.test.js` is at 17
checks covering every pool exhibit.

---

## 19. ALL THE SHAPES, REAL NAMES, AND A ROOM THAT RUNS ITSELF (2026-07-24)

K., after looking at §16–§18 on a screen: colour spread works, naming works, the zoom dive
is *"okish"*. Then: *"missing oh so many spirals from the original codebase"*, *"just use
their actual names, resolve all the names"*, and — the controller still doing nothing —
*"we can always just let everything get randomised and flow into each other… cycling
through all of the lights, spirals and chaos/symmetry states while zooming sometimes."*

### 19.1 The 25 missing exhibits

`AmbientDirector.pool` was a hardcoded 13 while `EXHIBITS` held 38, so **25 exhibits could
never appear on the party screen** — every fractal, every named spiral, Life, Truchet,
moiré. Not a bug in the usual sense: the 13 were curated correctly for this class's *other*
hat, the dim background behind menu text in `brain.js:121` ("a calm rotation — skip the
loud prime spiral for ambient"). The party screen wears the other hat, where loud is the
point. Fixed the same way `this.zoom` was: an opt-in, `new AmbientDirector(canvas,
{ full: true })`, taken by `party-main.js` and nothing else.

### 19.2 The names were promises the code didn't keep

A catalog entry was `{ id: "Trefoil Gyre", arms: 3, chaos: 0.15, spin: 1, u }` — and
**nothing in it said what got drawn.** `symmetry.js` picked the shape by *hashing the name*
into the pool, so "Trefoil Gyre" was not a trefoil, and `arms`/`chaos`/`spin` were stored,
persisted, shown in the dashboard and **read by nothing at all**.

Now **the catalog IS the exhibit list**: 38 entries whose ids are the exact `ex.title`
strings, and selection is a lookup (`indexOfTitle`). The name means the shape. `hashIndex`
survives only as the fallback for an id a given pool doesn't hold.

Consequences worth knowing:
- **All 38 start unlocked.** With real shapes there is nothing to earn by hiding them.
- **Spirals can no longer be minted.** The generator can invent a *name* but not a draw
  function — a minted spiral would be exactly the fake-name problem again. `_mint()`
  returns `null` in spiral mode; `commit()` already guarded for it. Lights keep minting,
  because the palette atlas really is generative.
- `arms`/`chaos`/`spin` are gone from the entries. `activeSpiral()` still returns
  `chaos`/`speed`, but *derived* from business × the scheme's `speedNorm`.
- **Two lists that can drift.** `party.js` keeps its own copy of the titles because it must
  stay dependency-free to run in a bare node vm. `catalog.test.js` asserts set-equality
  between them, and names the offenders on failure. **That test is the point** — 25
  exhibits went missing precisely because two lists drifted with nothing checking.

`EXHIBIT_TITLES` on `root.SYM` is a **lazy getter**: reading a title means building the
exhibit, and `spread.test.js` re-evaluates the module once per exhibit, so an eager list
cost 38×38 builds and hung the suite for minutes.

### 19.3 The off switch

`off` on a catalog entry, separate from `u` on purpose: locked means *not yet earned*, off
means *I have seen it and it does not present well*. **Mandelbrot is why this exists** — it
visibly lagged. Vetoes persist in localStorage (coming back after a refresh would be worse
than useless), the dashboard greys the entry rather than hiding it (a vanished entry reads
as a bug), and vetoing whatever is currently on screen **steps past it immediately** —
otherwise nothing re-picks until the next dwell and it appears stuck.

### 19.4 Attract mode, and why it needed its own clock

**The trap, and it is the whole reason this is separate machinery.** `_advance()` fires on
a decay *trough*, but only after `_wasAboveFloor` — which needs something to push business
UP first. With no working remote, business rests at the floor forever, the trough never
arms, and **the screen sits on one shape until touched.** Reusing the existing stepper
would have produced a room that looked broken while every test passed.

So `PARTY.auto` brings its own clock *and* drives business itself:

- **One raised-cosine swell per cycle**, floor → peak → floor. A single breath, not a pulse
  train (invariant 1). `effectiveEnergy()` still caps what reaches the lamps.
- **25–45 s dwell**, then a new spiral *and* a new light drawn from everything available,
  **ignoring the playlists** — curation is the manual path, this is the self-running one.
- **Zoom sometimes** — two cycles in three dive; the rest pin flat (`zoomManual = 1`), so
  the dive stays an event. `ex.noZoom` still overrides. `zoomInvert` flips per cycle.
- **σ band jitter** per cycle (`swingRange`, `swingFreqBase`), bounded either side.
- **Lights unlock one per cycle.** Found by the test: lights earn by commit and attract
  mode never commits, so the room would have looped the same **two** palettes all evening.
  Deliberately does not mint — the overflow valve would grow the catalog without bound.
- **A hand on the remote always wins**, and releasing doesn't snap the room back.

Random but **not `Math.random`**: this file is deterministic by contract, so draws are a
hash of the cycle index. Same step, same show — which is what makes `auto.test.js` able to
assert a reproducible ten-minute run.

**On by default** on `party.html` (`?manual` opts out) — with no working remote, an
unattended screen that never moves is a dead screen. Dashboard has start/stop and a
**skip** button, the only way to audition shapes without waiting out a dwell.

### 19.5 Tests

Two new suites. `catalog.test.js` — set-equality between the catalogs, every name resolving
to its own exhibit, the calm 13 still intact for `brain.js`, no spiral minting.
`auto.test.js` — the freeze scenario above (ten untouched minutes must change the screen),
the energy ceiling, determinism across replays, vetoes never leaking, and the remote
winning. **17 suites, all pass.**

---

## 20. THE COLOUR DRIFT, THE NUCLEUS, AND A READABLE DESK (2026-07-24)

### 20.1 Light-scenes drift instead of cutting

K.: *"make the colors of the lights actually slowly drift into each other rather than get
instaswapped? its a bit harsh of a mode shift."*

A scene change replaced `activeLight().palette` wholesale in one frame, so `pushLamps()`
sent a brand-new scheme to `SuperfluidFlowLayer` with no transition — and the **screen cut
at the same instant**, since `orderColor(sig, pp.palette)` reads the same array. The seam
always existed; §19.4's attract mode made it fire every 25–45 s, which is what made it
intolerable.

**Eased in `party.js`, not in the lamp-push path.** Both surfaces read colour through
`activeLight()` (the screen via `activeSpiral().palette`), so easing it once fades the room
and the projection *together* — one organism. Easing it in `party-main.js` would have
smoothed the lamps and left the spiral cutting.

**⚠ Mixed in HSV along the shortest hue path, and that is not a stylistic choice.** The
straight RGB line between two saturated colours passes near the achromatic axis. Measured
across the real atlas: **Synthwave → Toxic Reactor has an RGB midpoint saturation of 0.11**
— a grey-brown, `#80727b` — where the HSV path holds **0.98**. A crossfade that greys out
halfway reads as the room dying, which is worse than the cut it replaces. `palettefade.test.js`
asserts both halves: no atlas pair greys under `mix()`, *and* a channel lerp genuinely would.

Details that matter:
- **Manual snaps, auto drifts.** `cycle`/`commit`/`setActive` pass 0. Auditioning a catalog
  with an 8 s wait per click is unusable.
- **`contrastNorm`/`speedNorm` ease too** — contrast feeds `effectiveEnergy()`, so letting
  it jump puts a step in lamp brightness exactly as the hue starts gliding.
- **Interrupting a drift resumes from the eased colour**, not from the old scene.
- Change detection lives in **`_palTick`**, off `tick()`, rather than at the five call sites
  that can set `activeLightId` — one place that cannot be forgotten.
- Palette pushes **throttle to ~3 Hz while fading**. "An idle room is silent on the wire"
  (invariant 5) must not quietly become "a drifting room shouts".
- Grey has no hue, so mixing to/from an unsaturated colour keeps the *other* end's hue and
  moves saturation only — otherwise it sweeps the whole wheel on the way.

### 20.2 The nucleus is reachable (request 14.3)

All 19 numbers in `drawSuperfluidBloom` — central well size and glow, stream reach, speed,
density, pulse size and glow, corner glow and size, the press flare — moved into
`PARTY.config` as `bloom*` keys, read through `bloomCfg()` with **identical defaults when
`PARTY` is absent**, so `brain.js` draws exactly what it drew before (asserted).

Each is a σ **pair**: `Lo` at chaos, `Hi` at order. **Matching a pair stops that element
breathing** without flattening the rest — the only way to isolate one part of the bloom,
and the thing worth telling an operator first.

**⚠ `bloomCornerAlphaLo` is NEGATIVE (-0.04) and must stay that way.** It holds the corners
fully dark until σ climbs past roughly a third, and that delay *is* the "flood arrives"
gesture. Clamp it to 0 and all four corners glow from σ=0, so nothing ever arrives — the
room just glows. It reads as a typo, it is load-bearing, and `bloom.test.js` pins it.

`bloom.test.js` asserts every knob by **moving it and watching the drawing change**. The
failure mode for this kind of work is a panel of controls that look live and drive nothing
— a renamed key or a missed literal renders a perfectly normal slider that does nothing.

### 20.3 A desk you can read

K.: *"the interface may need a bit of a rework? or at least a bit of explanation next to
each slider."* Correct, and a prerequisite rather than a polish step: 19 new knobs on top of
12 already-cryptic ones would have been unusable.

`TUNE` entries became `{ g, k, t, min, max, st, h }` rendered under four group headings —
**The room · The spiral · The dive · The nucleus** — each slider carrying a plain-language
line. **The rule for `h`: describe the ROOM, not the maths.** "how quickly it sinks back to
rest", never "decayRate, per second". A line that can only be understood after reading
`party.js` is the wrong line.

`dash.test.js` now drives the dashboard with the **real** `PARTY.config` and requires every
rendered `data-key` to exist in it, all 31 to carry help text, and no key to render twice.

**`docs/PARTY-VISUALS.md`** is the operator guide: the three stacked layers (exhibit /
nucleus / dive) and how to tell which one is annoying you, what the chaos-order pairs mean,
four starting points (calm / default / alive / diagnostic), and a "when it looks wrong"
table. Nothing on the desk persists — reload returns to defaults, so write down keepers.

**19 suites pass.**

---

## 21. TWO PATTERNS AT ONCE, A READABLE NEWTON, COLOUR CARDS, AND THE PATCH BAY (2026-07-24)

Four requests from one afternoon of K. watching the room.

### 21.1 Overlap — request 14.2, finally (and K.'s background toggle)

K. asked for *"a toggle to leave the previous effect spiral on the background of the next"*
and *"randomise the order… really cool interactions and transitions."* That is 14.2 arriving
from the other side: **14.2 is the transition case, the toggle is the sustained one.** One
mechanism, `overlapMode` 0 off · 1 transition · 2 persistent.

**Two traps dictated the code.**

**Double-darkening** — predicted in §14, and real. Most exhibits paint their own
`rgba(4,5,10,fade)` rect, so two layers meant two fades: trails dying twice as fast and both
patterns thin. **Exactly one fade per frame now**, hoisted to the director; both layers get
`fade: 0`. `frame()` also skips the fill entirely at fade 0 — not tidiness, it is a
full-canvas paint per layer per frame at 1080p.

**The opaque nine** — NOT predicted, and the bigger one. `primeSpiral`, `sacksSpiral`,
`cellular`, `life`, `truchet`, `julia`, `moire`, `mandelbrot`, `newton` repaint the whole
frame and ignore `opts.fade`: they **erase what is under them**. So an opaque exhibit is
**forced to the bottom layer** whichever way the pair arrives, and **two opaque candidates
skip overlap entirely** — either order wipes one. Mechanical, not taste: ignoring it renders
one exhibit and reads as a bug. Flagged `opaque: true` beside `noZoom`; the sets overlap but
differ, so it needed its own flag.

The underlay keeps the **outgoing instance**, not a fresh one — a Life board mid-generation
or an attractor's accumulated cloud is exactly what makes a background worth having.
Per-exhibit veto `ovl` (persisted, dashboard `⧉`) is separate from `off`: `off` is "never
show this", `ovl:false` is "show it, never layered". The single-layer path is byte-identical
to before, so overlap off cannot change how anything looks.

### 21.2 The pixelated Newton

K.: *"can you zoom out on the newton fractal or something? it looks very pixelated."*
Zooming out was the wrong lever — the escape-time exhibits evaluate one sample per `cell`
and paint it as a block (5×5 for Newton). Finer costs 3–6× and Mandelbrot already lags.

So each sample is written as **one pixel into a small offscreen buffer**, stretched up with
`imageSmoothingEnabled`. Bilinear interpolation turns blocks into a continuous field for
**exactly the same number of escape evaluations** — the cost does not move, only the
presentation. Done as a paint **target** exposing `fillStyle`/`fillRect`, so Julia,
Mandelbrot and Newton keep their loops and cannot drift apart. Returns null where there is
no DOM and every caller falls back to blocks, which is what keeps the headless suites
running. Newton's view widened 3.0 → 4.2 as asked. **It will look soft rather than sharp** —
that is the trade for not costing more.

### 21.3 Colour cards

A light-scene was static data. A **card is a behaviour**: `emit(t, business)` → palette +
lamp params, so it can rotate, split, flare or travel. Cards are ordinary catalog entries,
so they appear in the Light catalog, join playlists, can be vetoed, and attract mode cycles
them. **Spectrum · Monochrome · Split · Triad · Wander · Ember · Runner.**

Built entirely from the eight knobs `/api/effects/params` exposes — **no C# change**.
⚠ That endpoint **does not clamp and silently ignores unknown keys**, answering
`softUpdate:true` having applied nothing, so an out-of-range value or a typo is invisible
on the wire and simply does nothing in the room. `cards.test.js` checks every emitted param
against the generated `HUE-API.md` ranges; `party-main` clamps on the way out.

**Ember** is the one card that deliberately spikes, kept legal: the flare moves flow and
speed rather than brightness (invariant 3 — a lamp swinging wide reads as flashing), fires
on three slow oscillators beating against each other so it is rare rather than rhythmic
(measured at 1 % of samples), and `energyCap` still bounds it.

**Runner is the honest-limits one.** The single Superfluid layer positions colour by
**distance from the screen**, so a narrow `spread` with a wide `colorSpan` gives a compact
band moving outward. That reads as travelling. It is **not** a lamp-by-lamp chase in
physical order — that needs a new C# layer and was out of scope.

**Two real bugs found building it.** The crossfade captured its target once, which froze a
card on the colour it held at the instant of the switch — it arrived dead. The target is now
re-resolved every call while `from` stays frozen, which is what a crossfade means when one
end is moving. And **"Drift" the card collided with "Drift" the static scheme**: an id is
the playlist, localStorage *and* dashboard key, so the lookup found the static entry and the
card emitted nothing. Renamed to **Wander**, and cards now go through the same `uniqueId`
guard the generator uses. Both have tests.

### 21.4 The patch bay

K.: *"an option to add any setting we want to one of the clocks we have running? its kinda
cool they are like oscillators and we can add some lfo effects."* The room already contained
several oscillators, each hard-wired to one destination. They are now **sources**:
`swing` (the σ pendulum) · `zoom` · `business` · `cycle` (position through the attract
dwell) · `breath` (a free slow sine). Any config key can ride one — physics, the dive, or
any of the 19 nucleus knobs. `~` on a slider cycles the clock; a patched slider swaps its
help line for a depth control.

**⚠ The trap, and it is the whole design.** A mod writes into `config` so every reader sees
the modulated value with no changes anywhere. But writing the result back over the field it
was computed from **compounds** — last frame's output becomes this frame's input and the
setting walks off within seconds. The untouched value lives in `_modBase` and every frame
recomputes from that; un-patching restores the original rather than leaving it wherever the
LFO stopped. `mods.test.js` asserts the range is identical twenty minutes later, which is
the assertion that catches a regression here.

Depth is a **fraction of the setting's own value**, so one number means the same thing on a
slider running 0–0.05 and one running 1–6. One mod per setting — two oscillators fighting
over one field is a race. An unknown source returns 0.5, never NaN, because a NaN in config
reaches a canvas and throws.

**22 suites pass.** New: `overlap`, `cards`, `mods`.

---

## 22. THE MASTER TEMPO (2026-07-26)

K.: *"I think we need a general bpm tempo or something that makes everything tick. most
fractal art is very very slow. right now it almost becomes like a hypnotoad lol. can we
slow everything down? have a master tempo on it all."*

**The diagnosis.** Nothing in the party shared a rate. All 38 exhibits hardcode their own
speed literal onto the `_t` that `base().update` integrates (`web/viz/symmetry.js:347`);
the bloom has `_bt`; the cards have `_clock`; the σ/zoom pendulum has `_swingPhase`; the
lamps take their speed straight off `business`. Each was tuned alone and each was
defensible alone — the *composite* is what read as busy. Retuning 38 constants would have
been the same mistake at 38× the cost.

**`config.bpm`, one dial, default 48.** 120 BPM ≡ 1.0 ≡ the speed everything was tuned at,
so the default ships at 0.4× — the 2.5× slowdown asked for. `PARTY.tempo()` is the single
accessor. It is an ordinary config key, so it inherits the slider, `setTuned`, and the
patch bay (§21.4) for free — `patch("bpm","breath",0.2)` is the room breathing its own
heartbeat. Labelled in BPM because that is the language the music is in, and because the
C# side already exposes `/api/bpm` to lock onto later without re-plumbing.

**Where it reaches the screen: one multiply.** `party-main.js` passes
`director.draw(dt * PARTY.tempo())`. That flows into `base().update` and therefore into
every exhibit's `_t`, every private `_ct`, every `_sub(dt)`, and — because `_bt` lives
*inside* `draw` — the bloom too. **No per-exhibit edits, and no edit to `symmetry.js` at
all.** An earlier draft of this added a `tempo` field to `activeSpiral()` for the bloom; it
was unnecessary, and shipping it would have repeated the exact sin §19.2 documents (that
return object already carries a `speed` nothing reads).

**⚠ THE TWO TRAPS.**

1. **Scale the increment, never the elapsed.** `tide.test.js` already paid for this lesson
   once: `elapsed * tempo` re-scales the whole accumulated history the instant the rate
   changes, so every tempo move teleports the phase. Everything here is `phase += rate *
   tempo * dt`. `tempo.test.js` yanks the dial 120 → 24 mid-run and asserts the worst
   single-frame step stays under 0.05 — that is what makes the slider safe to sweep live.

2. **Motion clocks scale; RESPONSE clocks do not.** `tick()` now carries two time bases:
   `mdt = dt * tempo()` drives `_clock`, `_modTick`, `_palTick`, `_swingPhase`; plain `dt`
   keeps the business envelope, the `idle` neglect clock, and the 0.35 s `_zoomPhase`
   settle. Scaling those would mean turning the tempo down also made the remote feel
   broken and pushed the 7-minute neglect cue out past 17 minutes. The room's *reaction*
   time is a promise to the person in front of it; only its *motion* is a tempo.

**The lamps move with it.** `speedN`/`flowN`/`driftN` in `party-main.js` are multiplied by
the tempo, and so are card-supplied param overrides — scaled *before* the clamp, so a card
cannot smuggle full speed past the master just by naming the key itself. `PUSH_MS` and the
attention cue interval are left alone: those are a network throttle and a wall-clock nag,
not rhythm.

**Presets that were already tempo statements now say so:** `held breath` 24 · `slow burn`
32 · `hard swing` 96 · `swarm` 110. They move the master rather than fighting it.

**`cards.test.js` is pinned to `bpm: 120`.** Its durations ("a full lap is ~15 min") are
stated in 1.0× seconds; without the pin, changing the shipped default silently shortens
every sample window and the hue-wheel test fails for a reason that has nothing to do with
cards. That is the pattern for any future suite that asserts on a duration.

**26 suites pass.** New: `tempo`.

## 23. THE SWING'S REACH, AND A PAUSE AT EITHER END (2026-07-26 — SPEC, NOT BUILT)

K., after a live look: *"the spirals doesnt resolve to full symmetry as much anymore. can
we look into that that they do actually go all the way to their super-chaos or symmetry
and maybe even give us a toggle option to take a customisable pause at either point. this
will be rewarding for watching it re-enter motion."*

Diagnosed, measured, specced. **Nothing here is built.**

### 23.1 Why σ falls short — two limiters, and the small one was the suspect

**(a) `swingRange` jitter — real, minor, attract-only.** `_autoPick` re-rolls
`config.swingRange = 0.55 + r()*0.45` every cycle (`party.js:669`), so an attract cycle
covers 55–100% of the spectrum. The manual default is `1.0` (`party.js:359`), so this
does not affect a hand-driven room at all.

**(b) The σ-ease filter — the dominant cause, and it is in the render layer.**
`base().update()` (`symmetry.js:347`) is shared by all 38 exhibits:

```js
update(dt, tune) { this.q = ease(this.q, (clamp(tune,-1,1)+1)/2, dt, 0.9); ... }
sigma() { return this.q; }
```

`ease()` (`symmetry.js:32`) is an RC low-pass with a **hardcoded rate 0.9**, not in config,
not reachable by any preset. **`ex.sigma()` returns `q` — the filtered value — and that is
what renders, what the HUD prints, and what feeds `orderColor` and the bloom.
`spiralTune()` is only the *target*.**

The filter attenuates harder the faster the swing: amplitude reaching the screen is
`range · ωc/√(ωc²+ω²)` with `ωc = 0.9` and `ω = swingFreqBase + business·swingFreqGain`
(`party.js:559`). Tempo cancels — `dt` is already tempo-scaled at
`party-main.js` (`director.draw(dt * PARTY.tempo())`), so both the filter cutoff and the
swing rate live on the same clock.

**Measured (60 fps simulation, shipped defaults, steady state):**

| state | ω | σ actually rendered |
|---|---|---|
| idle, business 0.20 | 0.46 | 0.054 → 0.946 |
| pumped, business 1.0 | 1.82 | **0.277 → 0.723** |
| `hard swing` preset | 3.50 | **0.375 → 0.625** |
| attract, swingRange 0.55 | 1.31 | 0.343 → 0.657 |

A preset named for going chaos→symmetry and back never approaches either end.

**Why it reads as a recent regression though the 0.9 never changed:** iteration 3 coupled
swing *rate* to business (`swingFreqGain`) so a pumped room swings faster. The ease rate
was inherited from Deep House's discrete `nudge()`-and-settle interaction (±0.16 steps,
`symmetry.js:1846`) and was never re-checked against a continuous fast sinusoid. A design
mismatch, not a fluke.

**Not a limiter:** Ulam (`symmetry.js:694`) and Sacks (`:781`) pin `q = 0.5` deliberately
("σ held mid — contemplative"). Leave them.

### 23.2 The fixes, in build order

1. **`swingRange` floor → 1.0** (`party.js:669`), one line. ⚠ **Costs texture:** every
   attract cycle currently draws a different partial band. Pinning to 1.0 leaves speed and
   dwell as the only per-cycle variety. Flag to K. rather than deciding silently.
2. **The dwell** (§23.3). Doubles as a de-facto reach fix *during held windows* — `q` keeps
   easing toward a frozen `tune = ±1` and has time to arrive.
3. **Ease-rate headroom.** Pass a rate through `update(dt, tune, rate)` with
   `rate = Math.max(0.9, ω*K)`, K≈6–8 for >99% tracking, computed by the party caller
   (`symmetry.js:1859`/`1939`, where PARTY is already in scope). **Default the 3rd arg to
   0.9 when absent, so Deep House's own gallery path stays byte-identical.**
   ⚠ **This is shared code.** A globally faster rate would make the main house's discrete
   button-nudges snap instead of ease — a real change to the game, not just the party. The
   3-arg-with-default shape *is* the safeguard. Re-run `ordercolor` + `spread` after.
   **Do not skip this** — without it everything *between* dwells still falls short, which
   is most of what is on screen most of the time.

### 23.3 The dwell — spec

**Hook:** `party.js:559`, where `_swingPhase` is advanced. **Freeze the increment; never
rescale the phase.** A pause implemented by scaling or offsetting accumulated phase
re-introduces the flicker bug (§13) exactly.

**Detection:** watch the sign of `cos(_swingPhase)` across the would-be increment. `+→−`
just passed symmetry (sin peak); `−→+` just passed chaos. An edge detector on the phase
already being integrated — no new clock, works at any rate or tempo.

**On a flip, if that end is enabled:** snap `_swingPhase` to the nearest `kπ/2` (bounded by
one frame's increment, ≪0.05 rad — sin is flat at its own extremum; same correction already
trusted for `_zoomPhase`); set `_dwellRemaining = c.dwellSeconds`; while it is positive,
**do not execute the `+=` line at all** and decrement by `mdt`; resume from the pinned value.

**Config:** `dwellMode` int default 0 — 0 off / 1 chaos / 2 symmetry / 3 both, cycled by a
dashboard button exactly like `overlapMode` (`party.js:1121-1124`). `dwellSeconds` number
default 4, slider `min 0 / max 20 / step 0.5` in **"The spiral"** group, under `swingRange`.
State: `_dwellRemaining` on PARTY, reset alongside `_swingPhase`.

**Tempo:** decrement by `mdt` (tempo-scaled). A dwell is pacing, i.e. motion — turning the
master tempo down should stretch the pause with everything else. Contrast the neglect clock,
which stays wall-clock on purpose (§22).

**Zoom:** freezing `_swingPhase` freezes the dive automatically — one pendulum, by design.
Do **not** add a second clock to park the zoom somewhere prettier. Expect the dive to stop
mid-motion rather than also arriving; that is correct, and worth K. seeing once before it is
called done.

**Attract mode:** `_autoTick` runs on `_autoT`, independent of `_swingPhase`. A dwell does
not extend the cycle, so an exhibit swap can truncate a hold — which loses the reward K. is
after. Mitigation is the `max: 20` slider cap against 25–45 s attract dwells, not
cross-coupling the two state machines. Accepted, not solved; if it grates, deferring the
swap is a small separate follow-up.

### 23.4 Tests

1. **The missing one:** drive a real `base()` exhibit with `ex.update(mdt, PARTY.spiralTune())`
   at business 1.0 and at `hard swing`, assert `ex.sigma()` reaches `<0.05` / `>0.95`.
   `tune.test.js` only ever asserted on `spiralTune()`; **nothing in the suite has ever
   exercised `base().update()`'s reach** (`zoom.test.js:150` stubs `sigma(){return 1}` and
   bypasses `base()` entirely). That gap is why this shipped.
2. Same at `swingRange` 0.55, and again after fix 1 — proves 1 alone is insufficient.
3. Dwell trigger: `dwellMode 2`, assert `Δ_swingPhase === 0` for exactly `dwellSeconds`
   (tempo-scaled), then resume under the same no-teleport guard `tempo.test.js:70` uses
   (worst frame step < 0.05).
4. During a dwell, `spiralZoom()` is constant frame-to-frame — proves the shared freeze.
5. `dwellMode 0` reproduces today's `_swingPhase`/`spiralTune()` sequences exactly.
6. Same `dwellSeconds` at two `bpm` — hold duration scales inversely with tempo, locking in
   the tempo-scaling choice above.

---

## 24. SUITE COUNT — 26 → 30, and why this section exists (2026-07-29)

`check_docs.py` now runs `tools/party-tests/run.js` and cross-checks any doc that
mentions a suite count. This file failed it: its newest count was **26** (§22, the master
tempo), while **30 suites pass** today — the suites grew without a word here.

Not a bookkeeping nit. §22 was the last section written while this file was the party's
decision log; everything after 2026-07-26 was recorded in `STATE.md` instead. So the count
is a **tracer for a handoff that quietly moved** — the brief stopped being where new work
landed, and nothing said so.

The four suites added since §22, all traceable:

| suite | commit | what it pins |
|---|---|---|
| `dwell` | `52c39bb` (07-26) | the pause at either end of the swing |
| `persist` | `9ef6251` (07-26) | the first suite that seeds a *dirty* localStorage — every earlier one started empty, which is why the stale-spiral bug was invisible |
| `buttonmap` | `b1f0a5b` (07-26) | the remote's meaning lives in the room, so a button can be remapped live |
| `lightsmap` | `80f4869` (07-28) | the lamp map + the wizard's forced order and failable quiz |
| `synth` | (08-12) | the synth patchbay's card coverage + the patch model (`modToCord`) |
| `organisms` | (08-20) | organism render-mode config + deterministic output + a concurrent-perf tripwire |

As of 2026-09-02, **33 suites pass** (`tools/party-tests/wiring.test.js` came with The Wiring Network organism on
`feature/organisms-network`). As of 2026-08-20, 32 suites passed — `organisms.test.js` was added with the organism
render modes (`web/viz/organisms.js`, wired into the party ambient, mixable from the
dashboard). It was **31** as of 2026-08-12 when `synth.test.js` landed with the synth
patchbay. Those work logs live in `STATE.md`, not here.

As of 2026-08-31, **33 suites pass** — `tools/party-tests/game.test.js` was added
with the standalone Part Game arcade (`web/game.html`, a separate 4-button surface that
unlocks spirals). It rides the party-test runner by house convention, but the party
installation itself is untouched.

As of 2026-09-08, **41 suites pass** — `tools/party-tests/play.relay.test.js` and `play.test.js`
came with the phone-controller spine (a phone joins a room and drives a game on the screen; the relay
rejects string values so no free text crosses — the display firewall, made structural).

As of 2026-09-08, **39 suites pass** — `tools/party-tests/garden.test.js` and `params.test.js`
came with the contribution garden (a won game plants its spiral into the party visual; it persists
and recurs — the "becomes real" loop's landing side, verified headless).

As of 2026-09-04, **37 suites pass** — `tools/party-tests/colorfield-map.test.js` came with
the colour-commanding floorplan (`web/colorfield.html`, driving the C# `FieldProjectionLayer`
over `/api/effects/field`; see `docs/COLORED-SHADOWS.md` and `docs/LIGHTING.md` §4).

As of 2026-09-02, **36 suites pass** — the game, menu and wiring suites are all in one
tree now that every branch is merged into `main`.

As of 2026-09-01, **34 suites pass** — `tools/party-tests/menu.test.js` was added with the
Part Game category menu + completion-% framework (`web/menu.html`, `web/menu-progress.js`).
Same standalone 4-button surface; the party installation is still untouched.

**The rule the checker enforces is deliberately weak:** a doc may say what was true when it
was written — `19 suites pass` in §20 stays. What it may not do is *never* mention the
current number. History is preserved; staleness is caught. See `check_suite_counts` for why
the strict version was written first, reported 12 problems, and all 12 were false.

## The three room games — Jackbox on the spine (2026-09-09)

On the phone-controller spine, the big-screen HOST side + the first three real games:
**Predict the Room** (Guesspionage — secret yes/no, then dial the room's %), **Wavelength**
(an Oracle privately sees a CHAOS↔ORDER target, says one word aloud, the room dials to read
them), **The Mind → Bloom** (secret per-player numbers, plant ascending with no talking →
phyllotaxis blooms). `web/room.html` + `web/roomhost.js` (pure `RoomHost` core + wiring) +
`web/roomgames/*`. One additive relay change — `/play/pub` gained an optional `player` to
down-address one phone (hidden info); room-wide is still the default. New suite `room.test.js`
+ a per-player assertion in `play.relay.test.js`; **42 suites pass**, all four screens shot in
headless Chrome. Firewall intact: only numbers/geometry cross, on-screen text is prompts + a
costume MC voice. Players are emoji+colour critters, never typed names.
