# DEEP HOUSE — GAME SYSTEMS

*A design study, not a plan. Does not consume a plan slot; `ROADMAP.md` is
unchanged. Written 2026-07-23.*

Companion to `DREAMS.md` (the idea reservoir) and `MOMENTS.md` (the wonder
journal). Where `DREAMS.md` asks *"what would make someone say holy shit"*, this
asks a colder question: **"what would make someone keep playing, and feel like
their hands mattered?"**

Those are different questions and they pull in different directions. Most of this
document is about how to get the second without losing the first.

---

## 0. The honest reframing

The ask was "make this more of a game." Taken literally that is dangerous, and
worth saying plainly before a single mechanic:

`DESIGN.md` is, in several places, explicitly **anti-game**. No failure state.
No completion percentage. No wrong answers. Nothing explained. "Choose wonder
over reward." ChatGPT's warning in the source thread was exactly right and worth
repeating:

> Every competent engineer will naturally optimize toward usability. Deep House's
> north star is not maximum usability. It's maximum **believability**.

So this document does **not** propose making Deep House a game. It proposes
something narrower and, I think, more useful:

> **Deep House already has the skeleton of a game and none of its muscles. The
> problem is not that it lacks game systems — it is that its one core verb does
> not ask anything of the player.**

Everything below follows from that. The goal is not points, progression, or
challenge. It is **agency with texture**: the difference between pressing a
button that advances a bar, and pressing a button that does something you had to
learn to do well.

That is also, not incidentally, `DESIGN.md` invariant 14 — *"the visitor is an
intervention, not a tourist"* — which the current build states and does not yet
deliver.

---

## 1. Diagnosis — why it currently plays like an interface

Not a criticism of the build. The engine is genuinely good and the architecture
is better than most shipped things. But the *play* has four specific, nameable
gaps, and all four are visible in the source.

### 1.1 The core verb is a progress bar — *measured, not asserted*

> Everything in this section is output from **`node tools/sim_develop.js`**,
> which replicates the shipped tuning loop from real source constants. Re-run it
> after any change to the model.

`web/viz/symmetry.js:113`:

```js
update(dt, tune) {
  this.q = ease(this.q, (clamp(tune, -1, 1) + 1) / 2, dt, 0.9);
}
sigma() { return this.q; }
```

σ is an exponential ease toward `(tune+1)/2`; `tune` rises by `+0.16` per
`nudge()`; `nudge()` fires on every ↑ key event — and `brain.js:440` blocks
browser auto-repeat only for Enter/Escape, so **holding ↑ is a ~30 Hz train of
nudges**.

**The measurements:**

| | measured | documented / expected |
|---|---|---|
| time to lock a star | **3.0 s** | `STATE.md`: "15–30 seconds" — **7× off** |
| skill headroom | **1.00×** | no strategy beats holding the button |
| cost of a maximally stressed house | **+2 %** | `develop.js` header: "genuinely harder to read" |

**Why the stress coupling is inert.** The force balance on `tune`:

```
input   nudge 0.16 × 30 Hz auto-repeat        = +4.80 /s
drag    (0.18·0.6 + 0.20·0.3)·0.25  rested    = −0.042 /s   → input 114× stronger
drag    (1.00·0.6 + 1.00·0.3)·0.25  stressed  = −0.225 /s   → input  21× stronger
```

`tune` also saturates at `+1.0`, so surplus input is discarded. **No opposition
term of a survivable size can compete with a 30 Hz key-repeat train.** The
coupling in `brain.js:193` is real code that does essentially nothing.

Therefore: σ is monotone in held input, cannot overshoot, and all 66 exhibits
play identically. Press Enter, hold ↑ for three seconds, receive a flare. That
is **a timer with a light show attached**, and it is what every other system in
the piece sits on top of.

**This single fact is responsible for most of "it feels like an interface."**
§3 is about nothing else.

### 1.2 Nothing is scarce, so nothing is a decision

- Travel is free, instant-ish, and unlimited (`nav.travel` has no cost).
- Develop is unlimited and repeatable across the whole field.
- `Esc` retraces at no cost (`nav.back`).
- Nothing is ever lost. `progress.js` has `develop()`, `read()`, `walkCase()` —
  and no inverse for any of them. `develop.relockable: false`.

A game is a series of **interesting decisions**, and a decision is only
interesting if choosing A costs you B. Right now every choice is "do this now or
do this in a minute," which is not a choice, it is an ordering.

Note carefully: the fix is **not** to add fail states. `DESIGN.md` forbids them
and is right to. The fix is **opportunity cost** — §4.

