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
from datetime import UTC, date, datetime, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

import httpx
import psycopg

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
from briefing.extract import submit_batch
from catalyst_ingest import build_catalyst_fetcher
from config import Settings, load_settings
from macro_stats import MacroStatRow
from newsdesk.ingest import FINNHUB_MARKET_CATEGORIES, MARKETAUX_PAGES, build_night
from newsdesk.narrate import NarrationResult, NoteDecision, Story, run_narration
from newsdesk.rank import TickerMove
from newsdesk.resolve import Instrument as NewsInstrument
from newsdesk.resolve import TickerResolver
from nightly import FrontPageRead, MacroRead, MacroStatsRead, MoodHistory, NightlyDeps, run_nightly
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

# How far back the rupee's window reaches. NRB publishes every calendar day, so a handful of days
# always contains a published rate — enough to survive a run that lands just after midnight Nepal
# time, before that day's rate is posted, without ever reaching so far back that a genuinely dead
# source could pass as a live one.
_NRB_WINDOW_DAYS = 5

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


# ── the macro board (N3, Part 6) ─────────────────────────────────────────────────────────────


def _read_macro_stats(settings: Settings, fred: FredAdapter, run_date: date):
    """
    Return the reader for the board's four EXTERNAL stats: the mortgage rate, CPI, gold, the rupee.

    Every source is fetched inside its own try/except, and that is the whole architecture of this
    function. A dead GoldAPI costs the gold cell and nothing else — it does not cost the rupee, it
    does not cost the morning, and it does not fail the night. Each failure writes its own key into
    the source status ("macro-gold_usd"), because one key cannot describe two different failures —
    the lesson N1 learned when a single `fred: ok` had to stand for both a healthy VIX read and
    three missing index levels.

    The Mood gauge is deliberately not here: it is computed from the night's own universe snapshot
    (see nightly._build_mood_row), not fetched.
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
    """One FRED-sourced board cell: the latest observation, and the one before it for the delta.

    The as-of date is the SOURCE's observation date — a Thursday for the mortgage rate, the first of
    the month for CPI — never tonight. That single choice is what lets the board show a weekly number
    without ever implying it was refreshed nightly.
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
    Gold's spot reference — and the one cell whose key does not exist yet (provisioning row P-5).

    A missing key raises here, exactly like a network failure would, and the difference is recorded
    in the message rather than in the behaviour: either way the cell has no value tonight. What the
    reader sees is decided by what is STORED, not by why the fetch failed — a cell with history shows
    it with an age note (rung 3), and a cell with no history at all says "not yet reported" (rung 4),
    which is what gold honestly says in production today.
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
    The rupee — Nepal Rastra Bank's official reference rate, with a mid-market fallback.

    The two sources measure DIFFERENT THINGS: NRB publishes the central bank's official reference,
    open.er-api publishes a market mid-rate. So the fallback is not a silent substitution — the row
    records WHICH source answered (`source_key`), and the board's label follows that key
    mechanically (ruling C6). The reader is never shown a mid-market rate under the central bank's
    name, and the attribution the fallback's licence requires renders only when the fallback is the
    one showing.

    The cell carries the pair (buy AND sell) rather than picking a side, because picking one
    silently answers a question the reader never asked. The mid-market fallback has no sides, and
    the cell says so by simply not printing them.
    """
    limiter = TokenBucket(rate_per_sec=1.0, capacity=1.0)

    try:
        # A short window ending today. NRB publishes every calendar day (weekends repeat the fix set
        # on the preceding business afternoon), so a few days back always contains a published rate.
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
        # No buy/sell: a mid-market rate HAS no sides, and inventing a spread around it to keep the
        # cell's shape consistent would be fabricating the very number the reader came to check.
        meta=None,
    )


def _read_mood_history(fred: FredAdapter):
    """
    Return the reader for the three FRED distributions the Mood gauge scores against.

    The gauge does not ask "is the VIX high?" — it asks "where does tonight's VIX sit in its own
    trailing year?", which is the only form of that question with an honest answer. So each series
    arrives as a distribution, oldest first, and a series that fails comes back empty: the gauge
    loses that one component and, if too many are lost, suppresses itself and names what is missing.
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
    "full": ("ingest", "compute", "scan", "catalysts", "news", "publish", "revalidate"),
    "macro": ("macro", "publish", "revalidate"),
    # N4 adds two. A mode is a PROMISE ABOUT WHAT A RUN WILL NOT TOUCH, which is why this table is a
    # pinned constant with a test rather than a comment: the control room (N6) will let the user fire
    # these by hand, and a "refresh the news" button that quietly re-ingested the market would be a
    # button that lies about what it does.
    #
    # `news` re-reads the providers and rebuilds the front page. It touches no price, no scan, no
    # base rate — so it is safe to run at any hour, including while the market is open, because
    # nothing it writes depends on a session having closed.
    "news": ("news", "publish", "revalidate"),
}

