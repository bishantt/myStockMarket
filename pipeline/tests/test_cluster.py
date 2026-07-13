"""
Tests for clustering (plan 7.4, amended by what the recording showed).

The near-miss cases are the ones that matter: a wrongly MERGED cluster prints two unrelated headlines
under one card with one set of tickers, which is a fabricated connection — precisely the thing this
app exists not to do. So every test that expects two clusters is a test against invention.
"""

from datetime import datetime, timedelta, timezone

from newsdesk.cluster import (
    JACCARD_MIN,
    Item,
    canonical_url,
    cluster_items,
    jaccard,
    same_story,
    tokens,
)

NOW = datetime(2026, 7, 13, 18, 0, tzinfo=timezone.utc)


def item(id_: str, headline: str, *, source="Reuters", url=None, tickers=(), minutes=0, **kw) -> Item:
    return Item(
        id=id_,
        url=url if url is not None else f"https://example.com/{id_}",
        headline=headline,
        source=source,
        published=NOW + timedelta(minutes=minutes),
        tickers=tickers,
        **kw,
    )


# --------------------------------------------------------------------------------------------
# The pieces
# --------------------------------------------------------------------------------------------


def test_canonical_url_strips_the_campaign_that_delivered_the_article():
    """Two links to one article, differing only by the campaign, are one article."""
    a = canonical_url("https://www.reuters.com/markets/oil-up/?utm_source=twitter&utm_campaign=x")
    b = canonical_url("https://reuters.com/markets/oil-up#section")
    assert a == b == "https://reuters.com/markets/oil-up"


def test_tokens_drop_the_stapled_source_and_the_ticker_and_the_stopwords():
    assert tokens("Oil prices rise as tensions flare - Reuters") == frozenset(
        {"oil", "prices", "rise", "tensions", "flare"}
    )
    # The exchange-qualified ticker is a link, not a word about the story.
    assert "nasdaq" not in tokens("Apple (NASDAQ: AAPL) beats estimates")


def test_two_empty_headlines_are_not_similar_they_are_unknown():
    assert jaccard(frozenset(), frozenset()) == 0.0


# --------------------------------------------------------------------------------------------
# The rule
# --------------------------------------------------------------------------------------------


def test_the_same_article_reached_two_ways_is_one_story():
    a = item("a", "Oil jumps", url="https://x.com/story?utm_source=a")
    b = item("b", "Completely different words here", url="https://x.com/story")
    assert same_story(a, b)


def test_marketaux_similar_is_honoured_when_it_ever_arrives():
    """Empty in every recording this repo holds. Wired anyway; depended on never."""
    a = item("a", "Something", uuid="uuid-a")
    b = item("b", "Something else entirely", similar=("uuid-a",))
    assert same_story(a, b)


def test_two_wires_on_one_gulf_story_cluster_with_no_tickers_between_them():
    """
    THE AMENDMENT, IN ONE TEST.

    Neither article carries a ticker — Finnhub's market feed never does. Under the plan's literal
    rule ("Jaccard >= 0.55 AND overlapping ticker sets") these two could never merge, because two
    empty sets do not overlap, and the Front Page would print the same story twice under two
    mastheads. They agree strongly on their words, so they merge.
    """
    a = item("a", "Iran widens attacks on US bases in Gulf, Hormuz tensions lift oil prices")
    b = item("b", "Iran widens attacks on US Gulf bases as Hormuz tensions lift oil prices",
             source="Bloomberg", minutes=20)
    assert same_story(a, b)


