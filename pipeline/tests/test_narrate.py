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
    is not the same as nothing verified, and the gate must not confuse them.

    AMENDED AT PD7. This test's sentence used to read "Regulatory clearance USUALLY re-prices a whole
    segment" — and E4's new lexicon check correctly kills it, because an uncited "usually" is a
    frequency claim with no base rate behind it. The RULE this test names is untouched and still
    true; its example sentence was quietly making a second claim nobody had noticed. The frequency
    half is now pinned by the test below.
    """
    result = _gate(why="Regulatory clearance re-prices a whole segment, not one ticker.")

    decision = result.decisions["c1"]
    assert decision.why_it_matters is not None
    assert decision.verification["narrated"] is True
    assert decision.verification["checked"] == 0


def test_an_uncited_frequency_claim_deletes_the_note() -> None:
    """E4, on the v1 note. The lexicon runs on EVERY prose section, not just the new ones — "the gate
    extends, not relaxes" — so a "usually" with no computed stat behind it costs the note its line,
    exactly as a fabricated number does. It is the same offence: a claim the pipeline cannot support."""
    result = _gate(why="Regulatory clearance usually re-prices a whole segment, not one ticker.")

    decision = result.decisions["c1"]
    assert decision.why_it_matters is None
    assert decision.verification["dropped"] is True
    assert decision.verification["flags"][0]["kind"] == "frequency"


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


# ----- one bad note is one dropped note, not a dead page (N5, found in production) -----
#
# The third live run extracted 59 of 60 articles and then reported "the narrator failed its schema
# twice — the page publishes without prose". The whole page lost its notes.
#
# TWO MISTAKES, both mine. The 160-character cap is enforced by pydantic on OUR side, and the API
# does not enforce string lengths — we strip maxLength from the schema before sending it. So the
# model was never TOLD the limit, wrote past it, and every note it wrote was thrown away for breaking
# a rule nobody had given it. And because the NoteSet was validated as one object, a single over-long
# sentence invalidated the other nineteen: the same "one bad item kills the batch" disease that had
# just been fixed one stage upstream.

_LONG = "x" * (WHY_MAX_CHARS + 40)


def test_one_over_long_note_does_not_delete_the_other_nineteen() -> None:
    payload = (
        '{"notes": ['
        '{"cluster_id": "c1", "why_it_matters": "' + _LONG + '"},'
        '{"cluster_id": "c2", "why_it_matters": "A clearance re-prices the segment."}'
        ']}'
    )
    client = FakeClient(payload)

    result = narrate(client, [_cluster(), _cluster("c2")], _stats(), model="claude-sonnet-5")

    assert result is not None, "one bad sentence must not cost the page its prose"
    assert [note.cluster_id for note in result.notes] == ["c2"]
    assert len(client.calls) == 1, "and it must not waste a retry on a response that mostly parsed"


def test_a_response_where_NOTHING_parses_is_still_retried() -> None:
    """The other side of the rule: if not one note survived, something is systematically wrong and
    the one retry Appendix D allows is worth spending."""
    bad = '{"notes": [{"cluster_id": "c1", "why_it_matters": "' + _LONG + '"}]}'
    good = _noteset_json()
    client = FakeClient(bad, good)

    result = narrate(client, [_cluster()], _stats(), model="claude-sonnet-5")

    assert result is not None
    assert len(client.calls) == 2
    assert result.notes[0].why_it_matters is not None


def test_the_model_is_TOLD_the_limit_it_is_being_held_to() -> None:
    """It was not, and every note it wrote was rejected for breaking a rule it never saw. The API
    does not enforce string lengths — the schema's maxLength is stripped before it is sent — so the
    prompt is the ONLY place the model can learn the cap."""
    system, _user = build_notes_prompt([_cluster()], _stats())

    assert str(WHY_MAX_CHARS) in system
    assert str(AFFECTED_MAX_CHARS) in system


# ===== PD7: the v2 insight — sections, not license (plan 9.3, 9.8) =====
#
# The gate EXTENDS, it does not relax. The v1 pair (why_it_matters + affected_note) stays COUPLED —
# decoupling it would let a note that is dropped whole today start publishing half of itself, which
# is a relaxation by any reading. The NEW sections are gated independently, because there was nothing
# there before to relax: E3's guard names exactly this — "that section, AND ONLY THAT SECTION, is
# dropped and counted".

from briefing.depth import CalendarRef  # noqa: E402
from briefing.stats import build_calendar_stats, build_depth_stats  # noqa: E402
from briefing.depth import Position52w, TickerDepth  # noqa: E402
from newsdesk.narrate import (  # noqa: E402
    CONTEXT_MAX_CHARS,
    NOTE_VERSION,
    Usage,
    notes_json_schema,
)

_CAL = CalendarRef(
    stat_id="cal:BKR:next", key="BKR", code=None, kind="earnings",
    title="BKR earnings", date=date(2026, 7, 15),
)


def _deep_cluster(cluster_id: str = "c1") -> NoteInput:
    """A cluster inside the depth budget, carrying its own stat block and its own calendar row."""
    depth = TickerDepth(
        symbol="BKR",
        pos52w=Position52w(pct=63.2, low=142.30, high=205.80),
        move_atr=2.8,
        from50d=4.2,
    )
    return NoteInput(
        cluster_id=cluster_id,
        headline="Baker Hughes wins E.U. approval for Chart Industries deal",
        event_type="ma",
        sectors=["Energy"],
        tickers=("BKR",),
        sources=2,
        extract=_extract(),
        deep=True,
        stats=tuple(build_depth_stats([depth]) + build_calendar_stats([_CAL])),
        calendar=(_CAL,),
    )


def _gate_v2(*, why=None, affected=None, context=None, watch=(), cluster=None):
    note = ClusterNote(
        cluster_id="c1", why_it_matters=why, affected_note=affected,
        context=context, watch=list(watch), citations=["a1"],
    )
    return gate_notes(
        [note],
        clusters=[cluster if cluster is not None else _deep_cluster()],
        stats=_stats(),
        instruments=["BKR"],
        run_date=RUN_DATE,
    )


# ----- the schema round-trip -----

def test_the_v2_schema_survives_the_api_and_parses_back() -> None:
    """`api_schema` strips what the structured-output layer forbids (maxLength), and the response
    must still parse back into the model that DOES enforce it. That gap is where PD-era production
    threw away every note the narrator wrote, for breaking a rule it had never been given."""
    schema = notes_json_schema()
    fields = schema["$defs"]["ClusterNote"]["properties"]

    assert "context" in fields and "watch" in fields
    # The cap lives in pydantic, NOT in the wire schema — `api_schema` strips maxLength because the
    # structured-output layer rejects it. Which is exactly why the cap is also stated in the PROMPT:
    # it is the only place the model can learn a rule the schema is not allowed to carry.
    assert "maxLength" not in str(fields["context"]), "the API rejects maxLength; it must be stripped"

    note = ClusterNote.model_validate(
        {"cluster_id": "c1", "context": "Two sentences.", "watch": ["cal:BKR:next"]}
    )
    assert note.context == "Two sentences."
    assert note.watch == ["cal:BKR:next"]


def test_a_context_longer_than_its_cap_is_not_a_context() -> None:
    with pytest.raises(ValidationError):
        ClusterNote(cluster_id="c1", context="x" * (CONTEXT_MAX_CHARS + 1))


# ----- the context section, gated on its own -----

def test_a_context_quoting_the_depth_registry_publishes() -> None:
    """The whole point of 9.2: the narrator's vocabulary grew because the PIPELINE computed more."""
    result = _gate_v2(
        why="A cleared deal this size re-prices the segment.",
        context=(
            "The move is 2.8x its normal daily range (ATR14). BKR sits 63.2% of the way up its "
            "52-week range, between 142.30 and 205.80, and 4.2% above its 50-day average."
        ),
    )

    decision = result.decisions["c1"]
    assert decision.context is not None
    assert decision.verification["sections"]["context"]["status"] == "narrated"
    assert decision.verification["note_version"] == NOTE_VERSION