### 1.3 There is no skill to express, therefore no mastery

The player at minute 30 is doing exactly what they did at minute 1, with the same
inputs, at the same difficulty, for the same result. The only thing that changed
is a counter.

Compare: `DESIGN.md` principle 5 says *"never a room about masking. Instead, a
room where the player must maintain two contradictory signals at once."* That is
a **precise description of a skill-based mechanic**, written into the design
document, and nothing in the build implements it. The masking core currently
lives only in the light layer (`lightOrder`'s pull toward 0.6) — where the player
cannot interact with it at all.

### 1.4 The house has initiative but no stakes

`agency.js` is excellent and it acts on the world. But nothing it does can
**inconvenience** you. Every intent is decorative: a lamp sighs, a star
brightens. The house cannot want something different from what you want.

An organism with initiative that never once gets in your way is not an organism
with initiative — it is ambience with a scheduler.

---

## 2. The compatibility test

Before proposing anything: a rubric, so this document can be argued with rather
than just liked or disliked. **Any mechanic below must pass all six.** Where one
is marginal, I say so explicitly.

| # | Test | Fails if… |
|---|---|---|
| **T1** | **No fail state.** Failure is emotional; another path opens. | it can end a run, lock content permanently, or produce "you lost" |
| **T2** | **Nothing is measured at the visitor.** | it shows a score, %, rank, timer, or count of what remains |
| **T3** | **Nothing is explained.** Discoverable by play alone. | it needs a tutorial, legend, or instruction to be usable |
| **T4** | **It lives in the endocrine model.** One river. | it introduces a private variable that isn't `HOUSE.*` or `AGENCY.*` |
| **T5** | **Four buttons.** ↑ ↓ Enter Esc, and nothing else, ever. | it needs a fifth input, a modifier, or a pointer |
| **T6** | **The Portal rule.** Complete experience without the metaphor. | it only makes sense if you already understand what the piece is about |

A seventh, softer test I'd apply to myself: **does it make the house more of a
character, or less?** Mechanics that turn the house into a puzzle *substrate*
are worse than mechanics that turn it into a *counterpart*, even when they play
better.

---

## 3. TIER 1 — The core verb: from progress bar to instrument

This is the whole ballgame. Three proposals, escalating. They compose: A is the
foundation, B is the one I'd actually build, C is the long game.

### 3A. Give σ momentum and a false minimum

> **Sequencing note (added after measurement):** this section was written before
> §3B was simulated. It still stands, but it is **not** the first move. Momentum
> on top of the shipped 30 Hz nudge-train input does nothing — §1.1's force
> balance swamps it, exactly as it swamped drag. **Build §3B's rate-controlled
> input first**; then momentum has something to act on. The two compose cleanly:
> §3B supplies the input model, §3A supplies the terrain.

**The change.** Replace ease-to-target with a second-order system. `tune` becomes
a *force*, not a destination.

```js
// current: q eases to (tune+1)/2, monotone, cannot overshoot
// proposed:
const target = (clamp(tune, -1, 1) + 1) / 2;
this.v += (k * (target - this.q) - damp * this.v + this.drift(this.q)) * dt;
this.q = clamp(this.q + this.v * dt, 0, 1);
```

with a per-exhibit `drift(q)` — a small restoring force that is **not** zero at
the place it looks like it should be.

**Why this is the interesting part.** `drift` lets an exhibit have a **false
minimum**: a basin around, say, q ≈ 0.62 where the picture *looks* resolved —
bilaterally symmetric, visually still, obviously "done" — but σ is nowhere near
the 0.9 lock. To get out of it you must push *past* apparent order, through a
region that looks momentarily worse, into real order.

That is not an arbitrary difficulty spike. It is **the thesis of the piece
expressed as a control problem**: the difference between something that looks
composed and something that is regulated. It is the mask, in your hands, on the
main verb. A visitor who learns "when it looks finished but the meter disagrees,
push harder, it gets uglier before it resolves" has learned the entire emotional
argument of Deep House without a word of prose.

**Overshoot** matters too: with momentum, slamming ↑ carries you past the lock
band and out the other side. The lock stops being a ceiling you climb to and
becomes **a band you settle into**. Now there is a *right way* to press the
button — ease in, don't slam — and a player can get visibly better at it.

**Tuning it.**

| constant | meaning | start at |
|---|---|---|
| `k` | stiffness — how hard tune pulls | 3.0 |
| `damp` | damping — how much overshoot survives | 1.6 (underdamped; ζ≈0.46) |
| `driftGain` | strength of the false minimum | 0.0 → 0.9 per exhibit |
| `lockBand` | σ window that counts as locked | 0.88–0.97 (not "≥0.9") |
| `lockDwell` | seconds you must *stay* in band | 0.8 |

`lockDwell` is what converts it from "touch 0.9" to "hold it steady," which is
the difference between hitting a note and holding one.

**Cost.** ~25 lines in `symmetry.js`'s shared base, plus one `drift` function per
exhibit family (not per exhibit — the 8 community bands can share). The 38
exhibits need no individual rewrite; they already read `this.q`.

**Risk.** T3 (nothing explained) is fine — the σ meter already exists and the
picture itself is the feedback. **T1 is the one to watch**: overshoot must never
feel like punishment. Mitigation: leaving the band never *reduces* progress
already banked, it just delays the lock. You cannot go backwards, only slower.

**Verify headless.** Property tests, all cheap: (a) a step input of `tune=+1`
overshoots the lock band at least once for `damp < 2√k`; (b) an exhibit with
`driftGain > 0` has a stable fixed point below the lock band — solve for
`drift(q) = k(1-q)` and assert a root in [0.5, 0.75]; (c) a "perfect" input
policy locks in bounded time for all 66 exhibits (no unwinnable star); (d)
σ never decreases when `tune = +1` and drift is zero (backwards-compatibility
with the current feel).

---

### 3B. The two-signal problem — *build this one*

**This is `DESIGN.md` principle 5, finally implemented, on the verb it belongs
to.**

> *"Never 'a room about masking.' Instead: a room where the player must maintain
> two contradictory signals at once."*

**The mechanic.** Tuning the star costs the house. Holding ↑ raises the
exhibit's order **and** raises `sensoryLoad`. Load drags your tune back toward
chaos.

So the naive input — hold ↑ until it locks — becomes **self-limiting**. The
skill is *pulsing*: push, release, let the house settle, push again. You are not
tuning a picture. **You are tuning a picture without overwhelming the organism
doing the looking.** Two contradictory signals, exactly as P5 specifies.

```
    push ↑    ──►  σ up,  sensoryLoad up
    release   ──►  σ falls back slowly, load recovers fast
    therefore duty cycle is the skill, not duration
```

#### Two failed attempts, and what they taught

*This is the useful part. I proposed this mechanic before measuring it, and the
measurement disproved my first two versions. Both failures were informative.*

**Attempt 1 — "just add a load cost to the existing model." Headroom: 1.00×.**
Complete failure. Adding a stress cost on top of the shipped input model changes
nothing, because of §1.1's force balance: a 30 Hz nudge train delivers +4.8/s
into a range of 2.0. Any drag term small enough to be survivable is invisible.

> **Lesson: you cannot fix this by adding opposition. The input model itself is
> the problem.** Discrete `nudge()` accumulation driven by OS key-repeat is not
> a control input — it is a saturation race, and input always wins.

**Attempt 2 — "make drag strong enough to matter." Broke the no-fail rule.**
Turning drag up until stress was meaningful made the star *unwinnable* by
holding — naive players stuck forever. Measured: at drag ×30 and above, `NEVER`.

> **Lesson: T1 and skill pull in opposite directions along the same axis.** Too
> little opposition = a timer. Too much = a wall. There is a window, and it must
> be found deliberately rather than stumbled into.

**Attempt 3 — the one that works.** Two changes together:

1. **`tune` becomes rate-controlled while held** (not `+0.16` per repeat event).
   This is the load-bearing change; without it nothing else matters.
2. **Drag is expressed as a *fraction* of the input rate**, not an absolute.

```js
dragMax = dragFrac * tuneRate      // dragFrac < 1, always
```

**T1 then holds by construction, not by tuning.** Since `dragFrac < 1`, held
input nets `(1 − dragFrac) · tuneRate > 0` even at maximum load. Holding the
button is always slow-but-certain. **Nobody can ever be stuck — that is a
structural guarantee, and it cannot be broken by a careless config edit.**

That reframing is the whole solution. It converts a knife-edge balancing problem
into an invariant.

#### The recommended config, and why not the extremes

```
tuneRate 0.55   decay 0.03   loadPerPush 0.75
loadRecover 2.5   dragFrac 0.85   dragKnee 0.40
```

`node tools/sim_develop.js --sweep` maps the space:

| dragFrac | naive hold | headroom | verdict |
|---|---|---|---|
| 0.70 | 8.6 s | 1.27× | too easy — holding is basically optimal |
| 0.80 | 12.0 s | 1.76× | just under target |
| **0.85** | **15.4 s** | **2.25×** | **chosen** |
| 0.90 | 22.2 s | 3.24× | more skill, but a casual visitor waits too long |
| 0.95 | 42.6 s | 6.19× | rejected — 42 s of holding a button is hostile |

**Why not 0.95 despite the far better headroom?** Because headroom is not the
objective — it is a proxy. A 6× spread bought by making the naive path
punishingly slow is not skill expression, it is **coercion**: it does not reward
the player who understands, it punishes the one who doesn't. That fails T6 (the
Portal rule) in spirit even though it passes T1 on paper. 0.85 gives a casual
visitor a 15-second star — which happens to be exactly what `STATE.md` always
*believed* the loop did — and a skilled one a 7-second star.

