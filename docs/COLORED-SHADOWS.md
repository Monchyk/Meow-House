# Colored Shadows: Casting Physical Hue-Lamp Shadows onto the Beamer Visuals

Research doc — a roster of ways to point the physical Hue lamps at the same wall the
beamer projects onto, so people and props cast **colored shadows** into the image. The
effect K. described ("a red spiral with blue + green lights on it makes a cool shadow")
is *colored shadows* — additive light + occlusion — **not** diffraction. True light-
bending (prisms, caustics) is a real but separate trick and gets its own slot (§6).
Research-first: this is the starting hypothesis, the wall is the judge.

Companion: **`WEEKEND-PROTOCOL` (PART 3 below)** — the ordered first-trial sequence.
Related house docs: `LIGHTSHOW-PLAYBOOK.md` (generative visuals), `LIGHT-SETUP.md`
(lamp positions/floorplan), `HUE-API.md` (light API truth), `DREAMS.md §2`
(unbuilt `FieldProjectionLayer` — the software hook for controllable per-lamp color).

## TL;DR
- **The physics is one rule.** A white wall lit by several colored lamps whose light
  sums to ~white; block one lamp with an object and that shadow isn't black — it's the
  **complement** of the blocked lamp (block red → cyan shadow). N lamps from N angles →
  N offset colored shadows. This is exactly Olafur Eliasson's *Your uncertain shadow*
  (5 colored lamps, 5-colored silhouettes). Pairs: **red↔cyan, green↔magenta, blue↔yellow**.
- **The beamer adds a second kind of source.** The projector is a *structured* light
  (it carries the image) and much brighter + cooler than a Hue lamp. Block a **flat Hue
  lamp** → the image still shows *through* the recolored shadow. Block the **projector**
  → a colored **hole** is punched in the image (the Hue fill color). Structure lives in
  the projector; the lamps are the complement fills. That split is the whole design space.
