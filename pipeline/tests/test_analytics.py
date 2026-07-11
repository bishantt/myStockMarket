"""
Tests for analytics.py — the nightly base-rate / setup-card / vol-band composition (plan P4).

Covered: the tier bands and the CI-spans-baseline cap (the RR Fig 9.3 case — CI 47–65 vs baseline
55 ⇒ WEAK — as a literal fixture); the end-to-end base-rate build from an indicator history; and
setup-card generation, which attaches the base rate, computes the tier, and stamps the stated rate
onto the card (with the N-gate suppression left to the display, the raw counts always kept).
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

import analytics


def test_tier_bands():
    # No CI span; win rate drives the tier (Appendix F bands).
    assert analytics.tier_for(0.45, 0.40, 0.50, baseline=0.30) == "weak"    # < 50%
    assert analytics.tier_for(0.55, 0.52, 0.58, baseline=0.30) == "weak"    # 50–58%
    assert analytics.tier_for(0.64, 0.60, 0.68, baseline=0.30) == "moderate"  # 58–70%
    assert analytics.tier_for(0.75, 0.72, 0.78, baseline=0.30) == "strong"  # > 70%


def test_ci_spanning_the_baseline_caps_the_tier_at_weak():
    # RR Fig 9.3: a 55% point estimate with a CI of 47–65 that straddles the 55% baseline ⇒ WEAK,
    # regardless of the point estimate — the interval cannot rule out "no edge over being long".
    assert analytics.tier_for(0.55, 0.47, 0.65, baseline=0.55) == "weak"
    # A high point estimate is still capped if its interval spans the baseline.
    assert analytics.tier_for(0.72, 0.55, 0.85, baseline=0.60) == "weak"


def _history() -> tuple[pl.DataFrame, pl.DataFrame]:
    # A long single-symbol history with the columns detectors + buckets read, plus a breadth series.
    start = date(2026, 1, 1)
    rows = []
    close = 100.0
    for i in range(60):
        close *= 1.01 if i % 3 else 0.99
        rows.append({
            "symbol": "ACME", "date": start + timedelta(days=i), "close": close, "high": close,
            "volume": 1_000_000, "sma50": 1.0, "sma200": 2.0, "rsi14": 50.0,
            "rvol20": 3.0 if i % 5 == 0 else 1.0, "ret_1": 0.03 if i % 5 == 0 else 0.0,
            "gap_pct": 0.0, "dist_52w_high": -0.1, "has_catalyst": False,
        })
    indicators = pl.DataFrame(rows)
    breadth = pl.DataFrame({
        "date": [start + timedelta(days=i) for i in range(60)],
        "pct_above_50dma": [0.60] * 60,  # risk_on throughout (fraction)
    })
    return indicators, breadth


def test_build_base_rate_rows_produces_stat_rows_with_baselines():
    indicators, breadth = _history()
    rows = analytics.build_base_rate_rows(
        indicators, breadth, horizons=(5,), bucket_kwargs={"dv_window": 5, "large_mid_top": 1000},
    )
    assert rows, "expected at least one base-rate row from the unusual-volume events"
    row = rows[0]
    assert row["patternKey"] == "unusual-volume"
    assert row["n"] >= 1
    assert row["baselineUpRate"] is not None
    assert "ciLow" in row and "ciHigh" in row


def test_build_setup_cards_attaches_rate_computes_tier_and_stamps_the_signal():
    # One event today, one matching base rate → one card with a tier and a stated rate.
    run_date = date(2026, 3, 2)
    events = pl.DataFrame({
        "symbol": ["ACME"], "date": [run_date], "pattern_key": ["unusual-volume"],
        "direction": ["up"], "attrs": [{"rvol20": 3.0, "ret_1": 0.03}],
    })
    base_rates = [{
        "patternKey": "unusual-volume", "universe": "large_mid", "horizonDays": 10,
        "regime": "risk_on", "n": 120, "wins": 66, "winRate": 0.55, "ciLow": 0.47, "ciHigh": 0.63,
        "baselineUpRate": 0.55, "evidenceGrade": "mixed", "decayNote": "…",
        "fwdP10": -0.05, "fwdMedian": 0.01, "fwdP90": 0.08, "publicationYear": 2001,
    }]
    cards = analytics.build_setup_cards(
        events, base_rates, run_date=run_date, served={"ACME"},
        bucket_of={"ACME": "large_mid"}, regime="risk_on", horizon=10,
    )
    assert len(cards) == 1
    card = cards[0]
    assert card["symbol"] == "ACME"
    assert card["patternKey"] == "unusual-volume"
    # CI 47–63 spans the 55% baseline ⇒ WEAK cap, visible on the card.
    assert card["tier"] == "weak"
    assert card["statedWinRate"] == 0.55
    assert card["statedN"] == 120
    assert card["state"]["baseline"] == 0.55


def test_build_setup_cards_skips_a_symbol_that_is_not_served():
    events = pl.DataFrame({
        "symbol": ["OTHER"], "date": [date(2026, 3, 2)], "pattern_key": ["unusual-volume"],
        "direction": ["up"], "attrs": [{}],
    })
    cards = analytics.build_setup_cards(
        events, [], run_date=date(2026, 3, 2), served={"ACME"}, bucket_of={}, regime="risk_on", horizon=10,
    )
    assert cards == []
