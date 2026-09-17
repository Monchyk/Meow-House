# THE TASTE SESSION — how to ask K. and keep the answer

The room got built faster than it got looked at. Most of the party is headless-verified
and was never on a screen, so decision after decision got made by inference and marked
"unverified — needs a live look". This is the machinery for turning those into answers,
and the record of which ones have been answered.

**Read `docs/TASTE-LOG.md` for the answers. This file is how to get more of them.**

---

## 1. The three ways to ask, and when each one is right

| | what it is | use it when |
|---|---|---|
| **Conversation** (default) | Claude drives the room directly and K. answers in his own words | almost always — it is the only one that catches *"and what I would add is…"* |
| `controller/bench.py` | a clean room: field frozen, blackout between sides, one variable | the room's own motion makes the question unanswerable |
| `controller/taste.py` | the scripted A/B runner, ranked pairs, writes the log itself | unattended-ish runs, or when the ranking matters more than the conversation |

**K. stopped the script mid-session on 2026-07-25** — *"this is not very user friendly.
think its even bugged? i thought WE were going to talk. not talk to some python script
lol."* He was right: the two Ulam feature requests that came out of the conversational
half could not have been collected by any menu. The script survives because the ranking
and the exact A/B states in `controller/taste-pairs.json` are the paper trail, and
because it writes a well-formed log entry without being asked.

## 2. Before any of it — the stack

```
1. C# Hue app          :5000   MUST be on feature/party-installation
2. python controller/serve.py  :8800
3. /party.html open on the TV  (hard-reload it after any web/ change)
```

`controller/taste.py` pre-flights all of this and refuses to start otherwise. **The check
that matters is `/api/energy`** — it exists only on `feature/party-installation`, and on
any older branch the lamps still take colour and still look alive while the entire
business→brightness coupling is silently dead. That cost most of an evening on
2026-07-25. See `CLAUDE.md`.

**Step 3 is now enforced too, not just documented** (added 2026-08-06). `serve.py` exposes
`GET /party/stat` → `{"subscribers": N}`, and `controller/relay_preflight.py`'s
`require_subscriber()` is called by **`showreel.py`, `showreel_drag.py` and `taste.py`**
before any of them borrows the room. With `/party.html` closed, `/party/pub` still answers
**204** — so a whole session runs, reports nothing wrong, and drives nothing. That is exactly
what happened on **2026-07-28**: a full lamp session against an empty relay, slate white and
flat, and the null result was indistinguishable from "the fade fix didn't work."

Two deliberate design choices in that guard, both to keep it from being deleted later:
it refuses **only on a definite `0`**, and if `/party/stat` itself is missing or unreachable
(an older relay) it **warns and proceeds** rather than blocking a working setup. Modes that
never touch the room — `taste.py --dry`, `--list`, `--reset` — skip it. Check by hand with
`curl http://127.0.0.1:8800/party/stat`.

## 3. The bench — `controller/bench.py`

Born from K.: *"its hard to say considering that the lights keep changing colour of
themselves anyway no? … we need a proper clean testing environment. where the lights
also get turned off and on for the sequence."*

```
python controller/bench.py off                # blackout
python controller/bench.py flat               # frozen reference field
python controller/bench.py energy 0.15 0.95   # dark, A, dark, B
python controller/bench.py alt 0.15 0.95 30   # A,B,A,B for 30s — is the STEP visible
python controller/bench.py param flowIntensity 0.0 0.9
python controller/bench.py restore            # hand the lamps back to the party
```

It freezes the Superfluid layer (flow, drift and per-lamp breathing to zero), blacks out
between sides so the eye has a fixed reference, and stays out of the browser's way —
`party-main.js` only pushes when something *changes*, so with business held still the
bench owns the lamps.

⚠ **It is an instrument, not a look.** A frozen Superfluid is the opposite of the design.
Always `restore` when finished.

⚠ `speed` is declared 0.05–3 and `/api/effects/params` **silently ignores out-of-range
values while answering `softUpdate:true`** — send 0 and the tide keeps running while the
bench reports success. Every value the bench sends is inside its declared range on
purpose.

## 4. What has been answered

Twelve answers so far, all in `docs/TASTE-LOG.md` with how they were reached. The load-
bearing ones:

