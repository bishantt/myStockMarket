"""
nightly.py — Job A's orchestration: the full nightly data flow (plan §2.1, Appendix C, P1 step 5).

One trading night, in order:
  1. list the tradable universe,
  2. ingest end-of-day bars for it,
  3. FAIL LOUDLY if coverage is below the floor (a thin night must not quietly publish a hole),
  4. persist the full-universe bars as Parquet and push them to R2 (the history lake),
  5. run the five scans over the run-date snapshot,
  6. read the macro context (VIX, 10-year) and compute the day's breadth,
  7. publish the SERVED subset to Postgres — the indices, sector ETFs, and the user's watchlist —
     plus the scan matches and the macro-context row, in one transaction.

The design is dependency-injected: every external collaborator (the universe, the bar fetch, the
macro read, the Parquet store, R2, the publish, the served-symbol list) is a field on NightlyDeps,
so the flow is tested end to end with fakes and no live key is ever needed. Job A's main() builds
the real collaborators from settings and calls run_nightly.

Signal log: every scan match writes one INSERT-ONLY signal_log row, with resolves_on set to exactly
ten TRADING days out via the NYSE calendar (trading_calendar.py). The rate fields stay null until
P4 gives the patterns base rates. Publish inserts these ON CONFLICT DO NOTHING, so a rerun of a
night adds nothing — the log records that a pattern fired and when it resolves, permanently.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable, Mapping

import polars as pl

import analytics
import detectors as det
from catalysts import classify
from parquet_store import PRICES, ParquetStore
from scans import HORIZON_DAYS, UNUSUAL_VOLUME, build_indicated, build_snapshot, run_all
from storage import R2Store
from trading_calendar import sessions_ahead

# The regime line and the primary card horizon (Appendix F). Breadth is a fraction (0-1).
_REGIME_LINE = 0.5
_CARD_HORIZON = 10

# A night must cover at least this share of the universe with bars, or it fails (plan §2.1). A
# missing tenth of the market is a broken ingest, not a publishable morning.
MIN_UNIVERSE_COVERAGE = 0.95

# How many recent bars per served symbol are mirrored into Postgres. The full history stays in the
# Parquet lake; the Desk only needs about a trading year to draw its charts and indicators.
SERVED_HISTORY_BARS = 260

# The scan metrics worth persisting per match (the rest of the snapshot stays in the lake). ret_1
# and rvol20 are what the Desk's Movers module reads; the others are for the setup cards to come.
_SCAN_METRIC_COLS = ("ret_1", "rvol20", "gap_pct", "close", "rsi14", "dist_52w_high", "lottery_flag")

_BAR_COLS = ["symbol", "date", "open", "high", "low", "close", "volume"]


@dataclass(frozen=True)
class CatalystBundle:
    """What the catalyst ingest returns: the night's news + calendar to persist, and per-source
    health. `calendar_events` is None when the calendar sources were down (publish leaves the
    existing calendar untouched); an empty list means they ran and found nothing."""

    news_items: list[dict]
    calendar_events: list[dict] | None
    source_status: dict[str, str]


@dataclass(frozen=True)
class MacroRead:
    """
    What one night's FRED read yields: the two context cells, and the three index levels with the
    level that came before each (redesign §6.1).

    Every field is nullable because every series can fail on its own. The priors are stored, not
    just the levels, because the app can only diff what is persisted — buildMacro never sees the
    pipeline's observations, so a change it cannot compute from the database is a change it must
    render as "—" rather than borrow from an ETF.
    """

    vix: float | None
    ten_year: float | None
    sp500: float | None = None
    sp500_prior: float | None = None
    nasdaq_composite: float | None = None
    nasdaq_composite_prior: float | None = None
    djia: float | None = None
    djia_prior: float | None = None

    def as_columns(self) -> dict[str, float | None]:
        """The macro half of the market_context row, keyed as the table's columns."""
        return {
            "vix": self.vix,
            "ten_year": self.ten_year,
            "sp500": self.sp500,
            "sp500_prior": self.sp500_prior,
            "nasdaq_composite": self.nasdaq_composite,
            "nasdaq_composite_prior": self.nasdaq_composite_prior,
            "djia": self.djia,
            "djia_prior": self.djia_prior,
        }


