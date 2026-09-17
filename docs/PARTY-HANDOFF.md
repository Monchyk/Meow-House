# PARTY INSTALLATION — HANDOFF

> **Start here.** Written 2026-07-24 to close a long session. This is the single
> cold-start document for the party branch: what it is, what works, what to watch
> out for, what's left, and what only K. can decide.
>
> **Read order:** this file → `docs/PARTY-BRIEF.md` (the full design record +
> architect decisions) → `STATE.md` (volatile status). `docs/HUE-API.md` is the
> generated light-API truth — never trust a hand-written light doc.

---

## 0. COMMITTED — and a note on credentials

**All work is committed** on `feature/party-installation` in both repos
(2026-07-24), separated by subsystem rather than by session — the branch history
reads as *what the code is*, while the iteration story (including superseded
attempts) lives in `PARTY-BRIEF.md` §11–17.

| Deep-House | |
|---|---|
| `e9ddd80` | the engine + the palette atlas |
| `f6df5aa` | the screen — role-aware spiral, host loop, lamp push |
| `cea0898` | curator dashboard + cross-device relay |
| `722e8e4` | the headless test suite |
| `98ddf24` | design record, handoff, state |
| `7184f51` | listen.py — credentials loaded, not hardcoded |
| `c28bcd5` | the zoom pendulum (engine + dashboard) |

| Hue program | |
|---|---|
| `fe666f2` | Superfluid: port onto party-effects + carry colour |
| `a8c72f8` | live-tune path + dead-browser backstop |

**Nothing is pushed.** Both branches are local only.

### ⚠ Credentials — read before pushing anywhere

- **`controller/listen.py` no longer holds a key.** During setup the real bridge
  `APP_KEY` was pasted into it. It was **scrubbed before the first commit**, so it
  never entered Deep-House history. The file now loads credentials from
  `controller/config.json` (already gitignored — the same file `serve.py` uses for
  the music folder) or `DEEPHOUSE_BRIDGE_IP` / `DEEPHOUSE_APP_KEY`. Your real
  values are in that local file; `config.example.json` documents the shape.
  **Do not paste a key back into `listen.py` — it is committed.**
- **The `Hue program` repo is a different story.** The same `APP_KEY` is hardcoded
  in `HueEngine.cs` and has been **in that repo's history since commit `2afe906`**,
  long before this work. That is pre-existing and was not introduced here, but it
  means the Hue repo cannot go public without a history rewrite. The repo also
  carries `PCAPdroid_*.pcap` and `puts.tsv`, which hold the key in cleartext —
  there is a standing note from K. to delete those before any push.
- Deep-House has its own separate blocker for going public: `extracted/`. See the
  repo boundary section of `CLAUDE.md` — this is not a "delete the folder" job.

---

## 1. What the piece is

A **party sibling** of Deep House. One decaying "business" state drives two
surfaces — a **screen spiral** and the **physical Hue lamps** — from one brain.
Left alone it winds down toward standstill; people push back with a 4-button Hue
remote. **Atmospheric, NOT a carnival**: the lamps physically dominate the room,
so almost everything must be slow and steady. Motion spikes are earned, never
ambient.

Two curated **playlists** (spirals / light-scenes) of uneven length cycle
independently and **phase** against each other. Committing an item **unlocks**
another — exploring grows the catalog.

---

## 2. How to run it

```
1. C# Hue app        — branch feature/party-installation (REBUILD if source changed)
2. python controller/serve.py                       (:8800)
3. screen:    http://localhost:8800/party.html      (+ ?debug&fast while testing)
   dashboard: http://<host>:8800/dashboard.html     (phone/laptop, cross-device)
```

**Keyboard (always works):** `↑`/`↓` hold = drive business · `P` = mode ·
`H` = cycle · `⇧H` = commit · `D` = debug HUD.
**URL flags:** `?debug` HUD on load · `?fast` decay in ~40 s instead of ~30 min ·
`?manual` start without attract mode.
**Attract mode is ON by default** — the room walks all 38 shapes and every light-scene on
its own, 25–45 s each, no remote needed (PARTY-BRIEF §19.4). Dashboard has stop / skip.
**Remote:** `python controller/listen.py --party` (real button ids are in the file, read off
the bridge in `control_id` order; still needs one live press-test).

