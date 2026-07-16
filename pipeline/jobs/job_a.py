"""
job_a.py — the first of the two nightly jobs (plan §2.1, Appendix C).

Cron `37 22 * * 1-5` UTC = 6:37pm EDT / 5:37pm EST, after the US close. Job A does the heavy lifting —
list the universe, ingest EOD bars, compute indicators and scans, read the macro context, publish the
served slice to Postgres. The whole flow lives in nightly.py; this file only builds the real collaborators
(Alpaca/FRED adapters, the Parquet store, R2, the database) from settings and hands them to run_nightly.
Job A does not touch healthchecks.io: its failures surface as a non-zero exit (a GitHub Actions e-mail);
the dead-man check is Job B's (Appendix C).
"""

from __future__ import annotations

import os
import sys
from datetime import UTC, date, datetime, timedelta
from typing import Callable, Iterable
from zoneinfo import ZoneInfo

import httpx
import psycopg

import janitor
import macro_stats
import publish as pub
from adapters.alpaca import AlpacaAdapter
from adapters.base import TokenBucket
from adapters.erapi import ErApiAdapter
from adapters.finnhub import FinnhubAdapter
from adapters.fred import FredAdapter
from adapters.goldapi import GoldApiAdapter
from adapters.marketaux import MarketauxAdapter
from adapters.nrb import NrbAdapter
from briefing.depth import Bar, build_calendar_refs, build_ticker_depth
from briefing.extract import submit_batch
from briefing.stats import build_calendar_stats, build_cluster_stats, build_depth_stats
from catalyst_ingest import build_catalyst_fetcher
from config import Settings, load_settings
from macro_stats import MacroStatRow
from newsdesk.ingest import FINNHUB_MARKET_CATEGORIES, MARKETAUX_PAGES, build_night
from newsdesk.narrate import (
    CALL_MAX_RETRIES,
    CALL_TIMEOUT_SECONDS,
    NarrationResult,
    NoteDecision,
    Story,
    run_narration,
)
from newsdesk.rank import TickerMove
from newsdesk.resolve import Instrument as NewsInstrument
from newsdesk.resolve import TickerResolver
from nightly import (
    ComputeDeps,
    FrontPageRead,
    MacroRead,
    MacroStatsRead,
    MoodHistory,
    NightlyDeps,
    run_compute,
    run_nightly,
)
from parquet_store import PRICES, ParquetStore
from storage import R2Store
from trading_calendar import is_trading_session, latest_closed_session, previous_session
from universe import CORE_SERVED

# The market's clock: run_date is the US trading day in Eastern time. Full trading-day handling (holidays,
# half-days) lands with the horizon work; at P1 the weekday NY calendar date is the trading day.
_MARKET_TZ = ZoneInfo("America/New_York")

# Five years of history is what the indicators and forward-return work need (plan Appendix A).
_HISTORY_DAYS = 365 * 5 + 2

# Alpaca's multi-symbol bar endpoint takes a comma-joined list; this caps how many go in one request so the
# URL stays within limits. The universe is fetched in chunks of this size.
_BAR_CHUNK = 100

# FRED series for the macro strip (§9.2, redesign §6.1): the VIX, the 10-year yield, and the three index
# LEVELS. The levels are honesty, not decoration: before the redesign the Desk printed SPY's price under
# "S&P 500", reading "754.94" when the index was near 6,800. (Russell 2000 has no free FRED daily series,
# so the small-caps slot stays an ETF proxy and says so — Appendix E-1.)
_VIX_SERIES = "VIXCLS"
_TEN_YEAR_SERIES = "DGS10"
_SP500_SERIES = "SP500"
_NASDAQ_SERIES = "NASDAQCOM"
_DJIA_SERIES = "DJIA"

# How far back the rupee's window reaches. NRB publishes every calendar day, so a handful always contains
# a published rate — enough to survive a run just after midnight Nepal time without ever reaching so far
# that a dead source could pass as live.
_NRB_WINDOW_DAYS = 5

# Where the Parquet lake lives on the runner before it is synced to R2. Overridable for local runs.
_PARQUET_ROOT = os.environ.get("MSM_PARQUET_ROOT", "parquet-store")

# The served core (the index ETFs and the sector SPDRs) now lives in universe.py, because the
# calendar's earnings-importance rule needs it too. The user's watchlist is added at run time.


def _alpaca(settings: Settings) -> AlpacaAdapter:
    """An Alpaca adapter with auth headers and a ~3/s limiter (200/min free tier). The feed defaults to
    IEX (the free plan's only feed); ALPACA_FEED can override to "sip" with a paid subscription."""
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
    """Return the macro reader: the two context cells plus the three index levels and their priors. Every
    series reads independently and every failure degrades only its own cell to None; a missing level falls
    back downstream to its ETF proxy, labelled as one (redesign §6.1)."""

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
    """One index series' latest level and the level before it, as (level, prior). Both are needed to state a
    one-day change honestly. One real observation returns (level, None) — the level prints, the change is "—",
    never borrowed from an ETF. A FRED outage returns (None, None) and the slot falls back to its proxy.
    """
    try:
        observations = fred.latest_two(series_id)
    except Exception as error:  # noqa: BLE001 — an index-level outage must not fail the night
        print(f"job_a: FRED {series_id} unavailable ({error}); that slot will fall back to its ETF proxy.")
        return (None, None)

    level = observations[0].value if len(observations) >= 1 else None
    prior = observations[1].value if len(observations) >= 2 else None
    return (level, prior)


# ── the macro board (N3, Part 6) ─────────────────────────────────────────────────────────────


def _read_macro_stats(settings: Settings, fred: FredAdapter, run_date: date):
    """
    Return the reader for the board's four EXTERNAL stats: mortgage, CPI, gold, rupee. Every source is
    fetched in its own try/except — a dead GoldAPI costs the gold cell and nothing else, and does not fail
    the night. Each failure writes its own source-status key ("macro-gold_usd"), because one key cannot
    describe two failures (the N1 lesson: a single `fred: ok` stood for a healthy VIX and three missing index
    levels). The Mood gauge is not here: it is computed from the night's own snapshot, not fetched.
    """

    def read() -> MacroStatsRead:
        rows: list[MacroStatRow] = []
        status: dict[str, str] = {}
        fetched_at = datetime.now(UTC)

        def attempt(series_key: str, fetch) -> None:
            """Run one source's fetch; a failure degrades that one cell and says so."""
            try:
                row = fetch()
            except Exception as error:  # noqa: BLE001 — one dead source is one degraded cell
                status[macro_stats.source_status_key(series_key)] = "degraded"
                print(
                    f"job_a: macro stat {series_key} unavailable ({error}); the cell keeps its last "
                    f"stored value and says the source was unreachable tonight."
                )
                return
            status[macro_stats.source_status_key(series_key)] = "ok"
            rows.append(row)

        attempt(macro_stats.MORTGAGE, lambda: _fred_stat(
            fred, macro_stats.MORTGAGE, macro_stats.MORTGAGE_SERIES, fetched_at,
        ))
        attempt(macro_stats.CPI_YOY, lambda: _fred_stat(
            fred, macro_stats.CPI_YOY, macro_stats.CPI_SERIES, fetched_at, units=macro_stats.CPI_UNITS,
        ))
        attempt(macro_stats.GOLD, lambda: _gold_stat(settings, fetched_at))
        attempt(macro_stats.USD_NPR, lambda: _npr_stat(run_date, fetched_at))

        return MacroStatsRead(rows=rows, source_status=status)

    return read


