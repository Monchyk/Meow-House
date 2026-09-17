# THE LIGHT SETUP — an operator's guide

*The speaker test, for lamps. Written 2026-07-28, for K., to be read cold.*

---

## ⚡ The sixty-second version

You have ten lamps. **Five of them cannot receive colour and never could.** Not
mispositioned — *absent from the entertainment area*, which means the bridge never sends
them anything. Everything else in this document is scaffolding around that one fact.

There is now a page — `http://localhost:8800/lights.html` — that tells you the truth about
every lamp and lets you tap one to make it blink. **Open it on your phone, walk the room,
tap things.** That's the whole instrument.

> **If you read one box, read this one.**
> Before touching the floorplan: open the **Hue phone app → Entertainment areas** and see
> whether **Staanlamp**, **Toog** and **Lightstrip Bed** can be added. `On/Off plug 1` and
> `Hue ambiance lamp 1` cannot — entertainment areas require colour-capable lights.
> If those three can join, your room goes from **5 → 8** working lamps. That is a bigger
> change than anything else planned this month, and it costs five minutes in an app.

---

## 🔌 Starting the stack

Order matters. Each one needs the one above it.

```
1.  C# Hue app        :5000    ← start it YOUR normal way, then click reconnect
2.  python controller/serve.py :8800
3.  http://localhost:8800/lights.html   ← on your phone, same wifi
```

**Do not start the Hue app with `dotnet run`** for this. It serves the whole HTTP API
without ever connecting to the bridge — every call answers `200`, nothing reaches a lamp,
and it looks exactly like a broken tool. This has burned three separate sessions. The page
now detects it and says so in red, but it's cheaper to just start it properly.

Quick sanity check from anywhere:

```bash
curl http://localhost:8800/api/status
```

```json
{"connected":true,"statusText":"Connected: 5 lights streaming",
 "lights":10,"streaming":5,"unpositioned":5,
 "positionSource":"config","config":"party-room"}
```

Read it like this:

| field | what it means | what you want |
|---|---|---|
| `lights` | lamps the app knows about | 10 |
| `streaming` | lamps that can receive colour **at all** | **should equal `lights`** |
| `unpositioned` | lamps with no place in the room | 0, eventually |
| `positionSource` | `config` / `entertainment` / `ring` / `none` | `config` |
| `config` | which layout is loaded | `party-room` |

**`streaming` below `lights` is the emergency.** Everything else is tuning.

---

## 🗺 Reading the page

### The three facts

Every lamp carries three booleans that are completely independent. Not being able to see
them together is precisely what hid a month-long bug.

| badge | question it answers | who controls it |
|---|---|---|
| **not driven** | do we drive this lamp at all? | you — the checkbox |
| **not in entertainment area** | can it take colour *by any means*? | **the Hue app.** Not us. |
| **no position** | can it join the spatial flood? | you — the floorplan |
| **ready** | all three good | — |

They're deliberately shown in that order of severity. A lamp that isn't in the
entertainment area is reported as such **even if it also has no position**, because
telling you "no position" would send you off to place a lamp that can never light.

### The banner

One line, never a list. A wall of warnings gets read as decoration. It always shows the
single most important thing wrong, in this order: *not connected* → *lamps missing from
the entertainment area* → *lamps unplaced*. **No banner means the room is healthy.**

### The floorplan

```
        ╔═══════════ SCREEN / TV ═══════════╗   ← y = +1, the top, always
        ║                                   ║
        ║      ● Play left      ● White     ║      ● solid  = placed
        ║                         desk      ║      ○ hollow = waiting
        ║              ● Clamp A            ║
        ║                                   ║
        ╚═══════════════════════════════════╝   ← y = −1
          not placed — drag in:  ○ ○ ○ ○ ○
```

The screen is **always the top edge**. That's not decoration — the flood radiates outward
from the lamp nearest the screen, so which way this faces is the direction everything in
the room moves.

