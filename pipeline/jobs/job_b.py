"""
job_b.py — the second nightly job: the briefing, and the dead-man check (plan §2.1, P3, Appendix C).

Cron `25 0 * * 2-6` UTC = 8:25pm EDT / 7:25pm EST. Job B owns the healthchecks.io dead-man switch:
it pings `/start`, does its work, and pings success only on success paths. A crash between the two
pings is exactly what the check is there to notice.

The evening flow (plan P3 step 2):
  preflight (a non-session night — weekend or NYSE holiday — logs, skips the briefing, and still
  pings success: nothing to brief is a healthy outcome the monitor still expects a ping for)
  → ping `/start`
  → collect the extraction batch Job A submitted, synthesize the briefing, run the deterministic
    verification gate, and publish it (all in briefing.evening.run_briefing, dependency-injected)
  → the weekly database backup, on Fridays
  → revalidate the Desk
  → ping success.

A held or synthesis-failed night still publishes a briefing row (status "held") so the Desk shows
"briefing unavailable" over the verified scans. A night with no Anthropic key configured skips the
briefing and still runs the backup and the dead-man ping — the pipeline is designed to come up
key-free during buildout.

Deferred within P3 (logged in DECISIONS.md): the live late-news delta sweep. The batch already
captures the day's news; re-fetching late-breaking news would also have to re-persist those articles
so their briefing citations resolve. The batch-cutoff fallback — the critical timing mechanism — is
built and tested; the late sweep is a refinement to add once the loop has run for real.
"""

from __future__ import annotations

import sys
import tempfile
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import psycopg

import backup
import publish as pub
from briefing.evening import BriefingDeps, run_briefing
from briefing.stats import build_stats
from config import Settings, load_settings
from monitoring import ping
from trading_calendar import is_trading_session

# The market's clock — the weekly backup runs on the Friday-evening run (end of the trading week).
_MARKET_TZ = ZoneInfo("America/New_York")
_WEEKLY_BACKUP_WEEKDAY = 4  # Monday is 0; Friday is 4.

# How far back to read the night's news for the batch remainder (matches Job A's ingest window).
_NEWS_WINDOW_DAYS = 3
# How far ahead the calendar stats reach, and how many events to include.
_CALENDAR_AHEAD_DAYS = 14
_CALENDAR_LIMIT = 12

# The batch-collection budget: Job B starts near 00:25 UTC and stops waiting on the batch 15 minutes
# later, at ~00:40 UTC (the Appendix C cutoff), then finishes the remainder synchronously.
_COLLECT_BUDGET_SECONDS = 15 * 60


def main() -> int:
    """Run the evening job and keep the dead-man check fed. Returns a process exit code (always 0 on
    the success paths; a raise between the pings is what alarms the monitor)."""
    settings = load_settings()
    ping_url = settings.require("healthchecks_ping_url")
    run_date = datetime.now(_MARKET_TZ).date()

    if not is_trading_session(run_date):
        # A weekend or NYSE holiday — nothing to brief. Still ping success (Appendix C).
        print(f"job_b: {run_date.isoformat()} is not a trading session; nothing to brief.")
        ping(ping_url)
        return 0

    ping(ping_url, "/start")

    with psycopg.connect(settings.database_url_psycopg) as conn:
        outcome = _run_briefing(settings, conn, run_date)
    print(f"job_b: briefing {outcome}.")

    if run_date.weekday() == _WEEKLY_BACKUP_WEEKDAY:
        with tempfile.TemporaryDirectory() as work_dir:
            key = backup.run_weekly_backup(settings, run_date, work_dir)
        print(f"job_b: weekly backup uploaded to R2 as {key}.")

    _revalidate_desk(settings)
    ping(ping_url)  # success — only reached if the work above did not raise
    return 0