def test_a_fabricated_number_in_context_drops_THAT_SECTION_AND_ONLY_THAT_SECTION() -> None:
    """E3's guard, verbatim. The why-line is a DIFFERENT claim, checked separately and true — killing
    it because a longer, harder section failed would make adding depth a regression for the feed,
    which renders that why-line on every card."""
    result = _gate_v2(
        why="A cleared deal this size re-prices the segment.",
        context="BKR sits 91.7% of the way up its 52-week range.",  # 91.7 is nobody's number
    )

    decision = result.decisions["c1"]
    assert decision.context is None
    assert decision.why_it_matters is not None, "the sibling section was killed too"
    assert decision.verification["sections"]["context"]["status"] == "dropped"
    assert decision.verification["sections"]["why_it_matters"]["status"] == "narrated"
    assert result.sections_dropped == 1
    assert result.narrated == 1, "the cluster still published something"


def test_an_uncited_frequency_adverb_in_context_drops_the_context() -> None:
    """E4 on the new section. No stat in the sentence, no permission to say "usually"."""
    result = _gate_v2(context="Deals of this kind usually re-price the whole segment.")

    decision = result.decisions["c1"]
    assert decision.context is None
    assert decision.verification["sections"]["context"]["flags"][0]["kind"] == "frequency"


