"""
job_b.py — the second nightly job, which owns the dead-man check (plan §2.1, Appendix C).

Cron `25 0 * * 2-6` UTC = 8:25pm EDT / 7:25pm EST. In the full pipeline Job B runs the late-news
sweep, collects the LLM extraction batch, makes the one synthesis call, runs the deterministic
verification gate, publishes in a single transaction, revalidates the app, and pings success.

At P0 it is a stub with one real responsibility: feed the healthchecks.io check on schedule, so
the dead-man switch is live from day one and never false-alarms while later phases are built. It
pings `/start`, does its (currently empty) work, and pings success. A crash between the two pings
is exactly what the check is there to notice.

The healthchecks contract (Appendix C): a success ping is sent on success paths only. A holiday
or a no-briefing night still counts as success here — the monitor expects a ping every scheduled
night, and "nothing to do tonight" is a healthy outcome, not a failure.
"""

from __future__ import annotations

import sys

from config import load_settings
from monitoring import ping


def main() -> int:
    """
    Run the (P0-stub) job and keep the dead-man check fed. Returns a process exit code.

    Returns 0 on success. The healthchecks pings are best-effort and never change the exit code:
    the job's real work succeeding is what matters, and a missed ping only risks a false alarm,
    which is the safe direction.
    """
    settings = load_settings()
    ping_url = settings.require("healthchecks_ping_url")

    ping(ping_url, "/start")

    # P0 stub: there is no briefing pipeline yet. This is where the preflight (XNYS holiday /
    # no-batch-submitted night), batch collection, synthesis, verification, and publish will live
    # from P3. For now the job's whole purpose is to prove the schedule and the monitor work.
    print("job_b: P0 stub — no briefing pipeline yet; feeding the dead-man check.")

    ping(ping_url)  # success
    return 0


if __name__ == "__main__":
    sys.exit(main())
