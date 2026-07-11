"""
baserates.py — turn signal events into honest base rates (plan P4 step 2, Appendix F).

For every pattern, the app answers one question: "the last N times this appeared, how often was the
price higher 5/10/20 days later — and how does that compare to just being long?" This module
computes that, with the guards that keep it from flattering itself:

  - **Wilson score interval**, not a bare percentage. A 6-of-10 win rate is not "60%" — it is 60%
    with a wide interval that the display must show, so a small sample cannot masquerade as an edge.

  - **Point-in-time buckets.** A symbol's size bucket (US large/mid vs US small) is computed from
    the 63-day median dollar volume ending ON the event date and ranked across the universe that
    day. Classifying a 2019 event by the symbol's 2026 bucket is a lookahead bug; `assign_buckets`
    reads only trailing data, and its guard test proves it.

  - **The always-up baseline.** Alongside every conditional rate we compute the unconditional
    up-rate for that bucket and horizon — the base rate of simply being long. The display shows both
    so 56% cannot pose as skill when the market was up 54% of the time anyway.

  - **Sub-$5 names are excluded** (lottery territory, not a card). They get a null bucket and drop
    out of every base rate.

Regime (assumption, logged in QUESTIONS-FOR-BISHANT.md): the market regime conditioning the rates is
a breadth dichotomy — risk_on when the share of the universe above its 50-day average is ≥ 50% on
the event date, risk_off otherwise. This matches the breadth-regime detector's 50% line. A finer
regime split (e.g. a neutral band, or a VIX overlay) is a structural refinement if the user wants it.

`pattern_meta` (decay stamps + evidence grades) is seeded from the Research Report Part 4 ledger
(Appendix F). The decay-note wording here is a plain-English capture of each ledger verdict; the
exact RR Part 4 phrasing should be transcribed when the report text is to hand (noted in QUESTIONS).
"""

from __future__ import annotations

import math

import polars as pl

# Appendix F bucket constants.
_LARGE_MID_TOP = 1000     # top 1,000 by 63-day median dollar volume = US large/mid
_DV_WINDOW = 63           # the point-in-time dollar-volume window
_MIN_SMALL_PRICE = 5.0    # sub-$5 names are excluded from cards (lottery territory)

# The market-regime breadth line (assumption — see the module docstring / QUESTIONS).
_REGIME_LEVEL = 0.5  # breadth is a fraction (0-1), matching market_context and the app

# The forward-return percentiles every base rate reports (Appendix B fwdP10/median/P90).
_PERCENTILES = (0.10, 0.50, 0.90)

# The Wilson interval's z for a 95% two-sided interval.
_Z = 1.96

# pattern_meta seed (Appendix F, from the RR Part 4 ledger). publication_year is the key paper's
# year; decay_note captures the ledger verdict in plain English (reconcile with RR Part 4 wording).
PATTERN_META: dict[str, dict] = {
    "golden-cross": {
        "publication_year": 1992, "evidence_grade": "weak",
        "decay_note": "Moving-average crossovers looked strong in Brock–Lakonishok–LeBaron (1992) "
                      "but Sullivan–Timmermann–White (1999) showed the edge shrank once data-snooping "
                      "was accounted for — treat as weak.",
    },
    "52w-high-proximity": {
        "publication_year": 2004, "evidence_grade": "mixed",
        "decay_note": "George–Hwang (2004) found the 52-week high anchors momentum, but the effect is "
                      "regime-dependent and has weakened since publication — mixed.",
    },
    "gap-with-catalyst": {
        "publication_year": None, "evidence_grade": "folklore",
        "decay_note": "The trading-desk lore is 'a gap on news continues, it does not fill'; the "
                      "evidence for reliable continuation is thin — folklore-adjacent.",
    },
    "rsi-extreme": {
        "publication_year": None, "evidence_grade": "weak",
        "decay_note": "Oscillator reversals are popular but poorly supported out of sample; a single "
                      "RSI crossing is weak evidence on its own.",
    },
    "unusual-volume": {
        "publication_year": 2001, "evidence_grade": "mixed",
        "decay_note": "Gervais–Kaniel–Mingelgrin (2001) documented a high-volume return premium, but "
                      "it is small and has decayed — mixed.",
    },
    "breadth-regime": {
        "publication_year": None, "evidence_grade": "weak",
        "decay_note": "Breadth crossing 50% is market CONTEXT, not a tradable edge — it colours the "
                      "backdrop for other signals rather than standing alone.",
    },
}


def wilson_ci(wins: int, n: int, z: float = _Z) -> tuple[float, float]:
    """The Wilson score interval for a binomial proportion — the honest interval for a win rate.

    Returns (low, high) as fractions. A zero sample returns (0, 0): with nothing observed there is
    no interval to state, and the N-gate suppresses the display anyway.
    """
    if n == 0:
        return (0.0, 0.0)
    p = wins / n
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    margin = (z / denom) * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
    return (max(0.0, center - margin), min(1.0, center + margin))