def test_an_advice_verb_in_context_drops_the_context() -> None:
    result = _gate_v2(context="Investors should buy the dip on any weakness here.")

    decision = result.decisions["c1"]
    assert decision.context is None
    assert decision.verification["sections"]["context"]["flags"][0]["kind"] == "advice"


def test_a_context_on_a_cluster_OUTSIDE_the_depth_budget_never_publishes() -> None:
    """The budget is a budget. 0.2.3 pays for the top 8; a ninth cluster's context was not bought,
    and a model that volunteers one does not get to spend money nobody allocated."""
    result = _gate_v2(
        why="A cleared deal this size re-prices the segment.",
        context="The move is 2.8x its normal daily range (ATR14).",
        cluster=_cluster(),  # deep=False
    )

    decision = result.decisions["c1"]
    assert decision.context is None
    assert decision.verification["sections"]["context"]["status"] == "out_of_budget"
    assert decision.why_it_matters is not None


# ----- watch: verified structurally -----

def test_a_watch_ref_that_resolves_is_snapshotted_as_a_ROW() -> None:
    """Not a bare ref. The story page renders from this without a second query, and it can therefore
    never disagree with the feed about what is scheduled — the `articles` argument, again."""
    result = _gate_v2(watch=["cal:BKR:next"])

    watch = result.decisions["c1"].watch
    assert watch == [
        {
            "stat_id": "cal:BKR:next", "key": "BKR", "code": None,
            "kind": "earnings", "title": "BKR earnings", "date": "2026-07-15",
        }
    ]


def test_a_DANGLING_watch_ref_is_dropped_and_counted() -> None:
    """THE RULE THAT MAKES E4 STRUCTURAL. The narrator may SELECT a calendar id; it may never author
    one. An id that resolves to no row this cluster was shown is not a calendar event — it is the
    model writing a date — and it never reaches the page."""
    result = _gate_v2(watch=["cal:BKR:next", "cal:INVENTED:next"])

    watch = result.decisions["c1"].watch
    assert [entry["stat_id"] for entry in watch] == ["cal:BKR:next"]
    assert result.decisions["c1"].verification["sections"]["watch"]["dangling"] == [
        "cal:INVENTED:next"
    ]
    assert result.sections_dropped == 1


def test_the_watch_list_is_capped_at_two() -> None:
    """A "what's coming" list of six is a diary, not a signal."""
    extra = CalendarRef(
        stat_id="cal:CPI:next", key="CPI", code="CPI", kind="macro",
        title="CPI print", date=date(2026, 7, 16),
    )
    third = CalendarRef(
        stat_id="cal:FOMC:next", key="FOMC", code="FOMC", kind="macro",
        title="FOMC minutes", date=date(2026, 7, 17),
    )
    cluster = _deep_cluster()
    cluster = NoteInput(**{**cluster.__dict__, "calendar": (_CAL, extra, third)})

    result = gate_notes(
        [ClusterNote(cluster_id="c1", watch=["cal:BKR:next", "cal:CPI:next", "cal:FOMC:next"])],
        clusters=[cluster], stats=_stats(), instruments=["BKR"], run_date=RUN_DATE,
    )

    assert len(result.decisions["c1"].watch) == 2


