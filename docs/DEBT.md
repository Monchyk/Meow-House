# DEBT — the backtrack ledger

_The "calculated but a bit untracked" technical debt, made trackable. K.'s ask 2026-09-10.
Not a plan (that's `ROADMAP.md`) and not "where are we" (that's `STATE.md`) — this is the
running list of things we owe the repo. Pay one down, tick it. Add a line when we take on more._

Snapshot taken 2026-09-10, `main` @ `46f0aea`.

---

## 1. Uncommitted finished work (tree is green — 42 suites pass)

A large, tested pile sits in the working tree, left uncommitted as "K.'s call." Not broken,
not half-built — just unbanked.

| Item | Files | State |
|---|---|---|
| **Fractal Dive** — 4th room game (zoom exploration) + `pad` tap-control | `web/roomgames/fractaldive.js`, `web/play.js`, `web/roomhost.js`, `web/room.html` | built, node-tested, folded into `room.test.js`/`play.test.js` |
| **Three room-game hosts** — Predict the Room · Wavelength · The Mind→Bloom | `web/roomhost.js`, `web/room.html`, `room.test.js` | built, 42 suites pass |
| **QR entrance system** | `tools/gen_qr.py`, `web/qr/*` (8 PNGs + index), `controller/serve.py` (`/lan`, dir-index, per-player lane) | built, generated for one LAN IP |
| **`title.html`** — showcase front door (menu → reaction-diffusion → maze → nucleus/flow) | `web/title.html`, `research/pics/purple green attractor.jpg` | built, self-contained, **not in INDEX.md** |

→ **Owe:** commit in clean chunks (local; push is K.'s outward step). Add `title.html` to `INDEX.md`.

## 2. Unpushed commits

`main` is **5 commits ahead of `origin/main`** (`d168354..46f0aea` — MECHANICS-MAP, ORIGINAL-INTENT,
colored-shadow rig, harmonograph+mic, session history). Pushing is K.'s call; noted so it's not lost.

## 3. Branch / merge sprawl (the untracked part)

Six local branches + one worktree. **Reconciled 2026-09-10:** `git branch --no-merged main` is
EMPTY and `git log main..<branch>` is empty for every one — i.e. **`main` contains all of them.**
The whole sprawl is safely prunable. This was cheaper debt than it looked.

| Branch | Contained in main? | Action owed |
|---|---|---|
| `docs/mechanics-map` | yes | **30-day cooling** → delete on/after 2026-10-09 (memory pin), not before |
| `feature/organisms-network` (worktree `dh-organisms-network`) | yes | `git worktree remove` first, then delete branch |
| `feature/party-organisms` | yes | delete (its own origin is behind, irrelevant — main has it) |
| `feature/colour-field` | yes | delete |
| `feature/foundation-garden` | yes (murk resolved) | delete |
| `feature/party-installation` | yes | keep for now — name-caution vs the *Hue program* repo's branch; low value to prune |

→ **Owe:** prune the four safe ones (+ the worktree), leave `mechanics-map` cooling and
`party-installation` alone. A 5-minute pass — but coordinate with the concurrent session first
(shared tree). Pushing/pruning `origin` copies is K.'s outward call.

## 4. Doc drift / staleness

- **`STATE.md` = 2363 lines.** Meant to be volatile focus+next-step; it's become an append log.
  Owe: harvest the historical dated entries into `docs/History/`, cut STATE back to the live head.
- **`docs/HUE-API.md` stale** — still lists a non-existent `/api/effects/pulse`; missing `/api/effects/field`.
  Owe: regen via `python tools/gen_light_reference.py` **with the C# app running** (can't do headless).
- **`title.html` absent from `INDEX.md`** (INDEX is meant to map every file).

## 5. Cross-repo coupling (fragile, known)

The lights depend on the separate *Hue program* repo being on `feature/party-installation`.
`/api/energy` 404 is the silent tell for the wrong branch. Not code debt we can pay here, but a
standing operational trap — documented in CLAUDE.md, restated so it stays visible.

## 6. THE PUBLIC-RELEASE BLOCKER (hard, do not touch unprompted)

Any "make it public" path is gated on `extracted/` — Secrets-derived data with **real names**,
committed since the first commit. Not a delete job: needs a `filter-repo` history rewrite +
force-push, plus auditing `web/{brain,data,guide,threads}.js`, `display.html`, `index.html` for
names. Scope with K.; never start unprompted. See `extracted/README.md` and CLAUDE.md § firewall.
