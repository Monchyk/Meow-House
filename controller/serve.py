#!/usr/bin/env python3
"""serve.py — Deep House: local server.

Does three jobs, all stdlib, zero dependencies:

  1. Serves the static front-end from ../web/  (index.html, display.html, …)
  2. Reverse-proxies  /api/*  ->  http://localhost:5000  (the C# Hue app),
     which makes the browser same-origin with the Hue API — no CORS edit
     needed in the C# project, and BroadcastChannel works across windows.
  3. Remote input relay + ARBITRATION for the physical remote:
        POST /input          {"role": "power|up|down|hue", "event": "<bridge event>"}
                             the ONE endpoint listen.py posts to. Stamps the current
                             focus owner, derives a nav action, fans out to BOTH streams.
        POST /nav/focus      {"owner": "arcade"[, "release": true]}   claim / release
        GET  /nav/focus      {"owner": ..., "ttl": ..., "heartbeat": ...}
        GET  /nav/stream?owner=<id>   SSE of {action, focus, role, event}
        GET  /party/sub      SSE of {cmd:"btn", role, event, focus} (unchanged shape)
        POST /nav            legacy discrete action, still accepted
     Keyboard input works regardless - all of this is additive.
     The wire vocabulary and the focus rules are documented ONCE, above
     publish_input() below. That block is the authority; do not restate it.

Run:   python controller/serve.py          (from the project root)
       python serve.py                     (from controller/)
Then open http://127.0.0.1:8800/ (catalogue), then choose an experience.
"""

import json
import os
import queue
import socket
import sys
import threading
import time
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("DEEPHOUSE_PORT") or 8800)
# 127.0.0.1, never "localhost": on Windows "localhost" tries ::1 first, and that
# dead lookup costs ~2s on EVERY proxied call — /api/energy fires on each business
# change, so the lamps lag two seconds behind the room.
HUE_BASE = "http://127.0.0.1:5000"
WEB_ROOT = (Path(__file__).resolve().parent.parent / "web").resolve()

# ── music: a LOCAL folder, never the repo ─────────────────────────────────
# Audio stays on the machine. Point at it with controller/config.json
# ({"musicFolder": "D:/Music/deephouse"}) or the DEEPHOUSE_MUSIC env var.
# Absent or missing folder = the piece runs silent, no error.
def _music_root() -> Path | None:
    raw = os.environ.get("DEEPHOUSE_MUSIC")
    if not raw:
        cfg = Path(__file__).resolve().parent / "config.json"
        if cfg.is_file():
            try:
                raw = json.loads(cfg.read_text(encoding="utf-8")).get("musicFolder")
            except Exception:
                raw = None
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p.resolve() if p.is_dir() else None

MUSIC_ROOT = _music_root()
AUDIO_EXT = {".mp3", ".ogg", ".m4a", ".flac", ".wav", ".opus", ".aac"}

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
    ".ico": "image/x-icon", ".woff2": "font/woff2",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
    ".flac": "audio/flac", ".wav": "audio/wav", ".opus": "audio/opus",
    ".aac": "audio/aac",
}

# ── nav relay state ───────────────────────────────────────────────────────
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()

# ── operator relay state (the Basement console) ───────────────────────────
_op_subscribers: list[queue.Queue] = []
_op_lock = threading.Lock()

# ── party relay state (dashboard <-> /party.html, cross-device) ────────────
# Fans out any JSON object to every subscriber. party-main.js publishes state
# snapshots; dashboard.js publishes commands. Each side filters by the msg's
# "from" field. Reuses the /op broadcast shape.
_party_subscribers: list[queue.Queue] = []
_party_lock = threading.Lock()

# ── play relay state (phone controllers <-> a host screen, per room) ───────
# See the authority block above the play helpers, below.
_play_subscribers: list[queue.Queue] = []
_play_lock = threading.Lock()
_rooms: dict = {}                     # room code -> {"seq": int}
_rooms_lock = threading.Lock()


