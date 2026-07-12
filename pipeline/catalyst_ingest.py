"""
catalyst_ingest.py — the nightly catalyst & calendar fetch (plan P2 step 2, §2).

Gathers the news that explains the movers (Finnhub per mover + Marketaux market-wide) and the
forward calendar (FMP earnings + FRED releases), and reports each provider's health. Every provider
is wrapped independently: one being down marks ONLY its source "down" and drops its slice — the run
still succeeds and the Desk's SourceStatusFooter says which section is running without its source
(the skill's rule: the JOB catches per source, not the adapter).

gather_catalysts takes adapter instances so it is testable with fakes; build_catalyst_fetcher builds
the real adapters from settings and returns the closure run_nightly calls.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Callable

from catalyst_allowlist import Release, select_releases
from nightly import CatalystBundle
from universe import CORE_SERVED

# How many movers to pull per-ticker Finnhub news for, and how many to name in the one Marketaux
# call — the free tiers are small, and the top movers are what the Desk shows.
_FINNHUB_MOVER_LIMIT = 15
_MARKETAUX_SYMBOL_LIMIT = 10
_NEWS_WINDOW_DAYS = 3
_CALENDAR_AHEAD_DAYS = 14


def gather_catalysts(
    movers: list[str],
    run_date: date,
    *,
    finnhub: Any | None,
    marketaux: Any | None,
    fmp: Any | None,
    fred: Any | None,
) -> CatalystBundle:
    """Fetch news + calendar with per-provider isolation. A None adapter (unconfigured) is skipped
    without a status; a raising adapter is marked "down"."""
    news: list[dict] = []
    calendar: list[dict] = []
    status: dict[str, str] = {}
    calendar_ran = False
    window_start = run_date - timedelta(days=_NEWS_WINDOW_DAYS)

    if finnhub is not None:
        try:
            for symbol in movers[:_FINNHUB_MOVER_LIMIT]:
                for item in finnhub.company_news(symbol, window_start, run_date):
                    news.append(_finnhub_news(item))
            status["finnhub"] = "ok"
        except Exception as error:  # noqa: BLE001 — a source degrades, the run does not fail
            status["finnhub"] = "down"
            print(f"catalysts: finnhub down ({error})")

    if marketaux is not None and movers:
        try:
            for article in marketaux.news(movers[:_MARKETAUX_SYMBOL_LIMIT], limit=25):
                news.append(_marketaux_news(article))
            status["marketaux"] = "ok"
        except Exception as error:  # noqa: BLE001
            status["marketaux"] = "down"
            print(f"catalysts: marketaux down ({error})")

    if fmp is not None:
        try:
            for event in fmp.earnings_calendar(run_date, run_date + timedelta(days=_CALENDAR_AHEAD_DAYS)):
                calendar.append(_fmp_event(event))
            status["fmp"] = "ok"
            calendar_ran = True
        except Exception as error:  # noqa: BLE001
            status["fmp"] = "down"
            print(f"catalysts: fmp down ({error})")

    if fred is not None:
        try:
            releases = fred.release_calendar(run_date, run_date + timedelta(days=_CALENDAR_AHEAD_DAYS))
            # Curate BEFORE mapping (redesign §6.2): the allowlist works on the typed adapter rows,
            # which carry the release id the de-duplication needs. A dropped release is skipped
            # outright — it never becomes an empty row.
            selected = select_releases(releases)
            for release, entry in selected:
                calendar.append(_fred_event(release, entry))
            print(
                f"catalysts: fred calendar — kept {len(selected)} catalysts, "
                f"dropped {len(releases) - len(selected)} non-catalyst releases"
            )
            calendar_ran = True
        except Exception as error:  # noqa: BLE001 — fred's macro-series status is reported by the macro stage
            print(f"catalysts: fred calendar down ({error})")

    # Only replace the calendar if a calendar source actually ran; otherwise leave it untouched.
    return CatalystBundle(news_items=news, calendar_events=calendar if calendar_ran else None, source_status=status)


def _finnhub_news(item: Any) -> dict:
    return {
        "published_at": item.published,
        "provider": "finnhub",
        "url": item.url,
        "headline": item.headline,
        "snippet": item.summary,
        "tickers": [item.symbol],
    }


def _marketaux_news(article: Any) -> dict:
    sentiments = [e.sentiment for e in article.entities if e.sentiment is not None]
    return {
        "published_at": article.published,
        "provider": "marketaux",
        "url": article.url,
        "headline": article.title,
        "snippet": article.snippet,
        "tickers": [e.symbol for e in article.entities],
        "sentiment": sum(sentiments) / len(sentiments) if sentiments else None,
    }


def earnings_importance(symbol: str) -> str:
    """
    How loudly the calendar marks a company's earnings report (redesign Appendix E-4).

    The rule: high if the product actually serves the symbol, medium otherwise. Note what that means
    today — the served core is the index ETFs and the sector SPDRs, none of which report earnings —
    so in practice every earnings row renders "medium". That is deliberate rather than accidental:
    the "high" marker stays reserved for the market-wide catalysts (CPI, the jobs report, FOMC),
    which is what a beginner most needs to see coming. Logged in QUESTIONS-FOR-BISHANT.md.
    """
    return "high" if symbol in CORE_SERVED else "medium"


def _fmp_event(event: Any) -> dict:
    return {
        "date": event.date,
        "kind": "earnings",
        "symbol": event.symbol,
        "timing": None,
        "title": f"{event.symbol} earnings",
        "consensus": event.eps_estimate,
        "prior": None,
        "importance": earnings_importance(event.symbol),
        "code": "EARNINGS",
    }


def _fred_event(release: Any, entry: Release) -> dict:
    """Map one allowlisted FRED release onto the calendar's row shape. Every field the Desk renders —
    the chip code, the title, the importance — comes from the allowlist table, never from the raw
    FRED name, so the calendar speaks one vocabulary (redesign §6.2, Appendix C)."""
    return {
        "date": release.date,
        "kind": entry.kind,
        "symbol": None,
        "timing": None,
        "title": entry.display,
        "consensus": None,
        "prior": None,
        "importance": entry.importance,
        "code": entry.code,
    }


def build_catalyst_fetcher(settings, run_date: date) -> Callable[[list[str]], CatalystBundle]:
    """Build the real catalyst fetcher from settings — the closure run_nightly calls with the movers.
    EDGAR filings are NOT wired here yet: they need a symbol→CIK map (instrument.cik is null until a
    ticker-CIK match lands), so the P2 mover catalysts come from Finnhub + Marketaux (logged)."""
    import httpx

    from adapters.base import TokenBucket
    from adapters.finnhub import FinnhubAdapter
    from adapters.fmp import FmpAdapter
    from adapters.fred import FredAdapter
    from adapters.marketaux import MarketauxAdapter

    def fetch(movers: list[str]) -> CatalystBundle:
        finnhub = FinnhubAdapter(httpx.Client(timeout=30), TokenBucket(1.0, 1.0), settings.finnhub_key) if settings.finnhub_key else None
        marketaux = MarketauxAdapter(httpx.Client(timeout=30), TokenBucket(1.0, 1.0), settings.marketaux_key) if settings.marketaux_key else None
        fmp = FmpAdapter(httpx.Client(timeout=30), TokenBucket(2.0, 2.0), settings.fmp_key) if settings.fmp_key else None
        fred = FredAdapter(httpx.Client(timeout=30), TokenBucket(2.0, 2.0)) if settings.fred_key else None
        return gather_catalysts(movers, run_date, finnhub=finnhub, marketaux=marketaux, fmp=fmp, fred=fred)

    return fetch