Unplaced lamps sit in a **tray below the room**, not stacked at its centre. A pile of dots
at the origin is exactly the picture that made five missing lamps invisible for a month.

### Working it

1. **Tap a lamp in the list** → it blinks white, alone, for 8 seconds. Everything else
   drops to 2%.
2. **Say which physical bulb lit.** That's the entire test. If it's not the one the name
   suggests, you've just found something the code cannot tell you.
3. **Drag its dot** onto the plan where the bulb really is. It flashes again as you grab
   it, so you always know what you're moving.
4. **Let go.** Saved. There is no save button, so there's none to forget.
5. Set **height** with the slider. It always shows the *selected* lamp's height — if
   nothing is selected it says so and is disabled.

**Rough is fine, and that is a design decision, not laziness.** `SuperfluidFlowLayer`
consumes exactly two things per lamp: a unit direction from the origin, and a distance
normalised by the largest one. Both are ratios. There is no consumer of centimetres
anywhere in the chain. A 20 cm error in a 5 m room shifts a direction by a couple of
degrees, under an 8-second colour fade. **A tape measure buys nothing and costs the only
thing that matters — whether the mapping ever gets redone.**

### ⚠ Height is not cosmetic, and its name is misleading

It looks like a nice-to-have. It isn't. All four corner targets are pinned at **z = 0**
(`SuperfluidFlowLayer.cs:113-118`), but a lamp's z still reaches the render twice:

- `dist` is a **3D** distance from the origin (`:126`) → sets **when** the tide arrives
  and where the lamp sits in the colour ramp.
- `align` is a dot product against the corner directions (`:225`). Lift a lamp out of the
  corner plane and its direction aligns less with **every** corner.

So **raising a lamp makes it reached later and swept more weakly.** It is really a "how
much does this lamp take part" dial. Measured in the suite: the same lamp at z = 0.9
peaks at 0.88 where it reaches 0.94 at floor level.

*(It was three bands — floor/mid/ceiling — until K. asked why. The bands were justified by
"the corners ignore Z", which is true and irrelevant: z still moves distance and alignment,
continuously. It is a slider now.)*

---

## 🌊 The sweep test — the actual point of all this

Placing lamps is only the input. The question is whether the flood then **does what the
map says**, and that is what the sweep test answers.

Press **run sweep**. It starts a fresh tide at a speed you choose and animates the
floorplan from the *same maths the C# layer runs* — each dot's glow and its `%` are the
predicted intensity at this exact instant.

**Watch the room and the map together.** That side-by-side is the whole instrument:

| what you see | what it means |
|---|---|
| room and map brighten in the same order | positions are right |
| a lamp lights **early or late** | it's placed too near / too far from the origin |
| a lamp barely lights at all | it's off-axis from every corner, or lifted too high |
| a lamp never lights | check its badge first — it may not be in the entertainment area |

From the room alone you can tell *something* is off but never *which lamp to blame*. With
the map beside it, the wrong lamp is obvious.

**Two knobs:**

- **tide speed** — seconds per breath is shown next to it. Slow (0.1–0.2) is easiest to
  follow; fast makes the order hard to read.
- **band width** — how much of the room is lit at once. **Tight (≤0.2) is the diagnostic
  setting**: a narrow band travelling is unmistakable. Wide is what the party actually
  runs.

**Read the order, not the millisecond.** The layer eases in over ~3 s on activation (the
readout shows `easing in` while it does), and the slew limiter softens every edge after
that. The map is the intent; the room is the intent plus physics.

### Four colour modes — pick by what you're asking

K., watching the first version: *"it just kinda fades blueish but thats hard to
distinguish the order tbh."* Exactly right. With one colour the only signal is
**brightness**, and brightness is precisely what the slew limiter exists to soften.

Colour in this layer is carried by **distance from the origin**
(`SuperfluidFlowLayer.cs:246`), so a palette turns the room into a **spatial ruler**.

