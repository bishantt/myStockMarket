"""
Tests for the significance formula (significance v2 — plan 4.5, Appendix E; ruling C1, R5).

The formula IS the promise that the Front Page is edited by evidence. So these tests do not only
check arithmetic — they check that the page it produces is the page the plan promised: a corroborated
macro print above a micro-cap merger, a hard event above an opinion, a real story with no listing
still present, and nowhere for popularity to enter even if someone wanted it to.

v2 is a PRODUCT of four factors — catalyst_weight × corroboration × entity_weight × freshness — and
Appendix E's four-cluster table is the acceptance test (`test_appendix_e_orders_d_a_b_c`).
"""

import pytest

from newsdesk import rank
from newsdesk.rank import TickerMove


# ---------------------------------------------------------------------------------------------
# The four factors, one assertion per row (plan 4.5, Appendix E: "the weights that produce it are
# constants beside the test"). A weight that drifts should redden a test that names it, not hide.
# ---------------------------------------------------------------------------------------------


def test_every_significance_factor_is_bounded_at_one_so_the_product_is_too():
    """A product of four factors each in [0, 1] is itself in [0, 1]; nothing here 'sums to one' — a
    product needs no such rule — but each factor's own ceiling is 1.0, and that is what bounds it."""
    assert max(rank.CATALYST_WEIGHT.values()) == 1.0
    assert rank.corroboration_for(rank.CORROBORATION_CEILING) == 1.0
    assert rank.ENTITY_MARKET_WIDE == 1.0 and rank.ENTITY_LARGE_MID == 1.0
    assert rank.FRESHNESS_SAME_SESSION == 1.0


def test_catalyst_weight_ranks_hard_events_over_commentary_row_by_row():
    """Appendix E, verbatim: hard events (M&A/FDA/macro/Fed) lead, an opinion trails. This is the
    factor that keeps a single-name analyst blog off the lead."""
    assert rank.CATALYST_WEIGHT["ma"] == 1.0
    assert rank.CATALYST_WEIGHT["fda"] == 1.0
    assert rank.CATALYST_WEIGHT["macro"] == 1.0
    assert rank.CATALYST_WEIGHT["fed"] == 1.0
    assert rank.CATALYST_WEIGHT["earnings"] == 0.8
    assert rank.CATALYST_WEIGHT["guidance"] == 0.8
    assert rank.CATALYST_WEIGHT["filing"] == 0.6
    assert rank.CATALYST_WEIGHT["legal"] == 0.6
    assert rank.CATALYST_WEIGHT["analyst"] == 0.4
    assert rank.CATALYST_WEIGHT["product"] == 0.3
    assert rank.CATALYST_WEIGHT["other"] == 0.3


def test_entity_weight_is_the_dollar_volume_bucket():
    """A macro/Fed event is about the whole tape (max); a big liquid name is a full 1.0; a small,
    sub-$5, or unknown name is half — a micro-cap PR cannot borrow a mega-cap's weight."""
    assert rank.entity_weight_for((), {}, "macro") == rank.ENTITY_MARKET_WIDE == 1.0
    assert rank.entity_weight_for((), {}, "fed") == 1.0
    assert rank.entity_weight_for(("AAPL",), {"AAPL": "large_mid"}, "earnings") == 1.0
    assert rank.entity_weight_for(("NXTC",), {"NXTC": "small"}, "ma") == 0.5
    # A name we cannot size scores small, not a flattering default.
    assert rank.entity_weight_for(("GHOST",), {}, "ma") == 0.5
    # A cluster is worth its LARGEST linked name: Apple + a micro-cap is an Apple story.
    assert rank.entity_weight_for(("AAPL", "NXTC"), {"AAPL": "large_mid", "NXTC": "small"}, "ma") == 1.0


def test_a_no_listing_non_macro_story_is_small_not_market_wide():
    """The bug v2 nearly shipped: a merger whose ticker we cannot resolve names no company we hold,
    but it is NOT market-wide — only a macro/Fed event is. So it scores small, and the macro Gulf
    story keeps the lead over it."""
    unresolved_merger = rank.entity_weight_for((), {}, "ma")
    macro_event = rank.entity_weight_for((), {}, "macro")
    assert unresolved_merger == 0.5
    assert macro_event == 1.0


