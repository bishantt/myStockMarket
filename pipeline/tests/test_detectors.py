"""
Tests for detectors.py — the six pattern detectors (plan P4 step 1, Appendix F).

Written first (plan §6.2). Each detector gets a test that it fires exactly on the bar the pattern
completes, plus a one-bar-shift guard: the fire at bar t must use only data through t, so changing a
FUTURE bar never changes whether t fired. The forward-return join is shifted +1 bar (entry the bar
after the signal), and that shift is tested too — no same-bar lookahead leaks into a base rate.

Detectors run on a frame that already carries the indicator columns (with_indicators fills them in
production); the tests feed controlled columns so the crossing logic itself is what is under test.
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

import detectors as det


def _frame(rows: list[dict]) -> pl.DataFrame:
    """Build a single-symbol indicator frame from partial rows, filling absent columns with values
    that keep every detector silent unless a row sets otherwise."""
    base = {
        "symbol": "ACME", "close": 100.0, "high": 100.0,
        "sma50": 1.0, "sma200": 2.0,   # 50 below 200 → no golden cross
        "rsi14": 50.0, "rvol20": 1.0, "ret_1": 0.0, "gap_pct": 0.0,
        "dist_52w_high": -0.10, "has_catalyst": False,
    }
    start = date(2026, 1, 1)
    return pl.DataFrame([{**base, **row, "date": start + timedelta(days=i)} for i, row in enumerate(rows)])


def _fired(events: pl.DataFrame, pattern: str) -> pl.DataFrame:
    return events.filter(pl.col("pattern_key") == pattern).sort("date")


def test_golden_cross_fires_on_the_crossing_bar_only():
    frame = _frame([
        {"sma50": 1.0, "sma200": 2.0},   # below
        {"sma50": 3.0, "sma200": 2.0},   # crosses ABOVE here
        {"sma50": 4.0, "sma200": 2.0},   # already above — no re-fire
    ])
    fired = _fired(det.detect(frame), det.GOLDEN_CROSS)
    assert fired.height == 1
    assert fired["date"][0] == date(2026, 1, 2)
    assert fired["direction"][0] == "up"


def test_golden_cross_needs_sma200_defined():
    frame = _frame([
        {"sma50": 1.0, "sma200": None},
        {"sma50": 3.0, "sma200": None},  # a cross, but sma200 undefined (< 200 bars) ⇒ no signal
    ])
    assert _fired(det.detect(frame), det.GOLDEN_CROSS).height == 0


def test_near_52w_high_fires_when_price_enters_the_2pct_zone():
    frame = _frame([
        {"dist_52w_high": -0.05},  # 5% below — outside
        {"dist_52w_high": -0.01},  # enters within 2% here
        {"dist_52w_high": -0.005}, # already inside — no re-fire
    ])
    fired = _fired(det.detect(frame), det.NEAR_52W_HIGH)
    assert fired.height == 1
    assert fired["date"][0] == date(2026, 1, 2)


def test_rsi_extreme_fires_on_both_crossings_with_direction():
    frame = _frame([
        {"rsi14": 25.0},  # below 30
        {"rsi14": 32.0},  # crosses 30 up → up
        {"rsi14": 60.0},
        {"rsi14": 75.0},  # above 70
        {"rsi14": 68.0},  # crosses 70 down → down
    ])
    fired = _fired(det.detect(frame), det.RSI_EXTREME)
    assert fired.height == 2
    assert set(fired["direction"].to_list()) == {"up", "down"}


def test_unusual_volume_fires_on_high_rvol_and_big_move():
    frame = _frame([
        {"rvol20": 1.0, "ret_1": 0.01},   # quiet
        {"rvol20": 3.0, "ret_1": 0.03},   # RVOL ≥ 2.5 AND |ret| ≥ 2% → fires, up
        {"rvol20": 3.0, "ret_1": 0.01},   # loud but small move → no fire
        {"rvol20": 2.6, "ret_1": -0.05},  # fires, down
    ])
    fired = _fired(det.detect(frame), det.UNUSUAL_VOLUME)
    assert fired.height == 2
    assert fired["direction"].to_list() == ["up", "down"]


def test_gap_with_catalyst_needs_both_the_gap_and_a_catalyst():
    frame = _frame([
        {"gap_pct": 0.04, "has_catalyst": False},  # big gap, no catalyst → no fire
        {"gap_pct": 0.04, "has_catalyst": True},   # big gap AND catalyst → fires, up
        {"gap_pct": 0.01, "has_catalyst": True},   # catalyst, small gap → no fire
        {"gap_pct": -0.05, "has_catalyst": True},  # big down gap AND catalyst → fires, down
    ])
    fired = _fired(det.detect(frame), det.GAP_CATALYST)
    assert fired.height == 2
    assert fired["direction"].to_list() == ["up", "down"]


def test_breadth_regime_fires_when_the_universe_crosses_fifty_percent():
    breadth = pl.DataFrame({
        "date": [date(2026, 1, i) for i in range(1, 5)],
        "pct_above_50dma": [45.0, 55.0, 60.0, 40.0],  # up-cross at day 2, down-cross at day 4
    })
    events = det.detect_breadth(breadth)
    assert events.height == 2
    assert events.sort("date")["direction"].to_list() == ["up", "down"]
    assert events["pattern_key"].to_list()[0] == det.BREADTH_REGIME


# ----- one-bar-shift guards: a detector must not use a future bar -----

def test_no_detector_reads_a_future_bar():
    # Two frames identical through bar 1; they differ only at bar 2 (the future). Whether bar 1 fired
    # must be the same in both — otherwise the detector peeked ahead.
    prefix = [{"sma50": 1.0, "sma200": 2.0}, {"sma50": 3.0, "sma200": 2.0, "rsi14": 32.0,
              "rvol20": 3.0, "ret_1": 0.03, "gap_pct": 0.04, "has_catalyst": True, "dist_52w_high": -0.01}]
    calm_future = _frame(prefix + [{"close": 100.0}])
    wild_future = _frame(prefix + [{"close": 999.0, "rsi14": 5.0, "rvol20": 9.0, "ret_1": 0.5}])

    def fires_at_bar_1(frame: pl.DataFrame) -> set[str]:
        events = det.detect(frame)
        return set(events.filter(pl.col("date") == date(2026, 1, 2))["pattern_key"].to_list())

    assert fires_at_bar_1(calm_future) == fires_at_bar_1(wild_future)


def test_forward_returns_are_anchored_one_bar_after_the_signal():
    # Entry is the bar AFTER the signal (the +1 shift), exit h bars later. For a signal on day 0 with
    # closes [100, 110, 121, ...], the 1-day forward return is 121/110 - 1, never 110/100 - 1.
    frame = _frame([{"close": c} for c in [100.0, 110.0, 121.0, 133.1]])
    fwd = det.forward_returns(frame, horizons=(1,)).sort("date")
    # Row for day 0: entry = close[1] = 110, exit = close[2] = 121 ⇒ 0.10.
    assert abs(fwd["fwd_1"][0] - (121.0 / 110.0 - 1.0)) < 1e-9
    assert fwd["up_1"][0] is True
    # The last two rows cannot resolve a 1-day forward from the bar after them → null.
    assert fwd["fwd_1"][-1] is None
