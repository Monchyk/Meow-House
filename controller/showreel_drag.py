#!/usr/bin/env python3
"""showreel_drag.py — the follow-up reel, with both effects EXAGGERATED.

K., after the first reel: "1 seems to be chill. maybe a bit of a fire effect but
thats nice. 2 seemed cool too. 3. what does drag mean? can you excagerate it?
4 I didnt catch completely but I had a feeling 3 and 4 stuttered a little."

Items 3 and 4 are OPPOSITE EXTREMES — 3 is the fastest crossing the room can be
asked for, 4 the slowest — so "both stuttered" probably means two different
causes, not one. This reel separates them and pushes each past subtlety.

  A  DRAG, exaggerated. Room driven to full, then a 1.5 s fade demanded. The
     engine asks for a near-instant crossing and the limiter refuses. If the
     lamps visibly trail the screen, that is drag, and EaseRate is the number.
  B  THE CONTROL for A. Same full-energy room, a 12 s fade — one it can serve
     comfortably. If A trails and B does not, drag is real and measured.
  C  QUANTISATION, exaggerated. A 45 s crossing at low tempo. Per-frame deltas
     fall below the integer brightness step, so the lamps should sit still and
     then JUMP a whole unit — a stutter with a completely different cause from
     the slew limiter, and one the HSV fix would not have touched.

Same slate convention: N white blinks at 40% announce item N (1=A, 2=B, 3=C).
Borrows the room and hands it back, Ctrl-C included.
"""

import json
import sys
import time
import urllib.request

from relay_preflight import require_subscriber

PUB = "http://127.0.0.1:8800/party/pub"
API = "http://127.0.0.1:5000/api"


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


def ensure_ambient():
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


def slate(n):
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


def dark(seconds=5.0):
    print(f"   (dark {seconds:.0f}s)")
    cmd(cmd="business", value=0.0)
    setcfg(paletteFade=0.5)
    time.sleep(seconds)


def main():
    # Empty-relay guard — /party/pub answers 204 with nobody subscribed, so this would
    # silently drive nothing. See relay_preflight.py (cost: one full session, 2026-07-28).
    if not require_subscriber("showreel_drag"):
        sys.exit(1)

    print("drag reel — 3 items, exaggerated. ~3 min.\n")
    ensure_ambient()
    cmd(cmd="auto", value=True)
    time.sleep(0.5)

    # ── A. drag, pushed past subtlety ─────────────────────────────────────────
    print("\n[1] DRAG, EXAGGERATED — room at full, 1.5s fades demanded   — 45s")
    print("    watch: do the LAMPS trail the SCREEN? the screen is instant; if the")
    print("           lamps arrive noticeably after it, that is drag")
    slate(1)
    setcfg(paletteFade=1.5, bpm=96, floor=0.5)
    for _ in range(6):
        cmd(cmd="business", value=1.0)
        cmd(cmd="skip")
        time.sleep(7)
    dark()

    # ── B. the control ────────────────────────────────────────────────────────
    print("\n[2] THE CONTROL — same hot room, 12s fades it can actually serve   — 40s")
    print("    watch: same energy, unhurried crossing. if THIS one feels right and")
    print("           1 felt laggy, drag is real and it is EaseRate")
    slate(2)
    setcfg(paletteFade=12, bpm=96, floor=0.5)
    for _ in range(2):
        cmd(cmd="business", value=1.0)
        cmd(cmd="skip")
        time.sleep(19)
    dark()

    # ── C. quantisation, the other kind of stutter ────────────────────────────
    print("\n[3] VERY SLOW — a 45s crossing, tempo way down   — 50s")
    print("    watch: not smoothness overall — watch for the lamps SITTING STILL")
    print("           and then hopping. steps, not a glide. different cause entirely")
    slate(3)
    setcfg(paletteFade=45, bpm=24, floor=0.15)
    cmd(cmd="business", value=0.15)
    cmd(cmd="skip")
    time.sleep(50)

    print("\nrestoring the room…")
    api("/brightness/1.0")
    cmd(cmd="resetConfig")
    cmd(cmd="business", value=0.2)
    print("done. the room is back to its factory config.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\ninterrupted — restoring the room…")
        api("/brightness/1.0")
        cmd(cmd="resetConfig")
        cmd(cmd="business", value=0.2)
