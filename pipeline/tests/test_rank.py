"""
Tests for the significance formula (plan Appendix E; ruling C1).

The formula IS the promise that the Front Page is edited by evidence. So these tests do not only
check arithmetic — they check that the page it produces is the page the plan promised: a Fed decision
above an earnings beat, a real story with no listing still present, and nowhere for popularity to
enter even if someone wanted it to.
"""

import pytest

from newsdesk import rank
from newsdesk.rank import TickerMove


def test_the_weights_sum_to_one():
    """A formula whose weights quietly stopped summing to one would still produce an order, and that
    order would mean nothing. Cheap to assert; impossible to notice by eye."""
    total = rank.W_SCOPE + rank.W_CORROBORATION + rank.W_MAGNITUDE + rank.W_CLASS_PRIOR + rank.W_RECENCY
    assert total == pytest.approx(1.0)


# ---------------------------------------------------------------------------------------------
# The event classifier — deterministic, and it must be, because ~70 clusters a night never reach
# the language model at all.
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
    assert rank.class_prior_for("other") == 0.3
    assert rank.class_prior_for("something-nobody-defined") == 0.3


# ---------------------------------------------------------------------------------------------
# The terms
# ---------------------------------------------------------------------------------------------


def test_a_macro_event_is_macro_even_though_it_names_no_company():
    """
    The most important single line in the formula. "Iran closes the Strait of Hormuz" names no
    ticker, and it is the biggest market story of its day. A scope rule keyed on ticker count would
    have filed it at the very bottom of the page, beneath a price-target change.
    """
    assert rank.scope_for((), "macro", ["Broad market"]) == rank.SCOPE_MACRO
    assert rank.scope_for((), "fed", ["Broad market"]) == rank.SCOPE_MACRO


def test_scope_widens_with_the_number_of_names_it_touches():
    assert rank.scope_for(("AAPL",), "earnings", ["Technology"]) == rank.SCOPE_SINGLE
    assert rank.scope_for(("AAPL", "MSFT", "NVDA"), "earnings", ["Technology"]) == rank.SCOPE_SECTOR


def test_a_story_we_hold_no_listing_for_still_gets_a_place():
    """At the bottom, and honestly labeled — but on the page. C9."""
    assert rank.scope_for((), "product", ["Broad market"]) == rank.SCOPE_NO_LISTING
    assert rank.scope_for((), "product", []) > 0


def test_corroboration_saturates_because_the_eighth_outlet_tells_you_nothing():
    assert rank.corroboration_for(1) == 0.2
    assert rank.corroboration_for(5) == 1.0
    assert rank.corroboration_for(12) == 1.0
    assert rank.corroboration_for(0) == 0.0


def test_a_move_is_measured_against_the_tickers_own_volatility_not_in_percent():
    """
    A 3% day is enormous for a utility and a quiet Tuesday for a biotech. A formula that could not
    tell them apart would rank every speculative name above every real story, every night.
    """
    calm_stock_big_day = rank.magnitude_for([TickerMove("KO", ret1=0.03, atr14_pct=0.01)])
    wild_stock_same_day = rank.magnitude_for([TickerMove("BIOX", ret1=0.03, atr14_pct=0.09)])

    assert calm_stock_big_day > wild_stock_same_day
    # Three ATRs is where the scale tops out — past that everything is simply "huge".
    assert rank.magnitude_for([TickerMove("X", ret1=0.30, atr14_pct=0.01)]) == 1.0


def test_direction_does_not_matter_only_size():
    """The page ranks catalysts, not winners. A crash is as significant as a rally."""
    up = rank.magnitude_for([TickerMove("X", ret1=0.05, atr14_pct=0.02)])
    down = rank.magnitude_for([TickerMove("X", ret1=-0.05, atr14_pct=0.02)])
    assert up == down


def test_no_tickers_means_no_magnitude_and_that_is_an_answer_not_a_penalty():
    assert rank.magnitude_for([]) == 0.0


