# HUE API — generated reference

> **GENERATED FILE — do not hand-edit.**
> `python tools/gen_light_reference.py` (needs the Hue app running on :5000)

> Generated 2026-07-24 · C# branch `feature/party-installation` · bridge: Connected: 5 lights streaming

Four hand-written docs described this API before this one and all four were
wrong in ways that cost hours. The layer catalog below comes straight from
`GET /api/effects`, which the app generates from `LayerRegistry.cs`, so it
cannot drift. If something here looks wrong, the app changed — re-run the
generator rather than editing this file.

## The one thing that bites

**Parameter ranges are not enforced.** `ApplyParams` in `Program.cs` parses
your value and assigns it straight through, with no clamp to the Min/Max
below. An out-of-range value is accepted, returns `200 OK`, and renders
wrong. Brightness params are on a **10–100 percent** scale — sending `1.0`
means **1%**, not full. That is exactly how every reward pulse in this
installation was invisible for a whole session.

Validate before shipping: `node tools/check_light_params.js`

## Branch requirement

The optional C# Hue app lives in a separate repository and is not included here.
For the party it must be on **`feature/party-installation`** — not
`feature/transient-effects`.

- `SuperfluidFlowLayer` + `/api/effects/params` — need **`emotion-hue`** or later.
- `/api/effects/pulse` (transient effects, the whole reward channel) and
  alpha compositing + `EnvelopeLayer` — need **`feature/transient-effects`** or later.