def _fred_stat(
    fred: FredAdapter, series_key: str, series_id: str, fetched_at: datetime, *, units: str | None = None
) -> MacroStatRow:
    """One FRED-sourced board cell: the latest observation and the one before it for the delta. The as-of
    date is the SOURCE's observation date (a Thursday for the mortgage rate, the 1st for CPI), never tonight
    — which is what lets the board show a weekly number without implying it was refreshed nightly.
    """
    observations = fred.latest_two(series_id, units=units)
    if not observations:
        raise ValueError(f"FRED series {series_id} has no real observation")

    latest = observations[0]
    prior = observations[1].value if len(observations) > 1 else None

    return MacroStatRow(
        series_key=series_key,
        as_of_date=latest.date,
        value=latest.value,
        prior=prior,
        as_of_label=macro_stats.label_for(series_key, latest.date),
        source_key="fred",
        fetched_at=fetched_at,
    )


def _gold_stat(settings: Settings, fetched_at: datetime) -> MacroStatRow:
    """
    Gold's spot reference — and the one cell whose key does not exist yet (provisioning row P-5). A missing
    key raises here exactly like a network failure; either way the cell has no value tonight, and what the
    reader sees is decided by what is STORED, not why the fetch failed (history → age note rung 3; none →
    "not yet reported" rung 4, which is what gold honestly says in production today).
    """
    if not settings.goldapi_key:
        raise ValueError(
            "GOLDAPI_KEY is not set (provisioning row P-5) — gold has no source until it lands"
        )

    adapter = GoldApiAdapter(
        httpx.Client(timeout=30),
        TokenBucket(rate_per_sec=1.0, capacity=1.0),
        api_key=settings.goldapi_key,
    )
    quote = adapter.spot()

    return MacroStatRow(
        series_key=macro_stats.GOLD,
        as_of_date=quote.date,
        value=quote.price,
        prior=quote.prior,
        as_of_label=macro_stats.label_for(macro_stats.GOLD, quote.date),
        source_key=quote.source_key,
        fetched_at=fetched_at,
    )


def _npr_stat(run_date: date, fetched_at: datetime) -> MacroStatRow:
    """
    The rupee — Nepal Rastra Bank's official reference rate, with a mid-market fallback. The two measure
    DIFFERENT THINGS (NRB the central bank's official reference, open.er-api a market mid-rate), so the
    fallback is not silent: the row records WHICH source answered (`source_key`) and the label follows it
    mechanically (ruling C6) — the reader is never shown a mid-market rate under the central bank's name.
    The cell carries the pair (buy AND sell), because picking one side silently answers a question the reader
    never asked; the mid-market fallback has no sides and says so by not printing them.
    """
    limiter = TokenBucket(rate_per_sec=1.0, capacity=1.0)

    try:
        # A short window ending today. NRB publishes every calendar day (weekends repeat the preceding
        # business afternoon's fix), so a few days back always contains a published rate.
        nrb = NrbAdapter(httpx.Client(timeout=30), limiter)
        rate = nrb.latest_rate("USD", run_date - timedelta(days=_NRB_WINDOW_DAYS), run_date)
        return MacroStatRow(
            series_key=macro_stats.USD_NPR,
            as_of_date=rate.date,
            # `value` carries the BUY side so that any single-number consumer has a defined answer,
            # while the cell itself renders the pair from meta.
            value=rate.buy,
            prior=None,
            as_of_label=macro_stats.label_for(macro_stats.USD_NPR, rate.date),
            source_key=rate.source_key,
            fetched_at=fetched_at,
            meta={"buy": rate.buy, "sell": rate.sell},
        )
    except Exception as error:  # noqa: BLE001 — NRB down means we try the fallback, not that we give up
        print(f"job_a: NRB unreachable ({error}); falling back to the mid-market reference.")

    erapi = ErApiAdapter(httpx.Client(timeout=30), limiter)
    quote = erapi.latest("NPR")
    return MacroStatRow(
        series_key=macro_stats.USD_NPR,
        as_of_date=quote.date,
        value=quote.rate,
        prior=None,
        as_of_label=macro_stats.label_for(macro_stats.USD_NPR, quote.date),
        source_key=quote.source_key,
        fetched_at=fetched_at,
        # No buy/sell: a mid-market rate HAS no sides, and inventing a spread to keep the cell's shape would
        # fabricate the very number the reader came to check.
        meta=None,
    )


def _read_mood_history(fred: FredAdapter):
    """
    Return the reader for the three FRED distributions the Mood gauge scores against. The gauge asks "where
    does tonight's VIX sit in its own trailing year?", the only form of that question with an honest answer,
    so each series arrives as a distribution (oldest first) and a failed series comes back empty — the gauge
    loses that component and, if too many are lost, suppresses itself and names what is missing.
    """

    def read() -> MoodHistory:
        return MoodHistory(
            vix=_series_history(fred, _VIX_SERIES),
            sp500=_series_history(fred, _SP500_SERIES),
            credit=_series_history(fred, macro_stats.CREDIT_SPREAD_SERIES),
        )

    return read


def _series_history(fred: FredAdapter, series_id: str) -> list[float]:
    """One FRED series' recent history, OLDEST FIRST. An unreachable series costs its own component."""
    try:
        observations = fred.history(series_id)
    except Exception as error:  # noqa: BLE001 — one dead series is one missing gauge component
        print(f"job_a: FRED {series_id} history unavailable ({error}); that mood component drops out.")
        return []

    # FRED answers newest-first; series maths wants oldest-first.
    return [observation.value for observation in reversed(observations)]


