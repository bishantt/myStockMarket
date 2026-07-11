"""
scans.py — the five v1 scan presets (plan Appendix F, P1 step 4).

A scan looks at the whole universe on the run date and returns the symbols matching a preset — a
named, fully-visible recipe (the recipe IS the curriculum, plan §1.5 rule 8). The five presets
here use the exact same keys and thresholds as the P4 pattern detectors: one definition, two
consumers. The stated win-rate and N stay null until P4 gives them base rates; at P1 a match just
records that a preset fired and when it resolves.

The work is two steps:
  build_snapshot(bars)  — from every symbol's bars+indicators, produce one row per symbol on the
                          latest date, carrying the prior-bar values the crossing presets need and
                          the 60-day return skewness the lottery flag uses.
  run_scans(snapshot)   — apply each preset as a Polars filter, rank the matches, and attach the
                          lottery-risk flag.

Everything is a native Polars operation so it runs across ~5-6k symbols at once.
"""

from __future__ import annotations

import polars as pl

from indicators import with_indicators

# Preset keys, verbatim from Appendix F. Shared with the P4 detectors.
UNUSUAL_VOLUME = "unusual-volume"
NEAR_52W_HIGH = "near-52w-high"
GAP_3PLUS = "gap-3plus"
GOLDEN_CROSS_FRESH = "golden-cross-fresh"
RSI_EXTREME = "rsi-extreme"

PRESET_KEYS = [UNUSUAL_VOLUME, NEAR_52W_HIGH, GAP_3PLUS, GOLDEN_CROSS_FRESH, RSI_EXTREME]

# All P1 scans log a 10-trading-day horizon (Appendix F).
HORIZON_DAYS = 10

# "large/mid" = the top-1000 symbols by dollar volume (Appendix F). The near-52w-high preset is
# restricted to them; the historical point-in-time bucket for base rates is a P4 concern.
_LARGE_MID_RANK = 1000

# Lottery-risk rule (Appendix F): sub-$5, or a top-decile-skew name under $10.
_LOTTERY_PRICE = 5.0
_LOTTERY_SKEW_PRICE = 10.0
_SKEW_WINDOW = 60


def build_indicated(bars: pl.DataFrame) -> pl.DataFrame:
    """The full per-(symbol, date) indicator frame for the whole universe (Appendix F).

    `bars` is the union of all symbols' raw bars; this applies with_indicators per symbol and returns
    every bar with its v1 indicators. This is what the P4 detectors and base rates read; build_snapshot
    reduces it to the latest row per symbol for the scans.
    """
    return (
        bars.sort("symbol", "date")
        .group_by("symbol", maintain_order=True)
        .map_groups(with_indicators)
    )


def build_snapshot(bars: pl.DataFrame) -> pl.DataFrame:
    """
    Reduce every symbol's full bar history to one run-date row with everything the scans need.

    `bars` is the union of all symbols' bars (columns symbol, date, open, high, low, close,
    volume), not yet indicated. Indicators are computed per symbol, prior-bar values are captured
    for the crossing presets, and the 60-day return skewness is taken over each symbol's last
    `_SKEW_WINDOW` returns. The result is one row per symbol, its latest bar.
    """
    indicated = build_indicated(bars)

    with_prev = indicated.with_columns(
        pl.col("rsi14").shift(1).over("symbol").alias("rsi14_prev"),
        pl.col("sma50").shift(1).over("symbol").alias("sma50_prev"),
        pl.col("sma200").shift(1).over("symbol").alias("sma200_prev"),
        pl.col("sma50").shift(2).over("symbol").alias("sma50_prev2"),
        pl.col("sma200").shift(2).over("symbol").alias("sma200_prev2"),
        # Dollar volume proxies liquidity for the large/mid split.
        (pl.col("close") * pl.col("volume")).alias("dollar_volume"),
    )

    # 60-day return skewness per symbol, taken over each symbol's most recent window.
    skew = (
        with_prev.group_by("symbol", maintain_order=True)
        .agg(pl.col("ret_1").tail(_SKEW_WINDOW).skew().alias("skew_60"))
    )

    latest = (
        with_prev.group_by("symbol", maintain_order=True).tail(1).join(skew, on="symbol")
    )

    # Large/mid = top-N by dollar volume across the run-date snapshot.
    latest = latest.with_columns(
        (pl.col("dollar_volume").rank(method="ordinal", descending=True) <= _LARGE_MID_RANK).alias(
            "is_large_mid"
        )
    )
    return _add_lottery_flag(latest)


