"""
Tests for monitoring.ping — the plan's "healthchecks ping mocked test" (§6.2, P0 tests-first).

Every request is served by an httpx.MockTransport, so no network call is made and no real
healthchecks.io check is touched. The behaviour that matters: the right URL is hit, success is
reported truthfully, and a failure to ping never raises — because monitoring must not be the
thing that breaks a job.
"""

import httpx

from monitoring import ping


def _client(handler) -> httpx.Client:
    """An httpx.Client whose every request is answered by `handler`, no network involved."""
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_success_ping_hits_the_bare_url_and_reports_true():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, text="OK")

    assert ping("https://hc.example/abc", client=_client(handler)) is True
    assert seen["url"] == "https://hc.example/abc"


def test_start_ping_appends_the_suffix():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200)

    ping("https://hc.example/abc", "/start", client=_client(handler))
    assert seen["url"] == "https://hc.example/abc/start"


def test_a_trailing_slash_on_the_base_url_does_not_double_up():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200)

    ping("https://hc.example/abc/", "/start", client=_client(handler))
    assert seen["url"] == "https://hc.example/abc/start"


def test_a_non_2xx_response_reports_false_but_does_not_raise():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    assert ping("https://hc.example/abc", client=_client(handler)) is False


def test_a_transport_error_reports_false_but_does_not_raise():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network down")

    # The whole point: a monitoring outage returns False, it never propagates and fails the job.
    assert ping("https://hc.example/abc", client=_client(handler)) is False