- **The dive: UNIFORM**, not the lens that currently ships as default.
- **Colour spread: rich (0.55)** — confirms the change made the same day.
- **Newton: CUT.**
- **Overlap: PERSISTENT**, first look, no hesitation.
- **Keep: Moiré, Cellular automaton, Game of Life, Ulam.** Mandelbrot and Julia: skipped.
- **The energy coupling is alive** — B at 0.95 significantly brighter than A at 0.15.
- **The scene fade glides but stutters** at its current ~3 Hz push rate.

---

## 5. ⚠ ANSWERS THAT ARE NOT YET CODE

**This is the most important section in this file.** An answer that never became a
default is worse than no answer — it looks settled in the log and behaves the old way in
the room.

| answered | the room still does | what applying it means |
|---|---|---|
| dive = uniform | `zoomMode: 0` (lens) is the default in `party.js` | flip the default; §21's lens rework was rejected on sight |
| Newton = cut | still in the catalog, still picked by attract | `off` it, or drop it from the pool |
| overlap = persistent | `overlapMode: 0` (off) is the default | default to 2 — and watch cost, it roughly doubles render |
| fade stutters at 3 Hz | `party-main.js` still throttles to 320 ms mid-fade | raise the rate, or find the knee — see §6 |

None of these were applied during the session on purpose: `taste.py` never writes a
winner into a default, and the conversational half kept the same rule. **A human decides,
deliberately, from the log.** That human has not decided yet.

## 6. Requested and NOT built

Everything K. asked for that has no code behind it yet, newest first.

1. **The fade stutter.** K.: *"they glide but at a bit of a low fps it seems. bit of a
   stutter."* Diagnosed to `party-main.js`'s mid-fade throttle (`now - lastPalettePush <
   320`, so ~3 Hz), whose comment claims *"~3Hz is plenty for an 8s glide and the C#
   layer interpolates anyway"* — K.'s eyes say otherwise. A 3 Hz vs 12 Hz comparison was
   run live; ~~**the verdict on 12 Hz was never given.**~~ **COLLECTED 2026-07-26 — see
   `docs/TASTE-LOG.md` `#fade-push-rate`. No difference; both stutter. The JS side is
   exonerated and the fix belongs to the Hue repo** (`SceneRenderer.Approach` is a linear
   ramp with a hard arrival — suspects listed in the log entry). `320` was a hardcoded
   literal, which is why this died the first time; it is now `config.palettePushHz`.
2. **The two colour motions fighting.** K.: *"its own hue drift is pulling one way while
   the fade pulls another, the lights suddenly change state rather than flows into."*
   Half-diagnosed: the engine glides correctly (155 distinct palettes across an 8 s fade)
   and `party-main` pushes the eased value, so the JS chain is clean. What is left is the
   push rate (above) and the C# layer's own `colorDrift` continuing during the fade.
   §8.0 Q6 is **still open** — its log entry is marked invalid, see §7.
3. **The serpent's numbers.** Built for Ulam, **never seen**: speed ~7 primes/s and an
   18-segment tail are both guesses. Two one-number changes once K. looks.
4. **The accent question cannot be asked.** The accent now appears in the ambient ramp
   (2026-07-25), reversing a deliberate earlier decision, and there is **no runtime flag
   to turn it back off** — so there is no B side to show. It needs a config toggle before
   it can be put to K. properly, and it deserves to be.
5. **Attract dwell (§8.0 Q3)** — 25–45 s is randomised per cycle and is not a config key,
   so it cannot be A/B'd. Needs either a knob or a skip-based audition mode.
6. **Night two of the pair table** — the 8 nucleus snap points and the 7 colour cards are
   written, ranked and untouched. `python controller/taste.py --night 2`.
7. **§8.0 Q9 and Q10** (are 31 sliders too many; which LFO patches to keep) are
   deliberately outside this tool — both need K. operating the dashboard, not watching a
   driven pair. Still open, still worth an evening.
8. **The master tempo's number.** From the other session, same night: `bpm: 48` is a
   considered guess. It is one value in one place and finding it is the whole point of
   the dial. Also open there: should attract mode drift the tempo per cycle?
9. ~~**`bench.py` has no tests and is not in `INDEX.md` or the README.**~~ **Half done
   2026-07-26:** `INDEX.md` had already gained both tools from another session, and the
   README now has a "Looking at the room deliberately" section covering both, plus the
   `HUE_TRACE_SLEW` flag. Findability is closed. **Still open: neither tool has tests** —
   they drive the live room, so testing them means faking the relay.

## 7. Corrections to the log itself

