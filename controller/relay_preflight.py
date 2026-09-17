#!/usr/bin/env python3
"""relay_preflight.py — one check, shared by every script that drives the room.

WHY THIS EXISTS (2026-07-28, the cost):
`showreel.py` ran a full lamp session against an empty relay. Every command is a POST to
`/party/pub`, and the relay answers **204 whether or not any page is subscribed** — it fans out
to whoever is listening, and "nobody" is a valid audience. So the reel completed, reported
nothing wrong, and the room never changed. The slate stayed white and flat.

The expensive part is not the wasted run. It is that the null result is **indistinguishable from
a failed fix**: "the fade still looks wrong" and "nothing was ever driven" produce the same
observation. That is the same trap as the Hue-branch one — everything answers 200, nothing
happens.

`serve.py` therefore exposes `GET /party/stat` → `{"subscribers": N}`, and every driver script
calls `require_subscriber()` before borrowing the room.

DESIGN RULES, both learned the hard way:
  1. **Never block on a missing endpoint.** An older relay has no `/party/stat`. If the check
     itself cannot run, warn and PROCEED — a pre-flight that fails closed on its own absence
     would break working setups, and would then be deleted, and would then catch nothing.
  2. **Refuse only on a definite zero.** `subscribers: 0` is a real, actionable answer. Anything
     ambiguous (timeout, 404, bad JSON, negative) proceeds with a warning.
"""

import json
import sys
import urllib.request

STAT_URL = "http://127.0.0.1:8800/party/stat"


def subscriber_count(url: str = STAT_URL, timeout: float = 2.0) -> int:
    """Return the party-channel subscriber count, or -1 if it cannot be determined."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=timeout) as r:
            return int((json.loads(r.read() or b"{}") or {}).get("subscribers", -1))
    except Exception:
        return -1


def require_subscriber(what: str = "this script", url: str = STAT_URL) -> bool:
    """True to proceed, False to abort. Prints the reason. Never raises.

    `what` names the caller in the message so the operator knows which script stopped.
    """
    n = subscriber_count(url)

    if n < 0:
        print(
            f"! {what}: could not read /party/stat — the relay may predate it.\n"
            "  Proceeding unchecked. If the room stays flat, open /party.html and re-run.\n",
            file=sys.stderr,
        )
        return True

    if n > 0:
        print(f"relay ok — {n} page(s) subscribed.\n")
        return True

    print(
        f"REFUSING TO RUN: the relay has 0 subscribers.\n"
        "\n"
        f"{what} publishes to /party/pub, which answers 204 whether or not anyone is listening.\n"
        "With nothing subscribed this would finish 'successfully' while the room never changed —\n"
        "which reads as 'the fix didn't work' rather than 'nothing was driven'. That has already\n"
        "cost one full session.\n"
        "\n"
        "Fix: open /party.html in a browser (the page is what actually drives the lamps), then\n"
        "re-run. Verify with:  curl http://127.0.0.1:8800/party/stat\n",
        file=sys.stderr,
    )
    return False