def test_the_threshold_finds_every_true_merge_in_the_recorded_night():
    """
    THE THRESHOLD IS MEASURED, AND THIS IS THE MEASUREMENT. Every pair here is a genuine same-story
    pair from the real recorded feed, and the plan's original 0.55 bar missed all of them — it
    clustered NOTHING across 134 real articles, because `acquires` and `acquisition` are different
    tokens and real headlines simply do not agree that strongly.
    """
    # A wire and an aggregator on one acquisition. Scores 0.50 — under the plan's bar, over ours.
    assert same_story(
        item("a", "VitalHub acquires Buddy Healthcare", source="SeekingAlpha", tickers=("VHI",)),
        item("b", "VitalHub Announces Acquisition of Buddy Healthcare", source="GlobeNewswire",
             tickers=("VHI",), minutes=5),
    )

    # One newsroom rewriting its own headline an hour later.
    assert same_story(
        item("c", "Trump says US agreed to Iran's request to continue talks, but ceasefire is off"),
        item("d", "Iran has asked to continue talks and the US agreed, Trump says - Reuters", minutes=60),
    )

    # A deal approval and its follow-up.
    assert same_story(
        item("e", "Baker Hughes wins E.U. approval for Chart Industries deal after LNG tech divestiture",
             source="SeekingAlpha"),
        item("f", "Baker Hughes set to win conditional E.U. approval for Chart Industries deal",
             source="SeekingAlpha", minutes=45),
    )


def test_the_threshold_refuses_the_fabrication_that_lives_0_05_below_it():
    """
    THE OTHER SIDE OF THE PIN, AND THE REASON THIS NUMBER IS NOT A MATTER OF TASTE.

    Drop the bar from 0.45 to 0.40 and these three merge into a single cluster — three different
    companies, three different deals, one card, one set of tickers, one headline standing for all of
    them. They collapse because every one of them contains the phrase "jumps after report of takeover
    interest". That is a fabricated connection presented as a fact, and it is what the Front Page
    exists not to do.

    They are ticker-less here on purpose: this is what the words alone would have done. (Once the
    resolver names Qiagen and Conmed, the ticker veto refuses them a second time — two independent
    guards, which is what you want protecting an invention.)
    """
    qiagen = item("q", "Qiagen jumps after report of takeover interest from EQT, Advent",
                  source="SeekingAlpha")
    conmed = item("c", "Conmed jumps after report of takeover interest", source="SeekingAlpha", minutes=10)
    tiny = item("t", "Tiny Ltd. jumps on report of takeover interest for Letterboxd",
                source="SeekingAlpha", minutes=20)

    assert not same_story(qiagen, conmed)
    assert not same_story(conmed, tiny)
    assert not same_story(qiagen, tiny)

    assert len(cluster_items([qiagen, conmed, tiny])) == 3


def test_named_companies_that_disagree_are_never_merged_however_alike_the_words():
    """
    The ticker veto. These two headlines are nearly the same string and are about different
    companies; a text-similarity rule on its own would merge them without hesitation.
    """
    apple = item("a", "Apple beats on revenue and lifts guidance", tickers=("AAPL",))
    microsoft = item("m", "Microsoft beats on revenue and lifts guidance", tickers=("MSFT",), minutes=30)

    # The words alone clear the bar comfortably — 0.67 against a 0.45 threshold. Only the veto
    # stands between this pair and one card claiming Apple's results were Microsoft's.
    assert jaccard(tokens(apple.headline), tokens(microsoft.headline)) > JACCARD_MIN
    assert not same_story(apple, microsoft)


def test_same_tickers_different_stories_stay_apart():
    """
    The near-miss the ticker rule exists for. Both are about Apple; they are not the same story, and
    a card merging them would say Apple's earnings beat WAS the antitrust ruling.
    """
    a = item("a", "Apple beats on iPhone revenue in the December quarter", tickers=("AAPL",))
    b = item("b", "Apple loses antitrust appeal in the European Union", tickers=("AAPL",))
    assert not same_story(a, b)


def test_the_same_story_a_week_apart_is_two_events():
    a = item("a", "Nvidia lifts data center guidance sharply", tickers=("NVDA",))
    b = item("b", "Nvidia lifts data center guidance sharply", tickers=("NVDA",), minutes=60 * 24 * 7)
    assert not same_story(a, b)


