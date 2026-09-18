# EXPERIENCE HIGHLIGHTS — the stuff that landed

*Gathered 2026-09-18 via the vault graphify graph (`claude-vault/graphify-out`, 1743 nodes)
+ the source notes it pointed to. A base for tomorrow's goals, not a plan.*

**Sources** (the recorded notes of the live/driven sessions):
`Deep-House/MOMENTS.md` · `Deep-House/docs/TASTE-LOG.md` · `Deep-House/docs/TASTE-SESSION.md`
· `Deep-House/helix-fun.md` · `Meow House/docs/LIGHTS-SESSION-2026-07-28.md`.

**Two honest caveats up front:**
- The vault graph is from **2026-08-16** — a month stale. Anything after that (incl. the
  MeowParty butterfly + ADSR work) isn't in it; the highlights below are the live-room era.
- I found **no separate stream/recording archive** in the vault. The "recorded notes" are the
  live-driven session logs where you watched the room and answered in your own words. If there
  are actual stream VODs somewhere, point me at the folder and I'll fold them in.

---

## 1. Moments you actually enjoyed — your words

The delight signals, verbatim, because paraphrase loses them:

- **Ulam spiral — "I really like how it goes around."** A keep that turned into a feature on
  the spot: you asked for a second comet that "bounces over all the already revealed primes in
  a serpenty way," throwing long diagonals across the field. Built the same evening. *This is
  the pattern worth noticing — the thing you liked made you want to add to it.*
  (`TASTE-LOG` #exhibit-veto · Ulam)

- **Newton overlap — "when they overlap the newton one actually makes for some cool effects."**
  You'd cut Newton solo, then reversed it live once you saw exhibits layered. Delight from an
  *unplanned* combination. (`TASTE-LOG` #newton-soft reversal)

- **The colour drift, after the fix — "1 seems to be chill. maybe a bit of a fire effect but
  thats nice."** The exact same fade you'd earlier called *"sterile and sudden"* — same phrase,
  opposite verdict, once it was fixed. A bug that became a feature. (`TASTE-LOG` #fade-after-hsv)

- **Overlap = persistent — first look, no hesitation, KEEP.** The old shape staying underneath
  for the whole dwell read right instantly. (`TASTE-LOG` #overlap-mode)

- **The coupling is ALIVE.** After *four* failed attempts to even ask the question, the room's
  energy visibly reaching the lamps — B at 0.95 clearly brighter than A at 0.15. The moment the
  whole light side became real instead of theoretical. (`TASTE-LOG` #energy-coupling)

- **Kept in the room, no argument:** Moiré interference, Cellular automaton, Game of Life, Ulam.
  These are the exhibits that earned their place on sight.

- **The Double helix session (2026-08-13) — the most delight in one sitting.** Your words as
  it came together: **"I love that it turns from a triangle into a helix"** and **"look into
  the bend — that bend is beautiful."** The stretch-by-σ motion was **"the coolest by a
  landslide."** The gravity mode: **"really like this effect on its own."** The rung
  disintegration (base pairs winking out) — a loved effect. This is the clearest recorded case
  of the build *being fun*, not just correct. (`helix-fun.md`)

---

## 2. The wonder catalogue — the moments you're chasing to share

From `MOMENTS.md` ("every time someone says *holy shit*, write it down"). These are the
shareable magic — the north star, not yet all built:

- The room's light leans left because you moved left on screen. **Nobody says so.**
- The house acts on something far away — and it happens **physically behind you.**
- Everything goes dark except one lamp, breathing, at the star you're standing on.
- A resolve travels outward through the actual room as a ring, at the same speed as the ring
  on screen.
- You stop pressing buttons and the room keeps replaying the last thirty seconds around you.
- The music doesn't stop when you lose it — it loses fidelity (highs go, stereo narrows) and
  heals as you settle.
- You never pressed skip. The house changed the song because it noticed.
- The lights answer a lyric. The house falls asleep if it's ignored. A room remembers you from
  yesterday.

**Design law you already committed to:** killed a visible score / completion % — *"measured
wonder stops being wonder."* And killed combo cheat-codes — depth should need no new input.

**The big unbuilt vision, recorded from the helix session:** *"any spiral could act like a
baseline foundation where all the other spirals work their way towards"* — generalize σ from
"chaos → one exhibit's order" to **morphing between any two forms**. The helix's `deco(t, σ,
sign)` morph-field is the seed of it — and it's the **same lineage as the MeowParty
Harmonograph → Butterfly morph you're building now.** That's the through-line: the butterfly
scene is Level-3 form-morph, arriving early on one exhibit.

---

## 3. What the room has proven it can do (verified)

- Energy→lamp coupling is live and legible.
- The scene fade glides correctly — 155 distinct palettes across an 8 s fade (measured).
- 12 Hz palette push beats 3 Hz (once the room was actually fixed): **"12 hz def beat 3 hz."**
- Overlap/persistence, rich colour spread (0.55), uniform dive — all answered live.
- Identify routing, partial-upsert save, sweep maths, four palette modes, 30 passing suites —
  the light-mapping machinery is sound.

---

## 4. The one honest gap — worth staring at

`MOMENTS.md` → **"Landed"** section: *"Nothing yet. The piece has been verified, not
witnessed."*

Everything above is a **you-and-the-room** verdict. Not one of these moments has been felt by
another person in the room yet. The recurring lesson across every session — **"suspect the
instrument before the eye"** — was about *your* looking. The next frontier is a *second* set of
eyes. That's the thing "was able to share" is quietly pointing at.

---

## 5. Seeds for tomorrow (candidates, you pick)

> **DECIDED 2026-09-18 (Claude's call, K. had no preference):** aim tomorrow at the
> **butterfly / form-morph thread** — continuous with today's scene player, and the one place
> the recorded "any spiral morphs toward any other" vision already lives in code.
> **First action (door-open, not "implement the plan"):** open `web/meowparty-scene.js`, find
> the Harmonograph→Butterfly morph in `_drawScene`, and decide whether the morph amount should
> be a scene control (a knob) rather than tied only to the σ swing — that's the seam where
> Level-1 blend knobs start. Options 1–4 below stay as side-quests.

Derived from the above — deliberately not a plan:

1. **Witness one wanted-moment end to end.** Pick the cheapest line from §2 that's already
   mostly built (the leaning light? the breathing lamp at your star?) and get it to where
   someone *else* could feel it. Move the first line into "Landed."
2. **The scene player as the sharing surface.** Today's live switcher (party ↔ meowparty) is
   the closest thing to a "show someone the range" tool — a guided cycle through the moments
   that landed. Autoplay + smooth transitions (the peer's crossfade offer) make it demoable.
3. **Close a §5 gap from the taste log** — four one-line default changes are answered but never
   applied (dive=uniform, overlap=persistent, Newton escape-hatch, push-rate). Small, real,
   and they change what the room *is*.
4. **The testing-grounds tool** (from the light session): a way to be *wrong* about lamp
   positioning, not just inspect it — flash a lamp, tap which dot, right/wrong.

---

### Open questions before tomorrow's goals lock

- Is tomorrow **Meow House** (scene player / butterfly) or the **light-room** side, or both?
- Was there literal live-streaming with recordings? If so, where — so I can pull those in too.
- Do you want me to rebuild the vault graph fresh (`--update`) so post-August work is included
  before we plan on it?
