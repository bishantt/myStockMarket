"""
catalysts.py — the catalyst matcher (plan P2 step 2, §7.2, §1.5 rule 9).

A mover never renders without a catalyst check: either a chip with a source link, or the honest
"no news found — likely noise" line. This module is the matcher behind that rule. It does two
things, both pure:

  classify(headline)          — assign a coarse catalyst TYPE from the headline (earnings, analyst,
                                m&a, guidance, legal, product, other), keyword-based. The P3 LLM
                                extract refines this; at P2 a transparent keyword pass is enough.
  match_catalysts(...)        — join the day's news to the movers by TICKER and a TIME WINDOW: a
                                mover gets the most recent article, tagged with it, published within
                                the window ending on the run date. A mover with no match is absent
                                from the result, and the Desk renders the noise line for it.

The news fed in is a provider-agnostic NewsRecord, so Finnhub, Marketaux, and EDGAR all flow through
the same matcher (the job normalises each adapter's shape into NewsRecord first).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

# Catalyst-type keywords, checked in priority order — the FIRST type whose keywords appear wins, so
# "earnings guidance" reads as earnings, and a headline with several cues gets the most specific one.
_TYPE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("earnings", ("earnings", "beats", "misses", "quarterly results", "reports q", "eps", "revenue beat")),
    ("guidance", ("guidance", "outlook", "forecast", "raises full-year", "cuts full-year")),
    ("analyst", ("upgrade", "downgrade", "price target", "initiates coverage", "rating", "analyst")),
    ("m&a", ("acquire", "acquisition", "merger", "buyout", "takeover", "to buy", "to acquire")),
    ("legal", ("lawsuit", "sues", "settlement", "investigation", "sec charges", "fine", "probe")),
    ("product", ("launch", "unveils", "partnership", "deal", "contract", "approval")),
]


def classify(headline: str) -> str:
    """Assign a coarse catalyst type from a headline. Returns 'other' when no keyword group matches."""
    text = headline.lower()
    for label, keywords in _TYPE_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            return label
    return "other"


@dataclass(frozen=True)
class NewsRecord:
    """A provider-agnostic news article the matcher consumes (the job builds these from adapters)."""

    tickers: tuple[str, ...]
    published: datetime
    headline: str
    source: str
    url: str
    # Some sources arrive already typed (EDGAR filings, from the form); None means "classify me".
    event_type: str | None = None


@dataclass(frozen=True)
class Catalyst:
    """The catalyst attached to a mover: its type, the headline, and where it came from."""

    symbol: str
    event_type: str
    headline: str
    source: str
    url: str


def match_catalysts(
    movers: set[str], news: list[NewsRecord], run_date: date, window_days: int = 1
) -> dict[str, Catalyst]:
    """
    Match each mover to its most recent in-window catalyst. Returns symbol → Catalyst for the movers
    that HAVE a catalyst; a mover with none is absent (the Desk shows the noise line).

    The window is [run_date - window_days, run_date] on the article's publish date — a move on the
    run date is explained by news from that trading day or the after-hours before it. An article
    tagged with several movers matches each of them.
    """
    earliest = run_date - timedelta(days=window_days)
    best: dict[str, NewsRecord] = {}
    for article in news:
        published_day = article.published.date()
        if not (earliest <= published_day <= run_date):
            continue
        for ticker in article.tickers:
            if ticker not in movers:
                continue
            current = best.get(ticker)
            if current is None or article.published > current.published:
                best[ticker] = article

    return {
        ticker: Catalyst(
            symbol=ticker,
            event_type=article.event_type or classify(article.headline),
            headline=article.headline,
            source=article.source,
            url=article.url,
        )
        for ticker, article in best.items()
    }
