"""
Tests for the minimal FRED adapter (plan P1 step 6, §2.1 macro strip), from recorded fixtures.

At P1 the adapter reads exactly two series — VIXCLS (the VIX) and DGS10 (the 10-year yield) — for
the macro module. The full FRED adapter (release calendar, more series) arrives in P2. Fixtures are
real FRED observation responses; no live key is used.
"""

from datetime import date

import httpx
import pytest

from adapters.base import load_fixture
from adapters.fred import FredAdapter


class NullLimiter:
    def acquire(self) -> None:
        pass


def _adapter(handler) -> FredAdapter:
    return FredAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter())


def _serve_fixtures(request: httpx.Request) -> httpx.Response:
    series = request.url.params.get("series_id", "").lower()
    try:
        return httpx.Response(200, json=load_fixture("fred", series))
    except FileNotFoundError:
        return httpx.Response(404, json={"error": f"no fixture for {series}"})


def test_returns_the_latest_vix_observation():
    obs = _adapter(_serve_fixtures).latest_value("VIXCLS")
    assert obs.date == date(2026, 7, 9)
    assert obs.value == 15.84


def test_returns_the_latest_ten_year_yield():
    obs = _adapter(_serve_fixtures).latest_value("DGS10")
    assert obs.date == date(2026, 7, 9)
    assert obs.value == 4.54


def test_skips_missing_values_marked_with_a_dot():
    # FRED marks a missing observation with ".". The adapter must skip it and return the most
    # recent REAL value, not choke or return a dot. Fixtures come sorted newest-first.
    payload = {
        "observations": [
            {"date": "2026-07-10", "value": "."},        # market holiday — no value
            {"date": "2026-07-09", "value": "15.84"},    # the real latest
        ]
    }
    obs = _adapter(lambda r: httpx.Response(200, json=payload)).latest_value("VIXCLS")
    assert obs.date == date(2026, 7, 9)
    assert obs.value == 15.84


def test_raises_when_no_real_value_exists():
    payload = {"observations": [{"date": "2026-07-10", "value": "."}]}
    with pytest.raises(ValueError):
        _adapter(lambda r: httpx.Response(200, json=payload)).latest_value("VIXCLS")


def test_parses_the_release_calendar():
    from datetime import date as _date

    from adapters.fred import ReleaseDate

    adapter = _adapter(lambda r: httpx.Response(200, json=load_fixture("fred", "release_dates")))
    releases = adapter.release_calendar(_date(2026, 7, 11), _date(2026, 7, 25))
    assert len(releases) > 0
    first = releases[0]
    assert isinstance(first, ReleaseDate)
    assert first.release_id and first.name and isinstance(first.date, _date)


def test_the_release_calendar_no_longer_asks_for_no_data_release_dates():
    # Redesign §6.2: include_release_dates_with_no_data=true is what made the calendar a firehose —
    # it repeats releases across every date in the window. The allowlist filters what remains, but
    # the request itself must stop asking for the noise.
    seen: dict[str, str] = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.url.params))
        return httpx.Response(200, json={"release_dates": []})

    _adapter(capture).release_calendar(date(2026, 7, 11), date(2026, 7, 25))
    assert seen["include_release_dates_with_no_data"] == "false"


# ── index levels (redesign §6.1, Bug 1) ───────────────────────────────────────────────────────

def test_latest_two_returns_the_level_and_the_prior_level_newest_first():
    # The macro strip needs a level AND its prior level to state a one-day change honestly.
    #
    # THESE NUMBERS CHANGED IN N3, AND THE REASON IS WORTH KEEPING. Until N3 this assertion read
    # 6812.34 / 6789.10 — values that came from a fixture NOBODY EVER RECORDED. R0 hand-wrote
    # sp500.json (and nasdaqcom, and djia) in the shape of a real FRED response and filled in
    # plausible numbers, so for three phases this test proved the parser agreed with an invention.
    # N3's recorder run replaced all three with the real thing; the values below are FRED's.
    #
    # Note what the fiction had quietly erased: the index series post a day AHEAD of the VIX (the
    # S&P's newest observation is the 10th, the VIX's is the 9th). The invented fixture gave them
    # the same date, which is a property of the data that simply is not true.
    observations = _adapter(_serve_fixtures).latest_two("SP500")
    assert [o.value for o in observations] == [7575.39, 7543.64]
    assert [o.date for o in observations] == [date(2026, 7, 10), date(2026, 7, 9)]