# `compute` (recompute indicators and scans over stored data, fetching nothing) is DELIBERATELY ABSENT
# until N6 builds it, and its absence is the honest state rather than an oversight.
#
# A mode is a promise about what a run will not touch. Declaring "compute" here without a handler in
# main() would not have produced a broken button — it would have produced a button that silently ran
# the ENTIRE NIGHTLY, because every mode that main() does not recognise falls through to the full
# run. A user pressing "recompute scans" at noon would have re-ingested the market mid-session and
# written half a day of unformed bars over the last good close. The guard in main() now refuses any
# mode it has no handler for, so that failure is impossible rather than merely unlikely.


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
    """The dawn run: re-read FRED, fix the last session's index levels, refresh the board. Nothing else.

    FRED posts the index closes after both nightly jobs have run (the Nasdaq Composite lands around
    11:38pm ET, against Job A at 6:37pm), so the levels the night stored are structurally one session
    behind by the time the user reads the Desk. This run goes back and fixes them, and it is the
    reason the morning Desk shows a real prior close instead of a dated one.

    It updates the PREVIOUS session, not today: at 6am the market has not opened, so the close being
    fetched belongs to the session before this one.

    N3 ADDS THE BOARD'S FOUR EXTERNAL STATS — AND DELIBERATELY NOT THE MOOD GAUGE.

    The four external cells are exactly the kind of thing this run exists for: they are published by
    other people, on other people's schedules, and several of them land after the night has finished.
    Re-reading them at dawn is what makes the board current by the time anyone looks at it.

    The gauge is different in kind. Two of its five components — breadth, and where the universe sits
    in its own 252-day range — can only be measured by a run that actually ingested the market, and
    this run does not. Recomputing it here would either produce a thinner three-component gauge and
    overwrite the night's five-component one, or silently reuse yesterday's market shape under
    today's date. Both are worse than leaving it alone. A run that did not look at the market does
    not get to say how the market feels — the same principle that stops this function creating a
    breadth-less market_context row.
    """
    fred = _fred(settings)
    session = previous_session(datetime.now(_MARKET_TZ).date())
    macro = _read_macro(fred)()

    board = _read_macro_stats(settings, fred, session)()

    with psycopg.connect(settings.database_url_psycopg) as conn:
        updated = pub.publish_macro(conn, run_date=session, macro=macro.as_columns())
        # The board's rows are keyed by the SOURCE's own observation date, not by a run date, so they
        # are written whether or not a market_context row exists for this session. A mortgage rate
        # published on Thursday is a fact about Thursday; it does not need the market to have opened.
        written = pub.publish_macro_stats(conn, rows=board.rows)

    if not updated:
        # No nightly has written this session yet. There is nothing to correct, and we will NOT
        # create a row: market_context's breadth is NOT NULL because a night that ingested the market
        # always knows how many names advanced, and a macro-only run does not.
        print(f"job_a[macro]: no market_context row for {session.isoformat()} yet — index levels not updated.")

    _revalidate_desk(settings)
    levels = "complete" if macro.has_every_index_level() else "PARTIAL — some index series did not answer"
    print(
        f"job_a[macro]: {session.isoformat()} index levels {levels}; "
        f"board wrote {len(written)} new observation(s) of {len(board.rows)} fetched; "
        f"vix={macro.vix} ten_year={macro.ten_year} sp500={macro.sp500}."
    )


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
    if mode != "full":
        # Belt and braces. parse_mode already rejects a mode that is not in MODE_STAGES; this
        # refuses a mode that IS in the table but has no handler here, which is the more dangerous
        # of the two — it would otherwise fall through and run the whole night.
        raise ValueError(
            f"job_a: mode {mode!r} is declared in MODE_STAGES but has no handler. Refusing to fall "
            f"through to a full nightly run, which would re-ingest the market."
        )

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
            read_macro_stats=_read_macro_stats(settings, fred, run_date),
            read_mood_history=_read_mood_history(fred),
            publish_macro_stats=pub.publish_macro_stats,
            build_front_page=_build_front_page(settings, conn, run_date),
            publish_news=pub.publish_news,
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




