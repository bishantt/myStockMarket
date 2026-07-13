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


def test_a_bare_uppercase_token_is_never_read_as_a_ticker():
    """
    THE RULE THAT SHIPPED, REACHED PRODUCTION, AND WAS DELETED — with the two headlines that killed it.

    There used to be a fourth rule: a bare uppercase token that happens to be a symbol. It passed
    every test against a small test universe. Against production's 12,933 instruments it immediately
    linked a country and a commodity to two ETFs.

    In a universe of thirteen thousand tickers, almost every three-to-five letter uppercase string is
    somebody's ticker. No stoplist survives that; it would have to enumerate every country code,
    commodity abbreviation and initialism in English, and still be one headline behind.
    """
    universe = TickerResolver(
        UNIVERSE
        + [
            Instrument("UAE", "iShares MSCI UAE ETF"),
            Instrument("LNG", "Cheniere Energy Inc"),
        ]
    )

    # A country.
    assert universe.resolve(
        "US makes it easier to export Nvidia AI chips and military equipment to the UAE"
    ) == ("NVDA",)

    # A commodity.
    assert "LNG" not in universe.resolve(
        "Baker Hughes wins E.U. approval for Chart Industries deal after LNG tech divestiture"
    )

    # And a bare ticker with no company name beside it simply does not link. Journalists write
    # "Apple", not "AAPL", so the rule bought almost nothing and cost a false statement per night.
    assert universe.resolve("AAPL slipped 2% after the note") == ()


# ---------------------------------------------------------------------------------------------
# A provider's symbol is not automatically our symbol
# ---------------------------------------------------------------------------------------------


def test_a_symbol_we_hold_no_listing_for_is_refused():
    """
    Marketaux routinely tags foreign and OTC lines this app does not carry (SKLTF, RYAOF, SAFRF). A
    chip for one of them would be a dead chip — no name, no price, no move, no setup card — and the
    room already has honest copy for a story with no listing in our universe.
    """
    r = TickerResolver(UNIVERSE)

    assert not r.agrees_on("SKLTF", "Skeleton Technologies")
    assert not r.agrees_on("RYAOF", "Ryanair Holdings plc")


def test_the_exchange_collision_that_nearly_printed_a_false_price():
    """
    THE ONE THAT MATTERS MOST, AND PRODUCTION FOUND IT.

    Marketaux tagged "VitalHub Announces Acquisition of Buddy Healthcare" with VHI — correctly, for
    VitalHub on the Toronto exchange. In OUR instrument table VHI is Valhi, Inc., a New York chemicals
    holding company with no connection to the story at all.

    Unchecked, the card would have printed Valhi's real one-day price move under a headline about a
    Canadian health-software acquisition. Every number on it would have been true, and the card would
    have been a lie. A symbol collision across exchanges is not a near miss — it is a different company.
    """
    ours = TickerResolver([Instrument("VHI", "Valhi, Inc.")])

    assert not ours.agrees_on("VHI", "VitalHub Corp")   # the provider means Toronto; we hold New York
    assert ours.agrees_on("VHI", "Valhi Inc.")          # …and the same company still links


def test_a_provider_tag_with_no_company_name_cannot_be_checked_so_it_is_refused():
    """An unverifiable tag is refused rather than assumed. We cannot check what we were not told."""
    r = TickerResolver(UNIVERSE)

    assert not r.agrees_on("AAPL", None)
    assert not r.agrees_on("AAPL", "")
    assert r.agrees_on("AAPL", "Apple Inc.")


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