def test_a_ticker_missing_its_numbers_contributes_nothing_rather_than_a_zero():
    """
    An unknown ATR is not a calm stock. Averaging a null in as zero is the same class of error as
    sorting nulls to the top of an ascending column — this build has already made it once, and the
    table comparator was fixed for exactly this reason.
    """
    known = TickerMove("A", ret1=0.06, atr14_pct=0.02)
    unknown = TickerMove("B", ret1=None, atr14_pct=None)

    assert rank.magnitude_for([known, unknown]) == rank.magnitude_for([known])
    assert rank.magnitude_for([unknown]) == 0.0
    # A zero ATR would divide by zero; it is treated as unknown, not as infinite significance.
    assert rank.magnitude_for([TickerMove("C", ret1=0.05, atr14_pct=0.0)]) == 0.0


def test_recency_decays_the_way_the_plan_says():
    assert rank.recency_for(0) == 1.0
    assert rank.recency_for(1) == 0.5
    assert rank.recency_for(5) == 0.25


# ---------------------------------------------------------------------------------------------
# The page the formula actually produces
# ---------------------------------------------------------------------------------------------


def test_the_fed_outranks_a_single_name_earnings_beat_which_is_the_whole_point():
    fed = rank.significance(
        tickers=(), event_type="fed", sectors=["Broad market"], sources=4, moves=[], sessions_ago=0
    )
    beat = rank.significance(
        tickers=("AAPL",), event_type="earnings", sectors=["Technology"], sources=2,
        moves=[TickerMove("AAPL", ret1=0.04, atr14_pct=0.02)], sessions_ago=0,
    )

    assert fed > beat


def test_a_huge_move_on_one_name_cannot_outrank_a_market_wide_event():
    """
    C4, in arithmetic. The lead slot is a POSITION, not a reward for the size of a move — so even a
    three-ATR day on a single name, corroborated by everybody, sits below the Fed.
    """
    fed = rank.significance(
        tickers=(), event_type="fed", sectors=["Broad market"], sources=5, moves=[], sessions_ago=0
    )
    monster = rank.significance(
        tickers=("GME",), event_type="product", sectors=["Consumer discretionary"], sources=5,
        moves=[TickerMove("GME", ret1=0.40, atr14_pct=0.05)], sessions_ago=0,
    )

    assert fed > monster


def test_yesterdays_story_falls_below_todays_all_else_equal():
    today = rank.significance(
        tickers=("AAPL",), event_type="earnings", sectors=["Technology"], sources=3, moves=[],
        sessions_ago=0,
    )
    yesterday = rank.significance(
        tickers=("AAPL",), event_type="earnings", sectors=["Technology"], sources=3, moves=[],
        sessions_ago=1,
    )
    assert today > yesterday


def test_significance_is_bounded_and_a_maximal_story_scores_one():
    maximal = rank.significance(
        tickers=("A", "B", "C"), event_type="fed", sectors=["Broad market"], sources=9,
        moves=[TickerMove("A", ret1=0.30, atr14_pct=0.01)], sessions_ago=0,
    )
    minimal = rank.significance(
        tickers=(), event_type="other", sectors=[], sources=0, moves=[], sessions_ago=9
    )

    assert maximal == pytest.approx(1.0)
    assert 0.0 < minimal < 0.2


def test_nothing_in_the_formula_can_be_fed_by_a_reader():
    """
    Ruling C1 as an executable statement. `significance` takes six inputs; every one is a property of
    the EVENT. There is no parameter for clicks, views, dwell time, watchlist membership or anything
    else about the person reading — and none could be added quietly, because this test enumerates the
    signature and would have to be edited to let one in.
    """
    import inspect

    parameters = set(inspect.signature(rank.significance).parameters)

    assert parameters == {
        "tickers", "event_type", "sectors", "sources", "moves", "sessions_ago",
    }
