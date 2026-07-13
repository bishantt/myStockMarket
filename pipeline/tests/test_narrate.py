"""
test_narrate.py — the Front Page's one line of prose, and the gate that can delete it (plan 7.5).

The rules under test, in plain English:

  - The narrator never sees a rank. Significance is computed from evidence by `rank.py`, and if the
    number were in the prompt the model could reason about WHY a story is ranked first — which is
    the app forming an editorial opinion by the back door (ruling C1).
  - A note that quotes a number nobody computed does not publish. Both fields drop to null, and the
    reason is recorded on the cluster.
  - A dropped note is COUNTED. The gate's failure mode is silent — a null prints nothing, and a page
    with no notes looks exactly like a page the narrator had nothing to say about. The only thing
    that tells those two apart is a count.
"""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from briefing.schema import EventType, ExtractResult, KeyNumber
from briefing.verify import Stat
from newsdesk.narrate import (
    AFFECTED_MAX_CHARS,
    WHY_MAX_CHARS,
    ClusterNote,
    NoteInput,
    Story,
    build_notes_prompt,
    gate_notes,
    narrate,
    run_narration,
)
from newsdesk.rank import TickerMove

RUN_DATE = date(2026, 7, 10)


# ----- fakes -----

class _Block:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class _Message:
    def __init__(self, text: str) -> None:
        self.content = [_Block(text)]


class FakeClient:
    """A scripted Anthropic client: returns each queued text in turn and records every call."""

    def __init__(self, *responses: str) -> None:
        self._responses = list(responses)
        self.calls: list[dict] = []
        self.messages = self

    def create(self, **kwargs) -> _Message:
        self.calls.append(kwargs)
        return _Message(self._responses.pop(0) if self._responses else "")


# ----- fixtures -----

def _extract(doc_id: str = "a1", **overrides) -> ExtractResult:
    payload = {
        "doc_id": doc_id,
        "headline_neutral": "Baker Hughes wins EU approval for Chart Industries deal",
        "summary": "The European Commission cleared the acquisition after a divestiture.",
        "tickers": ["BKR"],
        "event_type": EventType.MA,
        "sentiment": 0.2,
        "key_numbers": [KeyNumber(value_str="$13.6B", what="deal value")],
        "quote": None,
    }
    payload.update(overrides)
    return ExtractResult.model_validate(payload)


_DEFAULT = object()  # so a test can pass extract=None and actually MEAN none


def _cluster(cluster_id: str = "c1", extract=_DEFAULT) -> NoteInput:
    return NoteInput(
        cluster_id=cluster_id,
        headline="Baker Hughes wins E.U. approval for Chart Industries deal",
        event_type="ma",
        sectors=["Energy"],
        tickers=("BKR",),
        sources=2,
        extract=_extract() if extract is _DEFAULT else extract,
    )


def _stats() -> list[Stat]:
    return [Stat(stat_id="move.BKR", value="3.4%", label="BKR 1-day gain")]


def _noteset_json(why: str | None = "A cleared deal this size re-prices the whole segment.") -> str:
    why_json = "null" if why is None else f'"{why}"'
    return (
        '{"notes": [{"cluster_id": "c1", "why_it_matters": ' + why_json + ', '
        '"affected_note": null, "citations": ["a1"]}]}'
    )


# ----- the schema -----

def test_a_note_longer_than_the_cap_is_not_a_note() -> None:
    """The card's design gives the line ONE line. A model that ignores the character hint fails
    validation here rather than printing a paragraph into a card built for a sentence."""
    with pytest.raises(ValidationError):
        ClusterNote(cluster_id="c1", why_it_matters="x" * (WHY_MAX_CHARS + 1))
    with pytest.raises(ValidationError):
        ClusterNote(cluster_id="c1", affected_note="x" * (AFFECTED_MAX_CHARS + 1))


def test_a_null_note_is_valid() -> None:
    """An honest null beats padding (Appendix D). The schema must permit the model to say nothing."""
    note = ClusterNote(cluster_id="c1", why_it_matters=None, affected_note=None)
    assert note.why_it_matters is None


# ----- the prompt -----

def test_the_narrator_is_never_shown_a_rank() -> None:
    """Ruling C1: the page is edited by evidence, and the LLM never sees or sets a rank. If the
    significance score reached the prompt, the model could write prose that justifies the ordering —
    an editorial opinion laundered through a narrator that is only supposed to explain mechanisms."""
    _system, user = build_notes_prompt([_cluster()], _stats())

    assert "significance" not in user.lower()
    assert "0.6" not in user  # no score leaks in under another name
    assert "rank" not in user.lower()


