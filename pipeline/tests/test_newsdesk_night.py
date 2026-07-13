"""
The fixture-night integration test (plan 7.11-N4): the whole newsdesk, on the real recorded night.

This is the test that would have caught every one of N4's findings before a line of UI was written,
and it is pinned to real numbers so that a provider changing its behaviour shows up as a failing
build rather than as a quietly emptier front page.

It runs on the ACTUAL recordings: 160 Finnhub market articles (100 general + 60 merger) and the 3
Marketaux items, exactly as the providers sent them on 2026-07-13.
"""

import json
from datetime import date, datetime, timezone
from pathlib import Path

from newsdesk.ingest import STAGE_A_CLUSTER_CAP, build_night
from newsdesk.rank import TickerMove
from newsdesk.resolve import Instrument, TickerResolver

_FIXTURES = Path(__file__).resolve().parent.parent / "adapters" / "fixtures"
SESSION = date(2026, 7, 13)

# A realistic slice of the instrument table, chosen to include the TRAPS — the companies whose names
# are ordinary English words. If the resolver is going to embarrass this app, it will do it here.
UNIVERSE = [
    Instrument(*pair)
    for pair in [
        ("AAPL", "Apple Inc."), ("NVDA", "NVIDIA Corporation"), ("MSFT", "Microsoft Corporation"),
        ("TSM", "Taiwan Semiconductor Manufacturing"), ("CRM", "Salesforce, Inc."),
        ("AMD", "Advanced Micro Devices, Inc."), ("INTC", "Intel Corporation"),
        ("XOM", "Exxon Mobil Corporation"), ("CVX", "Chevron Corporation"),
        ("BA", "Boeing Company"), ("LMT", "Lockheed Martin Corporation"),
        ("TGT", "Target Corporation"), ("GPS", "Gap Inc."), ("V", "Visa Inc."),
        ("AI", "C3.ai, Inc."), ("KEY", "KeyCorp"), ("MTCH", "Match Group, Inc."),
        ("F", "Ford Motor Company"), ("GM", "General Motors Company"),
        # The names Marketaux tagged on the recorded night. They survive the cross-check only because
        # our name for each agrees with the provider's.
        ("FSK", "FS KKR Capital Corp."), ("SBUX", "Starbucks Corporation"),
    ]
]


def _articles() -> list[dict]:
    """The night, as the providers actually sent it."""
    out: list[dict] = []
    for fixture in ("news_general", "news_merger"):
        for raw in json.loads((_FIXTURES / "finnhub" / f"{fixture}.json").read_text()):
            out.append(
                {
                    "id": raw["id"],
                    "url": raw["url"],
                    "headline": raw["headline"],
                    "summary": raw.get("summary", ""),
                    "source": raw["source"],
                    "category": raw.get("category", ""),
                    "image": raw.get("image", ""),
                    "published": datetime.fromtimestamp(raw["datetime"], tz=timezone.utc),
                    "tickers": (),  # the market feed names none — this is the finding
                }
            )

    marketaux = json.loads((_FIXTURES / "marketaux" / "news_market.json").read_text())
    for raw in marketaux["data"]:
        out.append(
            {
                "id": raw["uuid"],
                "uuid": raw["uuid"],
                "url": raw["url"],
                "headline": raw["title"],
                "summary": raw.get("description", ""),
                "source": raw["source"],
                "image": raw.get("image_url", ""),
                "published": datetime.fromisoformat(raw["published_at"].replace("Z", "+00:00")),
                # Marketaux DOES tag entities — but a provider's symbol refers to the PROVIDER's
                # exchange, so each tag arrives with the company the provider believes it is, and the
                # ingest refuses any our instrument table names differently.
                "tickers": tuple(e["symbol"] for e in raw.get("entities", [])),
                "ticker_names": {e["symbol"]: e.get("name") for e in raw.get("entities", [])},
                "industries": [e.get("industry") for e in raw.get("entities", [])],
                "similar": tuple(raw.get("similar") or ()),
            }
        )
    return out


def _night():
    return build_night(
        articles=_articles(),
        resolver=TickerResolver(UNIVERSE),
        moves={"NVDA": TickerMove("NVDA", ret1=0.043, atr14_pct=0.021)},
        session_date=SESSION,
        sectors_by_symbol={"NVDA": "Technology", "AAPL": "Technology", "TSM": "Technology"},
    )


def test_the_recorded_night_produces_the_front_page_we_measured():
    """
    The pinned numbers. 163 articles in; 26 UK Takeover-Panel filings dropped; 137 kept; and the
    clusterer finds the merges that are really there.

    Every one of these numbers was MEASURED against the recording, not predicted. If a provider
    changes what it sends, this test fails and names the change, rather than the front page quietly
    getting emptier while every other gate stays green.
    """
    night = _night()

    assert night.articles_in == 163
    assert night.boilerplate_dropped == 26
    assert len(night.clusters) == 134

    merged = [c for c in night.clusters if len(c.members) > 1]
    assert len(merged) == 3, "the three true same-story merges in the recorded night"


