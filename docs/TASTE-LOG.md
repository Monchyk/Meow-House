# TASTE LOG — what K. actually said

Not a changelog and not a spec. This is the record of decisions that **only a live
room can answer**, written down at the moment they were made, so no future session
has to infer them again. Everything in the party build that says "unverified — needs
a live look" ends up here or stays unanswered.

Written by `controller/taste.py`, one entry per question, append-only. The exact
state behind every A and B is in `controller/taste-pairs.json` — an entry here plus
that file reconstructs any answer months later, without running anything.

**How to read an entry.** `Reached` is the confidence signal: a first-tap answer and
one given after three replays and a slowdown are not the same fact. `Session` says
where in the night it landed — a pair-12 answer on a low-battery evening is real data
but weaker data, and should be revisited before it is built on rather than treated as
settled. **Skipped and no-signal are logged too**: "I looked and I cannot tell" is
information about the effect, not a gap in the record.

Nothing here is applied automatically. A human reads it and decides.

---


## 2026-07-25 20:38 · #dive-lens-vs-uniform [SCREEN]
- Question: Which dive is right?
- A: lens (magnify the middle, frame edge stays put) — `{"zoomMode": 0, "zoomMax": 3.2, "zoomFalloff": 2.2, "zoomRatio": 0.5}`
- B: uniform (the whole frame scales -- the original) — `{"zoomMode": 1, "zoomMax": 3.2, "zoomFalloff": 2.2, "zoomRatio": 0.5}`
- **Answer: B — uniform (the whole frame scales -- the original)**
- Reached: after 1 replay(s)
- Unblocks: whether the whole 21 zoom-lens rework stands as shipped, or gets revisited
- Session: answer #1, group 1 of 6

## 2026-07-25 20:43 · #palette-fade-mud [LAMPS] — ⚠ INVALID, RE-ASK
> Struck on 2026-07-26 for two independent reasons, either of which alone would void it:
> the Hue app was on `feature/transient-effects`, so `/api/energy` 404'd and the lamps
> were not coupled to the room at all — there was nothing to see. And K. typed
> `can't tell`, which `taste.py` rejected at the time, so a genuine no-signal was
> recorded below as a skip. Both bugs are fixed. **The question is still open** (§8.0 Q6)
> and must be asked again from scratch. Kept rather than deleted: a struck entry is
> evidence about the instrument, a deleted one is a gap nobody can learn from.

- Question: Does the colour change read as drift, or as mud?
- A: 8 s fade (current default) — `{"paletteFade": 8}`
- B: 20 s fade (slow enough to be unmistakably drift) — `{"paletteFade": 20}`
- **Answer: skipped**
- Reached: after 3 replay(s) and a slowdown
- Unblocks: paletteFade default, and whether the two-colour-motions bug is real
- Session: answer #2, group 2 of 6

