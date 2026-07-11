"""
Tests for nightly.py — Job A's orchestration (plan §2.1, P1 step 5).

The flow is exercised with injected fakes, so no live provider key is touched: a fake universe, a
fake bar fetch, a fake macro read, a recording Parquet store / R2 store / publish. The pure helpers
(breadth, served-bar selection, curated scan metrics) are asserted directly on crafted frames.

The one hard rule the plan names explicitly — the universe coverage floor — gets its own test: too
few symbols with bars and the whole night fails loudly, before anything is written or published.
"""

from datetime import date

import polars as pl
import pytest

import nightly
from adapters.alpaca import Bar


def _bar(symbol, d, close, volume=1000):
    return Bar(symbol=symbol, date=d, open=close, high=close, low=close, close=close, volume=volume)


def _history(symbol, closes, start=date(2026, 6, 1)):
    return [_bar(symbol, date.fromordinal(start.toordinal() + i), c) for i, c in enumerate(closes)]


class RecordingStore:
    def __init__(self):
        self.root = "/tmp/does-not-matter"
        self.writes = []

    def write_partitioned(self, dataset, frame):
        self.writes.append((dataset, frame.height))
        return []


class RecordingR2:
    def __init__(self):
        self.synced = 0

    def sync_up(self, root):
        self.synced += 1
        return []


class RecordingPublish:
    def __init__(self):
        self.calls = []

    def __call__(self, conn, **kwargs):
        self.calls.append(kwargs)


def _deps(universe, bars_by_symbol, *, macro=(15.8, 4.5), served=("SPY",), publish=None, r2=None):
    return nightly.NightlyDeps(
        fetch_universe=lambda: universe,
        fetch_bars=lambda symbols: bars_by_symbol,
        read_macro=lambda: macro,
        read_served_symbols=lambda: list(served),
        store=RecordingStore(),
        r2=r2,
        publish=publish or RecordingPublish(),
        conn=object(),
        run_date=date(2026, 6, 10),
    )


# ── the coverage floor ───────────────────────────────────────────────────────────────────────

def test_a_night_below_the_coverage_floor_fails_before_writing_anything():
    universe = [{"symbol": f"S{i}", "name": f"Name {i}", "exchange": "NASDAQ"} for i in range(100)]
    # Only 90 of 100 symbols returned bars — 90% coverage, below the 95% floor.
    bars = {u["symbol"]: _history(u["symbol"], [10.0]) for u in universe[:90]}
    store = RecordingStore()
    publish = RecordingPublish()
    deps = _deps(universe, bars, publish=publish)
    deps = nightly.NightlyDeps(**{**deps.__dict__, "store": store})

    with pytest.raises(RuntimeError, match="coverage"):
        nightly.run_nightly(deps)

    assert store.writes == []  # nothing persisted
    assert publish.calls == []  # nothing published


def test_a_full_night_publishes_the_served_data_and_macro_context():
    universe = [
        {"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"},
        {"symbol": "AAPL", "name": "Apple", "exchange": "NASDAQ"},
    ]
    bars = {
        "SPY": _history("SPY", [500, 502, 505, 503, 508, 511]),
        "AAPL": _history("AAPL", [200, 201, 199, 202, 204, 203]),
    }
    store = RecordingStore()
    r2 = RecordingR2()
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish, r2=r2)
    deps = nightly.NightlyDeps(**{**deps.__dict__, "store": store})

    result = nightly.run_nightly(deps)

    assert result.coverage == 1.0
    assert store.writes and store.writes[0][0] == nightly.PRICES  # prices persisted
    assert r2.synced == 1  # and pushed to R2

    published = publish.calls[0]
    assert published["market_context"]["vix"] == 15.8
    assert published["market_context"]["ten_year"] == 4.5
    # Only the served symbol (SPY) reaches Postgres; AAPL stays in the Parquet lake.
    served_symbols = set(published["price_bars"]["symbol"].to_list())
    assert served_symbols == {"SPY"}
    assert published["instruments"] == universe


def test_fred_outage_marks_the_source_degraded_but_still_publishes():
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()
    deps = _deps(universe, bars, macro=(None, None), served=("SPY",), publish=publish)

    nightly.run_nightly(deps)

    published = publish.calls[0]
    assert published["market_context"]["vix"] is None
    assert published["source_status"]["fred"] == "degraded"


# ── the pure helpers ──────────────────────────────────────────────────────────────────────────

def test_compute_breadth_counts_advancers_decliners_and_share_above_the_50dma():
    snapshot = pl.DataFrame(
        {
            "symbol": ["A", "B", "C", "D"],
            "ret_1": [0.02, -0.01, 0.0, 0.05],
            "close": [110.0, 90.0, 100.0, 120.0],
            "sma50": [100.0, 100.0, None, 100.0],
        }
    )
    breadth = nightly.compute_breadth(snapshot)
    assert breadth["advancers"] == 2  # A and D
    assert breadth["decliners"] == 1  # B
    # Of the three with a 50-day average, two (A, D) are above it → 0.6667.
    assert breadth["pct_above_50dma"] == pytest.approx(0.6667, abs=1e-4)


def test_served_price_bars_keeps_only_served_symbols_and_adds_adjusted_close():
    bars = pl.DataFrame(
        {
            "symbol": ["SPY", "SPY", "AAPL"],
            "date": [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 2)],
            "open": [1.0, 2.0, 9.0],
            "high": [1.0, 2.0, 9.0],
            "low": [1.0, 2.0, 9.0],
            "close": [1.5, 2.5, 9.5],
            "volume": [10, 20, 30],
        }
    )
    served = nightly.served_price_bars(bars, {"SPY"})
    assert set(served["symbol"].to_list()) == {"SPY"}
    # adj_close is present and, at P1, equals the (already-adjusted) close.
    assert served["adj_close"].to_list() == [1.5, 2.5]