@dataclass(frozen=True)
class NightlyDeps:
    """Everything run_nightly needs from the outside world — injected so the flow is fully fakeable."""

    fetch_universe: Callable[[], list[Mapping[str, Any]]]
    fetch_bars: Callable[[list[str]], dict[str, list[Any]]]
    read_macro: Callable[[], MacroRead]
    read_served_symbols: Callable[[], list[str]]
    store: Any  # ParquetStore (or a recording fake)
    r2: Any  # R2Store | None
    publish: Callable[..., None]
    conn: Any  # a psycopg connection, passed straight to publish
    run_date: date
    # The catalyst ingest (news + calendar) for the movers. Optional: None skips the catalyst stage
    # (the job owns the per-provider try/catch and reports each source's status in the bundle).
    fetch_catalysts: Callable[[list[str]], CatalystBundle] | None = None
    # Submit the LLM extraction batch for the night's news and return its batch id (plan P3 step 1).
    # Optional: None skips extraction (no key configured, or a night with no news). Given the
    # classified news items; the id it persists lets Job B collect the batch the next evening.
    submit_extraction: Callable[[list[dict]], str] | None = None
    # Publish the P4 honesty engine (base rates, setup cards, vol bands). Optional: None skips the
    # analytics stage (used by the fast fake-driven tests). Signature mirrors publish_analytics.
    publish_analytics: Callable[..., None] | None = None


@dataclass(frozen=True)
class NightlyResult:
    """A small summary of what the night did, for the job's log line."""

    run_date: date
    universe_size: int
    coverage: float
    scan_matches: int
    served_symbols: int
    breadth: dict


def run_nightly(deps: NightlyDeps) -> NightlyResult:
    """Run one full nightly flow. Raises RuntimeError if the universe is empty or under-covered."""
    universe = deps.fetch_universe()
    symbols = [u["symbol"] for u in universe]
    if not symbols:
        raise RuntimeError("nightly: the universe came back empty — refusing to publish a blank night.")

    bars = _bars_frame(deps.fetch_bars(symbols))
    covered = bars["symbol"].n_unique() if bars.height else 0
    coverage = covered / len(symbols)
    if coverage < MIN_UNIVERSE_COVERAGE:
        raise RuntimeError(
            f"nightly: universe coverage {coverage:.1%} is below the {MIN_UNIVERSE_COVERAGE:.0%} "
            f"floor ({covered}/{len(symbols)} symbols had bars). Failing the night — a hole this "
            f"big is a broken ingest, not a publishable morning."
        )

    # Persist the full-universe history first, then push it to R2 (the re-pullable lake).
    deps.store.write_partitioned(PRICES, bars)
    if deps.r2 is not None:
        deps.r2.sync_up(deps.store.root)

    snapshot = build_snapshot(bars)
    scans = run_all(snapshot)

    macro = deps.read_macro()
    breadth = compute_breadth(snapshot)
    market_context = {**macro.as_columns(), **breadth}

    served = set(deps.read_served_symbols())
    served_bars = served_price_bars(bars, served)
    scan_results = curated_scans(scans)
    signal_logs = build_signal_logs(scans, deps.run_date)

    # FRED is "ok" if any of its cells came back — the levels and the context cells fail separately,
    # and a partial read still fills part of the strip. Only a total FRED outage is "degraded".
    fred_ok = any(value is not None for value in macro.as_columns().values())
    source_status = {"alpaca": "ok", "fred": "ok" if fred_ok else "degraded"}

    # The catalyst stage: fetch news for the movers + the calendar, classify, and merge each
    # provider's health into the source status. A provider being down degrades its section here, in
    # the source status — the run still succeeds (plan §2, §P2 acceptance).
    news_items: list[dict] = []
    calendar_events: list[dict] | None = None
    if deps.fetch_catalysts is not None:
        movers = mover_symbols(scans)
        bundle = deps.fetch_catalysts(movers)
        news_items = _classify_news(bundle.news_items)
        calendar_events = bundle.calendar_events
        source_status = {**source_status, **bundle.source_status}

    # Submit the LLM extraction batch for tonight's news; Job B collects it tomorrow evening. The
    # batch id is recorded on the pipeline_run row in the same publish. A submission failure degrades
    # the briefing source (the night still publishes its data) rather than failing the run.
    batch_id: str | None = None
    if deps.submit_extraction is not None and news_items:
        try:
            batch_id = deps.submit_extraction(news_items)
        except Exception as error:  # noqa: BLE001 — a failed submit degrades the briefing, not the night
            source_status = {**source_status, "briefing": "degraded"}
            print(f"nightly: extraction batch submit failed ({error}); briefing degrades.")

    deps.publish(
        deps.conn,
        run_date=deps.run_date,
        stage_status={"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"},
        source_status=source_status,
        instruments=universe,
        price_bars=served_bars if served_bars.height else None,
        scan_results=scan_results if scan_results.height else None,
        signal_logs=signal_logs,
        market_context=market_context,
        news_items=news_items,
        calendar_events=calendar_events,
        batch_id=batch_id,
    )

    # The P4 honesty engine: base rates, setup cards, and vol bands over the served universe's
    # history. Published separately so a heavier compute never risks the core morning's transaction.
    # (Scope note, logged in DECISIONS: base rates are computed over the SERVED + watchlist history —
    # the symbols the user actually sees cards for — which is fast and honest via the N-gate. The
    # full-universe historical replay for larger N is a logged enhancement.)
    if deps.publish_analytics is not None:
        _run_analytics(deps, bars, snapshot, served, market_context)

    return NightlyResult(
        run_date=deps.run_date,
        universe_size=len(symbols),
        coverage=coverage,
        scan_matches=scans.height,
        served_symbols=served_bars["symbol"].n_unique() if served_bars.height else 0,
        breadth=breadth,
    )


