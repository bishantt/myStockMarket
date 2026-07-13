"""Tests for the Marketaux adapter (plan P2 step 1), from a recorded fixture — no live key."""

from datetime import datetime

import httpx

from adapters.base import load_fixture
from adapters.marketaux import MarketauxAdapter


class NullLimiter:
    def acquire(self) -> None: ...


def _adapter(handler) -> MarketauxAdapter:
    return MarketauxAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), "tok")


def test_parses_tagged_articles_with_entities():
    adapter = _adapter(lambda r: httpx.Response(200, json=load_fixture("marketaux", "news_all")))
    articles = adapter.news(["AAPL", "MSFT", "TSLA"])
    assert len(articles) > 0
    first = articles[0]
    assert first.uuid and first.title and first.url.startswith("http")
    assert isinstance(first.published, datetime)
    # Entities carry the tagged symbol and its sentiment.
    assert len(first.entities) > 0
    assert first.entities[0].symbol


def test_sends_symbols_and_token():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json={"data": []})

    _adapter(handler).news(["AAPL", "NVDA"])
    assert seen["symbols"] == "AAPL,NVDA"
    assert seen["api_token"] == "tok"
    assert seen["filter_entities"] == "true"


def test_no_data_is_an_empty_list():
    assert _adapter(lambda r: httpx.Response(200, json={"data": []})).news(["AAPL"]) == []


# ---------------------------------------------------------------------------------------------
# N4 — the market-wide tagged feed. Marketaux is the ONLY provider that names the entities in an
# article, which is why it is worth 20 of the night's calls for ~60 items.
# ---------------------------------------------------------------------------------------------


def _market_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=load_fixture("marketaux", "news_market"))


def test_parses_the_market_feed_with_the_entity_fields_the_front_page_needs():
    """Recorded with N4's own parameters — countries=us, entity-filtered, sorted by publish time."""
    articles = _adapter(_market_handler).market_news()

    assert len(articles) == 3
    first = articles[0]
    assert first.title
    assert first.source == "seekingalpha.com"
    assert first.image_url.startswith("http")
    assert first.description

    # The entity tags are the point: a symbol, the industry it belongs to, and how strongly the
    # article is actually ABOUT it. The industry feeds the deterministic sector map; the match score
    # ranks the tickers on a cluster.
    entity = first.entities[0]
    assert entity.symbol == "FSK"
    assert entity.industry == "Financial Services"
    assert entity.match_score > 100


def test_the_free_tier_returns_three_articles_per_request_and_the_meta_says_so():
    """
    The number the whole ingest budget is built on. Marketaux's free tier caps a request at THREE
    articles regardless of what exists — the recording's meta says `returned: 3` against `found:
    3,481,263`. That is why the plan spends up to 20 calls here for ~60 items, and why Finnhub (100
    items for one call) carries the bulk of the feed.
    """
    payload = load_fixture("marketaux", "news_market")

    assert payload["meta"]["returned"] == 3
    assert payload["meta"]["limit"] == 3
    assert payload["meta"]["found"] > 1_000_000


def test_the_similar_list_is_empty_in_practice_so_clustering_cannot_lean_on_it():
    """
    The plan called Marketaux's `similar` list "a free clustering hint". In the recording it is an
    empty list on every article — in this one and in the older symbol-filtered recording too.

    So it is wired up (if it ever fills, the clusterer will use it), but the clusterer must stand on
    its own evidence: the canonical URL, the headline tokens, and the resolved tickers. A hint that
    is empty in practice is not a design a clusterer may depend on.
    """
    articles = _adapter(_market_handler).market_news()

    assert all(article.similar == () for article in articles)


def test_the_n4_parameters_actually_reach_the_wire():
    """
    The parameters ARE the query — `must_have_entities` is what keeps untagged noise out of the feed,
    and a parameter that silently stopped being sent would quietly change what the Front Page is made
    of while every value assertion still passed. (This is the CPI `units=pc1` lesson, one provider
    over: the same test saved the macro board from printing an index level as an inflation rate.)
    """
    seen: dict = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=load_fixture("marketaux", "news_market"))

    _adapter(capture).market_news()

    assert seen["countries"] == "us"
    assert seen["filter_entities"] == "true"
    assert seen["must_have_entities"] == "true"
    assert seen["sort"] == "published_on"
