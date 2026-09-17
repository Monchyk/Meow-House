# DEEP HOUSE — OTHER WAYS TO PLAY

*Written 2026-07-23 after K.'s critique: "it feels like click node → develop →
name → nothing → move on. Rinse and repeat. I wanted you to dream of different
KINDS of interaction, not keep circle-jerking around this web thingy."*

Fair. `DREAMS.md` and `GAME-SYSTEMS.md` both accepted the existing loop as given
and tried to improve it. This document does not. **Every idea here is a
different verb.**

---

## 0. Why it feels linear (the honest diagnosis)

It isn't linear because of the graph. It's linear because of this:

> **There is exactly one interaction in the entire piece, and it is
> non-negotiable, unaffected by context, and identical 139 times.**

Look at what's actually missing — not features, but *categories*:

| what a loop needs | Deep House today |
|---|---|
| a reason to pick **this** star over that one | none — all equivalent |
| a reason to ever **return** to a star | none — developed is permanent |
| something that **changes** between repetitions | only the picture |
| something you can **lose** | nothing |
| something you **build** that persists | a count |
| something the house **wants** | nothing — it only reacts |
| a **second agent** with different goals | none in play |
| anything using the **room** you're standing in | lights echo state, that's all |
| anything using your **body, voice, or timing** | nothing |

You have a house full of lights, a microphone, a tap-tempo engine, a physical
remote, three displays, an operator console on a phone, and a 26-variable
physiology — and **the entire piece is played by holding ↑ on a keyboard.**

That's the actual problem. Not the graph.

---

## 1. THE ONE I'D BUILD — the house wants something and cannot say it

**This is the headline. Everything else in this document is smaller.**

`DESIGN.md`'s cut test says the whole piece is *"a house trying to communicate
something it cannot directly say."* Right now the house communicates its **state**
— beautifully, through 26 variables and four light dimensions. It never once
communicates a **desire**.

### The verb: charades, with an organism

The house wants something specific. A star. A feeling. A pairing. A place in
the room. It cannot use words — the firewall forbids it, and it's the point.

So it **gestures**. It brightens a lamp on one side of the room. It pulses when
you move the right way. It goes quiet when you're cold. It gets agitated when
you're close and mistaken.

**You guess by acting.** Not by choosing from a menu — by *going somewhere*,
*naming something*, *doing something*. The house responds hotter or colder,
entirely through light, tempo, and its own physiology.

When you get it right, it doesn't say so. **It just gets calm** — the deepest
regulation state in the piece, held for a long moment, everything phase-locked.
The reward for understanding someone is that they settle.

### Why this is the right idea

- **It's the design document's own thesis, finally as a mechanic.** Not a theme
  applied to a mechanic — the mechanic *is* the thesis.
- It makes the house a **counterpart**, not a substrate. It wants. You can be
  wrong. Being wrong is content, not failure — a misunderstanding just makes it
  press harder or withdraw.
- **Every existing system becomes an expressive channel** with no rewrite:
  `agency.js` chooses the want, `beds.js` carries hot/cold, `moments.js` fires
  the settle, `house.js` supplies the frustration and relief.
- It's **infinitely replayable from finite content** — the wants are generated
  from the graph you already have.
- It needs **zero new input** and **zero on-screen text**.
- Two people in the room start *arguing about what it wants.* That's the
  installation working.

### What a want looks like

| the house wants… | it gestures by… | you satisfy it by… |
|---|---|---|
| a particular star | that region of the room warms as you approach it in the field | going there |
| a feeling named | its colour drifts toward a PAD region and sits there | naming a star that way |
| to be left alone | withdrawal — dimming, slowing, ignoring your presses | doing nothing for 30 s |
| two stars connected | both flicker in the same rhythm, out of phase with everything else | visiting one then the other |
| to show you something | one lamp keeps returning to the same colour | following it |
| to be *asked* | it holds a single held note of light | pressing Enter on empty space |

That last row is my favourite. **The house wants to be asked how it is.** There
is no UI for that. You'd have to notice, and then try it.

### Build sketch

`AGENCY` already picks intents and targets — a want is an intent with a
**duration and a satisfaction condition** instead of a one-shot. Roughly:

