"""
Tests for briefing/stats.py — the computed-stats table handed to synthesis and re-checked by the gate.

Every number the briefing may quote must appear here in rendered form, because the synthesis prompt
tells the model to copy stat values verbatim and the verification gate builds its allowed set from
the very same values. These cover the macro strip, movers rendered as unsigned magnitudes (so a
"fell 2.3%" sentence is not flagged for a sign the model never wrote), and calendar consensus/dates.
"""

from __future__ import annotations

from datetime import date

from briefing.stats import build_stats


def test_macro_strip_is_rendered():
    stats = build_stats(
        market_context={"vix": 14.2, "ten_year": 4.35, "advancers": 5091, "decliners": 3987,
                        "pct_above_50dma": 60.75},
        movers=[], calendar=[], run_date=date(2026, 7, 11),
    )
    values = {s.stat_id: s.value for s in stats}
    assert values["macro-vix"] == "14.20"
    assert values["macro-10y"] == "4.35%"
    assert values["breadth-advancers"] == "5091"
    assert values["breadth-decliners"] == "3987"
    assert values["breadth-pct50"] == "60.75%"


def test_movers_are_unsigned_magnitudes_with_direction_in_the_label():
    stats = build_stats(
        market_context=None,
        movers=[{"symbol": "SPY", "ret_1": 0.012, "rvol20": 2.4},
                {"symbol": "ACME", "ret_1": -0.023, "rvol20": 3.1}],
        calendar=[], run_date=date(2026, 7, 11),
    )
    by_id = {s.stat_id: s for s in stats}
    assert by_id["mover-SPY"].value == "1.20%"
    assert "gain" in by_id["mover-SPY"].label
    assert by_id["mover-ACME"].value == "2.30%"      # unsigned magnitude, not "-2.30%"
    assert "decline" in by_id["mover-ACME"].label
    assert by_id["rvol-ACME"].value == "3.1"


def test_calendar_consensus_and_date_are_rendered():
    stats = build_stats(
        market_context=None, movers=[],
        calendar=[{"title": "CPI", "consensus": 3.2, "date": date(2026, 7, 16)}],
        run_date=date(2026, 7, 11),
    )
    by_id = {s.stat_id: s for s in stats}
    assert by_id["cal-0-consensus"].value == "3.2"
    assert by_id["cal-0-date"].value == "2026-07-16"


def test_none_macro_and_empty_inputs_produce_no_rows():
    assert build_stats(market_context=None, movers=[], calendar=[], run_date=date(2026, 7, 11)) == []


def test_missing_vix_and_ten_year_are_skipped():
    # FRED can be down — VIX and the 10-year are nullable and simply absent from the table then.
    stats = build_stats(
        market_context={"vix": None, "ten_year": None, "advancers": 10, "decliners": 5,
                        "pct_above_50dma": 55.0},
        movers=[], calendar=[], run_date=date(2026, 7, 11),
    )
    ids = {s.stat_id for s in stats}
    assert "macro-vix" not in ids
    assert "macro-10y" not in ids
    assert "breadth-advancers" in ids