def _bars_frame(by_symbol: dict[str, list[Any]]) -> pl.DataFrame:
    """Flatten a {symbol: [Bar, ...]} map into one Polars frame of daily bars."""
    rows = [
        (b.symbol, b.date, b.open, b.high, b.low, b.close, int(b.volume))
        for bars in by_symbol.values()
        for b in bars
    ]
    return pl.DataFrame(rows, schema=_BAR_COLS, orient="row")


def compute_breadth(snapshot: pl.DataFrame) -> dict:
    """
    The day's breadth from the run-date snapshot: how many names advanced, how many declined, and
    what share sit above their 50-day average. Breadth answers "broad or narrow?" — a rally on
    narrow breadth is a different thing from a broad one (Research Report §9.2).
    """
    advancers = int(snapshot.filter(pl.col("ret_1") > 0).height)
    decliners = int(snapshot.filter(pl.col("ret_1") < 0).height)
    with_ma = snapshot.filter(pl.col("sma50").is_not_null())
    pct = with_ma.filter(pl.col("close") > pl.col("sma50")).height / with_ma.height if with_ma.height else 0.0
    return {"advancers": advancers, "decliners": decliners, "pct_above_50dma": round(pct, 4)}


def served_price_bars(bars: pl.DataFrame, served: set[str]) -> pl.DataFrame:
    """
    The subset of bars mirrored into Postgres: only the served symbols, only their most recent
    SERVED_HISTORY_BARS, with an adjusted-close column. Alpaca's adjustment=all already returns
    adjusted prices, so at P1 adj_close equals close; the column exists so the serving schema and
    the indicator math have the field they expect.
    """
    if not served:
        return bars.head(0).with_columns(pl.col("close").alias("adj_close"))
    subset = (
        bars.filter(pl.col("symbol").is_in(list(served)))
        .sort("symbol", "date")
        .group_by("symbol", maintain_order=True)
        .tail(SERVED_HISTORY_BARS)
    )
    return subset.with_columns(pl.col("close").alias("adj_close"))


def mover_symbols(scans: pl.DataFrame) -> list[str]:
    """The movers whose catalysts we look up — the unusual-volume matches (the Desk's Movers set)."""
    if scans.height == 0:
        return []
    return scans.filter(pl.col("preset_key") == UNUSUAL_VOLUME)["symbol"].to_list()


def _run_analytics(deps: NightlyDeps, bars: pl.DataFrame, snapshot: pl.DataFrame, served: set[str],
                   market_context: Mapping[str, Any]) -> None:
    """Compute and publish the P4 honesty engine over the served universe's history.

    Runs the detectors over the served symbols' full indicator history to build base rates, turns
    today's fired events on served symbols into setup cards (tier + stated rate), and computes vol
    bands from each served symbol's recent closes. A failure here degrades the cards, not the
    morning — the core data already published above — so it is caught and logged, not raised.
    """
    try:
        served_bars = bars.filter(pl.col("symbol").is_in(list(served)))
        if served_bars.height == 0:
            return
        indicated = build_indicated(served_bars)
        breadth_history = _breadth_history(indicated)

        base_rates = analytics.build_base_rate_rows(indicated, breadth_history)
        events = det.detect(indicated)
        regime = "risk_on" if market_context["pct_above_50dma"] >= _REGIME_LINE else "risk_off"
        bucket_of = _bucket_of(snapshot, served)
        cards = analytics.build_setup_cards(
            events, base_rates, run_date=deps.run_date, served=served,
            bucket_of=bucket_of, regime=regime, horizon=_CARD_HORIZON,
        )
        vol_bands = analytics.build_vol_bands(_closes_by_symbol(indicated, served), run_date=deps.run_date)

        deps.publish_analytics(
            deps.conn, run_date=deps.run_date, base_rates=base_rates, setup_cards=cards, vol_bands=vol_bands,
        )
        print(f"nightly: analytics — {len(base_rates)} base rates, {len(cards)} cards, {len(vol_bands)} vol bands.")
    except Exception as error:  # noqa: BLE001 — analytics degrades the cards, not the published morning
        print(f"nightly: analytics stage failed ({error}); cards/bands skipped this run.")


