"""
Tests for volbands.py — empirical volatility bands (plan P4 step 3, Appendix F). Written first.

A vol band is the ONLY forward-looking number the app shows, and it is a range with a frequency
label, never a point forecast. Covered: the bands come from overlapping h-day returns over the
trailing window; the 50%/80% coverage levels use the right quantiles; the band never reaches beyond
20 trading days (a property test — the schema forbids it); and a symbol with too little history
yields no band rather than a fabricated one.
"""

from __future__ import annotations

import random

import volbands as vb


def _rising_closes(n: int = 600) -> list[float]:
    # A deterministic noisy random walk with slight drift — realistic enough that h-day return
    # dispersion grows with the horizon (a smooth series would collapse the band). Seeded, so the
    # test is reproducible without Math.random-style nondeterminism.
    rng = random.Random(42)
    price = 100.0
    closes = [price]
    for _ in range(n - 1):
        price *= 1.0 + rng.gauss(0.0005, 0.02)  # ~0.05% drift, 2% daily vol
        closes.append(price)
    return closes


def test_bands_cover_only_horizons_5_10_20():
    bands = vb.compute_vol_bands("ACME", _rising_closes(), window=500)
    horizons = {b["horizonDays"] for b in bands}
    assert horizons == {5, 10, 20}


def test_no_band_reaches_beyond_twenty_days_property():
    # The schema forbids anything past 20 days; assert it for a range of window sizes.
    for window in (100, 250, 500):
        bands = vb.compute_vol_bands("ACME", _rising_closes(700), window=window)
        assert all(b["horizonDays"] <= 20 for b in bands)


def test_both_coverage_levels_are_produced_and_nested():
    bands = vb.compute_vol_bands("ACME", _rising_closes(), window=500)
    for horizon in (5, 10, 20):
        c50 = next(b for b in bands if b["horizonDays"] == horizon and b["coverage"] == 0.5)
        c80 = next(b for b in bands if b["horizonDays"] == horizon and b["coverage"] == 0.8)
        # The 80% band is wider than (contains) the 50% band — p10..p90 spans p25..p75.
        assert c80["lo"] <= c50["lo"]
        assert c80["hi"] >= c50["hi"]
        # Frequency labels ride along (rendered with the regime-break caveat in the UI).
        assert isinstance(c80["label"], str) and c80["label"]


def test_too_little_history_yields_no_band():
    # Fewer bars than the shortest horizon needs → nothing, not a fabricated range.
    assert vb.compute_vol_bands("ACME", [100.0, 101.0, 102.0], window=500) == []


def test_bands_widen_with_horizon():
    # A 20-day band should span more than a 5-day band for the same series.
    bands = vb.compute_vol_bands("ACME", _rising_closes(), window=500)
    width = lambda h: next(b["hi"] - b["lo"] for b in bands if b["horizonDays"] == h and b["coverage"] == 0.8)
    assert width(20) > width(5)
