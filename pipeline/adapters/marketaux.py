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
    """
    A symbol an article was tagged with, plus what Marketaux knows about the tag.

    `industry` is the raw provider string ("Financial Services", "Consumer Cyclical") and feeds the
    fixed sector map in newsdesk/taxonomy.py — it is never rendered as-is, because it is Marketaux's
    vocabulary and the app has its own closed set.

    `match_score` is how strongly the article is actually ABOUT this entity rather than merely
    mentioning it, and it is what ranks the tickers on a cluster.
    """

    symbol: str
    sentiment: float | None
    industry: str | None = None
    match_score: float | None = None
    # The company Marketaux believes this symbol IS. Carried so the ingest can cross-check it against
    # our own instrument table: a provider's symbol refers to the provider's exchange, and "VHI" is
    # VitalHub on the TSX and Valhi Inc. on the NYSE. Without the name, that collision is invisible.
    name: str | None = None


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
    # The L1 image rung, as Marketaux hands it over.
    image_url: str = ""
    # The article's own standfirst — longer than the snippet, and what Stage A reads.
    description: str = ""
    # Marketaux's list of articles it thinks cover the same story. The plan called this "a free
    # clustering hint"; in every recording this repo holds it is EMPTY. It is wired through so the
    # clusterer can use it if it ever fills, and the clusterer does not depend on it.
    similar: tuple[str, ...] = ()


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

    def market_news(self, page: int = 1) -> list[Article]:
        """
        The market-wide tagged feed — every US-listed catalyst Marketaux has entity-tagged today
        (plan Part 7.3).

        The parameters ARE the query, and each one is load-bearing: `must_have_entities` keeps
        untagged noise out (an article we cannot link to anything cannot be ranked), `countries=us`
        keeps it to our universe, and `sort=published_on` makes the feed a chronology rather than
        whatever the provider considers interesting — the Front Page is edited by evidence, and
        letting a vendor's relevance score choose our order would be letting it edit the page.

        The free tier returns THREE articles per request no matter what is asked for, which is why a
        night spends up to 20 calls here (~60 items) while Finnhub's 100 arrive in one.
        """
        payload = self.get(
            _NEWS,
            params={
                "countries": "us",
                "filter_entities": "true",
                "must_have_entities": "true",
                "sort": "published_on",
                "language": "en",
                "page": page,
                "api_token": self._token,
            },
        ).json()
        return [_parse(item) for item in payload.get("data", [])]


def _parse(item: dict) -> Article:
    entities = tuple(
        TaggedEntity(
            symbol=e["symbol"],
            sentiment=e.get("sentiment_score"),
            industry=e.get("industry"),
            match_score=e.get("match_score"),
            name=e.get("name"),
        )
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
        image_url=item.get("image_url", "") or "",
        description=item.get("description", "") or "",
        similar=tuple(item.get("similar") or ()),
    )