```js
// agency.js — a want is a long-lived intent
{ kind: "want", target: <starId|feeling|pair>, warmth(ctx) -> 0..1,
  satisfied(ctx) -> bool, patience: 90 }
```

`warmth()` is the whole game: a scalar the light layer already knows how to
express. Everything else exists.

**Cost:** meaningful but not huge — maybe 200 lines, no new files, no C#.
**Risk:** if warmth is too subtle nobody notices; too obvious and it's a fetch
quest. That dial is the entire design problem, and it's tunable.

---

## 2. NEW VERBS BY MODALITY

Organised by *what part of you plays*. The current piece uses one finger.

### 2A. THE ROOM — dowsing (you stop looking at the screen)

**The verb: search a physical space, blind.**

The screen goes dark, or near it. Something is hidden in the field, and the only
instrument is **the room itself**. Lamps run hot and cold as you move the
selection. You're not reading a graph; you're feeling for something in the dark
with six lights as your only sense.

This inverts the entire piece: **screen secondary, room primary.** It's the
strongest possible use of the spatial lamp data (`MappedLight.Position`, in
centimetres, already there — see `DREAMS.md` §1) and it makes people physically
turn around.

*Why it's good:* it's the only idea here that would make a visitor **stop
looking at the TV**, which is the single biggest thing separating "installation"
from "website on a big screen."

### 2B. THE VOICE — the house listens

**The verb: make sound, or don't.**

`brain.js` already has microphone FFT for tempo estimation. It is used for BPM
and nothing else. But a live mic means the house can respond to:

- **volume** — a loud room agitates it; it withdraws
- **silence** — genuine quiet is a mechanic (`DESIGN.md` invariant 11!), and the
  house can *require* it: some things only happen when the room is truly still
- **humming** — pitch-match a tone the lamps are "singing." Entrainment as a
  verb
- **presence** — sound at all means someone is there; silence for minutes means
  the house is alone, and it behaves differently when alone

> **The moment:** the house is holding a colour, and it's also holding a tone.
> You hum it. The lamps lock to you. You are not pressing anything.

*Cost:* the mic pipeline exists. Adding an RMS/pitch read to it is small. This
is probably the **highest wonder-per-line item in this entire document.**

### 2C. THE PULSE — entrainment (play in time, not in sequence)

**The verb: synchronise with a living rhythm.**

`DESIGN.md` describes the House Pulse as a core system: *"one heartbeat; regulated
→ subsystems phase-lock, entropy → they desync."* I measured it this session —
**it's inert.** `heartbeat` and `breathing` are written by two scripted events
and nothing else.

So: make the pulse the verb. The house has a heartbeat. You press **with** it.

- press on the beat → you're entrained; things open, the field steadies
- press against it → desync; the room fragments, the picture won't hold
- the house's rate changes with its state, so **staying in time means tracking
  its mood**, not memorising a tempo

That's a genuine skill, it's physical, it's rhythmic, it works on a 4-button
remote, and it turns an already-documented dead system into the core loop. And
it's a **DJ's verb** — which, given the abandoned-DJ-booth aesthetic and your
own background, is thematically exact.

### 2D. TIME — the house at 3am

**The verb: choosing *when* to come.**

`progress.js` already stores `firstSeen`/`lastSeen` timestamps and does nothing
with them. Real clock time is free and completely unused.

- the house is different late at night — slower, more nostalgic, more honest
- come back after days away and it's guarded; you have to re-earn it
- some things only happen in the first two minutes of a session, before it
  wakes up properly
- some things only happen after you've been still for a long time

*Why:* it makes the installation a **place with weather** rather than a program
with states, and it costs almost nothing.

### 2E. THE SECOND PERSON — you are not alone

**The verb: play against, or with, another human.**

`the-basement.html` + `operator.js` already exist: a hidden phone console where
you perform the house live. It's currently a mixing desk. Make it a **hand of
cards with costs** (detailed in `GAME-SYSTEMS.md` §6).

One player walks the room with four buttons and no information. The other
performs the organism from a phone with full information and a limited hand.
Neither can win. The operator's moves spend from the same physiology the visitor
is trying to settle.