**Tests:** `node tools/party-tests/run.js` → 26 suites, all passing (2026-07-26).

> **Since this handoff was written (2026-07-24), two things landed. Read them before
> assuming this document is current:**
> - **The room was looked at for the first time** — 12 live answers in
>   `docs/TASTE-LOG.md`; what is still unbuilt in `docs/TASTE-SESSION.md`. Four of
>   those answers are deliberately not yet code.
> - **A master tempo** — `PARTY.config.bpm`, default 48 (120 = the old speed).
>   Everything on screen, in the cards and on the lamps now runs off one dial.
>   `docs/PARTY-BRIEF.md` §22.

---

## 3. Architecture — where things live

**The engine is web-authoritative** (Fable's Q1). `party.js` owns state; the C#
app is a smooth renderer. Nothing but state flows down; no logic lives in C#.

| File | Role |
|---|---|
| `web/party.js` | **The engine.** business decay, pendulum, playlists, unlock, neglect, `snapshot()`/`apply()`. Pure — runs in node. |
| `web/palettes.js` | The 12-scheme CIE-xy atlas + xy→sRGB + the 5-role generator. Pure. |
| `web/party-main.js` | Host loop: drives the screen, pushes to lamps, HUD, dashboard sync. Browser-only. |
| `web/viz/symmetry.js` | The screen. `AmbientDirector` + role-aware `orderColor` + `drawSuperfluidBloom` (the "nucleus"). |
| `web/dashboard.{html,js}` | Curator UI — a **thin client**, never runs the engine. |
| `controller/serve.py` | Static + `/api` proxy + `/party/pub`+`/party/sub` relay. |
| `controller/listen.py` | Remote → `/party/pub` (`--party`). |
| `…/Layers/SuperfluidFlowLayer.cs` | The **only** lamp ambient. `ILiveTunable`. |
| `…/Services/SceneRenderer.cs` | `GlobalEnergy` + the anti-strobe slew limiter. |

**Data flow:** remote/keyboard → `PARTY` → (screen directly) + (`hue.js` →
serve.py `/api` proxy → C# `/api/effects/params` → `SuperfluidFlowLayer`).
Dashboard ⇄ master over serve.py's `/party` SSE relay (cross-device).

---

## 4. What's built and verified

**Verified headless** (26 suites) **and C# compiles clean.** Not all verified on
real lamps — see §5.

- Engine: decay to floor, auto-recover, two phasing playlists, unlock + generator
  overflow, localStorage persistence, toasts.
- **Palette atlas**: 12 schemes, xy→sRGB, per-role luminance, deterministic generator.
- **σ pendulum**: the pattern resolves↔dissolves across the **full** spectrum;
  business sets the *rate*, `swingRange` narrows the band deliberately.
- **Live cycling**: `H` swaps spiral/palette instantly; commit pins what's shown.
- **Colour tide** (§15 of the brief): brightness holds steady, **colour moves**
  across the room. Unmapped lamps spread around the palette instead of matching.
  *K. confirmed on real lamps: the strobe is gone.*
- **Spatial palette on screen** (§16–17): `orderColor(...)` returns a colour that also
  carries **`at(u)`**, so an exhibit colours its own elements — the picture was
  monochrome *by construction* before, however rich the scheme. **All 13 AmbientDirector
  pool exhibits** are polychrome, colour bound to each one's own structure (lorenz by
  height, boids per bird, chladni by radius) rather than to iteration order, which
  strobes. Off the party branch `at()` is the identity, so Deep House's σ→PAD
  "colour = one feeling" is untouched. **Not yet confirmed on a screen by K.**
- **Zoom pendulum** (§17 of the brief): a **second swing on the same `_swingPhase`** as σ,
  so pumping business speeds the dive exactly as it speeds resolve↔dissolve, and depth
  scales with business (×3.2 at full, ×1.44 at the floor — the dive is earned). Dashboard
  gets a zoom fader that **pins**, an **auto** button that hands it back to the pendulum,
  and a **resolve/dissolve** toggle (deepest at symmetry, or dive into chaos and surface
  into order) that eases rather than snaps. Rendered as a canvas transform in
  `symmetry.js`; six exhibits opt out via `noZoom`; `AmbientDirector` is opt-in so the
  `brain.js` background behind text never swells. **The engine + dashboard half is
  committed (`c28bcd5`); the render half — `viz/symmetry.js`, `party-main.js`,
  `dashboard.html` CSS, `tools/party-tests/zoom.test.js` — is NOT yet committed.**
  **Not yet seen on a screen by K.**
- **Naming**: generated palettes are `hue-word + form` from the primary's actual hue
  (*Indigo Mirage*); spirals are `fold + form` (*Pentad Filigree*); the static five were
  renamed to match. `_uniqueId` guards collisions — the id is the playlist, localStorage
  and dashboard key at once.
- **Dashboard**: mirrors state, edits both playlists, tunes config live, cross-device.
- **Neglect**: `idle` → `attention()` ramp → `isDead()`; lamps breathe slower and
  deeper, screen pulls inward. Any touch resets it.
- **Remote mapping**: pure `party_action()` mapper, unit-tested.
- **Robustness**: change-gated pushes (idle room silent on the wire), offline
  back-off, SSE reconnect both sides, dead-browser backstop in C#.

---

## 5. Traps that bit us repeatedly — check these FIRST when something "doesn't work"

1. **Stale C# build.** Symptom: a route 404s (`/api/effects/params`) or a param is
   ignored. The app must be **rebuilt AND restarted**. The full-solution build
   *fails to copy* while the app is running (file lock) — that is **not** a compile
   error; stop the app and rebuild.
2. **Stale `serve.py`.** Symptom: dashboard stuck "connecting". A running server
   predating a route change 404s it. Restart it.
3. **`EventSource` never retries after an HTTP error status.** A single 404 kills a
   subscription permanently while POSTs keep working — so everything *looks*
   connected but control is dead. Both sides now retry explicitly; don't remove that.
4. **Connection starvation.** Browsers allow ~6 connections per origin. Unconditional
   lamp pushes through a slow/dead proxy consume every slot and starve the SSE
   streams (and spew `WinError 10053`). Pushes are change-gated and back off when
   offline — keep it that way.
5. **Lights at `(0,0,0)`** are unmapped and cannot join a spatial flood. They get
   fill + palette spread now, but they will never flow properly until mapped.
6. `docs/HUE-API.md` is **generated**. After changing C# layer params, re-run
   `python tools/gen_light_reference.py`; until then `check_light_params.js` will
   flag the new params as unknown, which is expected.
7. **`EXHIBITS` (38) is NOT what the party screen shows.** `party-main.js` runs
   **`AmbientDirector`**, whose `pool` is a fixed **13**. A whole round of screen-colour
   work went into 4 exhibits that are gallery-only and therefore invisible in the
   installation — the screen looked unchanged and the cause was not obvious. Anything
   aimed at the party screen must be checked against the pool. `spread.test.js` now
   asserts the pool by name so this cannot silently recur.
8. **A test that matches on a NAME will break when you rename the thing.** `party.integ`
   detected minted schemes with `/gen|Gen/` on the id; renaming them to real names broke
   it. It now detects them by absence from the static `snapshot().lights` — the actual
   property. Prefer structural checks over string-shape checks here.

---

### ⚠ The remote traps (added 2026-07-26 — all three cost a whole session)

Symptom that sent us in a circle: "the remote doesn't work, and it feels like a
circle jerk." None of it was pairing, and **none of it was C#.** In order of how
much time each wasted:

3. **`localhost` costs ~2 SECONDS per connection.** `serve.py` binds IPv4-only
   (`0.0.0.0`), Windows resolves `localhost` to `::1` first, and that dead lookup
   stalls. Measured: **2064 ms via `localhost` vs 2.1 ms via `127.0.0.1`.** It hit
   every hop — browser page, SSE stream, `listen.py`'s relay, and `serve.py`'s own
   `HUE_BASE` proxy to :5000. A flat 2 s delay does **not** read as latency; it reads
   as the installation having a mind of its own (presses land after you stop pressing,
   then appear to stop). **Always use `127.0.0.1`. Never "tidy" it back to
   `localhost`.** Fixed in `ad3e0b0`.
4. **`listen.py --party` crashed instantly on Windows.** The mode banner contains
   `↑↓`; consoles are cp1252; printing it raised `UnicodeEncodeError` *before the
   eventstream opened*. Party mode had never run for more than milliseconds. Nav mode
   has no arrows on its startup path, which is why only party mode seemed cursed.
   Fixed with a UTF-8 reconfigure at import. **Run it with `-u`** or Python buffers
   stdout and you see nothing, which also reads as broken.
5. **`extracted/controller_map.md` was confidently wrong** and is the reason this was
   ever thought to be a C# job. It claimed new C# eventstream code was needed and that
   the sensor IDs were "not discoverable from static code". Both false: `listen.py`
   already implements the whole path in Python, and the four ids hardcoded in
   `BUTTON_MAP`/`PARTY_BUTTONS` **already match the live bridge** — they read like
   placeholders but are real. That doc now carries a SUPERSEDED box.

### ⚠ The bridge eventstream is a ~1 Hz heartbeat, not a live feed (measured 2026-07-26)

**This is a hardware limit and no amount of transport tuning fixes it.** Across a 90 s
capture, every event landed on a ~1.01 s boundary, with up to **16 events sharing one
timestamp**. Inter-bucket gaps: 1006/1007/1008/1009/1010/1012/1013 ms, nothing between.

Consequences, all load-bearing for any remote design:

- **Chords are not usable.** Not because the remote can't send two presses — because a
  1 s bucket cannot distinguish "pressed together" from "pressed within the same
  second". A naive same-bucket detector scored **205 "chords" from 139 presses** —
  more chords than presses, which is arithmetically impossible for real pairs. Guest
  mashing generates false chords at ~1.5 per press. If chords are ever wanted, Advanced
  layer only, and knowingly sloppy. **This retires ROADMAP open question #3.**
- **`initial_press` and its own `short_release` frequently share one timestamp**, so
  press *duration* is unrecoverable from arrival time.
- **Holds still feel smooth**, because the ramp is not event-driven: `holdBright()` only
  sets `drive = ±1` and `tick(dt)` integrates every frame. Only the edges are quantized.
- **But `driveRate` interacts badly with it.** At the live-tuned `driveRate: 1.8` a full
  0→1 sweep takes 0.55 s, so a single tap covers the whole range — that is arithmetic,
  not a bug (`drive` returns to 0 correctly and decay works). File default is 0.55.
  **Keep `driveRate` under ~1.0** so one stray second cannot spend the whole range.
- **Unbuilt fix, and the data is already in hand:** sustain drive from `repeat` events
  (the dimmer emits them ~1/s while genuinely held) instead of trusting the press→release
  span. `party_action` currently discards `repeat` as noise (`listen.py:127`). Start on
  `initial_press`, keep alive while `repeat` arrives, auto-release after ~1.5 s of
  silence. A tap then costs exactly one bucket, a real hold sustains itself, and a lost
  release can no longer strand `drive` at 1 — the failure mode that would look worst at
  a party.

## 6. Invariants — do not regress

1. **NOT a carnival.** Lamps dominate the room. Slow and steady by default; the
   decay and attention systems are the *only* sanctioned motion spikes.
2. **Never compute an animation phase as `elapsed × rate`** when the rate is
   live-tunable — retuning teleports it. **Integrate:** `phase += rate * dt`. This
   caused the flicker; it has since earned itself twice (tide + colour drift).
3. **Motion belongs in SPACE, not in a lamp's brightness.** A lamp swinging
   0→100 % reads as *flashing*. Narrow per-lamp band + lamps out of phase = liquid.
4. **Only one colour screams at once.** The atlas accent is bound to events, never
   to ambient.
5. **An idle room is silent on the wire.** Change-gate everything.
6. **Display firewall.** On-screen text = mode words, math, reward cues. Never
   AI-authored prose about anyone. Toasts comply; keep them generic.
7. **`GlobalEnergy` slew limiter stays central** — it's the anti-strobe governor.
   `energyCap` (0.65) keeps it from ever fully loosening.
8. **The zoom DEFAULT keeps the whole picture in frame** (`config.zoomOffscreen` 0). K.:
   *"I want the picture to actually stay in frame … zoom out and in where everything stays
   inside the frame."* The dive breathes in scale (fills the frame at rest, shrinks toward
   the centre at depth, `zoomFit`); nothing crosses the edge. Flip `zoomOffscreen` to 1 for
   the old magnify-past-the-edge dive (lens `zoomMode` 0 / uniform `zoomMode` 1). All three
   render through the SAME ctx proxy, which works ONLY because no exhibit uses an internal
   `translate`/`rotate`/`scale` — **add one to an exhibit and give it `noZoom`, or it will
   mis-place.** Off-screen lens has two anti-fold clamps (depth ≤3.5, falloff ≥`0.45z+0.15`).
   Brief §17.4, tests `tools/party-tests/zoom.test.js`.
