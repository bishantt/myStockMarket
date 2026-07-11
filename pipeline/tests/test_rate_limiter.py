"""
Tests for the token-bucket rate limiter (plan §6.1: adapters carry a token-bucket limiter).

Every provider caps requests per second (Finnhub 30/s, FRED 2/s, ...). The limiter is what keeps
the nightly full-universe ingest inside those caps without hand-tuned sleeps scattered through
each adapter. These tests drive it with an injected clock and sleep, so they assert the exact
throttling behaviour without any real waiting.
"""

from adapters.base import TokenBucket


class FakeClock:
    """A hand-cranked monotonic clock. `sleep` advances it; nothing ever really waits."""

    def __init__(self) -> None:
        self.t = 0.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        # A limiter should never ask to sleep a negative amount.
        assert seconds >= 0
        self.sleeps.append(seconds)
        self.t += seconds


def test_a_full_bucket_lets_a_burst_through_without_waiting():
    clock = FakeClock()
    # 2 tokens/second, burst capacity 2.
    bucket = TokenBucket(rate_per_sec=2, capacity=2, now=clock.now, sleep=clock.sleep)

    bucket.acquire()
    bucket.acquire()

    # The first two came from the starting burst, so nothing slept.
    assert clock.sleeps == []


def test_it_throttles_once_the_burst_is_spent():
    clock = FakeClock()
    bucket = TokenBucket(rate_per_sec=2, capacity=2, now=clock.now, sleep=clock.sleep)

    bucket.acquire()
    bucket.acquire()
    bucket.acquire()  # burst spent — this one must wait for a refill

    # At 2 tokens/sec, a token refills every 0.5s, so the third call waits ~0.5s.
    assert len(clock.sleeps) == 1
    assert abs(clock.sleeps[0] - 0.5) < 1e-9


def test_tokens_refill_over_elapsed_time():
    clock = FakeClock()
    bucket = TokenBucket(rate_per_sec=10, capacity=1, now=clock.now, sleep=clock.sleep)

    bucket.acquire()  # spends the one token
    # Time passes on its own (e.g. the request itself took a while).
    clock.t += 1.0  # 1 second → 10 tokens would refill, but capacity caps it at 1
    bucket.acquire()  # a token is available again, no wait

    assert clock.sleeps == []


def test_capacity_caps_accumulated_tokens():
    clock = FakeClock()
    bucket = TokenBucket(rate_per_sec=5, capacity=3, now=clock.now, sleep=clock.sleep)

    # Sit idle a long time — tokens must not accumulate past capacity.
    clock.t += 100.0
    bucket.acquire()
    bucket.acquire()
    bucket.acquire()
    bucket.acquire()  # only 3 could bank; the 4th waits

    assert len(clock.sleeps) == 1
    assert abs(clock.sleeps[0] - 0.2) < 1e-9  # 5/sec → one token every 0.2s


def test_a_steady_stream_paces_at_the_rate():
    clock = FakeClock()
    bucket = TokenBucket(rate_per_sec=4, capacity=1, now=clock.now, sleep=clock.sleep)

    for _ in range(5):
        bucket.acquire()

    # First acquire uses the initial token; the next four each wait one quarter-second.
    assert len(clock.sleeps) == 4
    assert all(abs(s - 0.25) < 1e-9 for s in clock.sleeps)