def test_the_36_hour_boundary_is_where_the_plan_put_it():
    base = item("a", "Nvidia lifts data center guidance sharply", tickers=("NVDA",))
    inside = item("b", "Nvidia lifts data center guidance sharply", tickers=("NVDA",), minutes=35 * 60)
    outside = item("c", "Nvidia lifts data center guidance sharply", tickers=("NVDA",), minutes=37 * 60)

    assert same_story(base, inside)
    assert not same_story(base, outside)


def test_one_side_naming_a_company_and_the_other_naming_none_can_still_merge():
    """
    The veto needs BOTH sides to name companies before it can find them in conflict. Where one
    article names a company and the other names none, there is no contradiction to act on — only a
    gap — so the words decide, at the same measured bar as everything else. This is the common case
    on a feed where most items carry no tickers at all.
    """
    a = item("a", "Chip stocks slide on new export controls", tickers=("NVDA",))
    b = item("b", "Chip stocks slide on export controls")

    assert same_story(a, b)


# --------------------------------------------------------------------------------------------
# The whole night
# --------------------------------------------------------------------------------------------


def test_a_night_of_articles_becomes_the_stories_that_are_actually_there():
    items = [
        item("r1", "Iran widens attacks on US bases in Gulf, Hormuz tensions lift oil prices"),
        item("b1", "Iran widens attacks on US Gulf bases as Hormuz tensions lift oil prices",
             source="Bloomberg", minutes=15),
        item("c1", "Apple beats on iPhone revenue", source="CNBC", tickers=("AAPL",)),
        item("r2", "Apple beats on iPhone revenue in the quarter", source="Reuters",
             tickers=("AAPL",), minutes=30),
        item("g1", "VitalHub acquires Buddy Healthcare", source="GlobeNewswire", tickers=("VHI",)),
    ]

    clusters = cluster_items(items)

    assert len(clusters) == 3
    sizes = sorted(len(c.members) for c in clusters)
    assert sizes == [1, 2, 2]


def test_a_clusters_id_is_stable_as_later_articles_join_it():
    """
    The id is the sha1 of the SEED's canonical url — the earliest article from the best-corroborated
    outlet. A story that grows overnight must keep its id, or the reader's link to it breaks and the
    story becomes a new story every evening.
    """
    first_night = [item("r1", "Iran widens attacks on US bases in Gulf, Hormuz tensions lift oil prices")]
    second_night = first_night + [
        item("b1", "Iran widens attacks on US Gulf bases as Hormuz tensions lift oil prices",
             source="Bloomberg", minutes=15),
    ]

    assert cluster_items(first_night)[0].id == cluster_items(second_night)[0].id


def test_a_cluster_counts_independent_outlets_not_articles():
    """Two wires carrying one announcement are one source. The card must not say "2 sources"."""
    items = [
        item("g1", "VitalHub acquires Buddy Healthcare", source="GlobeNewswire", tickers=("VHI",)),
        item("g2", "VitalHub Announces Acquisition of Buddy Healthcare", source="BusinessWire",
             tickers=("VHI",), minutes=5),
    ]
    clusters = cluster_items(items)

    assert len(clusters) == 1
    assert len(clusters[0].members) == 2
    assert clusters[0].sources == 1


def test_the_representative_headline_is_the_earliest_from_the_best_corroborated_outlet():
    items = [
        item("late", "Oil prices climb as Gulf tensions escalate sharply", source="Bloomberg", minutes=90),
        item("early", "Oil prices climb as Gulf tensions escalate", source="Reuters", minutes=0),
    ]
    clusters = cluster_items(items)

    assert clusters[0].headline == "Oil prices climb as Gulf tensions escalate"
    assert clusters[0].first_seen == NOW


def test_cluster_ticker_order_is_stable_and_by_mention_count():
    items = [
        item("a", "Nvidia and AMD both rally on the AI trade", tickers=("NVDA", "AMD")),
        item("b", "Nvidia and AMD rally again on the AI trade", tickers=("NVDA",), minutes=10,
             source="Bloomberg"),
    ]
    clusters = cluster_items(items)
    assert clusters[0].tickers == ("NVDA", "AMD")