# ---------------------------------------------------------------------------------------------
# The Front Page (N4)
# ---------------------------------------------------------------------------------------------


def _read_instruments(conn) -> list[NewsInstrument]:
    """
    The universe the resolver matches article text against.

    Name AND symbol, because most of the front page arrives with neither — Finnhub's market feed
    tags no tickers at all, so the only way to know a story is about Nvidia is to recognise the word.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, name FROM instrument WHERE is_active = true")
        return [NewsInstrument(symbol=row[0], name=row[1]) for row in cur.fetchall()]


def _read_sectors(conn) -> dict[str, str]:
    """Each instrument's sector — the strongest evidence there is for what a story is about."""
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, sector FROM instrument WHERE sector IS NOT NULL")
        return {row[0]: row[1] for row in cur.fetchall()}


def _read_moves(conn, run_date: date) -> dict[str, TickerMove]:
    """
    Tonight's price evidence, per symbol — the only input to the significance formula's magnitude
    term, and the numbers snapshotted onto each catalyst link.

    Read from the scan metrics the night has ALREADY computed rather than recomputed here: two
    independent calculations of "today's move" is exactly how the feed's number and the story page's
    number come to disagree by a basis point and make a liar of both.
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
    """Which symbols have evidence behind them — the gate on the story page's "Setup card" doorway.

    A doorway to nothing is worse than no doorway, so the link renders only where a card exists."""
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT symbol FROM setup_card")
        return {row[0] for row in cur.fetchall()}


def _fetch_news_articles(settings: Settings) -> tuple[list[dict], dict[str, str]]:
    """
    Tonight's market-wide news, from both providers, each degrading on its own.

    One dead provider costs its own articles and nothing else — the per-source status key is what
    lets the night say "Finnhub answered and Marketaux did not" rather than "news: degraded", which
    is a sentence that describes two different outages identically.
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
                            # The provider's own name for each symbol, so the ingest can cross-check
                            # it against our instrument table. VHI is VitalHub in Toronto and Valhi
                            # in New York, and without the name that collision is invisible.
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


