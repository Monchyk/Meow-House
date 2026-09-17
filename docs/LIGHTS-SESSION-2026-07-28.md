# THE LIGHT SESSION — 2026-07-28

*What happened, what turned out to be true, and every claim made here that was later
wrong. Written because most of this is not recoverable from the diff.*

The session began as "run the showreel and answer the open taste questions". It never got
there. It ended having discovered that **half the room has never been able to receive
colour**, and having built the wrong shape of tool to find that out.

---

## 1. The arc, in order

| # | what happened | outcome |
|---|---|---|
| 1 | Added a menu to `showreel.py` | shipped `31adf92` |
| 2 | Tried to look at the lamps | **failed** — showreel drove an empty relay |
| 3 | Tried again with `/party.html` open | **failed** — ten things moving at once |
| 4 | K.: *"too many variables arent there?"* → scoped a rework | scope brief, approved |
| 5 | Fable wrote a plan and a review | **delivered; never reached the main session** |
| 6 | Probed the live room | **five lamps are not in the entertainment area** |
| 7 | Built Phase 1 (C#) + `/lights.html` + sweep + colour modes | shipped, 30 suites |
| 8 | K.: *"its just a verification step"* | **the tool is the wrong shape** |

---

## 2. What is actually true about the room

**Confirmed live, not inferred.**

```
GET /api/status  ->  "Connected: 5 lights streaming"
GET /api/lights  ->  10 lamps
```

Five lamps — Staanlamp, Lightstrip Bed, Hue ambiance lamp 1, Toog, On/Off plug 1 — are
**absent from the entertainment area**. `ApplyStates` silently skips anything not in
`_lightMap` (`EntertainmentStreamController.cs:210`), so they receive nothing. No
position, palette, layer or endpoint changes that.

`On/Off plug 1` (a plug) and `Hue ambiance lamp 1` (white-ambiance) **can never join** —
entertainment areas require colour-capable lights. The other three depend on the bulbs.
**K. has not checked yet; this is the open question the whole plan waits on.**

### The false belief this overturns

`PARTY-HANDOFF.md` trap 5 and the §14.1 notes state that unmapped lamps *"get fill +
palette spread now"*. `SuperfluidFlowLayer` genuinely computes that fill (`FillLevel =
0.38`, spread around the palette by index, `:72-78`, `:204-206`) — and it is **dropped at
the stream boundary**. That fill has never been visible on a real lamp. The piece has
been tuned, all month, around the half of the room that works.

### Why nobody noticed

`HueEngine.PositionsAreUsable()` (`:140-151`) returns true when **≥2 lamps** are
non-origin at **≥2 distinct** spots. Five qualify, so `EnsureUsablePositions()` returns
at `:160` and the entertainment-area fallback never runs. It is a degeneracy guard —
"do spatial effects have *anything* to work with" — being read as a quality check.

---

## 3. ⚠ Claims made during this session that were WRONG

Kept because a wrong diagnosis that gets half-remembered is worse than none.

**"A stale bedroom config is corrupting the room."** *Wrong in effect.* The
`configs[0]`-picks-alphabetically bug was real (`HueEngine.cs:109-111`) and is fixed —
but `Bedroom AllnRound 1.json`'s coordinates match the bridge's own entertainment-area
coordinates **to three decimals**. It was almost certainly generated from this same area.
It was never producing wrong positions for the lamps that matter.

**"Six entries are dumped at `[-1,-1,-1]`."** *True of the file, irrelevant to the room.*
`ApplyPositions` only assigns where the id matches (`:64`); those ids are not our lamps.
Our five unmapped lamps are absent from the config entirely and fall through to
`Position ??= {0,0,0}` (`HueEngine.cs:113-114`). **Nobody should hunt for `[-1,-1,-1]` in
live data.** (Caught by Fable.)

**"Fable did nothing."** *Badly wrong, and expensive.* Fable delivered three times —
~28k output tokens — and none of it reached the main session: the idle notifications
carried no payload and the task `.output` file is a dangling symlink. The main session
concluded "it produced nothing" from an empty inbox, logged that as fact, and rewrote the
plan by hand. K. could see the output on screen and pasted it back. **Fable's review
caught the entertainment-area membership issue, which the main session had missed.**

**"Height barely matters, so three bands are enough."** *Wrong.* The justification —
"the corner targets ignore Z" — is true (`:113-118`) and irrelevant. A lamp's z still
reaches the render twice: `dist` is a 3D distance (`:126`), setting *when* the tide
arrives; and `align` is a dot product against corners pinned at z=0 (`:225`), so lifting a
lamp tilts it out of that plane and lowers alignment with **every** corner. Raising a lamp
means **reached later and swept more weakly**. It is a participation dial. It is a slider
now. (Caught by K.)

**"Identify can reuse the console wizard's flash loop."** *Wrong.* `MapLightsAsync` calls
`LightController` REST directly, which works there only because no stream is running. In
the Web app `AnimationLoop` pushes at 50 fps and the stream wins for group members — a
direct call is stomped within ~20 ms, **intermittently**. It is an `IdentifyLayer` now.
For non-member lamps the rule **inverts**: REST is the only thing that reaches them.
(Caught by Fable.)

---

## 4. Traps found the hard way

1. **`showreel.py` drives `/party.html`, not the lamps.** Every `business`/`skip`/
   `setConfigMany` goes to `/party/pub`; only the browser turns those into lamp pushes.
   With nothing subscribed they land in an empty relay. Measured: 0 messages on
   `/party/sub` before the page was opened, 16-in-4s after. Its slate also sets
   `flowIntensity=0, brightBand=0, palette=FFFFFF` and never restores them, so a
   browserless run leaves the room stuck white and flat.
2. **A menu with no keyboard attached.** Run any interactive script under Claude Code's
   `!` prefix and `input()` takes EOF immediately — the menu returns, the room is
   restored, and the output reads as "it ran and chose to quit". Fixed with an
   `isatty` check.
3. **A 200 with no body is normal.** `POST /api/effects/run` returns `Results.Ok()` with
   an **empty body** (verified: `status 200 | body length 0`). Calling `r.json()` on it
   throws `unexpected end of data`. This surfaced as "sweep failed" *and* as "the map
   shows nothing" — two symptoms, one wrong assumption.
4. **`serve.py` has no `do_PUT`.** Only GET/POST/DELETE are proxied; a `PUT` returns 501
   from the base handler and never reaches `:5000`. (Caught by Fable.)
5. **The `/api` proxy times out at 2.5 s**, deliberately — a slow Hue app would otherwise
   starve the SSE streams. Any endpoint that takes longer must be fire-and-forget.
6. **`SamplePalette` loops** the last colour back into the first, so at `colorSpan` 1.0
   the furthest lamp wears the nearest lamp's colour. `party-main.js` dodges this with
   there-and-back palettes; the sweep modes instead stop short of the wrap.
7. **Positions are captured in `OnActivate`.** A save with no re-activation looks like a
   no-op until the next scene change. Hence `SceneRenderer.ReactivateLayers`.
8. **The app's working directory is the *project* dir, not `bin/`.** So
   `Hue program Web/positions/` and `Hue program Web/light-config.json` land in the source
   tree naturally — and the old bedroom config in `bin/Debug` was never being read this
   session. (Those paths are in the **`Hue program` repo**, not this one.)

---

## 5. K.'s words, kept verbatim

They are the design record; paraphrase loses the requirement.

> *"we have been out for a bit. whats a priority? i want to actually make sure we dont
> create a whole bunch more technical debpt"*

> *"the page itself is also driving the lights no? … I think there are too many variables
> arent there?"*

> *"I really want you to be more autonomous. be a good little AI and prompt your human
> better."*

> *"I realy just want to have something with a ui interface that we can finetune and test.
> like a speaker test for surround but with lights."* — **the actual requirement**

> *"I want simplicity but ui can be a bit extensive. it needs to be visual and clean."*

> *"the whole reason we started this is to test our light effects with positioning and
> stuff. seeing if the sweep happens the right way and how the lamps react to being moved
> around"*

> *"now it just kinda fades blueish but thats hard to distinguish the order tbh."*

> *"it doesnt help me step by step to check if the positioning and stuff is good. there is
> almost no testing grounds. its just a verification step but how do i learn how to use it
> even? im sure theres a better way"* — **the verdict on what was built**

---

## 6. The verdict, and what it means for the next build

**What exists is an inspector. What was asked for is a procedure.** A speaker test is a
guided sequence with a verdict at each step; what shipped is a mixing desk that displays
true facts and leaves the interpreting to K. Everything it shows is correct, which is
exactly why the substitution survived two sessions and 30 passing tests.

**The machinery is sound and should be kept:** identify routing (layer vs REST), the
partial-upsert save, `ReactivateLayers`, the sweep mirror of the layer's maths, the four
palette modes, the three-facts model, 30 suites. **It is the flow that is wrong.**

What the next version needs, from K.'s critique:

1. **A wizard** — one lamp at a time, forced order, visible progress, a clear finish.
2. **Testing grounds — a way to be *wrong*.** The tool flashes a lamp, K. taps which dot
   he thinks it is, and it says right or wrong. Nothing that only *displays* state can
   ever prove the mapping is good. Plus: "these two should be furthest apart — watch them
   light at opposite ends of the breath", and a "which lit first?" A/B.
3. **Teach in the flow.** If the answer to "how do I use this" is a markdown file, the
   tool isn't finished. `docs/LIGHT-SETUP.md` is well written and is still the wrong place
   for the first ten minutes.

**Order matters:** the entertainment-area check comes first. A wizard that walks K.
through placing lamps that can never light would be a worse tool, not a better one.

---

## 7. Process notes

- **Never infer an agent produced nothing from silence.** Say "I have not received it" and
  ask K. whether output is visible, before taking over or logging a failure. Three
  `idle_notification`s carrying no payload are not evidence of a dead agent.
- **One ping, then take over** — but only after checking whether the human can see what
  you cannot.
- **Suspect the instrument before the eye.** Every failed look this session was the
  measurement, not the observer. That rule was already written in
  `docs/TASTE-SESSION.md` §8 and was still learned again the hard way.
- Logged to `~/.claude/failures.md`: the empty-relay showreel run, the agent-delivery
  failure (corrected in place), and the governor's spare-capacity nudge never firing.

---

*State: `STATE.md` (2026-07-28 entries). Operation: `docs/LIGHT-SETUP.md`.
Plan + Fable's full plan and review: `~/.claude/plans/iterative-hugging-fountain.md`.*