## 2026-07-25 20:45 · #colour-spread-order [SCREEN]
- Question: How many colours should be left as it resolves?
- A: rich (0.55 -- today's new default, several roles survive the resolve) — `{"colorSpreadChaos": 1.0, "colorSpreadOrder": 0.55}`
- B: converging (0.2 -- close to how it behaved before today) — `{"colorSpreadChaos": 1.0, "colorSpreadOrder": 0.2}`
- **Answer: A — rich (0.55 -- today's new default, several roles survive the resolve)**
- Reached: after 1 replay(s)
- Unblocks: colorSpreadOrder default -- I changed this from 0.34 to 0.55 today on inference alone
- Session: answer #3, group 3 of 6

## 2026-07-25 22:13 · #newton-soft [SCREEN]
- Question: Newton is soft now, not sharp. Keep it, or is the haze worse than the blocks?
- Item: Newton fractal — `{"spiral": "Newton fractal"}`
- **Answer: CUT** — ~~and acted on~~ **REVERSED by K. 2026-07-26, keep it in rotation.**
- Reached: after 2 replay(s)
- Cost was named before the look: yes
- Unblocks: whether to queue the sharp-render job at all
- Session: answer #4, group 4 of 6
- **⚠ REVERSAL 2026-07-26.** K., live: *"I wouldn't veto anything just yet. just make sure
  we have the option to turn it off in rotation. when they overlap the newton one actually
  makes for some cool effects."* The CUT was judged on Newton **alone**; overlap changes the
  verdict, and overlap was not yet on when this was asked. Newton stays in the catalog and
  in rotation, unvetoed. The per-exhibit `off` toggle (which persists across a reload) is
  the escape hatch if it misbehaves on the night. Entry kept rather than deleted — the
  original answer was honest for the state it was asked in. **Read this as: single-exhibit
  keep/cut answers are provisional once overlap is on.**

## 2026-07-25 22:14 · #overlap-mode [SCREEN]
- Question: Two exhibits in one frame -- fading out behind, or staying?
- A: transition (the old shape fades away behind the new one) — `{"overlapMode": 1, "overlapAmount": 0.45, "overlapFade": 12}`
- B: persistent (it stays underneath for the whole dwell) — `{"overlapMode": 2, "overlapAmount": 0.45, "overlapFade": 12}`
- **Answer: B — persistent (it stays underneath for the whole dwell)**
- Reached: first look
- Cost was named before the look: yes
- Unblocks: overlapMode default, and whether the expensive exhibits need vetoing from layering
- Session: answer #5, group 5 of 6

## 2026-07-25 22:15 · #exhibit-veto [SCREEN]
- Question: Keep this one in the room, or cut it?
- Item: Mandelbrot set (lagged; opaque) — `{"spiral": "Mandelbrot set"}`
- **Answer: skipped**
- Reached: after 1 replay(s)
- Unblocks: the veto list -- which exhibits the room never shows
- Session: answer #6, group 6 of 6

## 2026-07-25 22:15 · #exhibit-veto [SCREEN]
- Question: Keep this one in the room, or cut it?
- Item: Julia set (opaque) — `{"spiral": "Julia set"}`
- **Answer: skipped**
- Reached: first look
- Unblocks: the veto list -- which exhibits the room never shows
- Session: answer #7, group 6 of 6

## 2026-07-25 22:15 · #exhibit-veto [SCREEN]
- Question: Keep this one in the room, or cut it?
- Item: Moiré interference (opaque) — `{"spiral": "Moir\u00e9 interference"}`
- **Answer: KEEP**
- Reached: first look
- Unblocks: the veto list -- which exhibits the room never shows
- Session: answer #8, group 6 of 6

## 2026-07-25 22:15 · #exhibit-veto [SCREEN]
- Question: Keep this one in the room, or cut it?
- Item: Cellular automaton (opaque, grid-locked) — `{"spiral": "Cellular automaton"}`
- **Answer: KEEP**
- Reached: first look
- Unblocks: the veto list -- which exhibits the room never shows
- Session: answer #9, group 6 of 6

## 2026-07-25 22:16 · #exhibit-veto [SCREEN]
- Question: Keep this one in the room, or cut it?
- Item: Game of Life (opaque, grid-locked) — `{"spiral": "Game of Life"}`
- **Answer: KEEP**
- Reached: first look
- Unblocks: the veto list -- which exhibits the room never shows
- Session: answer #10, group 6 of 6

## 2026-07-25 22:40 · #exhibit-veto [SCREEN] — Ulam spiral
- Question: Keep this one in the room, or cut it?
- Item: Ulam spiral (opaque, 16 s comet loop)
- **Answer: KEEP** — "I really like how it goes around"
- Reached: after one replay (K. was distracted the first time; asked for it again)
- Two things came with the keep, in K.'s words:
  1. "the zooming on it can be a bit weird. maybe turn off that kind of zoom on it?
     it warps the field a little." → **done same evening**: `noZoom: true` on the
     exhibit, joining the automaton / Life / Truchet / the three escape-time ones.
     The picture is a fixed lattice of integers; magnifying the middle bends a grid
     that only means anything straight.
  2. "more diagonal lighting up, make the snake go around like that but at the same
     time have another comet trail that bounces over all the already revealed primes
     in a serpenty way." → **built same evening**: a second head running over the
     primes already found, in discovery order. Consecutive primes sit far apart on a
     square spiral, so joining them hop by hop throws the long diagonals across the
     field. It laps faster than the discovery comet (~7 primes/s vs the 16 s sweep),
     so the two never sync. It can only draw over what is already revealed.
- Unblocks: the veto list, and it turned into a feature request rather than a verdict
- Session: answer #11, group 6 of 6 — conversational from here, not the script
- NOT YET SEEN: both changes need a hard reload of /party.html before K. has looked.

---

### Note on method, same evening

The first six groups were driven by `controller/taste.py`. K. stopped it: *"this is not
very user friendly. think its even bugged? i thought WE were going to talk. not talk to
some python script lol."* Two real bugs found in the doing — typing `can't tell` was
rejected though the prompt advertises it (so a no-signal answer got logged as a skip),
and the keep/cut group reprinted its whole header per item, which read as broken.

From here the session runs conversationally: the room is driven directly and K. answers
in his own words, which is what produced the two Ulam requests above. A menu could not
have collected either of them. The pair table stays as the ranking and the paper trail.

## 2026-07-26 00:05 · #energy-coupling [LAMPS]
- Question: does the room's energy reach the lamps at all?
- A: GlobalEnergy 0.15 · B: 0.95, Superfluid frozen (flow 0, drift 0, brightBand 0)
- **Answer: B significantly brighter — the coupling is ALIVE**
- Reached: after the bench was built; three earlier attempts were unanswerable
- Method: `controller/bench.py energy` then `bench.py alt 0.15 0.95 30` (A,B,A,B)
- Unblocks: every other lamp question tonight. Until this, none of them were worth asking.

### Why this took four attempts — worth keeping

1. First attempt ran while the Hue app was on `feature/transient-effects`. `/api/energy`
   404s there, so `GlobalEnergy` never moved. The lamps still took colour and still
   looked alive. K. could not tell, correctly, because nothing was happening.
2. Second attempt, right branch, still unanswerable — K.: *"its hard to say considering
   that the lights keep changing colour of themselves anyway no? ... we need a proper
   clean testing environment. where the lights also get turned off and on for the
   sequence."* The Superfluid ambient is always moving; a brightness question asked on
   top of a live tide is not a question.
3. `controller/bench.py` built from that: freeze the field, black out between sides,
   one variable at a time. K. confirmed the freeze holds ("its still").
4. Answered on the first clean look, then confirmed on a 30 s A/B/A/B alternation.

**The lesson, for the next time something "can't be judged": suspect the instrument
before the eye.** Three of the four failures were the measurement, not the observer.

## 2026-07-26 · #fade-push-rate [LAMPS] — the verdict that was run once and lost

- Question: does the mid-fade lamp push rate cause the stutter K. saw in a colour drift?
- A: `palettePushHz` 3 (the shipped default) · B: 12. Same 8 s attract drift, same lamps,
  same scene, nothing else touched.
- **Answer: NO DIFFERENCE. Both stutter.** K.: *"they both indeed stutter, a bit like a
  fire effect but it feels sterile and sudden."*
- **This settles which repo owns the fix: the Hue repo, not Deep-House.** The JS chain is
  exonerated end to end — the engine glides (155 distinct palettes across an 8 s fade,
  measured previously), `party-main.js` pushes the eased value, and pushing it 4× more
  often changes nothing a human can see.
- Method: `setConfig palettePushHz` + `skip` over `/party/pub`, driven from the terminal,
  K. watching the lamps and answering in his own words. No menu.

### What had to be built before it could be asked

`320` was a **hardcoded literal** in `party-main.js` — there was no B side, which is why
this question died the first time. It is now `config.palettePushHz` (default 3, so
behaviour is unchanged) with a "drift smoothness" slider under *The room*. The knob's
purpose was to prove itself unnecessary, and it did. **Keep it anyway** — it is the only
thing that can re-exonerate the JS side after the C# fix lands.

### Two pre-flight facts that would have poisoned the data

- The TV was running JS without the new key. A **hard reload of `/party.html`** is
  mandatory; reloading the dashboard does nothing (it is a thin client).
- `config.bpm` was found at **12**, against a default of 48. Tempo scales `colorDrift`,
  so the lamps' own hue walk was 4× slow. The reload reset it — but had it not, the
  verdict would have been about the tempo, not the push rate.

### Where to look in the Hue repo — suspects, NOT a diagnosis

`Hue program/Services/SceneRenderer.cs`, the output-conditioning stage:

1. **`Approach()` is a LINEAR ramp with a hard stop** (:171). It moves each channel at a
   constant capped velocity and then halts dead on arrival — no ease-in, no ease-out. A
   constant-velocity colour ramp that stops at a corner is a good structural match for
   *"sterile and sudden"*.
2. **Step size is energy-scaled** (:141) — `rgbStep = (0.5 + energy*3.5) * dt`. The room
   sat at `effectiveEnergy` ≈ 0.15 during the test, so colour was crossing at ~1.0
   channel/sec: near the slowest the limiter allows. The stutter may be the drift racing
   the limiter and getting rationed frame by frame.
3. **Frame pacing** — `AnimationLoop` runs at **50 FPS**, not the constructor's default of
   15 (every real call site passes `targetFps: 50`; checked, do not re-derive). But the
   loop is `await Task.Delay(20ms)` *after* the render work, uncompensated, and Windows
   timer granularity is ~15.6 ms — so frame SPACING is genuinely uneven. `deltaTime` is
   measured from a stopwatch and so the motion stays time-correct, which makes this the
   weakest of the three suspects. Named so nobody spends an evening on it twice.

**Not fixed here on purpose.** The verdict was the deliverable, and the fix is in another
repo and another sitting.

## 2026-07-26 · #fade-after-hsv [LAMPS] — the colour reads fixed; the STEPPING is brightness

First look at the HSV/eased limiter (`Hue program` `c9d4e40`), driven by
`controller/showreel.py` — four slated items, K. watching, answering in his own words.

- **Item 1, the calm drift — the original complaint — PASSES.** K.: *"1 seems to be chill.
  maybe a bit of a fire effect but thats nice."* Against *"a bit like a fire effect but it
  feels sterile and sudden"* on the same fade before the fix. Same phrase, opposite
  verdict: the fire effect is now a feature. **Item 2 (big colour jumps) also passed.**
- **Items 3 and 4 (fastest and slowest crossings) still stuttered**, and the exaggerated
  follow-up (`controller/showreel_drag.py`) localised it: K.: *"first one drags a bit,
  stuttered when its going down in brightness. its like step step step step instead of
  smooth."*

### The cause, and it is not what either of us guessed

K.'s hypothesis — *"I think it has to do with the color cycling stand on the spiral right?
the blooms from the corner can be a bit imposing"* — **is wrong, and worth recording as
wrong** so nobody re-opens it. `party-main.js lampPalette()` reads `light.palette`, the
light-SCENE's palette. It never touches the spiral's per-frame colours. The screen and the
lamps share a scene, not a frame; the corner bloom cannot reach the lamps.

**It is brightness quantisation, and the pipeline destroys precision for nothing:**

1. `SceneRenderer` slews brightness as a smooth `double`.
2. It then rounds: `s.Brightness = (int)Math.Round(bri)` — **100 levels, 1% apart**
   (`LightState.Brightness` is typed `int`, so the loss is baked into the model).
3. `EntertainmentStreamController.cs:213` then does
   `entLight.State.SetBrightness(lightState.Brightness / 100.0)` — **converting it straight
   back to a float.**

The entertainment stream carries full float brightness. We round to 1% and then divide by
100 again. A slow dim crosses those 1% steps one at a time, visibly — and it reads worse
going DOWN because a 1% absolute step is a far bigger relative change once the lamp is dim.

⚠ **Brightness never went through the HSV fix** — it was deliberately left on the old
linear `Approach` because it was not part of the colour muddying (`c9d4e40`). That decision
is why this stutter survived intact while the colour side started reading as "chill". It
was the right call for the colour bug and it is now the next bug.

**Not fixed, and it should not be fixed blind:** `LightState.Brightness` is `int` and is
read in many places, so this is a type change with reach, not a one-liner. Whether to widen
it, carry a parallel double, or dither the rounding is a real design call.

## 2026-07-26 · #fade-push-rate-REASKED + #lamp-breath [LAMPS] — both defaults changed

Run after the HSV limiter (`c9d4e40`) and the brightness widening (`bd95e53`) were both
live and both confirmed by eye. `controller/showreel.py` for the confirmations, then a
four-item A/B for these two.

### ⚠ THE PUSH-RATE VERDICT FROM THIS MORNING WAS WRONG, AND IT IS INSTRUCTIVE

`#fade-push-rate` (above) recorded 3 Hz and 12 Hz as **indistinguishable**, exonerated the
JS side, and sent the fix to the Hue repo. That was the right call on the evidence — but
the evidence was collected in a **broken room**: the limiter was still chasing colour in
RGB and rounding brightness to 1%, and both sides stuttered far too hard for a push rate
to show through. Re-asked in a room where both are fixed, K.: **"12 hz def beat 3 hz."**

**`palettePushHz` default 3 → 12.**

**The lesson, and it generalises past this bug: a null result is only as good as the room
it was collected in.** The morning's A/B was not wasted — it correctly identified that the
push rate was not *the* problem, which is what moved the work to the C# — but "not the
problem" was silently recorded as "not a problem". Those are different claims. **When a
comparison comes back null because BOTH sides are bad, log it as blocked, not as settled,
and re-ask it once the blocker is gone.**

### Lamp breath — narrow, and K. diagnosed his own false positive

K. had asked to *"minimalise the floor and the cealing difference delta so it doesnt feel
like a fire effect but it doesnt feel static either."* That number was hardcoded at 0.30
in `party-main.js`, so it became `config.lampBrightBand` + a "lamp breath" slider first.

Shown 0.30 against 0.10, he read 0.10 as stuttery — **and then correctly dismissed his own
observation**: *"I believe narrow breath stutters because of its slowness and catching up
rather than anything else."* He was right, and it is worth understanding: a small swing
makes a low target-update rate MORE visible, not less, because the coasting between updates
is a larger fraction of the total movement. The narrow band did not stutter; it exposed
3 Hz.

**`lampBrightBand` default 0.30 → 0.12.** ⚠ 0.12 is a considered number, **not a measured
one** — it was never shown on its own at 12 Hz. It is one slider away from being an actual
choice, and the first person to sit with the room should move it.

### Still open

- **Items 2 and 3 of the main reel** (big colour jumps, pumped) still read as *"a bit
  jumpy"* — K. suspected the same slowness. Both defaults have changed since; **neither has
  been looked at again.** That is the next cheap question, not a new investigation.
- The `HUE_TRACE_SLEW` run was never collected. It is now much less interesting — both
  suspects it would have arbitrated are fixed.
