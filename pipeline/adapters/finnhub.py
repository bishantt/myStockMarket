"""
finnhub.py — the Finnhub adapter: company news + basic metrics (plan P2 step 1).

Finnhub is the per-ticker catalyst source — the news that explains why a name moved. It is NEVER
used for candles (Alpaca owns prices; plan §4.2). This adapter parses the two shapes P2 needs into
plain records and does nothing else. It follows adapters.base.Adapter, so every call is rate-limited
(Finnhub caps at 60/min) and raises on a non-2xx, letting the job degrade this one source.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

from adapters.base import Adapter

_BASE = "https://finnhub.io/api/v1"


@dataclass(frozen=True)
class NewsItem:
    """One company-news article: when it published (UTC), its headline, source, and link."""

    published: datetime
    headline: str
    source: str
    url: str
    summary: str
    symbol: str


class FinnhubAdapter(Adapter):
    """Finnhub company news + metrics. The API token rides on the query string, so it is held here
    and added to every request (Finnhub does not use an auth header)."""

    def __init__(self, client, limiter, api_key: str) -> None:
        super().__init__("finnhub", client, limiter)
        self._key = api_key

    def company_news(self, symbol: str, start: date, end: date) -> list[NewsItem]:
        """
        Company news for a symbol between start and end (inclusive), newest first as Finnhub returns.

        Finnhub timestamps each article as a Unix epoch second; it is parsed to a UTC datetime here
        so the catalyst matcher can join it to a trading day without guessing a timezone.
        """
        payload = self.get(
            f"{_BASE}/company-news",
            params={"symbol": symbol, "from": start.isoformat(), "to": end.isoformat(), "token": self._key},
        ).json()
        return [
            NewsItem(
                published=datetime.fromtimestamp(article["datetime"], tz=timezone.utc),
                headline=article.get("headline", ""),
                source=article.get("source", ""),
                url=article.get("url", ""),
                summary=article.get("summary", ""),
                symbol=article.get("related", symbol),
            )
            for article in payload
        ]

    def metric(self, symbol: str) -> dict:
        """The basic-financials `metric` map for a symbol (52-week high/low, averages, ratios). A
        plain dict — the pipeline picks the fields it needs; this adapter adds no interpretation."""
        payload = self.get(
            f"{_BASE}/stock/metric", params={"symbol": symbol, "metric": "all", "token": self._key}
        ).json()
        return payload.get("metric", {})
