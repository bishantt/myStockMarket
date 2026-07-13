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
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import psycopg

import publish as pub
from adapters.alpaca import AlpacaAdapter
from adapters.base import TokenBucket
from adapters.fred import FredAdapter
from briefing.extract import submit_batch
from catalyst_ingest import build_catalyst_fetcher
from config import Settings, load_settings
from nightly import MacroRead, NightlyDeps, run_nightly
from parquet_store import ParquetStore
from storage import R2Store
from trading_calendar import previous_session
from universe import CORE_SERVED

# The market's clock: run_date is the US trading day, computed in Eastern time. Proper trading-day
# handling (holidays, half-days via exchange_calendars) lands with the horizon work; at P1 the job
# runs on weekday evenings and the calendar date in New York is the trading day.
_MARKET_TZ = ZoneInfo("America/New_York")

# Five years of history is what the indicators and forward-return work need (plan Appendix A).
_HISTORY_DAYS = 365 * 5 + 2

# Alpaca's multi-symbol bar endpoint takes a comma-joined symbol list; this caps how many go in one
# request so the URL stays well within limits. The universe is fetched in chunks of this size.
_BAR_CHUNK = 100

# FRED series for the macro strip (plan §9.2, redesign §6.1): the VIX, the 10-year Treasury yield,
# and the three index LEVELS. The levels matter for honesty, not decoration: before the redesign the
# Desk printed the SPY ETF's price under the label "S&P 500", so it read "754.94" when the index was
# near 6,800. An ETF tracks its index's percentage move, never its level. These series carry the
# real thing. (Russell 2000 has no free FRED daily series, so the small-caps slot stays an ETF proxy
# and says so on-surface — Appendix E-1.)
_VIX_SERIES = "VIXCLS"
_TEN_YEAR_SERIES = "DGS10"
_SP500_SERIES = "SP500"
_NASDAQ_SERIES = "NASDAQCOM"
_DJIA_SERIES = "DJIA"

# Where the Parquet lake lives on the runner before it is synced to R2. Overridable for local runs.
_PARQUET_ROOT = os.environ.get("MSM_PARQUET_ROOT", "parquet-store")

# The served core (the index ETFs and the sector SPDRs) now lives in universe.py, because the
# calendar's earnings-importance rule needs it too. The user's watchlist is added at run time.


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
    """Return the macro reader: the two context cells plus the three index levels and their priors.

    Every series is read independently and every failure degrades only its own cell to None. A slot
    whose level is missing falls back downstream to its ETF proxy, labelled as one — the app never
    prints an ETF price under an index name (redesign §6.1)."""

    def read() -> MacroRead:
        sp500, sp500_prior = _latest_pair(fred, _SP500_SERIES)
        nasdaq, nasdaq_prior = _latest_pair(fred, _NASDAQ_SERIES)
        djia, djia_prior = _latest_pair(fred, _DJIA_SERIES)
        return MacroRead(
            vix=_latest(fred, _VIX_SERIES),
            ten_year=_latest(fred, _TEN_YEAR_SERIES),
            sp500=sp500,
            sp500_prior=sp500_prior,
            nasdaq_composite=nasdaq,
            nasdaq_composite_prior=nasdaq_prior,
            djia=djia,
            djia_prior=djia_prior,
        )

    return read


def _latest(fred: FredAdapter, series_id: str) -> float | None:
    """One FRED series' latest value, or None if FRED is unreachable — the macro cell degrades, the
    night does not fail (plan §2: sources degrade independently)."""
    try:
        return fred.latest_value(series_id).value
    except Exception as error:  # noqa: BLE001 — a macro-cell outage must not fail the night
        print(f"job_a: FRED {series_id} unavailable ({error}); the macro cell will show '—'.")
        return None


def _latest_pair(fred: FredAdapter, series_id: str) -> tuple[float | None, float | None]:
    """One index series' latest level and the level before it, as (level, prior).

    Both are needed to state a one-day change honestly. A series with only one real observation
    returns (level, None) — the level still prints, and the change renders "—" rather than being
    borrowed from an ETF. A FRED outage returns (None, None) and the slot falls back to its proxy.
    """
    try:
        observations = fred.latest_two(series_id)
    except Exception as error:  # noqa: BLE001 — an index-level outage must not fail the night
        print(f"job_a: FRED {series_id} unavailable ({error}); that slot will fall back to its ETF proxy.")
        return (None, None)

    level = observations[0].value if len(observations) >= 1 else None
    prior = observations[1].value if len(observations) >= 2 else None
    return (level, prior)