def _build_submit_extraction(settings: Settings):
    """Return a callable that submits the night's news as an extraction batch, or None if no Anthropic key
    is configured (the briefing degrades — the data still publishes). Built lazily so the pipeline runs
    key-free during buildout; the import is local so a missing anthropic package never breaks a key-free night.
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
# What each mode is allowed to touch. CONSTANTS on purpose: a mode is a promise about what a run will and
# will not do — "macro mode does not ingest bars" is why it is safe at dawn and (N6) safe as a user button.
# A mode that could silently grow a stage would break that promise, so the lists are pinned and a test guards
# them. N4 adds `news` and `compute`; N6 wires the panel to them.
MODE_STAGES: dict[str, tuple[str, ...]] = {
    "full": ("ingest", "compute", "scan", "catalysts", "news", "publish", "revalidate"),
    "macro": ("macro", "publish", "revalidate"),
    # N4 adds two. A mode is a PROMISE ABOUT WHAT A RUN WILL NOT TOUCH — a pinned constant with a test, not a
    # comment, because the control room (N6) lets the user fire these and a "refresh the news" button that
    # re-ingested the market would lie about what it does. `news` re-reads providers and rebuilds the front
    # page; it touches no price, scan or base rate, so it is safe at any hour, market open or not.
    "news": ("news", "publish", "revalidate"),
    # N6 adds the last, in the SAME COMMIT as its handler and button (hence left out for two phases). `compute`
    # re-runs indicators, scans and analytics over bars ALREADY IN THE LAKE — no Alpaca, FRED, news or LLM,
    # which makes it the one button besides `news` safe with the market open. The promise is held by the TYPE,
    # not this comment: run_compute takes a ComputeDeps, which has no provider on it (nightly.py + its test).
    "compute": ("compute", "scan", "publish", "revalidate"),
    # CC8 makes the pre-open dawn cron the Morning Edition's engine. `dawn` is macro + news + catalysts:
    # it re-reads the index closes FRED posts overnight, rebuilds the front page, and refreshes the forward
    # calendar with its event times — then publishes and revalidates. Like macro/news it ingests no bar and
    # opens no new edition (E1): it stamps a `dawn` entry beside the night's, keeping the last close's date.
    "dawn": ("macro", "news", "catalysts", "publish", "revalidate"),
}

# A mode is a promise about what a run will not touch. Declaring one here without a handler in main() would
# not break a button — it would silently run the ENTIRE NIGHTLY (every unrecognised mode used to fall through
# to the full run), so "recompute scans" at noon would re-ingest the market and write half a day of unformed
# bars over the last good close. main() refuses any mode it has no handler for, and a test walks MODE_STAGES
# to assert main() dispatches every mode in it.


def parse_mode(argv: list[str]) -> str:
    """Read `--mode X` out of argv, defaulting to the full nightly. An unknown mode raises rather than
    falling back to "full": a typo in a workflow file must not silently turn a 6am refresh into a market ingest.
    """
    if "--mode" not in argv:
        return "full"
    mode = argv[argv.index("--mode") + 1]
    if mode not in MODE_STAGES:
        raise ValueError(f"job_a: unknown mode {mode!r} — expected one of {sorted(MODE_STAGES)}")
    return mode


def run_macro_mode(settings: Settings) -> None:
    """Re-read FRED, fix the last session's index levels, refresh the board. Nothing else.

    Since CC8 the pre-open cron runs `dawn` mode (which does this as one stage plus news + calendar);
    `macro` stays a hand-only button — the cheap "just re-pull the numbers" refresh in the control room.

    FRED posts the index closes after both nightly jobs run (the Nasdaq Composite ~11:38pm ET, vs Job A at
    6:37pm), so the levels the night stored are one session behind by the time the user reads the Desk. This
    run fixes them — the reason the morning Desk shows a real prior close, not a dated one. It updates the
    PREVIOUS session, not today (at 6am the market has not opened).

    N3 ADDS THE BOARD'S FOUR EXTERNAL STATS — AND DELIBERATELY NOT THE MOOD GAUGE. The four cells are exactly
    what this run is for: published by other people on other schedules, several landing after the night
    finished, so re-reading at dawn makes the board current. The gauge is different: two of its five
    components (breadth, and where the universe sits in its 252-day range) need a run that ingested the
    market, and this did not. Recomputing here would either overwrite the night's five-component gauge with a
    thinner one or reuse yesterday's market shape under today's date — both worse than leaving it. A run that
    did not look at the market does not get to say how the market feels.
    """
    fred = _fred(settings)
    session = previous_session(datetime.now(_MARKET_TZ).date())
    macro = _read_macro(fred)()

    board = _read_macro_stats(settings, fred, session)()

    with psycopg.connect(settings.database_url_psycopg) as conn:
        updated = pub.publish_macro(conn, run_date=session, macro=macro.as_columns())
        # The board's rows are keyed by the SOURCE's observation date, not a run date, so they write whether
        # or not a market_context row exists: a mortgage rate published Thursday is a fact about Thursday.
        written = pub.publish_macro_stats(conn, rows=board.rows)

    if not updated:
        # No nightly has written this session yet — nothing to correct, and we do NOT create a row:
        # market_context's breadth is NOT NULL because a night that ingested the market always knows how many
        # names advanced, and a macro-only run does not.
        print(f"job_a[macro]: no market_context row for {session.isoformat()} yet — index levels not updated.")

    _revalidate_desk(settings)
    levels = "complete" if macro.has_every_index_level() else "PARTIAL — some index series did not answer"
    print(
        f"job_a[macro]: {session.isoformat()} index levels {levels}; "
        f"board wrote {len(written)} new observation(s) of {len(board.rows)} fetched; "
        f"vix={macro.vix} ten_year={macro.ten_year} sp500={macro.sp500}."
    )


def full_run_edition(now: datetime) -> date | None:
    """
    The edition a `full` run started at `now` would publish — or None if it must skip.

    THE TWO LAYERS, and why one was not enough (POLISH-AND-DEPTH Part 3.1). The gate (N6): a day with no
    session has nothing to ingest, and the cron never fires at a weekend but DOES fire on every market
    HOLIDAY (~9 a year) and a manual dispatch lands any day — such a run would ingest nothing and publish a
    pipeline_run dated to a session that did not happen, with every gate green. It stops here and exits
    cleanly: a skipped run on a closed market is CORRECT, and failing the workflow would red-mail every
    Thanksgiving. The derivation (PD0): the gate alone still let a lie in the side door (Q-N6-2) — a run at
    1:00am ET Tuesday passes the gate (Tuesday IS a session) and under the old code stamped everything
    TUESDAY over bars ending Monday. So the date comes from the market (the last session whose bell rang),
    not the wall clock; run_nightly proves it against the bars, and publish refuses it if it is not a session.
    Three layers, because the first shipped, looked complete, and was not.
    """
    if not is_trading_session(now.date()):
        return None
    return latest_closed_session(now)


def dawn_edition(now: datetime) -> date | None:
    """
    The session a dawn run at `now` should refresh — or None if today is not a session (skip).

    The dawn prepares the reader's morning BEFORE today's open, so it runs only on days the market
    will open. The Mon–Fri cron fires on market HOLIDAYS too (it cannot know them), and on a holiday
    there is no morning to prepare — so it skips, the same gate full_run_edition keeps. The session
    it refreshes is the last close, exactly as macro and news modes read it (previous_session), never
    today's: at dawn today has not opened.
    """
    if not is_trading_session(now.date()):
        return None
    return previous_session(now.date())


def main() -> None:
    """Build the real collaborators and run one night. Raises on any failure, so the workflow goes red."""
    settings = load_settings()

    mode = parse_mode(sys.argv[1:])
    if mode == "macro":
        run_macro_mode(settings)
        return
    if mode == "news":
        run_news_mode(settings)
        return
    if mode == "compute":
        run_compute_mode(settings)
        return
    if mode == "dawn":
        run_dawn_mode(settings)
        return
    if mode != "full":
        # Belt and braces. parse_mode rejects a mode not in MODE_STAGES; this refuses one that IS in the table
        # but has no handler — the more dangerous case, which would otherwise fall through and run the night.
        raise ValueError(
            f"job_a: mode {mode!r} is declared in MODE_STAGES but has no handler. Refusing to fall "
            f"through to a full nightly run, which would re-ingest the market."
        )

    # THE EDITION COMES FROM THE MARKET, NOT THE WALL CLOCK (full argument in full_run_edition's docstring):
    # `datetime.now().date()` answers "what day is it here?", an edition date answers "which session closed?"
    # — different questions, and for two days in July 2026 this job answered the wrong one.
    now = datetime.now(_MARKET_TZ)
    run_date = full_run_edition(now)
    if run_date is None:
        print(
            f"job_a: {now.date().isoformat()} is not a trading session — the market never opened, so "
            f"there is no close to ingest. Skipping. (The last session's data stands, correctly "
            f"stamped with the last session's date.)"
        )
        return

    # A run that starts before today's bell publishes the session that HAS closed. Said out loud, because a
    # 1:00am recovery run printing yesterday's date is exactly what a reader of these logs would file as a bug.
    if run_date != now.date():
        print(
            f"job_a: it is {now.date().isoformat()} but today's close has not happened yet — "
            f"publishing the session that has: {run_date.isoformat()}."
        )

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
            read_macro_stats=_read_macro_stats(settings, fred, run_date),
            read_mood_history=_read_mood_history(fred),
            publish_macro_stats=pub.publish_macro_stats,
            build_front_page=_build_front_page(settings, conn, run_date),
            publish_news=pub.publish_news,
        )
        result = run_nightly(deps)

        # CC10 — fresh in, stale out (plan 4.8). The janitor is a stage of the FULL run, appended after
        # publish and before revalidate: it retires what has aged out (the trailing tables its manifest
        # allows, and the R2 backups/ prefix), and stamps its counts beside the night's source_status for
        # the control room. The record is untouchable — the allow-list is the door forever models can't enter.
        janitor_report = janitor.run_janitor(conn, run_date=run_date, r2=r2)
        pub.publish_janitor(conn, run_date=run_date, entry=janitor_report.to_entry(datetime.now(_MARKET_TZ)))

    _revalidate_desk(settings)

    print(
        f"job_a: {run_date.isoformat()} — universe {result.universe_size}, "
        f"coverage {result.coverage:.1%}, {result.scan_matches} scan matches, "
        f"{result.served_symbols} served symbols, breadth {result.breadth}."
    )
    print(
        f"job_a[janitor]: retired {janitor_report.news_rows} news row(s), "
        f"{janitor_report.scan_sessions} session(s) of scan rows; "
        f"backups kept {janitor_report.backups_kept} of {janitor_report.backups_seen}."
    )


def _revalidate_desk(settings: Settings) -> None:
    """
    Ask the app to refresh its cached morning payload after publishing (best-effort). The Desk reads a cached
    payload so its LCP stays low; this POST revalidates it so the next visit sees tonight's data at once. A
    failure does not fail the night (the six-hour fallback still refreshes), so it is logged, not raised.
    Needs APP_BASE_URL and CRON_SECRET (Appendix D); absent either, the step is skipped with a note.
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




