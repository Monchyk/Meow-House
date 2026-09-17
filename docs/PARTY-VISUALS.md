# PARTY VISUALS — the operator's guide

> For K. standing at the dashboard with the room running, not for whoever edits the
> code next. Every control named here is a real slider on `/dashboard.html`.
> Engine detail lives in `PARTY-BRIEF.md`; this is what the knobs *do to the room*.

---

## The three layers you are looking at

The projection is three things stacked, and knowing which one you are annoyed by is
most of the battle:

1. **The exhibit** — the actual shape: a Lissajous figure, the Julia set, Game of Life.
   38 of them. You pick these from the **Spiral catalog**, or attract mode does.
2. **The nucleus** — the soft glow *behind and around* the shape: a well of light at
   the centre, four streams running out to the corners, and pools where they arrive.
   It is the screen's echo of what the lamps are doing in the room.
3. **The dive** — the zoom. Not a layer so much as a movement of the whole picture.

If the screen feels *busy*, it is usually the nucleus. If it feels *static*, usually
the dive. If it feels *wrong*, it is the exhibit and you should just veto it.

---

## σ — the one idea behind every "chaos / order" pair

Almost every nucleus slider comes in two: **· chaos** and **· order**.

The room is always breathing between two states. **Chaos** is the pattern scattered
and unresolved; **order** is the same pattern settled into its symmetry. That breath
is σ (sigma), it never stops, and its speed is set by how busy the room is — *The
spiral → sway at rest / sway when busy*.

So a pair like *well size · chaos = 0.10* and *well size · order = 0.44* means: the
central glow is small while things are scattered, and swells four-fold as they resolve.
**Set both ends the same to stop that part of the bloom from breathing at all.** That
is the single most useful thing to know here — it is how you calm one element down
without flattening everything.

---

## The nucleus, part by part

### The well — the light at the centre
| Slider | What it does |
|---|---|
| **well size** | how wide the central glow spreads |
| **well glow** | how brightly it burns |

Turn both up and the middle becomes a lamp the shape sits inside; turn them down and
the shape reads sharp and unlit. The most common good adjustment: **well glow · order**
down a notch, because a bright resolved centre can wash out the pattern just as it
becomes worth looking at.

### The streams — light travelling out to the corners
| Slider | What it does |
|---|---|
| **flow reach** | how far toward the corners the light gets. Full = it arrives |
| **flow speed** | how fast each pulse travels. Chaos races, order glides |
| **stream density** | how many pulses are in flight at once |
| **pulse size / pulse glow** | how big and how bright each one is |

This is the gesture the whole piece is named for — the superfluid flood. If the screen
feels *frantic*, lower **stream density** before touching anything else; more pulses
reads as noise far faster than brighter ones do.

**flow speed** is the one pair that is normally *inverted* — chaos higher than order.
That is deliberate: scattered light hurries, resolved light glides.

### The corners — where the flood lands
| Slider | What it does |
|---|---|
| **corner glow** | how brightly the four corner pools light |
| **corner size** | how large they are |

> **Keep `corner glow · chaos` NEGATIVE.** It looks like a broken value and it is not.
> A negative floor holds the corners *completely dark* until σ has climbed past about
> a third — and that delay is the entire arrival gesture. Raise it to 0 and all four
> corners are lit from the start, so nothing ever *arrives*; the room just glows.

### The flare — the moment something is earned
| Slider | What it does |
|---|---|
| **press flash** | how much brighter everything goes, for a beat |
| **press shove** | how much further that beat throws the streams outward |

The only place the palette's **accent** colour is ever allowed to appear. The atlas rule
is that one colour screams at a time and the scream belongs to events, never to ambience.

---

## The dive

| Slider / button | What it does |
|---|---|
| **depth** | how far in it travels at its deepest |
| **rate** | dives per breath — 0.5 is one dive every two |
| **spread** | broad soft swell (low) vs tight bulge (high) — centre mode only |
| **centre / uniform** | *centre* magnifies the middle and leaves the frame edge alone; *uniform* scales the whole frame |
| **resolve / dissolve** | whether the deepest point lands as the pattern resolves, or in the chaos |

**Depth is earned.** A room at rest barely dives however high you set the depth — it
scales with how busy the room is. If you want to see the dive while testing, push the
business slider up or use the keyboard `↑`.

**centre vs uniform** is worth trying both ways on a real screen. Uniform drags the
whole frame outward, which can read as harsh — your eye gets pulled *out* at the moment
the dive should pull it *in*. Centre was built as the answer to that and is the default.

Six exhibits ignore the dive entirely — the fractals (Mandelbrot, Julia, Newton) because
magnifying an escape-time image magnifies pixels rather than revealing detail, and the
grid-locked ones (Life, cellular, Truchet) because cropping the grid stops the pattern
being the pattern.

---

## The room and the colour

| Slider | What it does |
|---|---|
| **resting energy** | where it settles when nobody touches it |
| **energy ceiling** | hard limit on how bright it can ever get |
| **wind-down / push speed** | how fast it sinks when left alone, rises when pushed |
| **calm palettes** | how much energy a gentle colour scheme is still allowed |
| **colour drift** | seconds for one light-scene to melt into the next |

