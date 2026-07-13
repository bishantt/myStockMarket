"""
Tests for the sector map and the theme keywords (plan Appendix E).

The near-miss cases are the important half. A theme matcher that finds "AI" inside "said" fills the
AI filter with the entire feed, and nobody notices, because every story it wrongly includes is still
a real story.
"""

from newsdesk import taxonomy


def test_the_sector_set_is_closed_and_is_the_eleven_the_room_has_chips_for():
    assert len(taxonomy.SECTORS) == 11
    assert "Technology" in taxonomy.SECTORS
    assert taxonomy.BROAD_MARKET not in taxonomy.SECTORS  # it is a default, not a twelfth sector


def test_translates_the_providers_vocabulary_into_ours():
    """Marketaux says "Consumer Cyclical"; the room's chip says "Consumer discretionary"."""
    assert taxonomy.sector_for_industry("Consumer Cyclical") == "Consumer discretionary"
    assert taxonomy.sector_for_industry("Financial Services") == "Financials"
    assert taxonomy.sector_for_industry("Technology") == "Technology"
    assert taxonomy.sector_for_industry("Consumer Defensive") == "Consumer staples"
    # Casing and stray whitespace are the provider's business, not ours.
    assert taxonomy.sector_for_industry("  financial services  ") == "Financials"


def test_an_unknown_industry_says_nothing_rather_than_guessing():
    """
    None, not "Broad market". They are different facts: one means this evidence was silent, the other
    means the story genuinely has no sector. Collapsing them would let one quiet provider decide that
    an FDA approval is a market-wide event.
    """
    assert taxonomy.sector_for_industry("Underwater Basket Weaving") is None
    assert taxonomy.sector_for_industry("") is None
    assert taxonomy.sector_for_industry(None) is None


def test_the_instrument_table_outranks_the_provider_and_both_are_used():
    sectors = taxonomy.sectors_for(
        instrument_sectors=["Technology"], industries=["Financial Services"]
    )
    assert sectors == ["Technology", "Financials"]


def test_a_story_we_cannot_place_is_broad_market_and_that_is_information():
    """A Fed decision has no sector. Saying so is the correct answer, not a failure to classify."""
    assert taxonomy.sectors_for(instrument_sectors=[], industries=[]) == ["Broad market"]
    assert taxonomy.sectors_for(instrument_sectors=[None], industries=["Nonsense"]) == ["Broad market"]


def test_sectors_always_come_back_in_the_same_order():
    """Two stories touching the same sectors must list them identically, or the chips reshuffle."""
    one = taxonomy.sectors_for(industries=["Technology", "Energy", "Financial Services"])
    two = taxonomy.sectors_for(industries=["Financial Services", "Technology", "Energy"])

    assert one == two == ["Technology", "Financials", "Energy"]


def test_finds_the_two_themes_it_is_authorised_to_find():
    assert taxonomy.themes_for("Nvidia's AI chip demand keeps climbing") == ["AI"]
    assert taxonomy.themes_for("Pentagon awards missile contract") == ["Defense"]
    # Additive: a story can be both.
    assert taxonomy.themes_for("The Pentagon is buying AI targeting systems") == ["AI", "Defense"]


def test_the_near_misses_that_a_substring_search_would_swallow():
    """
    The whole reason the matcher uses word boundaries. Each of these strings CONTAINS the letters of
    a theme keyword and is not about that theme, and a naive `"ai" in text` finds every one of them.
    """
    assert taxonomy.themes_for("The company said it would raise its dividend") == []
    assert taxonomy.themes_for("Foreign aid budget debated again") == []
    assert taxonomy.themes_for("Investors rotated into defensive stocks") == []
    assert taxonomy.themes_for("Retailers await the holiday season") == []
    assert taxonomy.themes_for("Air travel demand rebounds") == []


def test_the_theme_matcher_is_case_insensitive_and_reads_real_phrases():
    assert taxonomy.themes_for("ARTIFICIAL INTELLIGENCE spending surges") == ["AI"]
    assert taxonomy.themes_for("a large language model breakthrough") == ["AI"]
    assert taxonomy.themes_for("NATO members raise defence budgets") == ["Defense"]


def test_no_text_means_no_themes():
    assert taxonomy.themes_for("") == []