# ---------------------------------------------------------------------------------------------
# The Front Page (N4)
# ---------------------------------------------------------------------------------------------


def _read_instruments(conn) -> list[NewsInstrument]:
    """
    The universe the resolver matches article text against. Name AND symbol, because most of the front page
    arrives with neither — Finnhub's market feed tags no tickers, so the only way to know a story is about
    Nvidia is to recognise the word.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, name FROM instrument WHERE is_active = true")
        return [NewsInstrument(symbol=row[0], name=row[1]) for row in cur.fetchall()]


def _read_sectors(conn) -> dict[str, str]:
    """Each instrument's sector — the strongest evidence there is for what a story is about."""
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, sector FROM instrument WHERE sector IS NOT NULL")
        return {row[0]: row[1] for row in cur.fetchall()}


def _read_buckets(conn) -> dict[str, str]:
    """Each instrument's dollar-volume bucket (CC6), for the front-page entity_weight (significance
    v2). The newsdesk is a Postgres closure — it cannot see the lake — so it reads the bucket the last
    full nightly stamped onto the instrument table. A symbol with no bucket yet is simply absent, and
    entity_weight sizes it as small (a name we cannot size is not a big liquid name)."""
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, dv_bucket FROM instrument WHERE dv_bucket IS NOT NULL")
        return {row[0]: row[1] for row in cur.fetchall()}


# ----- PD7: the depth readers (plan 9.2) -----
# WHY THESE READ POSTGRES AND NOT THE PARQUET LAKE (which 9.2's table says). The plan describes a stage that
# does not exist: `_build_front_page` is a POSTGRES CLOSURE, the same in BOTH modes — the full nightly has
# the lake in memory but never hands it to the newsdesk, and `news` mode has no lake at all (it syncs nothing
# from R2, which is what makes it safe at any hour). Giving the news stage a second data path (sync the lake
# just to compute a 52-week range) would buy vocabulary about symbols the app cannot chart AND break `news`
# mode's central promise. So the depth reads `price_bar` (260 bars per SERVED symbol — exactly the 252-session
# window, and exactly the names the app can chart); a non-served symbol has no depth stats, the narrator has
# less vocabulary, and nothing invents a number — 9.2's own "absence over invention" on its own premise.