def test_the_prompt_carries_the_ids_the_note_must_cite() -> None:
    """Every number the model may use arrives with an id it can cite, and the gate later checks the
    numbers against those same sources."""
    _system, user = build_notes_prompt([_cluster()], _stats())

    assert "cluster_id=c1" in user
    assert "doc_id=a1" in user
    assert "$13.6B" in user       # the extract's key number
    assert "stat_id=move.BKR" in user
    assert "3.4%" in user


def test_a_cluster_with_no_extract_still_reaches_the_narrator_with_its_facts() -> None:
    """Stage A drops a malformed article rather than crashing the night, so a top-20 cluster can
    arrive with no extract. It still has a headline and a class, and the note may still be written
    from them — or the model may honestly return null."""
    _system, user = build_notes_prompt([_cluster(extract=None)], [])

    assert "cluster_id=c1" in user
    assert "Baker Hughes" in user
    assert "(no extract" in user  # the absence is stated, not hidden


# ----- the call -----

def test_narrate_parses_a_valid_response() -> None:
    client = FakeClient(_noteset_json())

    result = narrate(client, [_cluster()], _stats(), model="claude-sonnet-5")

    assert result is not None
    assert result.notes[0].cluster_id == "c1"
    assert result.notes[0].why_it_matters.startswith("A cleared deal")
    assert len(client.calls) == 1


def test_a_schema_violation_is_retried_exactly_once() -> None:
    """Appendix D: schema violation ⇒ one retry with the error appended."""
    client = FakeClient("I'm afraid I can't do that.", _noteset_json())

    result = narrate(client, [_cluster()], _stats(), model="claude-sonnet-5")

    assert result is not None
    assert len(client.calls) == 2
    # The retry must carry the failed attempt and a correction, not silently ask again.
    assert len(client.calls[1]["messages"]) == 3


def test_two_failures_publish_the_facts_without_prose() -> None:
    """A second failure returns None — the caller writes null notes and the page still ships. The
    front page never blocks on a bad sentence."""
    client = FakeClient("nope", "still nope")

    assert narrate(client, [_cluster()], _stats(), model="claude-sonnet-5") is None
    assert len(client.calls) == 2


def test_no_clusters_makes_no_call_at_all() -> None:
    """A night with nothing to narrate does not pay for a call to say so."""
    client = FakeClient(_noteset_json())

    assert narrate(client, [], _stats(), model="claude-sonnet-5") is None
    assert client.calls == []


# ----- the gate -----

def _gate(why: str | None = None, affected: str | None = None, clusters=None, stats=None):
    note = ClusterNote(cluster_id="c1", why_it_matters=why, affected_note=affected, citations=["a1"])
    return gate_notes(
        [note],
        clusters=clusters if clusters is not None else [_cluster()],
        stats=stats if stats is not None else _stats(),
        instruments=["BKR"],
        run_date=RUN_DATE,
    )


def test_a_note_quoting_a_real_number_survives() -> None:
    """$13.6B is in the extract's key_numbers; 3.4% is in the stats table. Both are quotable."""
    result = _gate(why="The $13.6B deal clears, and BKR is up 3.4% on it.")

    decision = result.decisions["c1"]
    assert decision.why_it_matters == "The $13.6B deal clears, and BKR is up 3.4% on it."
    assert decision.verification["narrated"] is True
    assert decision.verification["flags"] == []
    assert decision.verification["checked"] >= 2  # it actually looked at the two numbers
    assert result.dropped == 0
    assert result.narrated == 1


def test_a_fabricated_number_deletes_the_whole_note() -> None:
    """The mechanism P9 exists for. $99B was computed by nobody, so the sentence does not publish —
    and the sentence beside it goes too: a model that invented one figure has not earned the benefit
    of the doubt on the next one."""
    result = _gate(
        why="The $99B deal is the biggest of the year.",
        affected="Oilfield services broadly.",
    )

    decision = result.decisions["c1"]
    assert decision.why_it_matters is None
    assert decision.affected_note is None
    assert decision.verification["narrated"] is False
    assert decision.verification["dropped"] is True
    assert decision.verification["flags"][0]["entity"] == "$99B"
    assert result.dropped == 1
    assert result.narrated == 0


def test_a_note_with_no_numbers_at_all_publishes() -> None:
    """The best "why it matters" lines carry no figures — they name a mechanism. Nothing to verify
    is not the same as nothing verified, and the gate must not confuse them."""
    result = _gate(why="Regulatory clearance usually re-prices a whole segment, not one ticker.")

    decision = result.decisions["c1"]
    assert decision.why_it_matters is not None
    assert decision.verification["narrated"] is True
    assert decision.verification["checked"] == 0