def _run_briefing(settings: Settings, conn: psycopg.Connection, run_date: date) -> str:
    """Collect the batch, synthesize, verify, and publish the briefing. Returns a short status word
    for the log. Skips (without a row) when no key is configured or there is nothing to brief."""
    if not settings.anthropic_api_key:
        print("job_b: ANTHROPIC_API_KEY not set; skipping the briefing (data already published).")
        return "skipped (no key)"

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    stats = build_stats(
        market_context=_read_market_context(conn, run_date),
        movers=_read_movers(conn, run_date),
        calendar=_read_calendar(conn, run_date),
        run_date=run_date,
    )

    start = time.monotonic()
    deps = BriefingDeps(
        run_date=run_date,
        anthropic=client,
        batched_items=_read_news(conn, run_date),
        stats=stats,
        instruments=_read_instruments(conn),
        publish=lambda **kw: pub.publish_briefing(conn, **kw),
        batch_id=_read_batch_id(conn, run_date),
        model_extract=settings.model_extract,
        model_synth=settings.model_synth,
        late_news=None,  # deferred within P3 — see the module docstring
        clock=lambda: time.monotonic() - start,
        cutoff=_COLLECT_BUDGET_SECONDS,
    )
    result = run_briefing(deps)
    return f"{result.status} ({result.extract_count} extracts, {result.flag_count} flags)"


# ----- database reads -----

def _read_batch_id(conn: psycopg.Connection, run_date: date) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT batch_id FROM pipeline_run WHERE run_date = %s", (run_date,))
        row = cur.fetchone()
    return row[0] if row else None


def _read_news(conn: psycopg.Connection, run_date: date) -> list[dict]:
    """The night's news, as article dicts for the extraction remainder (id lines up with the batch
    custom_id). Read over the same window Job A ingested."""
    since = run_date - timedelta(days=_NEWS_WINDOW_DAYS)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, headline, snippet, url, tickers FROM news_item WHERE published_at >= %s",
            (since,),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "headline": r[1], "snippet": r[2], "url": r[3], "tickers": list(r[4] or [])}
        for r in rows
    ]


def _read_market_context(conn: psycopg.Connection, run_date: date) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT vix, ten_year, advancers, decliners, pct_above_50dma "
            "FROM market_context WHERE run_date = %s",
            (run_date,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {"vix": row[0], "ten_year": row[1], "advancers": row[2], "decliners": row[3],
            "pct_above_50dma": row[4]}


def _read_movers(conn: psycopg.Connection, run_date: date) -> list[dict]:
    """The volume-confirmed movers, from the unusual-volume scan, with their return and rvol."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT symbol, metrics FROM scan_result "
            "WHERE run_date = %s AND preset_key = 'unusual-volume' ORDER BY rank",
            (run_date,),
        )
        rows = cur.fetchall()
    movers: list[dict] = []
    for symbol, metrics in rows:
        metrics = metrics or {}
        movers.append({"symbol": symbol, "ret_1": metrics.get("ret_1"), "rvol20": metrics.get("rvol20")})
    return movers


def _read_calendar(conn: psycopg.Connection, run_date: date) -> list[dict]:
    ahead = run_date + timedelta(days=_CALENDAR_AHEAD_DAYS)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT title, symbol, consensus, prior, date FROM calendar_event "
            "WHERE date >= %s AND date <= %s ORDER BY date LIMIT %s",
            (run_date, ahead, _CALENDAR_LIMIT),
        )
        rows = cur.fetchall()
    return [
        {"title": r[0], "symbol": r[1], "consensus": r[2], "prior": r[3], "date": r[4]}
        for r in rows
    ]


def _read_instruments(conn: psycopg.Connection) -> frozenset[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT symbol FROM instrument")
        rows = cur.fetchall()
    return frozenset(r[0] for r in rows)


def _revalidate_desk(settings: Settings) -> None:
    """Ask the app to refresh its cached morning payload after publishing the briefing (best-effort;
    the six-hour time fallback covers a failure, so this is logged, not raised)."""
    base = settings.app_base_url
    secret = settings.cron_secret
    if not base or not secret:
        print("job_b: APP_BASE_URL or CRON_SECRET not set; skipping the Desk revalidation.")
        return
    try:
        response = httpx.post(f"{base.rstrip('/')}/api/revalidate", params={"secret": secret}, timeout=15)
        response.raise_for_status()
        print("job_b: asked the app to revalidate the Desk.")
    except Exception as error:  # noqa: BLE001 — revalidation is best-effort; the time fallback covers it
        print(f"job_b: Desk revalidation failed ({error}); the app will refresh on its time fallback.")


if __name__ == "__main__":
    sys.exit(main())
