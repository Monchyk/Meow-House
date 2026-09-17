#!/usr/bin/env python3
"""bench.py — a clean room for looking at ONE lamp variable at a time.

    python controller/bench.py off                  # blackout, and stay there
    python controller/bench.py flat                 # a dead-still reference field
    python controller/bench.py energy 0.15 0.95     # A/B the business->brightness coupling
    python controller/bench.py alt 0.15 0.95 30    # A,B,A,B for 30s - is the STEP noticeable
    python controller/bench.py param flowIntensity 0.0 0.9
    python controller/bench.py restore              # hand the room back to the party

WHY. K., live, 2026-07-25: *"its hard to say considering that the lights keep changing
colour of themselves anyway no? by default the states change without u doing anything.
we need a proper clean testing environment. where the lights also get turned off and
on for the sequence."*

Exactly right, and it invalidated the first energy test of the evening. The Superfluid
ambient is ALWAYS moving — a tide sweeping the room, a slow hue drift, per-lamp
brightness out of phase. Ask "did that get brighter?" on top of all that and the honest
answer is "I cannot tell", which is what happened. The motion is the whole design; it
is also why the room cannot be measured while it runs.

So the bench does three things the party never does:

  1. FREEZES the field. Same Superfluid layer, but flow, drift and speed at zero — a
     still image made of the same light, so the only thing that can change is the one
     variable under test.
  2. BLACKS OUT between sides. Every look starts from dark, so the eye has a fixed
     reference instead of comparing against whatever it had adapted to. Two lit states
     back to back is the hardest possible comparison; dark-A-dark-B is the easiest.
  3. STAYS OUT OF THE PARTY'S WAY. It talks to the C# app through serve.py's own /api
     proxy, and party-main.js only pushes lamp state when something CHANGES — so with
     business held still, the browser goes quiet and the bench owns the lamps. `restore`
     hands them back.

⚠ THIS IS A MEASURING INSTRUMENT, NOT A LOOK. Nothing here should ever become how the
room runs. A frozen Superfluid is the opposite of the design.
"""

import json
import sys
import time
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HOST = "http://127.0.0.1:8800"          # serve.py's /api proxy -> the C# app on :5000
HOLD = 10.0                             # seconds a side is held up for
DARK = 3.0                              # seconds of black between sides

# The still field. Same layer the party uses, with every source of motion set to zero:
# speed and flowIntensity stop the tide, colorDrift stops the hue walk, brightBand at 0
# stops the per-lamp breathing. What is left is a flat wash that only GlobalEnergy can
# change — which is the point of the whole exercise.
FROZEN = {
    "color": "00BFFF",
    "palette": "00BFFF",
    # 0.05, not 0: `speed` is declared 0.05–3 (docs/HUE-API.md), and
    # /api/effects/params "silently ignores unknown keys and returns softUpdate:true
    # having applied nothing" — an out-of-range value would leave the tide running at
    # its old speed while the bench reported success. The floor is slow enough that
    # flowIntensity 0 stops the motion anyway; this is belt and braces.
    "speed": "0.05",
    "spread": "0.60",
    "flowIntensity": "0.0",
    "colorSpan": "1.0",
    "colorDrift": "0.0",
    "brightBand": "0.0",
}


