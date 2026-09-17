# LIGHTING — how the house drives the real lamps

The lamps express one number: **`order`**, 0 = chaos, 1 = symmetry/regulation.
Everything else is how that number gets computed, masked, and flooded into the room.

Verified against `web/house.js` on 2026-07-17, against the `Hue program` repo's
`feature/party-installation` branch (which carries the reward channel and the beds
forward from `feature/transient-effects`, plus the party energy coupling; the
07-17 pass predated all of it and said `emotion-hue`). Where this doc and the
code disagree, the code is right — fix this doc.

## The chain

```
Gallery σ + house state → lightOrder() → emitLights() → POST /api/effects/{run,params}
    → C# Hue program (feature/party-installation branch, :5000) → SuperfluidFlowLayer → lamps
```

## 1. `lightOrder()` — what the lamps *should* say

```
truth = clamp(0.5 + symmetry*0.35 + regulation*0.35
                  - entropy*0.5 - sensoryLoad*0.25 - rumination*0.15, 0, 1)
```

Calming anything cools the room; chaos heats it. Then the **mask** intervenes: a
masked house *looks* composed, so the shown order is pulled toward a
calm-but-not-serene **0.6** by `mask * 0.7` — unless the mask **slips**
(`entropy > 0.7` and a sine-driven flicker), in which case the raw `truth` leaks
out. Returns `{order, slip, truth}`.

This is the endocrine/mask model made physical: the room can be lying about how it
feels, and occasionally fails to.

## 2. `emitLights()` — the continuous mapping

Runs at up to ~7 Hz (`_lightAcc >= 0.14`), dropping to 2 Hz when idle. All lerps are continuous in `order`:

| Param | Driven by | Range | Meaning |
|---|---|---|---|
| `color` hue | `order` | 26° → 220° | the amber↔blue spine (kept) |
| `color` sat | endocrine `sat` (narrativeCertainty, regulation, −fatigue) | 0.55 → 0.97 | **certainty deepens colour** |
| `color` light | endocrine `bright` **+ dopamine × 0.34** | 0.22 → 0.92 | **THE REWARD CHANNEL** |
| `speed` | endocrine `a` (arousal) | 0.22 → 1.35 | urgency, not calm |
| `spread` | `entropy` | 0.20 → 0.60 | things coming apart |
| `flowIntensity` | valence **+ dopamine × 0.45** | 0.45 → 1.0 | the flood surges |

**Overhauled 2026-07-20.** Every parameter used to come off the single `order`
scalar, so all 26 state variables collapsed to one amber↔blue slider and every
event produced an identical gesture — a resolved star, a walked case and the
phase-3 reveal were visually the same thing. Meanwhile `endocrine()` was already
computing a four-dimensional affect field that the lamps ignored entirely.

The C# layer live-tunes only four params, and none of them is brightness — but
`color` is HSL and its **lightness was pinned at 0.55**, an entire unused
dimension. That is now the reward channel.

Responsiveness: the old 0.5s throttle + 0.05 deadband could swallow a reward
whole, since dopamine decays in ~2s. `emitLights` now samples fast (≈7 Hz) while
the house is actually moving and falls back to 2 Hz when idle.

Earned payoffs are choreographed in **`web/field/moments.js`** — the reward
counterpart to `agency.js`. Moments do **not** seize the lamps; they push the
organism and the ambient model renders the flare itself, so every photon stays
an honest readout. A stressed house therefore mutes your reward, deliberately.

**Sparkle overlay** rides on top when `order < 0.4` — extra busyness in chaos.

### Soft patch vs. hard switch — the thing that matters

Most ticks are a **soft param patch** (`Hue.runEffectParams` → `/api/effects/params`).
The layer's tide phase keeps running server-side, so retuning colour/speed **never
resets or flashes**. Only genuine transitions take the hard `Hue.runEffect` path
(`/api/effects/run`, `DurationSeconds: 8`):

- first connect (`_lastOrder < 0`)
- a mask slip
- the Sparkle overlay toggling in or out

**Rate limiting:** skip the emit entirely unless `slip`, or `|order - _lastOrder| >= 0.05`,
or 6s have passed (keepalive, so the layer never lapses).

Everything is `try`-wrapped — an offline Hue never throws, the house keeps thinking.

Rooms that drive their own scenes (Feelings, Decks) are excluded by `brain.js`.

## 3. The C# side — `SuperfluidFlowLayer`

Lives on the **`feature/party-installation` branch** of the `Hue program` repo (a
*separate repo*, not vendored here; the layer itself landed earlier on
`emotion-hue`, carried forward through `feature/transient-effects`). `Priority = 0`
— ambient base, same slot Twinkle used to hold.

This is what makes "superfluid from screen to corner" real, and it's why the spatial
work belongs in C#, not JS: the layer knows the room's **actual geometry**.

- **Origin detection:** finds the screen by light *name* — matches `tv`, `screen`,
  `scherm`, `monitor`, `display`. If your lamp isn't named one of those, the flood
  starts from the wrong place. This is the first thing to check when it looks wrong.