**Why `decay` is low (0.03).** Releasing must be cheap or pulsing never pays.
High decay punishes the exact behaviour the mechanic is trying to teach. The
sweep shows headroom falling monotonically as decay rises.

**Why `dragKnee` at 0.40 matters most of all.** Below the knee there is *no drag
at all*. A calm house never fights you. This is the Portal rule made mechanical:
a visitor who just holds the button is never fighting anything they can't see,
they simply go slower. **The metaphor is optional; the mechanic is not.**

#### Measured results

| | shipped | proposed |
|---|---|---|
| naive hold | 3.0 s | **15.4 s** |
| best play | 3.0 s | **6.9 s** |
| **skill headroom** | **1.00×** | **2.21×** (target ≥1.8×) |
| stressed-house cost | +2 % | **+15 %** |
| T1 (naive finishes from any state) | pass | **pass, by construction** |

The skill ladder a player climbs without ever being told it exists:

```
   15.4s   hold ↑ (never releases)         <- the floor: always works
   10.8s   pulse d=0.7 T=1.8s
    8.2s   pulse d=0.5 T=1.2s
    7.6s   pulse d=0.5 T=0.8s
    7.0s   reactive: release@0.52 resume@0.38
    6.9s   reactive: release@0.45 resume@0.38   <- watching the room, not the meter
```

