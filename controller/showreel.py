#!/usr/bin/env python3
"""showreel.py — drive the room through a running order so K. can judge the fade
fix in one sitting, without operating anything.

Four items, 30 s each, 5 s of BLACK between them. The blackout is not decoration:
two lit states back to back is the hardest possible comparison, and dark-A-dark-B
is the easiest (the reason bench.py blacks out too).

**Interactive by default.** A menu picks any item, replays the one just shown, or
runs the whole reel — because the reel's own answer is usually "show me item 4
again", and sitting through 2m20s to reach it is how a look gets skipped. Ctrl-C
during an item stops that item and returns to the menu; Ctrl-C at the menu quits
and hands the room back. `--all` runs the fixed reel start-to-finish and exits,
which is the old behaviour and what a script should use.

Every item drives the REAL chain — party.js eases the palette, party-main.js pushes
it, the C# slew limiter conditions it. Driving /api/effects/params directly would
test a different path than the one K. complained about.

It borrows the room: the room is handed back on exit, Ctrl-C included. It never
writes a winner anywhere.
"""

import json
import sys
import time
import urllib.request

from relay_preflight import require_subscriber

PUB = "http://127.0.0.1:8800/party/pub"
API = "http://127.0.0.1:5000/api"
HOLD = 30.0
DARK = 5.0


def post(obj):
    body = json.dumps(obj).encode()
    req = urllib.request.Request(PUB, data=body, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=3).read()
    except Exception as e:
        print(f"  ! {e}", file=sys.stderr)


def cmd(**kw):
    kw["type"] = "cmd"
    kw["from"] = "showreel"
    post(kw)


def setcfg(**kw):
    cmd(cmd="setConfigMany", values=kw)


def api(path):
    req = urllib.request.Request(API + path, data=b"", headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=3).read()
    except Exception as e:
        print(f"  ! {e}", file=sys.stderr)


def params(**kw):
    body = json.dumps({"Params": {k: str(v) for k, v in kw.items()}}).encode()
    req = urllib.request.Request(API + "/effects/params", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=3).read()
    except Exception as e:
        print(f"  ! {e}", file=sys.stderr)


def slate(n):
    """N white blinks at 40% to announce item N — a clapperboard, not a strobe.

    Deliberately SLOW. Brightness runs through the same slew limiter as everything
    else (~98 units/sec at rest), so a sharp flash is not physically available and
    trying to force one would be fighting the anti-strobe guard we are here to judge.
    ~0.5s on, ~0.45s off is unmistakably countable, which is the actual requirement.
    """
    print(f"   [slate: {n}]")
    params(color="FFFFFF", palette="FFFFFF", colorDrift=0, flowIntensity=0, brightBand=0)
    time.sleep(0.6)
    for _ in range(n):
        api("/brightness/0.40")
        time.sleep(0.55)
        api("/brightness/0.0")
        time.sleep(0.45)
    api("/brightness/1.0")
    time.sleep(0.8)


def ensure_ambient():
    """Create the Superfluid layer directly, because the browser may refuse to.

    party-main.js creates it ONCE behind a `started` latch that is never reset, so
    after any Hue-app restart the open /party.html never re-issues /effects/run —
    every later push is /effects/params, which patches a RUNNING layer and silently
    does nothing when none exists. The room then stays dark while every call answers
    200. See docs/TASTE-SESSION.md §11. This makes the reel independent of that.
    """
    body = json.dumps({"AmbientType": "Superfluid", "AmbientParams": {
        "color": "3AA0FF", "palette": "3AA0FF,7B5CFF,FF4FA3,7B5CFF",
        "speed": "0.12", "spread": "0.60", "flowIntensity": "0.75",
        "colorSpan": "1.0", "colorDrift": "0.02", "brightBand": "0.30"}}).encode()
    req = urllib.request.Request(API + "/effects/run", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=5).read()
        print("   ambient created")
    except Exception as e:
        print(f"  ! could not create the ambient: {e}", file=sys.stderr)
        sys.exit(1)


def blackout(seconds, label="dark"):
    # Business to nothing + the lamps parked dim. The room's own ambient keeps
    # breathing at the floor; a true blackout would need bench.py's frozen field,
    # and freezing it would hide the very motion under test.
    print(f"   ({label} {seconds:.0f}s)")
    cmd(cmd="business", value=0.0)
    setcfg(paletteFade=0.5)
    time.sleep(seconds)


# ── the running order ─────────────────────────────────────────────────────────
# Each item is data, not a call, so the menu can run them in any order and the
# reel is just "all of them in sequence". Every setup() must set every config key
# it depends on — items are no longer guaranteed to run after item 1, so anything
# left over from the previously shown item is the one way this drifts.

def one():
    setcfg(paletteFade=8, palettePushHz=3, bpm=48, floor=0.18)
    cmd(cmd="business", value=0.15)
    cmd(cmd="skip")


def two():
    setcfg(paletteFade=10, palettePushHz=3, bpm=48, floor=0.18)
    cmd(cmd="business", value=0.15)
    cmd(cmd="skip")
    time.sleep(11)
    cmd(cmd="skip")                   # a second hop, likely a big hue jump


def three():
    setcfg(paletteFade=6, palettePushHz=3, bpm=48, floor=0.18)
    cmd(cmd="business", value=0.95)
    cmd(cmd="skip")
    time.sleep(7)
    cmd(cmd="business", value=0.95)
    cmd(cmd="skip")


