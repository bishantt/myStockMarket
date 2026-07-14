"""
Tests for briefing/lexicon.py — ruling E4's teeth (POLISH-AND-DEPTH-PLAN Part 2, 9.3).

E4: **insight never advises, and frequency words are earned.**

Two checks, and the second is the one with an argument behind it. "An approval of this class USUALLY
re-prices the whole segment" is folk probability wearing prose: it makes a frequency claim — a claim
about how OFTEN something happens — with no base rate, no N, and no source. This product publishes
base rates with Wilson intervals and an N-gate precisely so that it never has to say "usually" and
hope. So a frequency adverb is permitted ONLY in a sentence that also cites a computed stat, which
is the pipeline's way of saying: if you want to tell the reader how often, show them the count.

THE FALSE POSITIVE IS THE DANGEROUS FAILURE, not the false negative, and these tests are weighted
that way. A flagged section is DELETED, and a deleted section prints exactly the same nothing as a
section the narrator honestly had nothing to say in. So a lexicon that is too eager would quietly
strip honest prose off the page and no screen anywhere would say so. Hence: "a buy rating" is a
FACT about an analyst's opinion and must survive; "buy the dip" is advice and must not.
"""

from __future__ import annotations

from datetime import date

from briefing.lexicon import lexicon_flags
from briefing.stats import build_cluster_stats
from briefing.verify import build_source_set

RUN_DATE = date(2026, 7, 9)


def _stat_sources(stats=()):
    """A source set built from STATS ONLY — which is the whole point. E4 earns a frequency adverb
    with a *computed* stat, not with any number the article happened to contain. An extract's
    key_number is a figure a journalist wrote down; a registry stat is a figure this pipeline
    calculated and can defend."""
    return build_source_set(extracts=[], stats=stats, instruments=[], run_date=RUN_DATE)


def _flags(text, stats=(), location="context"):
    return lexicon_flags(text, stat_sources=_stat_sources(stats), location=location)


# ----- advice verbs (E4, first half) -----

def test_an_advice_verb_is_flagged():
    assert _flags("Investors should buy the dip on any further weakness.")


def test_the_modal_should_is_advice_wherever_it_appears():
    """Mechanical third-person prose about what happened has no use for "should". Every sentence it
    can appear in is either a recommendation or a forecast, and both are banned."""
    assert _flags("The stock should recover once supply normalizes.")


def test_taking_profits_is_advice():
    assert _flags("Holders may want to take profits into the print.")


def test_trimming_and_accumulating_are_advice():
    assert _flags("This is a level to trim exposure.")
    assert _flags("Long-term holders can accumulate here.")


def test_a_buy_rating_is_a_fact_and_survives():
    """THE FALSE POSITIVE THAT WOULD HURT MOST. An analyst upgrade is a real, reportable event, and
    "buy" is the NAME of the rating — not a thing the app is telling the reader to do. A lexicon that
    cannot tell those apart deletes the honest sentence and prints nothing in its place."""
    assert not _flags("The analyst lifted the stock to a buy rating ahead of earnings.")


def test_buyers_and_sellers_are_people_not_instructions():
    assert not _flags("Buyers stepped in near the lows and sellers faded into the close.")


def test_a_selloff_is_not_a_sell_order():
    assert not _flags("The sell-off spread across the semiconductor complex.")


# ----- frequency adverbs (E4, second half — the earned ones) -----

def test_an_uncited_frequency_adverb_is_flagged():
    """The heart of E4. No count, no N, no source — just a confident adverb."""
    assert _flags("An approval of this class usually re-prices the whole treatment segment.")


def test_every_named_frequency_adverb_is_caught():
    for adverb in ("usually", "often", "rarely", "typically", "generally", "frequently", "seldom"):
        assert _flags(f"Such events {adverb} move the sector."), adverb


def test_the_verb_tends_is_a_frequency_claim_too():
    assert _flags("The sector tends to move together on approvals.")


def test_a_frequency_adverb_is_EARNED_by_a_cited_stat_in_the_same_sentence():
    """The permission E4 grants. The adverb is anchored to a number the pipeline computed."""
    stats = build_cluster_stats("nc-x", sources=4, history7d=3)

    assert not _flags(
        "This name has typically been in the news often — 3 stories on this name in the last 7 "
        "sessions.",
        stats=stats,
    )


def test_the_stat_must_be_in_THE_SAME_sentence_as_the_adverb():
    """A number two sentences away does not anchor an adverb. The claim and its evidence have to be
    in the same breath, or the reader is being asked to connect them on trust."""
    stats = build_cluster_stats("nc-x", sources=4, history7d=3)

    assert _flags(
        "There have been 3 stories on this name in the last 7 sessions. Approvals usually re-price "
        "the segment.",
        stats=stats,
    )


def test_an_EXTRACT_number_does_not_earn_a_frequency_adverb():
    """The distinction that gives E4 its force. A number a journalist wrote in an article is not a
    base rate this pipeline computed — quoting one alongside "usually" is still folk probability,
    it merely has a decoration beside it. Only the registry earns the adverb.

    (The gate still checks that number for truth; this rule is about what it EARNS, not what it is.)
    """
    # No stats at all: the "40%" below traces to an extract, never to the registry.
    assert _flags("Revenue grew 40%, and beats of that size usually lift the whole supply chain.")


def test_clean_mechanical_prose_passes_untouched():
    """The common case, and the one a too-eager lexicon would destroy."""
    assert not _flags(
        "Server orders are an early read on datacentre capital spending, which lands in the "
        "revenue of the chipmakers a quarter or two later."
    )


def test_the_flag_names_where_it_was_found():
    flags = _flags("Investors should buy the dip.", location="context")

    assert flags[0].location == "context"
    assert flags[0].kind in ("advice", "frequency")


def test_empty_prose_is_not_a_violation():
    assert _flags("") == ()


# ----- identifiers in prose (PD7's first real dispatch published one) -----

def test_a_stat_id_in_the_prose_is_flagged():
    """THE SENTENCE THAT SHIPPED. Every number in it was true, every citation correct, and it is a
    sha1 hash in a newspaper:

        "This story is carried by 1 outlet tonight (cls:798fa63d458eaeca...:corroboration)."

    The model was told to cite each number "by its stat_id" and put the id where the reader could
    see it. A prompt is a request; this is the rule."""
    assert _flags(
        "This story is carried by 1 outlet tonight (cls:798fa63d458eaeca83850221b351fe71ed9cddae:corroboration)."
    )


def test_every_registry_namespace_is_caught_in_prose():
    for entity in ("tkr:AAPL:pos52w", "cls:nc-x:history7d", "cal:CPI:next", "sector:Technology:breadth1d"):
        flags = _flags(f"The name sits mid-range ({entity}).")
        assert flags and flags[0].kind == "id_in_prose", entity


def test_a_bare_hash_in_prose_is_caught_however_it_arrived():
    assert _flags("The cluster 798fa63d458eaeca83850221b351fe71ed9cddae covers it.")


def test_the_VALUE_of_a_stat_is_exactly_what_prose_SHOULD_carry():
    """The fix is not "say less" — it is "say the number, not its filing reference"."""
    assert not _flags("The move is 2.3x its normal daily range, and the name sits 71.4% up its range.")


def test_an_ordinary_colon_is_not_an_identifier():
    """The guard must not fire on English. A colon in a sentence is punctuation."""
    assert not _flags("The mechanism is simple: an approval changes the standard of care.")
