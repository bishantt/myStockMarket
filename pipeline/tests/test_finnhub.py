"""Tests for the Finnhub adapter (plan P2 step 1), from recorded fixtures — no live key."""

from datetime import date, datetime, timezone

import httpx

from adapters.base import load_fixture
from adapters.finnhub import FinnhubAdapter


class NullLimiter:
    def acquire(self) -> None: ...


def _adapter(handler) -> FinnhubAdapter:
    return FinnhubAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), "test-key")


def _news_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=load_fixture("finnhub", "company_news_aapl"))


def test_parses_company_news_into_records():
    news = _adapter(_news_handler).company_news("AAPL", date(2026, 6, 1), date(2026, 7, 11))
    assert len(news) > 0
    first = news[0]
    assert first.symbol == "AAPL"
    assert first.headline
    assert first.url.startswith("http")
    # The Unix timestamp became a real UTC datetime.
    assert isinstance(first.published, datetime)
    assert first.published.tzinfo == timezone.utc


def test_sends_the_symbol_and_date_window():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=[])

    _adapter(handler).company_news("MSFT", date(2026, 6, 1), date(2026, 6, 30))
    assert seen["symbol"] == "MSFT"
    assert seen["from"] == "2026-06-01"
    assert seen["to"] == "2026-06-30"
    assert seen["token"] == "test-key"


def test_metric_returns_the_metric_map():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=load_fixture("finnhub", "metric_aapl"))

    metric = _adapter(handler).metric("AAPL")
    assert "52WeekHigh" in metric


def test_empty_news_is_an_empty_list_not_an_error():
    news = _adapter(lambda r: httpx.Response(200, json=[])).company_news("AAPL", date(2026, 6, 1), date(2026, 6, 2))
    assert news == []
