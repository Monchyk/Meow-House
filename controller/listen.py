#!/usr/bin/env python3
"""listen.py — Hue 4-button remote -> Deep House nav relay.

Connects to the Hue bridge CLIP v2 eventstream (Server-Sent-Events over
HTTPS with a self-signed cert), watches for button events from the physical
4-button remote, and relays them as nav actions to serve.py:

    bridge eventstream -> listen.py -> POST http://localhost:8800/input
                                        -> serve.py stamps the focus owner and
                                           derives a nav action from the gesture
                                        -> SSE /nav/stream  (the arcade, the menu, brain)
                                        -> SSE /party/sub   (the party engine)

The experience works fully on keyboard WITHOUT this script — it is additive.

── SETUP ─────────────────────────────────────────────────────────────────
1. Bridge credentials come from OUTSIDE this file — it is committed, so a key
   pasted in here would live in git history forever. Put them in
   `controller/config.json` (gitignored; copy config.example.json):
       {"bridgeIp": "192.168.0.x", "appKey": "…"}
   or set DEEPHOUSE_BRIDGE_IP / DEEPHOUSE_APP_KEY in the environment.
   The same values are in `Hue program UI/Services/HueEngine.cs`
   (BridgeIpAddress / AppKey, near the top).
2. Find your remote's button IDs:      python listen.py --discover
   That lists every button resource on the bridge (id, and the control_id
   1-4 telling you which physical button it is). Press buttons while it
   runs (--discover also tails live events) to see which id fires.
3. Paste the four ids into the `buttons` object in controller/config.json.

── ONE MODE (the --party flag is gone) ───────────────────────────────────
There used to be two modes and neither served both surfaces: the default posted
five discrete nav actions to /nav (the party leaked, the arcade worked) and
--party posted raw gestures to /party/pub (the arcade went dead).

The flag is gone; the PARTY TRANSPORT IS THE SURVIVOR. Every button event posts
once, raw, as {role, event} to POST /input, and serve.py derives the nav action
from the gesture at the fan-out point. That direction is load-bearing: a nav
action can always be derived from a gesture, a gesture can NEVER be recovered
from a nav action, which is the whole reason the discrete channel could not
carry hold-to-drive.

So this file no longer decides what a button MEANS. It says which button did
what. Preserved deliberately, because losing any of it would be silent — lamps
would still answer and the arcade would still work:
  · press / repeat / release, including the HOLD_TIMEOUT watchdog below;
    hold-to-drive IS the release event
  · the long-press vocabulary — power-long (factory SETTINGS reset) and
    hue-long (commit)
  · the room-owned buttonMap in web/party.js, which is why the raw gesture is
    the base transport and not a casualty of unifying: the operator remaps a button from
    his phone mid-party instead of editing this file and restarting Python.

Zero dependencies — stdlib only. Python 3.9+.
"""

import json
import os
import ssl
import sys
import threading
import time
import urllib.request
from pathlib import Path

# Windows consoles default to cp1252, which cannot encode the arrows/box glyphs
# used below — printing one raises UnicodeEncodeError and kills the listener
# before the eventstream ever opens. Force UTF-8 on stdout/stderr instead.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

# ═══════════════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════════════
# Credentials are loaded, never hardcoded: this file is committed, and a key
# written here would be in git history permanently. Order of precedence:
#   1. DEEPHOUSE_BRIDGE_IP / DEEPHOUSE_APP_KEY environment variables
#   2. controller/config.json  {"bridgeIp": "...", "appKey": "..."}  (gitignored)
# Missing credentials are not an error here — main() explains what to do.


