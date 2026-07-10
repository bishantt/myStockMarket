"""
healthchecks_drill.py — exercises the dead-man switch on purpose (plan P0 acceptance).

The P0 acceptance asks us to prove the healthchecks.io check actually goes DOWN when the job
fails, then recovers — observed autonomously via the read-only API. We do that with the
"start-without-success" path: a `/start` ping tells healthchecks a run began; if the matching
success ping never arrives within the grace window (45 min), the check flips to DOWN, exactly as
it would for a job that started but crashed or hung. That is a real dead-man scenario and it
takes the grace period rather than the multi-hour wait a missed daily cron would need.

Modes:
  start    send the /start ping — begins the drill; DO NOT follow with success for 45 min.
  status   read the check's current status via the read-only API (prints STATUS=...).
  recover  send the success ping — ends the drill and returns the check to up.

Secrets come from the environment (GitHub Actions secrets): HEALTHCHECKS_PING_URL for the pings,
HEALTHCHECKS_API_KEY (read-only) for the status read. Nothing is printed except the status.
"""

from __future__ import annotations

import os
import sys

import httpx

_CHECK_NAME_FRAGMENT = "nightly-b"


def _ping(suffix: str) -> None:
    url = os.environ["HEALTHCHECKS_PING_URL"].rstrip("/") + suffix
    response = httpx.get(url, timeout=15)
    response.raise_for_status()
    print(f"ping {suffix or '(success)'} -> HTTP {response.status_code}")


def _status() -> None:
    key = os.environ["HEALTHCHECKS_API_KEY"]
    response = httpx.get(
        "https://healthchecks.io/api/v3/checks/",
        headers={"X-Api-Key": key},
        timeout=15,
    )
    response.raise_for_status()
    for check in response.json().get("checks", []):
        if _CHECK_NAME_FRAGMENT in check.get("name", ""):
            print(f"STATUS={check.get('status')} last_ping={check.get('last_ping')}")
            return
    print("STATUS=not-found")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"start", "status", "recover"}:
        print("usage: healthchecks_drill.py [start|status|recover]", file=sys.stderr)
        return 2
    mode = sys.argv[1]
    if mode == "start":
        _ping("/start")
    elif mode == "recover":
        _ping("")
    else:
        _status()
    return 0


if __name__ == "__main__":
    sys.exit(main())