The best strategies are *reactive* — they watch the house's load and release
when it strains. That is precisely the behaviour the piece wants to teach, and
it emerges from the model rather than being scripted.

**Why this is the best single mechanic in this document.** It:

- implements a written, never-built design principle (P5);
- makes the core verb a skill without adding a failure state (T1);
- requires zero new UI, zero new input, zero explanation (T3, T5);
- lives entirely in `HOUSE.sensoryLoad` — no new variable (T4);
- makes the *house's* condition matter to the *player's* goal, which is the
  first time in the build those two things are actually coupled in the direction
  that matters (the house currently affects you decoratively; here it opposes
  you honestly);
- and it means **a stressed house is genuinely harder to read**, which
  `develop.js`'s own header comment already claims is true and which is currently
  only barely true.

**Cost.** ~40 lines, across `symmetry.js`'s shared base (rate input + drag
term), `field-room.js`'s develop-mode input (held-state instead of discrete
nudges), and one coupling in `brain.js`. No C#. No new files. No new variable —
it is all `HOUSE.sensoryLoad`.

**Risk, and the mitigation that matters.** Pulsing must never feel like
*fighting the UI*. The tell: the visitor must be able to **feel the house's load
in the room**, or the mechanic is invisible and just reads as sluggish input.
`beds.js` already exists for exactly this — raise the `swell` bed's response to
`sensoryLoad` during develop and **the lamps tell you when to release**. That
closes the loop between the light layer and the play layer for the first time in
the project, and it is why this mechanic belongs in *this* piece rather than
being a generic difficulty tweak.

**Verify headless** — all four are already implemented in `tools/sim_develop.js`:

- (a) constant-hold locks in bounded time from **every** house state → T1;
- (b) best policy beats naive by ≥1.8× → **skill expression exists**;
- (c) `sensoryLoad` stays in [0,1] under adversarial input;
- (d) a pre-stressed house is slower but still finite.

Test (b) deserves a flag as the genuinely novel idea here: **"there exists a
strategy meaningfully better than the naive one" is a mechanically checkable
property.** It is the definition of a skill mechanic, it is cheap to compute,
and almost no codebase tests for it. This one now does, headless, forever.

---

### 3C. Exhibits that listen back

**The long game, not the next build.** Once §3A/B exist, the exhibit can stop
being a target and start being a **counterpart**.

