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
        # pct_above_50dma is a 0–1 FRACTION at its source (nightly.py, baserates.py). Feeding 0.6075
        # here models the real unit; the earlier fixture fed 60.75 and so certified the ×100 bug (D2).
        market_context={"vix": 14.2, "ten_year": 4.35, "advancers": 5091, "decliners": 3987,
                        "pct_above_50dma": 0.6075},
        movers=[], calendar=[], run_date=date(2026, 7, 11),
    )
    values = {s.stat_id: s.value for s in stats}
    assert values["macro-vix"] == "14.20"
    # The value states its window so the narrator's "10-year" traces to a source (D2).
    assert values["macro-10y"] == "4.35% 10-year yield"
    assert values["breadth-advancers"] == "5091"
    assert values["breadth-decliners"] == "3987"
    # ×100 into the Desk's number, AND the window words the narrator will use (D2).
    assert values["breadth-pct50"] == "60.75% of the universe above its 50-day average"


def test_movers_are_unsigned_magnitudes_with_direction_in_the_label():
    stats = build_stats(
        market_context=None,
        movers=[{"symbol": "SPY", "ret_1": 0.012, "rvol20": 2.4},
                {"symbol": "ACME", "ret_1": -0.023, "rvol20": 3.1}],
        calendar=[], run_date=date(2026, 7, 11),
    )
    by_id = {s.stat_id: s for s in stats}
    # Unsigned magnitude, with the window ("1-day") stated in the value and the direction word riding
    # safely inside it (the gate checks numbers, not signs or direction words) — D2.
    assert by_id["mover-SPY"].value == "1.20% 1-day gain"
    assert "gain" in by_id["mover-SPY"].label
    assert by_id["mover-ACME"].value == "2.30% 1-day decline"      # unsigned magnitude, not "-2.30%"
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
                        "pct_above_50dma": 0.55},
        movers=[], calendar=[], run_date=date(2026, 7, 11),
    )
    ids = {s.stat_id for s in stats}
    assert "macro-vix" not in ids
    assert "macro-10y" not in ids
    assert "breadth-advancers" in ids


# ----- PD7: the depth registry (Part 9.2) -----
#
# The rendered VALUE of a stat is not decoration — it is the gate's source of truth. `verify.py`
# parses each value into the allowed set, so whatever numbers a value contains are the numbers the
# narrator is licensed to write. That makes the exact wording of a value load-bearing in a way the
# scalar stats (a VIX of "18.20") never made obvious, and these tests pin it.
#
# The clearest case is the WINDOW. A narrator writing about a 52-week range will write the words
# "52-week", and "52" is a number — so unless "52" traces to a source, an honest sentence gets
# flagged for the window it was asked to describe. The value states the window in the same words the
# narrator will use, which licenses it through the ordinary mechanism rather than a magic exception.

from briefing.depth import (  # noqa: E402
    CalendarRef,
    Position52w,
    Streak,
    TickerDepth,
)
from briefing.stats import (  # noqa: E402
    build_calendar_stats,
    build_cluster_stats,
    build_depth_stats,
)


def _by_id(stats) -> dict[str, str]:
    return {stat.stat_id: stat.value for stat in stats}


def test_the_52_week_position_is_three_numbers_under_one_id():
    depth = TickerDepth(symbol="AAPL", pos52w=Position52w(pct=63.2, low=142.30, high=205.80))

    value = _by_id(build_depth_stats([depth]))["tkr:AAPL:pos52w"]

    assert "63.2%" in value
    assert "142.30" in value and "205.80" in value


def test_the_position_value_licenses_the_words_the_narrator_will_write():
    """THE WINDOW IS A NUMBER TOO. "52-week" scans as the number 52, so if the value does not carry
    it, the gate flags an honest sentence for the very window it asked for."""
    from briefing.verify import build_source_set, check_text

    depth = TickerDepth(symbol="AAPL", pos52w=Position52w(pct=63.2, low=142.30, high=205.80))
    sources = build_source_set(
        extracts=[], stats=build_depth_stats([depth]), instruments=[], run_date=date(2026, 7, 9)
    )

    result = check_text(
        sources,
        "AAPL sits 63.2% of the way up its 52-week range, between 142.30 and 205.80.",
        location="context",
    )

    assert result.flags == (), f"the gate flagged an honest sentence: {result.flags}"
    assert "52" not in [flag.entity for flag in result.flags]


def test_the_fifty_day_distance_is_unsigned_with_the_direction_in_words():
    """The movers' precedent, and for the movers' reason: the gate matches NUMBERS, not signs. A
    source of -4.2 would refuse an honest sentence that says a stock trades "4.2% below" its average."""
    below = TickerDepth(symbol="AAPL", from50d=-4.2)
    above = TickerDepth(symbol="MSFT", from50d=4.2)

    values = _by_id(build_depth_stats([below, above]))

    assert values["tkr:AAPL:from50d"] == "4.2% below its 50-day average"
    assert values["tkr:MSFT:from50d"] == "4.2% above its 50-day average"


def test_the_atr_relative_move_renders_as_a_multiple():
    depth = TickerDepth(symbol="SMCI", move_atr=2.83)

    assert _by_id(build_depth_stats([depth]))["tkr:SMCI:move_atr"].startswith("2.8x")


def test_a_streak_puts_its_count_in_the_value_and_its_direction_in_the_label():
    depth = TickerDepth(symbol="AAPL", streak=Streak(length=3, direction="up"))

    stat = next(s for s in build_depth_stats([depth]) if s.stat_id == "tkr:AAPL:streak")

    assert stat.value.startswith("3")
    assert "up" in stat.value or "up" in stat.label


def test_a_symbol_with_nothing_measurable_renders_no_stats_at_all():
    """Absence over invention, at the registry's own door. An empty depth object must not become an
    empty stat — a stat with no number is vocabulary that says nothing and can only mislead."""
    assert build_depth_stats([TickerDepth(symbol="NEWLY")]) == []


def test_cluster_stats_make_the_corroboration_count_citable():
    stats = _by_id(build_cluster_stats("nc-fed-hold", sources=4, history7d=2))

    assert stats["cls:nc-fed-hold:corroboration"].startswith("4")
    assert stats["cls:nc-fed-hold:history7d"].startswith("2")


def test_the_recurrence_stat_licenses_its_own_window():
    """Same trap as the 52-week one: "in the last 7 sessions" contains the number 7."""
    from briefing.verify import build_source_set, check_text

    sources = build_source_set(
        extracts=[],
        stats=build_cluster_stats("nc-x", sources=4, history7d=2),
        instruments=[],
        run_date=date(2026, 7, 9),
    )
    result = check_text(
        sources, "This is the 2nd story on this name in the last 7 sessions.", location="context"
    )

    assert result.flags == ()


def test_a_cluster_with_no_history_emits_no_recurrence_stat():
    stats = _by_id(build_cluster_stats("nc-x", sources=4, history7d=None))

    assert "cls:nc-x:history7d" not in stats
    assert "cls:nc-x:corroboration" in stats


def test_a_calendar_stat_is_a_date_and_carries_its_event_in_the_label():
    ref = CalendarRef(
        stat_id="cal:CPI:next", key="CPI", code="CPI", kind="macro",
        title="CPI print", date=date(2026, 7, 15),
    )
    stat = build_calendar_stats([ref])[0]

    assert stat.stat_id == "cal:CPI:next"
    assert stat.value == "2026-07-15"
    assert "CPI print" in stat.label