def api(path, body=None, method="POST"):
    try:
        data = json.dumps(body).encode() if body is not None else b""
        req = urllib.request.Request(HOST + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read(300).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read(200).decode("utf-8", "replace")
    except Exception as e:
        return None, str(e)


def run_ambient(kind, params=None):
    return api("/api/effects/run", {"AmbientType": kind, "AmbientParams": params or {}})


def blackout(seconds=DARK, why="dark"):
    run_ambient("None")
    print(f"  ── {why} ({seconds:.0f}s)")
    time.sleep(seconds)


def frozen(**overrides):
    p = dict(FROZEN)
    p.update({k: str(v) for k, v in overrides.items()})
    return run_ambient("Superfluid", p)


def energy(v):
    # POST /api/energy/{value:double} — exists ONLY on feature/party-installation. If
    # this 404s the lamps are not coupled to the room at all and no lamp question in
    # this repo is worth asking; see CLAUDE.md.
    s, b = api(f"/api/energy/{v}")
    if s == 404:
        print("  ! /api/energy 404 — the Hue app is on the wrong branch. Stop here.")
        sys.exit(1)
    return s


def show(label, seconds=HOLD, **overrides):
    print(f"  ▸ {label}")
    frozen(**overrides)
    time.sleep(seconds)


def seq_energy(lo, hi, hold=HOLD):
    """The coupling test. Field frozen, so brightness is the only thing that CAN move."""
    print(f"\n  ENERGY — everything frozen except the room's own energy.")
    print(f"  Watch for one thing only: is the second one brighter than the first?\n")
    blackout(why="dark, so your eyes have a reference")
    energy(lo); show(f"A — energy {lo}", hold)
    blackout(why="dark again")
    energy(hi); show(f"B — energy {hi}", hold)
    blackout(2.0, why="done")


def seq_alternate(lo, hi, seconds=30.0, period=5.0):
    """A, B, A, B… straight through, no dark in between.

    K., live: *"do it again for 30 seconds but make it alternate between the 2."* The
    blackout version is the better test of "is B brighter" in the absolute — the eye
    gets a fixed reference each time. This is the better test of "is the DIFFERENCE
    big enough to notice", because a step change between two lit states is exactly what
    the room will actually do when someone pushes it. One dark at the start to set the
    reference, then it just flips."""
    print(f"\n  ALTERNATING — {lo} and {hi}, every {period:.0f}s for {seconds:.0f}s.")
    print(f"  Starts on A ({lo}) after the dark. Watch for the step, not the level.\n")
    blackout(why="dark, once, to set the reference")
    t0, i = time.time(), 0
    while time.time() - t0 < seconds:
        v = lo if i % 2 == 0 else hi
        side = "A" if i % 2 == 0 else "B"
        energy(v)
        if i == 0:
            frozen()                       # put the field up once; only energy moves after
        print(f"  ▸ {side} — energy {v}   ({time.time() - t0:.0f}s)")
        time.sleep(period)
        i += 1
    print("  ── done")


def seq_param(name, a, b, hold=HOLD):
    """A/B any one Superfluid parameter with everything else held still."""
    print(f"\n  {name.upper()} — {a} vs {b}, every other source of motion at zero.\n")
    blackout(why="dark")
    show(f"A — {name} = {a}", hold, **{name: a})
    blackout(why="dark")
    show(f"B — {name} = {b}", hold, **{name: b})
    blackout(2.0, why="done")


def restore():
    """Give the lamps back to the party. The browser re-pushes its own params on the
    next change, but it is change-gated, so nudge it by putting the live layer back
    with the party's real defaults rather than waiting for a change that may not come."""
    run_ambient("Superfluid", {
        "color": "00BFFF", "palette": "00BFFF,7B68EE,FF69B4",
        "speed": "0.12", "spread": "0.60", "flowIntensity": "0.75",
        "colorSpan": "1.0", "colorDrift": "0.02", "brightBand": "0.30"})
    print("  lamps handed back to the party (nudge business on the dashboard to re-sync)")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "help"
    if what == "off":
        run_ambient("None"); print("  lamps dark")
    elif what == "flat":
        frozen(); print("  frozen reference field up — nothing in it should move")
    elif what == "energy":
        lo = float(sys.argv[2]) if len(sys.argv) > 2 else 0.15
        hi = float(sys.argv[3]) if len(sys.argv) > 3 else 0.95
        seq_energy(lo, hi)
    elif what == "alt":
        lo = float(sys.argv[2]) if len(sys.argv) > 2 else 0.15
        hi = float(sys.argv[3]) if len(sys.argv) > 3 else 0.95
        secs = float(sys.argv[4]) if len(sys.argv) > 4 else 30.0
        per = float(sys.argv[5]) if len(sys.argv) > 5 else 5.0
        seq_alternate(lo, hi, secs, per)
    elif what == "param":
        seq_param(sys.argv[2], sys.argv[3], sys.argv[4])
    elif what == "restore":
        restore()
    else:
        print(__doc__)