- The **`#palette-fade-mud`** entry (2026-07-25 20:43, logged `skipped`) is **invalid on
  two counts**: it ran while the Hue app was on the wrong branch, so the lamps were not
  coupled at all, and K. actually typed `can't tell` — which `taste.py` rejected at the
  time, so a genuine no-signal was recorded as a skip. Both are fixed; the question must
  be re-asked from scratch.
- `taste.py`'s resume pointer (`docs/taste-state.json`) still points at group 5. The
  conversational session continued past it by hand, so **the pointer under-counts**.
  Re-run with `--reset` if the script is used again, and re-ask deliberately rather than
  trusting it.

---

## 8. COLD START — the live-session facts that are not in any diff

Written 2026-07-26 at the end of a live session. These are things a fresh session cannot
learn by reading code, and would otherwise re-derive the hard way.

**The stack, as left running.** Hue app on `feature/party-installation` (K. switched it
mid-session; `/api/energy` answers 200 — verified, not assumed). `serve.py` on :8800.
`/party.html` open on the TV with attract mode ON — a reload resets it to attract, which
is why questions kept getting interrupted by the room wandering off. Turn it off before
asking anything: `{"cmd":"auto","value":false}` to `/party/pub`.

**The TV can be running stale JS and look fine.** Count presets in the snapshot: 13 means
it loaded before the nucleus snap points, 21 means current. `party.js` changes need a
hard reload of `/party.html`, not the dashboard — the dashboard is a thin client and
reloading it changes nothing.

**Driving the room from a script is three lines.** POST `{"type":"cmd","cmd":...}` to
`http://127.0.0.1:8800/party/pub`; subscribe to `/party/sub` for state. Publishing
`{"type":"hello"}` and waiting for a `from:"master"` reply is the only honest liveness
check — `snapshot()` carries no timestamp, so "is the state fresh" cannot be asked.
`controller/bench.py` and `taste.py` both do this; copy from them rather than re-deriving.

**Manual scene picks SNAP; only attract-mode picks fade.** `_palFade` is set in
`_autoPick` and consumed by `_palTick`. Testing the colour fade with `setActive` shows
nothing and looks like a bug in the fade. Use attract + `skip`.

**What was measured about the fade, so it need not be re-measured:** the engine glides
correctly — 155 distinct palettes across an 8 s fade — and `party-main.js` pushes the
eased value, so the JS chain is clean end to end. The stutter K. saw is the ~3 Hz
mid-fade throttle, the C# slew limiter, or both. A 3 Hz vs 12 Hz live comparison was run
and **the verdict was never collected**; that one answer decides which repo the fix is in.

**Ask K. directly.** He stopped the scripted runner mid-session. Conversation collects
things a menu cannot — the two Ulam feature requests both arrived as asides after a
keep/cut answer. When something "can't be judged", **suspect the instrument before the
eye**: three of the four failed attempts at the energy question were the measurement, not
the observer.

## 9. Other sessions are working in this tree

As of 2026-07-26 at least three threads have edited this repo on the same day, and
`party.js`, `symmetry.js` and `dashboard.js` each carry more than one session's work:

- **the master tempo** — `config.bpm`, `PARTY.tempo()`, `tempo.test.js`, `PARTY-BRIEF §22`
- **presets / colour / the taste tooling** — this thread
- **a stocktake** — the "STOCKTAKE 2026-07-26" block at the top of `STATE.md`

**Rules that follow from that, for any session picking this up:**

1. **`git status` before assuming anything.** The tree is large and uncommitted, and a
   file you are about to edit may hold work you did not write and cannot see in the log.
2. **Run the suite before AND after.** 26 suites as of this writing. If it is not 26,
   someone landed something — find out what before adding to it.
3. **Add to `STATE.md`, never rewrite it.** Its sections are other people's handoffs.
   The same goes for `docs/TASTE-LOG.md`: strike entries with a note, never delete them.
4. **A failing test may be a decision, not a regression.** `spread.test.js` §4 was
   reversed on purpose and says so; `zoom.test.js`'s opt-out count changed because K.
   asked for it live. Read the comment before "fixing" the test.
5. **Do not apply the answers in §5 casually.** They are four one-line changes and they
   change what the room *is*. They are K.'s to take, deliberately.

## 10. For the next commits

The working tree holds **two sessions' work interleaved in the same files** (`party.js`,
`symmetry.js`, `dashboard.js`), so committing by file will not separate them. Suggested
grouping, and the reason each is its own commit:

