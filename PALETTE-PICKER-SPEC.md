# PALETTE PICKER — technical spec (grounded in the code)

_Day-one tool for the friend visit. Live-recolor the running scene from the atlas.
All line refs are `web/…` as of 2026-09-18. Scope (K.): pick a scheme → applies to the
running scene instantly._

## The one fact that makes this small

**Colour has a single source: `PARTY.activeLight().palette`.** Both surfaces read it:
- **Screen** — `activeSpiral()` returns `{…, palette: light.palette}` (party.js 1353–1384);
  the director colours everything via `SYM.orderColor(sigma, palette)` (symmetry.js 2932, 3012).
- **Lamps** — party-main's `lampPalette(PARTY.activeLight())`.

So **recolor the active light-scene = recolor screen AND room together, in one move.**

## The live hook (already exists — no engine surgery)

```js
PARTY.apply({ cmd: "setActive", mode: "light", id: <lightId> });   // party.js 1446–1449 pins activeLightId
```
party-main already routes dashboard commands through `PARTY.apply`, so the picker can call this
directly in-page (or over the `/party` relay for the phone).

## Smooth recolor is FREE (satisfies K.'s "no hard seams")

Switching light-scenes already **crossfades**: `PARTY.fading()` + `PALETTES.mixPalette(a,b,t)`,
which mixes in **HSV along the shortest hue path** (palettes.js 138–189) — specifically to avoid
the grey-mud a plain RGB lerp hits between two saturated colours. So a picker that switches the
active light gets a gliding recolor with zero extra work. Do NOT build a separate fade.

## ⚠ The one gotcha (quality flag)

**Attract/auto mode overwrites a pinned palette.** `_autoPick` reassigns `activeLightId`
(party.js 935), so a pin made while `PARTY.auto === true` gets clobbered on the next dwell.
→ The picker must set **manual** first: `PARTY.apply({ cmd: "auto", value: false })` (party.js
1423–1430), then `setActive`. Otherwise the recolor looks like it "randomly reverts."

## Reaching all 12 schemes (and a custom gig grade)

`setActive` today reaches only the **6 named LIGHTS** entries, each mapped to one atlas
`paletteId` (party.js 75–80). To expose all 12 atlas schemes to the picker:
- **Simplest:** add light entries `{ id, paletteId, u:true }` for the missing schemes (data add,
  party.js LIGHTS array), or
- carry an **inline `_palette`** on the entry — the pattern already exists for generated schemes
  (party.js 360 `entry._palette`, 698). A thin `PARTY.setPalette(colorsOrId)` that pins an inline
  `_palette` + flips to manual is the clean general version.
- **Custom (day-two):** the gig grade (forest-green / cream / pastel-neon) = author one scheme in
  `palettes.js` SCHEMES (xy roles → baked to hex) or mint via `PALETTES.generate(seed, jitter)`.

## The atlas API (what the picker reads)

`window.PALETTES`:
- `.all()` → `[{ id, mood, colors:[hex…4–5], hex:{primary,secondary,bridge,accent}, contrastNorm, speedNorm }]`
- `.ids`, `.get(id)`, `.generate(seedIndex, jitter)`, `.mix(a,b,t)`, `.mixPalette(a,b,t)`, `.hueOf`

## Build shape (day-one, ~1h via prompting with the friend)

- `web/palette-picker.js`, loaded in `player.html` (the canon director-host). Non-invasive, like
  `scene-registry.js`.
- UI: a swatch strip (one chip per `PALETTES.all()`, rendered from `.colors`), projection-safe
  styling copied from `#scene-picker` (opacity .22, hover to full). Click a chip →
  `PARTY.apply({cmd:"auto",value:false})` then `PARTY.apply({cmd:"setActive",mode:"light",id})`.
- Expose the 12 (add LIGHTS entries or a `setPalette`). Confirm the pin holds in manual before demo.

## Confirm before wiring (5 min)
- `_resolveLightId` / `_palNow` (party.js 1274, 1342–1347) honour a hand-pinned `activeLightId`.
- The fade actually triggers on a `setActive` light change in this build (`PARTY.fading()`).
