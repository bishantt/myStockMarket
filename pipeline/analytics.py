"""
analytics.py — the nightly honesty engine: base rates, setup cards, vol bands (plan P4).

This composes the P4 pieces into the rows Job A publishes:

  - `build_base_rate_rows` runs the detectors over a symbol's full indicator history, measures the
    +1-shifted forward returns, classifies each event's point-in-time bucket and regime, and
    aggregates base_rate_stat rows (via baserates.compute_base_rates).

  - `tier_for` turns a base rate into a tendency tier with the Appendix F bands AND the cap that
    matters most: an interval that spans the always-up baseline is WEAK, whatever the point estimate
    — the RR Fig 9.3 rule. A card can never claim an edge its own interval cannot rule out.

  - `build_setup_cards` takes today's fired events on served symbols, matches each to its base rate
    (same pattern, bucket, regime, horizon), computes the tier, and stamps the stated rate onto the
    card — so what the user is shown and what the signal log records are the same number.

  - `build_vol_bands` wraps volbands.compute_vol_bands for the watchlist.

The N-gate (suppressing a rate when N < 30) is a DISPLAY rule, applied in the app; here the raw n,
wins, and interval are always kept, so nothing is thrown away — the display decides what to show.
"""

from __future__ import annotations

from datetime import date
from typing import Mapping

import polars as pl

import detectors as det
import volbands
from baserates import assign_buckets, assign_regimes, compute_base_rates

# Appendix F tendency-tier bands (win-rate thresholds). Below 58% is weak, 58–70% moderate, above
# 70% strong — and any interval that spans the baseline is capped to weak regardless.
_WEAK_MAX = 0.58
_MODERATE_MAX = 0.70


def tier_for(win_rate: float, ci_low: float, ci_high: float, *, baseline: float | None) -> str:
    """The tendency tier for a base rate, with the CI-spans-baseline cap (Appendix F).

    If the interval straddles the always-up baseline, the rate cannot be distinguished from simply
    being long, so the tier is capped at weak no matter how high the point estimate. Otherwise the
    Appendix F bands apply: < 58% weak, 58–70% moderate, > 70% strong.
    """
    if baseline is not None and ci_low <= baseline <= ci_high:
        return "weak"
    if win_rate < _WEAK_MAX:
        return "weak"
    if win_rate <= _MODERATE_MAX:
        return "moderate"
    return "strong"


def build_base_rate_rows(
    indicators: pl.DataFrame,
    breadth: pl.DataFrame,
    *,
    horizons: tuple[int, ...] = (5, 10, 20),
    bucket_kwargs: Mapping | None = None,
) -> list[dict]:
    """Run the detectors over an indicator history and aggregate base_rate_stat rows.

    `indicators` is the full history (many symbols, all dates) with the v1 indicator columns plus
    close/high/volume; `breadth` is the per-date universe breadth. Returns base_rate_stat dicts ready
    to publish. `bucket_kwargs` lets a test shrink the dollar-volume window.
    """
    events = det.detect(indicators)
    forwards = det.forward_returns(indicators, horizons=horizons)
    buckets = assign_buckets(indicators, **(dict(bucket_kwargs) if bucket_kwargs else {}))
    regimes = assign_regimes(breadth)
    return compute_base_rates(events, forwards, buckets, regimes, horizons=horizons)


def build_setup_cards(
    events_today: pl.DataFrame,
    base_rates: list[dict],
    *,
    run_date: date,
    served: set[str],
    bucket_of: Mapping[str, str],
    regime: str,
    horizon: int = 10,
) -> list[dict]:
    """Turn today's fired events on served symbols into setup_card rows.

    Each card matches its base rate by (pattern, bucket, regime, horizon), computes the tier with the
    baseline cap, and carries the stated win rate + N so the card and the signal log agree. A symbol
    that is not served, or has no matching base rate, produces no card (the Desk shows only cards it
    can back with a rate). The weakener checkboxes start unchecked; the app writes them.
    """
    index = _index_base_rates(base_rates)
    cards: list[dict] = []
    for event in events_today.filter(pl.col("date") == run_date).iter_rows(named=True):
        symbol = event["symbol"]
        if symbol not in served:
            continue
        bucket = bucket_of.get(symbol)
        if bucket is None:
            continue
        rate = index.get((event["pattern_key"], bucket, regime, horizon))
        if rate is None:
            continue
        tier = tier_for(rate["winRate"], rate["ciLow"], rate["ciHigh"], baseline=rate.get("baselineUpRate"))
        cards.append({
            "runDate": run_date,
            "symbol": symbol,
            "patternKey": event["pattern_key"],
            "tier": tier,
            "statedWinRate": rate["winRate"],
            "statedN": rate["n"],
            "baseRateKey": (event["pattern_key"], bucket, horizon, regime),
            "state": {
                "direction": event["direction"],
                "winRate": rate["winRate"],
                "n": rate["n"],
                "ciLow": rate["ciLow"],
                "ciHigh": rate["ciHigh"],
                "baseline": rate.get("baselineUpRate"),
                "fwdMedian": rate.get("fwdMedian"),
                "evidenceGrade": rate.get("evidenceGrade"),
                "decayNote": rate.get("decayNote"),
                "publicationYear": rate.get("publicationYear"),
                "horizonDays": horizon,
                "regime": regime,
                "universe": bucket,
            },
            "weakeners": {},
        })
    return cards


def build_vol_bands(closes_by_symbol: Mapping[str, list[float]], *, run_date: date) -> list[dict]:
    """Vol bands for a set of symbols (typically the watchlist), each stamped with the run date."""
    rows: list[dict] = []
    for symbol, closes in closes_by_symbol.items():
        for band in volbands.compute_vol_bands(symbol, closes):
            rows.append({**band, "runDate": run_date})
    return rows


def _index_base_rates(base_rates: list[dict]) -> dict[tuple, dict]:
    """Index base rates by (pattern, universe, regime, horizon) for fast card matching."""
    return {
        (row["patternKey"], row["universe"], row["regime"], row["horizonDays"]): row
        for row in base_rates
    }
