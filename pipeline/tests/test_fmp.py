"""Tests for the FMP earnings-calendar adapter (plan P2 step 1), from a recorded fixture."""

from datetime import date

import httpx

from adapters.base import load_fixture
from adapters.fmp import FmpAdapter


class NullLimiter:
    def acquire(self) -> None: ...


def _adapter(handler) -> FmpAdapter:
    return FmpAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), "key")


def test_parses_the_earnings_calendar():
    adapter = _adapter(lambda r: httpx.Response(200, json=load_fixture("fmp", "earnings_calendar")))
    events = adapter.earnings_calendar(date(2026, 7, 11), date(2026, 7, 25))
    assert len(events) > 0
    first = events[0]
    assert first.symbol
    assert isinstance(first.date, date)


def test_sends_the_window_and_key():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=[])

    _adapter(handler).earnings_calendar(date(2026, 7, 1), date(2026, 7, 14))
    assert seen["from"] == "2026-07-01"
    assert seen["to"] == "2026-07-14"
    assert seen["apikey"] == "key"
