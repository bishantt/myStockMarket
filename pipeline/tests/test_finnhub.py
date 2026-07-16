"""Tests for the Finnhub adapter (plan P2 step 1), from recorded fixtures — no live key."""

from datetime import date, datetime, timezone

import httpx

from adapters.base import load_fixture
from adapters.finnhub import EarningsHour, FinnhubAdapter


class NullLimiter:
    def acquire(self) -> None: ...


def _adapter(handler) -> FinnhubAdapter:
    return FinnhubAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), "test-key")


def _news_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=load_fixture("finnhub", "company_news_aapl"))


def test_parses_company_news_into_records():
    news = _adapter(_news_handler).company_news("AAPL", date(2026, 6, 1), date(2026, 7, 11))
    assert len(news) > 0
    first = news[0]
    assert first.symbol == "AAPL"
    assert first.headline
    assert first.url.startswith("http")
    # The Unix timestamp became a real UTC datetime.
    assert isinstance(first.published, datetime)
    assert first.published.tzinfo == timezone.utc


def test_sends_the_symbol_and_date_window():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=[])

    _adapter(handler).company_news("MSFT", date(2026, 6, 1), date(2026, 6, 30))
    assert seen["symbol"] == "MSFT"
    assert seen["from"] == "2026-06-01"
    assert seen["to"] == "2026-06-30"
    assert seen["token"] == "test-key"


def test_parses_the_earnings_calendar_into_symbol_date_hour():
    # Finnhub answers under `earningsCalendar`; only the symbol, date and time-of-day matter here —
    # FMP supplies the consensus, this supplies the bmo/amc/dmh split it lacks (CC8).
    body = {
        "earningsCalendar": [
            {"symbol": "AAPL", "date": "2026-07-15", "hour": "amc", "epsEstimate": 1.28},
            {"symbol": "JPM", "date": "2026-07-16", "hour": "bmo", "epsEstimate": 4.1},
            {"symbol": "XYZ", "date": "2026-07-17", "hour": "", "epsEstimate": None},
        ]
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    rows = _adapter(handler).earnings_calendar(date(2026, 7, 15), date(2026, 7, 29))
    assert rows == [
        EarningsHour("AAPL", date(2026, 7, 15), "amc"),
        EarningsHour("JPM", date(2026, 7, 16), "bmo"),
        EarningsHour("XYZ", date(2026, 7, 17), ""),  # an untimed report is a real row, not a gap
    ]


def test_earnings_calendar_tolerates_an_empty_answer():
    # Finnhub returns `{}` (no key) for a window with no reports — not an error, an empty calendar.
    rows = _adapter(lambda request: httpx.Response(200, json={})).earnings_calendar(
        date(2026, 7, 15), date(2026, 7, 29)
    )
    assert rows == []


def test_metric_returns_the_metric_map():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=load_fixture("finnhub", "metric_aapl"))

    metric = _adapter(handler).metric("AAPL")
    assert "52WeekHigh" in metric


def test_empty_news_is_an_empty_list_not_an_error():
    news = _adapter(lambda r: httpx.Response(200, json=[])).company_news("AAPL", date(2026, 6, 1), date(2026, 6, 2))
    assert news == []


# ---------------------------------------------------------------------------------------------
# N4 — the market-wide feed. A DIFFERENT ENDPOINT from company news, recorded in its own right.
# ---------------------------------------------------------------------------------------------


def _market_handler(fixture: str):
    return lambda request: httpx.Response(200, json=load_fixture("finnhub", fixture))


def test_parses_the_market_wide_feed_with_the_fields_the_front_page_needs():
    """The Front Page's main source: ~100 market-wide articles, each with an image and an outlet."""
    news = _adapter(_market_handler("news_general")).market_news("general")

    assert len(news) == 100
    first = news[0]
    assert first.headline
    assert first.source in {"Reuters", "Bloomberg", "CNBC"}
    assert first.url.startswith("http")
    assert first.image.startswith("http")
    assert first.article_id > 0
    assert first.published.tzinfo is not None