def test_corroboration_saturates_because_the_eighth_outlet_tells_you_nothing():
    assert rank.corroboration_for(1) == 0.2
    assert rank.corroboration_for(3) == 0.6
    assert rank.corroboration_for(5) == 1.0
    assert rank.corroboration_for(12) == 1.0
    assert rank.corroboration_for(0) == 0.0


def test_freshness_decays_the_way_the_plan_says():
    assert rank.freshness_for(0) == 1.0
    assert rank.freshness_for(1) == 0.5
    assert rank.freshness_for(5) == 0.25


# ---------------------------------------------------------------------------------------------
# The event classifier — deterministic, and it must be, because ~70 clusters a night never reach
# the language model at all. (Unchanged in v2; catalyst_weight now reads its output.)
# ---------------------------------------------------------------------------------------------


def test_the_providers_own_merger_category_outranks_any_keyword():
    """It is a fact about where the newsroom filed the article, not a guess about its words."""
    assert rank.classify_event("merger", "Something inscrutable happens") == "ma"


def test_classifies_the_real_headlines_from_the_recording():
    assert rank.classify_event("business", "VitalHub acquires Buddy Healthcare") == "ma"
    assert rank.classify_event("top news", "Fed holds rates steady as inflation cools") == "fed"
    assert rank.classify_event("top news", "Iran widens attacks on US bases, oil prices jump") == "macro"
    assert rank.classify_event("business", "Apple beats on iPhone revenue") == "earnings"
    assert rank.classify_event("business", "Analysts cut their price target on the stock") == "analyst"
    assert rank.classify_event("business", "FDA approves the therapy for wider use") == "fda"


def test_an_unrecognisable_story_is_other_not_a_flattering_guess():
    assert rank.classify_event("business", "A quiet day in the markets") == "other"
    assert rank.catalyst_weight_for("other") == 0.3
    assert rank.catalyst_weight_for("something-nobody-defined") == 0.3


# ---------------------------------------------------------------------------------------------
# magnitude — retained as diagnostic evidence on each row, NOT a v2 ranking factor. It is still
# computed (ingest.py stores it), so it is still tested; it simply no longer sets the order.
# ---------------------------------------------------------------------------------------------


def test_magnitude_is_measured_against_the_tickers_own_volatility_not_in_percent():
    calm_stock_big_day = rank.magnitude_for([TickerMove("KO", ret1=0.03, atr14_pct=0.01)])
    wild_stock_same_day = rank.magnitude_for([TickerMove("BIOX", ret1=0.03, atr14_pct=0.09)])
    assert calm_stock_big_day > wild_stock_same_day
    assert rank.magnitude_for([TickerMove("X", ret1=0.30, atr14_pct=0.01)]) == 1.0


def test_magnitude_direction_does_not_matter_only_size():
    up = rank.magnitude_for([TickerMove("X", ret1=0.05, atr14_pct=0.02)])
    down = rank.magnitude_for([TickerMove("X", ret1=-0.05, atr14_pct=0.02)])
    assert up == down


def test_no_tickers_means_no_magnitude_and_a_missing_number_contributes_nothing():
    assert rank.magnitude_for([]) == 0.0
    known = TickerMove("A", ret1=0.06, atr14_pct=0.02)
    unknown = TickerMove("B", ret1=None, atr14_pct=None)
    assert rank.magnitude_for([known, unknown]) == rank.magnitude_for([known])
    assert rank.magnitude_for([unknown]) == 0.0
    # A zero ATR would divide by zero; it is treated as unknown, not as infinite significance.
    assert rank.magnitude_for([TickerMove("C", ret1=0.05, atr14_pct=0.0)]) == 0.0


# ---------------------------------------------------------------------------------------------
# The page the formula actually produces
# ---------------------------------------------------------------------------------------------


def _sig(*, event_type, sources, tickers=(), buckets=None, sessions_ago=0):
    return rank.significance(
        tickers=tickers,
        event_type=event_type,
        sources=sources,
        buckets=buckets or {},
        sessions_ago=sessions_ago,
    )


