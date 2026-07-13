"""
Tests for the open.er-api.com adapter — the FALLBACK USD→NPR source (Appendix A.4).

It is a fallback and not a peer, and the distinction is the point: NRB publishes the central bank's
official reference rate, while this publishes a market mid-rate. They are different measurements of
different things, so they may never be silently swapped for one another — whichever one is on
screen, the app names it (ruling C6). That naming is the app's job; the adapter's job is to report
which source answered, which is why the returned quote carries its own source key.

Fixture is a real response, recorded 2026-07-13 (no key needed).
"""

from datetime import date

import httpx
import pytest

from adapters.base import load_fixture
from adapters.erapi import ErApiAdapter


class NullLimiter:
    def acquire(self) -> None:
        pass


def _adapter(handler) -> ErApiAdapter:
    return ErApiAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter())


def _serve(payload):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    return handler


def test_returns_the_npr_rate_with_the_sources_own_date():
    """
    The as-of date comes from the SOURCE's update stamp, never from our clock.

    This is the same rule the whole board is built on: a rate is "as of" when the source published
    it, not when we happened to ask. The fixture's stamp is Mon, 13 Jul 2026 00:02:31 +0000.
    """
    quote = _adapter(_serve(load_fixture("erapi", "latest_usd"))).latest("NPR")

    assert quote.date == date(2026, 7, 13)
    assert quote.rate > 0
    assert quote.source_key == "erapi"


def test_an_error_result_raises_even_on_http_200():
    """This API, like NRB's, can answer 200 with a failure inside. The envelope is what counts."""
    adapter = _adapter(_serve({"result": "error", "error-type": "unsupported-code"}))

    with pytest.raises(ValueError, match="er-api"):
        adapter.latest("NPR")


def test_an_unquoted_currency_raises():
    """An absent currency is an absence — never a zero."""
    payload = {**load_fixture("erapi", "latest_usd"), "rates": {"EUR": 0.9}}

    with pytest.raises(ValueError, match="no NPR rate"):
        _adapter(_serve(payload)).latest("NPR")
