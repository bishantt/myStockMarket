"""
Tests for catalysts.py — the catalyst matcher (plan P2 step 2, §7.2).

Covers the type classifier and the ticker + time-window join: a mover gets the most recent in-window
news tagged with it; a multi-ticker article still matches; news just outside the window does not; a
mover with no match is simply absent (the Desk renders the honest noise line for it).
"""

from datetime import date, datetime, timezone

from catalysts import NewsRecord, classify, match_catalysts


def _news(tickers, when, headline, event_type=None):
    return NewsRecord(
        tickers=tuple(tickers),
        published=when,
        headline=headline,
        source="Reuters",
        url="https://example.com/a",
        event_type=event_type,
    )


def test_classify_maps_headlines_to_catalyst_types():
    assert classify("Apple beats Q3 earnings estimates on strong iPhone sales") == "earnings"
    assert classify("Analyst upgrades Nvidia to Buy, raises price target") == "analyst"
    assert classify("Company X to acquire Company Y in $10B merger") == "m&a"
    assert classify("Acme raises full-year guidance") == "guidance"
    assert classify("Regulator opens investigation, lawsuit filed") == "legal"
    assert classify("A quiet day with nothing notable") == "other"


def test_matches_a_mover_to_its_most_recent_in_window_news():
    run = date(2026, 7, 10)
    news = [
        _news(["AAPL"], datetime(2026, 7, 10, 13, 0, tzinfo=timezone.utc), "Apple earnings beat"),
        _news(["AAPL"], datetime(2026, 7, 10, 9, 0, tzinfo=timezone.utc), "Apple morning note"),
    ]
    matched = match_catalysts({"AAPL", "MSFT"}, news, run)
    assert "AAPL" in matched
    assert matched["AAPL"].headline == "Apple earnings beat"  # the most recent one
    assert matched["AAPL"].event_type == "earnings"
    assert "MSFT" not in matched  # no news → the Desk shows the noise line


def test_multi_ticker_article_matches_each_named_mover():
    run = date(2026, 7, 10)
    news = [_news(["AAPL", "MSFT"], datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc), "Big tech partnership announced")]
    matched = match_catalysts({"AAPL", "MSFT"}, news, run)
    assert set(matched) == {"AAPL", "MSFT"}


def test_news_outside_the_window_does_not_match():
    run = date(2026, 7, 10)
    # Two days before the run — outside the default one-day window.
    news = [_news(["AAPL"], datetime(2026, 7, 8, 12, 0, tzinfo=timezone.utc), "Stale Apple news")]
    assert match_catalysts({"AAPL"}, news, run) == {}


def test_a_prefilled_event_type_wins_over_classification():
    # EDGAR filings arrive already typed (from the form); do not re-classify them.
    run = date(2026, 7, 10)
    news = [_news(["AAPL"], datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc), "Apple files 8-K", event_type="filing")]
    matched = match_catalysts({"AAPL"}, news, run)
    assert matched["AAPL"].event_type == "filing"
