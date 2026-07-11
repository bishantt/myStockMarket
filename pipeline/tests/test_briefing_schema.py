"""
Tests for briefing/schema.py — the Appendix G data shapes.

The plan asks for an "extraction schema pydantic round-trip" test first. These cover: a valid
extract and draft parse and re-serialize losslessly; the strict constraints (extra fields, bad
enum, out-of-range sentiment, over-length strings, >5 items) each raise; and the derived JSON
schemas are API-shaped (additionalProperties false everywhere, no unsupported constraint keys).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from briefing.schema import (
    BriefDraft,
    ExtractResult,
    extract_json_schema,
    synthesis_json_schema,
)


def _valid_extract() -> dict:
    return {
        "doc_id": "news-1",
        "headline_neutral": "Acme reported quarterly results",
        "summary": "Acme reported revenue of $1.2B, up from a year earlier.",
        "tickers": ["ACME"],
        "event_type": "earnings",
        "sentiment": 0.2,
        "key_numbers": [{"value_str": "$1.2B", "what": "quarterly revenue"}],
        "quote": "results were in line with our plan",
    }


def _valid_draft() -> dict:
    return {
        "today_focus": {
            "headline": "A quiet session with earnings ahead",
            "body": "Breadth was mixed as the market waited on Acme's report.",
            "citations": ["stat-breadth"],
            "no_edge_flag": False,
        },
        "items": [
            {
                "what_happened": "Acme reported revenue of $1.2B.",
                "why_it_matters": "It is the first read on the sector this quarter.",
                "by_the_numbers": "Revenue $1.2B.",
                "yes_but": "One quarter is not a trend.",
                "citations": ["news-1"],
            }
        ],
        "calendar_notes": ["CPI is due Thursday."],
        "learning_link_slug": None,
    }


def test_extract_round_trips_losslessly():
    payload = _valid_extract()
    parsed = ExtractResult.model_validate(payload)
    assert parsed.doc_id == "news-1"
    assert parsed.key_numbers[0].value_str == "$1.2B"
    # Round-trip: dumping and re-parsing yields an equal object.
    again = ExtractResult.model_validate(parsed.model_dump(mode="json"))
    assert again == parsed


def test_draft_round_trips_losslessly():
    parsed = BriefDraft.model_validate(_valid_draft())
    assert parsed.today_focus.headline.startswith("A quiet")
    assert len(parsed.items) == 1
    again = BriefDraft.model_validate(parsed.model_dump(mode="json"))
    assert again == parsed


def test_extract_rejects_extra_field():
    bad = _valid_extract() | {"surprise": "not allowed"}
    with pytest.raises(ValidationError):
        ExtractResult.model_validate(bad)


def test_extract_rejects_unknown_event_type():
    bad = _valid_extract() | {"event_type": "rumor"}
    with pytest.raises(ValidationError):
        ExtractResult.model_validate(bad)


def test_extract_rejects_sentiment_out_of_range():
    bad = _valid_extract() | {"sentiment": 1.5}
    with pytest.raises(ValidationError):
        ExtractResult.model_validate(bad)


def test_extract_rejects_overlong_headline():
    bad = _valid_extract() | {"headline_neutral": "x" * 121}
    with pytest.raises(ValidationError):
        ExtractResult.model_validate(bad)


def test_draft_rejects_more_than_five_items():
    one = _valid_draft()["items"][0]
    bad = _valid_draft() | {"items": [one] * 6}
    with pytest.raises(ValidationError):
        BriefDraft.model_validate(bad)


def test_api_schemas_have_no_unsupported_constraints_and_are_strict():
    for schema in (extract_json_schema(), synthesis_json_schema()):
        _assert_api_shaped(schema)


def _assert_api_shaped(node: object) -> None:
    banned = {"minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems", "pattern"}
    if isinstance(node, dict):
        assert not (banned & node.keys()), f"unsupported constraint leaked: {banned & node.keys()}"
        if node.get("type") == "object":
            assert node.get("additionalProperties") is False
        for value in node.values():
            _assert_api_shaped(value)
    elif isinstance(node, list):
        for item in node:
            _assert_api_shaped(item)
