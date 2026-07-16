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

# Finnhub's own time-of-day codes we keep. Anything else — an empty string, an unknown value — leaves
# the report untimed, which renders nothing (P9).
_EARNINGS_HOURS = frozenset({"bmo", "amc", "dmh"})


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
            window_end = run_date + timedelta(days=_CALENDAR_AHEAD_DAYS)
            # FMP owns the dates + consensus; Finnhub times each report (CC8). The hour lookup is
            # best-effort and isolated — a Finnhub outage leaves earnings untimed, it never marks
            # FMP down, because FMP's own answer arrived intact.
            hours = _earnings_hours(finnhub, run_date, window_end)
            for event in fmp.earnings_calendar(run_date, window_end):
                calendar.append(_fmp_event(event, timing=hours.get((event.symbol, event.date))))
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

    # Collapse duplicate rows before they reach the Desk (D7). FRED posts ONE release under several
    # series, so CPI appeared TWICE on the same date in production; select_releases de-dupes only on
    # (release_id, date), and two different ids for the same release code slip past it. The reader
    # identity of a calendar row is (code, date, symbol) — the chip, the day, the name — so that is
    # the key the assembly de-dupes on.
    calendar = _dedupe_calendar(calendar)

    # Only replace the calendar if a calendar source actually ran; otherwise leave it untouched.
    return CatalystBundle(news_items=news, calendar_events=calendar if calendar_ran else None, source_status=status)


def _dedupe_calendar(calendar: list[dict]) -> list[dict]:
    """Drop rows that repeat a (code, date, symbol) identity, keeping the first (stable order).

    That triple is the row as the Desk renders it, so two rows sharing it are one event told twice —
    whatever their upstream provenance (two FRED series for one CPI print, an FMP earnings row that
    arrived twice). Two genuinely different events — a different symbol, a different chip code, or a
    different day — share no key and both survive.
    """
    seen: set[tuple] = set()
    out: list[dict] = []
    for event in calendar:
        key = (event.get("code"), event.get("date"), event.get("symbol"))
        if key in seen:
            continue
        seen.add(key)
        out.append(event)
    return out


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


def _earnings_hours(finnhub: Any | None, start: date, end: date) -> dict[tuple[str, date], str]:
    """Finnhub's before-open / after-close split for the window, keyed by (symbol, date) (CC8).

    Best-effort by design: a Finnhub outage returns an empty map and every earnings row stays
    untimed (P9 — a null renders nothing), it never fails the calendar the times decorate. Only the
    three real codes (bmo/amc/dmh) are kept; an empty or unknown `hour` is dropped, so it too stays
    untimed rather than printing a value the Desk cannot explain."""
    if finnhub is None:
        return {}
    try:
        entries = finnhub.earnings_calendar(start, end)
    except Exception as error:  # noqa: BLE001 — earnings stay untimed; the calendar does not fail
        print(f"catalysts: finnhub earnings hours down ({error}); earnings stay untimed")
        return {}
    return {(e.symbol, e.date): e.hour for e in entries if e.hour in _EARNINGS_HOURS}


def _fmp_event(event: Any, *, timing: str | None) -> dict:
    return {
        "date": event.date,
        "kind": "earnings",
        "symbol": event.symbol,
        # Finnhub's bmo/amc/dmh when it timed this report, else None — untimed renders nothing (P9).
        "timing": timing,
        "title": f"{event.symbol} earnings",
        "consensus": event.eps_estimate,
        "prior": None,
        "importance": earnings_importance(event.symbol),
        "code": "EARNINGS",
    }


def _fred_event(release: Any, entry: Release) -> dict:
    """Map one allowlisted FRED release onto the calendar's row shape. Every field the Desk renders —
    the chip code, the title, the importance, the release time — comes from the allowlist table,
    never from the raw FRED name, so the calendar speaks one vocabulary (redesign §6.2, Appendix C)."""
    return {
        "date": release.date,
        "kind": entry.kind,
        "symbol": None,
        # The canonical ET release time, a scheduled convention rather than a feed stamp (CC8).
        "timing": entry.time_et,
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
