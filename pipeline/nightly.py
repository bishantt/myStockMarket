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

Deferred at P1 (logged, DECISIONS.md 2026-07-11): signal_log emission. The signal log is INSERT-ONLY
and permanent, and each row's resolves_on must be exactly ten TRADING days out; without the trading
calendar wired (exchange_calendars) that horizon can only be approximated, and an approximate date
baked into a permanent, un-editable log is worse than waiting. It lands when the calendar does.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Callable, Mapping

import polars as pl

from parquet_store import PRICES, ParquetStore
from scans import build_snapshot, run_all
from storage import R2Store

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
class NightlyDeps:
    """Everything run_nightly needs from the outside world — injected so the flow is fully fakeable."""

    fetch_universe: Callable[[], list[Mapping[str, Any]]]
    fetch_bars: Callable[[list[str]], dict[str, list[Any]]]
    read_macro: Callable[[], tuple[float | None, float | None]]
    read_served_symbols: Callable[[], list[str]]
    store: Any  # ParquetStore (or a recording fake)
    r2: Any  # R2Store | None
    publish: Callable[..., None]
    conn: Any  # a psycopg connection, passed straight to publish
    run_date: date


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

    vix, ten_year = deps.read_macro()
    breadth = compute_breadth(snapshot)
    market_context = {"vix": vix, "ten_year": ten_year, **breadth}

    served = set(deps.read_served_symbols())
    served_bars = served_price_bars(bars, served)
    scan_results = curated_scans(scans)

    fred_ok = vix is not None or ten_year is not None
    deps.publish(
        deps.conn,
        run_date=deps.run_date,
        stage_status={"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"},
        source_status={"alpaca": "ok", "fred": "ok" if fred_ok else "degraded"},
        instruments=universe,
        price_bars=served_bars if served_bars.height else None,
        scan_results=scan_results if scan_results.height else None,
        market_context=market_context,
    )

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
