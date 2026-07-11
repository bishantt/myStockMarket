"""
job_b.py — the second nightly job, which owns the dead-man check (plan §2.1, Appendix C).

Cron `25 0 * * 2-6` UTC = 8:25pm EDT / 7:25pm EST. In the full pipeline Job B runs the late-news
sweep, collects the LLM extraction batch, makes the one synthesis call, runs the deterministic
verification gate, publishes in a single transaction, revalidates the app, and pings success.

Job B feeds the healthchecks.io check on schedule, so the dead-man switch is live and never
false-alarms. It pings `/start`, does its work, and pings success. A crash between the two pings is
exactly what the check is there to notice. The briefing pipeline (batch collect, synthesis,
verification gate, publish) lands from P3; what is real now is the healthchecks contract and, from
P1, the weekly database backup.

Once a week — on the Friday-evening run, the end of the trading week — Job B takes a pg_dump of the
serving database and pushes it to R2. If that backup fails, the success ping is NOT sent and the
dead-man check alarms: a broken backup is a real failure worth waking up for. On the other six
nights the backup is skipped and the night is healthy with nothing to do.

The healthchecks contract (Appendix C): a success ping is sent on success paths only. A holiday or
a no-briefing night still counts as success — the monitor expects a ping every scheduled night, and
"nothing to do tonight" is a healthy outcome, not a failure.
"""

from __future__ import annotations

import sys
import tempfile
from datetime import datetime
from zoneinfo import ZoneInfo

import backup
from config import load_settings
from monitoring import ping

# The market's clock — the weekly backup runs on the Friday-evening run (end of the trading week).
_MARKET_TZ = ZoneInfo("America/New_York")
_WEEKLY_BACKUP_WEEKDAY = 4  # Monday is 0; Friday is 4.


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

    # The briefing pipeline (preflight, batch collection, synthesis, verification, publish) lands
    # from P3. What runs now is the weekly backup, on Fridays only.
    run_date = datetime.now(_MARKET_TZ).date()
    if run_date.weekday() == _WEEKLY_BACKUP_WEEKDAY:
        with tempfile.TemporaryDirectory() as work_dir:
            key = backup.run_weekly_backup(settings, run_date, work_dir)
        print(f"job_b: weekly backup uploaded to R2 as {key}.")
    else:
        print("job_b: not the weekly-backup night; feeding the dead-man check.")

    ping(ping_url)  # success — only reached if the work above did not raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