def test_appendix_e_orders_d_a_b_c():
    """
    THE ACCEPTANCE TEST — Appendix E's four clusters, night of 2026-07-14, expected order d > a > b > c.

    (a) Iran/oil — 1 outlet, market-wide, macro.        (b) NXTC merger — 1 outlet, micro-cap, M&A.
    (c) LDOS analyst — 1 outlet, large-cap, analyst.    (d) CPI print — 3 outlets, market-wide, macro.

    d leads because it is a corroborated macro print; a single-outlet macro (a) beats a micro-cap M&A
    (b) on entity weight; and an M&A (b) beats an analyst note (c) at equal corroboration because
    catalyst_weight says a hard event outranks an opinion.
    """
    a = _sig(event_type="macro", sources=1)                                          # 1.0×0.2×1.0×1.0 = 0.20
    b = _sig(event_type="ma", sources=1, tickers=("NXTC",), buckets={"NXTC": "small"})       # 1.0×0.2×0.5×1.0 = 0.10
    c = _sig(event_type="analyst", sources=1, tickers=("LDOS",), buckets={"LDOS": "large_mid"})  # 0.4×0.2×1.0×1.0 = 0.08
    d = _sig(event_type="macro", sources=3)                                          # 1.0×0.6×1.0×1.0 = 0.60

    assert d > a > b > c
    assert (d, a, b, c) == pytest.approx((0.60, 0.20, 0.10, 0.08))


def test_a_single_outlet_macro_event_still_leads_over_a_micro_cap_press_release():
    """v1 proved this with a `scope` term keyed on ticker count; v2 proves it with entity_weight —
    a market-wide event with no ticker takes the max, a micro-cap PR is worth half. 'Iran closes the
    Strait of Hormuz' still leads, and it still names no company."""
    hormuz = _sig(event_type="macro", sources=1)
    micro_pr = _sig(event_type="product", sources=1, tickers=("TINY",), buckets={"TINY": "small"})
    assert hormuz > micro_pr


def test_a_mega_cap_hard_event_outranks_a_micro_cap_hard_event_at_equal_catalyst():
    """The entity_weight the plan was commissioned to add: a story on a big liquid name outranks the
    same class of story on a name a PR is trying to inflate."""
    mega = _sig(event_type="ma", sources=1, tickers=("AAPL",), buckets={"AAPL": "large_mid"})
    micro = _sig(event_type="ma", sources=1, tickers=("NXTC",), buckets={"NXTC": "small"})
    assert mega > micro


def test_a_story_we_hold_no_listing_for_still_gets_a_place():
    """At the bottom, honestly — but on the page (C9). It scores as market-wide entity but its
    catalyst and corroboration keep it low."""
    no_listing = _sig(event_type="product", sources=1)
    assert no_listing > 0.0


def test_yesterdays_story_falls_below_todays_all_else_equal():
    today = _sig(event_type="earnings", sources=3, tickers=("AAPL",), buckets={"AAPL": "large_mid"}, sessions_ago=0)
    yesterday = _sig(event_type="earnings", sources=3, tickers=("AAPL",), buckets={"AAPL": "large_mid"}, sessions_ago=1)
    assert today > yesterday


def test_significance_is_bounded_and_a_maximal_story_scores_one():
    maximal = _sig(event_type="fed", sources=9, tickers=("A",), buckets={"A": "large_mid"}, sessions_ago=0)
    minimal = _sig(event_type="other", sources=1, tickers=("Z",), buckets={"Z": "small"}, sessions_ago=9)
    assert maximal == pytest.approx(1.0)
    assert 0.0 < minimal < 0.2


def test_nothing_in_the_formula_can_be_fed_by_a_reader():
    """
    Ruling C1 as an executable statement. `significance` takes five inputs; every one is a property of
    the EVENT. There is no parameter for clicks, views, dwell time, watchlist membership or anything
    else about the person reading — and none could be added quietly, because this test enumerates the
    signature and would have to be edited to let one in.
    """
    import inspect

    parameters = set(inspect.signature(rank.significance).parameters)

    assert parameters == {
        "tickers", "event_type", "sources", "buckets", "sessions_ago",
    }