def _add_lottery_flag(snapshot: pl.DataFrame) -> pl.DataFrame:
    """Attach lottery_flag: sub-$5, or a top-decile-skew name under $10 (Appendix F)."""
    top_decile_skew = snapshot.select(pl.col("skew_60").quantile(0.9)).item()
    # If the universe is tiny (tests) the quantile may be null; treat that as "no top decile".
    skew_cut = top_decile_skew if top_decile_skew is not None else float("inf")
    return snapshot.with_columns(
        (
            (pl.col("close") < _LOTTERY_PRICE)
            | ((pl.col("close") < _LOTTERY_SKEW_PRICE) & (pl.col("skew_60") >= skew_cut))
        ).alias("lottery_flag")
    )


# ── the five presets, each a boolean expression over the snapshot ─────────────────────────────

def _unusual_volume() -> pl.Expr:
    return (pl.col("rvol20") >= 2.5) & (pl.col("ret_1").abs() >= 0.02)


def _near_52w_high() -> pl.Expr:
    # Within 2% of the 252-day high (dist is <= 0), large/mid only.
    return (pl.col("dist_52w_high") >= -0.02) & pl.col("is_large_mid")


def _gap_3plus() -> pl.Expr:
    return pl.col("gap_pct").abs() >= 0.03


def _golden_cross_fresh() -> pl.Expr:
    crossed_today = (pl.col("sma50") > pl.col("sma200")) & (
        pl.col("sma50_prev") <= pl.col("sma200_prev")
    )
    crossed_yesterday = (pl.col("sma50_prev") > pl.col("sma200_prev")) & (
        pl.col("sma50_prev2") <= pl.col("sma200_prev2")
    )
    return crossed_today | crossed_yesterday


def _rsi_extreme() -> pl.Expr:
    crossed_30_up = (pl.col("rsi14") >= 30) & (pl.col("rsi14_prev") < 30)
    crossed_70_down = (pl.col("rsi14") <= 70) & (pl.col("rsi14_prev") > 70)
    return crossed_30_up | crossed_70_down


# The metric each preset ranks its matches by (larger = higher rank).
_PRESET_DEFS: dict[str, tuple[pl.Expr, pl.Expr]] = {
    UNUSUAL_VOLUME: (_unusual_volume(), pl.col("rvol20")),
    NEAR_52W_HIGH: (_near_52w_high(), pl.col("dist_52w_high")),
    GAP_3PLUS: (_gap_3plus(), pl.col("gap_pct").abs()),
    GOLDEN_CROSS_FRESH: (_golden_cross_fresh(), pl.col("sma50") - pl.col("sma200")),
    RSI_EXTREME: (_rsi_extreme(), (pl.col("rsi14") - 50).abs()),
}


def run_scan(snapshot: pl.DataFrame, preset_key: str) -> pl.DataFrame:
    """
    Run one preset over the run-date snapshot; return its matches ranked, with the lottery flag.

    Columns: preset_key, symbol, rank (1 = strongest), lottery_flag, and the snapshot metrics.
    """
    condition, salience = _PRESET_DEFS[preset_key]
    matched = snapshot.filter(condition & salience.is_not_null())
    return matched.with_columns(
        pl.lit(preset_key).alias("preset_key"),
        salience.rank(method="ordinal", descending=True).cast(pl.Int32).alias("rank"),
    ).sort("rank")


def run_all(snapshot: pl.DataFrame) -> pl.DataFrame:
    """Run every preset and stack the matches into one frame (empty frame if nothing matched)."""
    frames = [run_scan(snapshot, key) for key in PRESET_KEYS]
    non_empty = [f for f in frames if f.height > 0]
    if not non_empty:
        return run_scan(snapshot, PRESET_KEYS[0]).clear()  # an empty frame with the right schema
    return pl.concat(non_empty, how="diagonal_relaxed")
