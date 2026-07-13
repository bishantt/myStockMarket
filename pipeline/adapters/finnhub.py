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
    """
    One article, from either of Finnhub's two news endpoints.

    `tickers` is the crux, and it is empty far more often than you would expect: the COMPANY news
    endpoint tags every article with its symbol, and the MARKET news endpoint tags none of them (0
    of 160 in the N4 recording). So a market-wide article arrives with no idea what it is about, and
    the tickers are resolved from its text against the instrument table (newsdesk/resolve.py) rather
    than taken from the provider. The empty tuple here is a real state, not a missing value.
    """

    published: datetime
    headline: str
    source: str
    url: str
    summary: str
    symbol: str
    tickers: tuple[str, ...] = ()
    # The L1 rung of the image ladder — the publisher's own photo, as the provider hands it over.
    # An empty string means this rung did not answer and the ladder falls through to og:image.
    image: str = ""
    # Finnhub's own shelf label ("top news", "business", "merger"). NOT our catalyst taxonomy, which
    # is assigned from evidence by rank.py — an outlet's CMS category is a hint, never a verdict.
    category: str = ""
    # Finnhub's article id. The market feed's `minId` filter is expressed in these.
    article_id: int = 0


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
        return [_parse(article, fallback_symbol=symbol) for article in payload]

    def market_news(self, category: str, min_id: int | None = None) -> list[NewsItem]:
        """
        The market-wide feed — the day's catalysts, not one company's (plan Part 7.3).

        `category` is Finnhub's own: "general" (the recording returns ~100 items, labeled "top news"
        or "business") or "merger" (~60). These are the Front Page's main source.

        `min_id` is a FORWARD filter, and this is worth stating plainly because the plan's ingest
        budget assumed it was a page cursor and spent a second call on it. It returns only articles
        with an id GREATER than the one given — measured: a min_id below the oldest id we held
        returned the identical 100 articles, and a min_id at the median returned 54. There is no way
        to page backwards past the newest ~100, so a night's market ingest is ONE call per category.
        What min_id is genuinely good for is asking "what has appeared since I last looked".
        """
        params: dict[str, object] = {"category": category, "token": self._key}
        if min_id is not None:
            params["minId"] = min_id

        payload = self.get(f"{_BASE}/news", params=params).json()
        return [_parse(article, fallback_symbol="") for article in payload]

    def metric(self, symbol: str) -> dict:
        """The basic-financials `metric` map for a symbol (52-week high/low, averages, ratios). A
        plain dict — the pipeline picks the fields it needs; this adapter adds no interpretation."""
        payload = self.get(
            f"{_BASE}/stock/metric", params={"symbol": symbol, "metric": "all", "token": self._key}
        ).json()
        return payload.get("metric", {})


def _parse(article: dict, *, fallback_symbol: str) -> NewsItem:
    """
    One raw Finnhub article into a NewsItem.

    `related` is a comma-separated symbol list on the company endpoint and an empty string on the
    market endpoint. It is split rather than trusted whole, and an empty one yields an empty tuple —
    which the resolver later fills in from the article's own text. The Unix timestamp becomes a real
    UTC datetime here so that nothing downstream has to guess a timezone.
    """
    related = article.get("related") or ""
    tickers = tuple(symbol.strip() for symbol in related.split(",") if symbol.strip())

    return NewsItem(
        published=datetime.fromtimestamp(article["datetime"], tz=timezone.utc),
        headline=article.get("headline", ""),
        source=article.get("source", ""),
        url=article.get("url", ""),
        summary=article.get("summary", ""),
        symbol=related or fallback_symbol,
        tickers=tickers,
        image=article.get("image", "") or "",
        category=article.get("category", "") or "",
        article_id=int(article.get("id", 0) or 0),
    )