def test_the_market_feed_carries_no_tickers_and_that_is_why_we_resolve_them_ourselves():
    """
    THE FINDING THAT RESHAPED N4, pinned so it cannot quietly stop being true.

    Finnhub's COMPANY news populates `related` with the symbol (20 of 20 in the recording). Its
    MARKET news does not — `related` is an empty string on all 100 general and all 60 merger items.

    That matters far more than it looks. The plan's clustering rule required "overlapping ticker
    sets" and its significance formula measures magnitude "over the linked tickers". Applied
    literally to this feed, no two articles could ever cluster (their ticker sets are both empty and
    cannot overlap) and every cluster would score the minimum. The providers do not do entity
    resolution for us on the market feed, so newsdesk/resolve.py does it — deterministically, off
    the instrument table.

    If Finnhub ever starts populating `related` here, this test fails, and that is the correct
    outcome: it means the resolver has a second opinion to reconcile with.
    """
    general = _adapter(_market_handler("news_general")).market_news("general")
    merger = _adapter(_market_handler("news_merger")).market_news("merger")

    assert all(item.tickers == () for item in general), "Finnhub market news started carrying tickers"
    assert all(item.tickers == () for item in merger)

    # …while company news does carry them. Same provider, same adapter, different endpoint.
    company = _adapter(_news_handler).company_news("AAPL", date(2026, 6, 1), date(2026, 7, 11))
    assert company[0].tickers == ("AAPL",)


def test_the_category_finnhub_returns_is_not_the_category_we_asked_for():
    """
    We ask for `category=general` and the items come back labeled "top news" or "business"; the
    merger feed comes back labeled "merger". So the field is the provider's own shelf label, an
    ingest hint and nothing more — it is never our catalyst taxonomy, which is assigned by us
    (Appendix E) from evidence rather than borrowed from an outlet's CMS.
    """
    general = _adapter(_market_handler("news_general")).market_news("general")
    merger = _adapter(_market_handler("news_merger")).market_news("merger")

    assert {item.category for item in general} == {"top news", "business"}
    assert {item.category for item in merger} == {"merger"}


def test_every_item_in_the_recorded_market_feed_carries_an_image():
    """
    Appendix A.6 recorded Finnhub's `image` as "often an empty string". On the market feed it never
    is: 160 of 160 items in the recording carry one. That does NOT retire the L2-L4 fallback ladder
    — a URL that exists can still 404, redirect to a tracking pixel, or be too small at fetch time,
    and the ladder is what makes those data rather than failures — but it does mean L1 answers for
    nearly every card, and the budget should not be sized as if it will not.
    """
    general = _adapter(_market_handler("news_general")).market_news("general")
    merger = _adapter(_market_handler("news_merger")).market_news("merger")

    assert all(item.image for item in general + merger)


def test_min_id_pages_forward_not_backward():
    """
    Measured against the provider, because the plan's ingest budget assumed the opposite and would
    have paid for a call that returns nothing new.

    The budget said "2 calls, the second with minId pagination, ~100-200 items". A minId BELOW the
    oldest id returned the identical 100 articles; a minId at the MEDIAN returned 54 — only the ones
    newer than it. So minId is a "newer than this" filter for incremental polling, not a page cursor,
    and there is no way to reach further back than the newest ~100. The budget is one call.
    """
    full = _adapter(_market_handler("news_general")).market_news("general")
    forward = _adapter(_market_handler("news_general_minid")).market_news("general", min_id=8200027)

    assert len(full) == 100
    assert len(forward) == 54, "minId no longer filters forward — re-derive the ingest budget"

    # Everything it returned is NEWER than the cursor. Nothing older came back, which is the whole
    # point: there is no page 2 to be had.
    assert all(item.article_id > 8200027 for item in forward)

    # It is very nearly a subset of the newest 100, but NOT strictly one, and the exceptions are
    # instructive rather than noise. Five of the 54 are absent from page 1: two carry ids above page
    # 1's maximum (articles that published in the seconds BETWEEN the two recorded calls — a live
    # feed is not a frozen list), and three sit inside page 1's id range yet were not in it, because
    # the default call returns the newest 100 BY PUBLISH TIME while minId filters BY ID, and Finnhub
    # does not hand out ids in a strict publication order. Asserting a clean subset here would be
    # asserting a tidiness the provider does not have.
    overlap = {i.article_id for i in forward} & {i.article_id for i in full}
    assert len(overlap) == 49


def test_the_min_id_parameter_is_actually_sent():
    """A pagination parameter that never reaches the wire is a pagination parameter that does not
    exist — and the only way to see it is to look at the request."""
    seen: dict = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=load_fixture("finnhub", "news_general_minid"))

    _adapter(capture).market_news("general", min_id=8200027)

    assert seen["minId"] == "8200027"
    assert seen["category"] == "general"
