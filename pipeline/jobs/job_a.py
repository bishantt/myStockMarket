"""
job_a.py — the first of the two nightly jobs (plan §2.1, Appendix C).

Cron `37 22 * * 1-5` UTC = 6:37pm EDT / 5:37pm EST, after the US close. In the full pipeline Job A
does the heavy lifting: preflight, full-universe EOD ingest, context ingest, compute, and submit
the LLM extraction batch. At P0 it is a hello-run: it writes one `pipeline_run` row so the loop is
provably end-to-end — a cloud cron wrote to the database, and the app can read it — with nothing
having run on the user's hardware.

Job A does not touch healthchecks.io. Its failures surface as GitHub Actions failure e-mails (a
non-zero exit); the dead-man check belongs to Job B, whose cron matches it (Appendix C).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import psycopg

from config import load_settings

# The market's clock. run_date is the US trading day, so it must be computed in Eastern time —
# the job runs at 22:37 UTC, which is the same calendar day in New York, but pinning the zone
# keeps that true rather than accidental. Proper trading-calendar logic (holidays, half-days via
# exchange_calendars) arrives in P1; a hello-run only needs the date.
_MARKET_TZ = ZoneInfo("America/New_York")

# Upsert by run_date, so re-running a night updates that day's row rather than inserting a
# duplicate — the pipeline is idempotent by trading date (plan §2.1, P1 stage-skip resume).
_UPSERT_SQL = """
    INSERT INTO pipeline_run (run_date, started_at, finished_at, stage_status, source_status)
    VALUES (%(run_date)s, %(started_at)s, %(finished_at)s, %(stage_status)s, %(source_status)s)
    ON CONFLICT (run_date) DO UPDATE SET
        finished_at = EXCLUDED.finished_at,
        stage_status = EXCLUDED.stage_status,
        source_status = EXCLUDED.source_status
"""


def main() -> None:
    """Write the hello-run row and report it. Raises on any failure, so the workflow goes red."""
    settings = load_settings()

    run_date = datetime.now(_MARKET_TZ).date()
    started_at = datetime.now(timezone.utc)

    # At P0 there are no stages or sources yet — these JSON maps grow as the pipeline does. The
    # hello marker makes it obvious in the database that this row came from the skeleton run.
    stage_status = {"hello": "ok"}
    source_status: dict[str, str] = {}

    with psycopg.connect(settings.database_url_psycopg) as conn:
        with conn.cursor() as cur:
            cur.execute(
                _UPSERT_SQL,
                {
                    "run_date": run_date,
                    "started_at": started_at,
                    "finished_at": datetime.now(timezone.utc),
                    "stage_status": json.dumps(stage_status),
                    "source_status": json.dumps(source_status),
                },
            )
        conn.commit()

    print(f"job_a: wrote pipeline_run for {run_date.isoformat()} (hello-run).")


if __name__ == "__main__":
    main()
