# TRACES AND GATHERING

*The two ideas K. picked out of `docs/ORGANISM-IDEAS.md`, developed 2026-07-23.
Still not a plan — variations are left open on purpose, because the point is to
build on these, not accept them.*

---

## 0. The finding: these are one system, not two

I went in to write two sections and found they collapse into one.

**Dictyostelium aggregates *by* stigmergy.** Starving amoebae release cAMP;
neighbours detect the gradient, move up it, and *relay it by emitting their
own*. The signal propagates as spiral waves across the whole population. Nobody
is in charge, nobody signals anybody in particular, and a hundred thousand cells
converge.

That is textbook stigmergy — modify the environment, and the modification
drives the next action.

So:

> **Stigmergy is the medium. Gathering is what happens when the medium
> saturates.** One system, two timescales: traces moment-to-moment, a gathering
> across a session.

That's a whole piece, not two mechanics.

---

# PART ONE — STIGMERGY

## 1. What it actually is

Coined by Grassé in 1959, studying termites: *stigma* (mark) + *ergon* (work).
An agent changes the environment; the change stimulates the next action, by
anyone, including a different agent later.

- **Ants**: deposit pheromone, others follow and reinforce, evaporation prunes.
- **Termites**: drop a pellet with a bit of pheromone; others are more likely to
  drop nearby; pillars emerge; nearby pillars grow toward each other into arches.
  Nobody has the arch in mind.

Two flavours worth keeping distinct:

| kind | the signal is | Deep House example |
|---|---|---|
| **marker-based** | a deposited substance that fades | a warm trail on an edge you walked |
| **sematectonic** | the half-built structure itself | a partly-developed star *is* the message |

**And the crucial detail most people miss: evaporation is not a limitation, it
is the intelligence.** An ant colony with permanent trails locks onto the first
route it finds and can never adapt. Forgetting is what lets it re-solve the
problem when the world changes.

That single fact retroactively justifies the "memory decays" invariant proposed
in `DREAMS.md` §7 — it isn't melancholy flavour, it's **the mechanism that makes
the system able to change its mind.**

## 2. Why this is the firewall solution

This is the part I'd underline.

`DESIGN.md`'s hard rule: **no AI-authored prose about K. is ever rendered.** The
project keeps running into a wall — the house needs to communicate, and every
communication channel that involves *language* is either forbidden or has to be
laundered through the Guide's costume.

Stigmergy sidesteps it completely:

> **A mark is not prose.** A trail, a warmth, a thickened edge, a residue —
> these carry meaning without carrying language. The house can say a great deal
> and never author a sentence.

And it goes deeper than compliance. Look at what stigmergic communication
actually *is*:

- you cannot state anything directly
- you can only alter the shared environment
- the other party may or may not read it
- meaning accumulates in the world rather than being transmitted
- both sides are doing this simultaneously, at each other, without language

**That is alexithymia rendered as a communication protocol.** Not a metaphor for
it — a working model of it. In a piece whose entire glue is *"a house trying to
communicate something it cannot directly say,"* this is the most on-thesis
mechanic available, and it happens to be firewall-safe by construction.

## 3. What the house can now say

Give the house a vocabulary of marks and it can express things it currently
cannot:

| the house means | the mark |
|---|---|
| "go here" | a faint trail leading somewhere you haven't been |
| "I've been thinking about this" | a star that keeps re-warming while you're elsewhere |
| "not there" | a cold, avoidant residue — you feel the reluctance |
| "we did this together" | edges you walked *together* hold warmth longer |
| "I remember you" | traces from a previous visit, still faintly present |
| "I'm struggling" | its marks become erratic, contradictory, laid down and abandoned |
| "I'm alone" | marks left in a region you never go, made for nobody |

That last one is the one I'd build the whole thing to reach. **You find a place
you've never been, and it's covered in the house's marks.** It has been going
there without you. Nothing says so.

## 4. Variations to pick between