def assign_buckets(
    frame: pl.DataFrame,
    *,
    dv_window: int = _DV_WINDOW,
    large_mid_top: int = _LARGE_MID_TOP,
    min_small_price: float = _MIN_SMALL_PRICE,
) -> pl.DataFrame:
    """Add a point-in-time `bucket` column: "large_mid", "small", or null (excluded).

    The 63-day median dollar volume ending on each date ranks symbols cross-sectionally that day;
    the top N are large/mid, the rest (priced ≥ $5) are small, and sub-$5 names get a null bucket.
    Only trailing data is used, so an event never borrows a symbol's future size.
    """
    dollar_volume = pl.col("close") * pl.col("volume")
    with_dv = frame.sort(["symbol", "date"]).with_columns(
        dollar_volume.rolling_median(window_size=dv_window, min_samples=dv_window)
        .over("symbol")
        .alias("_median_dv")
    )
    # Rank within each date by trailing median dollar volume (1 = largest).
    ranked = with_dv.with_columns(
        pl.col("_median_dv").rank(method="ordinal", descending=True).over("date").alias("_dv_rank")
    )
    # Sub-$5 is excluded FIRST — a penny stock is never a card even if its dollar volume ranks it
    # into the top 1,000 (Appendix F: "sub-$5 excluded from cards, lottery flag territory").
    bucket = (
        pl.when(pl.col("_median_dv").is_null())
        .then(pl.lit(None, dtype=pl.String))
        .when(pl.col("close") < min_small_price)
        .then(pl.lit(None, dtype=pl.String))
        .when(pl.col("_dv_rank") <= large_mid_top)
        .then(pl.lit("large_mid"))
        .otherwise(pl.lit("small"))
    )
    return ranked.with_columns(bucket.alias("bucket")).drop(["_median_dv", "_dv_rank"])


def assign_regimes(breadth: pl.DataFrame) -> pl.DataFrame:
    """Map each date to its market regime from the day's breadth: risk_on when ≥ 50% of the universe
    is above its 50-day average, risk_off otherwise. Point-in-time — the regime on that date only."""
    return breadth.select(
        pl.col("date"),
        pl.when(pl.col("pct_above_50dma") >= _REGIME_LEVEL)
        .then(pl.lit("risk_on"))
        .otherwise(pl.lit("risk_off"))
        .alias("regime"),
    )


def compute_base_rates(
    events: pl.DataFrame,
    forwards: pl.DataFrame,
    buckets: pl.DataFrame,
    regimes: pl.DataFrame,
    *,
    horizons: tuple[int, ...] = (5, 10, 20),
) -> list[dict]:
    """Aggregate resolved events into base_rate_stat rows (one per pattern × bucket × horizon × regime).

    `events` are the signal_events; `forwards` carries fwd_h / up_h per (symbol, date); `buckets`
    and `regimes` are the point-in-time classifications. Only events with a resolved forward return
    and a non-null bucket count. Each row carries n, wins, win rate, the Wilson interval, the forward
    percentiles, the unconditional baseline for its bucket+horizon, and the pattern's provenance.
    """
    bucket_map = buckets.select(["symbol", "date", "bucket"])
    regime_map = regimes.select(["date", "regime"])
    labelled_forwards = forwards.join(bucket_map, on=["symbol", "date"], how="left").join(
        regime_map, on="date", how="left"
    )
    labelled_events = events.join(labelled_forwards, on=["symbol", "date"], how="left")

    rows: list[dict] = []
    for horizon in horizons:
        rows.extend(_rates_for_horizon(labelled_events, labelled_forwards, horizon))
    return rows


def _rates_for_horizon(labelled_events: pl.DataFrame, labelled_forwards: pl.DataFrame, horizon: int) -> list[dict]:
    fwd_col, up_col = f"fwd_{horizon}", f"up_{horizon}"
    if fwd_col not in labelled_events.columns:
        return []

    baselines = _baselines(labelled_forwards, fwd_col, up_col)

    resolved = labelled_events.filter(
        pl.col(fwd_col).is_not_null() & pl.col("bucket").is_not_null() & pl.col("regime").is_not_null()
    )
    if resolved.height == 0:
        return []

    grouped = resolved.group_by(["pattern_key", "bucket", "regime"]).agg(
        pl.len().alias("n"),
        pl.col(up_col).sum().alias("wins"),
        pl.col(fwd_col).quantile(_PERCENTILES[0]).alias("p10"),
        pl.col(fwd_col).quantile(_PERCENTILES[1]).alias("p50"),
        pl.col(fwd_col).quantile(_PERCENTILES[2]).alias("p90"),
    )

    out: list[dict] = []
    for record in grouped.iter_rows(named=True):
        n, wins = int(record["n"]), int(record["wins"])
        lo, hi = wilson_ci(wins, n)
        meta = PATTERN_META.get(record["pattern_key"], {})
        out.append({
            "patternKey": record["pattern_key"],
            "universe": record["bucket"],
            "horizonDays": horizon,
            "regime": record["regime"],
            "n": n,
            "wins": wins,
            "winRate": wins / n,
            "ciLow": lo,
            "ciHigh": hi,
            "fwdP10": record["p10"],
            "fwdMedian": record["p50"],
            "fwdP90": record["p90"],
            "baselineUpRate": baselines.get(record["bucket"]),
            "publicationYear": meta.get("publication_year"),
            "evidenceGrade": meta.get("evidence_grade"),
            "decayNote": meta.get("decay_note"),
        })
    return out


def _baselines(labelled_forwards: pl.DataFrame, fwd_col: str, up_col: str) -> dict[str, float]:
    """The unconditional up-rate per bucket for one horizon — the always-up baseline. Computed over
    ALL resolvable bars in the bucket, not just the pattern's events."""
    resolvable = labelled_forwards.filter(
        pl.col(fwd_col).is_not_null() & pl.col("bucket").is_not_null()
    )
    if resolvable.height == 0:
        return {}
    per_bucket = resolvable.group_by("bucket").agg(pl.col(up_col).mean().alias("baseline"))
    return {row["bucket"]: row["baseline"] for row in per_bucket.iter_rows(named=True)}