def test_latest_two_skips_missing_values_marked_with_a_dot():
    payload = {
        "observations": [
            {"date": "2026-07-10", "value": "."},        # market holiday
            {"date": "2026-07-09", "value": "6812.34"},
            {"date": "2026-07-08", "value": "6789.10"},
        ]
    }
    observations = _adapter(lambda r: httpx.Response(200, json=payload)).latest_two("SP500")
    assert [o.value for o in observations] == [6812.34, 6789.10]


def test_latest_two_returns_what_it_has_when_only_one_real_value_exists():
    # One value is enough to show the level; the delta then renders "—" rather than being invented.
    payload = {"observations": [{"date": "2026-07-09", "value": "6812.34"}, {"date": "2026-07-08", "value": "."}]}
    observations = _adapter(lambda r: httpx.Response(200, json=payload)).latest_two("SP500")
    assert [o.value for o in observations] == [6812.34]


def test_latest_two_returns_nothing_when_the_series_has_no_real_values():
    payload = {"observations": [{"date": "2026-07-10", "value": "."}]}
    assert _adapter(lambda r: httpx.Response(200, json=payload)).latest_two("SP500") == []


# ── the macro board's series (N3, Part 6.2) ───────────────────────────────────────────────────

def test_the_mortgage_rate_reads_its_weekly_observation_and_the_week_before():
    """
    A weekly series. Its newest observation is a THURSDAY, and on any other weekday that Thursday
    rate is not stale — it is the newest thing that exists (degradation rung 2). The pair is what
    lets the cell state a week-over-week change without the app computing anything of its own.
    """
    observations = _adapter(_serve_fixtures).latest_two("MORTGAGE30US")

    assert [o.value for o in observations] == [6.49, 6.43]
    assert [o.date for o in observations] == [date(2026, 7, 9), date(2026, 7, 2)]
    assert observations[0].date.weekday() == 3  # Thursday, as Freddie Mac's survey publishes


def test_cpi_asks_fred_for_the_year_over_year_change_and_stores_what_it_publishes():
    """
    THE MOST IMPORTANT ASSERTION IN THIS FILE, and it is about a query parameter.

    CPI is fetched with `units=pc1` — the year-over-year percent change, computed BY FRED. If that
    parameter ever silently dropped off the request, FRED would answer with the raw INDEX LEVEL
    (about 320) and the board would print "Inflation (CPI YoY) 320.5%" — a number so wrong it is
    almost funny, arriving through a code path where every test still passed.

    So this checks the wire, not just the parse. The value assertion alone would not have caught it:
    a fixture recorded WITH the parameter parses just as happily whether or not the live request
    still sends it.
    """
    sent: dict[str, str] = {}

    def capture(request: httpx.Request) -> httpx.Response:
        sent.update(dict(request.url.params))
        return httpx.Response(200, json=load_fixture("fred", "cpiaucns_pc1"))

    observations = _adapter(capture).latest_two("CPIAUCNS", units="pc1")

    assert sent["units"] == "pc1"
    assert sent["series_id"] == "CPIAUCNS"
    # May 2026's print, published mid-June. FRED reports it to five decimals; the ROUNDING is the
    # app's job at render time, so the pipeline stores the source's own precision unharmed.
    assert observations[0].date == date(2026, 5, 1)
    assert observations[0].value == 4.24867


def test_the_credit_spread_series_is_alive():
    """
    BAMLH0A0HYM2 (ICE BofA US High Yield OAS) — the Mood gauge's credit component.

    The plan flagged this one for re-verification, because FRED's January 2022 purge deleted a large
    ICE family and it was not obvious from the outside which. This fixture is the answer: the purge
    took the ICE BENCHMARK ADMINISTRATION series, not the ICE BofA index family. The series is live,
    daily, and 795 observations deep.
    """
    observation = _adapter(_serve_fixtures).latest_value("BAMLH0A0HYM2")

    assert observation.date == date(2026, 7, 9)
    assert observation.value == 2.70


def test_history_returns_enough_of_a_distribution_for_a_percentile():
    """
    The Mood gauge scores a component by WHERE ITS VALUE SITS in its own trailing year, so a latest
    value is not enough — it needs the distribution around it.

    The floor of 252 is not decoration: a percentile against 40 observations is not a percentile,
    it is an anecdote with a decimal point. The gauge suppresses a component whose history is too
    thin, and this proves the read is deep enough that it never has to.
    """
    def serve_history(request: httpx.Request) -> httpx.Response:
        series = request.url.params.get("series_id", "").lower()
        return httpx.Response(200, json=load_fixture("fred", f"{series}_history"))

    history = _adapter(serve_history).history("VIXCLS")

    assert len(history) >= 252
    assert history[0].date > history[-1].date          # newest first
    assert all(o.value > 0 for o in history)           # every "." row was skipped, not zeroed