def _read_depth_bars(conn, symbols: Iterable[str]) -> dict[str, list[Bar]]:
    """The trailing bars for the named symbols, ascending, from the serving table. One query for every symbol
    on the page rather than one per symbol: a story with eight tickers must not become eight more round trips.
    """
    wanted = sorted({symbol for symbol in symbols})
    if not wanted:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT symbol, date, high, low, close
            FROM price_bar
            WHERE symbol = ANY(%s)
            ORDER BY symbol, date
            """,
            (wanted,),
        )
        bars: dict[str, list[Bar]] = {}
        for symbol, bar_date, high, low, close in cur.fetchall():
            bars.setdefault(symbol, []).append(
                Bar(date=bar_date, high=float(high), low=float(low), close=float(close))
            )
        return bars


def _read_cluster_history(conn, run_date: date, symbols: Iterable[str]) -> dict[str, int]:
    """How many stories each name has carried in the last 7 sessions, tonight's included. "The third story on
    this name this week" is context a single card cannot give and a front page is FOR — counted from our own
    table, the one place that knows what this app has already told its reader.
    """
    wanted = sorted({symbol for symbol in symbols})
    if not wanted:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ticker, COUNT(DISTINCT id)
            FROM news_cluster, UNNEST(tickers) AS ticker
            WHERE ticker = ANY(%s) AND run_date > %s - INTERVAL '7 days' AND run_date <= %s
            GROUP BY ticker
            """,
            (wanted, run_date, run_date),
        )
        return {row[0]: int(row[1]) for row in cur.fetchall()}


def _read_calendar_ahead(conn, run_date: date, days: int = 14) -> list[dict]:
    """The scheduled, dated events in the next fortnight, earliest first. 9.1 asks for "the next 10 SESSIONS";
    this reads 14 calendar days (ten sessions plus room for a holiday, no trading-calendar walk inside SQL).
    The narrator sees only the NEXT event per name anyway (`build_calendar_refs`), so a wider window changes
    what is offered, never what is claimed.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT symbol, code, kind, title, date
            FROM calendar_event
            WHERE date >= %s AND date <= %s + INTERVAL '%s days'
            ORDER BY date
            """,
            (run_date, run_date, days),
        )
        return [
            {"symbol": row[0], "code": row[1], "kind": row[2], "title": row[3], "date": row[4]}
            for row in cur.fetchall()
        ]


# THE EIGHTH STAT IS NOT HERE, AND ITS ABSENCE IS THE POINT (9.2's `sector:{key}:breadth1d`). "Advancers/
# decliners within the sector's scan universe tonight" cannot be computed in this stage, and looking at the
# two candidate tables shows why: `scan_result` holds only the preset MATCHES, not the universe (a breadth
# count over the matches is not the sector's breadth — NEAR_52W_HIGH alone skews it advancing — a confidently
# wrong number the gate would then CERTIFY); `price_bar` holds only the SERVED symbols (15 ETFs plus the
# watchlist), with no per-sector population to count. The per-symbol universe returns exist only in the
# in-memory lake during the full nightly, which the newsdesk never sees. The honest options are to thread the
# lake into the newsdesk seam or store a per-sector breadth in its own column, and Appendix B already ruled:
# a new column lands with its OWN migration and a DECISIONS line, never by widening one silently. So the stat
# is ABSENT, the narrator has one less word, and nothing invents a number. Booked for PD8 (Q-PD7-1).


def _read_moves(conn, run_date: date) -> dict[str, TickerMove]:
    """
    Tonight's price evidence per symbol — the only input to the significance formula's magnitude term, and
    the numbers snapshotted onto each catalyst link. Read from the scan metrics the night ALREADY computed,
    not recomputed here: two independent calculations of "today's move" is how the feed's number and the
    story page's number come to disagree by a basis point and make a liar of both.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT symbol,
                   (metrics ->> 'ret_1')::float8,
                   (metrics ->> 'rvol20')::float8,
                   (metrics ->> 'atr14')::float8,
                   (metrics ->> 'close')::float8
            FROM scan_result
            WHERE run_date = %s
            """,
            (run_date,),
        )
        moves: dict[str, TickerMove] = {}
        for symbol, ret1, rvol20, atr14, close in cur.fetchall():
            # ATR is an absolute price range; the formula wants it as a fraction of price, so that a
            # $4 move on a $40 stock and a $40 move on a $400 stock read the same.
            atr_pct = (atr14 / close) if (atr14 and close) else None
            moves[symbol] = TickerMove(symbol=symbol, ret1=ret1, atr14_pct=atr_pct)
        return moves


