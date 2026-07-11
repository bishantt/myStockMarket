"""
Tests for indicators.py (plan P1 step 3, §6.2), verified against pandas-ta-classic — an
independent oracle — on the deterministic toy series.

Two kinds of check:
  - Exact match, whole valid range, for the non-recursive indicators (SMA, Bollinger, RVOL, gap,
    returns, 52-week-high distance).
  - Converged-region match for the recursive smoothers (EMA, RSI, MACD, ATR): they and the oracle
    seed the warm-up differently but converge exponentially, so the tail must agree tightly and
    the null warm-up must line up.
Plus the causality guard: an indicator at bar t must never move when a LATER bar is appended.
"""

import numpy as np
import pandas as pd
import pandas_ta_classic as ta
import pytest

from indicators import with_indicators
from toy_series import toy_ohlcv

# By this bar the recursive smoothers have shed their seed (the largest window is 26, and its
# influence decays by orders of magnitude over ~200 bars); the tail is a fair exact comparison.
CONVERGED_FROM = 210


@pytest.fixture(scope="module")
def frames():
    bars = toy_ohlcv(240)
    ours = with_indicators(bars).to_pandas()
    pdf = bars.to_pandas()
    return ours, pdf


def _oracle(pdf: pd.DataFrame) -> dict[str, pd.Series]:
    close, high, low = pdf["close"], pdf["high"], pdf["low"]
    macd = ta.macd(close, fast=12, slow=26, signal=9)
    bb = ta.bbands(close, length=20, std=2)
    return {
        "sma20": ta.sma(close, 20),
        "sma50": ta.sma(close, 50),
        "sma200": ta.sma(close, 200),
        "ema12": ta.ema(close, 12),
        "ema26": ta.ema(close, 26),
        "rsi14": ta.rsi(close, 14),
        "atr14": ta.atr(high, low, close, 14),
        "macd": macd["MACD_12_26_9"],
        "macd_signal": macd["MACDs_12_26_9"],
        "macd_hist": macd["MACDh_12_26_9"],
        "bb_lower": bb["BBL_20_2.0"],
        "bb_mid": bb["BBM_20_2.0"],
        "bb_upper": bb["BBU_20_2.0"],
    }


def _same_null_pattern(mine: np.ndarray, oracle: np.ndarray) -> bool:
    return bool(np.array_equal(np.isnan(mine), np.isnan(oracle)))


def _values(series) -> np.ndarray:
    return np.asarray(series, dtype=float)


class TestExactAgainstOracle:
    """Non-recursive indicators must match the oracle across their whole valid range."""

    @pytest.mark.parametrize("name", ["sma20", "sma50", "sma200", "bb_lower", "bb_mid", "bb_upper"])
    def test_matches_exactly(self, frames, name):
        ours, pdf = frames
        oracle = _oracle(pdf)[name]
        mine, orc = _values(ours[name]), _values(oracle)
        assert _same_null_pattern(mine, orc), f"{name}: null pattern differs"
        mask = ~np.isnan(mine)
        assert np.allclose(mine[mask], orc[mask], rtol=1e-9, atol=1e-9), name


class TestConvergedAgainstOracle:
    """Recursive smoothers: identical null warm-up, and a tight match once converged."""

    @pytest.mark.parametrize("name", ["ema12", "ema26", "rsi14", "atr14", "macd", "macd_signal", "macd_hist"])
    def test_converges_to_oracle(self, frames, name):
        ours, pdf = frames
        orc = _values(_oracle(pdf)[name])
        mine = _values(ours[name])
        assert _same_null_pattern(mine, orc), f"{name}: null warm-up differs"
        tail = np.arange(len(mine)) >= CONVERGED_FROM
        mask = tail & ~np.isnan(mine)
        assert np.allclose(mine[mask], orc[mask], rtol=1e-6, atol=1e-5), name


class TestArithmeticDirectly:
    """Indicators pandas-ta does not provide, checked against their own definitions."""

    def test_rvol_is_volume_over_trailing_mean(self, frames):
        ours, pdf = frames
        vol = pdf["volume"].astype(float)
        expected = vol / vol.rolling(20, min_periods=20).mean()
        mine, exp = _values(ours["rvol20"]), _values(expected)
        assert _same_null_pattern(mine, exp)
        mask = ~np.isnan(mine)
        assert np.allclose(mine[mask], exp[mask], rtol=1e-9)

    def test_gap_pct_is_open_over_prior_close(self, frames):
        ours, pdf = frames
        expected = (pdf["open"] - pdf["close"].shift(1)) / pdf["close"].shift(1)
        mine, exp = _values(ours["gap_pct"]), _values(expected)
        mask = ~np.isnan(exp)
        assert np.allclose(mine[mask], exp[mask], rtol=1e-9)

    @pytest.mark.parametrize("n", [1, 5, 20])
    def test_returns_over_n_bars(self, frames, n):
        ours, pdf = frames
        expected = pdf["close"] / pdf["close"].shift(n) - 1
        mine, exp = _values(ours[f"ret_{n}"]), _values(expected)
        mask = ~np.isnan(exp)
        assert np.allclose(mine[mask], exp[mask], rtol=1e-9)

    def test_dist_52w_high_is_zero_or_negative(self, frames):
        ours, _ = frames
        vals = _values(ours["dist_52w_high"])
        present = vals[~np.isnan(vals)]
        # Never above the rolling high, so distance is always <= a hair over zero.
        assert (present <= 1e-9).all()


class TestCausality:
    """The one-bar lookahead guard: a later bar must never change an earlier indicator value."""

    def test_appending_a_future_bar_does_not_change_the_past(self):
        full = toy_ohlcv(240)
        short = with_indicators(full.head(200)).to_pandas()
        long = with_indicators(full).to_pandas().head(200)

        for col in short.columns:
            if col in ("date", "open", "high", "low", "close", "volume"):
                continue
            a, b = _values(short[col]), _values(long[col])
            # Same nulls and same values over the first 200 rows, regardless of what follows.
            assert _same_null_pattern(a, b), f"{col}: causality — null pattern changed"
            mask = ~np.isnan(a)
            assert np.allclose(a[mask], b[mask], rtol=1e-12, atol=1e-12), f"{col}: not causal"
