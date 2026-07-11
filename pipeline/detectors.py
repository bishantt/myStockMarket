"""
detectors.py — the six v1 pattern detectors (plan P4 step 1, Appendix F).

A detector reads a symbol's indicator history and emits one signal_events row on every bar where its
pattern completes: {symbol, date, pattern_key, direction, attrs}. These events are the raw material
for base rates — for each event we later measure what the price did over the next 5/10/20 trading
days and count how often it was higher.

Two rules make the events honest:

  1. Every prior-bar comparison uses `.shift(1).over("symbol")`, never a forward shift, so a
     detector at bar t reads only data through t. There is no way to peek at a future bar.

  2. The forward-return join is shifted ONE bar past the signal: the entry is the bar AFTER the
     signal fired (you see the signal at its close and act next), and the h-day outcome is measured
     from there. `forward_returns` computes exactly that, so a base rate can never quietly include
     the signal bar's own move.

The six patterns (Appendix F) are golden cross, 52-week-high proximity, gap-with-catalyst, RSI
extreme, unusual volume, and the market-level breadth-regime cross. The first five are per-symbol
and computed by `detect`; breadth is a single market series and is handled by `detect_breadth`.
"""

from __future__ import annotations

import polars as pl

# The six pattern keys. These are the pattern_meta keys (decay/grade) and the base_rate_stat
# patterns; two of them (unusual-volume, rsi-extreme) share their thresholds with the P1 scan
# presets — one definition, two consumers (Appendix F).
GOLDEN_CROSS = "golden-cross"
NEAR_52W_HIGH = "52w-high-proximity"
GAP_CATALYST = "gap-with-catalyst"
RSI_EXTREME = "rsi-extreme"
UNUSUAL_VOLUME = "unusual-volume"
BREADTH_REGIME = "breadth-regime"

# Appendix F thresholds.
_NEAR_52W_ZONE = -0.02   # within 2% below the 52-week high (dist is close/high - 1, ≤ 0)
_GAP_MIN = 0.03          # |gap| ≥ 3%
_RVOL_MIN = 2.5          # RVOL ≥ 2.5
_MOVE_MIN = 0.02         # |1-day return| ≥ 2%
_RSI_LOW = 30.0
_RSI_HIGH = 70.0
_BREADTH_LEVEL = 50.0    # % of the universe above its 50-day average


def detect(indicators: pl.DataFrame) -> pl.DataFrame:
    """Run the five per-symbol detectors over an indicator frame and return the signal_events rows.

    The frame carries the v1 indicator columns (from with_indicators) for one or many symbols, in
    ascending date order per symbol. Returns a long frame: symbol, date, pattern_key, direction,
    attrs (a small struct of the triggering metric). Empty when nothing fired.
    """
    frame = indicators.sort(["symbol", "date"])
    parts = [
        _golden_cross(frame),
        _near_52w_high(frame),
        _gap_catalyst(frame),
        _rsi_extreme(frame),
        _unusual_volume(frame),
    ]
    events = [part for part in parts if part.height > 0]
    if not events:
        return _empty_events()
    return pl.concat(events, how="vertical_relaxed").sort(["date", "symbol", "pattern_key"])


def detect_breadth(breadth: pl.DataFrame) -> pl.DataFrame:
    """The market-level breadth-regime detector: fire when the share of the universe above its
    50-day average crosses 50% either way. `breadth` carries date and pct_above_50dma in ascending
    date order. The event's symbol is the market marker, not a ticker."""
    prev = pl.col("pct_above_50dma").shift(1)
    crossed_up = (pl.col("pct_above_50dma") >= _BREADTH_LEVEL) & (prev < _BREADTH_LEVEL)
    crossed_down = (pl.col("pct_above_50dma") < _BREADTH_LEVEL) & (prev >= _BREADTH_LEVEL)
    fired = breadth.filter(crossed_up | crossed_down).with_columns(
        pl.lit("MARKET").alias("symbol"),
        pl.lit(BREADTH_REGIME).alias("pattern_key"),
        pl.when(pl.col("pct_above_50dma") >= _BREADTH_LEVEL).then(pl.lit("up")).otherwise(pl.lit("down")).alias("direction"),
        pl.struct([pl.col("pct_above_50dma").alias("pct")]).alias("attrs"),
    )
    return fired.select(["symbol", "date", "pattern_key", "direction", "attrs"])