def _read_rvol(conn, run_date: date) -> dict[str, float | None]:
    """RVOL per symbol, snapshotted onto the catalyst links beside the move."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT symbol, (metrics ->> 'rvol20')::float8 FROM scan_result WHERE run_date = %s",
            (run_date,),
        )
        return {row[0]: row[1] for row in cur.fetchall()}


def _read_setup_card_symbols(conn) -> set[str]:
    """Which symbols have evidence behind them — the gate on the story page's "Setup card" doorway. A doorway
    to nothing is worse than no doorway, so the link renders only where a card exists."""
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT symbol FROM setup_card")
        return {row[0] for row in cur.fetchall()}


def _fetch_news_articles(settings: Settings) -> tuple[list[dict], dict[str, str]]:
    """
    Tonight's market-wide news, from both providers, each degrading on its own. One dead provider costs its
    own articles and nothing else — the per-source status key is what lets the night say "Finnhub answered
    and Marketaux did not" rather than "news: degraded", which describes two outages identically.
    """
    articles: list[dict] = []
    status: dict[str, str] = {}

    client = httpx.Client(timeout=30)
    limiter = TokenBucket(rate_per_sec=1.0, capacity=5.0)

    if settings.finnhub_key:
        try:
            finnhub = FinnhubAdapter(client, limiter, settings.finnhub_key)
            for category in FINNHUB_MARKET_CATEGORIES:
                for item in finnhub.market_news(category):
                    articles.append(
                        {
                            "id": item.article_id,
                            "url": item.url,
                            "headline": item.headline,
                            "summary": item.summary,
                            "source": item.source,
                            "category": item.category,
                            "image": item.image,
                            "published": item.published,
                            "tickers": item.tickers,
                        }
                    )
            status["news-finnhub"] = "ok"
        except Exception as error:  # noqa: BLE001 — one provider's outage is not the night's
            status["news-finnhub"] = "degraded"
            print(f"job_a: Finnhub market news failed ({error}); the front page loses its main feed.")
    else:
        status["news-finnhub"] = "not_configured"

    if settings.marketaux_key:
        try:
            marketaux = MarketauxAdapter(client, limiter, settings.marketaux_key)
            for page in range(1, MARKETAUX_PAGES + 1):
                batch = marketaux.market_news(page=page)
                if not batch:
                    break
                for article in batch:
                    articles.append(
                        {
                            "id": article.uuid,
                            "uuid": article.uuid,
                            "url": article.url,
                            "headline": article.title,
                            "summary": article.description or article.snippet,
                            "source": article.source,
                            "image": article.image_url,
                            "published": article.published,
                            "tickers": tuple(e.symbol for e in article.entities),
                            # The provider's own name per symbol, so the ingest can cross-check it against
                            # our instrument table. VHI is VitalHub in Toronto and Valhi in New York, and
                            # without the name that collision is invisible.
                            "ticker_names": {e.symbol: e.name for e in article.entities},
                            "industries": [e.industry for e in article.entities],
                            "similar": article.similar,
                        }
                    )
            status["news-marketaux"] = "ok"
        except Exception as error:  # noqa: BLE001
            status["news-marketaux"] = "degraded"
            print(f"job_a: Marketaux failed ({error}); the front page loses its entity tags.")
    else:
        status["news-marketaux"] = "not_configured"

    return articles, status


def _build_front_page(
    settings: Settings, conn, run_date: date, *, narrate: bool = True
) -> Callable[[], FrontPageRead]:
    """
    The newsdesk, wired to the real world (plan 7.3-7.6, 7.9). Images are fetched only when the media bucket
    exists (provisioning row P-1); when it does not — today — every card falls to the DESIGNED L3/L4 rungs
    (first-class outcomes, not empty states) and the night records that it did so. The feed ships either way,
    which is the whole point of building the ladder before the bucket.

    `narrate=False` publishes the facts-only front page — fresh clusters, no LLM prose. The dawn run
    uses it (CC8, risk 10): the morning refresh re-fetches and re-ranks the news but spends no
    Anthropic, so the reader's morning page carries the overnight stories without the evening's prose.
    """

    def read() -> FrontPageRead:
        articles, status = _fetch_news_articles(settings)

        resolver = TickerResolver(_read_instruments(conn))
        moves = _read_moves(conn, run_date)
        rvol = _read_rvol(conn, run_date)
        carded = _read_setup_card_symbols(conn)

        sectors_by_symbol = _read_sectors(conn)
        buckets_by_symbol = _read_buckets(conn)
        night = build_night(
            articles=articles,
            resolver=resolver,
            moves=moves,
            session_date=run_date,
            sectors_by_symbol=sectors_by_symbol,
            buckets_by_symbol=buckets_by_symbol,
        )

        media_base = os.environ.get("NEXT_PUBLIC_MEDIA_BASE", "")
        if not media_base:
            status["news-images"] = "not_configured"

        # THE DEPTH BLOCK (PD7, 9.2), built for the top-8 clusters ONLY — the budget is a budget, and
        # a stat block costs prompt tokens whether or not the model uses it.
        deep = night.deep_clusters
        deep_symbols = [symbol for cluster in deep for symbol in cluster.tickers]
        bars = _read_depth_bars(conn, deep_symbols)
        history = _read_cluster_history(conn, run_date, deep_symbols)
        calendar_rows = _read_calendar_ahead(conn, run_date)
        refs_by_key = {ref.key: ref for ref in build_calendar_refs(calendar_rows)}

        depth_stats: dict[str, list] = {}
        cluster_calendar: dict[str, list] = {}
        for cluster in deep:
            depths = [
                build_ticker_depth(
                    symbol,
                    bars.get(symbol, []),
                    ret1=getattr(moves.get(symbol), "ret1", None),
                    atr14_pct=getattr(moves.get(symbol), "atr14_pct", None),
                )
                for symbol in cluster.tickers
            ]
            depth_stats[cluster.id] = [
                *build_depth_stats(depth for depth in depths if depth.any_measure()),
                *build_cluster_stats(
                    cluster.id,
                    sources=cluster.sources,
                    history7d=max((history.get(s, 0) for s in cluster.tickers), default=None) or None,
                ),
            ]
            # A story is exposed to its own names' dated events AND to the market-wide ones (a CPI
            # print lands on everything). The narrator picks at most two; it can author none.
            keys = [*cluster.tickers, *(ref.key for ref in refs_by_key.values() if ref.code)]
            calendar = [refs_by_key[key] for key in dict.fromkeys(keys) if key in refs_by_key]
            cluster_calendar[cluster.id] = calendar
            depth_stats[cluster.id].extend(build_calendar_stats(calendar))

        # The dawn refresh publishes facts-only (narrate=False) — a news sweep with no Anthropic spend
        # (CC8, risk 10). The stories, order and numbers are identical; only the prose is withheld.
        narration = (
            _narrate_front_page(
                settings,
                night=night,
                articles=articles,
                moves=moves,
                rvol=rvol,
                instruments=list(sectors_by_symbol),
                run_date=run_date,
                status=status,
                deep_ids=[cluster.id for cluster in deep],
                depth_stats=depth_stats,
                calendar=cluster_calendar,
            )
            if narrate
            else NarrationResult()
        )

        default_note = NoteDecision(
            why_it_matters=None,
            affected_note=None,
            # Prose is written only for the narrated top of the page. Everywhere else this is an
            # honest null, and a null prints NOTHING on the card — never a placeholder (P9).
            verification={"narrated": False, "reason": "outside the narrated top of the page"},
        )
        model_meta = (
            narration.model_meta(
                model_extract=settings.model_extract, model_synth=settings.model_synth
            )
            if narration.usage
            else None
        )

        cluster_rows = [
            {
                "id": cluster.id,
                "run_date": run_date,
                "first_seen": cluster.first_seen,
                "headline": cluster.headline,
                "event_type": cluster.event_type,
                "sectors": cluster.sectors,
                "themes": cluster.themes,
                "tickers": list(cluster.tickers),
                "significance": cluster.significance,
                "sources": cluster.sources,
                "why_it_matters": narration.decisions.get(cluster.id, default_note).why_it_matters,
                "affected_note": narration.decisions.get(cluster.id, default_note).affected_note,
                "extract": narration.extracts.get(cluster.id, {}),
                "verification": narration.decisions.get(cluster.id, default_note).verification,
                # PD7's three new columns. `context` is null for every cluster outside the top 8, and
                # the verification's `sections` map says WHY — "out_of_budget", not "the gate held it".
                "context": narration.decisions.get(cluster.id, default_note).context,
                "watch": narration.decisions.get(cluster.id, default_note).watch,
                "model_meta": model_meta,
                # The articles behind the story, snapshotted. `sources` is only a count, and a
                # corroboration count the reader cannot open is a claim they have to take on trust.
                "articles": [
                    {
                        "source": member.source,
                        "url": member.url,
                        "headline": member.headline,
                        "published": member.published,
                    }
                    for member in cluster.members
                ],
                "image_id": None,
                "links": [
                    {
                        "cluster_id": cluster.id,
                        "symbol": symbol,
                        "ret1": moves[symbol].ret1 if symbol in moves else None,
                        "rvol20": rvol.get(symbol),
                        "has_setup_card": symbol in carded,
                    }
                    for symbol in cluster.tickers
                ],
            }
            for cluster in night.clusters
        ]

        return FrontPageRead(
            clusters=cluster_rows,
            images=[],
            source_status=status,
            articles_in=night.articles_in,
            boilerplate_dropped=night.boilerplate_dropped,
            stage_a_capped=night.stage_a_capped,
            narration=narration.summary(),
        )

    return read


def _narrate_front_page(
    settings: Settings,
    *,
    night,
    articles: list[dict],
    moves: dict,
    rvol: dict,
    instruments: list[str],
    run_date: date,
    status: dict[str, str],
    deep_ids: list[str] | None = None,
    depth_stats: dict[str, list] | None = None,
    calendar: dict[str, list] | None = None,
) -> NarrationResult:
    """
    Write the front page's context lines — or don't, and say so (plan 7.5). THIS IS THE LAST THING THAT RUNS,
    AND THE FIRST THING THAT MAY FAIL: every story is already found, linked, classified and ordered by the
    time this is called, so if there is no key, the extractor chokes, the narrator fails its schema twice, or
    the gate deletes every line — the same stories publish, in the same order, with the same numbers, and only
    prose is lost. Which is why it needs a status key and a spoken summary: a null why_it_matters prints the
    same nothing whether the narrator had nothing to add or was never asked.
    """
    if not settings.anthropic_api_key:
        status["news-narration"] = "not_configured"
        print("job_a: ANTHROPIC_API_KEY not set; the front page publishes its facts without prose.")
        return NarrationResult()

    import anthropic

    by_id = {str(article["id"]): article for article in articles}
    stories: list[Story] = []
    for cluster in night.stage_a_clusters:
        article = by_id.get(cluster.representative_id)
        if article is None:
            continue
        stories.append(
            Story(
                cluster_id=cluster.id,
                headline=cluster.headline,
                event_type=cluster.event_type,
                sectors=cluster.sectors,
                tickers=cluster.tickers,
                sources=cluster.sources,
                article={
                    "id": str(article["id"]),
                    "headline": article.get("headline", ""),
                    "snippet": article.get("summary", ""),
                    "url": article.get("url", ""),
                    "tickers": list(cluster.tickers),
                },
            )
        )

    if not stories:
        status["news-narration"] = "ok"
        return NarrationResult()

    try:
        result = run_narration(
            # BOUNDED, and the default is not. The SDK times a call out after TEN MINUTES and then retries,
            # so 60 sequential extracts could hold the publish open for hours (which the first live run
            # started doing). The facts are already computed; they do not get to wait on a context line.
            anthropic.Anthropic(
                api_key=settings.anthropic_api_key,
                timeout=CALL_TIMEOUT_SECONDS,
                max_retries=CALL_MAX_RETRIES,
            ),
            stage_a=stories,
            stage_b_ids=[cluster.id for cluster in night.stage_b_clusters],
            moves=moves,
            rvol=rvol,
            instruments=instruments,
            run_date=run_date,
            model_extract=settings.model_extract,
            model_synth=settings.model_synth,
            deep_ids=deep_ids or [],
            depth_stats=depth_stats or {},
            calendar=calendar or {},
        )
    except Exception as error:  # noqa: BLE001 — the narrator's outage is not the page's
        status["news-narration"] = "degraded"
        print(f"job_a: the narrator failed ({error}); the front page publishes its facts without prose.")
        return NarrationResult()

    status["news-narration"] = "ok"
    # THE COST INSTRUMENT (9.5). Printed every night from the API's own usage numbers, read or not — because
    # a budget nobody measures is a number somebody made up, and 0.2.3 made one up on purpose and said so.
    print(f"job_a: {result.cost_summary()}.")
    return result


def run_news_mode(settings: Settings) -> None:
    """
    Rebuild the front page, and touch nothing else (MODE_STAGES["news"]). THE PROMISE: it re-reads providers,
    resolves, clusters, ranks, narrates and publishes — and ingests no bar, recomputes no indicator, rebuilds
    no scan, which is what makes it safe at ANY hour, market open or not. IT DOES SPEND LLM BUDGET, and used
    to promise the opposite: that promise predates the front page having prose, and the honest scope of
    "refresh the news" is the WHOLE page, facts and context together — a refresh that blanked the notes would
    quietly make the page worse. The cost is bounded and small (≤60 extraction calls + one narration, plan
    7.5). It is why `main` dispatches here EXPLICITLY rather than falling through: before this branch, any
    non-"macro" mode ran the whole nightly, so "refresh the news" at noon would have re-ingested the market
    mid-session over the last good close. It reads the SESSION date, not today: the price evidence it snapshots
    belongs to the last close that happened, which at noon Tuesday is Monday's.
    """
    run_date = previous_session(datetime.now(_MARKET_TZ).date())

    with psycopg.connect(settings.database_url_psycopg) as conn:
        front_page = _build_front_page(settings, conn, run_date)()
        written = pub.publish_news(
            conn,
            run_date=run_date,
            clusters=front_page.clusters,
            images=front_page.images,
        )

    _revalidate_desk(settings)

    print(
        f"job_a (news): {run_date.isoformat()} — {front_page.articles_in} articles in, "
        f"{front_page.boilerplate_dropped} regulatory filings dropped, {written} stories published, "
        f"{front_page.stage_a_capped} past the extraction cap. "
        f"Sources: {front_page.source_status}."
    )
    if front_page.narration:
        print(f"job_a (news): {front_page.narration}.")


def run_compute_mode(settings: Settings) -> None:
    """
    Recompute the derived layer over the stored lake, and fetch nothing (MODE_STAGES["compute"]). The "I fixed
    a detector, re-run last night with the new code" button (plan 8.1d): it pulls the history lake down from
    R2, rebuilds indicators, scans, the signal log and analytics, and republishes — calling no provider
    (Alpaca, FRED, news, model), which makes it safe at any hour. THE LAKE IS THE INPUT, AND ON A FRESH RUNNER
    IT IS EMPTY: every Actions run starts from a bare checkout, so it must sync DOWN from R2 first, and without
    R2 it cannot run. It says so rather than "succeeding" over an empty lake, which would republish an empty
    session and wipe the scans room.
    """
    r2 = R2Store.from_settings(settings) if settings.r2_account_id else None
    if r2 is None:
        raise RuntimeError(
            "job_a[compute]: the history lake (R2) is not configured, and a recompute has nothing "
            "to recompute from. This mode reads stored bars and fetches nothing by design."
        )

    store = ParquetStore(_PARQUET_ROOT)
    pulled = r2.sync_down(store.root)
    print(f"job_a[compute]: pulled {len(pulled)} partition file(s) down from the history lake.")

    with psycopg.connect(settings.database_url_psycopg) as conn:
        deps = ComputeDeps(
            read_bars=lambda: store.scan(PRICES).collect(),
            read_served_symbols=_read_served_symbols(conn),
            publish_compute=pub.publish_compute,
            publish_analytics=pub.publish_analytics,
            conn=conn,
        )
        result = run_compute(deps)

    _revalidate_desk(settings)

    print(
        f"job_a (compute): recomputed {result.run_date.isoformat()} from stored bars — "
        f"{result.symbols} symbols, {result.scan_matches} scan matches. "
        f"No provider was called; the night's own source health is untouched."
    )


def run_dawn_mode(settings: Settings) -> None:
    """
    The dawn run — the Morning Edition's engine (CC8, plan 4.7, MODE_STAGES["dawn"]).

    What a reader wakes up to, refreshed before the open without ingesting the market:
    - macro: re-read FRED so the prior close's index levels are the real ones (they post overnight);
    - catalysts: refresh the forward calendar WITH its event times (earnings bmo/amc, macro 8:30 ET);
    - news: rebuild the front page from fresh providers, FACTS-ONLY — a news sweep that spends no
      Anthropic (risk 10), so the mood gauge and the LLM stay evening-only work.

    E1: it opens NO new edition — the session stays the last close, exactly as macro/news modes read
    it, and dawnness is carried by publish_dawn's stamp, not by a new date. On a market holiday there
    is no morning to prepare, so it skips (dawn_edition). The macro and calendar land in their own
    transactions first; a newsdesk outage then degrades only the front page, and the dawn is stamped
    either way so its record says exactly which stages succeeded.
    """
    now = datetime.now(_MARKET_TZ)
    session = dawn_edition(now)
    if session is None:
        print(
            f"job_a[dawn]: {now.date().isoformat()} is not a trading session — the market does not "
            f"open, so there is no morning to prepare. Skipping. (The last edition stands.)"
        )
        return

    fred = _fred(settings)
    macro = _read_macro(fred)()
    board = _read_macro_stats(settings, fred, session)()
    # The calendar refresh needs no movers — FMP earnings and FRED releases do not depend on them
    # (only mover-news does), so it fetches with an empty mover list: the calendar and its new event
    # times, and none of the per-ticker news the front page fetches for itself.
    catalysts = build_catalyst_fetcher(settings, session)([])

    written = 0
    front_page = None
    with psycopg.connect(settings.database_url_psycopg) as conn:
        # macro: fix the prior close's index levels and refresh the board (run_macro_mode's core).
        pub.publish_macro(conn, run_date=session, macro=macro.as_columns())
        pub.publish_macro_stats(conn, rows=board.rows)
        # catalysts: refresh the forward calendar with its event times; a degraded source leaves it.
        pub.publish_calendar(conn, calendar_events=catalysts.calendar_events)
        # news: rebuild the front page from fresh providers, FACTS-ONLY (narrate=False) — a news
        # sweep with no Anthropic spend (risk 10). A newsdesk failure degrades the front page and
        # nothing else — the macro and calendar are already stored above.
        try:
            front_page = _build_front_page(settings, conn, session, narrate=False)()
            written = pub.publish_news(
                conn, run_date=session, clusters=front_page.clusters, images=front_page.images
            )
        except Exception as error:  # noqa: BLE001 — a dead newsdesk costs the front page, not the run
            print(f"job_a[dawn]: the newsdesk failed ({error}); the front page is left as the night's.")

        sources = _dawn_source_status(macro, board, catalysts, front_page)
        stages = {
            "macro": "ok",
            "catalysts": "ok" if catalysts.calendar_events is not None else "degraded",
            "news": "ok" if front_page is not None else "degraded",
            "publish": "ok",
        }
        pub.publish_dawn(conn, run_date=session, ran_at=now, sources=sources, stages=stages)

    _revalidate_desk(settings)
    calendar_note = "refreshed" if catalysts.calendar_events is not None else "left (sources down)"
    levels = "complete" if macro.has_every_index_level() else "PARTIAL"
    print(
        f"job_a[dawn]: {session.isoformat()} refreshed for the morning — index levels {levels}, "
        f"{written} stories published, calendar {calendar_note}."
    )


def _dawn_source_status(macro, board, catalysts, front_page) -> dict[str, str]:
    """The dawn's per-provider health, assembled like the nightly's (nightly.run_nightly): FRED (the
    macro read and, separately, the index levels), then the calendar's, board's and front page's own
    source maps. A None front page means the newsdesk failed, so news degrades."""
    fred_ok = any(value is not None for value in macro.as_columns().values())
    sources = {
        "fred": "ok" if fred_ok else "degraded",
        "fred-indexes": "ok" if macro.has_every_index_level() else "degraded",
    }
    sources.update(catalysts.source_status)
    sources.update(board.source_status)
    if front_page is not None:
        sources.update(front_page.source_status)
    else:
        sources["news"] = "degraded"
    return sources


# The entrypoint stays at the very BOTTOM of the module, and that is not a style choice. It was briefly above
# run_news_mode (appended after it), and Python executes this block the moment it reaches it — so main() ran
# while run_news_mode was still undefined, and every unit test passed (a test IMPORTS the module, never runs it
# as a script). Production found it in eleven seconds. Nothing goes below this line.
if __name__ == "__main__":
    main()