# ======================================================================
#  NAV FOCUS + THE WIRE VOCABULARY  (the ONE authoritative place)
# ======================================================================
# THE BUG THIS FIXES: /nav/stream was an unaddressed broadcast. Four surfaces
# subscribe to it (the arcade, the menu, brain.js, the party engine), so ONE press
# reached all four - spirals switching under an open game. That was never a missing
# connection; it was a missing ARBITER.
#
# THE SHAPE: one owner at a time, held HERE, not negotiated between pages.
#   POST /nav/focus {"owner":"arcade"}                 claim (last claim wins)
#   POST /nav/focus {"owner":"arcade","release":true}  release -> falls back to party
#   GET  /nav/focus                                    {"owner":..., "ttl":seconds}
# Every published event is stamped with the owner; every client drops what is not
# addressed to it. The PARTY is the default owner, so with nobody playing the
# installation behaves exactly as it did before any of this.
#
# TTL IS NOT OPTIONAL. A claim dies after FOCUS_TTL unless refreshed by a heartbeat.
# A crashed or closed arcade tab must never hold the room's remote hostage - that
# kiosk failure would be worse than the bug being fixed.
#
# -- DERIVATION DIRECTION (do not invert) ------------------------------
#   gesture {role,event}  ->  focus stamp  ->  fan-out to both streams
# The nav `action` is COMPUTED FROM the gesture at the fan-out point. A nav action
# can always be derived from a gesture; a gesture can never be recovered from a nav
# action, which is the entire defect. The party's {role,event} transport is the BASE;
# /nav is a derived VIEW onto it.
#
# -- THE WIRE VOCABULARY - THIS TABLE IS THE AUTHORITY -----------------
# Every surface maps these to its own words and says so in its own file header.
# Divergence is fine; UNDISCOVERABLE divergence is what cost a session to a wrong
# root-cause trace. This vocabulary is a SUPERSET and MUST NOT SHRINK - `hue` keeps
# being emitted even though the two shells have no use for it, and the raw
# {role, event} rides along on every event so a surface needing finer detail than
# the derived action reads the gesture instead of asking for a new action name.
#
#   gesture              derived nav action   consumed as
#   -------------------  ------------------   ---------------------------------
#   up.short_release     "up"                 game/menu: up     brain: up
#   down.short_release   "down"               game/menu: down   brain: down
#   power.short_release  "select"             game/menu: enter  brain: select
#   hue.short_release    "back"               game/menu: back   brain: back
#   power.long_press     "tap"                game/menu: EXIT   brain: tap-tempo
#   hue.long_press       "hue"                brain only (the probability organ)
#   every other gesture  (none)               no nav action; the gesture still goes
#                                             to /party/sub, where hold-to-drive lives
#
# NOTE FOR THE ARCHITECT: the two OLD listen.py tables disagreed about the physical
# buttons - nav read control 1-4 as up/down/select/back while party read them as
# power/up/down/hue. Unifying on the party roles (the base transport) leaves the nav
# derivation underdetermined, so the table above is a judgement call: power is the
# top button and reads as "select", hue is the bottom and reads as "back", and the
# long-press of the select-ish button stays EXIT exactly as before. Flagged, not
# assumed - change this table, not the call sites, if it should differ.
NAV_ACTIONS = ("up", "down", "select", "back", "tap", "hue")
DEFAULT_FOCUS = "party"
# 30s in the room. DEEPHOUSE_FOCUS_TTL exists ONLY so the test suite can watch a claim
# actually expire without sleeping half a minute — expiry is the behaviour that keeps a
# crashed arcade tab from holding the remote hostage, so it must be tested, not assumed.
FOCUS_TTL = float(os.environ.get("DEEPHOUSE_FOCUS_TTL") or 30.0)
FOCUS_HEARTBEAT = 10.0    # what clients should refresh at (reported to the client)

_focus = {"owner": DEFAULT_FOCUS, "until": 0.0}
_focus_lock = threading.Lock()


def nav_focus() -> str:
    """The current owner, expiring a stale claim back to the party first."""
    with _focus_lock:
        if _focus["owner"] != DEFAULT_FOCUS and time.monotonic() > _focus["until"]:
            _focus["owner"] = DEFAULT_FOCUS
            _focus["until"] = 0.0
        return _focus["owner"]


def nav_focus_ttl() -> float:
    with _focus_lock:
        if _focus["owner"] == DEFAULT_FOCUS:
            return 0.0
        return max(0.0, _focus["until"] - time.monotonic())


def claim_focus(owner: str) -> str:
    """Claim (or heartbeat) the remote. Last claim wins - no queue, no priority."""
    with _focus_lock:
        _focus["owner"] = owner
        _focus["until"] = time.monotonic() + FOCUS_TTL
        return owner


