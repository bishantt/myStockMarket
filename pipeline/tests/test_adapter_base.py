"""
Tests for the Adapter base class and the fixture loader (plan §6.1).

The base gives every provider adapter the same spine: a request goes through the rate limiter,
then over an httpx client, and a failing status raises so the caller can degrade that one source
without taking down the run. The fixture loader lets tests serve recorded JSON through an
httpx.MockTransport, so no test ever needs a live key.
"""

import httpx
import pytest

from adapters.base import Adapter, load_fixture


class SpyLimiter:
    """Stands in for a TokenBucket, recording how many tokens were taken."""

    def __init__(self) -> None:
        self.acquired = 0

    def acquire(self) -> None:
        self.acquired += 1


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_get_acquires_a_token_then_returns_the_response():
    limiter = SpyLimiter()
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json={"ok": True})

    adapter = Adapter("test", _client(handler), limiter)
    response = adapter.get("https://example.test/v1/thing", params={"a": "1"})

    assert response.json() == {"ok": True}
    assert seen["url"] == "https://example.test/v1/thing?a=1"
    assert limiter.acquired == 1  # exactly one token per request


def test_every_request_takes_a_token():
    limiter = SpyLimiter()
    adapter = Adapter("test", _client(lambda r: httpx.Response(200, json=[])), limiter)
    for _ in range(3):
        adapter.get("https://example.test/x")
    assert limiter.acquired == 3


def test_an_error_status_raises_so_the_source_can_degrade():
    limiter = SpyLimiter()
    adapter = Adapter("test", _client(lambda r: httpx.Response(503)), limiter)
    with pytest.raises(httpx.HTTPStatusError):
        adapter.get("https://example.test/down")
    # The token was still spent — a failed call counts against the rate limit.
    assert limiter.acquired == 1


def test_headers_are_passed_through():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ua"] = request.headers.get("user-agent")
        return httpx.Response(200, json={})

    adapter = Adapter("test", _client(handler), SpyLimiter())
    adapter.get("https://example.test/x", headers={"User-Agent": "msm test"})
    assert seen["ua"] == "msm test"


def test_load_fixture_reads_recorded_json(tmp_path, monkeypatch):
    # Point the loader at a temp fixtures dir and drop a file for one provider.
    fixtures = tmp_path / "alpaca"
    fixtures.mkdir()
    (fixtures / "bars.json").write_text('{"bars": {"AAPL": [{"c": 100}]}}')
    monkeypatch.setenv("MSM_FIXTURES_DIR", str(tmp_path))

    data = load_fixture("alpaca", "bars")
    assert data["bars"]["AAPL"][0]["c"] == 100


def test_load_fixture_fails_loudly_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("MSM_FIXTURES_DIR", str(tmp_path))
    with pytest.raises(FileNotFoundError):
        load_fixture("alpaca", "does-not-exist")
