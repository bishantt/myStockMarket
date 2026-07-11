"""
Tests for briefing/verify.py — the deterministic verification gate (Appendix E).

The plan (§6.2) wants these written first: a seeded fake number, a fake ticker, and a fake date each
caught; the tolerance table cases (8.2% matches 8.24%; $1.2B matches 1,200M; ticker case-fold); and
the verdict rules (a flag in the Today's-focus block, or more than two flags total, holds the
briefing). Every number a briefing sentence quotes must trace back to an extract or the computed
stats table, or its sentence is flagged.
"""

from __future__ import annotations

from datetime import date

from briefing.schema import BriefDraft
from briefing.verify import Stat, verify

RUN_DATE = date(2026, 7, 11)
INSTRUMENTS = frozenset({"ACME", "GLOBEX", "SPY"})


def _draft(*, focus_body="Breadth was mixed.", focus_headline="A quiet session",
           items=None, calendar_notes=None, no_edge=False) -> BriefDraft:
    return BriefDraft.model_validate(
        {
            "today_focus": {
                "headline": focus_headline,
                "body": focus_body,
                "citations": [],
                "no_edge_flag": no_edge,
            },
            "items": items or [],
            "calendar_notes": calendar_notes or [],
            "learning_link_slug": None,
        }
    )


def _item(**over) -> dict:
    base = {
        "what_happened": "Nothing notable.",
        "why_it_matters": "Context only.",
        "by_the_numbers": "",
        "yes_but": "",
        "citations": [],
    }
    return base | over


# The stats table the pipeline computed and handed to synthesis. Values are in rendered form.
STATS = [
    Stat("breadth-adv", "5091"),
    Stat("breadth-total", "110"),
    Stat("acme-rev", "1,200M"),
    Stat("acme-move", "8.24%"),
    Stat("spx-close", "4512.30"),
    Stat("cpi-date", "2026-07-16"),
]


def test_clean_draft_passes_with_no_flags():
    draft = _draft(
        focus_body="Breadth showed 5091 advancers.",
        items=[_item(by_the_numbers="Acme rose 8.2% on revenue of $1.2B.")],
        calendar_notes=["CPI is due 2026-07-16."],
    )
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "ok"
    assert result.flags == ()


def test_percent_within_tolerance_matches():
    # 8.2% in the draft against 8.24% in the stats — inside max(0.05pp, 0.5% relative).
    draft = _draft(items=[_item(by_the_numbers="The move was 8.2%.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "ok"


def test_money_unit_normalization_matches():
    # $1.2B in the draft against "1,200M" in the stats — both normalize to 1.2e9, within ±1%.
    draft = _draft(items=[_item(by_the_numbers="Revenue was $1.2B.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "ok"


def test_ticker_case_fold_matches():
    draft = _draft(items=[_item(what_happened="Shares of $acme rose.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "ok"


def test_fake_number_in_item_is_flagged():
    draft = _draft(items=[_item(by_the_numbers="Revenue was $9.9B.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert len(result.flags) == 1
    assert result.flags[0].kind == "money"


def test_fake_ticker_is_flagged():
    draft = _draft(items=[_item(what_happened="Shares of $ZZZZ jumped.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert any(f.kind == "ticker" for f in result.flags)


def test_fake_date_is_flagged():
    draft = _draft(items=[_item(by_the_numbers="Earnings land 2026-12-25.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert any(f.kind == "date" for f in result.flags)


def test_flag_in_todays_focus_holds_the_briefing():
    # A single fabricated number, but it sits in the Today's-focus block ⇒ held.
    draft = _draft(focus_body="Today the tape jumped 42.0% on nothing.")
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "held"
    assert result.held_reason is not None


def test_more_than_two_flags_holds_the_briefing():
    draft = _draft(
        items=[
            _item(by_the_numbers="Up 11.1%."),
            _item(by_the_numbers="Down 22.2%."),
            _item(by_the_numbers="Then 33.3%."),
        ]
    )
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert len(result.flags) == 3
    assert result.status == "held"


def test_one_or_two_flags_outside_focus_still_publishes():
    draft = _draft(
        items=[_item(by_the_numbers="Up 11.1%."), _item(by_the_numbers="Down 22.2%.")]
    )
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert len(result.flags) == 2
    assert result.status == "ok"  # published with inline flags, not held


def test_count_matches_exactly_and_off_by_one_is_flagged():
    ok = _draft(items=[_item(by_the_numbers="110 names reported.")])
    assert verify(ok, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE).status == "ok"
    bad = _draft(items=[_item(by_the_numbers="111 names reported.")])
    assert verify(bad, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE).flags


def test_extract_key_numbers_are_a_valid_source():
    from briefing.schema import ExtractResult

    extract = ExtractResult.model_validate(
        {
            "doc_id": "news-1",
            "headline_neutral": "Globex guided higher",
            "summary": "Globex raised guidance.",
            "tickers": ["GLOBEX"],
            "event_type": "guidance",
            "sentiment": 0.4,
            "key_numbers": [{"value_str": "3.75%", "what": "guidance raise"}],
            "quote": None,
        }
    )
    draft = _draft(items=[_item(by_the_numbers="Guidance rose 3.75%.")])
    result = verify(draft, extracts=[extract], stats=[], instruments=INSTRUMENTS, run_date=RUN_DATE)
    assert result.status == "ok"


def test_verification_json_is_serializable_and_records_decisions():
    draft = _draft(items=[_item(by_the_numbers="Revenue was $9.9B.")])
    result = verify(draft, extracts=[], stats=STATS, instruments=INSTRUMENTS, run_date=RUN_DATE)
    payload = result.to_json()
    assert payload["status"] == "ok"
    assert payload["flags"][0]["entity"].startswith("$9.9")
    assert payload["checked"] >= 1