def release_focus(owner: str) -> str:
    """Give the remote back. A release from a surface that no longer holds focus is a
    no-op, so a late unload cannot yank the remote off whoever claimed it since."""
    with _focus_lock:
        if _focus["owner"] == owner:
            _focus["owner"] = DEFAULT_FOCUS
            _focus["until"] = 0.0
        return _focus["owner"]


def derive_nav(role: str, event: str):
    """gesture -> the derived nav action, or None. See the table above."""
    if event == "short_release":
        return {"up": "up", "down": "down", "power": "select", "hue": "back"}.get(role)
    if event == "long_press":
        return {"power": "tap", "hue": "hue"}.get(role)
    return None


def _has_subscriber(owner: str) -> bool:
    with _sub_lock:
        return any(getattr(q, "owner", None) == owner for q in _subscribers)


def publish_input(role: str, event: str) -> dict:
    """The fan-out point. Stamps focus ONCE and publishes the same event to both
    streams: /nav/stream gets the derived action, /party/sub gets the {cmd:btn} the
    party already consumes. Both carry `focus` and the raw gesture."""
    owner = nav_focus()
    action = derive_nav(role, event)
    # EXIT bypasses arbitration - but NARROWLY, and this is the whole precedence rule:
    #
    #   route a tap to the arcade  <=>  it is a tap
    #                              AND  the focus owner is NOT subscribed
    #                              AND  an arcade IS subscribed
    #
    # The first version hijacked EVERY tap the moment an arcade was connected, which took
    # brain.js's tap-tempo away from a live surface that legitimately held focus. The
    # bypass is for a focus owner that cannot answer - a stale claim, a page that died
    # without releasing, a race on load. If the holder is alive and listening, it keeps
    # its own gesture; the arcade does not eat it.
    #
    # This clause alone would still leave a hole (an arcade that holds focus and freezes
    # answers nothing and is subscribed), which is why the shell re-asserts its claim on
    # every heartbeat and falls back to ATTRACT on the idle clock. The escape hatch does
    # not depend on this arbiter being right; it depends on the shell's own clock.
    nav_owner = owner
    if action == "tap" and not _has_subscriber(owner) and _has_subscriber("arcade"):
        nav_owner = "arcade"
    if action:
        publish_nav(action, focus=nav_owner, role=role, event=event)
    publish_party({"cmd": "btn", "role": role, "event": event,
                   "from": "remote", "type": "cmd", "focus": owner})
    return {"focus": owner, "action": action, "navFocus": nav_owner}


def publish_nav(action: str, focus: str = None, role: str = None, event: str = None) -> None:
    msg = {"action": action, "focus": focus if focus is not None else nav_focus()}
    if role:
        msg["role"] = role
        msg["event"] = event
    with _sub_lock:
        for q in list(_subscribers):
            try:
                q.put_nowait(msg)
            except queue.Full:
                pass


def publish_op(obj: dict) -> None:
    with _op_lock:
        for q in list(_op_subscribers):
            try:
                q.put_nowait(obj)
            except queue.Full:
                pass


def publish_party(obj: dict) -> None:
    with _party_lock:
        for q in list(_party_subscribers):
            try:
                q.put_nowait(obj)
            except queue.Full:
                pass


# ======================================================================
#  PLAY RELAY — phone controllers <-> a room's host screen
# ======================================================================
# A ROOM is created only when a HOST subscribes to /play/sub?role=host — never on
# join, so a phone can never join a room nobody is watching. Each phone that joins
# gets a numbered player id (p1, p2, ...) scoped to that room; POST /join 404s with
# {"error":"no screen"} until a host is present. The channel is DOWN-addressed both
# ways: /intent goes phone -> that room's host subscribers only, /play/pub goes
# host -> that room's phone subscribers only. Subscribing IS presence — a phone
# stream opening is what tells the host a player joined, so a reconnect re-announces
# for free and there is no separate "leave" message to keep in sync.
# STRUCTURAL FIREWALL: /intent's `value` must be a number, a bool, or a list/{x,y}
# object of numbers. No free-text may cross phone -> host.
def _has_host(room: str) -> bool:
    with _play_lock:
        return any(getattr(q, "room", None) == room and getattr(q, "role", None) == "host"
                   for q in _play_subscribers)


