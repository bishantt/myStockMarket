"""
Tests for scans.py — the five v1 presets (plan Appendix F, P1 step 4).

Preset logic is tested against synthetic run-date snapshots (one row per symbol, all the columns a
preset reads), so each condition and its edges are exercised directly. build_snapshot is tested
end to end on a small multi-symbol bar set.
"""

import polars as pl
import pytest

import scans
from toy_series import toy_ohlcv

# A neutral snapshot row — nothing triggers. Each test overrides only the fields it cares about.
_NEUTRAL = {
    "symbol": "AAA",
    "close": 50.0,
    "rvol20": 1.0,
    "ret_1": 0.0,
    "gap_pct": 0.0,
    "dist_52w_high": -0.5,
    "rsi14": 50.0,
    "rsi14_prev": 50.0,
    "sma50": 10.0,
    "sma200": 10.0,
    "sma50_prev": 10.0,
    "sma200_prev": 10.0,
    "sma50_prev2": 10.0,
    "sma200_prev2": 10.0,
    "skew_60": 0.0,
    "dollar_volume": 1e9,
    "is_large_mid": True,
    "lottery_flag": False,
}


def _snapshot(*overrides: dict) -> pl.DataFrame:
    rows = [{**_NEUTRAL, **o} for o in overrides]
    # Give distinct symbols if the caller didn't.
    for i, r in enumerate(rows):
        r.setdefault("symbol", f"S{i}")
    return pl.DataFrame(rows)


class TestUnusualVolume:
    def test_matches_high_rvol_and_move(self):
        snap = _snapshot({"symbol": "HIT", "rvol20": 3.0, "ret_1": 0.03})
        assert scans.run_scan(snap, scans.UNUSUAL_VOLUME)["symbol"].to_list() == ["HIT"]

    def test_needs_both_rvol_and_move(self):
        snap = _snapshot(
            {"symbol": "LOWVOL", "rvol20": 2.0, "ret_1": 0.05},   # rvol too low
            {"symbol": "SMALLMOVE", "rvol20": 3.0, "ret_1": 0.01},  # move too small
        )
        assert scans.run_scan(snap, scans.UNUSUAL_VOLUME).height == 0

    def test_a_big_down_move_counts_too(self):
        snap = _snapshot({"symbol": "DOWN", "rvol20": 3.0, "ret_1": -0.04})
        assert scans.run_scan(snap, scans.UNUSUAL_VOLUME).height == 1


class TestNear52wHigh:
    def test_matches_within_two_percent_when_large_mid(self):
        snap = _snapshot({"symbol": "NEAR", "dist_52w_high": -0.01, "is_large_mid": True})
        assert scans.run_scan(snap, scans.NEAR_52W_HIGH)["symbol"].to_list() == ["NEAR"]

    def test_excludes_small_caps(self):
        snap = _snapshot({"symbol": "SMALL", "dist_52w_high": -0.01, "is_large_mid": False})
        assert scans.run_scan(snap, scans.NEAR_52W_HIGH).height == 0

    def test_excludes_names_more_than_two_percent_off(self):
        snap = _snapshot({"symbol": "FAR", "dist_52w_high": -0.05})
        assert scans.run_scan(snap, scans.NEAR_52W_HIGH).height == 0


class TestGap:
    def test_matches_gap_up_and_down_over_three_percent(self):
        snap = _snapshot(
            {"symbol": "UP", "gap_pct": 0.04},
            {"symbol": "DOWN", "gap_pct": -0.035},
            {"symbol": "SMALL", "gap_pct": 0.02},
        )
        assert set(scans.run_scan(snap, scans.GAP_3PLUS)["symbol"].to_list()) == {"UP", "DOWN"}


class TestGoldenCrossFresh:
    def test_matches_a_cross_today(self):
        snap = _snapshot(
            {"symbol": "CROSS", "sma50": 11.0, "sma200": 10.0, "sma50_prev": 9.9, "sma200_prev": 10.0}
        )
        assert scans.run_scan(snap, scans.GOLDEN_CROSS_FRESH)["symbol"].to_list() == ["CROSS"]

    def test_matches_a_cross_yesterday(self):
        snap = _snapshot(
            {
                "symbol": "YDAY",
                "sma50": 11.2, "sma200": 10.0,
                "sma50_prev": 11.0, "sma200_prev": 10.0,     # already above today and yesterday
                "sma50_prev2": 9.9, "sma200_prev2": 10.0,    # below two bars ago -> crossed yesterday
            }
        )
        assert scans.run_scan(snap, scans.GOLDEN_CROSS_FRESH)["symbol"].to_list() == ["YDAY"]

    def test_ignores_a_long_established_cross(self):
        snap = _snapshot(
            {
                "symbol": "OLD",
                "sma50": 12.0, "sma200": 10.0,
                "sma50_prev": 11.8, "sma200_prev": 10.0,
                "sma50_prev2": 11.5, "sma200_prev2": 10.0,   # above throughout -> not fresh
            }
        )
        assert scans.run_scan(snap, scans.GOLDEN_CROSS_FRESH).height == 0


