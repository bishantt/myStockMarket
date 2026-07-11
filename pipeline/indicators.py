"""
indicators.py — the v1 technical indicators as Polars expressions (plan Appendix F, P1 step 3).

Every indicator here is a pure Polars expression over a bar frame (columns date, open, high, low,
close, volume, in date order). That matters for scale: these run across the whole ~5-6k-symbol
universe over years of history, and native Polars expressions are far faster than any per-row
Python loop.

Correctness is checked against pandas-ta-classic (an independent oracle) in the tests. Two
conventions are worth stating because they show up in that comparison:

  - The recursive smoothers (EMA, and Wilder's RMA behind RSI and ATR) are computed with Polars'
    `ewm_mean(adjust=False)`. Polars seeds the recursion at the first observation; pandas-ta seeds
    it with a simple average of the first window. The two differ only during the warm-up and
    converge exponentially — both are standard, and by the time any pattern can fire (a golden
    cross needs 200 bars) the difference is long gone. The tests assert agreement on the converged
    region and identical null warm-up.

  - Everything else (SMA, Bollinger, returns, gap, RVOL, 52-week-high distance) is exact.
"""

from __future__ import annotations

import polars as pl


def sma(length: int, column: str = "close") -> pl.Expr:
    """Simple moving average — the rolling mean over `length` bars, null until it is full."""
    return pl.col(column).rolling_mean(window_size=length, min_samples=length)


def ema(length: int, column: str = "close") -> pl.Expr:
    """Exponential moving average, alpha = 2/(length+1), null until `length` bars exist."""
    return pl.col(column).ewm_mean(
        alpha=2.0 / (length + 1), adjust=False, min_samples=length
    )


def _wilder(expr: pl.Expr, length: int) -> pl.Expr:
    """Wilder's smoothing (RMA): an EMA with alpha = 1/length. The engine behind RSI and ATR."""
    return expr.ewm_mean(alpha=1.0 / length, adjust=False, min_samples=length)


def rsi(length: int = 14, column: str = "close") -> pl.Expr:
    """
    Wilder's Relative Strength Index over `length` bars.

    Gains and losses are the positive and negative parts of the day-over-day change; each is
    Wilder-smoothed, and RSI = 100 - 100/(1 + avg_gain/avg_loss). The first change is treated as
    zero (there is no prior bar), matching the oracle's warm-up position.
    """
    delta = pl.col(column).diff().fill_null(0.0)
    gain = pl.when(delta > 0).then(delta).otherwise(0.0)
    loss = pl.when(delta < 0).then(-delta).otherwise(0.0)
    avg_gain = _wilder(gain, length)
    avg_loss = _wilder(loss, length)
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def macd(
    fast: int = 12, slow: int = 26, signal: int = 9, column: str = "close"
) -> dict[str, pl.Expr]:
    """
    MACD (12-26-9): the fast EMA minus the slow EMA, its signal EMA, and the histogram between.

    Returns the three lines as named expressions so a caller can add them in one `with_columns`.
    """
    macd_line = ema(fast, column) - ema(slow, column)
    signal_line = macd_line.ewm_mean(
        alpha=2.0 / (signal + 1), adjust=False, min_samples=signal
    )
    return {
        "macd": macd_line,
        "macd_signal": signal_line,
        "macd_hist": macd_line - signal_line,
    }


def atr(length: int = 14) -> pl.Expr:
    """
    Average True Range over `length` bars (Wilder-smoothed).

    True range is the greatest of the day's range and the gaps to the prior close; ATR smooths it.
    """
    prev_close = pl.col("close").shift(1)
    true_range = pl.max_horizontal(
        pl.col("high") - pl.col("low"),
        (pl.col("high") - prev_close).abs(),
        (pl.col("low") - prev_close).abs(),
    )
    # The first bar has no prior close, so its true range is just the high-low range.
    true_range = pl.when(prev_close.is_null()).then(
        pl.col("high") - pl.col("low")
    ).otherwise(true_range)
    return _wilder(true_range, length)


def bollinger(length: int = 20, num_std: float = 2.0, column: str = "close") -> dict[str, pl.Expr]:
    """
    Bollinger bands: the SMA middle band and bands `num_std` population deviations above and below.

    Uses population standard deviation (ddof=0), which is the TA-library convention the oracle uses.
    """
    mid = sma(length, column)
    dev = pl.col(column).rolling_std(window_size=length, min_samples=length, ddof=0)
    return {
        "bb_lower": mid - num_std * dev,
        "bb_mid": mid,
        "bb_upper": mid + num_std * dev,
    }


def rvol(length: int = 20) -> pl.Expr:
    """Relative volume: today's volume over the trailing `length`-day average volume (Appendix F)."""
    return pl.col("volume") / pl.col("volume").rolling_mean(
        window_size=length, min_samples=length
    )


def dist_52w_high(window: int = 252, column: str = "close") -> pl.Expr:
    """
    Distance to the 52-week high, as a signed fraction: close / (rolling max high) - 1.

    Zero at a fresh high, negative below it. Uses the rolling max of the daily HIGH over `window`
    bars — the highest intraday price in the last year.
    """
    rolling_high = pl.col("high").rolling_max(window_size=window, min_samples=window)
    return pl.col(column) / rolling_high - 1.0


def gap_pct() -> pl.Expr:
    """Opening gap: (today's open - prior close) / prior close."""
    prev_close = pl.col("close").shift(1)
    return (pl.col("open") - prev_close) / prev_close


def returns(n: int, column: str = "close") -> pl.Expr:
    """Simple return over `n` bars: close / close[-n] - 1."""
    return pl.col(column) / pl.col(column).shift(n) - 1.0


def with_indicators(bars: pl.DataFrame) -> pl.DataFrame:
    """
    Add the full v1 indicator set to a single symbol's bar frame (Appendix F list).

    The frame must be one symbol's bars in ascending date order. Returns a new frame — the input
    is never mutated.
    """
    macd_cols = macd()
    bb_cols = bollinger()
    return bars.with_columns(
        sma(20).alias("sma20"),
        sma(50).alias("sma50"),
        sma(200).alias("sma200"),
        ema(12).alias("ema12"),
        ema(26).alias("ema26"),
        rsi(14).alias("rsi14"),
        macd_cols["macd"].alias("macd"),
        macd_cols["macd_signal"].alias("macd_signal"),
        macd_cols["macd_hist"].alias("macd_hist"),
        atr(14).alias("atr14"),
        bb_cols["bb_lower"].alias("bb_lower"),
        bb_cols["bb_mid"].alias("bb_mid"),
        bb_cols["bb_upper"].alias("bb_upper"),
        rvol(20).alias("rvol20"),
        dist_52w_high().alias("dist_52w_high"),
        gap_pct().alias("gap_pct"),
        returns(1).alias("ret_1"),
        returns(5).alias("ret_5"),
        returns(20).alias("ret_20"),
    )