def _valid_intent_value(v) -> bool:
    """The structural firewall: no free-text may cross phone -> host."""
    if isinstance(v, bool):
        return True
    if isinstance(v, (int, float)):
        return True
    if isinstance(v, list):
        return len(v) > 0 and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v)
    if isinstance(v, dict):
        return set(v.keys()) == {"x", "y"} and all(
            isinstance(v[k], (int, float)) and not isinstance(v[k], bool) for k in ("x", "y"))
    return False


def publish_play(room: str, role: str, obj: dict, player: str = None) -> None:
    """Fan an object to a room's subscribers of one role. With `player` given, down-address
    further to that ONE phone — the channel already down-addresses by room, this adds the
    per-player lane hidden-info games need (an Oracle's secret target, a player's own number)
    that a room-wide broadcast structurally cannot carry. player=None keeps the room-wide
    behaviour every existing caller relies on."""
    with _play_lock:
        for q in list(_play_subscribers):
            if getattr(q, "room", None) != room or getattr(q, "role", None) != role:
                continue
            if player is not None and getattr(q, "player", None) != player:
                continue
            try:
                q.put_nowait(obj)
            except queue.Full:
                pass


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # quiet the default per-request log noise; keep errors
    def log_message(self, fmt, *args):
        pass

    # ── routing ──────────────────────────────────────────────────────────
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._proxy("GET")
        if self.path.split("?", 1)[0] == "/nav/stream":
            return self._nav_stream()
        if self.path == "/nav/focus":
            return self._focus_get()
        if self.path == "/lan":
            # The room host screen asks for this so the join URL it prints is one a
            # phone can actually reach, however the host tab itself was opened.
            return self._json({"ip": lan_ip(), "port": PORT})
        if self.path == "/music/list":
            return self._music_list()
        if self.path.startswith("/music/"):
            return self._music_file()
        if self.path == "/op/stream":
            return self._op_stream()
        if self.path == "/party/sub":
            return self._party_stream()
        if self.path == "/party/stat":
            return self._party_stat()
        if self.path.split("?", 1)[0] == "/play/sub":
            return self._play_stream()
        if self.path.split("?", 1)[0] == "/play/stat":
            return self._play_stat()
        return self._static()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self._proxy("POST")
        if self.path == "/nav":
            return self._nav_post()
        if self.path == "/input":
            return self._input_post()
        if self.path == "/nav/focus":
            return self._focus_post()
        if self.path == "/op":
            return self._op_post()
        if self.path == "/party/pub":
            return self._party_post()
        if self.path == "/join":
            return self._join_post()
        if self.path == "/intent":
            return self._intent_post()
        if self.path == "/play/pub":
            return self._play_post()
        self._drain_body()
        self._plain(404, "not found")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            return self._proxy("DELETE")
        self._drain_body()
        self._plain(404, "not found")

    # ── static files ─────────────────────────────────────────────────────
    def _static(self):
        raw = self.path.split("?", 1)[0]
        if raw in ("/", ""):
            raw = "/index.html"
        target = (WEB_ROOT / raw.lstrip("/")).resolve()
        # A directory means its index.html — without this, /qr/ 404s while
        # /qr/index.html works, which reads as a broken link rather than a
        # missing feature.
        if target.is_dir():
            target = target / "index.html"
        # path-traversal guard
        if not str(target).startswith(str(WEB_ROOT)) or not target.is_file():
            return self._plain(404, "not found")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(target.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ── music (local folder, streamed with Range support) ────────────────
    def _music_list(self):
        if MUSIC_ROOT is None:
            return self._json({"folder": None, "tracks": []})
        tracks = []
        for f in sorted(MUSIC_ROOT.iterdir()):
            if f.is_file() and f.suffix.lower() in AUDIO_EXT:
                tracks.append({"file": f.name,
                               "name": f.stem.replace("_", " ").replace("-", " ").strip(),
                               "bytes": f.stat().st_size})
        return self._json({"folder": str(MUSIC_ROOT), "tracks": tracks})

    def _music_file(self):
        if MUSIC_ROOT is None:
            return self._plain(404, "no music folder configured")
        name = urllib.parse.unquote(self.path.split("?", 1)[0][len("/music/"):])
        target = (MUSIC_ROOT / name).resolve()
        # same path-traversal guard as static, against the music root
        if not str(target).startswith(str(MUSIC_ROOT)) or not target.is_file():
            return self._plain(404, "not found")
        if target.suffix.lower() not in AUDIO_EXT:
            return self._plain(403, "not an audio file")

        size = target.stat().st_size
        ctype = MIME.get(target.suffix.lower(), "application/octet-stream")
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        partial = False
        if rng and rng.startswith("bytes="):
            # audio elements seek with Range; without this, scrubbing breaks
            try:
                a, _, b = rng[6:].partition("-")
                if a:
                    start = int(a)
                    if b:
                        end = min(int(b), size - 1)
                elif b:
                    start = max(0, size - int(b))
                partial = 0 <= start <= end < size
            except ValueError:
                partial = False
        with target.open("rb") as fh:
            fh.seek(start)
            body = fh.read(end - start + 1) if partial else fh.read()
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass                       # the browser seeked away mid-send

    def _json(self, obj: dict, code: int = 200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ── /api proxy ───────────────────────────────────────────────────────
    def _proxy(self, method: str):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(
            HUE_BASE + self.path, data=body, method=method,
            headers={"Content-Type": self.headers.get("Content-Type") or "application/json"},
        )
        try:
            # Short timeout on purpose: the browser allows only ~6 connections per
            # origin, so a slow/dead Hue app must not hold slots hostage — that
            # starves the SSE streams (dashboard stuck "connecting").
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (urllib.error.URLError, OSError):
            # Hue app not running — tell the front-end, don't crash
            payload = json.dumps({"error": "hue server unreachable at " + HUE_BASE}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    # ── nav relay ────────────────────────────────────────────────────────
    def _nav_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
            action = data.get("action")
        except json.JSONDecodeError:
            action = None
        if action not in ("up", "down", "select", "back", "tap"):
            return self._plain(400, "action must be up|down|select|back|tap")
        publish_nav(action)
        self._plain(204, "")

    # -- the unified gesture endpoint: listen.py POSTs here, and ONLY here ----
    # One mode, one endpoint. listen.py no longer decides what a button MEANS - it
    # says which button did what, and this is where meaning is derived and addressed.
    # POST /nav and /party/pub stay exactly as they were for the dashboard and for
    # anything already posting to them; a legacy consumer that ignores `focus`
    # behaves precisely as it does today.
    def _input_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        role, event = data.get("role"), data.get("event")
        if role not in ("power", "up", "down", "hue"):
            return self._plain(400, "role must be power|up|down|hue")
        if not isinstance(event, str) or not event:
            return self._plain(400, "event must be a non-empty string")
        self._json(publish_input(role, event))

    # -- focus: claim / heartbeat / release / report --------------------------
    def _focus_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        owner = data.get("owner")
        if not isinstance(owner, str) or not owner:
            return self._plain(400, "owner must be a non-empty string")
        if data.get("release"):
            release_focus(owner)
        else:
            claim_focus(owner)
        self._json({"owner": nav_focus(), "ttl": round(nav_focus_ttl(), 2),
                    "heartbeat": FOCUS_HEARTBEAT})

    def _focus_get(self):
        self._json({"owner": nav_focus(), "ttl": round(nav_focus_ttl(), 2),
                    "heartbeat": FOCUS_HEARTBEAT})

    def _nav_stream(self):
        # The queue is registered BEFORE the response headers go out, and that ordering is
        # load-bearing: tools/party-tests/navrelay.test.js treats "headers received" as
        # "subscribed" when it attaches two readers before posting. Reshuffle this and the
        # suite goes intermittently green-then-red for a reason nothing points at.
        # ?owner=<id> names the surface behind this stream. It is what lets `tap`
        # be delivered to a CONNECTED arcade regardless of focus (see publish_input);
        # a subscriber that does not name itself simply never qualifies for that
        # bypass and filters on `focus` like everything else.
        q: queue.Queue = queue.Queue(maxsize=64)
        try:
            qs = urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
            q.owner = (qs.get("owner") or [None])[0]
        except (IndexError, ValueError):
            q.owner = None
        with _sub_lock:
            _subscribers.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            while True:
                try:
                    item = q.get(timeout=15)
                    # queue items are the full stamped event dict now (action + focus +
                    # the raw gesture); a bare string can still arrive from a legacy
                    # publish_nav caller, so it is normalised rather than assumed.
                    if not isinstance(item, dict):
                        item = {"action": item, "focus": nav_focus()}
                    msg = f"data: {json.dumps(item)}\n\n"
                except queue.Empty:
                    msg = ": keepalive\n\n"
                self.wfile.write(msg.encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with _sub_lock:
                if q in _subscribers:
                    _subscribers.remove(q)

    # ── operator relay (the Basement) ────────────────────────────────────
    # Payload is a full JSON object, not just a string:
    #   {"kind":"push","var":"trust","delta":-0.2}
    #   {"kind":"event","name":"fire-alarm"}
    def _op_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        kind = data.get("kind")
        if kind == "push":
            if not isinstance(data.get("var"), str):
                return self._plain(400, "push needs var")
            try:
                data["delta"] = float(data.get("delta", 0))
            except (TypeError, ValueError):
                return self._plain(400, "delta must be a number")
        elif kind == "event":
            if not isinstance(data.get("name"), str):
                return self._plain(400, "event needs name")
        else:
            return self._plain(400, "kind must be push|event")
        publish_op(data)
        self._plain(204, "")

    def _op_stream(self):
        q: queue.Queue = queue.Queue(maxsize=64)
        with _op_lock:
            _op_subscribers.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            while True:
                try:
                    obj = q.get(timeout=15)
                    msg = f"data: {json.dumps(obj)}\n\n"
                except queue.Empty:
                    msg = ": keepalive\n\n"
                self.wfile.write(msg.encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with _op_lock:
                if q in _op_subscribers:
                    _op_subscribers.remove(q)

    # ── party relay (dashboard <-> party.html) ───────────────────────────
    def _party_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        publish_party(data)
        self._plain(204, "")

    def _party_stat(self):
        # Subscriber count for the party channel. Exists so a driver script can PRE-FLIGHT
        # instead of publishing into the void: with no page subscribed, every command is
        # accepted (204) and silently discarded, so a full session can "succeed" while the
        # room never changes. That happened — showreel.py ran a whole reel against an empty
        # relay on 2026-07-28 and the slate stayed white and flat. Same failure family as the
        # Hue-branch trap: everything answers 200, nothing happens.
        with _party_lock:
            n = len(_party_subscribers)
        self._json({"subscribers": n})

    def _party_stream(self):
        q: queue.Queue = queue.Queue(maxsize=64)
        with _party_lock:
            _party_subscribers.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            while True:
                try:
                    obj = q.get(timeout=15)
                    msg = f"data: {json.dumps(obj)}\n\n"
                except queue.Empty:
                    msg = ": keepalive\n\n"
                self.wfile.write(msg.encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with _party_lock:
                if q in _party_subscribers:
                    _party_subscribers.remove(q)

    # ── play relay (phone controllers <-> a room's host screen) ────────────
    def _join_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        room = data.get("room")
        if not isinstance(room, str) or not room:
            return self._plain(400, "room must be a non-empty string")
        if not _has_host(room):
            return self._json({"error": "no screen"}, code=404)
        with _rooms_lock:
            rec = _rooms.setdefault(room, {"seq": 0})
            rec["seq"] += 1
            n = rec["seq"]
        self._json({"player": f"p{n}", "room": room})

    def _intent_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        room, player, iid = data.get("room"), data.get("player"), data.get("id")
        if not isinstance(room, str) or not room:
            return self._plain(400, "room must be a non-empty string")
        if not isinstance(iid, str) or not iid:
            return self._plain(400, "id must be a non-empty string")
        if not _valid_intent_value(data.get("value")):
            return self._plain(400, "value must be a number, bool, list of numbers, or {x,y}")
        publish_play(room, "host", {"type": "intent", "player": player, "id": iid, "value": data.get("value")})
        self._plain(204, "")

    def _play_post(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._plain(400, "bad json")
        if not isinstance(data, dict):
            return self._plain(400, "expected a json object")
        room = data.get("room")
        if not isinstance(room, str) or not room:
            return self._plain(400, "room must be a non-empty string")
        player = data.get("player")   # optional: target ONE phone; absent = the whole room
        if player is not None and not isinstance(player, str):
            return self._plain(400, "player must be a string when present")
        publish_play(room, "phone", data, player=player)
        self._plain(204, "")

    def _play_stat(self):
        try:
            qs = urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
        except (IndexError, ValueError):
            qs = {}
        room = (qs.get("room") or [None])[0]
        with _play_lock:
            phones = sum(1 for q in _play_subscribers
                         if getattr(q, "room", None) == room and getattr(q, "role", None) == "phone")
            host = any(getattr(q, "room", None) == room and getattr(q, "role", None) == "host"
                       for q in _play_subscribers)
        self._json({"phones": phones, "host": host})

    def _play_stream(self):
        q: queue.Queue = queue.Queue(maxsize=64)
        try:
            qs = urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
        except (IndexError, ValueError):
            qs = {}
        room = (qs.get("room") or [None])[0]
        role = (qs.get("role") or [None])[0]
        player = (qs.get("player") or [None])[0]
        q.room, q.role, q.player = room, role, player
        if role == "host" and room:
            with _rooms_lock:
                _rooms.setdefault(room, {"seq": 0})
        with _play_lock:
            _play_subscribers.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            if role == "phone" and room:
                # subscribing IS presence: the join announcement, not a separate message
                publish_play(room, "host", {"type": "join", "player": player})
            while True:
                try:
                    obj = q.get(timeout=15)
                    msg = f"data: {json.dumps(obj)}\n\n"
                except queue.Empty:
                    msg = ": keepalive\n\n"
                self.wfile.write(msg.encode())
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with _play_lock:
                if q in _play_subscribers:
                    _play_subscribers.remove(q)

    # ── helpers ──────────────────────────────────────────────────────────
    def _drain_body(self):
        """Read and discard any request body. A handler that responds to a POST/DELETE
        WITHOUT reading the body leaves those bytes in the keep-alive socket, and they get
        glued to the next request line — the browser then sees a 501 'Unsupported method'
        with the previous JSON body prepended, and the connection is poisoned. Every path
        that answers a body-carrying method without parsing the body must drain it first;
        the 404 fallthroughs are the ones that used to forget (an old server with no
        /play route did exactly this)."""
        try:
            n = int(self.headers.get("Content-Length") or 0)
            while n > 0:
                chunk = self.rfile.read(min(n, 65536))
                if not chunk:
                    break
                n -= len(chunk)
        except (ValueError, OSError):
            pass

    def _plain(self, code: int, text: str):
        body = text.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)


def lan_ip() -> str:
    """The address a PHONE must type. Not 127.0.0.1, not gethostbyname (which returns
    a stale/VPN adapter on this box — there are five 169.254.* link-local adapters).
    Opening a UDP socket toward a public address makes Windows pick the interface it
    would actually route over; nothing is sent."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # A browser closing an SSE stream or a keep-alive socket is normal, not an
        # error — without this every reconnect dumps a WinError 10053 traceback.
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)


def main():
    if not WEB_ROOT.is_dir():
        raise SystemExit(f"web/ not found at {WEB_ROOT} — run from the project root or controller/")
    server = Server(("0.0.0.0", PORT), Handler)
    print("Deep House")
    print(f"  serving   {WEB_ROOT}")
    print(f"  proxying  /api/* -> {HUE_BASE}")
    # 127.0.0.1, not localhost: this banner is where the URL gets copied from, and
    # "localhost" costs ~2s per connection on Windows (::1 first, IPv4-only bind). The
    # banner was teaching the exact trap the rest of this file was fixed for.
    print(f"  catalogue http://127.0.0.1:{PORT}/")
    print(f"  house     http://127.0.0.1:{PORT}/house.html")
    print(f"  displays  http://127.0.0.1:{PORT}/display.html")
    print("  (use 127.0.0.1, never localhost — see the HUE_BASE note above)")
    ip = lan_ip()
    print(f"  PHONES    http://{ip}:{PORT}/play.html      <- same Wi-Fi, type this")
    print(f"  room host http://{ip}:{PORT}/room.html")
    if MUSIC_ROOT:
        n = sum(1 for f in MUSIC_ROOT.iterdir()
                if f.is_file() and f.suffix.lower() in AUDIO_EXT)
        print(f"  music     {MUSIC_ROOT}  ({n} tracks)")
    else:
        print("  music     none — set controller/config.json musicFolder "
              "or DEEPHOUSE_MUSIC (the piece runs silent)")
    print(f"  nav relay POST /nav  ->  SSE /nav/stream")
    print("Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
