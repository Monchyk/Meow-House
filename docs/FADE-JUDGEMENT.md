# FADE JUDGEMENT — the slew limiter, and what "properly fixed" means

Written by Fable, acting as VP/architect, 2026-07-26. K. escalated the fade-stutter
fix with *"I think we need to scale this up so it is properly fixed."* This is that
scaling: a decision document, not a patch. No code was touched in either repo while
writing this — see `docs/TASTE-LOG.md` `#fade-push-rate` and `docs/TASTE-SESSION.md`
§6.1/§8 for the measurement that put the fix in this repo's court in the first place.

## What I read before deciding

`Hue program/Services/SceneRenderer.cs` (the whole `Render` method and `Approach`),
`Services/AnimationLoop.cs`, `Layers/SuperfluidFlowLayer.cs` (the colour-tide section,
`_colorPhase`/`_colorDrift`/palette handling), `Services/EntertainmentStreamController.cs`
(confirmed the 50 Hz auto-update loop at line 136 — the streaming path adds no extra
smoothing or rate conversion of its own; whatever `Render()` emits goes out essentially
as-is), and `Interfaces/ILightOutput.cs`. I did not find a C# test project for
`HueLightController` itself — only `Q42.HueApi-master`'s vendored library tests, which
cover the Philips Hue SDK wrapper, not this app's rendering logic. **There is no
existing headless coverage for `SceneRenderer`, `Approach`, or the slew limiter.**
Worth flagging: K.'s summary of the suspects matches what I read exactly — I found
nothing that changes the diagnosis and nothing missed.

## 1. Is measurement a prerequisite? — No, but a cheap one runs alongside Phase 1, not before it.

The linear-ramp diagnosis is strong enough to act on directly. `Approach()` is not a
hypothesis needing confirmation — it is 6 lines, fully read, and it unambiguously does
constant-velocity motion with a hard stop, no easing at either end. That shape produces
exactly the visual signature K. named ("sterile and sudden") by construction, not by
inference. Requiring a live-lamp measurement before touching a mathematically obvious
defect would be measurement theater — the kind of thing §8's own lesson ("suspect the
instrument before the eye") warns against in the other direction: don't demand an
instrument when the code already answers the question.

What *is* worth instrumenting, cheaply, is not "is Approach linear" (known) but "is the
limiter actually rationing at the energy K. was running" (suspect #2, unconfirmed) —
because that number tells you which fix magnitude matters. I'd fold this into Phase 1
as a logging line, not a separate live session: `Render()` already computes `rgbStep`
and the actual per-frame delta every call. Log `(target - current)` vs `rgbStep` for one
light for one fade, headless, no lamps needed, no K. time spent. If the delta is
consistently below the step cap, the limiter isn't the bottleneck for that fade and
suspect #1 (the ramp shape itself) carries the whole fix. If it's consistently clamped,
both #1 and #2 matter and the fix has to touch both. This is a five-minute addition to
Phase 1, not a gate in front of it.

## 2. Shape of the fix

Of the options on the table, I'd reject two outright and combine the rest.

**Reject: "move colour crossing out of the limiter entirely and let layers own their own
easing."** This inverts the architecture on purpose comment at `SceneRenderer.cs:132-136`
— the limiter exists precisely so *every* layer, present and future, is de-strobed for
free without each effect author re-implementing safety. `SuperfluidFlowLayer` already
does its own phase integration for *tide* motion (§13, the flicker-avoidance comment at
line 57-60) but that's about *not teleporting the target*, not about *how fast the
target is approached once set* — that responsibility is deliberately centralized. Moving
it out trades one shared, auditable safety stage for N per-layer implementations of the
same guarantee, each capable of getting it wrong differently. This is the one option
that actively regresses the architecture invariant DESIGN.md and the photosensitivity
constraint depend on.

~~**Reject (for now): "make the limiter rate-aware rather than step-capped."** This is a
reasonable long-term idea but it's underspecified today — "rate-aware" needs a
definition (aware of what: target velocity? recent history? a spring model?) and that
definition *is* the design work. It's not a fix, it's a Phase-3-or-later research item.
Don't let "properly fixed" become "redesign the limiter's whole control model" when a
narrower change addresses the named symptom.~~

