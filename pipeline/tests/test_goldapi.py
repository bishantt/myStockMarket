"""
Tests for the GoldAPI adapter (Part 6.2.3, Appendix A.3).

READ THE FIXTURE NAMES BEFORE READING THE ASSERTIONS.

Only ONE fixture here is real: `error_403.json`, the response GoldAPI genuinely gives a caller with
no key — which is the state this repo is actually in, because P-5 (the GoldAPI key) has not been
provisioned. It pins the two facts we depend on today: the route is live, and the key travels in an
`x-access-token` header.

The success fixture is `xau_usd_UNVERIFIED.json`, and the name is the point. It was written from
GoldAPI's documentation, not recorded from GoldAPI, so it can only prove that the PARSER agrees with
the DOCUMENTATION — never that the documentation agrees with the provider. That is a genuinely
weaker test and it is labeled as one, because this build has already been bitten once by a fixture
that was fabricated and did not say so (R0's hand-written FRED index levels, discovered in N3, which
spent three phases quietly proving that the parser agreed with my imagination).

The consequence is visible rather than hidden: until the key lands, the gold cell renders "not yet
reported" (degradation rung 4), and no unverified number reaches the reader.
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
    Verified against the REAL 403: GoldAPI authenticates by header, not by query parameter.

    This is the one thing about GoldAPI's live behaviour that this repo can currently prove, so it
    is worth proving properly — a key sent as a query param would fail in production and pass every
    test that only ever looked at a fixture.
    """
    seen: dict[str, str] = {}

    def capture(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.headers))
        return httpx.Response(200, json=load_fixture("goldapi", "xau_usd_UNVERIFIED"))

    _adapter(capture, key="secret-123").spot()

    assert seen["x-access-token"] == "secret-123"


def test_an_unkeyed_call_is_rejected_by_the_provider():
    """The real recording. This is exactly what production does today, and why the cell says so."""
    body = load_fixture("goldapi", "error_403")
    assert body == {"error": "No API Key provided"}

    def reject(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json=body)

    with pytest.raises(httpx.HTTPStatusError):
        _adapter(reject, key="").spot()


def test_parses_the_documented_success_shape():
    """UNVERIFIED — see the module docstring. Proves the parser matches GoldAPI's published shape."""
    quote = _adapter(lambda r: httpx.Response(200, json=load_fixture("goldapi", "xau_usd_UNVERIFIED"))).spot()

    assert quote.price == 4085.2
    assert quote.prior == 4071.9
    assert quote.date == date(2026, 7, 10)  # from the provider's own timestamp, not our clock
    assert quote.source_key == "goldapi"


def test_a_quote_with_no_previous_close_still_renders_its_price():
    """One number is enough to show the price; the change then renders "—" rather than being faked
    from the open, which answers a different question."""
    payload = {**load_fixture("goldapi", "xau_usd_UNVERIFIED")}
    del payload["prev_close_price"]

    quote = _adapter(lambda r: httpx.Response(200, json=payload)).spot()

    assert quote.price == 4085.2
    assert quote.prior is None


def test_a_quote_with_no_timestamp_is_refused():
    """A gold price with no date is the one thing this board may not print. We do not date it
    ourselves — an undated number silently becomes "today's" the moment it is rendered."""
    payload = {**load_fixture("goldapi", "xau_usd_UNVERIFIED")}
    del payload["timestamp"]

    with pytest.raises(ValueError, match="no timestamp"):
        _adapter(lambda r: httpx.Response(200, json=payload)).spot()
