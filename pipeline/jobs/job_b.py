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

import os
import sys
import tempfile
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import psycopg

import polars as pl

import backup
import publish as pub
import resolve
from briefing.evening import BriefingDeps, run_briefing
from briefing.stats import build_stats
from config import Settings, load_settings
from monitoring import ping
from parquet_store import PRICES, ParquetStore
from storage import R2Store
from trading_calendar import is_trading_session, latest_closed_session

# Where the Parquet lake is synced on the runner (mirrors job_a). The resolver reads closes from it.
_PARQUET_ROOT = os.environ.get("MSM_PARQUET_ROOT", "parquet-store")

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


def briefing_edition(now: datetime, latest_run: date | None) -> date | None:
    """
    The edition this briefing addresses — or None if there is nothing honest to write.

    A BRIEFING IS THE FRONT OF AN EDITION, NOT A DIARY ENTRY (POLISH-AND-DEPTH-PLAN Part 3.1).

    The old code stamped the briefing with the wall clock, exactly as job A did, and the two agreed
    every night the cron ran — 8:25pm ET, same day, same date. They came apart the moment anything
    ran off-schedule, and the failure was silent both ways:

      - dispatched at 1:00am Tuesday, the briefing was stamped TUESDAY and then went looking for
        Tuesday's market context, movers and calendar. There are none. It would brief the void.
      - dispatched on a night when JOB A HAD FAILED, it would be stamped tonight, find no data for
        tonight, and write a "held" row for an edition that does not exist — while the edition that
        does exist (last night's) sat there already briefed.

    So the briefing asks two questions and needs both answers to agree: which session has closed
    (the market's clock), and which edition is actually on the table (the newest `pipeline_run`). If
    the newest edition is not the one that just closed, job A did not run tonight, and the right
    thing to write is nothing. Re-briefing an older edition would overwrite a good brief with a new
    synthesis of the same day, at tonight's hour, looking freshly considered — a lie about when the
    paper was written. Job A's own failure already rang the alarm; job B's job is not to paper over it.
    """
    if not is_trading_session(now.date()):
        return None
    expected = latest_closed_session(now)
    if latest_run != expected:
        return None
    return expected


def main() -> int:
    """Run the evening job and keep the dead-man check fed. Returns a process exit code (always 0 on
    the success paths; a raise between the pings is what alarms the monitor)."""
    settings = load_settings()
    ping_url = settings.require("healthchecks_ping_url")
    now = datetime.now(_MARKET_TZ)

    if not is_trading_session(now.date()):
        # A weekend or NYSE holiday — nothing to brief. Still ping success (Appendix C).
        print(f"job_b: {now.date().isoformat()} is not a trading session; nothing to brief.")
        ping(ping_url)
        return 0

    ping(ping_url, "/start")

    # The session whose bell has rung. On the cron this is simply tonight; off-schedule it is the
    # last real close, which is the only thing the resolver and the backup can honestly be about.
    session = latest_closed_session(now)

    with psycopg.connect(settings.database_url_psycopg) as conn:
        edition = briefing_edition(now, _read_latest_edition(conn))
        if edition is None:
            # Not an error, and not a ping failure: the dead-man check asks "did job B run?", and it
            # did. What it cannot do is invent an edition. The Desk's own pipeline strip is what
            # tells the reader the paper is late — it grades freshness against their clock, and it
            # will say so without any help from here.
            print(
                f"job_b: no edition published for {session.isoformat()} — job A has not landed "
                f"tonight's run. Skipping the briefing rather than writing one about a night that "
                f"does not exist."
            )
        else:
            outcome = _run_briefing(settings, conn, edition)
            print(f"job_b: briefing {outcome} for the {edition.isoformat()} edition.")

        resolved = _resolve_signals(settings, conn, session)
        print(f"job_b: resolver — {resolved} signal(s) resolved.")

    if session.weekday() == _WEEKLY_BACKUP_WEEKDAY:
        with tempfile.TemporaryDirectory() as work_dir:
            key = backup.run_weekly_backup(settings, session, work_dir)
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


def _resolve_signals(settings: Settings, conn: psycopg.Connection, run_date: date) -> int:
    """Resolve every signal whose horizon has passed, reading closes from the Parquet history lake.

    Loads only the closes the due signals actually need (their symbols on their fire and resolution
    dates), so the resolver never scans the whole lake. If the lake cannot be read (R2 not configured
    on a buildout night), the resolver still runs and records those signals as unresolvable — the
    insert-only track record fills as the data arrives.
    """
    due = resolve.due_signals(conn, run_date)
    if not due:
        return 0
    prices = _load_prices(settings, due)
    return resolve.resolve_due(conn, lambda symbol, day: prices.get((symbol, day)), as_of=run_date)


def _load_prices(settings: Settings, due: list[tuple[str, str, date, date]]) -> dict[tuple[str, date], float]:
    """Load the closes the due signals need from the Parquet lake (synced from R2 first). Returns a
    {(symbol, date): close} map; missing pairs simply resolve to "na"."""
    symbols = sorted({row[1] for row in due})
    dates = sorted({row[2] for row in due} | {row[3] for row in due})
    try:
        store = ParquetStore(_PARQUET_ROOT)
        if settings.r2_account_id:
            R2Store.from_settings(settings).sync_down(store.root, prefix=PRICES)
        frame = (
            store.scan(PRICES)
            .filter(pl.col("symbol").is_in(symbols) & pl.col("date").is_in(dates))
            .select(["symbol", "date", "close"])
            .collect()
        )
        return {(r["symbol"], r["date"]): r["close"] for r in frame.iter_rows(named=True)}
    except Exception as error:  # noqa: BLE001 — a missing lake resolves signals as "na", not a crash
        print(f"job_b: could not read the price lake for resolution ({error}); resolving as available.")
        return {}


# ----- database reads -----

def _read_latest_edition(conn: psycopg.Connection) -> date | None:
    """The newest edition on the table — the `run_date` of the most recent pipeline_run, or None.

    This is what job B briefs. It is asked of the DATABASE rather than the clock because the clock
    does not know whether job A actually landed tonight, and a briefing about a night that was never
    published is a briefing about nothing (see briefing_edition)."""
    with conn.cursor() as cur:
        cur.execute("SELECT run_date FROM pipeline_run ORDER BY run_date DESC LIMIT 1")
        row = cur.fetchone()
    return row[0] if row else None


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
            "SELECT id, headline, snippet, url, tickers, source FROM news_item WHERE published_at >= %s",
            (since,),
        )
        rows = cur.fetchall()
    # `source` (the outlet) rides along for CC10's citation snapshot — publish_briefing freezes it so a
    # news purge never orphans the brief. It plays no part in extraction; it is provenance the brief keeps.
    return [
        {"id": r[0], "headline": r[1], "snippet": r[2], "url": r[3], "tickers": list(r[4] or []), "source": r[5]}
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