**This is the fastest route from "installation" to "game" in the whole project,
and it's ~80% built.** It's also the most demo-able sentence you have: *"you
walk, I'll be the house."*

---

## 3. NEW STRUCTURES — reasons for *this* star, *now*

Verbs alone don't fix "rinse and repeat." You also need a shape to the session.

### 3A. Something is moving in the field

Right now the field is inert furniture. **Put something in it that moves.**

Not an enemy — the house has no antagonists. Something more like weather, or an
animal: a slow presence that wanders the graph, that you can follow, lose,
startle, or sit still and let approach.

- follow it and it leads somewhere
- chase it and it flees
- **be still and it comes to you**
- it visits stars you haven't seen, and its trail is visible for a while after

Suddenly there is a reason to be at a *particular* star at a *particular*
moment. That single change converts a checklist into a hunt — and the "be still
and it approaches" rule makes patience the dominant strategy, which is
completely on-theme.

### 3B. Light is finite — the economy of attention

**A real constraint, without a resource bar.**

The house only has so much light. Illuminating one part of the field genuinely
dims another. To develop a new star, you let an old one go dark — it isn't
lost (nothing is ever lost), it *sleeps*, and waking it costs again.

Now every choice has a cost that is visible **in the actual room**, and the
question stops being "what next?" and becomes **"what am I willing to stop
looking at?"**

*Why it fits:* it's scarcity with no numbers, no bar, and no failure — and it's
thematically perfect for a piece about limited processing budget. (`house.js`
literally has a `processingBudget` variable. It's one of the inert ones.)

### 3C. The field decays — tending, not conquering

Developed stars don't un-develop, but they **fade** between visits. A star you
developed weeks ago and never returned to renders dim, its reading uncertain.
Revisiting restores it with a touch, not a re-tune.

The verb becomes **tending a garden** rather than clearing a map. It gives you a
reason to return, gives `AGENCY.nostalgia` something real to point at, and makes
the house's memory human rather than a database.

### 3D. The house imitates you

The most unsettling idea here, and cheap: `nav.trail` already records your exact
walk.

Later — much later, maybe next session — **the house walks it back.** A ghost
selection moves through the field on the path you took, at your pace, pausing
where you paused. You didn't ask for it. It isn't announced.

> The moment: *"...that's me. That's what I did."*

### 3E. Districts play differently

You have communities in the graph (`node.c`, already used to pick exhibit
families). Let them have **different physics**, not just different pictures.

One district is slow and heavy. One is skittish. One won't respond unless the
room is quiet. One inverts your controls, gently, and never explains it.

Same field, same buttons, different **feel** by region — so travelling somewhere
new actually *means* something changed.

---

## 4. THE ONE-SCREEN SUMMARY

| # | idea | verb | new input? | cost | why |
|---|---|---|---|---|---|
| **1** | **The house wants something** | guessing | none | ~200 ln | the design doc's own thesis, as a mechanic |
| 2 | Operator as opponent | 2-player | none | weekend | ~80% built; fastest path to "game" |
| 3 | The house listens (mic) | voice/silence | none | small | highest wonder-per-line |
| 4 | Entrainment (pulse) | rhythm | none | medium | revives a documented dead system; a DJ's verb |
| 5 | Something moves in the field | hunt / patience | none | medium | fixes "why this star now" |
| 6 | Dowsing (room-first) | search | none | needs `DREAMS.md` §2 | makes people stop watching the TV |
| 7 | Light is finite | sacrifice | none | small | scarcity with no bar |
| 8 | Field decays | tending | none | small | a reason to return |
| 9 | The house imitates you | recognition | none | tiny | cheapest chill in the document |
| 10 | Districts play differently | variety | none | medium | makes travel mean something |

**Not one of these needs a fifth button.**

---

## 5. If you want the biggest change for the least work

**Do #3 (listening) and #9 (imitation) first.** Both are small, both are
strange, and both immediately make the piece feel like it has senses and a
memory rather than a state machine.

**Then #1 (the house wants something).** That's the one that turns the whole
piece from a thing you operate into someone you're in a room with.

**Then #2 (operator as opponent)** if you ever want to show it to people as a
game rather than an installation — it's the demo.

The graph stays. It's good. It just stops being the *only* thing happening.
