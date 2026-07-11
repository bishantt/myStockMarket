"""
marketaux.py — the Marketaux adapter: market-wide tagged news (plan P2 step 1).

Marketaux is the market-wide catalyst source: news articles already tagged with the entities they
mention and a per-entity sentiment. Where Finnhub answers "news for THIS ticker", Marketaux answers
"what is moving the tape, and which names it touches". The adapter parses articles + their tagged
symbols and does nothing else; it follows adapters.base.Adapter (rate-limited, raises on non-2xx).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from adapters.base import Adapter

_NEWS = "https://api.marketaux.com/v1/news/all"


@dataclass(frozen=True)
class TaggedEntity:
    """A symbol an article was tagged with, and Marketaux's sentiment for it (-1..1, or None)."""

    symbol: str
    sentiment: float | None


@dataclass(frozen=True)
class Article:
    """One tagged news article and the entities it mentions."""

    uuid: str
    title: str
    snippet: str
    url: str
    source: str
    published: datetime
    entities: tuple[TaggedEntity, ...]


class MarketauxAdapter(Adapter):
    """Marketaux news reader. The API token rides on the query string (no auth header)."""

    def __init__(self, client, limiter, api_token: str) -> None:
        super().__init__("marketaux", client, limiter)
        self._token = api_token

    def news(self, symbols: list[str], limit: int = 10) -> list[Article]:
        """Recent news tagged to any of `symbols`, entity-filtered so every article names a symbol
        we asked for. Sentiment and tags come straight from Marketaux — no re-scoring here."""
        payload = self.get(
            _NEWS,
            params={
                "symbols": ",".join(symbols),
                "filter_entities": "true",
                "language": "en",
                "limit": limit,
                "api_token": self._token,
            },
        ).json()
        return [_parse(item) for item in payload.get("data", [])]


def _parse(item: dict) -> Article:
    entities = tuple(
        TaggedEntity(symbol=e["symbol"], sentiment=e.get("sentiment_score"))
        for e in item.get("entities", [])
        if e.get("symbol")
    )
    # published_at is ISO 8601 with a trailing Z; normalise to an offset so fromisoformat accepts it.
    published = datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
    return Article(
        uuid=item["uuid"],
        title=item.get("title", ""),
        snippet=item.get("snippet", ""),
        url=item.get("url", ""),
        source=item.get("source", ""),
        published=published,
        entities=entities,
    )