def test_nothing_is_dropped_silently():
    """A cut that does not state its own size is a cut nobody can audit (C6)."""
    night = _night()
    kept = len(night.clusters)
    articles_in_clusters = sum(len(c.members) for c in night.clusters)

    assert articles_in_clusters == night.articles_in - night.boilerplate_dropped
    assert kept + night.boilerplate_dropped <= night.articles_in


def test_the_page_is_led_by_the_biggest_story_of_the_day_and_it_names_no_company():
    """
    THE WHOLE DESIGN, IN ONE ASSERTION.

    The recorded night's dominant story is the Gulf escalation — oil, the Strait of Hormuz, futures
    down. It names no listed company at all. A feed ranked by ticker moves, or by how many people
    clicked it, would have buried it under a price-target change on a mid-cap.

    It leads because scope is the biggest term in the formula and a macro event has the highest
    scope there is. That is what "edited by evidence" means in practice.
    """
    lead = _night().clusters[0]

    assert lead.event_type in {"macro", "fed"}
    assert lead.significance > 0.5


def test_the_resolver_makes_no_false_links_across_the_whole_real_night():
    """
    The traps are all in the universe — Target, Gap, Visa, Key, Match, C3.ai — and the feed is full
    of the words "target price", "the gap between", "visa applications" and "AI". Not one of them may
    become a ticker chip on a card.

    Every link the resolver DOES make on this night is checked by eye in the evidence table
    (docs/nc-evidence/n4-newsdesk.md); there are four, and all four are real mentions.
    """
    night = _night()
    linked = {t for cluster in night.clusters for t in cluster.tickers}

    assert "TGT" not in linked, "'target price' became Target Corporation"
    assert "GPS" not in linked, "'the gap between' became Gap Inc."
    assert "V" not in linked, "'visa applications' became Visa Inc."
    assert "AI" not in linked, "the AI theme became C3.ai"
    assert "KEY" not in linked and "MTCH" not in linked

    # …and it is not silent: it found the companies that are genuinely named.
    assert {"NVDA", "TSM", "AAPL", "CRM"} <= linked


def test_the_stage_a_cap_is_a_stated_cut_not_a_hidden_one():
    """
    Beyond the cap a cluster is still ingested, still ranked, still on the page — it simply has no
    narrative line. The count is recorded so the night can say what it did not read.
    """
    night = _night()

    assert len(night.stage_a_clusters) == STAGE_A_CLUSTER_CAP
    assert night.stage_a_capped == len(night.clusters) - STAGE_A_CLUSTER_CAP
    assert night.stage_a_capped > 0, "the recorded night is big enough to exercise the cap"


def test_every_story_the_narrator_writes_about_has_actually_been_READ():
    """
    THE INVARIANT THE FIRST CAP BROKE, measured on the recorded night: 8 of the 20 stories Stage B
    was asked to narrate were never read by Stage A — and they were the eight biggest stories of the
    night, the entire Gulf/Hormuz/oil cluster.

    The old cap ranked what to extract by corroboration and then by ticker-move magnitude. On this
    feed both are near-constant (corroboration is 1 for 131 of 134 clusters; magnitude is 0 for the
    ~130 that name no company), so a single-source macro story — which is what a market-wide event
    IS — sorted to the very bottom of the extraction queue while sitting at the top of the page.

    The narrator would have written the front page's most important lines from a headline and nothing
    else, and the failure would have been invisible: an unread story produces an honest null, and a
    null prints nothing.

    The guarantee is now structural rather than lucky: both caps rank by significance, so the
    narrated set is a SUBSET of the extracted set by construction, at any cap sizes.
    """
    night = _night()

    extracted = {cluster.id for cluster in night.stage_a_clusters}
    narrated = [cluster.id for cluster in night.stage_b_clusters]

    assert narrated, "the recorded night must actually have stories to narrate"
    unread = [cluster_id for cluster_id in narrated if cluster_id not in extracted]
    assert unread == [], f"{len(unread)} narrated stories were never read by the extractor"


def test_every_cluster_carries_a_sector_even_when_it_is_broad_market():
    """"Broad market" is an answer, not a failure to classify — and most of this night IS macro."""
    night = _night()

    assert all(cluster.sectors for cluster in night.clusters)
    assert any("Broad market" in cluster.sectors for cluster in night.clusters)


def test_the_order_is_stable_across_runs():
    """A front page that reshuffled between two identical runs would be a front page nobody could
    cite, and the VRT baselines would flap forever."""
    first = [c.id for c in _night().clusters]
    second = [c.id for c in _night().clusters]

    assert first == second
