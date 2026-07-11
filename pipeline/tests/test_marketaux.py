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