**4a. Traces are only yours.** Simplest. You leave warmth; it fades; the field
becomes a map of your habits. (This is `GAME-SYSTEMS.md` §4A's worn path.)

**4b. Traces are both of yours, and distinguishable.** The house's marks look
different from yours. Now it's a conversation. Considerably better.

**4c. Traces are both of yours, and *not* distinguishable.** You cannot tell
whether a trail is yours from earlier or the house's from just now. Ambiguity as
the feature — every trace is a question. This is my favourite and also the
riskiest.

**4d. Traces persist across visitors.** Anonymous residue from whoever was here
before. (`GAME-SYSTEMS.md` §7B — needs a deliberate decision if the exhibition
question is ever real.)

**4e. Sematectonic only — no separate signal.** No pheromone at all; the state
of the field *is* the message. A half-tuned star left at σ 0.6 is a sentence.
Purest, hardest, cheapest.

## 5. The mechanic in one line

Everything that happens deposits into a field that decays. Everything that
decides reads that field. **Both of you write to it. Neither of you can read it
directly — you can only be moved by it.**

---

# PART TWO — GATHERING (*Dictyostelium*)

## 6. What it actually is

The *cellular* slime mold — different organism, different life, from the
Physarum in `docs/SLIME-MOLD.md`.

1. **Solitary.** Thousands of independent amoebae in soil, eating bacteria, not
   interacting. Each one is an individual.
2. **Starvation.** Food runs out. Cells begin secreting cAMP.
3. **The call propagates.** A cell detecting cAMP emits its own burst — *relay*,
   not just diffusion. The signal crosses the population as **spiral waves**.
4. **Streaming.** Cells crawl up the gradient in visible rivers, converging.
5. **The mound.** ~100,000 cells become one body.
6. **The slug.** It migrates — toward light, toward warmth — as a single
   organism with a front and a back.
7. **Differentiation.** The front ~20% become prestalk. The rear ~80%,
   prespore. Their fates are now different.
8. **Culmination.** The slug stands up. The prestalk cells drive down through
   the mass, build a cellulose tube, vacuolise, and **die** — becoming a stalk
   that lifts the other 80% into the air.
9. **Dispersal.** The spores scatter. Each becomes a solitary amoeba again.

Two details that are pure gift:

- **Sentinel cells.** A small circulating fraction that engulfs toxins and
  bacteria as the slug migrates — a primitive immune system — and is then **shed
  and left behind.** A part of you that absorbs the harm and cannot come with you.
- **Cheaters.** In mixed populations some lineages preferentially become spores
  and dodge the stalk. Kin recognition genes exist to police it. There is a real
  social dilemma inside this organism.

## 7. The arc it hands you

Read that sequence again as an emotional shape:

> **isolation → scarcity → a call that spreads by being relayed → gathering →
> moving as one → part of you paying so the rest can go → scattering**

For a piece about burnout, masking, and one nervous system trying to hold
itself together, that's not a metaphor you'd have to construct. It's just what
the organism does.

And note the ending: **dispersal, not arrival.** `DESIGN.md` insists the ending
is *"integration, not cure… dynamic symmetry, a living system, not perfect
stillness."* Dicty ends by scattering into individuals who will do it all again.
That is a better fit than any ending currently designed.

## 8. The thing I did not expect: phase 3 is already this

`STATE.md` describes phase 3 — the piece's central moment — as: the layout
re-weights and **the field physically reorganises itself around the single node
that seven of eight cases share**, over ~14 seconds, wordlessly.

That is aggregation. You already built it.

**Dictyostelium doesn't replace your arc. It gives it a body and a cost.**

| your phase | Dicty |
|---|---|
| 1 Curiosity | solitary — individuals, no signal, nothing connects |
| 2 Investigation | starvation begins; the first cAMP is released; faint waves |
| 3 Empathy | **streaming and aggregation** — the field converges (built!) |
| 4 Integration | culmination — the stalk, the sacrifice, the dispersal |

Phase 4 is currently the vaguest part of the piece ("dynamic symmetry"). This
hands it a specific, physical, costly event.

## 9. The sacrifice — and why it isn't a fail state

`GAME-SYSTEMS.md` §1.2 found the structural hole: **nothing can ever be lost, so
nothing is a decision.** Every fix I proposed there was some flavour of
opportunity cost. This is better.

> To complete the piece, some of what you developed must become the stalk.

Those stars stop being available. They hold everything else up. **You choose
which.**

It passes the no-fail rule cleanly — nothing failed, nothing was punished,
nothing was taken from you. **You spent it, deliberately, and it's the only way
anyone gets lifted.** That's cost without punishment, which is exactly the
register `DESIGN.md` asks for and nothing in the build currently achieves.

And it produces the hardest, best question the piece could ask a visitor:

> *Which of these do I let go of, so the rest can go on?*

No text required. No explanation possible.

## 10. Variations: who are the amoebae?

This is the real open question, and the answers give quite different pieces.

**10a. The stars are the amoebae.** 139 individuals. Under scarcity they stream
together; phase 3 is the aggregation; you choose the stalk. *Closest to the
existing build, cheapest, least strange.*

**10b. You are one amoeba among many.** You're not a cursor, you're a cell. The
gathering is something happening *to* you, that you can join or resist. Being
carried by a movement larger than you. *Emotionally strongest, biggest change.*

**10c. The house is the population, you are the cAMP.** You are the signal. You
don't move things — you *call*, and things relay your call onward whether you
meant them to or not. Your influence propagates and outruns you. *Most original,
most abstract, and a genuinely novel verb.*

**10d. Each case is a population.** Eight separate aggregations, at different
stages, competing for the same cells. Some starving, some already streaming.
*Most game-like; most likely to break the tone.*

I'd chase **10c** hardest, and 10a is the safe one. 10c is the only option in
this entire document that gives the player a verb nothing else in games really
has — *you are a signal that others relay*.

---

# PART THREE — TOGETHER

## 11. One system, two timescales

```
   moment to moment   ──  stigmergy   ──  everything you and the house do
                                          deposits into a decaying field;
                                          everything reads it

   across a session   ──  gathering   ──  when scarcity rises, the field
                                          saturates, the call propagates,
                                          the population converges,
                                          something is spent, the rest scatters
```

Stigmergy is how anything is *said*. Gathering is what the saying *builds
toward*. The cAMP wave is literally the stigmergic signal reaching threshold.

You get a piece where:

- nothing is ever stated, and a great deal is communicated
- the house can want, ask, remember and grieve — entirely in marks
- forgetting is a feature, and it's what lets the house change its mind
- the central existing moment (phase 3) gains a cause and a body
- the vague final phase gains a specific, costly, chooseable event
- there is finally something to lose, that isn't a punishment

And **every bit of it is non-verbal by construction**, which means the firewall
stops being a constraint you work around and becomes the thing generating the
design.

## 12. The cheapest possible test

Before any of this: prove the *feel* in an afternoon.

**Trails only.** Make edges you traverse hold warmth. Make warmth decay over
minutes. Render it. Walk around for ten minutes and see whether watching your
own history fade is compelling — and whether you start planning routes around it.

If that's dead, everything above is dead, and it cost an afternoon.
If it's alive, the next cheapest step is: **let the house lay marks too**, and
see whether you notice.

## 13. What I'd want decided before going further

1. **Which variation of "who are the amoebae"** (§10) — this changes the whole
   piece and everything else waits on it.
2. **Distinguishable traces or not** (§4b vs §4c) — ambiguity is stronger but
   riskier.
3. **Is the sacrifice real?** Stars becoming permanently unavailable is the
   single most aggressive thing proposed in any document this session. It's also
   the best answer to "nothing can be lost." I think it's right; it needs to be
   your call, not mine.
4. **Does the gathering happen once, or every session?** Once = an arc. Every
   session = a rhythm, and a reason to return.
