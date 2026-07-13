"""
Tests for the boilerplate filter and the corroboration counter (N4).

Both exist because of what the RECORDING said, not what the plan assumed. The near-miss cases are
load-bearing: a filter that eats a real acquisition story is a worse failure than one that lets a
filing through, because the reader never learns the story existed.
"""

import json
from pathlib import Path

from newsdesk import noise, outlets

_FIXTURES = Path(__file__).resolve().parent.parent / "adapters" / "fixtures"


def _merger_feed() -> list[dict]:
    return json.loads((_FIXTURES / "finnhub" / "news_merger.json").read_text())


# --------------------------------------------------------------------------------------------
# The boilerplate filter
# --------------------------------------------------------------------------------------------


def test_it_recognises_the_uk_takeover_panel_forms_that_flood_the_merger_feed():
    assert noise.is_boilerplate("Form 8.3 - Picton Property Income Limited")
    assert noise.is_boilerplate("Form 8.5 (EPT/RI) - Cordel Group Plc")
    # The wires prefix them with the filer's own name, which is why the pattern allows a prefix.
    assert noise.is_boilerplate("Man Group PLC : Form 8.3 - JTC Plc")


def test_it_recognises_the_other_standard_filing_families():
    assert noise.is_boilerplate("Transaction in Own Shares")
    assert noise.is_boilerplate("Total Voting Rights")
    assert noise.is_boilerplate("Net Asset Value(s)")
    assert noise.is_boilerplate("Holding(s) in Company")


def test_it_keeps_every_real_acquisition_story_in_the_recording():
    """
    THE CASES THAT MUST SURVIVE. Each of these is genuine M&A news from the recorded merger feed, and
    a filter that reached even slightly wider would eat one of them.
    """
    real = [
        "VitalHub acquires Buddy Healthcare",
        "TransDigm drops $960M Stellant Systems acquisition",
        "First Hawaiian Bank to acquire TriCo Bancshares; reports prelim Q2 earnings",
        "Conmed jumps after report of takeover interest",
        "General Fusion Completes Business Combination with Spring Valley Acquisition Corp",
        "Saipem, Subsea 7 merger faces E.U. antitrust investigation - Reuters",
        "Baker Hughes wins E.U. approval for Chart Industries deal after LNG tech divestiture",
        "Oregon reportedly drops motion against Paramount's Warner bid",
        "Nippon Paint has made multiple offers for Akzo Nobel's decorative paints unit",
    ]
    for headline in real:
        assert not noise.is_boilerplate(headline), f"the filter ate a real story: {headline}"


def test_a_story_that_merely_discusses_a_filing_is_not_a_filing():
    """The pattern is anchored to the start for exactly this reason."""
    assert not noise.is_boilerplate("Regulators demand a new form of disclosure from banks")
    assert not noise.is_boilerplate("Tesla files Form 10-K with record deliveries")


def test_the_filter_swept_something_and_the_number_is_the_one_we_measured():
    """
    The sweep must prove it swept. Against the real recorded merger feed: 60 items in, 26 UK filings
    out, 34 real stories kept. If a provider ever stops sending them, this test fails and says so
    rather than passing on an empty sweep — seven guards in this build have "passed" because the
    thing they measured was absent rather than correct.
    """
    feed = _merger_feed()
    kept = noise.strip_boilerplate(feed, headline_of=lambda item: item["headline"])

    assert len(feed) == 60
    assert len(kept) == 34
    assert len(feed) - len(kept) == 26


# --------------------------------------------------------------------------------------------
# Corroboration — who actually confirmed the story
# --------------------------------------------------------------------------------------------


def test_a_newsroom_counts_as_itself():
    assert outlets.canonical_outlet("Reuters") == "Reuters"
    assert outlets.distinct_outlets(["Reuters", "Bloomberg", "CNBC"]) == 3


def test_three_wires_carrying_one_press_release_are_one_source_not_three():
    """
    The honesty rule at the heart of this file. A company pays a wire to carry its announcement; the
    wire does not decide the story is worth carrying. Counting each pipe as a corroborating source
    would pay a story for its own press office's distribution budget and rank it above a story three
    newsrooms independently chose to print.
    """
    assert outlets.distinct_outlets(["GlobeNewswire", "BusinessWire", "PR Newswire"]) == 1
    assert outlets.canonical_outlet("GlobeNewswire") == outlets.PRESS_RELEASE


def test_wires_and_newsrooms_mix_correctly():
    """The company announced it AND Reuters wrote it up: two sources, and the second one is evidence."""
    assert outlets.distinct_outlets(["GlobeNewswire", "BusinessWire", "Reuters"]) == 2


def test_an_empty_source_counts_as_nothing():
    assert outlets.distinct_outlets(["", None, "Reuters"]) == 1
