"""
Tests for ticker resolution (N4).

The false-positive tests are the ones that matter. A missed link costs a card one chip; a wrong link
prints a false statement about a company underneath a real headline and beside a real price move.
Every case below where the resolver is expected to find NOTHING is a case where a naive
implementation finds something, and would put it on the front page.
"""

import pytest

from newsdesk.resolve import Instrument, TickerResolver, canonical_name


UNIVERSE = [
    Instrument("AAPL", "Apple Inc."),
    Instrument("NVDA", "NVIDIA Corporation"),
    Instrument("GM", "General Motors Company"),
    Instrument("BAC", "Bank of America Corporation"),
    Instrument("TGT", "Target Corporation"),
    Instrument("GPS", "Gap Inc."),
    Instrument("V", "Visa Inc."),
    Instrument("AI", "C3.ai, Inc."),
    Instrument("FSK", "FS KKR Capital Corp."),
    Instrument("SBUX", "Starbucks Corporation"),
    Instrument("PFE", "Pfizer Inc."),
]


@pytest.fixture
def resolver() -> TickerResolver:
    return TickerResolver(UNIVERSE)


def test_strips_the_legal_suffixes_a_headline_never_prints():
    assert canonical_name("Apple Inc.") == "apple"
    assert canonical_name("NVIDIA Corporation") == "nvidia"
    assert canonical_name("Bank of America Corporation") == "bank of america"
    assert canonical_name("Alphabet Inc. Class A") == "alphabet"


def test_an_exchange_qualified_ticker_is_the_strongest_evidence_there_is(resolver: TickerResolver):
    """The article linked itself, in the one format that cannot mean anything else."""
    assert resolver.resolve("FS KKR Capital: 5 Reasons I'm Staying Away (NYSE:FSK)") == ("FSK",)
    assert resolver.resolve("Apple (NASDAQ: AAPL) has defied expectations") == ("AAPL",)


def test_finds_multi_word_and_ordinary_company_names(resolver: TickerResolver):
    assert resolver.resolve("Bank of America raised its dividend") == ("BAC",)
    assert resolver.resolve("Nvidia's data-center revenue climbed") == ("NVDA",)
    assert resolver.resolve("General Motors is cutting shifts") == ("GM",)
    assert resolver.resolve("Pfizer wins approval for the treatment") == ("PFE",)


def test_a_company_named_after_an_ordinary_word_is_not_matched_by_that_word(resolver: TickerResolver):
    """
    THE CLASS OF BUG THIS FILE EXISTS FOR.

    Every one of these headlines uses an ordinary English word that is also a listed company's name.
    A resolver that matched on the name alone would put Target, Gap and Visa on the front page, each
    attached to a story that is not about them, each wearing a real price move.
    """
    assert resolver.resolve("Analysts raised their target price on the stock") == ()
    assert resolver.resolve("The gap between guidance and consensus widened") == ()
    assert resolver.resolve("Visa applications for skilled workers fell") == ()


def test_an_ambiguous_name_still_links_when_the_article_names_its_ticker(resolver: TickerResolver):
    """The stoplist blocks the WEAK rule, not the strong one. Evidence beats a blanket ban."""
    assert resolver.resolve("Target (NYSE: TGT) beat on comparable sales") == ("TGT",)
    assert resolver.resolve("Visa (NYSE: V) lifted its buyback") == ("V",)


def test_the_ai_collision_which_is_the_sharpest_one_on_this_feed(resolver: TickerResolver):
    """
    "AI" is simultaneously this decade's biggest market theme and a real listed company (C3.ai).

    A bare-uppercase rule that accepted two-letter tokens would tag every artificial-intelligence
    story in the feed as a story about C3.ai — dozens of cards a night, each one false, each one
    perfectly plausible. So bare symbols must be three characters or more, and "AI" links only when
    an article names the exchange.
    """
    assert resolver.resolve("AI spending is reshaping the semiconductor market") == ()
    assert resolver.resolve("Nvidia says AI demand is accelerating") == ("NVDA",)
    assert resolver.resolve("C3.ai (NYSE: AI) reported earnings") == ("AI",)


def test_common_acronyms_are_never_read_as_tickers(resolver: TickerResolver):
    """The feed is full of CEO, IPO, GDP, FDA and SEC."""
    assert resolver.resolve("The CEO told the SEC the IPO would proceed") == ()
    assert resolver.resolve("FDA approval sent the sector higher") == ()


def test_a_bare_uppercase_symbol_links_when_it_is_long_enough_to_be_unambiguous(resolver: TickerResolver):
    assert resolver.resolve("AAPL slipped 2% after the note") == ("AAPL",)
    # Symbols come back in the order the article mentions them — a stable, explainable order that
    # owes nothing to any notion of importance. Ranking the tickers on a card is rank.py's job, and
    # it is done from price evidence, not from who got named first.
    assert resolver.resolve("SBUX and NVDA both closed higher") == ("SBUX", "NVDA")


def test_a_story_about_nobody_resolves_to_nobody(resolver: TickerResolver):
    """
    The Fed decision, the jobs print, the tariff ruling. These name no company, and the Front Page
    has a designed shape for exactly this story — it does not need a ticker invented for it.
    """
    assert resolver.resolve("The Federal Reserve held rates steady") == ()
    assert resolver.resolve("Jobless claims fell to a four-week low") == ()
    assert resolver.resolve("") == ()


def test_two_companies_that_canonicalize_to_the_same_name_match_neither():
    """An ambiguous name is not evidence, and choosing one of the two would be inventing the link."""
    twins = [Instrument("ACME", "Acme Corporation"), Instrument("ACM2", "Acme Inc.")]
    r = TickerResolver(twins)

    assert r.resolve("Acme announced a buyback") == ()
    # …and the explicit ticker still works, because it names which one.
    assert r.resolve("Acme (NASDAQ: ACME) announced a buyback") == ("ACME",)


def test_the_same_symbol_is_never_listed_twice(resolver: TickerResolver):
    """Name and ticker both present is the normal case, not a reason to print the chip twice."""
    assert resolver.resolve("Apple (NASDAQ: AAPL) said AAPL buybacks continue") == ("AAPL",)
