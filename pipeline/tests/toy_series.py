"""
toy_series.py — a frozen, deterministic OHLCV series for indicator tests (plan Appendix F).

The indicators are verified against pandas-ta-classic (an independent oracle), so the series must
be exactly reproducible with no randomness. It is generated from a closed-form formula rather than
recorded data: that makes it deterministic across machines, long enough for every indicator
(including the 200-day moving average), and free of the survivorship and vendor quirks of real
prices — the point here is to check the MATH, not the data.

The shape is realistic enough to exercise the indicators: a gently rising trend with two
overlaid cycles, opens that gap from the prior close, and highs/lows that bracket the body.
"""

from __future__ import annotations

import math

import polars as pl

# Long enough that SMA 200 and the MACD signal line both have real values to check.
DEFAULT_BARS = 240


def toy_ohlcv(n: int = DEFAULT_BARS) -> pl.DataFrame:
    """
    Build the deterministic OHLCV frame: columns date, open, high, low, close, volume.

    Every value comes from `i` (the bar index) alone, so the series is identical everywhere.
    """
    dates: list = []
    opens: list[float] = []
    highs: list[float] = []
    lows: list[float] = []
    closes: list[float] = []
    volumes: list[int] = []

    prev_close = 100.0
    # A fixed start date; the exact calendar does not matter for indicator math, only the order.
    from datetime import date, timedelta

    start = date(2025, 1, 1)

    for i in range(n):
        # Trend plus two cycles — smooth but not monotone, so RSI/MACD have something to chew on.
        close = 100.0 + 0.12 * i + 6.0 * math.sin(i / 6.0) + 2.5 * math.cos(i / 2.3)
        # Open gaps a little from the prior close, deterministically.
        gap = 0.4 * math.sin(i / 3.0)
        open_ = prev_close + gap
        # High/low bracket the open-close body with a deterministic wick.
        wick = 0.8 + 0.5 * abs(math.sin(i / 4.0))
        high = max(open_, close) + wick
        low = min(open_, close) - wick
        # Volume rises and falls on its own cycle, always a positive integer.
        volume = int(1_000_000 + 300_000 * math.sin(i / 5.0) + 1000 * i)

        dates.append(start + timedelta(days=i))
        opens.append(round(open_, 4))
        highs.append(round(high, 4))
        lows.append(round(low, 4))
        closes.append(round(close, 4))
        volumes.append(volume)
        prev_close = close

    return pl.DataFrame(
        {
            "date": dates,
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": volumes,
        }
    )
