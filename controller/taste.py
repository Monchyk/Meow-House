#!/usr/bin/env python3
"""taste.py — the taste session. A/B the room, one question at a time, and write
down what K. actually said instead of what the engineer inferred.

    python controller/taste.py            # run it (needs the full stack up)
    python controller/taste.py --dry      # no room, no lamps: prints what it WOULD push
    python controller/taste.py --list     # show the pair table and where the pointer is
    python controller/taste.py --reset    # forget the resume pointer, start at pair 1

WHY THIS EXISTS. Most of the party work is headless-verified and has never been on a
screen. Every "unverified — needs a live look" in STATE.md is a decision that got made
by inference and flagged. This turns the flags into answers: it drives the real room
through serve.py's relay, asks ONE question, and appends what was said to
docs/TASTE-LOG.md so the next session acts instead of guessing again.

THE SHAPE, per Fable (the VP) and K.'s own calls:
  • Terminal, not the phone. K. types a/b/again/faster/slower/skip/?/enter.
  • A/B pairs, with transport — replay, faster, slower — because a pair that was
    missed is not a pair that was answered.
  • Scope (SCREEN / LAMPS) is announced BEFORE anything moves, so the right surface
    is being watched when it does.
  • Identical prompt wording, every single time. Novelty forces re-reading, and every
    line read is a second not spent looking at the room.
  • The log is the deliverable. This tool NEVER saves a winner into a preset or a
    default — a human decides that later, deliberately, from the log.

⚠ IT BORROWS THE ROOM AND GIVES IT BACK. Every pair writes into the live config, so
the config is captured before pair 1 and restored on exit — including on Ctrl-C and on
a crash. Leaving the room sitting in pair 12's B side would silently become the new
"default" nobody chose, which is the exact failure this whole tool exists to end.
"""

import argparse
import json
import os
import signal
import sys
import threading
import time
import urllib.error
import urllib.request

from relay_preflight import require_subscriber
from datetime import datetime
from pathlib import Path

# Windows consoles default to cp1252, which turns every ✓ · × ⚠ in this file into a
# replacement glyph. This is read in a dark room at a glance; mojibake is not cosmetic
# here. Ask for UTF-8, and if the console refuses, fall back to plain ASCII marks
# rather than printing rubbish.
try:
    sys.stdout.reconfigure(encoding="utf-8")            # py3.7+
    MARK_OK, MARK_NO, MARK_DOT, MARK_WARN, RULE = "✓", "✗", "·", "⚠", "─"
except Exception:                                       # pragma: no cover - console-dependent
    MARK_OK, MARK_NO, MARK_DOT, MARK_WARN, RULE = "ok", "XX", "-", "!", "-"

ROOT = Path(__file__).resolve().parent.parent
PAIRS_FILE = ROOT / "controller" / "taste-pairs.json"
LOG_FILE = ROOT / "docs" / "TASTE-LOG.md"
STATE_FILE = ROOT / "docs" / "taste-state.json"
# --dry rehearses the whole session, including the writing. It must never touch the
# real record while doing it: a rehearsal that appends fake answers and advances the
# pointer would corrupt the one artefact this tool exists to produce, and the fake
# entries are indistinguishable from real ones once written.
DRY_LOG = ROOT / "docs" / "TASTE-LOG.dry.md"
DRY_STATE = ROOT / "docs" / "taste-state.dry.json"


def use_dry_paths():
    global LOG_FILE, STATE_FILE
    LOG_FILE, STATE_FILE = DRY_LOG, DRY_STATE
HOST = "http://127.0.0.1:8800"
HUE = "http://127.0.0.1:5000"

HOLD_DEFAULT = 8.0
HOLD_MIN, HOLD_MAX = 2.0, 20.0
HOLD_STEP = 0.25                      # faster/slower move the hold by ±25%

# The prompt. One string, used everywhere, never reworded mid-session — see the header.
PROMPT = "  a / b / again / faster / slower / skip / ? = can't tell / enter = done > "
PROMPT_KEEP = "  k = keep / c = cut / again / faster / slower / skip / ? = can't tell / enter = done > "