def test_the_numbers_of_ANOTHER_cluster_are_not_a_source_for_this_one() -> None:
    """The gate is per-cluster on purpose. A figure from a different story is a real number in the
    world and still a fabrication on THIS card — the exact shape of the VHI bug, where every number
    was true and the card was a lie."""
    other = _extract(doc_id="b2", key_numbers=[KeyNumber(value_str="$42.5B", what="a different deal")])

    result = gate_notes(
        [ClusterNote(cluster_id="c1", why_it_matters="A $42.5B transaction.")],
        clusters=[_cluster(), _cluster(cluster_id="c2", extract=other)],
        stats=[],
        instruments=["BKR"],
        run_date=RUN_DATE,
    )

    assert result.decisions["c1"].why_it_matters is None
    assert result.dropped == 1


def test_an_honest_null_is_not_a_drop() -> None:
    """The model returning null means "I have nothing to add beyond the headline". That is the
    system working, and counting it as a gate drop would make an honest night look like a failing
    one."""
    result = _gate(why=None, affected=None)

    decision = result.decisions["c1"]
    assert decision.why_it_matters is None
    assert decision.verification["narrated"] is False
    assert decision.verification.get("dropped") is not True
    assert result.dropped == 0
    assert result.narrated == 0


def test_a_note_for_a_cluster_that_does_not_exist_is_ignored() -> None:
    """The model is handed the cluster ids and may only write about those. An invented id is not a
    story, and it never reaches the publish transaction."""
    result = gate_notes(
        [ClusterNote(cluster_id="ghost", why_it_matters="Something happened.")],
        clusters=[_cluster()],
        stats=_stats(),
        instruments=["BKR"],
        run_date=RUN_DATE,
    )

    assert "ghost" not in result.decisions
    assert result.narrated == 0


# ----- both stages, end to end -----

def _story(cluster_id: str = "c1", article_id: str = "a1") -> Story:
    return Story(
        cluster_id=cluster_id,
        headline="Baker Hughes wins E.U. approval for Chart Industries deal",
        event_type="ma",
        sectors=["Energy"],
        tickers=("BKR",),
        sources=2,
        article={
            "id": article_id,
            "headline": "Baker Hughes wins E.U. approval for Chart Industries deal",
            "snippet": "The European Commission cleared the $13.6B acquisition.",
            "url": "https://example.com/a1",
            "tickers": ["BKR"],
        },
    )


_EXTRACT_JSON = (
    '{"doc_id": "a1", "headline_neutral": "Baker Hughes wins EU approval", '
    '"summary": "The Commission cleared the deal.", "tickers": ["BKR"], "event_type": "ma", '
    '"sentiment": 0.2, "key_numbers": [{"value_str": "$13.6B", "what": "deal value"}], "quote": null}'
)


def _run(client, **overrides):
    kwargs = dict(
        stage_a=[_story()],
        stage_b_ids=["c1"],
        moves={"BKR": TickerMove("BKR", ret1=0.034, atr14_pct=0.02)},
        rvol={"BKR": 2.1},
        instruments=["BKR"],
        run_date=RUN_DATE,
        model_extract="claude-haiku-4-5",
        model_synth="claude-sonnet-5",
    )
    kwargs.update(overrides)
    return run_narration(client, **kwargs)


def test_both_stages_run_and_the_note_lands() -> None:
    """Stage A reads the article, Stage B writes the line, the gate passes it, and the counts add up."""
    client = FakeClient(_EXTRACT_JSON, _noteset_json("The $13.6B clearance re-prices the segment."))

    result = _run(client)

    assert result.extracted == 1
    assert result.extract_attempted == 1
    assert result.decisions["c1"].why_it_matters == "The $13.6B clearance re-prices the segment."
    assert result.narrated == 1
    assert result.dropped == 0
    assert len(client.calls) == 2  # one extract, one narration — no more


def test_the_stats_the_narrator_may_quote_come_from_the_ticker_table() -> None:
    """The linked ticker's move and relative volume are quotable; nothing else about it is. Rendered
    by the SAME function the briefing's movers go through, so one fact cannot round two ways."""
    client = FakeClient(_EXTRACT_JSON, _noteset_json("BKR trades 2.1x its usual volume on the news."))

    result = _run(client)

    prompt = client.calls[1]["messages"][0]["content"]
    assert "stat_id=mover-BKR = 3.40%" in prompt
    assert "stat_id=rvol-BKR = 2.1" in prompt
    assert result.decisions["c1"].why_it_matters is not None  # 2.1 traced back to the rvol stat


def test_a_dead_extractor_still_publishes_the_page() -> None:
    """Stage A returns nothing (every article malformed). The story still reaches the narrator with
    its headline, and the page still publishes — the model runs last precisely so it can fail."""
    client = FakeClient("garbage", _noteset_json("Clearance of this kind re-prices a segment."))

    result = _run(client)

    assert result.extracted == 0
    assert result.extract_attempted == 1
    assert result.decisions["c1"].why_it_matters is not None
    assert result.narrated == 1


