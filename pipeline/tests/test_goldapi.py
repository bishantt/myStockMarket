"""
Tests for the GoldAPI adapter (Part 6.2.3, Appendix A.3).

BOTH FIXTURES HERE ARE REAL RECORDINGS, and that is new as of N4.

Until 2026-07-13 the success fixture was `xau_usd_UNVERIFIED.json` — written from GoldAPI's
published documentation because no key existed to record a real response with. It said so in its own
filename, which is the rule this repo adopted after N3 found three FRED fixtures that had been
hand-written to LOOK recorded and had spent three phases proving the parser agreed with someone's
imagination.

The key landed (provisioning row P-5), the recorder ran, and GoldAPI answered. `xau_usd.json` is now
that answer, byte for byte, and the invention has been deleted.

**The invention was wrong about something real, and it is worth knowing what.** It gave the quote a
timestamp of exactly midnight UTC — a clean session date, which is what every other cell on this
board carries. GoldAPI does not work that way: it stamps the LIVE QUOTE INSTANT (the real recording
is stamped 13:21:02 UTC, the second the recorder called it). So gold's "as of" date is the date we
ASKED on, not the date a session settled — which is honest for an indicative spot reference, and is
why the cell is labeled as one. A parser built to trust the fiction's midnight boundary would have
been building a session date out of a wall clock.
"""

from datetime import date

import httpx
import pytest

from adapters.base import load_fixture
from adapters.goldapi import GoldApiAdapter


class NullLimiter:
    def acquire(self) -> None:
        pass


def _adapter(handler, key: str = "test-key") -> GoldApiAdapter:
    return GoldApiAdapter(
        httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), api_key=key
    )


def test_the_key_travels_in_the_x_access_token_header():
    """
    GoldAPI authenticates by header, not by query parameter — verified twice over now: by the real
    403 an unkeyed caller gets, and by the real 200 the keyed recorder got.

    A key sent as a query parameter would fail in production and pass every test that only ever
    looked at a fixture, so the header is asserted on the WIRE rather than trusted.
    """
    seen: dict[str, str] = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.headers))
        return httpx.Response(200, json=load_fixture("goldapi", "xau_usd"))

    _adapter(capture, key="secret-123").spot()

    assert seen["x-access-token"] == "secret-123"


def test_an_unkeyed_call_is_rejected_by_the_provider():
    """The other real recording: what GoldAPI genuinely says to a caller with no key."""
    body = load_fixture("goldapi", "error_403")
    assert body == {"error": "No API Key provided"}

    def reject(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json=body)

    with pytest.raises(httpx.HTTPStatusError):
        _adapter(reject, key="").spot()


def test_parses_the_real_recorded_response():
    """The recorded 200, parsed. These numbers are GoldAPI's, not mine."""
    quote = _adapter(lambda r: httpx.Response(200, json=load_fixture("goldapi", "xau_usd"))).spot()

    assert quote.price == 4061.87
    assert quote.prior == 4120.515
    assert quote.date == date(2026, 7, 13)  # from the provider's own timestamp, not our clock
    assert quote.currency == "USD"
    assert quote.source_key == "goldapi"


def test_the_providers_timestamp_is_a_live_quote_instant_not_a_session_date():
    """
    The property the fabricated fixture got wrong, pinned so nobody re-learns it.

    GoldAPI stamps the moment it answers — 13:21:02 UTC in this recording, not 00:00:00. The
    fabricated fixture used a clean midnight, which quietly asserted that gold arrives as a settled
    daily observation like CPI or the mortgage rate. It does not. It is a live spot reference, the
    board labels it as one, and any future code that tries to read a session boundary out of this
    field is reading a wall clock.
    """
    payload = load_fixture("goldapi", "xau_usd")

    assert payload["timestamp"] % 86400 != 0, "a midnight-exact stamp would mean a session date"

    # And the parser still lands on the right calendar day despite the intraday stamp.
    quote = _adapter(lambda r: httpx.Response(200, json=payload)).spot()
    assert quote.date == date(2026, 7, 13)


def test_a_quote_with_no_previous_close_still_renders_its_price():
    """One number is enough to show the price; the change then renders "—" rather than being faked
    from the open, which answers a different question."""
    payload = {**load_fixture("goldapi", "xau_usd")}
    del payload["prev_close_price"]

    quote = _adapter(lambda r: httpx.Response(200, json=payload)).spot()

    assert quote.price == 4061.87
    assert quote.prior is None


def test_a_quote_with_no_timestamp_is_refused():
    """A gold price with no date is the one thing this board may not print. We do not date it
    ourselves — an undated number silently becomes "today's" the moment it is rendered."""
    payload = {**load_fixture("goldapi", "xau_usd")}
    del payload["timestamp"]

    with pytest.raises(ValueError, match="no timestamp"):
        _adapter(lambda r: httpx.Response(200, json=payload)).spot()
