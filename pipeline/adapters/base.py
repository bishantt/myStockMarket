"""
base.py — the shared machinery every provider adapter is built on (plan §6.1, P1 step 2).

Three things live here: a token-bucket rate limiter, a fixture loader that turns recorded JSON
into an httpx transport (so tests never touch a live key), and the base Adapter class that ties a
client and a limiter together. The five provider adapters (Alpaca, Finnhub, FMP, Marketaux, FRED,
EDGAR) all follow the shape defined here — see the new-provider-adapter skill.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Mapping

import httpx

# Recorded provider responses live here, one folder per adapter. Tests point MSM_FIXTURES_DIR at
# a temp copy; in the repo they sit under adapters/fixtures/.
_DEFAULT_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


class TokenBucket:
    """
    A token-bucket rate limiter.

    Every provider caps requests per second. The bucket starts full — so a short burst goes
    straight through — and refills at a steady rate up to its capacity. `acquire()` returns
    immediately when a token is available and otherwise sleeps exactly long enough for the next
    one, which paces a long run at the provider's limit without any per-call sleeps in the adapter.

    The clock and sleep are injectable so the behaviour can be tested with a hand-cranked clock,
    no real waiting involved.

    @param rate_per_sec how many tokens refill each second (the sustained request rate)
    @param capacity     the most tokens that can bank up — the largest allowed burst
    """

    def __init__(
        self,
        rate_per_sec: float,
        capacity: float,
        *,
        now=time.monotonic,
        sleep=time.sleep,
    ) -> None:
        if rate_per_sec <= 0 or capacity <= 0:
            raise ValueError("rate_per_sec and capacity must be positive")
        self._rate = float(rate_per_sec)
        self._capacity = float(capacity)
        self._now = now
        self._sleep = sleep
        # Start full: the first `capacity` requests are free to burst.
        self._tokens = float(capacity)
        self._last = now()

    def acquire(self) -> None:
        """Take one token, waiting for a refill if the bucket is empty."""
        self._refill()
        if self._tokens < 1.0:
            wait = (1.0 - self._tokens) / self._rate
            self._sleep(wait)
            self._refill()
        self._tokens -= 1.0

    def _refill(self) -> None:
        """Add the tokens that accrued since the last check, capped at capacity."""
        now = self._now()
        elapsed = now - self._last
        self._last = now
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)


def load_fixture(adapter: str, name: str) -> Any:
    """
    Read a recorded JSON fixture for an adapter, e.g. load_fixture("alpaca", "bars").

    Fixtures are recorded provider responses checked into adapters/fixtures/<adapter>/<name>.json.
    Tests replay them through an httpx.MockTransport so no live key is ever needed. A missing
    fixture raises FileNotFoundError loudly — a silent empty result would let a broken test pass.

    MSM_FIXTURES_DIR overrides the base directory (tests point it at a temp copy).
    """
    base = Path(os.environ.get("MSM_FIXTURES_DIR", _DEFAULT_FIXTURES_DIR))
    path = base / adapter / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"No fixture: {path}")
    return json.loads(path.read_text())


class Adapter:
    """
    The base every provider adapter extends.

    It pairs an httpx client with a rate limiter and funnels every request through both: acquire a
    token, make the call, and raise on a failing status so the caller can degrade this one source
    without failing the whole run (plan §2 — sources degrade independently). Subclasses add the
    provider-specific methods (daily bars, news, calendar, ...) on top of `get`.

    @param name    the provider name, used in status maps and logs (e.g. "alpaca")
    @param client  an httpx.Client — a real one in production, a MockTransport-backed one in tests
    @param limiter anything with an acquire() method; normally a TokenBucket sized to the provider
    """

    def __init__(self, name: str, client: httpx.Client, limiter) -> None:
        self.name = name
        self._client = client
        self._limiter = limiter

    def get(
        self,
        url: str,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> httpx.Response:
        """Rate-limited GET. Raises httpx.HTTPStatusError on any non-2xx response."""
        self._limiter.acquire()
        response = self._client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response
