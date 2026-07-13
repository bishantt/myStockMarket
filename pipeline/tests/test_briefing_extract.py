"""
Tests for briefing/extract.py — Stage A extraction over the Message Batches API.

Written first (plan §6.2). They cover the pure request builder, parsing a batch result into an
ExtractResult (with a malformed result tolerated as a miss, not a crash), the batch-cutoff logic
with an injected clock (ended-before-cutoff returns everything; still-running-past-cutoff cancels
and returns the completed subset plus the remainder), and the synchronous remainder fallback. A fake
Anthropic client stands in for the transport, so no key is ever needed.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

from briefing.extract import (
    build_extract_request,
    collect_batch,
    parse_extract,
    submit_batch,
    sync_extract,
)

MODEL = "claude-haiku-4-5"


def _news(doc_id: str, headline: str = "Acme beat estimates") -> dict:
    return {
        "id": doc_id,
        "headline": headline,
        "snippet": "Acme reported quarterly revenue of $1.2B.",
        "url": f"https://example.com/{doc_id}",
        "tickers": ["ACME"],
    }


def _valid_extract_json(doc_id: str) -> str:
    return json.dumps(
        {
            "doc_id": "whatever-the-model-said",
            "headline_neutral": "Acme reported quarterly results",
            "summary": "Acme reported revenue of $1.2B.",
            "tickers": ["ACME"],
            "event_type": "earnings",
            "sentiment": 0.3,
            "key_numbers": [{"value_str": "$1.2B", "what": "quarterly revenue"}],
            "quote": None,
        }
    )


def _message(text: str) -> SimpleNamespace:
    """A fake Anthropic message whose one text block carries `text`."""
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


def _result(custom_id: str, *, ok: bool = True, text: str | None = None) -> SimpleNamespace:
    if ok:
        inner = SimpleNamespace(type="succeeded", message=_message(text or _valid_extract_json(custom_id)))
    else:
        inner = SimpleNamespace(type="errored", message=None)
    return SimpleNamespace(custom_id=custom_id, result=inner)


class _FakeBatches:
    """Mimics client.messages.batches for create/retrieve/results/cancel."""

    def __init__(self, statuses: list[str], results: list[SimpleNamespace]):
        self._statuses = list(statuses)
        self._results = results
        self.created_with: list = []
        self.cancelled: list[str] = []

    def create(self, *, requests):
        self.created_with = list(requests)
        return SimpleNamespace(id="batch-123")

    def retrieve(self, batch_id):
        status = self._statuses.pop(0) if self._statuses else "ended"
        return SimpleNamespace(id=batch_id, processing_status=status)

    def cancel(self, batch_id):
        self.cancelled.append(batch_id)
        return SimpleNamespace(id=batch_id, processing_status="canceling")

    def results(self, batch_id):
        return iter(self._results)


def _client(batches: _FakeBatches) -> SimpleNamespace:
    return SimpleNamespace(messages=SimpleNamespace(batches=batches))


def test_build_request_carries_id_and_article():
    request = build_extract_request(_news("news-1"), model=MODEL)
    assert request["custom_id"] == "news-1"
    params = request["params"]
    assert params["model"] == MODEL
    user_text = params["messages"][0]["content"]
    assert "Acme" in user_text
    assert "news-1" in user_text  # the doc_id travels in the prompt so the model can echo it
    assert params["output_config"]["format"]["type"] == "json_schema"


def test_parse_extract_forces_doc_id_to_custom_id():
    extract = parse_extract("news-1", _valid_extract_json("news-1"))
    assert extract is not None
    assert extract.doc_id == "news-1"  # overwritten, not trusted from the model


def test_parse_extract_tolerates_prose_around_json():
    wrapped = "Here is the extract:\n" + _valid_extract_json("news-1") + "\nDone."
    extract = parse_extract("news-1", wrapped)
    assert extract is not None
    assert extract.event_type.value == "earnings"


def test_parse_extract_returns_none_on_garbage():
    assert parse_extract("news-1", "not json at all") is None
    assert parse_extract("news-1", json.dumps({"missing": "fields"})) is None


def test_submit_batch_sends_all_and_returns_id():
    batches = _FakeBatches(statuses=[], results=[])
    batch_id = submit_batch(_client(batches), [_news("a"), _news("b")], model=MODEL)
    assert batch_id == "batch-123"
    assert [r["custom_id"] for r in batches.created_with] == ["a", "b"]


def test_collect_returns_all_when_batch_ends_before_cutoff():
    results = [_result("a"), _result("b")]
    batches = _FakeBatches(statuses=["ended"], results=results)
    extracts, remainder = collect_batch(
        _client(batches), "batch-123", ["a", "b"],
        clock=_fixed_clock(0), cutoff=100, sleep=lambda _s: None,
    )
    assert set(extracts) == {"a", "b"}
    assert remainder == []
    assert batches.cancelled == []


def test_collect_cancels_past_cutoff_and_returns_completed_plus_remainder():
    # Only "a" finished; the batch is still processing; the clock is already past the cutoff.
    results = [_result("a")]
    batches = _FakeBatches(statuses=["in_progress", "in_progress"], results=results)
    ticks = iter([0, 200, 200])  # first poll before cutoff, then past it
    extracts, remainder = collect_batch(
        _client(batches), "batch-123", ["a", "b"],
        clock=lambda: next(ticks), cutoff=100, sleep=lambda _s: None,
    )
    assert set(extracts) == {"a"}
    assert remainder == ["b"]
    assert batches.cancelled == ["batch-123"]


def test_sync_extract_handles_the_remainder():
    class _FakeMessages:
        def create(self, **kwargs):
            return _message(_valid_extract_json("b"))

    client = SimpleNamespace(messages=_FakeMessages())
    extracts = sync_extract(client, [_news("b")], model=MODEL)
    assert set(extracts) == {"b"}
    assert extracts["b"].doc_id == "b"


def _fixed_clock(value):
    return lambda: value


# ----- one bad call is a dropped article, not a dead stage (N5, found in production) -----
#
# The docstring said "A failed article is skipped" and the code only skipped articles whose PARSE
# failed. An API exception — a timeout, a 529, a dropped connection — propagated straight out of the
# loop and killed the whole stage.
#
# In production that is exactly what happened: ONE extraction call timed out, the exception unwound
# through the entire newsdesk narration, and the night reported "0/0 extracted". Sixty articles were
# waiting to be read and not one of them was, because the first one was slow.
#
# The rule this restores is the one the whole pipeline is built on: a source degrades ALONE.

class _RaisingClient:
    """Raises on the first call, then behaves. The shape of a real transient provider failure."""

    def __init__(self) -> None:
        self.calls = 0
        self.messages = self

    def create(self, **_kwargs):
        self.calls += 1
        if self.calls == 1:
            raise TimeoutError("Request timed out or interrupted.")
        return _message(_valid_extract_json("ignored"))


def test_one_failed_call_does_not_take_the_other_articles_down():
    client = _RaisingClient()

    extracts = sync_extract(
        client,
        [_news("a1"), _news("a2"), _news("a3")],
        model=MODEL,
    )

    assert client.calls == 3, "it must keep going, not stop at the first failure"
    assert len(extracts) == 2, "the two that answered are extracted; the one that failed is dropped"
    assert "a1" not in extracts