def test_a_watch_on_a_cluster_outside_the_budget_never_publishes() -> None:
    result = _gate_v2(watch=["cal:BKR:next"], cluster=_cluster())

    assert result.decisions["c1"].watch == []
    assert result.decisions["c1"].verification["sections"]["watch"]["status"] == "out_of_budget"


# ----- the silent case, and the counts -----

def test_a_narrator_with_nothing_to_say_in_ANY_section_is_silent_not_dropped() -> None:
    result = _gate_v2()

    decision = result.decisions["c1"]
    assert result.silent == 1
    assert result.dropped == 0
    assert all(
        section["status"] == "silent" for section in decision.verification["sections"].values()
    )


def test_the_cleared_list_covers_every_section_that_survived() -> None:
    """Q-PD5-1, on the news side. The story page emphasizes a figure in the context prose only if it
    is in HERE — the gate's own record of what it checked and cleared."""
    result = _gate_v2(
        why="The $13.6B deal clears.",
        context="The move is 2.8x its normal daily range (ATR14).",
    )

    verification = result.decisions["c1"].verification
    assert "$13.6B" in verification["cleared"]
    assert "2.8x" in verification["cleared"]
    assert "2.8x" in verification["sections"]["context"]["cleared"]


def test_a_dropped_section_contributes_NOTHING_to_the_allow_list() -> None:
    """An allow-list built from prose that never published would license the app to emphasize a
    figure the reader cannot see — and, worse, would carry the numbers out of a section the gate
    threw away."""
    result = _gate_v2(
        why="The $13.6B deal clears.",
        context="The move is 2.8x its normal range, and it sits 91.7% up its 52-week range.",
    )

    verification = result.decisions["c1"].verification
    assert verification["sections"]["context"]["status"] == "dropped"
    assert "2.8x" not in verification["cleared"], "a dropped section leaked into the allow-list"
    assert "$13.6B" in verification["cleared"]


# ----- 9.5: the cost instrument -----

def test_usage_is_priced_from_the_api_s_own_numbers() -> None:
    usage = Usage(calls=1, in_tokens=1_000_000, out_tokens=1_000_000)

    assert usage.dollars("claude-haiku-4-5") == pytest.approx(1.00 + 5.00)
    assert usage.dollars("claude-sonnet-5") == pytest.approx(3.00 + 15.00)


def test_a_model_with_no_price_costs_a_visible_nothing() -> None:
    """A guessed rate is a lie the reader cannot check. A missing one is visibly missing."""
    assert Usage(calls=1, in_tokens=1_000_000).dollars("claude-unknown-9") == 0.0


def test_run_narration_meters_BOTH_stages_from_the_api_s_usage_block() -> None:
    """The metering proxy sees every call either stage makes, and `briefing/extract.py` never learns
    it is being counted — which is the right outcome: a module that reads articles should not also
    be a ledger."""

    class _Usage:
        def __init__(self, i, o):
            self.input_tokens = i
            self.output_tokens = o

    class _MeteredMessage(_Message):
        def __init__(self, text, i, o):
            super().__init__(text)
            self.usage = _Usage(i, o)

    class _Client:
        def __init__(self):
            self.messages = self
            self.calls = 0

        def create(self, **kwargs):
            self.calls += 1
            if kwargs["model"] == "claude-haiku-4-5":
                return _MeteredMessage(_EXTRACT_JSON, 500, 100)
            return _MeteredMessage(_noteset_json(), 2000, 400)

    story = Story(
        cluster_id="c1", headline="H", event_type="ma", sectors=["Energy"],
        tickers=("BKR",), sources=2,
        article={"id": "a1", "headline": "H", "snippet": "s", "url": "u", "tickers": ["BKR"]},
    )
    result = run_narration(
        _Client(), stage_a=[story], stage_b_ids=["c1"],
        moves={"BKR": TickerMove(symbol="BKR", ret1=0.034, atr14_pct=0.02)},
        rvol={"BKR": 1.2}, instruments=["BKR"], run_date=RUN_DATE,
        model_extract="claude-haiku-4-5", model_synth="claude-sonnet-5",
    )

    assert result.usage["claude-haiku-4-5"].in_tokens == 500
    assert result.usage["claude-sonnet-5"].out_tokens == 400
    meta = result.model_meta(model_extract="claude-haiku-4-5", model_synth="claude-sonnet-5")
    assert meta["note_version"] == NOTE_VERSION
    assert meta["usage"]["claude-sonnet-5"]["out_tokens"] == 400
    assert "$" in result.cost_summary()


