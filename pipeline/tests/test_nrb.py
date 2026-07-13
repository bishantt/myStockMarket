"""
Tests for the Nepal Rastra Bank forex adapter (NEWS-AND-CONTROL-PLAN Part 6.2.4, Appendix A.4).

Fixtures are real NRB responses, recorded 2026-07-13 (the endpoint needs no key). They carry two
traps that a hand-written fixture would never have taught us, and both are pinned below:

  1. NRB reports its errors in the BODY, not the HTTP status. The empty-window response is HTTP 200
     — raise_for_status() passes it happily — while the envelope inside says `status.code: 400` and
     the payload is empty. Any parser that trusts the HTTP status alone reads that as a success.
  2. The payload is ASCENDING. The newest day is the LAST element, so "the latest rate" is a max by
     date, not payload[0]. Taking the first element would have silently served Friday's rate on a
     Monday — a wrong number that looks entirely plausible, which is the worst kind.
"""

from datetime import date

import httpx
import pytest

from adapters.base import load_fixture
from adapters.nrb import NrbAdapter


class NullLimiter:
    def acquire(self) -> None:
        pass


def _adapter(handler) -> NrbAdapter:
    return NrbAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter())


def _serve(fixture: str):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=load_fixture("nrb", fixture))

    return handler


def test_returns_the_latest_published_usd_rate():
    """The newest day in the window — which is the LAST row NRB sends, not the first."""
    rate = _adapter(_serve("rates")).latest_rate("USD", date(2026, 7, 10), date(2026, 7, 13))

    assert rate.date == date(2026, 7, 13)
    assert rate.buy == 152.23
    assert rate.sell == 152.83


def test_respects_the_currency_unit():
    """
    NRB quotes some currencies per 100 units, and the Indian rupee is one of them.

    The USD row carries unit=1, so nothing about a USD-only parser would ever reveal a unit bug —
    it would sit there being right by luck until the day someone added a second currency. The real
    fixture happens to carry INR at unit=100 (160.00 per 100 rupees), so this pins the division now.
    """
    rate = _adapter(_serve("rates")).latest_rate("INR", date(2026, 7, 10), date(2026, 7, 13))

    assert rate.buy == pytest.approx(1.60)
    assert rate.sell == pytest.approx(1.6015)


def test_an_empty_window_raises_rather_than_returning_a_zero():
    """
    The trap. HTTP 200, an envelope saying 400, and no rates at all.

    The adapter must refuse to invent an answer here. It raises, the job catches it, and the cell
    degrades to its last stored value with an age note (ruling C7 rung 3) — which is a true
    statement about a source that went quiet, where a 0.00 would be a false one.
    """
    adapter = _adapter(_serve("empty"))

    with pytest.raises(ValueError, match="no USD rate"):
        adapter.latest_rate("USD", date(2026, 12, 1), date(2026, 12, 2))


def test_an_unquoted_currency_raises():
    """A currency NRB does not publish is an absence, not a zero."""
    adapter = _adapter(_serve("rates"))

    with pytest.raises(ValueError, match="no ZWL rate"):
        adapter.latest_rate("ZWL", date(2026, 7, 10), date(2026, 7, 13))


def test_a_missing_route_fails_loudly():
    """The harness itself must fail when a fixture is absent — a silent empty result hides a bug."""

    def not_found(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "no such route"})

    with pytest.raises(httpx.HTTPStatusError):
        _adapter(not_found).latest_rate("USD", date(2026, 7, 10), date(2026, 7, 13))
