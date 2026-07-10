"""
monitoring.py — the dead-man's-switch pings to healthchecks.io.

Job B owns the dead-man check (its cron matches the check's schedule, plan Appendix C). Each
scheduled night it pings `/start` when it begins and the bare URL when it finishes cleanly; if a
success ping never arrives within the grace window, healthchecks.io alerts. That is the whole
safety net for a pipeline that runs unattended in the cloud.

Pinging is best-effort by design: a monitoring failure must never fail the actual job. If the
ping cannot be sent, the job has still done its real work, and the worst case is a false alarm —
which is the safe direction for a dead-man switch to fail.
"""

from __future__ import annotations

import httpx


def ping(base_url: str, suffix: str = "", *, client: httpx.Client | None = None) -> bool:
    """
    Send one healthchecks.io ping and report whether it was delivered.

    `suffix` selects the endpoint: "" is the success ping, "/start" marks the beginning of a run,
    "/fail" reports an explicit failure. The base URL already identifies the check.

    Returns True on a 2xx, False on any error. It never raises: monitoring is not allowed to be
    the thing that breaks the run. The optional `client` lets tests inject a mock transport so no
    network call is made.

    @param base_url the check's ping URL (HEALTHCHECKS_PING_URL)
    @param suffix   "", "/start", or "/fail"
    @param client   an httpx.Client for tests; a short-lived one is created when omitted
    """
    url = base_url.rstrip("/") + suffix
    owns_client = client is None
    client = client or httpx.Client(timeout=10.0)
    try:
        response = client.get(url)
        return response.is_success
    except httpx.HTTPError:
        # A failed ping is logged by the caller if it cares; here we swallow it so the job's real
        # outcome is never overridden by a monitoring hiccup.
        return False
    finally:
        if owns_client:
            client.close()