def _build_submit_extraction(settings: Settings):
    """Return a callable that submits the night's news as an extraction batch, or None if no
    Anthropic key is configured (the briefing simply degrades — the data still publishes).

    Built lazily so the pipeline runs key-free during buildout: only when ANTHROPIC_API_KEY is
    present does Job A submit a batch. The import is local so a missing anthropic package never
    breaks a key-free night.
    """
    if not settings.anthropic_api_key:
        print("job_a: ANTHROPIC_API_KEY not set; skipping the extraction batch (briefing degrades).")
        return None

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    model = settings.model_extract

    def submit(news_items: list[dict]) -> str:
        return submit_batch(client, news_items, model=model)

    return submit


def _read_served_symbols(conn: psycopg.Connection):
    """Return a reader for the served symbol set: the fixed core plus the user's current watchlist."""

    def read() -> list[str]:
        with conn.cursor() as cur:
            cur.execute("SELECT symbol FROM watchlist_item")
            watchlist = [row[0] for row in cur.fetchall()]
        return sorted(set(CORE_SERVED) | set(watchlist))

    return read


# ── run modes ────────────────────────────────────────────────────────────────────────────────
#
# What each mode is allowed to touch. These are CONSTANTS on purpose: a mode is a promise about what
# a run will and will not do — "macro mode does not ingest bars" is the whole reason it is safe to
# run at dawn, and later (N6) safe to hand the user a button for. A mode that could silently grow a
# stage would quietly break that promise with nobody the wiser, so the lists are pinned and a unit
# test guards them.
#
# N4 adds `news` and `compute` here; N6 wires the panel to them.
MODE_STAGES: dict[str, tuple[str, ...]] = {
    "full": ("ingest", "compute", "scan", "catalysts", "publish", "revalidate"),
    "macro": ("macro", "publish", "revalidate"),
}


def parse_mode(argv: list[str]) -> str:
    """Read `--mode X` out of argv, defaulting to the full nightly.

    An unknown mode raises rather than falling back to "full": a typo in a workflow file must not
    silently turn a 6am three-number refresh into a whole market ingest.
    """
    if "--mode" not in argv:
        return "full"
    mode = argv[argv.index("--mode") + 1]
    if mode not in MODE_STAGES:
        raise ValueError(f"job_a: unknown mode {mode!r} — expected one of {sorted(MODE_STAGES)}")
    return mode


def run_macro_mode(settings: Settings) -> None:
    """The dawn run: re-read FRED and update the last session's index levels. Nothing else.

    FRED posts the index closes after both nightly jobs have run (the Nasdaq Composite lands around
    11:38pm ET, against Job A at 6:37pm), so the levels the night stored are structurally one session
    behind by the time the user reads the Desk. This run goes back and fixes them, and it is the
    reason the morning Desk shows a real prior close instead of a dated one.

    It updates the PREVIOUS session, not today: at 6am the market has not opened, so the close being
    fetched belongs to the session before this one.
    """
    fred = _fred(settings)
    session = previous_session(datetime.now(_MARKET_TZ).date())
    macro = _read_macro(fred)()

    with psycopg.connect(settings.database_url_psycopg) as conn:
        updated = pub.publish_macro(conn, run_date=session, macro=macro.as_columns())

    if not updated:
        # No nightly has written this session yet. There is nothing to correct, and we will NOT
        # create a row: market_context's breadth is NOT NULL because a night that ingested the market
        # always knows how many names advanced, and a macro-only run does not.
        print(f"job_a[macro]: no market_context row for {session.isoformat()} yet — nothing to update.")
        return

    _revalidate_desk(settings)
    levels = "complete" if macro.has_every_index_level() else "PARTIAL — some index series did not answer"
    print(
        f"job_a[macro]: {session.isoformat()} index levels refreshed ({levels}); "
        f"vix={macro.vix} ten_year={macro.ten_year} sp500={macro.sp500}."
    )


def main() -> None:
    """Build the real collaborators and run one night. Raises on any failure, so the workflow goes red."""
    settings = load_settings()

    mode = parse_mode(sys.argv[1:])
    if mode == "macro":
        run_macro_mode(settings)
        return

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
            fetch_catalysts=build_catalyst_fetcher(settings, run_date),
            submit_extraction=_build_submit_extraction(settings),
            publish_analytics=pub.publish_analytics,
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
