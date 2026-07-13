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
from zoneinfo import ZoneInfo

import httpx
import psycopg

import macro_stats
import publish as pub
from adapters.alpaca import AlpacaAdapter
from adapters.base import TokenBucket
from adapters.erapi import ErApiAdapter
from adapters.fred import FredAdapter
from adapters.goldapi import GoldApiAdapter
from adapters.nrb import NrbAdapter
from briefing.extract import submit_batch
from catalyst_ingest import build_catalyst_fetcher
from config import Settings, load_settings
from macro_stats import MacroStatRow
from nightly import MacroRead, MacroStatsRead, MoodHistory, NightlyDeps, run_nightly
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