9. **A full-canvas rect is the trail fade, not content — the proxy must pass it through
   unmapped.** This is what lets the in-frame scale go below 1 safely: a plain
   `ctx.scale(s<1)` would shrink the fade rect and leave a stale un-faded ring, but the
   proxy detects the full-canvas rect by size and passes it straight through. Any new
   proxy-mapped method must preserve that carve-out. Guarded by `zoom.test.js` §5 and §8.

---

## 7. Backlog — prioritised

### A. Pinned in §2 of the brief but silently NEVER BUILT
These aren't ideas; they're agreed interaction model.
1. **Spiral modifier toggles.** §2 promises "curator flips each: arms/symmetry
   (2/3/5/7), chaos, spin direction, energy-breath, bloom/trails, depth-pull". The
   data exists in `SPIRALS`; there is **no per-spiral control anywhere** — the
   dashboard has only global engine sliders.
2. **Per-list slide/drift speed.** K.'s original ask ("determine how fast the scenes
   slide", per list). Advancement is decay-trough-based with no speed control.

### B. K.'s three requests — 1 of 3 done
3. ~~**14.2 Deliberate visual overlap**~~ **DONE in §21.1** — plus K.'s persistent
   background mode. The double-darkening trap was real; a second one (nine exhibits that
   repaint the whole frame and erase what is under them) was not predicted and forced the
   opaque-to-the-bottom rule.
