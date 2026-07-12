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
    observations = _adapter(_serve_fixtures).latest_two("SP500")
    assert [o.value for o in observations] == [6812.34, 6789.10]
    assert [o.date for o in observations] == [date(2026, 7, 9), date(2026, 7, 8)]


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
