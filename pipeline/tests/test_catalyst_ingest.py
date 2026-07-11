"""
Tests for catalyst_ingest.gather_catalysts (plan P2 step 2) — provider isolation and normalisation.

Uses fake adapters (no live keys): one provider raising must mark ONLY its source "down" and drop
its slice, while the others still contribute and the bundle is returned. News is normalised to the
persistence shape; the calendar is None only when no calendar source ran.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace

from catalyst_ingest import gather_catalysts


class FakeFinnhub:
    def company_news(self, symbol, start, end):
        return [SimpleNamespace(published=datetime(2026, 7, 9, 13, tzinfo=timezone.utc),
                                headline=f"{symbol} beats", url=f"https://x/{symbol}", summary="s", symbol=symbol)]


class RaisingMarketaux:
    def news(self, symbols, limit):
        raise RuntimeError("marketaux 402 payment required")


class FakeFmp:
    def earnings_calendar(self, start, end):
        return [SimpleNamespace(symbol="AAPL", date=date(2026, 7, 15), eps_estimate=1.28, revenue_estimate=None)]


class FakeFred:
    def release_calendar(self, start, end):
        return [SimpleNamespace(release_id=101, name="FOMC Press Release", date=date(2026, 7, 16))]


def test_one_provider_down_degrades_only_its_source():
    bundle = gather_catalysts(
        ["SMCI", "GME"], date(2026, 7, 9),
        finnhub=FakeFinnhub(), marketaux=RaisingMarketaux(), fmp=FakeFmp(), fred=FakeFred(),
    )
    assert bundle.source_status == {"finnhub": "ok", "marketaux": "down", "fmp": "ok"}
    # Finnhub news came through, normalised to the persistence shape.
    assert {n["provider"] for n in bundle.news_items} == {"finnhub"}
    assert bundle.news_items[0]["tickers"] == ["SMCI"]
    # The calendar ran (fmp + fred), and the FOMC release is classified "fed".
    kinds = {e["kind"] for e in bundle.calendar_events}
    assert kinds == {"earnings", "fed"}


def test_calendar_is_none_when_no_calendar_source_ran():
    bundle = gather_catalysts(["SMCI"], date(2026, 7, 9), finnhub=FakeFinnhub(), marketaux=None, fmp=None, fred=None)
    assert bundle.calendar_events is None  # publish leaves the existing calendar untouched
    assert bundle.source_status == {"finnhub": "ok"}
