# DEEP HOUSE — THE SLIME MOLD

> ⚠️ **This got worked out too early.** K.'s follow-up: *"not worked out
> properly yet — spitball ideas and find similar ideas so we can build on
> ideas."* Fair. Treat this as **one sample branch taken further than the rest**,
> not as the chosen direction.
>
> **The actual idea pool is `docs/ORGANISM-IDEAS.md`** — ~25 adjacent systems
> (other slime molds, fungal networks, immune memory, ant trails, sandpiles,
> sourdough) with the mechanic each one hands you. Start there. Come back here
> only for an example of how deep one of them goes.
>
> Worth keeping anyway for two things: **§2's biology→mechanic table** (which
> maps cleanly onto whichever organism wins) and **§4's salt gate**, which is
> the part of K.'s original idea that survives every variation.

*K.'s idea, 2026-07-23. Not a plan — a dream with a build sketch.*

> *"maybe even have a worked out dream idea based on slime molds. considering
> that this project is one big flow anyway. it lines up with how slime molds
> work. every time we develop a feeling better it may let the slime mold grow.
> maybe the slime mold needs to find another slime mold that knows how to cross
> salt before being able to venture somewhere else"*

---

## 0. Why this is the best idea we've had

Two reasons, and the second is the important one.

**First:** it fixes every structural gap in `PLAY-MODELS.md` §0 at once —
reason to pick *this* star, reason to return, something that changes between
repetitions, something you can lose, something you build that persists, a second
agent, and a use for the room. Not one at a time. All of them, from one concept.

**Second, and this is the part that matters:**

> **The mechanic K. invented — "find another slime mold that knows how to cross
> salt" — is a real, documented biological phenomenon.**

*Physarum polycephalum* habituates to noxious substances (salt, quinine,
caffeine): exposed repeatedly, it learns to cross them. And when a habituated
plasmodium **fuses** with a naive one, the naive one **acquires the
habituation** — learned tolerance transferred by merging bodies. After they
separate, the formerly-naive one keeps it.

So the game mechanic is not a metaphor laid on top of biology. **The biology
already is the metaphor.** Nothing has to be authored, explained, or narrated —
which is the entire firewall problem solved by accident.

And consider what that mechanic *says*, in a piece about sensory load, masking,
and burnout:

> There is a place you cannot go. Not because it's locked — because it would
> hurt you. You don't find a key. You find someone who has already survived it,
> you merge with them for a while, and afterwards you can go there too. You keep
> it even after you separate.

That is not a puzzle. That's the truest thing this installation could possibly
say, and it says it entirely in mechanics.

---

## 1. The reframe: you stop being a cursor and become a body

Today you are a **selection** — a disembodied point that teleports between
stars. Nothing persists, nothing has extent, nothing costs.

Instead: **you are the plasmodium.** A single cell with many nuclei, no brain,
and a body that occupies part of the field.

| today | as a mold |
|---|---|
| a cursor jumps to a star | a growth front **extends** toward it, taking time |
| position is a single id | your body is a **set of stars and the tubes between them** |
| travel is free | extending costs mass you must have |
| nothing decays | unused tubes **thin and are reabsorbed** |
| you can go anywhere adjacent | you can go where your body can **survive** |
| developed = permanent tick | developed = **food**, which becomes mass |

You are no longer navigating the field. **You are living in it.**

---

## 2. The real biology, and what each part becomes

Every mechanic below is a documented Physarum behaviour. Confidence noted —
these are from memory and worth verifying before citing publicly, but the
behaviours themselves are well established.

| biology | what it does in Deep House |
|---|---|
| **Maze solving** — retracts dead ends, keeps the shortest path *(Nakagaki, Nature 2000)* | your body naturally prunes itself toward the routes you actually use. Your history becomes your anatomy. |
| **Network optimisation** — reproduced the Tokyo rail network from oat flakes *(Tero, Science 2010)* | the mold is *good at graphs*. Playing well looks like an efficient network, and the piece is already a graph. |
| **Shuttle streaming** — cytoplasm oscillates back and forth, ~100–120 s period; tubes thicken with flow | **THE HOUSE PULSE, finally alive.** `heartbeat`/`breathing` are documented core systems that I measured this session as inert. The mold gives them a job. |
| **Habituation to salt/quinine** *(Boisseau, Vogel & Dussutour 2016)* | hostile districts you cannot cross until tolerant |
| **Transfer of habituation by fusion** *(Vogel & Dussutour 2016)* | **K.'s mechanic.** Merge with a tolerant mold, acquire its tolerance, keep it after parting. |
| **Externalised spatial memory** — leaves extracellular slime, avoids re-exploring it *(Reid, PNAS 2012)* | the field visibly records where you've been. Memory outside the body. |
| **Anticipation of periodic events** — slows in advance of a rhythm it has learned, even when the stimulus doesn't come *(Saigusa 2008)* | **the mold learns YOUR rhythm and starts moving before you press.** |
| **Sclerotium** — hardens into dormancy under stress, revives when conditions improve | overload doesn't kill; it makes you go still and wait |
| **Fusion of compatible individuals into one organism** | the endgame — see §6 |
| **No brain, no neurons, obvious preferences** | the anti-AI. It is emphatically not intelligent, and it is emphatically *someone*. |