| mode | what it's for |
|---|---|
| **Zones** *(default)* | Red near the screen → blue at the far corner. Check each lamp's **colour** against its dot. This catches a wrong position **even while the room is standing still** — no timing judgement needed. |
| **Hot crest** | A white crest over near-black. The clearest read of **order** — watch which lamp it touches next. |
| **Brightness only** | The original. Honest, and hard to follow. Kept for comparison. |
| **Spectrum drift** | The full wheel, slowly drifting. Least diagnostic — use it to judge whether the room *looks* good once positions are right. |

**The map wears the same colours.** Each dot is painted from a mirror of the layer's own
palette sampling, so with Zones running a lamp whose hue disagrees with its dot is
mis-placed — and you can see that without watching anything move.

Changing mode restarts the tide. It has to: palette and `brightBand` are only set at
`/effects/run`, and a fresh run is also what makes the timing knowable again.

> **The wrap trap, in case you add a mode.** `SamplePalette` loops the last colour back
> into the first, so at `colorSpan` 1.0 the furthest lamp wears the *nearest* lamp's
> colour and the ruler reads as a circle. The banded modes stop short of the wrap
> (`colorSpan` 0.78–0.9); `party-main.js` solves the same problem the other way, with
> there-and-back palettes.

> ⚠ **The prediction is a MIRROR of `SuperfluidFlowLayer`, and mirrors drift.** If that
> layer changes and this isn't updated, the map lies — confidently, in the one tool built
> to be trusted. `lightsmap.test.js` §7 pins the behaviours the C# guarantees. If it fails
> after a layer change, **the mirror is what needs fixing, not the test.**

---

## 🧭 What to do with what you find

```
Tap "flash" on a lamp
│
├─ the bulb you expected lit
│     └─→ drag it into place. Next lamp. This is the happy path.
│
├─ a DIFFERENT bulb lit
│     └─→ the bridge's names don't match your room. Rename in the Hue app,
│         or just remember it — but write it down before placing anything.
│
└─ nothing lit
      ├─ badge says "not in entertainment area"
      │     └─→ expected. It cannot be flashed by the normal path. The page
      │         falls back to direct REST — if it still doesn't blink, that
      │         lamp is genuinely unreachable and belongs to your REST fill
      │         idea, not to the floorplan.
      │
      └─ badge says "ready"
            └─→ real problem. Check `connected` in /api/status, and check the
                Hue app is not running without a bridge connection.
```

---

## 🛠 Driving it by hand

Everything the page does is a plain HTTP call through `serve.py`'s `/api` proxy, so you
can do any of it from a terminal.

```bash
# every lamp, with its id and all three facts
curl http://localhost:8800/api/lights

# blink one lamp for 8 seconds (returns instantly — the blink runs on)
curl -X POST "http://localhost:8800/api/lights/<id>/identify?seconds=8"

# place a lamp — partial, so this does NOT disturb any other lamp
curl -X POST http://localhost:8800/api/lights/positions \
  -H "Content-Type: application/json" \
  -d '{"config":"party-room","positions":{"<id>":[0.3,-0.8,-0.6]}}'

# which lamps the piece drives at all
curl -X POST http://localhost:8800/api/lights/selection \
  -H "Content-Type: application/json" -d '{"lightIds":["<id>","<id>"]}'
```

Coordinates are `[x, y, z]`, each **−1 … +1**. `y = +1` is the screen wall. Heights:
floor `−0.6`, mid `0`, ceiling `+0.7`.

**Identify returns immediately, on purpose.** `serve.py`'s proxy times out at 2.5 s
deliberately — a slow Hue app would otherwise starve the SSE streams that the party
display depends on. An 8-second blink held open would time out at the proxy and look
broken, so the endpoint fires and forgets.

---

## ✅ What's proven, and what is only your eyes