def _breadth_history(indicated: pl.DataFrame) -> pl.DataFrame:
    """Per-date breadth (fraction above the 50-day average) over the indicated history — the regime
    series the base rates condition on."""
    return (
        indicated.filter(pl.col("sma50").is_not_null())
        .group_by("date")
        .agg((pl.col("close") > pl.col("sma50")).mean().alias("pct_above_50dma"))
        .sort("date")
    )


def _bucket_of(snapshot: pl.DataFrame, served: set[str]) -> dict[str, str]:
    """Each served symbol's size bucket today, from the run-date snapshot's large/mid flag and price
    (sub-$5 excluded, matching the historical bucketing)."""
    out: dict[str, str] = {}
    for row in snapshot.filter(pl.col("symbol").is_in(list(served))).iter_rows(named=True):
        if row["close"] < 5.0:
            continue
        out[row["symbol"]] = "large_mid" if row.get("is_large_mid") else "small"
    return out


def _closes_by_symbol(indicated: pl.DataFrame, served: set[str]) -> dict[str, list[float]]:
    """Each served symbol's closes, oldest first, for the vol bands."""
    out: dict[str, list[float]] = {}
    for row in indicated.filter(pl.col("symbol").is_in(list(served))).sort(["symbol", "date"]).iter_rows(named=True):
        out.setdefault(row["symbol"], []).append(row["close"])
    return out


def _classify_news(news_items: list[dict]) -> list[dict]:
    """Fill each news item's event_type by classifying its headline, unless it already has one (an
    EDGAR filing arrives typed), and stamp a deterministic id.

    The id is derived from (provider, url), so the same article always gets the same id: Job A can
    use it as the extraction batch's custom_id, publish stores it as the news_item id, and Job B (a
    separate process) reads the same id back to line the batch results up with their articles — and
    the app resolves a briefing citation to the article's URL by that id. Returns new dicts; the
    inputs are not mutated.
    """
    return [
        {
            **item,
            "id": _news_id(item.get("provider", ""), item.get("url", "")),
            "event_type": item.get("event_type") or classify(item.get("headline", "")),
        }
        for item in news_items
    ]


def _news_id(provider: str, url: str) -> str:
    """A stable, short id for a news article from its natural key (provider, url)."""
    return hashlib.sha1(f"{provider}|{url}".encode()).hexdigest()


def build_signal_logs(scans: pl.DataFrame, run_date: date) -> list[dict]:
    """
    One insert-only signal_log row per scan match: which pattern fired, on which symbol, and when it
    resolves — exactly HORIZON_DAYS trading days out on the NYSE calendar. The rate fields stay null
    until P4. Returns an empty list when nothing matched (the calendar is not consulted then).
    """
    if scans.height == 0:
        return []
    resolves_on = sessions_ahead(run_date, HORIZON_DAYS)
    return [
        {
            "fired_date": run_date,
            "symbol": row["symbol"],
            "pattern_key": row["preset_key"],
            "horizon_days": HORIZON_DAYS,
            "resolves_on": resolves_on,
        }
        for row in scans.iter_rows(named=True)
    ]


def curated_scans(scans: pl.DataFrame) -> pl.DataFrame:
    """
    Trim a scan-result frame to the columns Postgres keeps: the identity (preset/symbol/rank) plus a
    curated metric set. Publishing the entire snapshot per match would bloat the metrics JSON with
    fields nothing reads; this keeps only what the Desk and the setup cards use.
    """
    if scans.height == 0:
        return scans
    metric_cols = [c for c in _SCAN_METRIC_COLS if c in scans.columns]
    return scans.select(["preset_key", "symbol", "rank", *metric_cols])
