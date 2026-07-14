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


# ----- the multiplier bug (found by the Front Page's note gate, N5) -----
#
# The scanner's bare-number rule refuses a number glued to a letter, so "Q3" is not the number 3 and
# "3rd" is not the number 3. That is right. But when the glued number is a DECIMAL the pattern used
# to backtrack to a shorter match instead of refusing the token: "2.1x" produced the number "2".
#
# "2.1x its usual volume" is exactly how anyone writes relative volume, and 2.1 is a real computed
# stat. The gate would score the phantom "2" against the sources, find nothing, and flag the
# sentence. On the briefing that costs a flag; on the Front Page the note is DELETED — and a deleted
# note prints nothing, so nothing on screen would ever have told us.

def test_a_multiplier_is_the_number_it_says_it_is():
    """"2.1x" is a claim about the number 2.1. It must be CHECKED, and it must pass when 2.1 is a
    computed stat — otherwise every honest sentence about relative volume is thrown away."""
    stats = [Stat("rvol-ACME", "2.1", label="ACME relative volume")]
    draft = _draft(items=[_item(by_the_numbers="ACME traded 2.1x its usual volume.")])

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.status == "ok"
    assert result.flags == ()
    assert result.checked >= 1, "the multiplier must be checked, not merely skipped"


def test_a_fabricated_multiplier_is_still_caught():
    """The other half of the same rule. Reading "2.1x" as a number is only worth doing if a made-up
    multiple is refused."""
    stats = [Stat("rvol-ACME", "2.1", label="ACME relative volume")]
    draft = _draft(items=[_item(by_the_numbers="ACME traded 9.9x its usual volume.")])

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.flags[0].entity.startswith("9.9")


def test_a_decimal_glued_to_letters_is_not_silently_truncated():
    """The bug itself, pinned. Whatever "3.5pp" is, it is NOT the number 3, and inventing a phantom
    "3" to flag is how an honest sentence gets thrown away for a number nobody wrote."""
    draft = _draft(items=[_item(by_the_numbers="The spread widened 3.5pp.")])

    result = verify(draft, extracts=[], stats=[], instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert all(flag.entity != "3" for flag in result.flags), "the gate invented a number"


def test_an_ordinal_is_still_not_a_number():
    """The original rule, still standing: "Q3" and "3rd" are not claims about 3."""
    draft = _draft(items=[_item(by_the_numbers="Q3 was the 3rd straight quarter.")])

    result = verify(draft, extracts=[], stats=[], instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.flags == ()
    assert result.checked == 0


# ----- PD7: the gate publishes what it CLEARED, not only what it flagged (Q-PD5-1) -----
#
# The gate has always recorded its FLAGS — the numbers that traced back to nothing. It never
# recorded the other side of the same decision: the numbers it CHECKED and MATCHED. So a published
# brief carried a list of what FAILED and no list of what PASSED, and ruling E5 ("a number is set in
# mono — the 'this was checked' typeface — only if the deterministic gate cleared it") had no
# allow-list to consult. The Desk's brief therefore rendered NOT ONE emphasized figure.
#
# The alternative was a DENY-list: emphasize everything number-shaped except the flagged. That would
# make the APP decide what counts as a number, with its own regex, and this module already answers
# that question. Its header names the cost of a second answer. So the gate answers it once, out loud.

def test_the_gate_reports_what_it_cleared():
    """The fix. A figure that traced to a source comes back NAMED, not merely uncounted."""
    stats = [Stat("breadth-pct50", "62.40%", label="above the 50-day")]
    draft = _draft(focus_body="Some 62.4% of the universe sits above its long-run average.")

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.flags == ()
    assert result.checked == 1
    assert "62.4%" in result.cleared


def test_a_flagged_entity_is_never_cleared():
    """The two lists are complements, not overlapping opinions. A number cannot be both."""
    stats = [Stat("breadth-pct50", "62.40%", label="above the 50-day")]
    draft = _draft(
        focus_headline="A quiet session",
        items=[_item(by_the_numbers="Breadth was 62.4%, and margins hit 3.1%.")],
    )

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert [flag.entity for flag in result.flags] == ["3.1%"]
    assert "62.4%" in result.cleared
    assert "3.1%" not in result.cleared


def test_the_cleared_list_is_deduplicated_and_ordered():
    """It is an ALLOW-LIST the app matches prose against, so it is a set of strings, in reading
    order. The same figure quoted twice is one permission, not two."""
    stats = [Stat("macro-vix", "18.20", label="VIX"), Stat("macro-10y", "4.35%", label="10-year")]
    draft = _draft(
        focus_body="The VIX closed at 18.20.",
        items=[_item(by_the_numbers="The VIX closed at 18.20 and the 10-year at 4.35%.")],
    )

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.cleared == ("18.20", "4.35%")


def test_a_held_briefing_still_reports_what_it_cleared():
    """A held night is the one a human most wants to audit. "Which numbers were fine?" is half of
    "why was this held?", and the record answered only the other half."""
    stats = [Stat("macro-vix", "18.20", label="VIX")]
    draft = _draft(focus_body="The VIX closed at 18.20, up from a fabricated 11.50.")

    result = verify(draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE)

    assert result.status == "held"
    assert "18.20" in result.cleared


def test_the_cleared_list_survives_serialization():
    """It only unlocks E5 if it reaches the app, and it reaches the app as JSON."""
    stats = [Stat("macro-vix", "18.20", label="VIX")]
    draft = _draft(focus_body="The VIX closed at 18.20.")

    payload = verify(
        draft, extracts=[], stats=stats, instruments=INSTRUMENTS, run_date=RUN_DATE
    ).to_json()

    assert payload["cleared"] == ["18.20"]