| proven headless (30 suites) | only you can prove |
|---|---|
| cm ↔ normalised round-trip | that the lamp called *Toog* is where the map says |
| the screen edge draws at the top | that a flash reads across the room |
| the 1e-6 origin rule, shared 3 ways | that the room *looks* better afterwards |
| partial saves don't blank other lamps | your room's real dimensions |
| every `$("id")` exists in the page | which bulbs can join the entertainment area |

`node tools/party-tests/run.js` → **30 suites**. Anything less means someone landed
something; find out what before adding to it.

**The success condition of this whole exercise is not testable.** Tests can prove no lamp
sits at (0,0,0). Only you can prove the map matches the room.

---

## ⚠ Traps, in the order they'll bite

1. **The Hue app holds the DLLs.** A C# change needs the app stopped first. The Web
   project then fails to *copy*, not to compile — so a "successful" build can leave you
   running stale code. **Compare `bin` timestamps against source**; that check has already
   caught it once.
2. **`dotnet run` ≠ connected.** Serves the API, drives nothing, answers 200 throughout.
3. **`/api/effects/params` ignores out-of-range values and still says `softUpdate:true`.**
   Never read a 200 as "applied". `node tools/check_light_params.js` validates.
4. **Wrong Hue branch** → `/api/energy` 404s and the whole business→brightness coupling is
   silently dead while everything else looks fine. Must be `feature/party-installation`.
5. **`docs/HUE-API.md` is generated** (`python tools/gen_light_reference.py`). Regenerate
   after any C# endpoint or param change. Four hand-written light docs have been wrong.
6. **Positions are captured in `OnActivate`.** The save endpoint rebuilds the running
   layers for you — but anything else that changes positions must, or the room keeps using
   the old geometry and the save looks like it did nothing.

---

## 📦 Where things live

| | |
|---|---|
| `web/lights.html` + `web/lights.js` | the page. Pure half is node-testable; browser half is guarded |
| `tools/party-tests/lightsmap.test.js` | its suite — the maths, the badges, the id cross-check |
| `Hue program/Layers/IdentifyLayer.cs` | the blink. A **layer**, not REST — see below |
| `Hue program Web/positions/party-room.json` | **your room's geometry, in git at last** |
| `Hue program Web/light-config.json` | which layout is active |
| `~/.claude/plans/iterative-hugging-fountain.md` | the full plan + Fable's review |

**Why identify is a layer and not a simple REST call**, since it looks like overkill:
`AnimationLoop` pushes every lamp at 50 fps and the entertainment stream takes precedence
over REST for group members. A direct call gets stomped within ~20 ms — *intermittently*.
That reads as "identify works sometimes", which is the worst possible bug in a tool whose
entire job is telling you the truth about which lamp is which.

For a lamp **outside** the entertainment area the rule inverts: nothing is streaming to it,
so plain REST is the only thing that can reach it. The endpoint routes on membership.

---

## 🔮 What comes after

Once `streaming == lights` and `unpositioned == 0`:

- **Expect to re-tune, not to celebrate.** `lampBrightBand: 0.12` and the floor-to-ceiling
  delta were both set against a room where half the lamps didn't move. When all ten join
  the spatial swing, `_maxDist` changes and those defaults become suspect. This is normal
  and was predicted — don't read it as a regression.
- Several open taste questions get asked *for the first time on honest data*:
  the tide reading "too diffuse", Runner being "a band, not a chase", and "why are all the
  lamps the same colour" were all judged with half the room dark. Some may simply dissolve.
- Your REST fill path covers whatever genuinely can't join. Design rule to hold:
  **REST lamps get the fill channel only — never the tide, never events.** At ~1 update/sec
  they will visibly step, and that's invisible on a slow breath but glaring on a scene cut.

---

*Cold-start pointer: `STATE.md`'s 2026-07-28 entry has the live findings and the exact next
action. `INDEX.md` maps every file. This document is how to operate it; those two are where
we are.*