Each exhibit family gets a *tell*: a visual signature that indicates which way
it wants to be pushed, legible only if you are watching the shape rather than
the meter. A Lissajous whose phase is drifting one way. A Chladni plate whose
nodal lines shiver on one axis. A rose curve whose petals are unevenly spaced in
a direction.

Then the σ meter can *recede* — smaller, dimmer, eventually optional — because
the picture itself carries the information. That is the endgame for T2 and T3:
the interface disappears and you are just looking at the thing and responding to
it.

This also solves the exhibit-tiering idea parked in `STATE.md` ("rewards unlock
more complex spirals — K. named Uzumaki") **without** a difficulty setting: later
exhibits simply have quieter tells and stronger drift. Difficulty becomes a
property of the object, discovered, never selected.

---

## 4. TIER 2 — Scarcity without failure

The §1.2 problem: no decision costs anything. Four systems that create
opportunity cost while passing T1.

### 4A. The worn path — the trail becomes substance

`nav.trail` already exists (`pathMax: 24`) and is used only for `Esc`. Give it a
second life.

**Mechanic.** Every edge you traverse accumulates **warmth**. Warm edges travel
faster (`travelTime` scales down), read brighter, and are more likely to be
chosen by agency as an act target. Warmth decays over minutes. Cold edges are
slower and dimmer.

**What it creates.** A real spatial economy. Retracing a known route is cheap;
striking out into cold field is expensive in *time and attention*, not in
resources. Habits form, become visible, and then become a thing the house knows
about you. Players start planning loops.

**Why it's more than a speed modifier.** After twenty minutes the field has a
**map of your behaviour drawn on it**, in the open, that you did not choose to
draw. Someone who systematically swept looks completely different from someone
who kept returning to the same three stars. Nothing says so. Then, at phase 3,
the re-layout moves everything — and your worn paths are still visible, now
stretched across a field that reorganised under them. That is a genuinely
beautiful thing to have built and it costs almost nothing.

**Cost.** A `Map<edgeKey, warmth>` in `nav.js`, a decay tick, one lerp in
`render.js`, one term in `travelTime`. ~30 lines. **Passes all six tests.**

Ties directly to `DREAMS.md` §2: with room projection, warm paths mean the room
itself remembers where you have been.

### 4B. The house tires — the session has a natural night

**Mechanic.** Over a run, the house's `defensiveness` slowly climbs and
`attention` slowly falls, independent of what you do. Not a timer — a *slope*.
Late in a session: agency acts less, the horizon narrows slightly, develop takes
longer, the lamps cool and dim.

**What it creates.** Prioritisation. You cannot do everything tonight. What you
choose to spend the good hour on is a real decision with a real cost, and the
cost is not a resource bar — it is that the house is getting tired and so are
you. It also gives sessions **a shape**, which installations badly need and this
one currently lacks: right now a run ends when the visitor decides to stop, which
means it ends arbitrarily.

**T1 check.** This is the most dangerous mechanic in the document for the no-fail
rule, and it passes only with a specific constraint: **tiredness must never
prevent, only slow.** Nothing becomes unreachable. And crucially — **returning
resets it, and `nostalgia` rewards the return**. The house being tired tonight is
the reason to come back tomorrow, not a punishment for staying.

**T2 check.** Marginal and worth naming: a visible fatigue slope is *arguably* a
progress meter in disguise. Mitigation: it is never numeric and never shown. It
is only ever felt, through light, tempo, and the house's silence.

### 4C. Attention as a two-edged resource

`AGENCY.attention` already exists and already responds to what you do (`travel`
raises it, `idle` and `rush` lower it).

**Mechanic.** Make attention *matter in both directions*:

- **High attention** — the house is watching you. Develop is easier (it helps:
  reduce `dragKnee`). But it also **interrupts** more (the `interrupt` intent
  already exists at weight 0.2 and currently does almost nothing).
- **Low attention** — you are alone. Harder, slower, but undisturbed. And the
  quiet is where §4D's rarest events live.

**What it creates.** A genuine risk/reward dial that the player operates *by how
they move*, not by a menu. Moving steadily draws the house's eye. Going still
lets it drift away. Both are viable. Neither is correct.

This is the mechanic that finally gives `agency.js` stakes (§1.4) — the house's
attention becomes something you court or avoid, which makes it a counterpart
rather than a scheduler.

### 4D. The refusal, properly gated

From `DREAMS.md` §4b, restated here with the rubric applied because it is the
one mechanic in this document I think is *worth doing and easy to do wrong*.

**Mechanic.** Rarely, the house declines. A star won't open. A case won't.

**T1 is the whole question.** It passes only under all of these:

- Gated on `AGENCY.defensiveness > 0.75` — i.e. **you pressed it**, it did not
  roll dice. Refusal is always *caused*, and the cause is legible in retrospect.
- At most once per run.
- Never on the star you are standing on (never blocks the current action).
- Always resolves: come back, it is fine. No state is written.
- The house *shows* the refusal physically (a lamp turning away, per
  `DREAMS.md` §2) rather than reporting it.

Under those conditions it is not a fail state, it is **the house having a bad
moment**, which is the single most characterful thing it could possibly do —
and it is the clearest possible expression of "the visitor influences the house
but does not fully control it."

**Still K.'s call.** It tensions T6 hardest: a visitor who only wants "cool
lights, weird puzzle" may read one refusal as a bug. My position is that the
gating above reduces that to near-zero, and the payoff is large. But I am
flagging it rather than deciding it, as before.

---

## 5. TIER 3 — Commitment and consequence

The deepest missing layer, and the one that would most make this feel like a
*detective* piece rather than a *tuning* piece.

### 5A. Two-Truths as binding interpretation

**Status: half-built and inert.** `progress.js` already stores
`readings: { id -> {feel, match} }`. `config.js` already has
`feel.matchPush` / `feel.mismatchPush` / `keepBothReadings: true`.
`moments.js` already has `readMatch` and `readMiss` with a beautiful
two-colour `ColorSwap` for the disagreement. `STATE.md` confirms: *"Two-Truths
is recorded but never rendered."*

Everything exists except the consequence.

**Mechanic.** Naming a star's feeling is a **commitment**, not a guess.

- The star is permanently tinted by **your** reading, not its own
  (`keepBothReadings` already anticipates this).
- The reading **propagates**: adjacent undeveloped stars inherit a weak bias
  toward your interpretation. Your worldview literally colours the field ahead
  of you.
- Later readings **compound or contradict** earlier ones. A visitor who
  consistently reads stars as (say) threatening builds a field that looks
  different from one who reads them as sorrowful — same graph, same 139 stars,
  different-looking house.

**There is still no wrong answer** (T1). A "mismatch" is not an error; it is a
*divergence between your reading and the star's own*, and `readMiss` already
treats it as content — the house gets defensive, certainty drops, the two
colours alternate. That is `DESIGN.md` invariant 5 (multiple truths) working.

**The payoff.** At phase 3, when the field reorganises around the shared hub,
it reorganises **through the lens you built**. Two visitors get structurally
identical revelations that look and feel completely different. That is
replayability that costs no new content whatsoever — it is a *reinterpretation*
of content that already exists, which is precisely what the piece is about.

**Cost.** Rendering the tint: ~20 lines in `render.js`. Propagation: ~15 in
`progress.js` + a lookup in the renderer. The state is already being written.

**This is the highest value-per-line item in the entire document.** It is
half-built, it is pure `DESIGN.md`, and it is currently doing nothing.

### 5B. Hypothesis edges — the detective verb

The genuinely missing mechanic. Right now you *walk* connections that already
exist. A detective **proposes** connections.

**Mechanic.** From a developed star, you may assert a link to another developed
star you have visited. (Four buttons: on slot 0, cycle past the existing
instruments to "connect," then ↑↓ through stars you have developed, Enter to
assert.)

The house **never says whether you are right.** Instead, over the following
minutes:

- an edge that **exists in the real graph** slowly warms, brightens, and becomes
  walkable — you found something that was there;
- an edge that **does not exist** slowly fades — but leaves a faint scar that
  never fully disappears;
- an edge that does not exist **but connects two stars sharing a case or
  community** behaves in between: it persists, dim, and the house's
  `coincidence` rises. You were wrong about the connection and right about the
  neighbourhood.

**Why this is the mechanic.** It is the only proposal here where the player
produces *content* rather than consuming it. Your board is yours. Two visitors
build visibly different maps of the same field. And the feedback is entirely
non-verbal, delayed, and ambiguous — which is exactly how the rest of the piece
communicates, and exactly what `DESIGN.md` means by "unlock connections,
relationships, interpretations, false assumptions."

The scar matters: **wrong hypotheses are permanent marks, not deletions.** Your
false assumptions stay visible in the field. That is invariant 15 (failure is
emotional, another path opens) rendered as geometry.

**T5 check** — this is the mechanic most at risk of needing a fifth button. The
"cycle to connect, then cycle targets" flow keeps it to four but makes the
instrument ring longer. Worth prototyping the ring depth before committing.

**Cost.** Real: a new mode in `field-room.js`, storage in `progress.js`, edge
rendering, and the decay/warm logic. Call it 150 lines and an evening. It is the
most expensive thing in this document and probably the most valuable after §3B.

### 5C. The case you assemble, not the case you complete

**Current:** `cases.js` — a case is walked when every anchor has been *visited*.
Pure attendance. `checkCompletion` fires on the last one.

**Proposed:** a case completes when you have visited its anchors **and** asserted
at least one hypothesis among them, or committed readings to some threshold of
them. Walking is showing up; **closing** a case is having an opinion about it.

This makes §5A and §5B load-bearing instead of optional, and it upgrades the
case from a checklist to an argument. It also fixes something subtle: right now,
a button-masher who wanders enough will complete cases by accident. Under this
change, they still see everything (T6 — the Portal rule holds, the field is
still fully walkable) but *closing* requires an act of interpretation.

---

## 6. TIER 4 — The operator as a live counterpart

The most inventive thing available, and it is 80% built already.

`web/the-basement.html` + `operator.js` exist: an unlinked console where K.
performs the house live via weather sliders and scene cards. `DESIGN.md`
describes this as central ("the live operator performs the nervous system in
real time, so every run is unique").

**It is currently a mixing desk. It could be a hand of cards.**

**Mechanic.** Give the operator **moves with costs** instead of continuous
sliders:

| move | effect | cost |
|---|---|---|
| *Press* | raise `sensoryLoad` sharply in the visitor's region | raises `defensiveness`; the house withdraws from you too |
| *Mask* | hide a region's true readings behind composed ones | `mask` climbs; slips become more likely later |
| *Offer* | brighten an unvisited star — a lure | spends `attention`; the house cannot act again for a while |
| *Withhold* | refuse the next develop attempt once | large `trust` cost, long refractory |
| *Remember* | resurface something from an earlier run | only available if `nostalgia` is high |

Each move spends from the same endocrine pool the visitor is trying to regulate
(T4 — one river). **The operator cannot spam.** They are playing the house's
physiology, not overriding it, and an operator who presses too hard makes the
house defensive toward *them*.

**Why this is exciting.** It turns Deep House into a genuine **asymmetric
two-player experience** — one player walks the field with four buttons and no
information; the other performs the organism from a phone, with full information
and a limited hand. Neither can win. The operator's goal is not to beat the
visitor but to make the run *mean something*, and their moves cost the very
resource the visitor is trying to restore.

That is a real game, it is entirely in keeping with the art, and the plumbing
(`serve.py`'s `/op` relay → `HOUSE.push`) already exists end to end.

**The constraint that keeps it art:** the operator must never be able to *tell*
the visitor anything. No text channel, ever. Only physiology. That preserves the
display boundary absolutely, because the operator's entire vocabulary is
`HOUSE.push` — the same vocabulary the piece already speaks.

**Cost.** Mostly `operator.js` + a cost/refractory model. No new concepts. This
could be a weekend, and it is the single most demo-able thing in the document —
"you walk, I'll be the house" is a sentence that sells the piece instantly.

---

## 7. TIER 5 — The long game

### 7A. Memory that decays

Proposed as an invariant in `DREAMS.md` §7 and worth restating as a *system*.

`progress.js` is a perfect record: `developed` is permanent, `relockable: false`,
nothing ever fades. But a house with flawless recall is a database.

**Mechanic.** Developed stars don't *un*-develop (T1) — but their **clarity**
fades between visits. A star developed weeks ago and never revisited renders
dimmer, its reading less certain, its edges softer. Revisiting restores it
instantly and cheaply (a touch, not a re-tune).

**What it creates.** A reason to return that is not "there is more content." The
field is something you *maintain*, gently. And it makes `AGENCY.nostalgia` —
which currently has almost nothing to reach for — genuinely meaningful: the
house remembers what you have forgotten, and points at it.

**T2 check.** Decay must never read as loss or as a decaying score. It should
read as *memory*, which means it must be slow, partial, and always warmly
recoverable.

### 7B. The field remembers other visitors

**Speculative, flagged as such.** `progress.js` is `localStorage`, per-browser.
If an exhibition ran multiple visitors through the same machine, the field could
carry **faint traces of previous walks** — a path worn by someone else, a star
someone else read differently, a hypothesis someone else asserted.

Anonymous, non-verbal, and unattributed. You would never know whether the mark
was yours from last time or a stranger's from an hour ago. That ambiguity is the
feature.

**Firewall note.** This adds no corpus-derived data and no prose — it is
structural only (edges, tints, warmth). It is therefore firewall-safe as
described, but it *is* a new class of persisted data about real people's
behaviour, and if the exhibition question in `DREAMS.md` §6 ever becomes real,
this needs a deliberate decision rather than a default.

---

## 8. What I would refuse to build

Stated so the boundary is explicit, and so a future session does not
enthusiastically add one of these.

| Not this | Why |
|---|---|
| **Score / points / rating** | T2. Also `MOMENTS.md` already killed it. The ● ◌ tally is the surviving edge case and is already on notice. |
| **Timers or countdowns** | T1/T2. §4B gets pacing from physiology instead — a slope, never a clock. |
| **Health / lives / resources with a bar** | T1/T2. §4 gets scarcity from opportunity cost instead. |
| **Inventory** | T5, and it makes the house a container instead of a character. |
| **Achievements / unlock lists** | T2. "The installation should feel immeasurable." |
| **Difficulty settings** | T3. §3C makes difficulty a property of the object, discovered, not selected. |
| **A tutorial** | T3, non-negotiable. §3B's `dragKnee` is how a beginner is carried instead. |
| **Combos / cheat-code chords** | Already rejected in `MOMENTS.md`. Depth should come from the field, not the remote. |
| **Enemies, hazards, anything to avoid** | The house is a counterpart, not an antagonist. §6's operator is the *only* opposition, and even they cannot make you lose. |
| **Multiple endings** | T2 (implies a completion set) and it contradicts "integration, not victory." |

---

## 9. Build order

Ordered by **value per line**, which is not the same as by ambition.

| # | Item | Cost | Why here |
|---|---|---|---|
| **1** | **§3B two-signal develop** | ~40 lines | Fixes the core verb. Measured 1.00× → 2.21× headroom. Implements written-but-unbuilt P5. Nothing else matters as much. |
| **2** | **§5A Two-Truths consequence** | ~35 lines | Half-built and inert. Pure `DESIGN.md`. Buys replayability with zero new content. |
| **3** | **§3A momentum + false minimum** | ~25 lines | Deepens #1 — and **only works after it**. The false minimum is the thesis as a control problem. |
| **4** | **§4A the worn path** | ~30 lines | Cheapest real strategy layer. Passes all six tests cleanly. Beautiful under phase 3. |
| **5** | **§6 operator moves** | a weekend | Highest demo value in the project. Turns it into a two-player piece. |
| **6** | **§5B hypothesis edges** | ~150 lines | The detective verb. Most expensive, most distinctive. |
| **7** | **§4B/4C tiredness + attention** | moderate | Pacing and stakes. Needs #1 first to have anything to modulate. |
| **8** | **§7A decaying memory** | moderate | Long game. Only meaningful once there are return visits. |

**If only one thing is ever built from this document: §3B.** It is forty lines,
it implements a principle already written into `DESIGN.md`, it introduces no new
variable, needs no new input, requires no explanation, and it converts the
central action of the piece from waiting into playing.

---

## 10. Open questions — genuinely K.'s, not mine

1. **Is "harder when stressed" acceptable at all?** §3B makes the house's state
   actively oppose the player. That is a real tonal choice: it could read as the
   organism being honest, or as the game being unfair. Everything in Tier 1
   depends on this answer.
2. **Should the σ meter eventually disappear?** (§3C) Removing it is the purest
   expression of T2/T3 and also the biggest usability sacrifice in the document.
3. **Refusal: in or out?** (§4D) Unchanged from `DREAMS.md`. Still yours.
4. **Does the operator become a role you *cast*?** (§6) If someone other than K.
   can be the house, the piece changes character — it stops being one person
   performing their own nervous system.
5. **Is replayability actually wanted?** Several proposals (§5A, §5B, §7) buy
   variation across runs. For a housemate audience seeing it once, that spend
   may be wrong. For an exhibition (`DREAMS.md` §6), it is probably the highest
   priority in this document after §3B.

---

## 11. The one-paragraph version

Deep House does not need game mechanics added to it. It needs its existing core
verb — tune a picture from chaos to symmetry — to stop being a progress bar.
Make tuning cost the house something, so the player must hold two contradictory
signals at once, and the piece acquires skill, mastery, tension, and a reason to
press the button carefully, all without a score, a timer, a fail state, or a
single line of explanation. Everything else in this document is elaboration on
that, and most of it is optional.