4. ~~**14.3 Nucleus control + `docs/PARTY-VISUALS.md`**~~ **DONE in §20** — all 19 bloom
   numbers are on the dashboard, grouped and explained, and the operator guide is written.
   Original spec follows for reference. Fully
   parameterise `drawSuperfluidBloom` onto dashboard sliders, and write the operator
   doc.

**14.1 is BUILT across three passes — brief §15 (lamps), §16 (screen), §17 (the pool
miss + naming) — but K. has NOT yet confirmed §16/§17 on a screen.** That live look is
the top item, ahead of 14.2/14.3. What to check and what to reach for:
- Press **H** repeatedly: each spiral should differ materially in colour, and the toast
  should read *"Unlocked: Pentad Filigree"*, not a serial number.
- **If it still reads as one colour, the first suspect is `SPREAD_ORDER` (0.34) in
  `web/viz/symmetry.js`.** σ deliberately converges colour toward the primary as symmetry
  resolves, so a pendulum parked high in σ will look monochrome *by design*. Raise it
  toward 0.6 before suspecting anything is broken.
- Lamp-side equivalents are `colorSpan` (1.0 — how much scheme fits across the room) and
  `colorDrift` (`0.02 + business × 0.06`), both in `party-main.js`.

**⚠ localStorage:** the catalog has been renamed twice now (`gyre` → `Trefoil Gyre` →
the real exhibit titles). Saved playlists from before **self-heal since §19** — `_load`
drops ids that no longer resolve rather than leaving dead entries. Clearing storage is
still the cleanest start, but a stale store no longer looks like a bug.