- **The "inverse" that makes shadows pop** (K.'s phrase): set the Hue fill to the
  **complement of the dominant projected color**, brightness-matched to wash the lit
  wall pale. Then the *shadow* of that lamp is projection-alone = the vivid saturated
  image blazing inside the silhouette while everything around it is washed out. The
  shadow carries the *most* color, not the least — figure/ground inverted.
- **#1 thing that kills it: level imbalance.** The beamer is bright + directional; Hue
  lamps are dim + wide. Unbalanced, the lamps vanish and you just see the projection.
  Darken the projection, aim lamps close, and/or push lamp brightness via `/api/brightness`.
- **You're breaking the standard VJ rule on purpose.** Conventional advice keeps stage
  light *off* the projection surface to protect contrast. Overlapping them (the goal
  here) sacrifices image *detail* → design projections as **bold color-blocks / coarse
  patterns**, not fine imagery.

## Key Findings

1. **Colored shadows are additive subtraction by occlusion.** Illuminance is linear, so
   the wall color at any point = sum of every lamp reaching it. Remove one lamp's
   contribution (a shadow) and you're left with the sum of the rest. Choose the lamp
   set so the *full* sum reads ~white and every single-lamp shadow reads as a saturated
   complement. This is a solved, reliable effect — not a maybe.

2. **The rig can do the fan effects today, with a caveat.** 5 color-capable Hue lamps
   (≈8 possible), each at a recorded `[x,y,z]` position — enough physically separable
   sources. **But** software can't set each lamp to an arbitrary independent color:
   `SuperfluidFlowLayer` colors each lamp by its *distance from the screen wall* across
   one global palette. Three ways to get the colors you want — see §Rig options.

3. **Motion is the amplifier, same as the visuals.** A static colored-shadow blob is
   pretty; a *moving* occluder (dancer, spinning fan blade, hand) makes the silhouettes
   swim and multiply. When the occluder chops a *projected pattern* (spiral, grid), the
   shadow becomes a moving negative of the pattern — the strongest look in the roster.

4. **Haze is the single biggest multiplier.** With atmospheric haze the beamer cone and
   Hue beams become visible *volumes*; an occluder then casts a dark **shadow volume**
   (god-rays in negative) through colored air. Turns the whole effect 2D → 3D. Caveat:
   haze lowers contrast, so re-balance levels after adding it.

5. **The only true "defraction" is refraction/caustics.** Transparent occluders (water,
   ridged acrylic, a prism, a disco ball) *bend/split* light into moving caustics and
   spectral edges — a different visual family from occlusion shadows. Keep it separate;
   it's the one slot that literally splits light.

6. **Build it empirically on the night.** Hue "blue/green" primaries ≠ beamer primaries,
   so the complement math is approximate (metamerism). The roster is the hypothesis; final
   pairings get tuned against the actual wall.

---

## Details

Each roster entry rates **Woah** (impact), **Difficulty** (to stage), and **Cost**
(gear/effort) on 1–10. Setup → what you see → why it pops.

### Rig options — how the lamps get their colors

- **(a) Gradient trick (works today, no code).** A wide `palette` / `colorSpan` spanning
  complements (e.g. red→cyan) makes near-screen lamps read red and far lamps read cyan,
  because color follows distance from the screen wall. Color follows *position*, not
  intent — arrange lamps by the color you want them to be.
- **(b) Hand-pin for the trial (recommended for the weekend, no code).** Set each lamp's
  color directly in the Hue app (or a REST fill). Zero software work; the research only
  needs the wall to look right.
- **(c) Build `FieldProjectionLayer`** (`DREAMS.md §2`, ~150 lines C#, **unbuilt**) for
  true per-lamp point-projection — the clean path to making colored shadows a controllable
  *feature* later, driven by the same brain that drives the visuals. This is the hook if
  the weekend trial earns a build.

Brightness note: lamp brightness is *not* one of the four live-tunable Superfluid keys —
tune it via `/api/brightness` (process-wide multiplier) or GlobalEnergy, **not**
`/api/effects/params`.

---

### PART 1 — OCCLUSION SHADOWS (the core)

#### 1.1 CMY Fan — the Eliasson baseline — Woah 8 | Difficulty 2 | Cost 2
**Setup:** 3–5 Hue lamps whose light sums to ~white, spread along a line/arc, each a
different hue; a person or prop in the field. **No beamer needed** (or beamer at black).
**See:** the silhouette fans into 3–5 colored ghosts — RGB lamps → cyan/magenta/yellow
shadows; add orange + blue-green for 5 (Eliasson's exact palette); overlaps go darker,
full block = black. **Why it pops:** pure complements on a near-white ground, and every
movement multiplies the ghosts. **Build/test this FIRST** — it's the guaranteed-good
baseline and needs no projector. **Reference:** Olafur Eliasson, *Your uncertain shadow
(colour)*, 2010 (5 HMI lamps: 2 green, magenta, orange, blue).

#### 1.2 Complement Reveal — the signature "inverse" — Woah 10 | Difficulty 5 | Cost 3
**Setup:** Projection = a saturated single-hue *structured* pattern (the red spiral).
Lamp = its **complement** (cyan = green+blue) as a flat side-fill, brightness matched to
wash the projection pale. **See:** an occluder blocking the lamp → the red spiral
**blazes, pure and bright, inside the silhouette** while the surrounding wall is washed
white; an occluder blocking the beamer → a cyan hole where the spiral was. **Why it
pops:** the shadow carries the *most* saturated color, the opposite of every intuition
about shadows — figure and ground inverted. This is K.'s "inverse apply to make shadows
pop." **Difficulty is all in the level balance** (see checklist).

#### 1.3 Opponent Split — cheapest colored shadow — Woah 6 | Difficulty 1 | Cost 1
**Setup:** Two opponent-hue lamps from left/right (red+cyan, or filmic orange+teal);
beamer neutral or off. **See:** two offset colored shadows leaning apart, a mixed band
between them. **Why it pops:** minimal rig, very "filmic" (orange/teal is the cinema
grade). The reliable fallback when only 2 lamps are free.

#### 1.4 Structured Chop — motion is the subject — Woah 9 | Difficulty 4 | Cost 3
**Setup:** Projection = a *moving* pattern (spiral, grid, scanlines — already in
`web/viz`). Lamp = flat complement fill. Occluder = something moving *between beamer and
wall* — a spinning fan blade, a hand, a hanging mobile, a dancer. **See:** the occluder
chops the pattern, dragging pattern-shaped shadows across the wall. **Why it pops:** the
shadow isn't a blob, it's a *moving negative of the spiral* — motion + structure at once.

#### 1.5 Depth Stack — layered occluders — Woah 6 | Difficulty 3 | Cost 2
**Setup:** Two occluders at different distances from the wall in the same colored field.
**See:** their shadows differ in size and softness (near = big/soft, far = small/sharp);
overlaps mix into tertiary colors. **Why it pops:** parallax + color layering reads as
real depth on a flat wall.

---

### PART 2 — VOLUME & LIGHT-BENDING

#### 2.1 Haze Volumetrics — beams become solid — Woah 9 | Difficulty 4 | Cost 5
**Setup:** Add atmospheric haze/fog to any of the PART 1 setups. **See:** the beamer
cone and each Hue beam become visible *volumes* in the air; an occluder casts a dark
**shadow volume** (god-rays in negative) through the colored haze, and the beamer's
structured beam rides the haze as a 3D spiral cone. **Why it pops:** the whole effect
jumps 2D → 3D — the biggest single multiplier for a party. **Caveat:** haze lowers
contrast; re-balance levels after adding it. **Cost** is the haze machine.

#### 2.2 Refraction / Caustics — the actual "defraction" — Woah 8 | Difficulty 3 | Cost 3
**Setup:** *Transparent* occluders between a lamp and the wall — a glass of water,
ridged/hammered acrylic, crumpled cellophane, a cut-glass prism, a rotating faceted
object, or a disco ball hit by a single Hue spot. **See:** light *bends and splits* into
moving caustic patterns and spectral rainbow edges; a colored beam through a prism throws
a mini-rainbow, water throws wobbling caustics that a colored lamp tints. **Why it pops:**
real dispersion — the only slot that literally splits light, the closest thing to the
"defraction" K. reached for. **Keep it a separate visual family** from the occlusion
shadows; it reads differently.

---

### PART 3 — WEEKEND TEST PROTOCOL

Run in order. Each step says what you should now see and what to check if you don't —
so confidence builds one rung at a time instead of fighting five variables at once. Do
it in a dark room, matte light-colored wall, colors **hand-pinned in the Hue app**
(rig option b — no code needed).

1. **Wall + one white Hue lamp.** → You should see an even, neutral wash and a plain
   dark shadow of your hand. *If the wall looks colored or the room isn't dark enough:*
   kill ambient light first — colored shadows die in room light. Nothing below works until
   this does.
2. **Two lamps, red + cyan, from left and right (~30° apart) + your hand.** → Two offset
   shadows: a **cyan** one where the hand blocks red, a **red** one where it blocks cyan,
   yellow-ish where both. *If the shadows are pale/washed:* the two lamps aren't balanced —
   even their brightness. *If the two shadows sit on top of each other:* move the lamps
   further apart. (Roster 1.3)
3. **Three lamps summing to ~white (red / green / blue), spread in an arc + your body.**
   → Three colored ghosts — **cyan, magenta, yellow** — fanning out, darker where they
   overlap. Walk closer/further and watch them scale and shift. *If you can't get white
   from the three:* nudge each lamp's brightness until the un-shadowed wall reads neutral.
   (Roster 1.1 — the Eliasson baseline. This is your "it works" milestone.)
4. **Now add the beamer:** project a **dark, saturated red spiral**, and light the wall
   with a **cyan** fill lamp from the side. Put your hand in the cyan beam. → Inside the
   hand's shadow the **red spiral should blaze bright** while the rest of the wall is pale.
   *If the spiral looks the same inside and outside the shadow:* the cyan lamp is too dim
   relative to the beamer — brighten it / darken the projection until the wall around the
   shadow washes pale. This balance IS the effect. (Roster 1.2 — the signature.)
5. **Swap in variety:** (a) a **moving pattern** instead of the spiral + a moving occluder
   → pattern-shaped shadows swim (1.4); (b) a **prism / glass of water** in a lamp beam →
   caustics + rainbow edges (2.2); (c) **haze** if you have it → beams turn solid and
   shadows become 3D volumes (2.1). These are the "play and discover" steps — no fixed
   target, just note which combos score highest and add them to the roster.

### Trial log — 2026-09-09 (first live run, Setup B)

Ran with 5 Hue lamps out in the room aimed at the projection screen, beamer showing the
party engine. K. chose to **skip steps 1–3 and go straight to step 4** (the signature
Complement Reveal), so there is no CMY-fan baseline underneath these results — worth
re-running from step 1 before trusting any conclusion below.

**Rig split that worked, keep it.** Two operators, one surface each: the light side owned
the lamps directly over the Hue API, the beamer side owned the screen only. This needed a
code change — `web/party.html` was writing to the lamps on a timer (`pushLamps` in
`web/party-main.js`: `runEffect`, `runEffectParams` *and* `Hue.energy` all live inside it),
which fights any human driving the same lamps. Added **`?nolamps=1`** — open the beamer as
`party.html?nolamps=1` and the page makes zero lamp and zero `/api/energy` calls. Verified
live: lamps held black when the page opened. Drop the param to hand the lamps back.

**New light-scenes** (`web/party.js`): **`Shadow Red`** (hue ~0, sat 1.0, `colorSpan` 0.12,
dark ground) and **`Shadow Red Dim`** (same at ~half level). Bold/coarse/saturated per the
checklist — fine detail is a liability here, not a loss.

**Roster 1.2 Complement Reveal — underwhelmed in this room.** Cyan fill `00FFFF`,
AmbientStatic brightness 100, `/api/brightness` 1.0 against a full-level `Shadow Red`
projection read **over-washed**; K.'s verdict was *"it's okay, I guess."*

- **`/api/brightness` is DIMMING-ONLY.** At 1.0 the lamps are at their ceiling, so once the
  wall is over-washed the *only* remaining lever is the beamer. This asymmetry decides who
  fixes what: over-washed → light side dims; same-inside-and-outside-the-shadow → beamer
  side dims. Nobody can push cyan harder.
- **Documented pairing: at cyan-max this room needs the beamer at ≤50% level for the blaze
  to beat the wash. NOT visually confirmed** — we pivoted before retrying with
  `Shadow Red Dim` and ran out of room time. First thing to test next session.

**The real finding: K. wasn't asking for colored shadows.** His repeated word was
*diffraction*, and after seeing the reveal he said *"there's just not that much diffraction
in it."* He is right, and it is structural, not a tuning failure: **occlusion shadows never
split light.** PART 1 gives offset colored ghosts; the splitting/bending K. keeps reaching
for is §2.2, a separate visual family. The doc already said this — the trial confirmed the
distinction matters to him more than the roster order implies. **Consider leading the next
session with 2.2, not 1.1.**

**Pivoted to 2.2 with ~10 minutes left.** Flood down, four lamps dark, one lamp as a tight
spot, occluders held in the beam (CD, glass of water, cellophane).

- **Source colour depends on the occluder — an optics call worth keeping.** A **CD/DVD is a
  diffraction grating: it needs a WHITE source** to throw a rainbow; a saturated source
  gives same-colour diffraction orders and no rainbow at all. Save the saturated source for
  **prisms and water caustics**, where it strengthens the spectral edges.
- **Hue lamps are wide soft sources, not hard points**, so caustics and diffraction read
  softer than an ideal spot. Holding the occluder close to the wall helps. If 2.2 becomes a
  keeper, a genuine hard point source is the gear to buy.

**Gotcha that cost us the last 10 minutes: the field layer freezes motion by design.**
A static `/api/effects/field` overlay (per-lamp colour points, priority 1) sits *above* the
ambient layer and pins every lamp to its fixed point — the moving effect underneath keeps
running and is simply never seen. The lamps look frozen, `/api/effects/params` still
answers `softUpdate: true`, and nothing reports a fault. **Clear the field (`{points:[]}`)
before expecting movement.** Note this is a *different* failure from the dead-layer trap in
`web/party-main.js`, and it presents identically from the outside — check the field overlay
first, it's the cheaper thing to rule out.

**Also learned:** the party engine's **attract mode auto-rotates light-scenes**, which kept
cycling the screen off the pinned hue mid-test — `attract → stop` on the dashboard before
any colour-critical trial. And K.'s physical remote was dead the whole time because
`listen.py` wasn't running.

**Result:** rig split, `?nolamps=1`, the two scenes, and the dimming-only asymmetry are all
banked. Roster 1.2 is unconfirmed-at-best in this space. 2.2 results not captured — the
clock ran out.

---

### The white-box reframe — 2026-09-09, the actual discovery

The wash-out that this doc (and I) spent the whole first run treating as roster 1.2's
*failure mode* is, from inside the room, the strongest thing that happened. K.'s words:
it *"pulls you out of the box — you suddenly realize you're in a white box."* When the
overlapping light washes the projected image to pale, the picture dissolves and what you
notice instead is the physical room you're standing in. **The figure/ground flip lands on
the viewer, not the wall.** That is a meta / perspective-shift beat, not a lighting error —
and it belongs in DESIGN.md's "one organism that pulls you out" language, not buried as a
balance gotcha. Consider a deliberate scene that *drives to* the white-out on purpose.

Two more live notes from the same session:
- **Brightness: the rig runs far too hot at full.** `/api/brightness` 1.0 is glare;
  ~0.45 was the first "softer" reading. Colored-shadow work wants a DIM room and dim
  lamps — the effect reads better quiet than bright.
- **The diffusion/caustics want to be a MECHANIC, not decoration.** Passive caustics from
  a water glass are pretty but inert. K. wants them to *do* something — respond, trigger,
  reveal — i.e. couple the refraction to the shared house state rather than leave it
  sitting in a beam. Open build idea, not yet designed.

---

**On the night, log what actually pops.** Metamerism means the real winners may differ
from the predictions above — write the good pairings back into PART 1.

---

### Make-it-work checklist (the gotchas that decide success)

- **Balance illuminance — the #1 failure.** Beamer bright + cool, lamps dim + wide.
  Unbalanced → lamps vanish. Fix: darken/dim the projection, aim lamps close, push lamp
  brightness via `/api/brightness` or GlobalEnergy (not `/api/effects/params`).
- **Break the PM rule on purpose.** Overlapping physical light + projection kills image
  *detail* → design projections as bold color-blocks / coarse patterns, not fine imagery.
- **Angular separation ~15–45°** between sources around the occluder. Too close → muddy;
  too far → shadows leave the object.
- **Matte neutral wall/screen; kill ambient room light.** Colored shadows die in room light.
- **Beamers can't project black** — "black" areas leak grey light that pollutes shadows →
  purer lamp shadows come from *darker* projection.
- **Gamut / metamerism** — Hue primaries ≠ beamer primaries; complement math is approximate.
  Tune on the wall.
- **Occluder opacity:** opaque = crisp shadows; translucent = soft + tinted.
- **Color temp** (VJ convention): projection cool, physical warmer — or clash deliberately.

---

## Summary table

| # | Effect | Beamer? | Lamps | Woah | Diff | Cost | First-try? |
|---|--------|---------|-------|------|------|------|-----------|
| 1.1 | CMY Fan (Eliasson) | no | 3–5 sum-white | 8 | 2 | 2 | **start here** |
| 1.2 | Complement Reveal | yes (structured) | 1 complement fill | 10 | 5 | 3 | after 1.1 works |
| 1.3 | Opponent Split | optional | 2 opponent | 6 | 1 | 1 | warm-up |
| 1.4 | Structured Chop | yes (moving) | 1 fill | 9 | 4 | 3 | later |
| 1.5 | Depth Stack | optional | any | 6 | 3 | 2 | later |
| 2.1 | Haze Volumetrics | any | any | 9 | 4 | 5 | needs haze |
| 2.2 | Refraction/Caustics | optional | 1 spot | 8 | 3 | 3 | found objects |

---

## Sources

- Olafur Eliasson, *Your uncertain shadow (colour)*, 2010 — [Studio Olafur Eliasson](https://olafureliasson.net/artwork/your-uncertain-shadow-colour-2010/), [TBA21](https://tba21.org/your-uncertain-shadow)
- Colored shadows / additive mixing — [Physics Classroom](https://www.physicsclassroom.com/interactive/light-waves-and-colors/colored-shadows/notes), [Science in School: additive mixing & coloured shadows](https://scienceinschool.org/article/2024/additive-mixing-coloured-shadows/), [UMD Physics lecture-demo O3-01](https://lecdem.physics.umd.edu/o/o3/o3-01.html)
- Projection + physical stage light coordination — [HeavyM: projection mapping concerts](https://www.heavym.net/projection-mapping-concerts-how-visuals-transform-live-music/), [TSE Entertainment: projection mapping small stages](https://tseentertainment.com/bringing-big-visuals-to-small-stages-projection-mapping/)
