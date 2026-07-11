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