1. **`presets: the desk gets set-and-forget buttons`** — the room/spiral/nucleus preset
   families, randomise-all, per-section factory reset, save-section. `party.js`,
   `dashboard.{js,html}`, `presets.test.js`, `reset.test.js`.
2. **`colour: every exhibit polychrome, and the accent joins the ramp`** — the ramp now
   visits all 4–5 roles, 18 single-colour exhibits converted, `colorSpread*` config,
   `rampLUT`. `symmetry.js`, `dashboard.js`, `spread.test.js`. **Its message must say
   `spread.test.js` §4 was reversed on purpose** — it used to assert the accent never
   reaches the ambient ramp, and that assertion was the bug.
3. **`tempo: one dial the whole room runs on`** — the other session's BPM work.
   `party.js`, `party-main.js`, `symmetry.js`, `dashboard.js`, `tempo.test.js`,
   `cards.test.js`, `PARTY-BRIEF.md §22`. Already written up; commit as its own thing.
4. **`taste: ask K. instead of guessing`** — `taste.py`, `taste-pairs.json`, `bench.py`,
   `TASTE-LOG.md`, `taste.test.js`, this file.
5. **`docs: the Hue app branch was wrong in five places`** — `CLAUDE.md`, `LEARN.md`,
   `docs/LIGHTING.md`, `docs/HUE-API.md`, `docs/SUPERFLUID.md`. Worth its own commit and
   its own message: the wrong branch answers normally, the lamps still take colour, and
   only `/api/energy` 404s — which is why it survived so long.
6. **Ulam** (`noZoom` + the serpent, `symmetry.js`, `zoom.test.js`) can ride with (2) or
   stand alone; it came from K. live and the message should quote him.

**Do not commit:** ~~fade.tmp.json (scratch from the fade diagnosis — delete it)~~ — gone; not present in the tree as of 2026-07-26, no action needed.
`docs/TASTE-LOG.dry.md` and `docs/taste-state.dry.json` are already gitignored.

**Before any of it:** `node tools/party-tests/run.js` → 26 suites. And note that
`STATE.md` carries both sessions' entries already, so it belongs in whichever commit
lands last rather than being split.

## 11. ~~⚠ A HUE APP RESTART SILENTLY KILLS THE ROOM~~ — FIXED 2026-07-26

**Fixed the same day it was found.** Both halves: `/api/effects/params` now reports
whether it actually patched a layer (it answered `softUpdate:true` unconditionally, which
is why the client could never detect this), and `party-main.js` drops the `started` latch
and rebuilds the ambient when it sees a `false`. The diagnosis below is kept because the
failure mode is worth recognising anywhere else it appears: **everything answers 200, the
HUD stays green, and the room is dead.**

### the original entry

`party-main.js` creates the Superfluid ambient exactly once, behind a latch:

```js
var started = false;                 // :76
if (!started) { started = true; window.Hue.runEffect({...}); return; }   // :109
```

`started` is set once and **never reset — there is no other reference to it in the file**
(verified, not assumed). Every subsequent push is `runEffectParams`, which *patches a
running `ILiveTunable` layer* and does nothing at all when no layer exists.

So: **restart the C# app while `/party.html` stays open and the room never comes back.**
The browser keeps happily POSTing energy and params, every call answers 200, the HUD shows
a healthy connection — and no lamp ever lights, because nothing ever re-issues
`/effects/run`. Only a hard reload of `/party.html` fixes it.

This is the same failure family as the branch trap in `CLAUDE.md`: everything answers,
nothing is wrong on the wire, and the room is simply dead. It cost most of an attempt at
a lamp session today.

**The fix is small and nobody should build it blind:** either reset `started` when
`Hue.online` goes false→true, or make the push path re-issue `runEffect` when
`/effects/params` reports that it patched nothing. The second is better — it keys off what
actually happened rather than off a guess about connectivity — but `/effects/params`
answers `softUpdate:true` fairly indiscriminately, so **check what it really returns with
no layer running before relying on it.**

### And a second thing, for anyone driving the lamps from a script

`dotnet run` on the Web project **starts the HTTP API but does not connect to the bridge.**
The app answers `/api/effects` with 200, accepts `/api/effects/run` with 200, and drives
nothing — the startup log has zero mentions of entertainment streaming. The lamps sit on
whatever state the bridge was last left in, which reads exactly like "the effect isn't
working". Start the app the way K. normally does. **Confirmed the hard way: a whole
scripted showreel ran against a room that was never connected.**
