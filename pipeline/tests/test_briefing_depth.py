"""
Tests for briefing/depth.py — the depth engine (POLISH-AND-DEPTH-PLAN Part 9.2).

TDD-first, as the plan orders: every stat gets a fixture-computed test (known bars → known value),
and one property test pins the rule that matters most — **no stat is emitted for a symbol the lake
lacks.** Absence over invention: a registry stat that guesses is the gate's blind spot, because the
gate's whole job is to check prose against the registry. A registry that invents a number would be
a gate that certifies it.

The bars here are hand-built and small. Where a window is required (252 sessions for the 52-week
range, 50 for the moving average) a frame with FEWER bars than the window yields None rather than a
"52-week" claim computed over four months — a shorter window wearing a longer window's name is the
kind of quiet lie this app is built against.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from briefing.depth import (
    Bar,
    build_ticker_depth,
    consecutive_streak,
    distance_from_50d,
    position_in_52w_range,
)


def _bars(closes: list[float], *, highs: list[float] | None = None,
          lows: list[float] | None = None) -> list[Bar]:
    """Ascending daily bars. Highs/lows default to the close, which keeps a test about the CLOSE
    from having to state a high and a low it does not care about."""
    start = date(2025, 1, 1)
    return [
        Bar(
            date=start + timedelta(days=index),
            high=(highs[index] if highs else close),
            low=(lows[index] if lows else close),
            close=close,
        )
        for index, close in enumerate(closes)
    ]


# ----- the 52-week position -----

def test_position_in_52w_range_is_the_percent_of_the_way_from_low_to_high():
    """Three numbers, one stat: where the close sits between the year's low and its high."""
    closes = [100.0] * 251 + [150.0]
    highs = [200.0] + [100.0] * 250 + [150.0]  # the year's high, set on the first bar
    lows = [100.0] * 250 + [50.0] + [150.0]    # the year's low, set on the second-to-last
    result = position_in_52w_range(_bars(closes, highs=highs, lows=lows))

    assert result is not None
    assert result.low == 50.0
    assert result.high == 200.0
    # (150 - 50) / (200 - 50) = 66.67%
    assert result.pct == pytest.approx(66.666, abs=0.01)


def test_position_in_52w_range_needs_a_full_year_of_bars():
    """A "52-week range" computed over 251 sessions is not a 52-week range. It is absent instead."""
    assert position_in_52w_range(_bars([100.0] * 251)) is None


def test_position_in_52w_range_looks_only_at_the_trailing_window():
    """A five-year lake must not let an ancient high leak into a 52-week claim."""
    ancient = [999.0] + [100.0] * 251 + [120.0]  # the 999 sits one bar OUTSIDE the 252-bar window
    result = position_in_52w_range(_bars(ancient))

    assert result is not None
    assert result.high == 120.0, "a price older than the window entered the range"


def test_a_flat_year_has_no_position_in_its_range():
    """A range of zero width has no "percent of the way" — the division is undefined, and inventing
    0% or 100% for it would be the app answering a question the data cannot."""
    assert position_in_52w_range(_bars([100.0] * 252)) is None


# ----- the streak -----

def test_consecutive_streak_counts_sessions_through_tonight():
    closes = [100.0, 99.0, 98.0, 99.0, 100.0, 101.0]  # three up sessions to close
    result = consecutive_streak(_bars(closes))

    assert result is not None
    assert result.length == 3
    assert result.direction == "up"


def test_consecutive_streak_reads_down_sessions_too():
    result = consecutive_streak(_bars([100.0, 101.0, 100.0, 99.0]))

    assert result is not None
    assert result.length == 2
    assert result.direction == "down"


def test_an_unchanged_close_breaks_a_streak():
    """A flat session is not an up session. Counting it as one would inflate every streak on the
    board by whatever the market did nothing on."""
    result = consecutive_streak(_bars([100.0, 101.0, 102.0, 102.0]))

    assert result is None


def test_a_streak_needs_two_bars_to_exist():
    assert consecutive_streak(_bars([100.0])) is None


# ----- the 50-day distance -----

def test_distance_from_50d_is_signed_against_the_average():
    closes = [100.0] * 49 + [149.0]  # mean of the trailing 50 = (49*100 + 149)/50 = 100.98
    result = distance_from_50d(_bars(closes))

    assert result == pytest.approx((149.0 - 100.98) / 100.98 * 100, abs=0.01)


def test_distance_from_50d_needs_fifty_bars():
    assert distance_from_50d(_bars([100.0] * 49)) is None


# ----- the whole depth object, and the rule that governs it -----

def test_build_ticker_depth_assembles_every_measure_it_can():
    closes = [100.0] * 250 + [98.0, 104.0]
    depth = build_ticker_depth("AAPL", _bars(closes), ret1=0.06, atr14_pct=0.02)

    assert depth.symbol == "AAPL"
    assert depth.pos52w is not None
    assert depth.from50d is not None
    assert depth.streak is not None and depth.streak.length == 1
    assert depth.move_atr == pytest.approx(3.0)  # a 6% move in a name whose ATR is 2%


def test_no_stat_is_emitted_for_a_symbol_the_lake_lacks():
    """THE PROPERTY TEST THE PLAN NAMES. Absence over invention.

    A symbol with no bars produces a depth object with every measure absent — never a zero, never a
    default. The narrator then simply has less vocabulary about that name, which is honest
    degradation and exactly zero new failure modes. The dangerous alternative is a stat that
    defaults: the gate would then CERTIFY the default, because the registry is what the gate checks
    against, and a fabricated number that the pipeline itself minted is one no gate can catch.
    """
    depth = build_ticker_depth("NEWLY", [], ret1=None, atr14_pct=None)

    assert depth.pos52w is None
    assert depth.move_atr is None
    assert depth.streak is None
    assert depth.from50d is None
    assert not depth.any_measure(), "a symbol with no bars produced a quotable number"


def test_a_move_with_no_atr_yields_no_atr_relative_stat():
    """The ratio needs both halves. An unknown ATR is not an ATR of zero — and dividing by it would
    be the single most confident wrong number the pipeline could publish."""
    depth = build_ticker_depth("AAPL", _bars([100.0] * 251 + [104.0]), ret1=0.06, atr14_pct=None)

    assert depth.move_atr is None
    assert depth.pos52w is not None, "the other measures still stand"
