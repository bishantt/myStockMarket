"""
Tests for briefing/synthesize.py — Stage B, the one synchronous synthesis call (Appendix G).

Written first (plan §6.2). They cover the prompt assembly (doc_ids and stat_ids both present so the
model can cite them, and the numbers verbatim), a clean draft parse, the one-retry-on-schema-
violation rule, and the "second failure ⇒ None" (which the caller turns into a held briefing). A
fake client records the calls and returns scripted text, so no key is needed.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

from briefing.schema import ExtractResult
from briefing.synthesize import build_synthesis_prompt, synthesize
from briefing.verify import Stat

MODEL = "claude-sonnet-5"


def _extract(doc_id: str) -> ExtractResult:
    return ExtractResult.model_validate(
        {
            "doc_id": doc_id,
            "headline_neutral": "Acme reported results",
            "summary": "Acme reported revenue of $1.2B.",
            "tickers": ["ACME"],
            "event_type": "earnings",
            "sentiment": 0.2,
            "key_numbers": [{"value_str": "$1.2B", "what": "quarterly revenue"}],
            "quote": None,
        }
    )


STATS = [Stat("breadth", "5091", label="advancers"), Stat("vix", "14.2", label="VIX")]


def _valid_draft_json() -> str:
    return json.dumps(
        {
            "today_focus": {
                "headline": "A quiet session before earnings",
                "body": "Breadth was mixed.",
                "citations": ["breadth"],
                "no_edge_flag": False,
            },
            "items": [
                {
                    "what_happened": "Acme reported revenue of $1.2B.",
                    "why_it_matters": "First read on the sector.",
                    "by_the_numbers": "Revenue $1.2B.",
                    "yes_but": "One quarter is not a trend.",
                    "citations": ["news-1"],
                }
            ],
            "calendar_notes": [],
            "learning_link_slug": None,
        }
    )


def _message(text: str) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


class _ScriptedMessages:
    """Returns the queued texts in order and records every create() call."""

    def __init__(self, texts: list[str]):
        self._texts = list(texts)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return _message(self._texts.pop(0))


def _client(texts: list[str]) -> SimpleNamespace:
    return SimpleNamespace(messages=_ScriptedMessages(texts))


def test_prompt_carries_doc_ids_stat_ids_and_numbers():
    system, user = build_synthesis_prompt([_extract("news-1")], STATS)
    assert "cite" in system.lower()
    assert "news-1" in user       # a doc_id to cite
    assert "breadth" in user      # a stat_id to cite
    assert "5091" in user         # the number, verbatim, for the model to copy
    assert "$1.2B" in user


def test_synthesize_returns_a_draft_on_valid_output():
    client = _client([_valid_draft_json()])
    draft = synthesize(client, [_extract("news-1")], STATS, model=MODEL)
    assert draft is not None
    assert draft.today_focus.headline.startswith("A quiet")
    assert len(client.messages.calls) == 1
    assert client.messages.calls[0]["output_config"]["format"]["type"] == "json_schema"


def test_synthesize_retries_once_then_succeeds():
    client = _client(["this is not valid json", _valid_draft_json()])
    draft = synthesize(client, [_extract("news-1")], STATS, model=MODEL)
    assert draft is not None
    assert len(client.messages.calls) == 2  # one retry with the error appended
    # The retry conversation includes the failed attempt and a correction turn.
    retry_messages = client.messages.calls[1]["messages"]
    assert len(retry_messages) > 1


def test_synthesize_returns_none_after_two_failures():
    client = _client(["garbage", "still garbage"])
    draft = synthesize(client, [_extract("news-1")], STATS, model=MODEL)
    assert draft is None
    assert len(client.messages.calls) == 2  # one call, one retry, then give up


def test_max_tokens_covers_thinking_but_stays_a_non_streaming_call():
    """The synthesis budget lives in a narrow band, and both edges held a real briefing (CC1).

    Too LOW and claude-sonnet-5's extended thinking eats the whole budget before it writes any JSON —
    `stop_reason=max_tokens`, a lone `thinking` block, a 0-char "response", and the briefing holds
    (this happened at 4096, roughly every other night).

    Too HIGH and the SDK refuses the non-streaming call outright: any max_tokens that could run past
    10 minutes raises "Streaming is required" (`3600 * max_tokens / 128000 > 600` ⇒ > 21333). Sonnet-5
    is not in the SDK's per-model non-streaming table, so that time guard is the only ceiling.
    """
    from briefing.synthesize import _MAX_TOKENS

    assert _MAX_TOKENS > 4096, "extended thinking starves the JSON output below this (CC1)"
    assert 3600 * _MAX_TOKENS / 128_000 <= 600, "would force a streaming call (the SDK 10-minute guard)"