def four():
    setcfg(paletteFade=20, palettePushHz=3, bpm=32, floor=0.18)
    cmd(cmd="business", value=0.12)
    cmd(cmd="skip")


ITEMS = [
    ("CALM DRIFT — one scene melting into the next, 8s, at rest",
     "does it still stutter? this is the exact thing you called "
     "'a fire effect, sterile and sudden'", one, HOLD),
    ("BIG COLOUR JUMPS — two hops, 10s each, far apart on the wheel",
     "does the colour travel THROUGH clean colour, or sag through grey/mud "
     "in the middle? the muddy middle is the bug that was fixed", two, HOLD),
    ("PUMPED — same fades with the room driven hard",
     "does it feel SLUGGISH? a hot crossing is now ~0.5s where it used to be "
     "~0.25s. if it drags, that's EaseRate, and it's a one-number change", three, HOLD),
    ("SLOW ARRIVAL — one 20s drift, tempo down",
     "watch the END of the fade, not the middle. it should settle in and stop, "
     "not arrive at full speed and halt at a corner", four, HOLD),
]


def item(n, announce=True):
    """Run item n (1-based). Returns False if it was cut short with Ctrl-C.

    The slate is skippable because on a re-trigger you already know what you are
    about to watch, and 3 blinks of preamble is exactly the friction that stops
    someone looking twice.
    """
    title, watch, setup, seconds = ITEMS[n - 1]
    print(f"\n[{n}] {title}   — {seconds:.0f}s")
    print(f"    watch: {watch}")
    print("    (ctrl-c to cut it short and come back to the menu)")
    try:
        if announce:
            slate(n)
        setup()
        time.sleep(seconds)
        return True
    except KeyboardInterrupt:
        print("\n   …cut short.")
        api("/brightness/1.0")   # a Ctrl-C mid-slate would otherwise leave it dark
        return False


def restore():
    print("\nrestoring the room…")
    api("/brightness/1.0")
    cmd(cmd="resetConfig")
    cmd(cmd="business", value=0.2)
    print("done. the room is back to its factory config.")


def reel():
    """The fixed running order — every item, blackout between. ~2m20s."""
    for n in range(1, len(ITEMS) + 1):
        if not item(n):
            return False
        if n < len(ITEMS):
            try:
                blackout(DARK)
            except KeyboardInterrupt:
                print("\n   …cut short.")
                return False
    return True


MENU = """
  1-4   run that item          a   the whole reel (~2m20s)
  r     replay the last one    d   5s blackout, to reset your eyes
  s     re-create the ambient (after a Hue-app restart)
  ?     what each item is      q   quit and hand the room back
"""


def describe():
    for i, (title, watch, _, seconds) in enumerate(ITEMS, 1):
        print(f"\n  [{i}] {title}   — {seconds:.0f}s")
        print(f"      watch: {watch}")


def menu():
    last = None
    print(MENU)
    while True:
        try:
            choice = input(f"showreel{' [' + str(last) + ']' if last else ''}> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if choice == "":
            # Bare enter replays — the most common thing to want, so it is the
            # cheapest key. Nothing to replay yet just re-prints the menu.
            if last:
                item(last, announce=False)
            else:
                print(MENU)
        elif choice in ("q", "quit", "exit"):
            return
        elif choice == "?":
            describe()
        elif choice == "a":
            reel()
        elif choice == "r":
            if last:
                item(last, announce=False)
            else:
                print("  nothing shown yet — pick 1-4.")
        elif choice == "d":
            try:
                blackout(DARK)
            except KeyboardInterrupt:
                print()
        elif choice == "s":
            ensure_ambient()
        elif choice.isdigit() and 1 <= int(choice) <= len(ITEMS):
            last = int(choice)
            item(last)
        else:
            print(MENU)


def main():
    interactive = "--all" not in sys.argv

    # Pre-flight FIRST — before borrowing the room or touching ambient state. There is no point
    # restoring a room that was never driven. See relay_preflight.py for why this exists: with no
    # page subscribed, /party/pub answers 204 and the whole reel silently drives nothing.
    if not require_subscriber("showreel"):
        sys.exit(1)

    # A menu with no keyboard attached is a trap: input() takes EOF on the first
    # loop, the menu returns, the room is restored, and the whole thing looks like
    # it ran and decided to quit. That is exactly what it did inside Claude Code's
    # `!` prefix. If stdin is not a terminal, say so and run the reel instead —
    # showing something beats flashing a menu at nobody.
    if interactive and not sys.stdin.isatty():
        print("stdin is not a terminal — no menu here. Running the full reel instead.\n"
              "For the menu, run this from a real terminal window.\n")
        interactive = False
    print("showreel — 4 items, 30s each, 5s dark between.\n"
          "The room is borrowed and handed back on exit.\n")

    ensure_ambient()
    cmd(cmd="auto", value=True)          # only attract-mode picks FADE; manual picks snap
    time.sleep(0.5)

    if interactive:
        menu()
    else:
        reel()
    restore()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        # Only reachable from the non-interactive path or the setup above — the
        # menu swallows its own Ctrl-C. Never leave the room dark because of an abort.
        print("\ninterrupted — restoring the room…")
        api("/brightness/1.0")
        cmd(cmd="resetConfig")
        cmd(cmd="business", value=0.2)