# ── the wire ────────────────────────────────────────────────────────────────
class Room:
    """The running installation, over serve.py's /party relay.

    Publishing is a plain POST; the master (/party.html) applies the command and
    re-broadcasts its state. Subscribing is the same SSE stream the dashboard uses,
    and it is how we know a master is attached at all — see preflight().
    """

    def __init__(self, dry=False):
        self.dry = dry
        self.snapshot = None
        self._stop = threading.Event()
        self._thread = None
        self.pushes = []              # --dry keeps the transcript instead of sending

    def pub(self, obj):
        obj = dict(obj, **{"from": "taste"})
        self.pushes.append(obj)
        if self.dry:
            print("    [dry] " + json.dumps(obj))
            return True
        try:
            req = urllib.request.Request(
                HOST + "/party/pub", data=json.dumps(obj).encode(),
                headers={"Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(req, timeout=3).read()
            return True
        except Exception as e:
            print(f"    ! push failed: {e}")
            return False

    def cmd(self, **kw):
        kw["type"] = "cmd"
        return self.pub(kw)

    def listen(self):
        """Background SSE reader. Keeps only the latest master snapshot — this is a
        liveness probe and a config source, not a mirror; nothing here renders."""
        if self.dry:
            return

        def run():
            while not self._stop.is_set():
                try:
                    with urllib.request.urlopen(HOST + "/party/sub", timeout=30) as r:
                        for raw in r:
                            if self._stop.is_set():
                                return
                            line = raw.decode("utf-8", "replace").strip()
                            if not line.startswith("data: "):
                                continue
                            try:
                                m = json.loads(line[6:])
                            except json.JSONDecodeError:
                                continue
                            if m.get("from") == "master" and m.get("type") == "state":
                                self.snapshot = m.get("snap")
                except Exception:
                    if self._stop.is_set():
                        return
                    time.sleep(1)      # the stream died; retry until preflight gives up

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def close(self):
        self._stop.set()

    def wait_for_master(self, seconds=6.0):
        """Ask, then wait. A reply IS proof a master is attached; silence is proof it
        is not. (There is no timestamp in snapshot() to test for freshness, so the
        handshake is the honest check rather than a guess at staleness.)"""
        if self.dry:
            return True
        self.snapshot = None
        deadline = time.time() + seconds
        while time.time() < deadline:
            self.pub({"type": "hello"})
            for _ in range(10):
                if self.snapshot:
                    return True
                time.sleep(0.2)
        return False


# ── pre-flight ──────────────────────────────────────────────────────────────
def http_status(url, timeout=2.5):
    """Status code, or None if nothing answered. A 404 and a dead port mean very
    different things here — see the /api/energy check in preflight()."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return None, str(e)


def http_ok(url, timeout=2.5):
    try:
        urllib.request.urlopen(url, timeout=timeout).read(1)
        return True
    except urllib.error.HTTPError:
        return True                    # it answered; a 404 still proves something is there
    except Exception:
        return False


def preflight(room):
    """Four checks. Fail loud, name the fix, exit. No 'continue anyway' — an answer
    given to a room that was not actually running is worse than no answer, because it
    goes in the log looking exactly like a real one."""
    print("\n  PRE-FLIGHT")
    if room.dry:
        print("    --dry: skipped (no room is being driven)")
        return True

    ok = True

    if http_ok(HUE + "/api/effects"):
        print(f"    {MARK_OK} Hue app answering on :5000")
    else:
        print(f"    {MARK_NO} Hue app NOT answering on :5000")
        print("      fix: start the C# app in the 'Hue program' repo")
        ok = False

    # THE CHECK THAT ACTUALLY CATCHES THE WRONG BRANCH — added 2026-07-25 after the
    # first live pre-flight passed on a room whose lamps were not responding at all.
    #
    # /api/effects and /api/effects/params exist on feature/transient-effects too, so
    # probing those proves nothing. `/api/energy` exists ONLY on the party branch
    # (feature/party-installation), and it is the endpoint party-main.js pushes on
    # every business change — the entire business→brightness coupling. Without it the
    # lamps still take colour and still look alive, while GlobalEnergy never moves.
    # That is the exact shape of failure that produces a full log of lamp answers
    # about a room that was not actually reacting.
    s, _ = http_status(HUE + "/api/energy")
    if s == 404:
        print(f"    {MARK_NO} /api/energy is MISSING — the Hue app is on the WRONG BRANCH")
        print("      every lamp answer tonight would be about a room whose energy never moves")
        print("      fix: in the 'Hue program' repo — git checkout feature/party-installation,")
        print("           rebuild, restart. (feature/transient-effects is 3 commits behind and")
        print("           has neither the backstop nor the live-tune path.)")
        ok = False
    elif s is None:
        print(f"    {MARK_NO} /api/energy unreachable — is the Hue app still running?")
        ok = False
    else:
        print(f"    {MARK_OK} /api/energy answering — the party build is running")

    if http_ok(HOST + "/"):
        print(f"    {MARK_OK} serve.py answering on :8800")
    else:
        print(f"    {MARK_NO} serve.py NOT answering on :8800")
        print("      fix: python controller/serve.py")
        return False                   # nothing else can be checked without the relay

    if room.wait_for_master():
        print(f"    {MARK_OK} a master is attached (party.html replied)")
    else:
        print(f"    {MARK_NO} no master on the relay - nothing is driving the room")
        print("      fix: open http://localhost:8800/party.html on the TV, then re-run")
        ok = False

    snap = room.snapshot or {}
    lights = snap.get("lights") or []
    if lights:
        print(f"    {MARK_DOT} {len(lights)} light entries in the catalog")
    # Non-blocking, and named rather than counted: these five are known-unmapped, and
    # any question about WHERE colour is in the room is meaningless for them.
    print(f"      {MARK_DOT} known-unmapped fixtures (positional questions do not apply to these):")
    print("        Staanlamp / Lightstrip Bed / Hue ambiance lamp 1 / Toog / On/Off plug 1")

    return ok


# ── the log ─────────────────────────────────────────────────────────────────
def log_append(entry):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not LOG_FILE.exists():
        LOG_FILE.write_text(LOG_HEADER, encoding="utf-8")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(entry)


LOG_HEADER = """# TASTE LOG — what K. actually said

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

"""


def entry_text(pair, side_or_item, answer, reached, session_pos, total, note=None):
    when = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [f"\n## {when} · #{pair['id']} [{pair['scope']}]\n"]
    lines.append(f"- Question: {pair['question']}\n")
    if pair.get("kind") == "pair":
        for s in pair["sides"]:
            lines.append(f"- {s['label']}: {s['name']} — `{json.dumps(s.get('config', {}))}`\n")
    else:
        lines.append(f"- Item: {side_or_item.get('name')} — "
                     f"`{json.dumps({k: v for k, v in side_or_item.items() if k != 'name'})}`\n")
    lines.append(f"- **Answer: {answer}**\n")
    lines.append(f"- Reached: {reached}\n")
    if pair.get("cost"):
        lines.append(f"- Cost was named before the look: yes\n")
    if note:
        lines.append(f"- Note: {note}\n")
    lines.append(f"- Unblocks: {pair.get('unblocks', '—')}\n")
    # Answer number, not just group number: a keep/cut group is six asks, and "6th
    # thing looked at tonight" is the fatigue signal, while "group 6" is not.
    lines.append(f"- Session: answer #{session_pos}, group {total}\n")
    return "".join(lines)


def state_load():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"next": 0, "answered": 0}


def state_save(st):
    # Flushed after EVERY answer, not at exit. A crash that loses the pointer forces
    # re-asking, and a re-asked question gets a tireder answer that overwrites a better
    # one — the pointer is cheap, the second answer is not.
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=2), encoding="utf-8")
    os.replace(tmp, STATE_FILE)


# ── driving ─────────────────────────────────────────────────────────────────
def apply_baseline(room, base):
    """One known state, every session. Every pair is a departure from THIS, not from
    wherever the last experiment left the room."""
    room.cmd(cmd="resetConfig")
    if base.get("config"):
        room.cmd(cmd="setConfigMany", values=base["config"])
    room.cmd(cmd="auto", value=bool(base.get("auto")))
    room.cmd(cmd="business", value=base.get("business", 0.45))
    room.cmd(cmd="setConfigMany", values={"overlapMode": base.get("overlapMode", 0)})
    room.cmd(cmd="zoom")                                   # hand the dive back to the pendulum
    if base.get("spiral"):
        room.cmd(cmd="setActive", mode="spiral", id=base["spiral"])
    if base.get("light"):
        room.cmd(cmd="setActive", mode="light", id=base["light"])


def push_side(room, pair, side, base):
    if side.get("config"):
        room.cmd(cmd="setConfigMany", values=side["config"])
    if side.get("preset"):
        room.cmd(cmd="preset", id=side["preset"])
    if side.get("spiral"):
        room.cmd(cmd="setActive", mode="spiral", id=side["spiral"])
    if side.get("light"):
        room.cmd(cmd="setActive", mode="light", id=side["light"])
    if side.get("then") == "cycleLight":
        room.cmd(cmd="cycle")          # force the scene change the question is about


def ask(room, pair, hold, session_pos, total, base, print_header=True,
        group_pos=None, group_total=None):
    """One question. Returns (answer, reached, hold) — or (None, ...) to stop for the
    night. Every branch that ends in an answer writes to the log before returning.

    print_header=False skips the group header (question/watch/note/COST) — used for
    items 2..N of a keep/cut group, so a 6-item group doesn't reprint the same three
    lines six times. group_pos/group_total, when given, print "item i of n" instead
    of the outer session position, since that is the number that matters within a
    keep/cut group."""
    keepcut = pair.get("kind") == "keepcut"
    items = pair.get("items") if keepcut else pair.get("sides")

    if print_header:
        print(f"\n  ── {session_pos}/{total} · [{pair['scope']}] {pair['question']}")
        print(f"     watch: {pair.get('watch', '—')}")
        if pair.get("note"):
            print(f"     note: {pair['note']}")
        if pair.get("cost"):
            print(f"     COST: {pair['cost']}")
    elif group_pos is not None:
        print(f"\n  ── item {group_pos}/{group_total}")

    replays, slowed = 0, False

    while True:
        for it in items:
            label = it.get("label", "")
            name = it.get("name", "")
            print(f"     {('  ' + label + ':') if label else '   ' + MARK_DOT} {name}")
            push_side(room, pair, it, base)
            if not room.dry:
                time.sleep(hold)

        try:
            raw = input(PROMPT_KEEP if keepcut else PROMPT).strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return None, None, hold

        reached = ("first look" if replays == 0 and not slowed
                   else f"after {replays} replay(s)" + (" and a slowdown" if slowed else ""))

        # Tolerant match for the no-signal answer: case is already folded above (.lower()),
        # this also drops apostrophes and spaces so "Can't Tell", "cant tell", "can't  tell"
        # all land on the same fact. Only used for this one comparison — every other branch
        # still matches the raw input, so it can't accidentally swallow other commands.
        raw_compact = raw.replace("'", "").replace(" ", "")

        if raw == "":
            return None, None, hold
        if raw in ("again", "replay", "r"):
            replays += 1
            continue
        if raw in ("faster", "f"):
            hold = max(HOLD_MIN, hold * (1 - HOLD_STEP)); slowed = True
            print(f"    {MARK_DOT} hold {hold:.1f}s")
            continue
        if raw in ("slower", "s"):
            hold = min(HOLD_MAX, hold * (1 + HOLD_STEP)); slowed = True
            print(f"    {MARK_DOT} hold {hold:.1f}s")
            continue
        if raw == "skip":
            return ("skipped", reached, hold)
        if raw == "?" or raw_compact in ("canttell", "noidea", "dunno", "unsure"):
            # Distinct from skip on purpose: "I looked and I cannot tell" is a fact
            # about the effect. "I do not care" is a fact about the question.
            return ("no signal — looked, could not tell", reached, hold)
        if keepcut and raw in ("k", "keep"):
            return ("KEEP", reached, hold)
        if keepcut and raw in ("c", "cut"):
            return ("CUT", reached, hold)
        if not keepcut and raw in ("a", "b"):
            side = [s for s in items if s.get("label", "").lower() == raw][0]
            return (f"{side['label']} — {side['name']}", reached, hold)
        print(f"    {MARK_DOT} not one of those")


def run(room, table, night, hold):
    base = table["baseline"]
    pairs = [p for p in table["pairs"] if (p.get("night", 1) <= night)]
    st = state_load()
    idx = min(st.get("next", 0), len(pairs))
    if idx:
        print(f"\n  resuming at pair {idx + 1} — {st.get('answered', 0)} answered so far")

    print("\n  taking the room to a known state…")
    apply_baseline(room, base)
    if not room.dry:
        time.sleep(1.0)

    total = len(pairs)
    started = time.time()

    while idx < total:
        pair = pairs[idx]
        keepcut = pair.get("kind") == "keepcut"

        if keepcut:
            # One item at a time. NOT forced into A/B: a tap between exhibit #14 and
            # #22 says nothing about a pool of 38, and the false precision would look
            # exactly like a real answer in the log.
            n_items = len(pair["items"])
            for i, it in enumerate(pair["items"]):
                one = dict(pair, items=[it])
                answer, reached, hold = ask(
                    room, one, hold, idx + 1, total, base,
                    print_header=(i == 0), group_pos=i + 1, group_total=n_items)
                if answer is None:
                    return st, hold, started
                st["answered"] = st.get("answered", 0) + 1
                log_append(entry_text(pair, it, answer, reached,
                                      st["answered"], f"{idx + 1} of {total}"))
                state_save(st)
        else:
            answer, reached, hold = ask(room, pair, hold, idx + 1, total, base)
            if answer is None:
                return st, hold, started
            st["answered"] = st.get("answered", 0) + 1
            log_append(entry_text(pair, None, answer, reached,
                                  st["answered"], f"{idx + 1} of {total}"))

        idx += 1
        st["next"] = idx
        state_save(st)
        mins = (time.time() - started) / 60
        print(f"    {MARK_DOT} logged. {st['answered']} answered {MARK_DOT} {mins:.0f} min elapsed")

    return st, hold, started


def main():
    ap = argparse.ArgumentParser(description="A/B the room and write down what K. said.")
    ap.add_argument("--dry", action="store_true", help="no room: print what it would push")
    ap.add_argument("--list", action="store_true", help="show the pair table and the pointer")
    ap.add_argument("--reset", action="store_true", help="forget the resume pointer")
    ap.add_argument("--night", type=int, default=1, help="1 = tonight's ranking, 2 = the overflow set")
    ap.add_argument("--hold", type=float, default=HOLD_DEFAULT, help="seconds per side to start with")
    a = ap.parse_args()

    table = json.loads(PAIRS_FILE.read_text(encoding="utf-8"))

    # Empty-relay guard. Skipped for the modes that never touch the room (--dry prints,
    # --list/--reset are bookkeeping); an A/B session against 0 subscribers would record
    # K.'s verdicts about a room that never changed. See relay_preflight.py.
    if not (a.dry or a.list or a.reset) and not require_subscriber("taste"):
        sys.exit(1)


    if a.reset:
        if a.dry:
            use_dry_paths()
        state_save({"next": 0, "answered": 0})
        print("pointer reset — next run starts at pair 1")
        return 0

    if a.list:
        st = state_load()
        print(f"\n  pointer: next = pair {st.get('next', 0) + 1}, {st.get('answered', 0)} answered\n")
        for i, p in enumerate(table["pairs"]):
            n = len(p.get("items", p.get("sides", [])))
            print(f"  {i + 1}. [{p['scope']:6}] {p['id']:22} "
                  f"{'keep/cut x ' + str(n) if p.get('kind') == 'keepcut' else 'A/B'}"
                  f"{'  (night 2)' if p.get('night', 1) > 1 else ''}")
            print(f"      {p['question']}")
        return 0

    if a.dry:
        use_dry_paths()
        print("\n  --dry: the room is not touched, and the log/pointer used are the")
        print("         .dry.* rehearsal copies. The real record is left alone.")

    room = Room(dry=a.dry)
    room.listen()

    if not preflight(room):
        print("\n  stopping. Fix the above and re-run — it will resume where it left off.\n")
        room.close()
        return 1

    saved = None
    if not a.dry and room.snapshot:
        saved = dict(room.snapshot.get("config") or {})

    def restore():
        # The room is borrowed, not taken. Runs on clean exit, on enter-to-stop, and
        # on Ctrl-C — leaving it in the last pair's B side would quietly become a
        # default nobody chose.
        if saved:
            print("  putting the room back where it was…")
            room.cmd(cmd="setConfigMany", values=saved)
        room.close()

    def on_sigint(*_):
        print("\n  stopped.")
        restore()
        sys.exit(0)

    signal.signal(signal.SIGINT, on_sigint)

    print("\n  " + RULE * 62)
    print("  TASTE SESSION — one question at a time. Watch the room, not this window.")
    print("  Answers go to docs/TASTE-LOG.md. Nothing is saved as a default.")
    print("  Enter on its own stops for the night and keeps your place.")
    print("  " + RULE * 62)

    try:
        st, hold, started = run(room, table, a.night, a.hold)
    finally:
        restore()

    mins = (time.time() - started) / 60
    print(f"\n  done for now — {st.get('answered', 0)} answered in {mins:.0f} min.")
    print(f"  log: {LOG_FILE.relative_to(ROOT).as_posix()}   {MARK_DOT}   "
          f"resume: python controller/taste.py\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