class TestRsiExtreme:
    def test_matches_crossing_30_up(self):
        snap = _snapshot({"symbol": "OVERSOLD", "rsi14": 32.0, "rsi14_prev": 28.0})
        assert scans.run_scan(snap, scans.RSI_EXTREME)["symbol"].to_list() == ["OVERSOLD"]

    def test_matches_crossing_70_down(self):
        snap = _snapshot({"symbol": "OVERBOUGHT", "rsi14": 68.0, "rsi14_prev": 72.0})
        assert scans.run_scan(snap, scans.RSI_EXTREME)["symbol"].to_list() == ["OVERBOUGHT"]

    def test_ignores_rsi_sitting_in_the_middle(self):
        snap = _snapshot({"symbol": "MID", "rsi14": 55.0, "rsi14_prev": 52.0})
        assert scans.run_scan(snap, scans.RSI_EXTREME).height == 0


class TestRankingAndLottery:
    def test_matches_are_ranked_strongest_first(self):
        snap = _snapshot(
            {"symbol": "BIG", "rvol20": 5.0, "ret_1": 0.03},
            {"symbol": "MID", "rvol20": 3.0, "ret_1": 0.03},
        )
        result = scans.run_scan(snap, scans.UNUSUAL_VOLUME)
        assert result["symbol"].to_list() == ["BIG", "MID"]
        assert result["rank"].to_list() == [1, 2]

    def test_lottery_flag_carries_through_from_the_snapshot(self):
        snap = _snapshot({"symbol": "PENNY", "close": 3.0, "rvol20": 3.0, "ret_1": 0.03, "lottery_flag": True})
        assert scans.run_scan(snap, scans.UNUSUAL_VOLUME)["lottery_flag"].to_list() == [True]


class TestRunAll:
    def test_stacks_matches_from_every_preset(self):
        snap = _snapshot(
            {"symbol": "VOL", "rvol20": 3.0, "ret_1": 0.03},
            {"symbol": "GAP", "gap_pct": 0.05},
        )
        result = scans.run_all(snap)
        assert set(result["preset_key"].to_list()) == {scans.UNUSUAL_VOLUME, scans.GAP_3PLUS}

    def test_empty_when_nothing_matches(self):
        assert scans.run_all(_snapshot({"symbol": "QUIET"})).height == 0


class TestBuildSnapshot:
    def test_reduces_each_symbol_to_one_latest_row_with_the_scan_columns(self):
        # Two symbols, each a full toy history; the second scaled to differ.
        a = toy_ohlcv(260).with_columns(pl.lit("AAA").alias("symbol"))
        b = toy_ohlcv(260).with_columns(
            pl.lit("BBB").alias("symbol"),
            (pl.col("close") * 1.5).alias("close"),
        )
        bars = pl.concat([a, b])
        snap = scans.build_snapshot(bars)

        assert set(snap["symbol"].to_list()) == {"AAA", "BBB"}
        assert snap.height == 2  # one row per symbol
        for col in ("rsi14", "sma50_prev", "skew_60", "is_large_mid", "lottery_flag"):
            assert col in snap.columns

    def test_the_snapshot_row_is_the_latest_date(self):
        bars = toy_ohlcv(260).with_columns(pl.lit("AAA").alias("symbol"))
        snap = scans.build_snapshot(bars)
        assert snap["date"].to_list() == [bars["date"].max()]


class TestLotteryFlagRule:
    """The lottery-flag rule directly (Appendix F, plan §6.2): price < $5, OR a top-decile 60-day
    skew name priced under $10. A normal name is never flagged."""

    def test_sub_five_dollar_is_always_flagged(self):
        snap = scans._add_lottery_flag(_snapshot(
            {"symbol": "PENNY", "close": 3.0, "skew_60": 0.0},
            {"symbol": "NORMAL", "close": 50.0, "skew_60": 0.0},
        ))
        flags = dict(zip(snap["symbol"].to_list(), snap["lottery_flag"].to_list()))
        assert flags["PENNY"] is True
        assert flags["NORMAL"] is False

    def test_high_skew_under_ten_dollars_is_flagged_but_not_at_or_above_ten(self):
        snap = scans._add_lottery_flag(_snapshot(
            {"symbol": "SKEWLOW", "close": 8.0, "skew_60": 5.0},    # top-decile skew, under $10 → flag
            {"symbol": "SKEWHIGH", "close": 12.0, "skew_60": 5.0},  # same skew but ≥ $10 → no flag
            {"symbol": "CALM", "close": 8.0, "skew_60": -1.0},      # under $10 but low skew → no flag
        ))
        flags = dict(zip(snap["symbol"].to_list(), snap["lottery_flag"].to_list()))
        assert flags["SKEWLOW"] is True
        assert flags["SKEWHIGH"] is False
        assert flags["CALM"] is False