- Builds per-light `(direction, maxDistance)` from origin toward the room's corners.
- **Attack = 3.0s:** on activation, brightness *eases* up instead of snapping —
  direct response to K.'s "too harsh when the lights jump on" feedback. Keyed to
  `_elapsed`, which `OnActivate` resets but `ApplyLiveParams` does **not** — so live
  tuning never re-triggers the fade. Only a genuine scene change does.

### `ApplyLiveParams` contract (`ILiveTunable`)

All values arrive as **strings**, parsed invariant-culture. Unknown keys ignored.

| Key | Range (clamped) | Default |
|---|---|---|
| `color` | hex, leading `#` trimmed | `00BFFF` |
| `speed` | 0.05 – 3.0 | 0.35 |
| `spread` | 0.05 – 1.0 | 0.35 |
| `flowIntensity` | 0.0 – 1.0 | 0.8 |

Note `house.js` sends `speed` up to 1.1 and `spread` up to 0.55 — both well inside
range, no clipping.

## 4. Colour commanding — `FieldProjectionLayer` (the colored-shadow rig)

`SuperfluidFlowLayer` colours every lamp from ONE palette laid out by distance-from-screen
— there is no way to say "this lamp red, that one cyan". `FieldProjectionLayer` (C#, added
2026-09-04) adds that: it holds a list of **placed colour points** `{x, y, radius, falloff,
intensity, color}` in the normalized room plane, and for each lamp blends the points that
reach it — **additive** light (red+cyan → white, two reds → a brighter red), split into a
normalized hue + a brightness magnitude so a faint point stays its colour instead of going
dark. Priority 1, so it paints over the ambient only where points land; unreached lamps fall
through to the ambient below (compositing is overwrite, no alpha). Built for the
colored-shadow installation — see `docs/COLORED-SHADOWS.md`; this is the DREAMS §2 field made
real (camera-follow auto-drive is a later, separate driver).

- **Endpoint:** `POST /api/effects/field` `{ points:[{x,y,color,radius,falloff,intensity}],
  intensity }` replaces the whole set; an empty/absent list clears it. `GET` returns the
  current set. `applied:false` means nothing is rendering to attach to — start an ambient
  first. Driven from `HueEngine.ApplyField` (find-or-add the layer on the active renderer,
  like `Identify` but sustained).
- **Not in `LayerRegistry`** on purpose — its payload is a point LIST, not scalar params, so
  it is not a catalog effect (same as `IdentifyLayer`). It has its own endpoint instead.
- **Control page:** `web/colorfield.html` + `web/colorfield.js` — a floorplan (sibling of
  `web/lights.html`) to drop/drag/colour points and save preset rigs. It **mirrors** the C#
  blend in JS so each lamp dot shows its predicted colour without the room; the mirror is
  pinned by `tools/party-tests/colorfield-map.test.js`. If the mirror and the C# layer drift,
  that test is what to fix — same discipline as `lightsmap.test.js` mirroring Superfluid.
- Only the ~5 entertainment-stream lamps take part; an unmapped lamp (all-zero position) is
  skipped. The slew limiter smooths point motion for free.

## Gotchas

- **For the party, the `Hue program` repo must be on the `feature/party-installation`
  branch — not `feature/transient-effects`.** `SuperfluidFlowLayer` and
  `/api/effects/params` need `emotion-hue` **or later**; `/api/effects/pulse` (the
  whole reward channel), alpha compositing, `EnvelopeLayer` and `SustainLayer`
  (the beds) exist on `feature/transient-effects` **or later**. On `master` or
  `party-effects` the soft-patch endpoint 404s and the lamps do nothing. On
  `feature/transient-effects` the lamps work, every earned moment and every bed
  fire correctly — **but `/api/energy` 404s**, so the party's business→brightness
  coupling silently never moves. That is the more expensive failure of the two,
  because it looks like the piece is running correctly: colour still lands, the
  reward channel still fires, and only the energy coupling is dead. A 404 on
  `/api/energy` is the tell.
- **No CT path in the fork.** "Cooler" means a blue RGB hue, not a colour temperature.
- The old `Twinkle` path (and its arousal double-remap bug) is **gone** from
  `emitLights`. Any doc or memory still describing Twinkle params
  (`minBrightness`/`maxBrightness`) is stale.

## Status

Mapping verified headless. **Live ramp on real lamps still untested** — needs the
bridge. Treat the feel of the numbers above as intent, not measurement.

---

## Where the truth lives

- **`docs/HUE-API.md`** — GENERATED from the live app (`python tools/gen_light_reference.py`).
  Every layer, every parameter, every range. This file is prose *about* the design;
  that file is the contract. When they disagree, that one is right.
- **`node tools/check_light_params.js`** — validates everything `moments.js` sends
  against the live registry. Ranges are NOT enforced server-side, so an out-of-range
  value renders wrong while returning 200.
- `extracted/hue_api.md` — **DEAD. Do not read.** Superseded by `docs/HUE-API.md`.