def test_a_dead_narrator_still_publishes_the_page() -> None:
    """Stage B fails its schema twice. Every cluster keeps its facts and gets no prose, and the night
    SAYS so — a page with no notes must never be indistinguishable from a page with nothing to say."""
    client = FakeClient(_EXTRACT_JSON, "nope", "still nope")

    result = _run(client)

    assert result.narration_failed is True
    assert result.decisions == {}
    assert "failed its schema twice" in result.summary()


def test_only_the_narrated_subset_is_written_about() -> None:
    """Stage A reads 2 stories; Stage B is asked for 1. The second gets facts and no line."""
    client = FakeClient(_EXTRACT_JSON, _EXTRACT_JSON, _noteset_json())

    result = _run(client, stage_a=[_story(), _story("c2", "a2")], stage_b_ids=["c1"])

    assert result.extract_attempted == 2
    assert set(result.decisions) == {"c1"}


def test_the_summary_states_what_was_attempted_not_just_what_landed() -> None:
    """"0 notes" and "0 notes out of 20 attempted" are different nights, and only one of them is
    healthy. Seven guards in this build have passed because the thing they measured was absent."""
    client = FakeClient(_EXTRACT_JSON, _noteset_json(None))

    result = _run(client)

    assert result.silent == 1
    assert "1/1 extracted" in result.summary()
    assert "0 notes written" in result.summary()


def test_a_cashtag_for_a_ticker_we_do_not_carry_is_flagged() -> None:
    """The same discipline the briefing's gate keeps: a cashtag is an unambiguous ticker claim, and
    a claim about a listing this app does not hold cannot be checked, so it does not publish."""
    result = gate_notes(
        [ClusterNote(cluster_id="c1", why_it_matters="Watch $ZZZZ for the read-across.")],
        clusters=[_cluster()],
        stats=_stats(),
        instruments=["BKR"],
        run_date=RUN_DATE,
    )

    assert result.decisions["c1"].why_it_matters is None
    assert result.decisions["c1"].verification["flags"][0]["kind"] == "ticker"


# ----- the narrator may never hold the night open (N5, found in production) -----
#
# The first live news run sat in Stage A for over twenty minutes. The Anthropic SDK defaults to a
# 600-SECOND timeout with retries, and Stage A makes up to 60 sequential calls — so one slow provider
# night could hold the publish open for hours, and the FACTS would be held hostage to the PROSE.
#
# That is backwards. The prose is the least important thing in the pipeline: the module runs last
# precisely so that everything before it can publish without it. So the extraction stage takes a
# wall-clock budget, and when the budget is gone it stops extracting and lets the page ship.

def test_extraction_stops_when_the_budget_is_gone_and_the_page_still_ships() -> None:
    clock = iter([0.0, 0.0, 5.0, 99.0, 99.0, 99.0, 99.0, 99.0])
    client = FakeClient(_EXTRACT_JSON, _EXTRACT_JSON, _noteset_json())

    result = _run(
        client,
        stage_a=[_story(), _story("c2", "a2"), _story("c3", "a3")],
        stage_b_ids=["c1"],
        clock=lambda: next(clock),
        extract_budget=10.0,
    )

    # It read what it could and gave up on the rest — rather than reading all three at any cost.
    assert result.extract_attempted == 3
    assert result.extracted < 3
    assert result.extract_timed_out is True

    # And the page still publishes, with its facts and its note.
    assert result.decisions["c1"].why_it_matters is not None
    assert "gave up" in result.summary()


def test_a_budget_that_is_never_exhausted_reads_everything() -> None:
    """The negative control: the budget must not be silently truncating a healthy night."""
    client = FakeClient(_EXTRACT_JSON, _EXTRACT_JSON, _noteset_json())

    result = _run(
        client,
        stage_a=[_story(), _story("c2", "a2")],
        stage_b_ids=["c1"],
        clock=lambda: 0.0,
        extract_budget=600.0,
    )

    assert result.extracted == 2
    assert result.extract_timed_out is False


def test_a_narrator_that_throws_publishes_the_facts_without_prose() -> None:
    """The rule Stage A learned the hard way, held for Stage B too: a provider outage is a page
    without prose, never a night without a front page."""

    class _Throwing:
        def __init__(self) -> None:
            self.messages = self

        def create(self, **_kwargs):
            raise TimeoutError("Request timed out or interrupted.")

    assert narrate(_Throwing(), [_cluster()], _stats(), model="claude-sonnet-5") is None
