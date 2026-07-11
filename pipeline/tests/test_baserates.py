"""
Tests for baserates.py — Wilson intervals, point-in-time buckets, and the base-rate aggregation
(plan P4 step 2, Appendix F). Written first (plan §6.2).

Covered: the Wilson score interval on the plan's textbook cases (62/110 → [47%, 65%]; 60/100 →
[50.2%, 69.1%]); the point-in-time bucket guard (an event whose symbol later grows into large/mid
classifies by its event-date bucket, never today's); the aggregation (n, wins, win rate, Wilson CI,
forward percentiles per pattern × bucket × horizon × regime); and the unconditional baseline.
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

import baserates as br


def test_wilson_ci_textbook_cases():
    lo, hi = br.wilson_ci(62, 110)
    assert round(lo * 100) == 47
    assert round(hi * 100) == 65
    lo, hi = br.wilson_ci(60, 100)
    assert round(lo * 1000) == 502  # 50.2%
    assert round(hi * 1000) == 691  # 69.1%


def test_wilson_ci_handles_zero_sample():
    lo, hi = br.wilson_ci(0, 0)
    assert lo == 0.0 and hi == 0.0


def test_buckets_are_point_in_time_not_todays_bucket():
    # SMALL symbol trades tiny volume early, then grows huge later. BIG always trades huge. An early
    # event on SMALL must classify SMALL, even though SMALL is large/mid by the end of the window.
    start = date(2026, 1, 1)
    rows = []
    for i in range(6):
        rows.append({"symbol": "BIG", "date": start + timedelta(days=i), "close": 100.0, "volume": 1_000_000})
        small_volume = 100 if i < 3 else 5_000_000  # SMALL becomes huge from day 3
        rows.append({"symbol": "SMALL", "date": start + timedelta(days=i), "close": 50.0, "volume": small_volume})
    frame = pl.DataFrame(rows)

    bucketed = br.assign_buckets(frame, dv_window=2, large_mid_top=1)
    early = bucketed.filter((pl.col("symbol") == "SMALL") & (pl.col("date") == start + timedelta(days=2)))
    late = bucketed.filter((pl.col("symbol") == "SMALL") & (pl.col("date") == start + timedelta(days=5)))
    assert early["bucket"][0] == "small"       # classified by its event-date window
    assert late["bucket"][0] == "large_mid"    # after it grew


def test_sub_five_dollar_names_are_excluded_from_buckets():
    frame = pl.DataFrame({
        "symbol": ["PENNY", "PENNY", "PENNY"],
        "date": [date(2026, 1, i) for i in range(1, 4)],
        "close": [3.0, 3.0, 3.0],
        "volume": [10, 10, 10],
    })
    bucketed = br.assign_buckets(frame, dv_window=2, large_mid_top=1000)
    # Every resolvable row is excluded (bucket null) — sub-$5 is lottery territory, not a card.
    assert bucketed.filter(pl.col("bucket").is_not_null()).height == 0


def test_base_rate_aggregation_counts_wins_and_reports_the_baseline():
    # Two resolved events for one pattern in one bucket+regime: one win (+), one loss (−).
    events = pl.DataFrame({
        "symbol": ["A", "B"],
        "date": [date(2026, 6, 1), date(2026, 6, 2)],
        "pattern_key": ["golden-cross", "golden-cross"],
        "direction": ["up", "up"],
    })
    forwards = pl.DataFrame({
        "symbol": ["A", "B", "C"],
        "date": [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)],
        "fwd_10": [0.05, -0.02, 0.01],
        "up_10": [True, False, True],
    })
    buckets = pl.DataFrame({
        "symbol": ["A", "B", "C"],
        "date": [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)],
        "bucket": ["large_mid", "large_mid", "large_mid"],
    })
    regimes = pl.DataFrame({
        "date": [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)],
        "regime": ["risk_on", "risk_on", "risk_on"],
    })

    stats = br.compute_base_rates(events, forwards, buckets, regimes, horizons=(10,))
    row = next(s for s in stats if s["patternKey"] == "golden-cross" and s["horizonDays"] == 10)
    assert row["n"] == 2
    assert row["wins"] == 1
    assert row["winRate"] == 0.5
    assert row["universe"] == "large_mid"
    assert row["regime"] == "risk_on"
    # The baseline is the unconditional up-rate across ALL resolvable bars in that bucket+horizon:
    # A, B, C ⇒ up in 2 of 3.
    assert abs(row["baselineUpRate"] - 2 / 3) < 1e-9
    # The forward percentiles come from the two event returns.
    assert row["fwdMedian"] is not None
    # Provenance from the pattern_meta seed rides along.
    assert row["evidenceGrade"] in {"supported", "mixed", "weak", "folklore"}


def test_pattern_meta_covers_all_six_patterns():
    for key in ("golden-cross", "52w-high-proximity", "gap-with-catalyst", "rsi-extreme",
                "unusual-volume", "breadth-regime"):
        meta = br.PATTERN_META[key]
        assert meta["evidence_grade"] in {"supported", "mixed", "weak", "folklore"}
        assert isinstance(meta["decay_note"], str) and meta["decay_note"]
