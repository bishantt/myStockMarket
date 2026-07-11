"""
job_a.py — the first of the two nightly jobs (plan §2.1, Appendix C).

Cron `37 22 * * 1-5` UTC = 6:37pm EDT / 5:37pm EST, after the US close. Job A does the heavy
lifting: it lists the universe, ingests end-of-day bars, computes indicators and scans, reads the
macro context, and publishes the served slice to Postgres — the whole flow lives in nightly.py, and
this file only builds the real collaborators (the Alpaca and FRED adapters, the Parquet store, R2,
the database connection) from settings and hands them to run_nightly.

Job A does not touch healthchecks.io. Its failures surface as GitHub Actions failure e-mails (a
non-zero exit); the dead-man check belongs to Job B, whose cron matches it (Appendix C).
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import psycopg

import publish as pub
from adapters.alpaca import AlpacaAdapter
from adapters.base import TokenBucket
from adapters.fred import FredAdapter
from config import Settings, load_settings
from nightly import NightlyDeps, run_nightly
from parquet_store import ParquetStore
from storage import R2Store

# The market's clock: run_date is the US trading day, computed in Eastern time. Proper trading-day
# handling (holidays, half-days via exchange_calendars) lands with the horizon work; at P1 the job
# runs on weekday evenings and the calendar date in New York is the trading day.
_MARKET_TZ = ZoneInfo("America/New_York")

# Five years of history is what the indicators and forward-return work need (plan Appendix A).
_HISTORY_DAYS = 365 * 5 + 2

# Alpaca's multi-symbol bar endpoint takes a comma-joined symbol list; this caps how many go in one
# request so the URL stays well within limits. The universe is fetched in chunks of this size.
_BAR_CHUNK = 100

# FRED series for the macro strip (plan §9.2): the VIX and the 10-year Treasury yield.
_VIX_SERIES = "VIXCLS"
_TEN_YEAR_SERIES = "DGS10"

# Where the Parquet lake lives on the runner before it is synced to R2. Overridable for local runs.
_PARQUET_ROOT = os.environ.get("MSM_PARQUET_ROOT", "parquet-store")

# The symbols always mirrored into Postgres: the four index ETFs and the eleven sector SPDRs. The
# user's watchlist is added to this at run time. The full universe stays in the Parquet lake.
_CORE_SERVED = (
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
)


def _alpaca(settings: Settings) -> AlpacaAdapter:
    """An Alpaca adapter with auth headers on the client and a ~3/s rate limiter (200/min free tier).

    The data feed defaults to IEX (the free plan's only feed); ALPACA_FEED can override it to "sip"
    once the account has a paid data subscription.
    """
    client = httpx.Client(
        timeout=30,
        headers={
            "APCA-API-KEY-ID": settings.require("alpaca_key_id"),
            "APCA-API-SECRET-KEY": settings.require("alpaca_secret"),
        },
    )
    feed = os.environ.get("ALPACA_FEED", "iex")
    return AlpacaAdapter(client, TokenBucket(rate_per_sec=3.0, capacity=3.0), feed=feed)


def _fred(settings: Settings) -> FredAdapter:
    """A FRED adapter with a 2/s limiter. The adapter reads FRED_KEY from the environment itself."""
    settings.require("fred_key")  # fail loudly here if it is missing, naming the variable
    return FredAdapter(httpx.Client(timeout=30), TokenBucket(rate_per_sec=2.0, capacity=2.0))


def _fetch_bars(alpaca: AlpacaAdapter, run_date: date):
    """Return a bar fetcher that pulls five years of EOD bars for all symbols, in chunks."""
    start = run_date - timedelta(days=_HISTORY_DAYS)

    def fetch(symbols: list[str]) -> dict[str, list]:
        merged: dict[str, list] = {}
        for i in range(0, len(symbols), _BAR_CHUNK):
            chunk = symbols[i : i + _BAR_CHUNK]
            merged.update(alpaca.daily_bars(chunk, start=start, end=run_date))
        return merged

    return fetch


def _read_macro(fred: FredAdapter):
    """Return a macro reader that yields (vix, ten_year), tolerating a FRED outage as (None, None)."""

    def read() -> tuple[float | None, float | None]:
        return (_latest(fred, _VIX_SERIES), _latest(fred, _TEN_YEAR_SERIES))

    return read


def _latest(fred: FredAdapter, series_id: str) -> float | None:
    """One FRED series' latest value, or None if FRED is unreachable — the macro cell degrades, the
    night does not fail (plan §2: sources degrade independently)."""
    try:
        return fred.latest_value(series_id).value
    except Exception as error:  # noqa: BLE001 — a macro-cell outage must not fail the night
        print(f"job_a: FRED {series_id} unavailable ({error}); the macro cell will show '—'.")
        return None


def _read_served_symbols(conn: psycopg.Connection):
    """Return a reader for the served symbol set: the fixed core plus the user's current watchlist."""

    def read() -> list[str]:
        with conn.cursor() as cur:
            cur.execute("SELECT symbol FROM watchlist_item")
            watchlist = [row[0] for row in cur.fetchall()]
        return sorted(set(_CORE_SERVED) | set(watchlist))

    return read


def main() -> None:
    """Build the real collaborators and run one night. Raises on any failure, so the workflow goes red."""
    settings = load_settings()
    run_date = datetime.now(_MARKET_TZ).date()

    alpaca = _alpaca(settings)
    fred = _fred(settings)
    store = ParquetStore(_PARQUET_ROOT)
    r2 = R2Store.from_settings(settings) if settings.r2_account_id else None

    with psycopg.connect(settings.database_url_psycopg) as conn:
        deps = NightlyDeps(
            fetch_universe=lambda: [
                {"symbol": a.symbol, "name": a.name, "exchange": a.exchange}
                for a in alpaca.list_universe()
            ],
            fetch_bars=_fetch_bars(alpaca, run_date),
            read_macro=_read_macro(fred),
            read_served_symbols=_read_served_symbols(conn),
            store=store,
            r2=r2,
            publish=pub.publish,
            conn=conn,
            run_date=run_date,
        )
        result = run_nightly(deps)

    _revalidate_desk(settings)

    print(
        f"job_a: {run_date.isoformat()} — universe {result.universe_size}, "
        f"coverage {result.coverage:.1%}, {result.scan_matches} scan matches, "
        f"{result.served_symbols} served symbols, breadth {result.breadth}."
    )


def _revalidate_desk(settings: Settings) -> None:
    """
    Ask the app to refresh its cached morning payload after publishing (best-effort).

    The Desk reads a cached payload so its LCP stays low; this POST revalidates that cache so the
    next visit sees tonight's data at once. A failure here does not fail the night — the six-hour
    time fallback still refreshes the Desk — so it is logged, not raised. Needs APP_BASE_URL and
    CRON_SECRET (Appendix D); if either is absent the step is skipped with a note.
    """
    base = settings.app_base_url
    secret = settings.cron_secret
    if not base or not secret:
        print("job_a: APP_BASE_URL or CRON_SECRET not set; skipping the Desk revalidation.")
        return
    try:
        response = httpx.post(f"{base.rstrip('/')}/api/revalidate", params={"secret": secret}, timeout=15)
        response.raise_for_status()
        print("job_a: asked the app to revalidate the Desk.")
    except Exception as error:  # noqa: BLE001 — revalidation is best-effort; the time fallback covers it
        print(f"job_a: Desk revalidation failed ({error}); the app will refresh on its time fallback.")


if __name__ == "__main__":
    main()