_EXTRACT_JSON = (
    '{"doc_id": "a1", "headline_neutral": "Baker Hughes wins EU approval", '
    '"summary": "The Commission cleared it.", "tickers": ["BKR"], "event_type": "ma", '
    '"sentiment": 0.2, "key_numbers": [{"value_str": "$13.6B", "what": "deal value"}], "quote": null}'
)


# ----- the token cap, and the outage that found it (PD7's real dispatch) -----
#
# THE WHOLE SUITE WAS GREEN WHILE PRODUCTION PUBLISHED NOTHING. The fake clients above have no token
# cap to overflow, so nothing here could see that the v2 schema had outgrown `max_tokens` — the first
# live `news` run came back with 2 calls, 16,384 output tokens (exactly 2 x 8192, the cap hit dead-on
# both times) and zero notes. These tests cannot reproduce a real truncation either; what they CAN do
# is pin the two constants that were wrong, so nobody quietly puts them back.

def test_the_output_cap_has_room_for_the_v2_schema() -> None:
    """~4,000 tokens of JSON plus a bounded reasoning budget. 8192 was not enough for both, and the
    way it failed — a truncated JSON document the tolerant parser reports as "malformed" — names no
    cause anywhere. A cap that fails silently must be a cap nobody has to guess at."""
    from newsdesk.narrate import _MAX_TOKENS

    assert _MAX_TOKENS >= 16000


def test_the_narrator_bounds_its_reasoning_budget() -> None:
    """`max_tokens` caps THINKING PLUS TEXT, and Sonnet 5 thinks by default when `thinking` is
    omitted — a default that changed with the model, not with our code. Unbounded adaptive thinking
    is what ate a budget sized for the JSON alone."""
    from newsdesk.narrate import _EFFORT

    assert _EFFORT in ("low", "medium")


def test_effort_rides_inside_output_config_where_the_api_expects_it() -> None:
    """A top-level `effort` is a 400. This asserts the SHAPE of the call we actually send, which is
    the one thing a fake client can still tell the truth about."""
    client = FakeClient(_noteset_json())

    narrate(client, [_cluster()], _stats(), model="claude-sonnet-5")

    sent = client.calls[0]
    assert sent["max_tokens"] >= 16000
    assert sent["output_config"]["effort"] == "medium"
    assert sent["output_config"]["format"]["type"] == "json_schema"
    assert "effort" not in sent, "effort is not a top-level parameter — it belongs in output_config"


def test_a_SILENT_narrator_on_a_cluster_OUTSIDE_the_budget_says_out_of_budget() -> None:
    """The `sections` map exists to distinguish absences that print identically, so it may not be
    sloppy about WHICH absence this is.

    A cluster outside the top 8 was never ASKED for a context. "The narrator had nothing to add" is
    not what happened to it — nobody put the question. The first live run made the bug visible in
    arithmetic: 13 sections came back `silent` on a page where only 8 clusters are ever deep.
    """
    result = _gate_v2(cluster=_cluster())  # not deep, and the narrator wrote nothing at all

    sections = result.decisions["c1"].verification["sections"]
    assert result.silent == 1
    assert sections["why_it_matters"]["status"] == "silent"   # it WAS asked, and had nothing
    assert sections["context"]["status"] == "out_of_budget"   # it was never asked
    assert sections["watch"]["status"] == "out_of_budget"


def test_a_SILENT_narrator_on_a_DEEP_cluster_really_is_silent() -> None:
    """The other half. A deep cluster was handed its stat block and still had nothing to say — that
    IS an honest silence, and the record must not cry budget over it."""
    result = _gate_v2()  # deep, narrator wrote nothing

    sections = result.decisions["c1"].verification["sections"]
    assert sections["context"]["status"] == "silent"
    assert sections["watch"]["status"] == "silent"
