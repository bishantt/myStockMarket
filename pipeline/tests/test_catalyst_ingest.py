"""
Tests for catalyst_ingest.gather_catalysts (plan P2 step 2) — provider isolation and normalisation,
plus the redesign's calendar curation (UI-REDESIGN-PLAN §6.2).

Uses fake adapters (no live keys): one provider raising must mark ONLY its source "down" and drop
its slice, while the others still contribute and the bundle is returned. News is normalised to the
persistence shape; the calendar is None only when no calendar source ran.

The calendar half of this file is the regression lock on Bug 2: the ingest may only write releases
the allowlist recognises, each carrying the chip code and the importance the Desk renders.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace

from adapters.finnhub import EarningsHour
from adapters.fred import ReleaseDate
from catalyst_ingest import gather_catalysts


class FakeFinnhub:
    def company_news(self, symbol, start, end):
        return [SimpleNamespace(published=datetime(2026, 7, 9, 13, tzinfo=timezone.utc),
                                headline=f"{symbol} beats", url=f"https://x/{symbol}", summary="s", symbol=symbol)]

    def earnings_calendar(self, start, end):
        # Times AAPL's report (the one FakeFmp schedules) after the close; leaves an unknown one blank.
        return [EarningsHour("AAPL", date(2026, 7, 15), "amc"), EarningsHour("ZZZZ", date(2026, 7, 20), "")]


class RaisingMarketaux:
    def news(self, symbols, limit):
        raise RuntimeError("marketaux 402 payment required")


class FakeFmp:
    def earnings_calendar(self, start, end):
        return [SimpleNamespace(symbol="AAPL", date=date(2026, 7, 15), eps_estimate=1.28, revenue_estimate=None)]


class FakeFred:
    """A realistic FRED window: two real catalysts, and the daily noise that used to reach the Desk."""

    def release_calendar(self, start, end):
        return [
            ReleaseDate(release_id=441, name="Coinbase Cryptocurrencies", date=date(2026, 7, 13)),
            ReleaseDate(release_id=10, name="Consumer Price Index", date=date(2026, 7, 14)),
            ReleaseDate(release_id=86, name="Commercial Paper", date=date(2026, 7, 14)),
            ReleaseDate(release_id=101, name="FOMC Press Release", date=date(2026, 7, 16)),
            ReleaseDate(release_id=101, name="FOMC Press Release", date=date(2026, 7, 16)),  # a repeat
        ]


def _calendar_of(bundle, kind: str) -> list[dict]:
    return [e for e in bundle.calendar_events if e["kind"] == kind]


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
    assert kinds == {"earnings", "fed", "macro"}


def test_calendar_is_none_when_no_calendar_source_ran():
    bundle = gather_catalysts(["SMCI"], date(2026, 7, 9), finnhub=FakeFinnhub(), marketaux=None, fmp=None, fred=None)
    assert bundle.calendar_events is None  # publish leaves the existing calendar untouched
    assert bundle.source_status == {"finnhub": "ok"}


# ── the calendar is curated, not dumped (redesign §6.2) ───────────────────────────────────────

def test_only_allowlisted_releases_reach_the_calendar():
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=FakeFred())
    titles = [e["title"] for e in bundle.calendar_events]
    assert "Consumer Price Index" in titles
    assert "FOMC decision" in titles
    # The firehose stays out.
    assert not any(t in titles for t in ("Coinbase Cryptocurrencies", "Commercial Paper"))


def test_a_release_repeated_on_one_date_is_written_once():
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=FakeFred())
    fomc = _calendar_of(bundle, "fed")
    assert len(fomc) == 1


class DuplicateCpiFred:
    """The D7 production shape: FRED posted CPI under two DIFFERENT release_ids on one date. Because
    select_releases de-dupes only on (release_id, date), both survived it — and the Desk showed CPI
    twice on Jul 14. The same-id repeat that FakeFred models is caught upstream; this one is not."""

    def release_calendar(self, start, end):
        return [
            ReleaseDate(release_id=10, name="Consumer Price Index", date=date(2026, 7, 14)),
            ReleaseDate(release_id=733, name="Consumer Price Index", date=date(2026, 7, 14)),
        ]


def test_the_same_code_under_two_release_ids_on_one_date_is_written_once():
    """D7. Two different release_ids both map to the CPI chip on the same day; select_releases keeps
    both. The assembly now de-dupes on the row's reader identity (code, date, symbol), so exactly one
    CPI reaches the Desk. RED before _dedupe_calendar; GREEN after."""
    bundle = gather_catalysts(
        [], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=DuplicateCpiFred()
    )
    cpi = [e for e in bundle.calendar_events if e["code"] == "CPI"]
    assert len(cpi) == 1


def test_every_release_row_carries_its_chip_code_and_importance():
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=FakeFred())
    by_code = {e["code"]: e for e in bundle.calendar_events}
    assert by_code["CPI"]["importance"] == "high"
    assert by_code["CPI"]["kind"] == "macro"
    assert by_code["FOMC"]["importance"] == "high"
    assert by_code["FOMC"]["kind"] == "fed"


def test_no_dropped_release_is_written_as_an_empty_row():
    # The old loop appended unconditionally. A filtered-out release must vanish, never become a None.
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=FakeFred())
    assert all(e is not None and e["title"] for e in bundle.calendar_events)
    assert len(bundle.calendar_events) == 2  # CPI + FOMC, and nothing else


def test_earnings_rows_carry_the_earnings_chip_code():
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=FakeFmp(), fred=None)
    [earnings] = _calendar_of(bundle, "earnings")
    assert earnings["code"] == "EARNINGS"


# ── event times (CC8): earnings from Finnhub's hour, macro from the allowlist's convention ───────

def test_an_earnings_row_gains_finnhubs_time_of_day():
    # FMP schedules AAPL on Jul 15; Finnhub says it reports after the close. The row carries "amc".
    bundle = gather_catalysts(
        [], date(2026, 7, 9), finnhub=FakeFinnhub(), marketaux=None, fmp=FakeFmp(), fred=None
    )
    [earnings] = _calendar_of(bundle, "earnings")
    assert earnings["timing"] == "amc"


def test_an_earnings_row_finnhub_does_not_time_stays_untimed():
    # No Finnhub adapter at all — the calendar still runs on FMP, and the report renders no time (P9).
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=FakeFmp(), fred=None)
    [earnings] = _calendar_of(bundle, "earnings")
    assert earnings["timing"] is None


def test_a_finnhub_earnings_outage_leaves_the_calendar_intact_and_untimed():
    # Finnhub's earnings endpoint raising must NOT mark FMP down — FMP's own answer arrived. The row
    # is simply untimed, and fmp stays "ok".
    class RaisingEarnings(FakeFinnhub):
        def earnings_calendar(self, start, end):
            raise RuntimeError("finnhub 429 rate limit")

    bundle = gather_catalysts(
        [], date(2026, 7, 9), finnhub=RaisingEarnings(), marketaux=None, fmp=FakeFmp(), fred=None
    )
    [earnings] = _calendar_of(bundle, "earnings")
    assert earnings["timing"] is None
    assert bundle.source_status["fmp"] == "ok"


def test_a_macro_release_carries_its_canonical_et_time():
    # The 8:30-and-2:00 convention reaches the row (CC8) — a scheduled time, not a fetched one.
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=None, fred=FakeFred())
    by_code = {e["code"]: e for e in bundle.calendar_events}
    assert by_code["CPI"]["timing"] == "8:30 AM ET"
    assert by_code["FOMC"]["timing"] == "2:00 PM ET"


def test_a_company_outside_the_served_core_reports_at_medium_importance():
    # The plan's heuristic (Appendix E-4): high only for the pipeline's served core. That core is
    # today the index ETFs and the sector SPDRs, so a single company's report — AAPL included —
    # renders medium. The consequence is deliberate and documented: the "high" marker stays
    # reserved for the market-wide macro catalysts (CPI, jobs, FOMC).
    bundle = gather_catalysts([], date(2026, 7, 9), finnhub=None, marketaux=None, fmp=FakeFmp(), fred=None)
    [earnings] = _calendar_of(bundle, "earnings")
    assert earnings["importance"] == "medium"


def test_a_served_core_symbol_would_report_at_high_importance():
    # The other branch of the same heuristic, exercised directly so the rule is pinned even though
    # no ETF in the core actually reports earnings today.
    from catalyst_ingest import earnings_importance

    assert earnings_importance("SPY") == "high"
    assert earnings_importance("AAPL") == "medium"