def _load_config() -> dict:
    cfg = Path(__file__).resolve().parent / "config.json"
    if not cfg.is_file():
        return {}
    try:
        data = json.loads(cfg.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


CONFIG = _load_config()
BRIDGE_IP = os.environ.get("DEEPHOUSE_BRIDGE_IP", "") or CONFIG.get("bridgeIp", "")
APP_KEY = os.environ.get("DEEPHOUSE_APP_KEY", "") or CONFIG.get("appKey", "")

# HISTORICAL, not used: the discrete nav map this file posted before the modes were
# unified. It read the same four physical buttons as up/down/select/back, which is a
# DIFFERENT reading from the party roles below (control 1 was "up" here and "power"
# there). That disagreement is why the derived-nav table now lives in serve.py and is
# a documented judgement call rather than a mechanical translation of this dict.
# Kept only so the old physical reading is recoverable; delete it once serve.py's
# table has survived a real party.
LEGACY_NAV_MAP = {}

# 127.0.0.1, never "localhost": serve.py binds IPv4-only, and on Windows
# "localhost" resolves to ::1 first — that dead lookup costs ~2s per request,
# which lands as a 2-second lag between pressing a button and the room moving.
RELAY_URL = "http://127.0.0.1:8800/input"

# ═══════════════════════════════════════════════════════════════════════
#  THE BUTTONS  (one mode; roles, never meanings)
# ═══════════════════════════════════════════════════════════════════════
# The room needs press-AND-release (hold to drive business), which a single discrete
# action per click cannot express. So every event goes out raw as {role, event} and
# serve.py fans it to both surfaces — party-main.js feeds the gesture to PARTY.apply()
# exactly as before, and the arcade gets the derived nav action.
#
# Map each button's resource id to its ROLE (find ids with --discover):
#   power = mode toggle (short) · settings-to-factory (LONG) · derives nav "select"/"tap"
#   up/down = hold to drive business   ·   hue = cycle (short) / commit (long)
# Power-LONG is the reserved "reset to
# defaults". It sends `resetConfig` with NO keys = the whole desk back to factory
# SETTINGS. Deliberately NOT the engine's `_reset()`, which also wipes playlists,
# unlocks and saved user presets — a long-press that deleted the room's saved
# favourites mid-party would be unrecoverable.
# Ids + control_id read straight off the bridge, so these follow the physical
# top-to-bottom order of the dimmer switch. Re-pairing the remote mints NEW ids —
# rerun `--discover` and replace all four in controller/config.json if the
# remote is ever removed and paired again.
BUTTONS = CONFIG.get("buttons", {})
if not isinstance(BUTTONS, dict):
    BUTTONS = {}
# The dashboard's channel. listen.py no longer posts here — serve.py does the fan-out
# now, from /input — but the endpoint is unchanged and still open for anything else.
PARTY_URL = "http://127.0.0.1:8800/party/pub"   # see RELAY_URL note on ::1


# How long a drive survives without a fresh `repeat` before the watchdog stops it.
# The bridge emits `repeat` roughly once a second while a button is genuinely held,
# and delivers everything in ~1s buckets, so this must clear 1s with room to spare
# but stay short enough that a stuck drive is a blip and not a runaway.
HOLD_TIMEOUT = 1.6


def party_relay(role: str, event: str):
    """Forward one button event to the room as a raw GESTURE.

    listen.py deliberately no longer decides what a button MEANS. The room owns
    `buttonMap` (web/party.js) so K. can remap a button from his phone mid-party
    instead of editing this file and restarting Python. Everything here does is say
    which button did what; party.js decides what that is worth.

    `repeat` is forwarded too — it is the only trustworthy "still held" signal given
    the bridge's ~1s bucketing, and party.js re-asserts the drive on each one.
    """
    if not role:
        return None
    return {"cmd": "btn", "role": role, "event": event}


def party_action(role: str, event: str):
    """LEGACY: map (button role, bridge event) -> a PARTY command, or None.

    Superseded by party_relay + party.js's buttonMap. Kept because it is pure and
    documents the original hardcoded behaviour that buttonmap.test.js asserts the new
    defaults still reproduce. Not called by the listener any more.
    """
    if role in ("up", "down"):
        direction = 1 if role == "up" else -1
        # `repeat` is the ONLY trustworthy "still held" signal. Measured 2026-07-26:
        # the eventstream arrives in ~1s buckets, so an initial_press and its own
        # short_release routinely share a timestamp and press DURATION cannot be
        # recovered from arrival time. Re-asserting the drive on every repeat is
        # idempotent (holdBright just sets `drive`), keeps the watchdog fed, and
        # self-heals a drive whose initial_press was missed.
        if event in ("initial_press", "repeat"):
            return {"cmd": "hold", "dir": direction}
        if event in ("short_release", "long_release"):
            return {"cmd": "hold", "dir": 0}
        return None
    if role == "power":
        if event == "short_release":
            return {"cmd": "mode"}
        # Whole desk back to factory settings. See the BUTTONS note on why this
        # is resetConfig and not the engine's full _reset().
        if event == "long_press":
            return {"cmd": "resetConfig"}
        return None
    if role == "hue":
        if event == "short_release":
            return {"cmd": "cycle"}
        if event == "long_press":
            return {"cmd": "commit"}
        return None
    return None


# ── hold watchdog ──────────────────────────────────────────────────────────
# A drive must never outlive the finger holding it. Before this, a single lost
# release event left `drive` pinned at ±1 and the room ramped to a limit on its own
# — the exact "it has a mind of its own" symptom, and at driveRate 1.8 a full sweep
# takes 0.55s so it saturates almost instantly. The watchdog is the backstop: no
# fresh `repeat` within HOLD_TIMEOUT and the drive is released regardless of what
# the bridge did or failed to say.
_hold = {"role": None, "deadline": 0.0}
_hold_lock = threading.Lock()


def note_hold(role: str, event: str) -> None:
    """Track which button is being held so the watchdog can end a stranded drive.

    The listener no longer knows whether a button is BOUND to a drive — the room owns
    that now. So it watches every held button and, on timeout, sends that button's
    release. If the button was not driving anything the release is a no-op in party.js,
    which is the right trade: a spurious no-op costs nothing, a stranded drive ramps the
    room to a limit on its own.
    """
    with _hold_lock:
        if event in ("initial_press", "repeat"):
            _hold["role"] = role
            _hold["deadline"] = time.monotonic() + HOLD_TIMEOUT
        elif event in ("short_release", "long_release"):
            if _hold["role"] == role:
                _hold["role"] = None
                _hold["deadline"] = 0.0


def _hold_watchdog() -> None:
    while True:
        time.sleep(0.25)
        with _hold_lock:
            role = _hold["role"]
            expired = role is not None and time.monotonic() > _hold["deadline"]
            if expired:
                _hold["role"] = None
                _hold["deadline"] = 0.0
        if expired:
            print(f"  !! hold timed out — no repeat from {role}; releasing")
            relay(role, "short_release")


def relay_party(cmd: dict) -> None:
    body = dict(cmd)
    body["from"] = "remote"
    body["type"] = "cmd"
    try:
        req = urllib.request.Request(
            PARTY_URL, data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=3).read()
        print(f"  -> {cmd}")
    except OSError as e:
        print(f"  !! party relay failed ({e}) — is serve.py running on :8800?")

# ═══════════════════════════════════════════════════════════════════════

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE  # bridge uses a self-signed cert


def bridge_get(path: str):
    req = urllib.request.Request(
        f"https://{BRIDGE_IP}{path}",
        headers={"hue-application-key": APP_KEY},
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=10) as resp:
        return json.loads(resp.read())


def relay(role: str, event: str) -> None:
    """Post one raw gesture. No interpretation happens here, on purpose."""
    try:
        req = urllib.request.Request(
            RELAY_URL,
            data=json.dumps({"role": role, "event": event}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        body = urllib.request.urlopen(req, timeout=3).read()
        try:
            info = json.loads(body or b"{}")
            print(f"  -> {role}.{event}  focus={info.get('focus')}  nav={info.get('action')}")
        except json.JSONDecodeError:
            print(f"  -> {role}.{event}")
    except OSError as e:
        print(f"  !! relay failed ({e}) — is serve.py running on :8800?")


def discover() -> None:
    """List all button resources, then tail live events so the operator can press
    each physical button and read off its id."""
    print(f"Querying https://{BRIDGE_IP}/clip/v2/resource/button ...")
    data = bridge_get("/clip/v2/resource/button")
    buttons = data.get("data", [])
    if not buttons:
        print("No button resources found — is the remote paired to this bridge?")
    for b in buttons:
        rid = b.get("id")
        ctl = b.get("metadata", {}).get("control_id")
        owner = b.get("owner", {}).get("rid", "?")
        print(f"  button id={rid}  control_id={ctl}  device={owner}")
    print("\nNow press buttons on the remote — live events follow (Ctrl+C to stop):\n")
    stream(print_only=True)


def stream(print_only: bool = False) -> None:
    """Connect to the CLIP v2 eventstream and dispatch button events."""
    url = f"https://{BRIDGE_IP}/eventstream/clip/v2"
    backoff = 2
    while True:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "hue-application-key": APP_KEY,
                    "Accept": "text/event-stream",
                },
            )
            print(f"connecting to {url} ...")
            with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as resp:
                print("eventstream open — listening for button presses")
                backoff = 2
                for raw in resp:
                    line = raw.decode("utf-8", "replace").strip()
                    if not line.startswith("data:"):
                        continue
                    try:
                        events = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue
                    for ev in events:
                        for item in ev.get("data", []):
                            if item.get("type") != "button":
                                continue
                            rid = item.get("id")
                            last = (item.get("button", {}) or {}).get("last_event") \
                                or (item.get("button", {}) or {}).get("button_report", {}).get("event")
                            if print_only:
                                print(f"  button {rid}  event={last}")
                                continue
                            role = BUTTONS.get(rid)
                            if not role or not last:
                                continue
                            print(f"button {rid} {last} ({role})")
                            note_hold(role, last)       # feed the watchdog first
                            relay(role, last)
        except KeyboardInterrupt:
            print("\nbye")
            return
        except OSError as e:
            print(f"stream dropped ({e}) — retrying in {backoff}s")
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)