def _build_front_page(settings: Settings, conn, run_date: date) -> Callable[[], FrontPageRead]:
    """
    The newsdesk, wired to the real world (plan 7.3-7.6, 7.9).

    Images are fetched only when the media bucket exists (provisioning row P-1). When it does not —
    which is today — every card falls to the DESIGNED L3/L4 rungs, which are first-class outcomes
    rather than empty states, and the night records that it did so. The feed ships either way; that
    is the whole point of building the ladder before the bucket.
    """

    def read() -> FrontPageRead:
        articles, status = _fetch_news_articles(settings)

        resolver = TickerResolver(_read_instruments(conn))
        moves = _read_moves(conn, run_date)
        rvol = _read_rvol(conn, run_date)
        carded = _read_setup_card_symbols(conn)

        sectors_by_symbol = _read_sectors(conn)
        night = build_night(
            articles=articles,
            resolver=resolver,
            moves=moves,
            session_date=run_date,
            sectors_by_symbol=sectors_by_symbol,
        )

        media_base = os.environ.get("NEXT_PUBLIC_MEDIA_BASE", "")
        if not media_base:
            status["news-images"] = "not_configured"

        narration = _narrate_front_page(
            settings,
            night=night,
            articles=articles,
            moves=moves,
            rvol=rvol,
            instruments=list(sectors_by_symbol),
            run_date=run_date,
            status=status,
        )

        default_note = NoteDecision(
            why_it_matters=None,
            affected_note=None,
            # Prose is written only for the narrated top of the page. Everywhere else this is an
            # honest null, and a null prints NOTHING on the card — never a placeholder (P9).
            verification={"narrated": False, "reason": "outside the narrated top of the page"},
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
) -> NarrationResult:
    """
    Write the front page's context lines — or don't, and say so (plan 7.5).

    THIS IS THE LAST THING THAT RUNS, AND THE FIRST THING THAT MAY FAIL. Every story is already
    found, linked, classified and ordered by the time this is called. If there is no key, if the
    extractor chokes, if the narrator fails its schema twice, or if the gate deletes every line — the
    same stories publish, in the same order, with the same numbers. The only thing lost is prose.

    Which is exactly why it needs a status key and a spoken summary. A page with no notes is
    invisible: a null why_it_matters prints nothing on the card, and it prints the same nothing
    whether the narrator had nothing to add, or was never asked.
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
            anthropic.Anthropic(api_key=settings.anthropic_api_key),
            stage_a=stories,
            stage_b_ids=[cluster.id for cluster in night.stage_b_clusters],
            moves=moves,
            rvol=rvol,
            instruments=instruments,
            run_date=run_date,
            model_extract=settings.model_extract,
            model_synth=settings.model_synth,
        )
    except Exception as error:  # noqa: BLE001 — the narrator's outage is not the page's
        status["news-narration"] = "degraded"
        print(f"job_a: the narrator failed ({error}); the front page publishes its facts without prose.")
        return NarrationResult()

    status["news-narration"] = "ok"
    return result


def run_news_mode(settings: Settings) -> None:
    """
    Rebuild the front page, and touch nothing else (MODE_STAGES["news"]).

    THE PROMISE THIS FUNCTION KEEPS. It re-reads the news providers, resolves, clusters, ranks,
    narrates and publishes — and it does not ingest a single bar, recompute a single indicator or
    rebuild a single scan. That is what makes it safe to run at ANY hour, including while the market
    is open, because nothing it writes depends on a session having closed.

    IT DOES SPEND LLM BUDGET, and it used to promise the opposite. The promise was written when the
    front page had no prose, and the honest scope of a "refresh the news" button is the WHOLE front
    page — facts and context lines together. A refresh that rebuilt the stories while silently
    blanking their notes would be a button that quietly makes the page worse, which is not a refresh.
    The cost is bounded and small: at most 60 extraction calls and one narration call (plan 7.5).

    It is also why `main` dispatches here EXPLICITLY rather than falling through to the full night.
    Before this branch existed, any mode that was not "macro" ran the whole nightly — so a user
    pressing "refresh the news" at noon would have re-ingested the entire market mid-session and
    written a day of half-formed bars over the last good close. A mode is a promise about what a run
    will NOT touch, and a promise the code does not keep is worse than no promise at all.

    It reads the SESSION date, not today: the price evidence it snapshots onto each catalyst link
    belongs to the last close that actually happened, and at noon on a Tuesday that is Monday's.
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


# The entrypoint stays at the very BOTTOM of the module, and that is not a style choice.
#
# It was briefly above run_news_mode, because that function was appended after it. Python executes
# this block the moment it reaches it, so main() ran while run_news_mode was still an undefined name
# — and every unit test passed, because a test IMPORTS this module and never executes it as a script.
# Production found it in eleven seconds. Nothing goes below this line.
if __name__ == "__main__":
    main()