**Superseded 2026-07-26 — see the revision section at the end of this document.** K.
was asked directly and chose the rate-aware redesign now, not the deferred curve tweak.
The judgement above stands as a warning about scope creep, not as the final word — the
correct response to "underspecified" is to specify it, which the revision does using
a piece of the codebase this section didn't yet know to look at (`ColorMath.LerpHsv`).
Kept rather than deleted, per house convention: a struck call is evidence about the
first pass, not a gap in the record.

**Adopt, combined: ease the `Approach` curve, and separate the safety floor from the
aesthetic ceiling.** Concretely:

- Replace the hard linear ramp with an eased approach — e.g. exponential/critically-damped
  interpolation (`current += (target - current) * (1 - exp(-k*dt))`) which has no
  "hard stop", decelerates naturally into the target, and is a one-function change
  localized entirely inside `Approach()`'s call sites. This directly answers "sterile
  and sudden": there is no arrival snap because the curve asymptotically approaches
  rather than clamping to a max velocity and then discontinuously becoming zero
  velocity.
- Keep `rgbStep`/`briStep`'s *ceiling* — the energy-scaled maximum rate — as the
  strobe-safety floor, but stop conflating "how fast is safety-permitted" with "how a
  approach curve feels." The easing constant (how quickly it decelerates into the
  target) and the energy-scaled ceiling (the hard maximum rate, still governed by
  `energyCap` = 0.65 upstream) become two independently tunable numbers instead of one
  variable doing both jobs. This is exactly the "separate the safety floor from the
  aesthetic smoothing" option in the brief — I'm not picking a different one, I'm saying
  it should absorb the ramp-shape change rather than sit next to it as a competing
  option, because the eased curve is *how* the separation gets expressed mechanically.

This is a bounded, single-file, single-method-family change. It does not touch
`AnimationLoop`, `EntertainmentStreamController`, or any layer.

