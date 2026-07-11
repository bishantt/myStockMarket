"""
Tests for the Alpaca adapter (plan P1 step 2), driven entirely by recorded fixtures — no live key.

The fixtures in adapters/fixtures/alpaca/ are real Alpaca responses captured once (bars.json,
assets.json). These tests assert that the adapter parses that real shape correctly and applies
the universe rules from Appendix F: US common stocks + ETFs, no OTC.
"""

from datetime import date

import httpx
import pytest

from adapters.alpaca import AlpacaAdapter
from adapters.base import load_fixture


class NullLimiter:
    """A no-op limiter — rate limiting is tested separately (test_rate_limiter.py)."""

    def acquire(self) -> None:
        pass


def _adapter(handler) -> AlpacaAdapter:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return AlpacaAdapter(client, NullLimiter())


def _serve_fixtures(request: httpx.Request) -> httpx.Response:
    """Serve the recorded bars/assets fixtures by URL path."""
    url = str(request.url)
    if "/v2/stocks/bars" in url:
        return httpx.Response(200, json=load_fixture("alpaca", "bars"))
    if "/v2/assets" in url:
        return httpx.Response(200, json=load_fixture("alpaca", "assets"))
    return httpx.Response(404, json={"error": f"no fixture for {url}"})


class TestDailyBars:
    def test_parses_the_recorded_bars_for_each_symbol(self):
        adapter = _adapter(_serve_fixtures)
        bars = adapter.daily_bars(["AAPL", "MSFT", "SPY"], date(2026, 6, 1), date(2026, 6, 5))

        assert set(bars) == {"AAPL", "MSFT", "SPY"}
        first = bars["AAPL"][0]
        assert first.symbol == "AAPL"
        assert first.date == date(2026, 6, 1)
        assert first.open == 309.625
        assert first.high == 310.94
        assert first.low == 305.02
        assert first.close == 306.31
        assert first.volume == 49067433

    def test_the_bar_date_is_the_trading_day_not_the_utc_instant(self):
        # Alpaca timestamps a daily bar at midnight ET (04:00Z in summer); the date must be the
        # trading day, not shifted by the UTC offset.
        adapter = _adapter(_serve_fixtures)
        bars = adapter.daily_bars(["AAPL"], date(2026, 6, 1), date(2026, 6, 5))
        assert bars["AAPL"][0].date == date(2026, 6, 1)

    def test_follows_pagination_until_the_token_is_null(self):
        # First page returns a token; the adapter must fetch the next page and stop when null.
        page1 = {
            "bars": {"AAPL": [{"t": "2026-06-01T04:00:00Z", "o": 1, "h": 1, "l": 1, "c": 1, "v": 10}]},
            "next_page_token": "PAGE2",
        }
        page2 = {
            "bars": {"AAPL": [{"t": "2026-06-02T04:00:00Z", "o": 2, "h": 2, "l": 2, "c": 2, "v": 20}]},
            "next_page_token": None,
        }

        def handler(request: httpx.Request) -> httpx.Response:
            token = request.url.params.get("page_token")
            return httpx.Response(200, json=page2 if token == "PAGE2" else page1)

        adapter = _adapter(handler)
        bars = adapter.daily_bars(["AAPL"], date(2026, 6, 1), date(2026, 6, 5))
        assert [b.date for b in bars["AAPL"]] == [date(2026, 6, 1), date(2026, 6, 2)]


class TestUniverse:
    def test_keeps_us_equities_and_etfs_but_drops_otc_and_untradable(self):
        adapter = _adapter(_serve_fixtures)
        universe = adapter.list_universe()
        symbols = {a.symbol for a in universe}

        # Kept: real tradable names across NYSE/NASDAQ, and SPY (an ARCA-listed ETF).
        assert {"AAPL", "MSFT", "T", "GE", "F", "SPY"} <= symbols
        # SPY proves ARCA is included — ETFs list there and the universe is "stocks + ETFs".
        spy = next(a for a in universe if a.symbol == "SPY")
        assert spy.exchange == "ARCA"
        # Dropped: OTC names and a non-tradable NASDAQ listing.
        assert "RBTCW" not in symbols  # OTC
        assert "JCSE" not in symbols   # NASDAQ but tradable=false

    def test_never_includes_an_otc_symbol(self):
        adapter = _adapter(_serve_fixtures)
        assert all(a.exchange != "OTC" for a in adapter.list_universe())

    def test_carries_the_name_and_exchange(self):
        adapter = _adapter(_serve_fixtures)
        aapl = next(a for a in adapter.list_universe() if a.symbol == "AAPL")
        assert aapl.name == "Apple Inc. Common Stock"
        assert aapl.exchange == "NASDAQ"


def test_missing_fixture_route_surfaces_as_an_error():
    # Guards the test harness itself: an unexpected URL must fail loudly, not pass silently.
    adapter = _adapter(lambda r: httpx.Response(404))
    with pytest.raises(httpx.HTTPStatusError):
        adapter.list_universe()
