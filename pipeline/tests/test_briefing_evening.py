"""
Tests for briefing/evening.py — Job B's briefing orchestration, end to end against fixtures.

The plan (§6.2) wants "job_b end-to-end against fixtures with a mocked Anthropic transport". These
drive run_briefing with a fake client (batches + messages) and a capturing publish, covering: the
happy path (batch completes → synthesize → verify → published); the batch-cutoff remainder (cancel
at cutoff, sync-extract the rest, still publish); a late-news article swept in and extracted; a
synthesis failure held; a verification-flag-in-focus held; and a no-batch night skipped without
publishing anything.
"""

from __future__ import annotations

import json
from datetime import date
from types import SimpleNamespace

from briefing.evening import BriefingDeps, run_briefing
from briefing.verify import Stat

RUN_DATE = date(2026, 7, 11)
INSTRUMENTS = frozenset({"ACME", "GLOBEX"})
STATS = [Stat("breadth", "5091", label="advancers")]


def _news(doc_id: str, headline: str = "Acme beat estimates") -> dict:
    return {"id": doc_id, "headline": headline, "snippet": "Acme reported revenue of $1.2B.",
            "url": f"https://example.com/{doc_id}", "tickers": ["ACME"]}


def _extract_json(doc_id: str) -> str:
    return json.dumps({
        "doc_id": doc_id, "headline_neutral": "Acme reported results",
        "summary": "Acme reported revenue of $1.2B.", "tickers": ["ACME"],
        "event_type": "earnings", "sentiment": 0.2,
        "key_numbers": [{"value_str": "$1.2B", "what": "quarterly revenue"}], "quote": None,
    })


def _draft_json(*, focus_body="Breadth showed 5091 advancers.", by_numbers="Revenue was $1.2B.") -> str:
    return json.dumps({
        "today_focus": {"headline": "A quiet session", "body": focus_body,
                        "citations": ["breadth"], "no_edge_flag": False},
        "items": [{"what_happened": "Acme reported.", "why_it_matters": "First read.",
                   "by_the_numbers": by_numbers, "yes_but": "One quarter.", "citations": ["news-1"]}],
        "calendar_notes": [], "learning_link_slug": None,
    })


def _message(text: str) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


def _batch_result(custom_id: str) -> SimpleNamespace:
    return SimpleNamespace(custom_id=custom_id,
                           result=SimpleNamespace(type="succeeded", message=_message(_extract_json(custom_id))))


class _FakeBatches:
    def __init__(self, statuses, results):
        self._statuses = list(statuses)
        self._results = results
        self.cancelled = []

    def retrieve(self, batch_id):
        # Advance through the scripted statuses, but hold the last one (a batch that is still
        # processing stays processing) so a cutoff test can keep polling "in_progress".
        if len(self._statuses) > 1:
            status = self._statuses.pop(0)
        elif self._statuses:
            status = self._statuses[0]
        else:
            status = "ended"
        return SimpleNamespace(id=batch_id, processing_status=status)

    def cancel(self, batch_id):
        self.cancelled.append(batch_id)
        return SimpleNamespace(id=batch_id, processing_status="canceling")

    def results(self, batch_id):
        return iter(self._results)


class _FakeMessages:
    def __init__(self, batches, synth_texts):
        self.batches = batches
        self._synth_texts = list(synth_texts)
        self.sync_extract_calls = 0

    def create(self, **kwargs):
        # A synthesis call carries several stats/extracts in its user message; a sync extraction is a
        # single-article call. Distinguish by the system prompt.
        system = kwargs.get("system", "")
        if system.startswith("You write the evening briefing"):
            return _message(self._synth_texts.pop(0))
        self.sync_extract_calls += 1
        return _message(_extract_json("late-1"))


def _client(statuses, batch_results, synth_texts):
    batches = _FakeBatches(statuses, batch_results)
    return SimpleNamespace(messages=_FakeMessages(batches, synth_texts))


class _Capture:
    def __init__(self):
        self.calls = []

    def __call__(self, **kwargs):
        self.calls.append(kwargs)


def _deps(client, publish, *, batched, batch_id="batch-1", late=None, clock=lambda: 0, cutoff=100):
    return BriefingDeps(
        run_date=RUN_DATE, anthropic=client, batched_items=batched, stats=STATS,
        instruments=INSTRUMENTS, publish=publish, batch_id=batch_id,
        late_news=late, clock=clock, cutoff=cutoff, sleep=lambda _s: None,
    )


def test_happy_path_publishes():
    client = _client(["ended"], [_batch_result("news-1")], [_draft_json()])
    publish = _Capture()
    result = run_briefing(_deps(client, publish, batched=[_news("news-1")]))
    assert result.status == "published"
    assert len(publish.calls) == 1
    assert publish.calls[0]["status"] == "published"
    assert publish.calls[0]["am_json"]["today_focus"]["headline"] == "A quiet session"


def test_cutoff_remainder_is_sync_extracted_then_published():
    # Batch never ends and the clock is already past the cutoff → cancel, sync the remainder.
    client = _client(["in_progress"], [], [_draft_json()])
    publish = _Capture()
    ticks = iter([0, 200, 200])
    result = run_briefing(_deps(client, publish, batched=[_news("news-1")], clock=lambda: next(ticks)))
    assert client.messages.batches.cancelled == ["batch-1"]
    assert client.messages.sync_extract_calls == 1  # the remainder article
    assert result.status == "published"


def test_late_news_is_swept_in_and_extracted():
    client = _client(["ended"], [_batch_result("news-1")], [_draft_json()])
    publish = _Capture()
    deps = _deps(client, publish, batched=[_news("news-1")], late=lambda: [_news("late-1")])
    run_briefing(deps)
    assert client.messages.sync_extract_calls == 1  # the late article, extracted synchronously


def test_synthesis_failure_holds_the_briefing():
    client = _client(["ended"], [_batch_result("news-1")], ["garbage", "still garbage"])
    publish = _Capture()
    result = run_briefing(_deps(client, publish, batched=[_news("news-1")]))
    assert result.status == "held"
    assert publish.calls[0]["status"] == "held"
    assert publish.calls[0]["verification_json"]["held_reason"]


def test_verification_flag_in_focus_holds_the_briefing():
    # A fabricated number sits in the Today's-focus block → the gate holds it.
    client = _client(["ended"], [_batch_result("news-1")],
                     [_draft_json(focus_body="The tape jumped 42.0% on nothing.")])
    publish = _Capture()
    result = run_briefing(_deps(client, publish, batched=[_news("news-1")]))
    assert result.status == "held"
    assert publish.calls[0]["status"] == "held"


def test_no_batch_night_is_skipped_without_publishing():
    client = _client([], [], [])
    publish = _Capture()
    result = run_briefing(_deps(client, publish, batched=[], batch_id=None))
    assert result.status == "skipped"
    assert publish.calls == []


def test_model_meta_records_the_models_and_counts():
    client = _client(["ended"], [_batch_result("news-1")], [_draft_json()])
    publish = _Capture()
    run_briefing(_deps(client, publish, batched=[_news("news-1")]))
    meta = publish.calls[0]["model_meta"]
    assert meta["model_synth"] == "claude-sonnet-5"
    assert meta["extract_count"] == 1