### C. Unused ideas that never made any list
5. **Spatial light map in the dashboard** (K.'s idea). Fable explicitly deferred any
   mapping UI (Q5c), so Phase 9 is data-model only. A room map would unlock all the
   spatial work: place lamps, tag decorative vs in-sight, watch the colour tide
   sweep across them, and spot unmapped lamps instantly (5 were invisible until the
   API was probed by hand).
6. **Randomize-everything gesture.** K.'s original spitball ("randomise everything by
   holding the hue button"). **Partly answered by attract mode (§19.4)**, which randomises
   continuously rather than on a gesture. The *gesture* is still unbuilt and
   **Power-hold is deliberately free** — the obvious binding is "skip to the next attract
   cycle now", which the dashboard already exposes as `skip`.
7. **Audio / BPM reactivity.** Zero references in any party file, yet the C# already
   has `/api/bpm` and BPM-synced layers, and Deep House's notes call music "the
   largest unbuilt thing". For a *party* piece this is the most conspicuous gap.
8. ~~**The spiral catalog is a placeholder.**~~ **DONE in §19** — the catalog is now the
   38 real exhibits, selected by name rather than hashed. What remains of this item:
   **`SHAPE-CATALOG.md` holds 130+ patterns and only 38 are built.** Each new one needs a
   draw function, a σ chaos→order behaviour, and colour-spread support; it is batches of
   sessions, not one. `catalog.test.js` will fail the moment a new exhibit is added
   without a matching catalog entry, which is the intended nudge.
9. **`spiralAngle()`** — a physical rotation swing, kept in code, unused ("fun for
   later" per K.).
10. **Accessibility / strobe-smoothener** — DESIGN invariant 16; matters if the
    ticketed exhibition happens.

### D. Needs hardware / the live stack
11. **Phase 9 position ROLES** — `Role` (decorative vs in-sight) on `MappedLight`,
    `screenAxis` config, derived L/R/U/D zones, and the **directional inward
    attention-flash**. Decorative lamps should react *sooner* and flicker first.
12. **Map the 5 unmapped lamps** (Staanlamp, Lightstrip Bed, Hue ambiance lamp 1,
    Toog, On/Off plug 1) via `LightPositionMapper` → `positions/*.json`.
13. **Fill in `PARTY_BUTTONS`** in `listen.py` via `--discover`, then test the remote.
14. **Per-scene lamp variety** — only `Superfluid` is `ILiveTunable`, so light-scenes
    currently differ by colour only. Make more layers tunable, or switch scenes.

---

### E. Party-night remapping + modal layers (K. direction, 2026-07-26 — DESIGNED, NOT BUILT)

K.: *"I want to be able to tweak some of its mapping at the party itself if I deem
something better."* Decided in conversation; nothing written. Build order is roughly
this list. **Deferred deliberately: K. has a light rework incoming, and the light half
of item 3 is exactly what that rework redefines — building now means building twice.**

1. **Binding table moves to the dashboard.** Today roles live in `PARTY_BUTTONS` (Python)
   and semantics in `party_action` — changing either means editing a file and restarting,
   at the party, on the laptop. K. chose the dashboard ("dashboard for sure"): `listen.py`
   sends raw `{button, event}`, `PARTY` resolves via a table K. edits on his phone.
   Changes the wire format — coordinate with whatever else is in `party-main.js`.
2. **Simple / Advanced layers**, switched **from the dashboard only, never the remote.**
   K. wanted layer-switching on a button; the better shape is that no physical button is
   spent on meta — K. is the only one who ever changes layer, and he has his phone. That
   keeps all four buttons on content. Simple = guests mash safely; Advanced = K.'s test
   rig. "Infinite modes really" is possible, but two is what guests can learn.
   **Layers are also how the up/down split gets built without new buttons** (item 3).
3. **Split the drive axes.** `business` is ONE scalar doing double duty: spiral side
   (swing rate :559, amplitude :841, zoom :866, visualizer chaos/speed :999–1000) and
   light side (`effectiveEnergy` :885, `resolveLight` :912). K. wants spiral speed vs
   "light liveness" separable. **Do NOT fork `business` into two scalars** — that touches
   all six read sites plus lamps, snapshot, presets and the tide tests. Instead keep
   `business` as shared arousal and add a **balance (−1…+1)** biasing how it maps to each
   half: one new value, one dashboard row, every read site keeps working.
   *Note: `tempo()` is NOT business — it reads `config.bpm` only. Tempo is not currently
   on the remote at all.*
4. **Power-long = reset to defaults.** `reset()` (`party.js:1220`) is already a complete
   restore including `CONFIG_DEFAULTS` snapshotted at load, and `party_action` already
   leaves power-long **deliberately unbound as K.'s reserved spare gesture**
   (`listen.py:131`). This is the slot; it is wiring, not new code. Power-short keeps
   spiral↔light — the one thing guests already understand.
5. **Randomise mints colour instead of unlocking catalog entries.** K.: *"some are a bit
   monotonous and this way people can find their favorites."* `_mint()` (:517) already
   generates palettes deterministically via `P().generate()`. This **removes** design
   weight: the earn-by-commit unlock ladder exists to ration six static scenes, which is
   the monotony K. is describing. **Minted palettes must be ephemeral until saved** —
   nothing persists, nothing joins a playlist, saving is what promotes them. That is both
   K.'s "save it when they are happy" and the fix for the unbounded-growth problem
   `_autoPick` already warns about ("the overflow valve would grow the catalog without
   bound over an evening"). `9ef6251` is that bug having already bitten once.
6. **Idle → slideshow.** `auto` is manual-only today; `idle` already accumulates and
   `attentionAfter: 420` / `deathAfter: 1800` exist. Needs a **configurable int box on the
   dashboard** (K.'s choice), seeded well under 7 min — suggest 90 s; 7 minutes of dead
   air at a party is far too long.
7. **Promoted favourites and the ambient card exclusion.** `_autoPick` deliberately
   excludes colour cards ("dropping one into the ambient rotation is exactly the *that's
   not ambient* jar K. hit") and deliberately ignores the playlists ("curation is the
   manual path"). Item 5 partly reverses both. K.: *"do whatever seems fun and not too
   invasive visually."* Proposed: keep the exclusion as default, but treat promotion as
   **explicit consent** — the original exclusion existed because cards got in *by
   accident*, which is a different problem from K. choosing one. Nothing changes visually
   unless something is actively promoted.

## 8. OPEN QUESTIONS — only K. can answer

### 8.0 ⚠ NOTHING BELOW HAS BEEN SEEN ON A SCREEN (as of 2026-07-24, §19–§21)

Everything from iterations 8–11 is headless-verified and **unseen**. These are the
questions a live evening answers; none of them are code problems, and no work should
start on them before K. has looked. **Run it first, then pick from this list.**

1. **Is the dive right yet?** The lens (magnify the middle, leave the frame) is now the
   default after "okish" on the uniform scale. Compare live with the **centre/uniform**
   button. If it is still not right, is it the depth (×3.2), the softness (**spread**),
   or the thickening strokes at depth?
2. **Newton is now SOFT, not sharp.** The blocks are gone but the detail is a haze —
   that was the trade for not costing more (§21.2). Better or worse? Sharp would mean
   3–6× the compute on all three escape-time exhibits, and Mandelbrot already lagged.
3. **Attract dwell 25–45 s** — right for a room people move through? Use the dashboard
   **skip** button to audition at speed rather than waiting.
4. **Which exhibits to veto** (`off`), and which to keep out of overlap (`⧉`). Mandelbrot
   lagged; watch the nine opaque ones especially — they *cut* rather than dissolve, which
   may break the flow-into-each-other feel even when they perform fine.
5. **Overlap: transition or persistent, and at what strength?** Attract mode currently
   randomises pairings on about half its cycles. **Persistent roughly doubles render
   cost** — if it stutters, veto the expensive exhibits from layering before anything else.
6. **Colour drift 8 s** — long enough to read as drift? And watch for **mud**: the C#
   layer runs its own `colorDrift` sweeping hue across the room, so during a fade there
   are two colour motions at once. If it muds, slow `colorDrift` while fading.
7. **Which of the seven cards earn their place?** Spectrum · Monochrome · Split · Triad ·
   Wander · Ember · Runner. Cutting three would make the catalog better than adding an
   eighth. Ember's flare especially — rare enough, or too rare to ever notice?
8. **Runner is a band moving outward, not a lamp-by-lamp chase.** The single Superfluid
   layer positions colour by distance from the screen. If that reads as too diffuse on
   the real lamps, a true positional chase is a job in the **Hue program** repo.
9. **31 sliders may be too many.** If the nucleus feels like a mixing desk, the fallback
   is collapsing each chaos/order pair into one "amount" knob — halves the count, costs
   the ability to set the two ends independently.
10. **Which patches are worth keeping?** The LFO bay can put any setting on any clock;
    nothing is persisted, so anything good needs writing down. Suggested starting
    experiments are in `PARTY-VISUALS.md`.

### 8.1 Older questions, still open

1. **Scene ↔ atlas-scheme pairing.** Current: Calm Tide→Deep Ocean, Drift→Aurora,
   Glow→White Lotus, Dream→Dream Bloom, Cozy→Solar Temple, Sunset Drift→Sacred Fire.
   Pure curation — bless or reshuffle. *(Drift was moved off Cosmic Void because it
   and Deep Ocean share a deep-blue primary and looked identical on the lamps.)*
2. **Generator seed strategy** — "in-family" (anchors drawn from the 12 named
   primaries, current) vs free-roaming xy. Taste.
3. **Role-aware lamp colour, further?** The colour tide spreads the palette across
   lamps. Should specific lamps *hold* specific roles (so "one lamp screams" is
   literally true), or is the travelling tide enough?
4. **Power-hold** — still deliberately unbound, reserved as a spare gesture.
   Candidate: the randomize gesture (C6). Or playlist-wipe (originally proposed,
   K. unsure). Or leave free.
5. **Decay timing for the real room.** `?fast` is a test flag; the installed
   values (~30 min to standstill, attention from ~7 min) are guesses that need a
   real evening to calibrate.
6. ~~**Does the "nucleus" mean `drawSuperfluidBloom`?**~~ Built on that assumption in
   §20.2 and it held up — the central well + four centre→corner streams + corner glows
   are all on the dashboard now. Say so if the word meant something else.
7. **Is the piece single-screen?** Deep House had three displays. The party assumes one.

---

## 9. Session hygiene notes

- A design workflow (`wf_98b619ca-66f`) for the three requests was **deliberately
  stopped** at K.'s call. Its specs were written into brief §14 by hand. **Do not
  wait on it or resume it** — §14 stands alone.
- The headless suites (now 15) were rescued out of a scratch temp directory into
  `tools/party-tests/` on the last day. They would otherwise have been lost. Run
  them before and after any change: `node tools/party-tests/run.js`.
- Battery/governor context: K. declared batteries will be low for a while and
  **overrode the planning-only gate** — execution is allowed at low battery until
  they say otherwise.