def forward_returns(indicators: pl.DataFrame, horizons: tuple[int, ...] = (5, 10, 20)) -> pl.DataFrame:
    """For every (symbol, date), the h-day forward return anchored ONE bar after the signal.

    Entry is close[t+1], exit is close[t+1+h], so fwd_h = close[t+1+h]/close[t+1] - 1. Near the end
    of a symbol's history the future bars do not exist, so fwd_h (and its up flag) is null and the
    base-rate computation simply skips it — an unresolved event is not a zero.
    """
    frame = indicators.sort(["symbol", "date"])
    exprs: list[pl.Expr] = [pl.col("symbol"), pl.col("date")]
    entry = pl.col("close").shift(-1).over("symbol")
    for h in horizons:
        exit_price = pl.col("close").shift(-(h + 1)).over("symbol")
        fwd = (exit_price / entry - 1.0).alias(f"fwd_{h}")
        exprs.append(fwd)
        exprs.append((exit_price > entry).alias(f"up_{h}"))
    return frame.select(exprs)


# ----- per-symbol detectors -----

def _golden_cross(frame: pl.DataFrame) -> pl.DataFrame:
    sma50, sma200 = pl.col("sma50"), pl.col("sma200")
    prev_50, prev_200 = sma50.shift(1).over("symbol"), sma200.shift(1).over("symbol")
    fired = (sma50 > sma200) & (prev_50 <= prev_200) & sma200.is_not_null() & prev_200.is_not_null()
    return _events(frame, fired, GOLDEN_CROSS, pl.lit("up"), pl.struct([(sma50 - sma200).alias("spread")]))


def _near_52w_high(frame: pl.DataFrame) -> pl.DataFrame:
    dist = pl.col("dist_52w_high")
    prev = dist.shift(1).over("symbol")
    fired = (dist >= _NEAR_52W_ZONE) & (prev < _NEAR_52W_ZONE)
    return _events(frame, fired, NEAR_52W_HIGH, pl.lit("up"), pl.struct([dist.alias("dist_52w_high")]))


def _gap_catalyst(frame: pl.DataFrame) -> pl.DataFrame:
    if "has_catalyst" not in frame.columns:
        return _empty_events()
    gap = pl.col("gap_pct")
    fired = (gap.abs() >= _GAP_MIN) & pl.col("has_catalyst")
    direction = pl.when(gap >= 0).then(pl.lit("up")).otherwise(pl.lit("down"))
    return _events(frame, fired, GAP_CATALYST, direction, pl.struct([gap.alias("gap_pct")]))


def _rsi_extreme(frame: pl.DataFrame) -> pl.DataFrame:
    rsi = pl.col("rsi14")
    prev = rsi.shift(1).over("symbol")
    crossed_up = (rsi >= _RSI_LOW) & (prev < _RSI_LOW)
    crossed_down = (rsi <= _RSI_HIGH) & (prev > _RSI_HIGH)
    fired = crossed_up | crossed_down
    direction = pl.when(crossed_up).then(pl.lit("up")).otherwise(pl.lit("down"))
    return _events(frame, fired, RSI_EXTREME, direction, pl.struct([rsi.alias("rsi14")]))


def _unusual_volume(frame: pl.DataFrame) -> pl.DataFrame:
    ret = pl.col("ret_1")
    fired = (pl.col("rvol20") >= _RVOL_MIN) & (ret.abs() >= _MOVE_MIN)
    direction = pl.when(ret >= 0).then(pl.lit("up")).otherwise(pl.lit("down"))
    return _events(frame, fired, UNUSUAL_VOLUME, direction, pl.struct([pl.col("rvol20").alias("rvol20"), ret.alias("ret_1")]))


# ----- helpers -----

def _events(frame: pl.DataFrame, fired: pl.Expr, pattern_key: str, direction: pl.Expr, attrs: pl.Expr) -> pl.DataFrame:
    """Materialize the rows where `fired` is true into signal_events shape."""
    marked = frame.with_columns(
        fired.fill_null(False).alias("_fired"),
        pl.lit(pattern_key).alias("pattern_key"),
        direction.alias("direction"),
        attrs.alias("attrs"),
    )
    return marked.filter(pl.col("_fired")).select(["symbol", "date", "pattern_key", "direction", "attrs"])


def _empty_events() -> pl.DataFrame:
    return pl.DataFrame(
        schema={"symbol": pl.String, "date": pl.Date, "pattern_key": pl.String,
                "direction": pl.String, "attrs": pl.Struct([])}
    )