**energy ceiling is a safety rail, not a taste knob.** The C# renderer widens its
anti-strobe limiter as energy rises, so this is what keeps the room in gentle territory
no matter how hard anyone drives it. Raising it toward 1 is how you would get a room
that flashes.

**colour drift** at 0 gives the old hard cut between scenes. 8 s is the default. Long
enough that you notice the room changing its mind rather than switching; short enough to
finish well inside a single attract-mode dwell.

---

## Starting points

**Calm** — a room people talk in.
Stream density 3 · flow speed both ends slow (0.20 / 0.15) · well glow · order down to
0.06 · dive depth 1.8 · colour drift 12.

**Default** — what ships. Everything as it loads.

**Alive** — late, people watching the wall.
Stream density 8 · pulse glow · order up to 0.12 · corner glow · order up to 0.14 ·
dive depth 4 · rate 0.8.

**Diagnostic** — when you want to see what one element actually does.
Set every *other* pair to matched values so only the thing under test breathes. Nothing
else on the desk isolates a single element.

---

## When it looks wrong

| It looks… | Reach for |
|---|---|
| busy, noisy | **stream density** down first, then **pulse glow** |
| washed out, flat | **well glow · order** down — a bright centre eats the pattern |
| dead in the corners | **corner glow · order** up; check *chaos* is still negative |
| like it never changes | **sway at rest** up, or **dive rate** up |
| harsh when it zooms | switch **uniform → centre**, then lower **spread** |
| like it cuts between scenes | **colour drift** up |
| monochrome | this is not the nucleus — it is `SPREAD_ORDER` in `viz/symmetry.js`, and it is *by design* that colour converges as the pattern resolves. See PARTY-BRIEF §16 |

Nothing on this desk is saved. Reload and you are back to defaults — so experiment
freely, and write down anything you want to keep.

---

## Overlap — two shapes at once

**attract → overlap** cycles three states:

- **off** — one exhibit at a time.
- **transition** — the previous shape fades out behind the new one over *overlap linger*.
- **persistent** — the previous shape stays behind the new one for the whole dwell.

Two sliders under *The spiral*: **overlap strength** (how strongly the one behind reads)
and **overlap linger** (seconds, transition mode only).

**Nine exhibits repaint the whole frame** — Ulam, Sacks, cellular, Life, Truchet, Julia,
moiré, Mandelbrot, Newton. They erase whatever is beneath, so when one is in a pair it is
always put *underneath* automatically, and two of them together simply do not pair. That is
why Lissajous-over-Newton works and Newton-over-Lissajous silently becomes the same thing.

Each spiral row in the catalog has a **⧉** button: allowed to be layered, or **⧄** never.
Use it on the expensive ones — **overlap roughly doubles render cost**, so if the screen
stutters, veto Mandelbrot and Julia from layering before touching anything else.

In attract mode roughly half the cycles overlap, at a varying strength, so pairings feel
found rather than scheduled.

## The colour cards

Seven of the light-scenes are **cards** — they are behaviours rather than fixed palettes,
and they sit in the Light catalog alongside the ordinary schemes:

| Card | What the room does |
|---|---|
| **Spectrum** | one slow walk through the whole hue wheel, about six minutes a lap at rest |
| **Monochrome** | a single hue held; only depth and brightness move |
| **Split** | two opposite hues sharing the room |
| **Triad** | three evenly spaced hues |
| **Wander** | new hues chosen slowly, never the same way twice |
| **Ember** | warm and low, with an occasional flare — the fire |
| **Runner** | a narrow band travelling out through the lamps — the dancing one |

Cards carry their own lamp settings (Runner narrows the band, Ember shoves the flow on a
flare), so they override the usual behaviour while they are up. They crossfade in and out
like any other scene — **colour drift** applies.

*Runner is a band moving outward from the screen, not a lamp-by-lamp chase in physical
order; the lamp layer positions colour by distance, so that is the honest limit.*

## The patch bay — putting a setting on a clock

Every slider has a **~** button. Pressing it cycles which of the room's running clocks
drives that setting:

| Clock | What it is |
|---|---|
| **swing** | the pattern's own breath, chaos ↔ order. Speeds up as the room gets busy |
| **zoom** | the dive, riding the same breath at its own rate |
| **business** | the room's energy — a slow envelope, not an oscillator |
| **cycle** | position through the current 25–45 s attract dwell |
| **breath** | a free slow sine, unrelated to anything else in the room |

A patched slider turns its label blue and shows a **depth** control instead of its help
line. Depth is a percentage of that setting's own value, so ±30 % means the same amount of
movement whether the slider runs 0–0.05 or 1–6.

**It works on anything**, including all nineteen nucleus knobs — putting *well glow · order*
on **breath** makes the centre swell on its own clock, unrelated to the pattern. Un-patching
restores the original value exactly.

One clock per setting. Patch a second and it replaces the first.

**Good ones to try:** *flow reach · order* on **swing** (the flood arrives in time with the
pattern resolving), *stream density* on **cycle** (each attract shape gets denser as its
dwell runs out), *zoom depth* on **breath** (the dive gets its own slow tide).