**Defer: frame pacing (suspect #3).** Confirmed weakest per the log's own ranking, and
I found nothing reading `AnimationLoop.cs` that changes that ranking — `deltaTime` comes
off a `Stopwatch` (`stopwatch.Elapsed.TotalSeconds`), so motion stays time-correct even
if wall-clock frame spacing under Windows' ~15.6ms timer jitters. Fix only if Phase 1
ships and the stutter is not fully gone — don't bundle it speculatively.

## 3. The anti-strobe invariant, stated precisely

**Invariant: for any target change to any light's colour or brightness, the instantaneous
rate of change (channel-units/sec and brightness-units/sec) must never exceed the
energy-scaled ceiling currently computed at `SceneRenderer.cs:140-141`, regardless of
target distance, target change frequency, or which layer or code path produced the
target.** This must hold by construction, not by the good behavior of callers — which is
exactly the current architecture's strength and the one property the fix must not
disturb.

How it survives the fix: the eased curve I'm proposing is *strictly slower* than the
current hard cap at every point except the limit as time→∞ (a damped exponential's
instantaneous velocity is `k*(target-current)`, which starts near the same ceiling for
large distances and *decreases* as it approaches — it never spikes above the current
max-step ceiling if the ceiling is used to bound `k` or as an outer clamp). Concretely,
implement it as *ceiling-clamped easing*: `step = min(idealEasedStep, maxStep)` — the
existing `rgbStep`/`briStep` ceiling stays as an outer `Math.Min`, so the safety floor is
literally still the same line of code, untouched, just no longer the *only* shaping
force. This is the by-construction guarantee: the safety clamp is structurally outside
and independent of the aesthetic curve, so no aesthetic tuning can ever loosen it — you'd
have to edit the clamp itself, which is exactly the property today's code already has
and must keep. `energyCap` (0.65) upstream of `GlobalEnergy` is unaffected either way;
this fix operates entirely downstream of it.

## 4. Scope and phasing

**What each phase costs K., in one line: Phase 1 costs him nothing (headless, done in
this session while he's elsewhere). Phase 2 costs him an evening with the real lamps,
narrating what he sees, same as the `#fade-push-rate` session. Phase 3 (if reached)
costs him another such evening.** See the revision section below — Phase 3 has since
been promoted into the main work, not deferred.

**Phase 1 (headless-verifiable, this repo's Hue-side work, no K. required):**
Implement ceiling-clamped exponential easing in `Approach()`. Add the cheap
rate-vs-ceiling logging described in §1 as a debug-only trace (behind a flag or
`Console.WriteLine` gated on an env var — don't ship it always-on, it's noisy at 50 Hz).
If a C# test project doesn't exist for `HueLightController`, this is the moment to add
a minimal one — even a handful of unit tests on `Approach()` alone (given a target and
N frames of fixed `dt`, assert the curve never exceeds ceiling and reaches within
epsilon of target by frame N) is worth more than the whole live-lamp A/B, because it's
the kind of invariant a human eye cannot verify and a live session already failed to
distinguish (3 Hz vs 12 Hz "no difference" was itself only knowable by asking K.,
repeatedly, at some cost to his evening). I'd treat "give `SceneRenderer` a test
project" as in-scope for "properly fixed" — the current total absence of coverage on
the exact function under discussion is why this escalated to a live guessing session in
the first place.

**Phase 2 (needs K.'s eyes, real lamps):** Re-run the fade K. already characterized
("sterile and sudden," compared to a fire effect) with the eased curve live, same
method as `#fade-push-rate` — freeze everything else, one variable, K. narrates in his
own words. `palettePushHz` (already built, per TASTE-LOG) is the re-exoneration
instrument for the JS side and should be left at its current default during this test
so only the C#-side change is in play. This is the only step that can close the loop —
easing curves are a felt judgment, not a headless-verifiable property, and DESIGN.md's
feelings-first stance means the live verdict is the actual acceptance criterion, not the
unit test.

**Phase 3 (only if Phase 2 says the stutter persists):** Revisit frame pacing
(suspect #3) and/or the "rate-aware limiter" redesign I deferred in §2. Don't
pre-build either.

## 5. Repo ownership

All of this — `Approach()`, the new test project, the debug trace — is entirely inside
`Hue program`. Nothing in Deep-House needs to change: `party-main.js`'s
`config.palettePushHz` already does its job (proving the JS chain innocent) and should
be left alone. The only Deep-House-side action is documentation: once Phase 2 lands a
verdict, it belongs in `docs/TASTE-LOG.md` as a new dated entry (append, don't rewrite,
per STATE.md's own rule) closing out `#fade-push-rate`'s "fix is in another repo"
note, and `STATE.md` §6 item 1 should get its final line struck the same way
`#palette-fade-mud` was struck rather than deleted.

## Open questions for K. (as originally written — see revision below for what got answered)

1. ~~Is the eased-curve direction (§2) right, or does "properly fixed" mean something more
   structural to you — e.g. you actually want the rate-aware redesign now, not deferred
   to Phase 3?~~ **Answered: rate-aware redesign, now.** See revision.
2. ~~Comfortable with a debug-only rate trace shipping in Phase 1?~~ **Answered: yes.**
3. ~~Do you want the new test project scoped to just `Approach()`?~~ **Answered: Fable's
   call.** See revision.
4. ~~Phase 2 costs you another live session with the lamps — where does this rank?~~
   **Reframed** — K. asked what Phase 2 even *was*, meaning the phase list needed to be
   legible without reading the whole document first. Addressed above with a one-line
   per-phase cost summary, and further restructured below.

---

## REVISION 2026-07-26 — K. chose the rate-aware redesign; specifying it

K. was asked directly rather than left with my Phase-3 deferral: *"I want it properly
fixed tbh."* and, on the test-scope question, *"i'm not sure? what would fable do?"* —
so I own that call too. This section supersedes §2's rejection of the rate-aware
limiter and §4's phasing; it does not touch §3 (the invariant) or §5 (ownership), which
still hold. Nothing here was written blind — I went back into `ColorMath.cs`, which
neither the original suspects list nor my first pass had reason to open, and found the
missing piece already built.

### The redesign, specified

**The structural mismatch this closes.** `SamplePalette` (`ColorMath.cs:103`) already
generates every fade *target* correctly — it calls `LerpHsv`, which rotates hue along
the shortest arc (350°→10° crosses 0°, not the long way through 180°) instead of
chording straight through RGB space, which is exactly the fix K.'s own JS-side work
already proved necessary (STATE.md Iteration 10 — RGB lerp between red and blue
visibly greys out through the middle; the room read as ~0.11 saturation instead of a
fade). But `SceneRenderer.Approach()` (`SceneRenderer.cs:150-153`) calls itself three
times, once per R, once per G, once per B, independently, capped by a flat channel-unit
ceiling. So even when the *target* was correctly placed on the perceptual arc, the
*path the limiter takes to catch up to it* every frame is back to being an RGB chord —
the limiter re-linearizes exactly the distortion the target generation was built to
avoid. This is likely a second, previously-unnamed contributor to "sterile and sudden":
not only does the ramp stop hard, the colour it's chasing can visibly cut corners
through desaturated territory while it chases. Nobody on the suspect list (mine or the
log's) named this, because nobody had read `ColorMath.cs` and `SceneRenderer.cs` side
by side — the fix ingredient already exists in the codebase and is unused where it
matters.

**Control input.** The moving HSV target, recomputed by whichever layer owns the frame
(currently `SuperfluidFlowLayer.ColorAt`, via `SamplePalette`), plus the limiter's own
previous smoothed HSV state — same role `_slew` plays today, just carrying H/S/V
instead of R/G/B.

**What's conserved.** Not colour distance in RGB (today's model) but hue-arc distance:
the shortest signed rotation around the wheel, saturation distance, and value distance,
each bounded independently — the same three quantities `LerpHsv` already computes at
`ColorMath.cs:90-95`, reused rather than reinvented.

**The mechanism — `ApproachHsv`, a new sibling to `Approach`:**
1. Convert `prev` and `target` to HSV via the existing `ToHSV` (`ColorMath.cs:29`).
2. Compute the shortest signed hue delta exactly as `LerpHsv` does (`dh`, wrapped to
   ±180°).
3. Bound each of the three deltas — hue (deg), saturation (0..1), value (0..1) — by its
   own energy-scaled per-second ceiling, structurally the same shape as today's
   `rgbStep`/`briStep` formula (`(base + energy * range) * dt`), just three ceilings
   instead of one shared RGB ceiling. **This is where the safety floor and the redesign
   compose**: the ceilings are still the only thing `energyCap` (0.65) governs upstream,
   unchanged in role, just relocated to a space where "rate" means the same thing the
   colour generator means by it.
4. Apply the Phase-1 easing (§2) to each of the three bounded approaches — no reason to
   drop the "no hard stop" fix just because the space changed; the two ideas compose,
   they don't compete.
5. Convert back with `FromHSV` (`ColorMath.cs:52`) once, at the end, to hand `SceneRenderer`
   the RGB it needs for output.
6. **Degenerate-case guard, required, not optional:** near-grey colours (`S` below
   ~0.02, the same threshold `LerpHsv` already uses at `ColorMath.cs:173-174`) have an
   effectively undefined hue — a tiny sensor-noise-level RGB wobble near grey can spike
   the computed hue by 180° with no perceptual color change behind it. Without adopting
   the target's (or previous's) hue through that zone the way `LerpHsv` does, the limiter
   would occasionally see a huge phantom hue *velocity* and either slam the ceiling for
   no visible reason or (worse) briefly rotate a near-white lamp through a visible hue on
   its way through grey — reintroducing exactly the kind of surprise motion this whole
   effort exists to remove. Brightness (`Bri`) is untouched by any of this — it stays on
   today's channel-independent `Approach`, since it was never part of the muddying
   problem.

**Is this specifiable without a live measurement?** Yes — more confidently than the
Phase-1 curve tweak, in fact. Every piece (`ToHSV`, `FromHSV`, the shortest-arc formula,
the near-grey guard threshold) already exists, tested informally by `SelfTest.cs`'s
"no grey muddle via HSV lerp" check (line 50) and provably correct by inspection. This
is code composition, not research. I am not reversing my original §1 call — I'm
reporting that it holds even more strongly for the bigger ask.

### Q2 — the dashboard tab idea: noted, not committed

K.'s aside — *"our dashboard could use a few tabs now though"* — is a real, separate
observation: `web/dashboard.js` is ~31 sliders deep across grouped sections (per
STATE.md's stocktake, question 4: "the tuning desk is large"), and a debug/diagnostics
tab is a sensible eventual home for a live rate trace instead of console-only output.
**This does not belong inside the fade fix.** It's a Deep-House-side UI restructuring
that touches a shared, actively-edited file (`dashboard.js` is named in STATE.md §9 as
one of three files with multiple sessions' work interleaved in it right now) — pulling
it into this piece of work would both scope-creep the fix and risk colliding with
whoever else is in that file. Recommend it goes on STATE.md's stocktake list (§ "Agreed
... silently never built" or a new line) as its own item, to be picked up when the
tuning-desk-is-large question (stocktake question 4) gets addressed — they're the same
underlying problem (too much flat surface, not enough structure) and should be solved
together, not piecemeal. Phase 1's debug trace ships as `Console.WriteLine`/env-flag
only for now, per K.'s Q2 approval, with a comment pointing at this note so whoever
builds the dashboard tab later knows there's already a producer waiting for a consumer.

### Q3 — test scope, Fable's call

Scope the new `HueLightController` test project to the **limiter as a unit, both old
and new paths, plus one integration seam** — not broader than that, not narrower:

1. `ApproachHsv` unit tests: ceiling never exceeded per component across N frames for a
   range of start/target pairs; the 350°→10° shortest-arc case explicitly (the exact
   scenario named in `LerpHsv`'s own comment); the near-grey guard (a target that swings
   through S≈0 does not spike computed hue velocity); convergence within a bounded frame
   count for a fixed `dt`; and a round-trip stability check (feeding the same target
   repeatedly does not drift — since `ToHSV`/`FromHSV` are not perfectly lossless at the
   float level, this catches slow numerical creep that a single-frame test can't).
2. Regression tests for the *existing* `Approach` (RGB) — currently zero coverage exists
   anywhere on this function, and it stays in use for brightness. Cheap, and it's the
   safety net for §3's invariant: assert the ceiling holds under the old path too, so a
   future refactor can't silently loosen the one guarantee that must never move.
3. One integration-level test through `SceneRenderer.Render()`: a fixed layer emitting a
   scripted HSV-target sequence (simulating a colour-tide fade), asserting end-to-end
   that (a) `Bri` is unaffected by the HSV change, (b) the emitted RGB at each frame is
   within the per-component ceiling of the previous frame's RGB once converted back, and
   (c) `GlobalEnergy` composes correctly (a fade at `energy=0.15` moves visibly slower
   than the same fade at `energy=0.95`, mirroring the `#energy-coupling` live-verified
   fact in TASTE-LOG.md so a future refactor can't silently break that finding either).

**Why not broader** (full `Render()` coverage — layer compositing order, the energy
backstop, `GlobalBrightness` scaling): those are unrelated to this fix, currently
unbroken, and untouched by this change. Bundling their tests in here would make the PR
answer "does the fade fix work" and "is `SceneRenderer` fully covered" at once, and a
failure in the second would obscure the answer to the first. That's real, separate
scope — it belongs on STATE.md's backlog next to the dashboard-tab note, not folded
into this one.

### Execution mechanics

This is done from this session, not handed off: `dotnet 10.0.302` is on `PATH`, `Hue
program.sln` builds from here, and the repo is clean on `feature/party-installation`.
Phase 1 (the `ApproachHsv` implementation, the guard, the debug trace, and the test
project scoped above) is the concrete next action once this document is confirmed —
same session, same context, no re-derivation. Still no code has been written; this
document remains the deliverable K. asked for before any of that starts.

### Revised phase list (plain-cost-first)

1. **Phase 1 — costs K. nothing.** Implement `ApproachHsv` + guard + Phase-1 easing
   (composed together, per above) + debug trace + the three-tier test suite (§Q3), all
   in this session, headless. No lamps, no live session, nothing for K. to do or watch.
2. **Phase 2 — costs K. one evening with the real lamps.** Same method as
   `#fade-push-rate`: freeze/A-B, one variable, K. narrates in his own words. This is
   the acceptance test — DESIGN.md's feelings-first stance means a passing unit test is
   necessary but not sufficient; only K.'s eyes close this out.
3. **Phase 3 — only if Phase 2 says it's still not right, costs another such evening.**
   Frame pacing (originally suspect #3, still the weakest of the three) is the remaining
   candidate if HSV-space easing doesn't fully resolve it.

## Open questions for K., current

1. The `ApproachHsv` per-second ceilings (hue °/sec, saturation/sec, value/sec) need
   starting numbers. I'd derive them to match today's *felt* speed at the default energy
   (0.2) as closely as possible — same visual pace, different (correct) path — rather
   than picking fresh numbers, so Phase 2 is judging the path shape, not a new speed.
   Confirm that's the right target, or say if you'd rather retune speed at the same time.
2. Confirmed: dashboard-tab idea goes on the STATE.md backlog, not into this fix. Say if
   you want it prioritized differently.
3. Phase 1 starts now, in this session, unless you'd rather review the ceilings-approach
   above first.

---

## PHASE 1 IS BUILT — 2026-07-26, `Hue program` `c9d4e40`

Recorded here so this document does not read as a pending proposal. Costs K. nothing;
it is headless and already done.

**Built as specified**, with one addition the spec did not name: `StepColor` was extracted
out of `Render` so the near-grey guard and the ceiling invariant could be tested without
constructing a whole scene. The easing and the HSV chase landed together, as §2 predicted
they should — they compose rather than compete.

**Verified:** full solution builds 0 errors (core alone 0 warnings; the 21 remaining are
pre-existing nullable warnings in Web/UI). 232 checks pass in the new
`Hue program Tests` project. Deep-House's 28 JS suites are unaffected.

**Two findings that change what Phase 2 is looking for:**

1. **A hot crossing now takes ~0.5 s where the old linear limiter did ~0.25 s.** At high
   energy the *easing* binds, not the ceiling, so `GlobalEnergy` buys less speed than it
   used to. This partly contradicts the intent that the ceilings be derived so Phase 2
   judges path shape rather than pace — that holds at rest, not when the room is pumped.
   Pinned by a test so it stays a decision. If K. reports sluggishness under load, the
   knob is `EaseRate`, not the ceilings.
2. **`Render` mutates the `LightState` objects the LAYER owns, in place.** Pre-existing
   and unchanged, but undocumented anywhere until now: real layers survive it only because
   they rewrite their `States` every `Update`. A layer that sets state once feeds the
   limiter its own output as the next target. Found by a test stub that drifted to 351°
   while chasing 240°.

**Open, and cheap:** the `HUE_TRACE_SLEW` run. One line a second saying `RATIONING` or
`headroom`. If it reports headroom at K.'s ~0.15 test energy, suspect #2 from the original
list (energy-scaled step size) is dead and the HSV path was the whole story. That is worth
knowing *before* Phase 2, because it changes how to read a "still stutters" verdict.

---

## APPENDED 2026-07-26 — the brightness-stepping bug: quantisation, and what fixes it properly

Written by Fable, same role, same evening. Colour reads fixed (`#fade-after-hsv`, above).
K., on the remaining stutter: *"first one drags a bit, stuttered when its going down in
brightness. its like step step step step instead of smooth."* K. also asked to "wrap it up
properly so we have proper smoothing" and confirmed *"it's definitely already better than
before."* This section is the design call for that; no code touched while writing it, same
discipline as the section above.

### What I read before deciding

`Models/LightState.cs`, `Services/SceneRenderer.cs` (the brightness half of `Render`, and
`Approach`), `Services/EntertainmentStreamController.cs:213`, `Services/LightController.cs`
(the non-entertainment `ILightOutput`), `Interfaces/ILightOutput.cs`, and every file a
repo-wide grep for `Brightness` surfaced across both `Hue program` and `Hue program UI` —
93 hits, most of them layer constructor parameters (`baseBrightness`, `peakBrightness`,
`minBrightness`, UI slider descriptors) that construct a `LightState` but don't read the
field back, so they're inert to this change. I did **not** trust the brief's premise that
`LightState.Brightness` is read "in many places" without checking — it isn't. The actual
reads/writes of the field itself are five: `SceneRenderer.cs` (the renderer, already the
site of the bug), `EntertainmentStreamController.cs:213`, `LightController.cs:66`,
`RainLayer.cs:108`, `MeteorLayer.cs:127`, plus one cosmetic read in `SelfTest.cs:99`.

### 1. Which fix — widen to `double`, and it's cheaper than it looks

Widen `LightState.Brightness` from `int` to `double`. Of the options on the table
(widen the type; carry a parallel double through renderer+stream; dither the rounding),
dithering is the wrong shape for this bug specifically — dithering hides quantisation by
spending temporal noise, which is a tool for a *display* that truly cannot represent more
levels (an 8-bit LED PWM channel, a printer). The Hue bridge and entertainment stream are
not that: the float precision already exists end-to-end, is generated by `Approach()` as a
`double`, and is thrown away by exactly one line (`SceneRenderer.cs:198`) for exactly one
reason (the field's declared type), then reconstructed by another line
(`EntertainmentStreamController.cs:213`) that divides back through the same lossy value.
Carrying a parallel double is the shape you reach for when the `int` has to stay for
something external — it doesn't have to here (see below) — and it would mean two brightness
values living on the same object with no compiler help keeping them in sync, a worse
invariant than the one being fixed.

**The reach is smaller than the brief assumed, and the direction of the mismatch matters:**
`LightController.cs:66` calls `.SetBrightness(state.Brightness)` against HueApi's
`UpdateLightExtensions.SetBrightness<T>(this T lightCommand, double brightness)`
(`Q42.HueApi-master/src/HueApi/Models/Requests/UpdateLightExtensions.cs:111`, validated
range 0–100, a percentage not a fraction). That parameter is already `double` — the
non-entertainment CLIP-API path has been silently widening `state.Brightness` from `int` up
to `double` this whole time and losing nothing by it. Widening the *source* field to
`double` doesn't touch this call site at all; it just means the value arriving was never
rounded down to a whole percent in the first place. The mismatch is entirely on the
*entertainment* side (`EntertainmentStreamController.cs:213`,
`lightState.Brightness / 100.0`), which is also the only path K. is actually testing on
(the whole point of `#energy-coupling` and the entertainment-stream architecture).

**The two touch points that need an explicit cast, not a design decision:**
- `RainLayer.cs:108`: `existing.Brightness >= bri` — `bri` is a locally computed `int`;
  comparing `double >= int` is a no-op, C# promotes automatically, nothing to change.
- `MeteorLayer.cs:127`: `int existing = States.TryGetValue(light, out var s) ?
  s.Brightness : 0;` — this **does** need a one-character fix (`int` → drop the explicit
  int, or cast: `(int)s.Brightness` if the local var stays `int`) since narrowing
  `double`→`int` isn't implicit in C#. One line.
- `SelfTest.cs:99`: `{s.Brightness,3}` — cosmetic column width in a debug printout; will
  show e.g. `47.3` instead of `47`. Harmless, optionally `{s.Brightness,3:F0}` if a clean
  column matters more than seeing the fractional value that this whole fix exists to keep.

No other read site exists. This is a one-field, five-site change, four of which need
nothing and the fifth needs one cast.

### 2. Does brightness also want the eased/rate-aware treatment?

**No — quantisation is the whole story here, and I'd resist bundling the easing change in.**
The Phase-1 diagnosis for colour was a *shape* problem (linear ramp, hard stop) layered on
top of a separate *path* problem (RGB chording); brightness's bug is neither of those — it's
a **precision** problem. `Approach()` (the plain scalar path brightness stayed on, correctly,
per the original decision) already decelerates into nothing special, but it was never
"sterile and sudden" for brightness the way it was for colour — K.'s own words distinguish
them: colour was *"sterile and sudden,"* brightness is *"step step step step."* A stepped
staircase and a hard-stopped ramp are different visual signatures, and the fix for one
doesn't imply the fix for the other. Once the quantisation is gone, brightness will be a
smooth `double` chasing a smooth `double` target through the same linear `Approach()` it
uses today — and a linear ramp with continuous precision reads as a fade, not a stutter. If
Phase 2 (below) says it still doesn't feel smooth once the steps are gone, *that* would be
the signal to revisit easing for brightness — but there's no reason to predict that from
the code, and bundling an untested second change into this fix would make a "still stutters"
verdict ambiguous between "quantisation wasn't the whole story" and "the easing choice was
wrong," exactly the kind of scope-creep §2 (above) warned against for a different reason.
Ship quantisation alone; let K.'s eyes decide if easing is a second bug.

### 3. The anti-strobe invariant, restated for brightness specifically

The invariant from §3 above — the energy-scaled ceiling is the outer clamp, easing strictly
inside it, by construction — is untouched by this fix and needs one addition for
brightness: **the ceiling (`briStep`, `SceneRenderer.cs:170`) and the `Approach()` clamp it
bounds are already computed and applied entirely in `double` before this bug's rounding
line ever runs.** `s.Brightness = Math.Max(0, (int)Math.Round(bri))` at `SceneRenderer.cs:198`
sits **downstream** of the safety clamp, not inside it — the quantisation was never a
loophole in the anti-strobe guarantee, it was pure information loss *after* the guarantee
had already been correctly enforced. Widening `Brightness` to `double` and removing that
rounding line doesn't touch the clamp's position in the pipeline at all; the ceiling still
governs `Approach()`'s output before anything is stored. Stated precisely: *for brightness,
the ceiling bounds units-per-second in the full-precision 0–100 space, and nothing between
the clamp and the light output may re-quantise that value — a rounding step anywhere in that
span reintroduces exactly this bug even if the clamp itself is never touched.* That's the
rule this fix establishes and the one a future refactor must not violate again.

### 4. Non-entertainment output paths

`ILightOutput` (`Interfaces/ILightOutput.cs`) has exactly two implementations: `LightController`
(CLIP API, non-entertainment, used only as the pre-streaming fallback per its own comment
`//Future: replace with EntertainmentStreamController`) and `EntertainmentStreamController`
itself. Checked above (§1): `LightController` already receives `double` at its
`HueApi` boundary, so widening the source field is neutral-to-improving there, not
neutral-to-risky. There is no third `ILightOutput` implementation in either repo (grep
confirms — `EntertainmentStreamController.cs` and `LightController.cs` are the only two
classes declaring `: Interfaces.ILightOutput` / `: ILightOutput`). This is the case where a
"simple" type change usually bites *some* caller expecting truncation-as-a-feature; it
doesn't happen here because the only caller that would notice (the CLIP path) was already
built for the wider type.

### 5. Test scope

Extend `Hue program Tests` (same style — plain console runner, no NuGet test host,
`dotnet run --project "Hue program Tests"`, 232 checks currently):

1. **`LightState.Brightness` round-trip, `double` end to end:** construct a `LightState`
   with a fractional brightness (e.g. `47.6`), run it through `SceneRenderer.Approach()` for
   N frames toward a fractional target, and assert the stored value is never silently
   rounded to a whole number at any point before the entertainment boundary.
2. **`EntertainmentStreamController.ApplyStates` precision:** a value like `47.6` reaches
   `entLight.State.SetBrightness(...)` as `0.476`, not `0.47` or `0.48` — i.e. assert the
   division uses the full double, not a value that passed through `Math.Round` first. (This
   needs either a seam to intercept the call or asserting on the pre-division value if the
   entertainment SDK object isn't easily mockable — worth a five-minute look at what
   `EntertainmentLight.State` exposes before committing to the exact assertion shape.)
3. **Regression: the ceiling still bounds brightness rate under `double`.** Same shape as
   the existing colour-ceiling tests (§Q3.1 above) — across N frames, the per-frame `Bri`
   delta never exceeds `briStep` for a range of `energy` values, now checked at
   full precision rather than post-rounding, which is a *stricter* version of the old
   guarantee (a step could previously look compliant only because rounding masked overshoot
   within ±0.5 units — this closes that gap).
4. **`RainLayer`/`MeteorLayer` brightness-comparison regression:** both layers compare a
   locally computed `int bri` against `existing.Brightness` (now `double`) to decide which
   overlapping effect wins; a one-line test per layer confirming "brighter wins" logic still
   holds with a fractional `existing.Brightness` (e.g. `49.9` should still beat a new `bri`
   of `49`, which an unguarded truncating cast could get backwards).
5. **Not in scope:** anything about `MappedLight.Brightness` or `SceneDefinition.Brightness`
   — both are separate `int` fields on separate types (a device's own reported state, and an
   author-time scene definition respectively), untouched by this bug and untouched by this
   fix. Don't let "brightness" as a grep term pull in unrelated fields.

### 6. Phasing

**Phase A — costs K. nothing.** Widen `LightState.Brightness` to `double`, remove the
`Math.Round`/int-cast at `SceneRenderer.cs:198` and `:206`, fix the one `MeteorLayer.cs:127`
cast, extend `SelfTest.cs:99`'s format string, add the five tests above. Headless, same
session, same discipline as Phase 1 above (`c9d4e40`).

**Phase B — costs K. one evening with the real lamps.** Re-run the exact fade that produced
*"step step step step"* (`controller/showreel_drag.py`'s slow-brightness-descent case),
same method as Phases 2/2 before it: freeze everything else, one variable, K. narrates in
his own words. This is the only step that closes the loop — a passing round-trip test proves
the number reaching the bridge is no longer quantised, not that the *eye* reads it as smooth.

**Phase C — only if Phase B says it still steps.** Then, and only then, revisit §2's
"no" on eased brightness — bring brightness onto the same ceiling-clamped-easing treatment
colour got in Phase 1, this time with a live verdict already in hand pointing at it rather
than a speculative bundle.

### Open questions for K.

1. Confirm the direction in §1 (widen the type) rather than dithering or a parallel double —
   say if you want the reasoning for rejecting dithering explained further; it's a real
   technique, just the wrong tool for a pipeline that already has the precision and is
   discarding it for free.
2. §2 says don't bundle brightness easing into this fix, wait for Phase B's verdict. Confirm,
   or say if you'd rather bundle it now since you're already looking at brightness and a
   second live session is the cost either way.
3. Phase A starts now, in this session, unless you want to review this section first — same
   offer as the colour fix above.