That last row is worth dwelling on. `agency.js` opens by insisting the house is
"not an AI and not dialogue." **A slime mold is the perfect organism for that
claim** — it demonstrably has memory, preference, anticipation and problem-solving,
and just as demonstrably has no mind. Exactly the thing the piece keeps trying to
say about a nervous system.

---

## 3. The loop

### 3.1 Mass — the one number, and it's never shown

The mold has **mass**. Everything spends or earns it.

```
  develop a star   → food → mass grows
  extend a tube    → costs mass
  hold territory   → slow upkeep per occupied star
  hostile ground   → heavy drain while crossing
  dormancy         → upkeep near zero, but nothing grows
```

No bar, no number (T2 — `GAME-SYSTEMS.md`'s rubric). **You read your mass by
looking at your own body**: a thriving mold is thick, bright, fast-pulsing; a
starving one is thin, translucent, and its far tubes are already dissolving.

That is `DESIGN.md` invariant 2 done properly — *if it moves, it means*.

### 3.2 The verb changes from "tune" to "tend"

The current core verb (hold ↑ until σ 0.9) doesn't disappear — **it becomes
feeding.** But now it exists in a context that makes it matter:

- you must be able to *reach* the star (topology + tolerance)
- reaching costs mass you had to earn elsewhere
- while you're feeding here, your far edges are thinning
- feeding well yields more mass than feeding sloppily

Suddenly "which star, and when" is a real question with a real answer, and the
same three-second action carries weight it could never carry alone.

### 3.3 Retraction is the answer to "nothing is ever lost"

`GAME-SYSTEMS.md` §1.2 identified that nothing in the piece can be lost, so
nothing is a decision. The mold solves it without a fail state:

**Tubes you stop using thin out and are reabsorbed.** The star stays developed
forever — you never lose *understanding*. You lose *reach*. Going back is always
possible and always costs again.

> Loss without punishment: the mold forgets its body, never its knowledge.

---

## 4. Salt — the gate that isn't a lock

This is K.'s mechanic, and it should be the spine of the mid-game.

### 4.1 What salt is

Certain districts are **hostile**. Crossing them drains mass fast enough that a
naive mold turns back — not blocked, just *badly hurt*. It's a soft wall you can
throw yourself at and survive, which is far better design than a locked door,
because you discover the boundary by feeling it rather than by being told.

Different districts carry different hostilities. Suggested mapping — each one
tied to an existing house variable, so the field's hostility is genuinely the
organism's physiology:

| hostility | drains | reads as |
|---|---|---|
| **salt** | mass, steadily | raw sensory load |
| **light** | pulse coherence (you desync) | overexposure, being perceived |
| **quinine** | the *yield* of feeding | bitterness — nothing nourishes here |
| **dryness** | extension speed | fatigue |

### 4.2 Tolerance, and how you get it

You cannot buy, unlock, or grind tolerance. **You acquire it from another
organism that already has it.**

Somewhere in the field are **other plasmodia** — small, autonomous, not you.
Each carries the tolerances it has survived. They wander (this is
`PLAY-MODELS.md` §3A's "something moves in the field," now with a reason to
exist).

To gain a tolerance:

1. **Find one.** They're not marked. You notice them by their pulse — a rhythm
   in the lights that isn't yours.
2. **Approach without startling it.** Fast extension makes it retreat. This is
   where stillness becomes a mechanic (`DESIGN.md` invariant 11) — *be still and
   it comes to you.*
3. **Fuse.** Your bodies merge. For a while you are one organism: bigger,
   stranger, harder to steer, pulsing at a rhythm that is neither of yours.
4. **Separate.** You keep the tolerance. Permanently.

### 4.3 Why fusion is the best part

While fused, **you are not fully in control.** The merged organism has its own
inclinations. It drifts. Your inputs are one of two voices.

That is the single most on-theme mechanic available to this project: *"the
visitor influences the house but does not fully control it,"* made literal, and
also — for thirty seconds — genuinely disorienting in a way nothing else here is.

And then you part, and you can go somewhere you could not go before, and nothing
ever explained why.

---

## 5. What this fixes, checked against the rubric

Against `PLAY-MODELS.md` §0's list of missing categories:

| gap | fixed by |
|---|---|
| reason to pick *this* star | reachability, food value, and what your body currently supports |
| reason to **return** | tubes thin; territory needs re-flowing |
| something **changes** between repetitions | your body shape, mass, tolerances, and pulse |
| something you can **lose** | reach, mass, territory — never knowledge |
| something you **build** | *the mold itself* — a visible organism that is yours |
| something the house **wants** | food, growth, and eventually §6 |
| a **second agent** | the other plasmodia |
| uses the **room** | mold extent → lamp extent (`DREAMS.md` §2 projection) |
| uses **timing** | shuttle streaming; anticipation of your rhythm |

Against `GAME-SYSTEMS.md`'s six tests:

- **T1 no fail** ✅ starvation → dormancy, not death. Dormancy is safe, boring,
  and always recoverable. Hostility hurts, never blocks absolutely.
- **T2 nothing measured** ✅ mass, health and reach are read off the body's
  appearance. No numbers anywhere.
- **T3 nothing explained** ✅ everything is discovered by extending and watching.
- **T4 one river** ✅ every mold variable maps to an existing `HOUSE.*`:
  mass↔`processingBudget`, pulse↔`heartbeat`/`breathing`, hostility↔`sensoryLoad`,
  dormancy↔`fatigue`, tolerance↔`regulation`.
- **T5 four buttons** ✅ ↑↓ choose a direction to grow, Enter extend/feed, Esc
  retract. *The same four buttons mean something new.*
- **T6 Portal rule** ✅ someone who never grasps the metaphor is still growing a
  beautiful yellow organism across a starfield, which is a complete experience.

**It passes all six, and it revives three documented-but-inert systems** — House
Pulse, `processingBudget`, and agency's targeting.

---

## 6. The endgame

Phase 3 currently reorganises the field around the one star that seven of eight
cases share, wordlessly. Keep that — but let the mold carry it.

**The other plasmodia are not strangers.** They're fragments of the same
original organism, split long ago. Each survived something different and carries
the tolerance for it. That's why fusion works at all — genetically compatible
individuals fuse; incompatible ones don't.

The final act is not solving anything. It's **the mold becoming whole again** —
every fragment reincorporated, every tolerance carried by one body, spanning a
field it can now cross entirely.

One organism that had to be many in order to survive different things, tolerating
all of them at once, at rest.

> *"the house learned to communicate with itself. Final state is dynamic
> symmetry — a living system, not perfect stillness."* — `DESIGN.md`

A plasmodium at full extent is never still. It pulses forever. That is *exactly*
the ending the design document asks for, and the biology delivers it for free.

---

## 7. Build sketch

Deliberately rough — this is a dream, not a plan.

**New (~500 lines, no dependencies, no C#):**

```
web/field/mold.js      body: occupied stars, tube thicknesses, mass,
                       tolerances, pulse phase. grow/retract/feed/fuse.
web/field/plasmodia.js the other molds: wander, flee, offer tolerances
```

**Modified:** `render.js` (draw the body — thick veins, a translucent growth
front, flow shimmering along tubes); `nav.js` (extension replaces teleport);
`field-room.js` (wire it); `config.js` (the constants).

**Deleted:** nothing.

**Reuses unchanged:** the graph, the layout, all 66 exhibits, phases, cases,
moments, beds, agency, progress.

**Hardest part:** rendering. A mold has to *look alive* — veins that thicken
visibly, protoplasm that visibly streams, a fan-shaped growth front. Get that
wrong and it's a blob. Get it right and people will watch it do nothing.

**Cheapest possible first test** — before building any of the above, prove the
feel in an afternoon: draw the trail you already record (`nav.trail`) as a
thickening vein instead of a line, make it thin over time, and see whether
watching your own path breathe is compelling. If that's boring, the full idea
is boring, and you've spent an afternoon.

---

## 8. The risk, stated honestly

**This is a big pivot.** It changes what the piece *is* — from walking a
constellation to growing an organism through one. The graph, the exhibits, the
lights and the arc all survive, but the identity shifts.

There's also a real tension worth naming: **the mold is charismatic enough to
eat the piece.** People may end up caring about the creature and not at all
about the constellation, the cases, or the convergence. That's not automatically
bad — a charismatic thing is what makes people tell their friends — but it's a
different work than the one currently described in `DESIGN.md`, and that should
be a decision rather than a drift.

My honest read: **the concept is strong enough to be worth that risk**, and
K.'s salt-fusion mechanic is the kind of idea that only arrives a few times in a
project. But it belongs after `DREAMS.md` §2 (room projection), because a mold
growing through a *physical room* is a fundamentally better thing than a mold
growing on a TV.

---

## 9. In one paragraph

You are a brainless yellow organism living in a constellation. Understanding a
star feeds you; feeding lets you grow; growing lets you reach further. Tubes you
stop using dissolve, so your body becomes a map of what you actually care about.
Some regions would hurt you, and no key exists — you must find another organism
that has already survived that place, merge with it until you are briefly one
confusing thing, and part carrying what it knew. Do that enough times and you
can cross everything, and the last thing that happens is that you become whole,
and pulse, and don't stop.