- `/api/energy` (this file's own catalog, above) exists **only** on
  `feature/party-installation` — it is missing on `feature/transient-effects`,
  which is 3 commits behind. `web/party-main.js` pushes to it on every
  business change; that push is the entire business→brightness coupling.

On the wrong branch the app still answers normally and the lamps still take
colour via `/api/effects/params` — nothing looks broken from the browser.
But `/api/energy` 404s, so `SceneRenderer.GlobalEnergy` never moves and the
business→brightness coupling is silently dead the whole session. **A 404 on
`/api/energy` is the tell** — check that first when effects don't appear.

## Endpoints (scraped from Program.cs)

| method | path |
|---|---|
| GET | `/api/areas` |
| POST | `/api/areas/{index:int}` |
| GET | `/api/auto` |
| POST | `/api/auto/{enabled:bool}` |
| GET | `/api/bpm` |
| POST | `/api/bpm/{value:int}` |
| GET | `/api/brightness` |
| POST | `/api/brightness/{value:double}` |
| POST | `/api/checkin` |
| POST | `/api/connect` |
| GET | `/api/effects` |
| POST | `/api/effects/params` |
| POST | `/api/effects/run` |
| GET | `/api/energy` |
| POST | `/api/energy/{value:double}` |
| GET | `/api/lights` |
| GET | `/api/mood/status` |
| POST | `/api/mood/{name}` |
| GET | `/api/moods` |
| GET | `/api/presets` |
| POST | `/api/presets/save/{name}` |
| DELETE | `/api/presets/{name}` |
| POST | `/api/presets/{name}` |
| DELETE | `/api/queue` |
| GET | `/api/queue` |
| POST | `/api/queue` |
| POST | `/api/queue/loop/{enabled:bool}` |
| POST | `/api/queue/reorder` |
| POST | `/api/queue/run` |
| GET | `/api/queue/status` |
| POST | `/api/queue/stop` |
| DELETE | `/api/queue/{index:int}` |
| GET | `/api/scenes` |
| POST | `/api/scenes/{name}` |
| POST | `/api/shuffle/{enabled:bool}` |
| POST | `/api/sky` |
| GET | `/api/status` |
| POST | `/api/stop` |

**Known API traps**, from the audit — all of these return success and do nothing:

- `POST /api/effects/run` **ignores `DurationSeconds`** on the preview path;
  the effect runs until something replaces it.
- `POST /api/effects/pulse` returns `pulsed:false` when no scene is running,
  and `pulsed:true` cannot promise the scene is still *alive*.
- `POST /api/effects/params` silently ignores unknown keys and returns
  `softUpdate:true` having applied nothing.
- `POST /api/brightness/{v}` sets a **static, process-wide, dimming-only**
  multiplier. `/api/brightness/0` blacks out every effect until restart.
- `POST /api/stop` does not stop queue playback — use `/api/queue/stop`.

## Ambient layers (14)

One ambient at a time. Only `Superfluid` is live-tunable via `/effects/params`;
changing any other ambient's params requires a full scene rebuild.

### `None` — None (Dark)

_(no parameters)_

### `AmbientBreath` — Breath

| param | type | range | default |
|---|---|---|---|
| `breathPeriod` | Double | 3 – 30 | `10` |
| `colorCyclePeriod` | Double | 10 – 120 | `40` |
| `breathMin` | Double | 0 – 50 | `12` |
| `breathMax` | Double | 10 – 100 | `42` |

### `AmbientStatic` — Static

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FFFFFF` |
| `brightness` | Int | 1 – 100 | `70` |

### `ColorCycle` — Color Cycle

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `cyclePeriod` | Double | 2 – 60 | `10` |
| `spatialSpread` | Double | 0 – 3 | `1` |
| `brightness` | Int | 1 – 100 | `70` |

### `Fire` — Fire

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FF4500` |
| `brightness` | Int | 10 – 100 | `55` |

### `RainbowWave` — Rainbow Wave

| param | type | range | default |
|---|---|---|---|
| `speed` | Double | 0.05 – 1 | `0.15` |
| `spatialScale` | Double | 0 – 2 | `0.5` |
| `brightness` | Int | 1 – 100 | `80` |

### `Aurora` — Aurora

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `speed` | Double | 0.01 – 0.3 | `0.05` |
| `spread` | Double | 0.2 – 3 | `1` |
| `brightness` | Int | 10 – 80 | `50` |

### `Plasma` — Plasma

| param | type | range | default |
|---|---|---|---|
| `speed` | Double | 0.1 – 2 | `0.5` |
| `scale` | Double | 0.2 – 3 | `1` |
| `brightness` | Int | 20 – 100 | `80` |

### `LivingColor` — Living Color

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `cyclePeriod` | Double | 10 – 120 | `40` |
| `spatialSpread` | Double | 0 – 3 | `0.8` |
| `breathPeriod` | Double | 5 – 60 | `16` |
| `breathDepth` | Double | 0 – 0.5 | `0.15` |
| `brightness` | Int | 10 – 100 | `55` |
| `twinkleRate` | Double | 0 – 2 | `0.2` |
| `twinkleDuration` | Double | 1 – 8 | `3` |
| `twinkleBoost` | Int | 0 – 40 | `15` |

### `Twinkle` — Twinkle

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FFFFFF` |
| `speed` | Double | 0.2 – 4 | `1` |
| `minBrightness` | Int | 1 – 50 | `10` |
| `maxBrightness` | Int | 20 – 100 | `80` |

### `Superfluid` — Superfluid Flow

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `00BFFF` |
| `palette` | Palette | comma-separated hex | _see note_ |
| `speed` | Double | 0.05 – 3 | `0.35` |
| `spread` | Double | 0.05 – 1 | `0.35` |
| `flowIntensity` | Double | 0 – 1 | `0.8` |
| `colorSpan` | Double | 0.1 – 4 | `1` |
| `colorDrift` | Double | 0 – 1 | `0.05` |
| `brightBand` | Double | 0 – 1 | `0.3` |

### `OnSwitchCloud` — On-Switch Cloud

_(no parameters)_

### `CloudySky` — Cloudy Sky

| param | type | range | default |
|---|---|---|---|
| `cloudDensity` | Double | 0 – 1 | `0.5` |
| `sunStrength` | Double | 0 – 1 | `0.6` |
| `blueBias` | Double | 0 – 1 | `0.2` |
| `greyBias` | Double | 0 – 1 | `0.2` |
| `warmthBias` | Double | 0 – 1 | `0` |
| `movementSpeed` | Double | 0 – 1 | `0.35` |
| `brightnessFloor` | Double | 0 – 1 | `0.35` |
| `brightnessCeil` | Double | 0 – 1 | `0.85` |
| `instability` | Double | 0 – 1 | `0.25` |
| `shadowContrast` | Double | 0 – 1 | `0.6` |
| `haze` | Double | 0 – 1 | `0.15` |
| `skyTemperature` | Double | 3000 – 9000 | `6300` |
| `heightThreshold` | Double | 0 – 0.95 | `0.55` |
| `sunStyle` | Int | 0 – 2 | `0` |

### `DriftingClouds` — Drifting Clouds

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `scale` | Double | 0.2 – 3 | `0.9` |
| `driftSpeed` | Double | 0 – 0.3 | `0.035` |
| `evolveSpeed` | Double | 0 – 0.1 | `0.012` |
| `minBri` | Int | 0 – 60 | `18` |
| `maxBri` | Int | 20 – 100 | `75` |

## Effect layers (20)

Up to two at once (`EffectType`, `EffectType2`), plus any number of transient
layers fired through `/effects/pulse`. All composite *over* the ambient.

### `Sparkle` — Sparkle

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FFD890` |
| `brightness` | Double | 10 – 100 | `65` |
| `flashDuration` | Double | 0.5 – 5 | `2.8` |
| `spawnRate` | Double | 0.1 – 4 | `0.4` |

### `Chase` — Chase

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FF0000` |
| `delay` | Double | 50 – 2000 | `300` |
| `clockwise` | Bool | `true` / `false` | `true` |

### `Wave` — Wave

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `00BFFF` |
| `speed` | Double | 0.2 – 5 | `1.5` |
| `waveWidth` | Double | 0.1 – 2 | `0.4` |
| `peakBrightness` | Int | 1 – 100 | `100` |

### `Pulse` — Pulse

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `4060FF` |
| `frequency` | Double | 0.1 – 3 | `0.8` |
| `waveNumber` | Double | 0.5 – 8 | `3` |
| `minBri` | Int | 0 – 50 | `10` |
| `maxBri` | Int | 20 – 100 | `90` |

### `Strobe` — Strobe

| param | type | range | default |
|---|---|---|---|
| `syncBpm` | Bool | `true` / `false` | `true` |
| `bpm` | Int | 20 – 240 | `128` |
| `dutyCycle` | Double | 0.01 – 0.5 | `0.15` |
| `color` | Color | hex, no `#` | `FFFFFF` |
| `brightness` | Int | 1 – 100 | `100` |

### `TheaterChase` — Theater Chase

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FFFFFF` |
| `groupSize` | Int | 2 – 8 | `3` |
| `stepSpeed` | Double | 0.1 – 20 | `4` |
| `brightness` | Int | 1 – 100 | `100` |
| `clockwise` | Bool | `true` / `false` | `true` |

### `Comet` — Comet

| param | type | range | default |
|---|---|---|---|
| `headColor` | Color | hex, no `#` | `FFFFFF` |
| `tailColor` | Color | hex, no `#` | `6020FF` |
| `speed` | Double | 0.03 – 3 | `0.3` |
| `tailLength` | Int | 1 – 10 | `4` |
| `headBrightness` | Int | 10 – 100 | `100` |
| `clockwise` | Bool | `true` / `false` | `true` |

### `Lightning` — Lightning

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `E0E8FF` |
| `minCooldown` | Double | 0.5 – 10 | `2` |
| `maxCooldown` | Double | 1 – 20 | `6` |
| `minFlashes` | Int | 1 – 10 | `1` |
| `maxFlashes` | Int | 1 – 20 | `4` |

### `ColorSwap` — Color Swap

| param | type | range | default |
|---|---|---|---|
| `colorA` | Color | hex, no `#` | `FF0040` |
| `colorB` | Color | hex, no `#` | `00FF80` |
| `swapInterval` | Double | 0.1 – 5 | `1` |
| `brightness` | Int | 1 – 100 | `90` |

### `BeatPulse` — Beat Pulse

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FFFFFF` |
| `syncBpm` | Bool | `true` / `false` | `true` |
| `bpm` | Int | 20 – 240 | `128` |
| `decayPower` | Double | 0.5 – 6 | `2` |
| `brightness` | Int | 10 – 100 | `100` |

### `Ripple` — Ripple

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `00FFFF` |
| `rippleRate` | Double | 0.1 – 3 | `0.5` |
| `speed` | Double | 0.3 – 5 | `1.2` |
| `ringWidth` | Double | 0.1 – 1.5 | `0.3` |
| `brightness` | Int | 20 – 100 | `100` |

### `Bounce` — Bounce

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `0080FF` |
| `speed` | Double | 0.2 – 4 | `1` |
| `useYAxis` | Bool | `true` / `false` | `false` |
| `bandWidth` | Double | 0.1 – 2 | `0.5` |
| `brightness` | Int | 20 – 100 | `100` |

### `Meteor` — Meteor

| param | type | range | default |
|---|---|---|---|
| `headColor` | Color | hex, no `#` | `FFFFFF` |
| `tailColor` | Color | hex, no `#` | `2020FF` |
| `count` | Int | 1 – 8 | `3` |
| `speed` | Double | 0.3 – 4 | `1.5` |
| `tailLength` | Int | 1 – 8 | `3` |

### `Disco` — Disco

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `changeRate` | Double | 0.5 – 20 | `4` |
| `brightness` | Int | 20 – 100 | `90` |

### `Siren` — Siren

| param | type | range | default |
|---|---|---|---|
| `colorA` | Color | hex, no `#` | `FF0000` |
| `colorB` | Color | hex, no `#` | `0000FF` |
| `flashRate` | Double | 0.5 – 8 | `2` |
| `brightness` | Int | 20 – 100 | `100` |

### `Scanner` — Scanner

| param | type | range | default |
|---|---|---|---|
| `headColor` | Color | hex, no `#` | `FF2000` |
| `glowColor` | Color | hex, no `#` | `400000` |
| `speed` | Double | 0.3 – 20 | `6` |
| `glowWidth` | Int | 0 – 3 | `1` |
| `brightness` | Int | 20 – 100 | `100` |

### `Fireworks` — Fireworks

| param | type | range | default |
|---|---|---|---|
| `palette` | Palette | comma-separated hex | _see note_ |
| `burstRate` | Double | 0.1 – 2 | `0.3` |
| `radius` | Double | 0.5 – 4 | `2` |
| `brightness` | Int | 20 – 100 | `100` |

### `Heartbeat` — Heartbeat

| param | type | range | default |
|---|---|---|---|
| `color` | Color | hex, no `#` | `FF0030` |
| `syncBpm` | Bool | `true` / `false` | `true` |
| `bpm` | Int | 20 – 240 | `72` |
| `brightness` | Int | 10 – 100 | `100` |

### `Rain` — Rain Drops

| param | type | range | default |
|---|---|---|---|
| `rainbow` | Bool | `true` / `false` | `true` |
| `color` | Color | hex, no `#` | `9FCBFF` |
| `spawnRate` | Double | 0.1 – 20 | `3` |
| `dropLife` | Double | 0.2 – 4 | `1.1` |
| `brightness` | Int | 20 – 100 | `95` |

### `RainbowArc` — Rainbow Arc

| param | type | range | default |
|---|---|---|---|
| `sweepPeriod` | Double | 4 – 120 | `22` |
| `bandWidth` | Double | 0.1 – 1 | `0.45` |
| `brightness` | Int | 20 – 100 | `90` |
| `saturation` | Double | 0 – 1 | `0.9` |

## Palette note

`ParameterValue` seeds three colours (`FF2040`, `40FF80`, `4060FF`)
unconditionally, and the registry factories only fall back to a layer's own
palette when the list is *empty*. So ColorCycle / Aurora / LivingColor /
Disco / Fireworks **never** use their built-in defaults unless you send
`"palette": ""` explicitly. Labels saying "leave empty for default" are
inverted from the real behaviour.