def main() -> None:
    if "--discover" in sys.argv:
        if not APP_KEY:
            raise SystemExit("Fill in BRIDGE_IP and APP_KEY first (see header comment).")
        discover()
        return
    if not (APP_KEY and BRIDGE_IP):
        raise SystemExit(
            "listen.py has no bridge credentials.\n"
            "Put them in controller/config.json (gitignored):\n"
            '    {"bridgeIp": "192.168.0.x", "appKey": "..."}\n'
            "or set DEEPHOUSE_BRIDGE_IP / DEEPHOUSE_APP_KEY.\n"
            "They are NOT stored in this file on purpose — it is committed.\n"
            "The same values live in HueEngine.cs. Then map the button ids\n"
            "(--discover). The experience works fine on keyboard without this."
        )
    if not BUTTONS:
        raise SystemExit(
            "No remote buttons are configured. Run with --discover, then copy the\n"
            "four button ids into controller/config.json (see config.example.json)."
        )
    # One mode. The watchdog is not optional: a drive must never outlive the finger
    # holding it, and a lost release is the failure that reads as "it has a mind of
    # its own". See HOLD_TIMEOUT.
    print("listening — posting raw gestures to /input "
          "(power=mode/LONG=factory, ↑↓=hold to drive, hue=cycle/commit)")
    threading.Thread(target=_hold_watchdog, daemon=True).start()
    stream()


if __name__ == "__main__":
    main()
