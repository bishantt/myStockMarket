"""
narrate.py — the Front Page's one line of prose, and the gate that can delete it (plan 7.5, App. D).

Everything else in the newsdesk is deterministic. This module is the one place a language model
touches the front page, and it is deliberately the LAST thing to run and the FIRST thing to be
thrown away: `ingest.py` has already found the stories, linked the companies and put them in order
before a single token is generated, so if every model call failed tonight the page would still be
the right stories in the right order — missing only their context lines.

Two stages, both small:

  Stage A (Haiku, one call per story, capped): read ONE representative article per cluster and
    return the structured extract — the same `ExtractResult` the evening briefing has used since P3,
    through the same prompt and the same parser. A malformed extract is dropped, never fatal.

  Stage B-mini (Sonnet, ONE call for the whole page): write, per cluster, `why_it_matters` — the
    "so what", the MECHANISM this class of event moves — and `affected_note` where the effect is
    wider than the named tickers.

**The narrator is never shown a rank.** Significance is computed from evidence by `rank.py`, and the
score does not appear in the prompt. If it did, the model could write prose that explains why a
story deserves the top slot — which is the app forming an editorial opinion by the back door, and
ruling C1 forbids it. The model explains mechanisms; the pipeline decides order; the two never meet.

**The gate runs on every note regardless, and its failure mode is SILENT.** A dropped note becomes
null, and a null prints nothing on the card — by design (P9: never a placeholder). Which means a gate
that was too strict, or a Stage B that never ran at all, would produce a page that looks exactly like
a page the narrator honestly had nothing to add to. Nothing on screen could tell you which. So every
outcome here is COUNTED, the counts travel back to the job, and the night prints them.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Iterable

from pydantic import BaseModel, ConfigDict, Field

from briefing.extract import sync_extract
from briefing.schema import ExtractResult, api_schema
from briefing.stats import build_ticker_stats
from briefing.verify import Stat, build_source_set, check_text

# The card gives the line one line. Enforced on parse, because the API treats a length limit in the
# schema as a hint and pydantic treats it as a contract.
WHY_MAX_CHARS = 160
AFFECTED_MAX_CHARS = 120

# One note per story for the whole page; the page is capped at 20 stories upstream.
_MAX_TOKENS = 4096

# How long Stage A may spend reading articles before it gives up on the tail.
#
# Job A runs at 22:37 UTC and Job B at 00:25 UTC, so there is nearly two hours of slack — but slack
# is not a licence to use it. The facts are already computed when this stage starts, and every extra
# minute here is a minute the front page is not published for a reason nobody would accept: a
# context line. Six minutes reads a healthy night's 60 articles with room to spare, and caps the
# damage of a bad one.
EXTRACT_BUDGET_SECONDS = 360.0

# The per-call bound on the model client. The SDK's default is TEN MINUTES with retries on top,
# which is how 60 sequential calls became a twenty-minute stage on the first live run.
CALL_TIMEOUT_SECONDS = 30.0
CALL_MAX_RETRIES = 2

# The Stage B-mini system prompt, verbatim from Appendix D.
_SYSTEM = (
    "You write one-line context notes for a beginner's market front page, in mechanical third "
    "person. Inputs: per-catalyst structured extracts (with doc_ids) and a computed-stats table "
    "(with stat_ids). For each catalyst, write why_it_matters: what MECHANISM this kind of event "
    "moves — the \"so what\", never a restatement of the headline, never a prediction, never "
    "advice. RULES: every number you use appears VERBATIM in the inputs and is cited by id; no "
    "advice verbs (buy/sell/should); no directional forecasts; if the event plausibly affects a "
    "sector beyond the named tickers, say so in affected_note, mechanically; if you cannot add "
    "context beyond the headline, return why_it_matters as null — an honest null beats padding."
)


class ClusterNote(BaseModel):
    """One story's context line, as the model returns it — before the gate has looked at it."""

    model_config = ConfigDict(extra="forbid")

    cluster_id: str = Field(min_length=1)
    why_it_matters: str | None = Field(default=None, max_length=WHY_MAX_CHARS)
    affected_note: str | None = Field(default=None, max_length=AFFECTED_MAX_CHARS)
    citations: list[str] = Field(default_factory=list)


class NoteSet(BaseModel):
    """Stage B-mini's whole output: one pass over the narrated top of the page."""

    model_config = ConfigDict(extra="forbid")

    notes: list[ClusterNote] = Field(default_factory=list)


@dataclass(frozen=True)
class NoteInput:
    """What the narrator is allowed to know about one story. Note what is absent: the significance
    score, its rank, and its position on the page."""

    cluster_id: str
    headline: str
    event_type: str
    sectors: list[str]
    tickers: tuple[str, ...]
    sources: int
    extract: ExtractResult | None


@dataclass(frozen=True)
class NoteDecision:
    """What actually publishes for one cluster, and the record of why."""

    why_it_matters: str | None
    affected_note: str | None
    verification: dict


@dataclass
class NarrationResult:
    """The night's prose, with its outcomes counted.

    `narrated` + `dropped` + `silent` must account for every cluster the narrator was asked about.
    The counts are the only instrument that can tell a working narrator with nothing to say apart
    from a broken one — on the page, both print nothing.
    """

    decisions: dict[str, NoteDecision] = field(default_factory=dict)
    # The Stage-A extract for each story that produced one, keyed by CLUSTER id and already in JSON
    # form — this is what lands in news_cluster.extract, and what the story page shows as the facts
    # the note was written from. A story with no entry here published without an extract.
    extracts: dict[str, dict] = field(default_factory=dict)
    narrated: int = 0
    dropped: int = 0
    silent: int = 0
    extracted: int = 0
    extract_attempted: int = 0
    extract_timed_out: bool = False
    narration_failed: bool = False

    def summary(self) -> str:
        """One plain-English line for the night's log. It states what was attempted as well as what
        landed, because "0 notes" and "0 notes out of 20 attempted" are different nights."""
        gave_up = " (gave up on the rest — out of time)" if self.extract_timed_out else ""
        if self.narration_failed:
            return (
                f"narration: {self.extracted}/{self.extract_attempted} extracted{gave_up}, "
                f"the narrator failed its schema twice — the page publishes without prose"
            )
        return (
            f"narration: {self.extracted}/{self.extract_attempted} extracted{gave_up}, "
            f"{self.narrated} notes written, {self.dropped} dropped by the gate, "
            f"{self.silent} left blank by the narrator"
        )


def notes_json_schema() -> dict:
    """The structured-output schema for the Stage B-mini call, derived from the pydantic model."""
    return api_schema(NoteSet)


def narrate(
    client: Any,
    clusters: list[NoteInput],
    stats: Iterable[Stat],
    *,
    model: str,
) -> NoteSet | None:
    """Make the one Stage B-mini call and return the parsed notes, or None after a second failure.

    A None return is not an error state: the caller writes null notes and the page publishes its
    facts without prose (Appendix D). A night with no clusters makes no call at all — an empty page
    does not pay for a model call to tell it so.
    """
    if not clusters:
        return None

    system, user = build_notes_prompt(clusters, list(stats))
    messages: list[dict] = [{"role": "user", "content": user}]

    for _attempt in range(2):
        text = _message_text(_create(client, model, system, messages))
        notes = _parse_notes(text)
        if notes is not None:
            return notes
        # Append the failed attempt and a correction turn, then retry once (Appendix D).
        messages.append({"role": "assistant", "content": text})
        messages.append(
            {
                "role": "user",
                "content": (
                    "That response did not satisfy the required JSON schema. Return ONLY a single "
                    "JSON object matching the schema, with no prose before or after it."
                ),
            }
        )
    return None


def build_notes_prompt(clusters: list[NoteInput], stats: list[Stat]) -> tuple[str, str]:
    """Assemble the (system, user) prompt: the stories with their ids and extracts, then the stats
    table. Every number the model is permitted to write appears here with an id to cite it by, and
    the gate afterwards checks the prose against these same sources."""
    lines: list[str] = ["CATALYSTS (write one note per cluster_id):"]
    for cluster in clusters:
        tickers = ", ".join(cluster.tickers) or "(none named)"
        sectors = ", ".join(cluster.sectors) or "(none)"
        lines.append(
            f"- cluster_id={cluster.cluster_id} | {cluster.event_type} | tickers={tickers} | "
            f"sectors={sectors} | outlets={cluster.sources} | headline={cluster.headline}"
        )
        extract = cluster.extract
        if extract is None:
            # Stated rather than hidden: Stage A drops a malformed article, so a story can reach the
            # narrator with its headline and nothing else. The model may still write from that — or
            # honestly return null.
            lines.append("    (no extract — write from the headline alone, or return null)")
            continue
        numbers = "; ".join(f"{kn.value_str} ({kn.what})" for kn in extract.key_numbers) or "(none)"
        lines.append(
            f"    doc_id={extract.doc_id} | numbers={numbers} | summary={extract.summary}"
        )

    lines.append("")
    lines.append("STATS (cite by stat_id; copy the value verbatim):")
    if not stats:
        lines.append("(none tonight)")
    for stat in stats:
        label = f" ({stat.label})" if stat.label else ""
        lines.append(f"- stat_id={stat.stat_id} = {stat.value}{label}")

    return _SYSTEM, "\n".join(lines)


def gate_notes(
    notes: Iterable[ClusterNote],
    *,
    clusters: list[NoteInput],
    stats: Iterable[Stat],
    instruments: Iterable[str],
    run_date: date,
) -> NarrationResult:
    """Check every note against its OWN cluster's sources and return what may publish.

    Per-cluster on purpose. A figure lifted from another story is a real number in the world and
    still a fabrication on this card — the same shape as the VHI bug, where every number on the card
    was true and the card was a lie.

    The verdict is harsher than the briefing's, and it should be. The brief tolerates up to two flags
    across a whole page of prose because holding the entire briefing over one bad figure costs the
    reader everything. A note is one sentence: dropping it costs the reader that sentence, and the
    facts on the card stand without it. So ANY flag drops the note — and it drops the sentence beside
    it too, because a model that invented one figure has not earned the benefit of the doubt on the
    next one.
    """
    stats = list(stats)
    instruments = list(instruments)
    by_id = {cluster.cluster_id: cluster for cluster in clusters}
    result = NarrationResult()

    for note in notes:
        cluster = by_id.get(note.cluster_id)
        if cluster is None:
            # The model was handed the cluster ids and may only write about those. An invented id is
            # not a story, and it never reaches the publish transaction.
            continue

        if note.why_it_matters is None and note.affected_note is None:
            # An honest null: "nothing to add beyond the headline". The system working, not failing.
            result.decisions[note.cluster_id] = NoteDecision(
                why_it_matters=None,
                affected_note=None,
                verification={"narrated": False, "reason": "the narrator had nothing to add"},
            )
            result.silent += 1
            continue

        sources = build_source_set(
            extracts=[cluster.extract] if cluster.extract is not None else [],
            stats=stats,
            instruments=instruments,
            run_date=run_date,
        )

        flags: list = []
        checked = 0
        for location, text in (
            ("why_it_matters", note.why_it_matters),
            ("affected_note", note.affected_note),
        ):
            if not text:
                continue
            found, count = check_text(sources, text, location=location)
            flags.extend(found)
            checked += count

        if flags:
            result.decisions[note.cluster_id] = NoteDecision(
                why_it_matters=None,
                affected_note=None,
                verification={
                    "narrated": False,
                    "dropped": True,
                    "reason": "an entity in the note traced back to no source",
                    "checked": checked,
                    "citations": list(note.citations),
                    "flags": [flag.to_json() for flag in flags],
                },
            )
            result.dropped += 1
            continue

        result.decisions[note.cluster_id] = NoteDecision(
            why_it_matters=note.why_it_matters,
            affected_note=note.affected_note,
            verification={
                "narrated": True,
                "checked": checked,
                "citations": list(note.citations),
                "flags": [],
            },
        )
        result.narrated += 1

    return result


def run_narration(
    client: Any,
    *,
    stage_a: list["Story"],
    stage_b_ids: list[str],
    moves: dict,
    rvol: dict,
    instruments: Iterable[str],
    run_date: date,
    model_extract: str,
    model_synth: str,
    clock: Callable[[], float] = time.monotonic,
    extract_budget: float = EXTRACT_BUDGET_SECONDS,
) -> NarrationResult:
    """
    Both stages, end to end: read the top stories, write their context lines, gate every line.

    `stage_a` is the capped list of stories to extract (each carrying its ONE representative
    article); `stage_b_ids` names the subset that gets prose — a subset by construction, because
    both caps rank by significance (see `ingest.stage_a_clusters`).

    Nothing here can take the page down. A failed extract is a story without an extract; a failed
    narration call is a page without prose; a flagged note is a story without a line. In every one of
    those the facts — the headline, the companies, the numbers, the order — publish exactly as they
    would have. That is the whole reason the model runs last.

    AND NOTHING HERE MAY HOLD THE NIGHT OPEN. Stage A makes up to 60 sequential calls, and the
    Anthropic SDK's default per-call timeout is TEN MINUTES with retries on top — so one slow night
    at the provider could keep the publish waiting for hours while the facts, already computed, sat
    in memory. The first live run sat in this stage for over twenty minutes. The prose is the least
    important thing in the pipeline; it does not get to make the page late. When the budget is gone
    the extractor stops, the remaining stories go to the narrator with their headlines, and the page
    ships. The night says how many it gave up on.
    """
    started = clock()
    extracts = sync_extract(
        client,
        [story.article for story in stage_a],
        model=model_extract,
        out_of_time=lambda: clock() - started >= extract_budget,
    )

    result = NarrationResult()
    result.extracted = len(extracts)
    result.extract_attempted = len(stage_a)
    result.extract_timed_out = len(extracts) < len(stage_a) and clock() - started >= extract_budget
    result.extracts = {
        story.cluster_id: extracts[story.article["id"]].model_dump(mode="json")
        for story in stage_a
        if story.article["id"] in extracts
    }

    narrated_ids = set(stage_b_ids)
    narrated_stories = [story for story in stage_a if story.cluster_id in narrated_ids]
    inputs = [story.to_note_input(extracts.get(story.article["id"])) for story in narrated_stories]
    if not inputs:
        return result

    symbols = [symbol for story in narrated_stories for symbol in story.tickers]
    stats = build_ticker_stats(symbols, moves=moves, rvol=rvol)

    noteset = narrate(client, inputs, stats, model=model_synth)
    if noteset is None:
        # Two schema failures. The page publishes its facts and says so in the log.
        result.narration_failed = True
        return result

    gated = gate_notes(
        noteset.notes,
        clusters=inputs,
        stats=stats,
        instruments=instruments,
        run_date=run_date,
    )
    gated.extracts = result.extracts
    gated.extracted = result.extracted
    gated.extract_attempted = result.extract_attempted
    gated.extract_timed_out = result.extract_timed_out
    return gated


@dataclass(frozen=True)
class Story:
    """One cluster paired with the single article the extractor will read for it."""

    cluster_id: str
    headline: str
    event_type: str
    sectors: list[str]
    tickers: tuple[str, ...]
    sources: int
    article: dict  # the representative, in the {id, headline, snippet, url, tickers} extract shape

    def to_note_input(self, extract: ExtractResult | None) -> NoteInput:
        return NoteInput(
            cluster_id=self.cluster_id,
            headline=self.headline,
            event_type=self.event_type,
            sectors=self.sectors,
            tickers=self.tickers,
            sources=self.sources,
            extract=extract,
        )


# ----- internals -----

def _create(client: Any, model: str, system: str, messages: list[dict]) -> Any:
    """One structured-output Stage B-mini call."""
    return client.messages.create(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=system,
        messages=messages,
        output_config={"format": {"type": "json_schema", "schema": notes_json_schema()}},
    )


def _parse_notes(text: str) -> NoteSet | None:
    """Parse the model text into a NoteSet, tolerating prose around the JSON object."""
    from briefing.extract import _extract_json_object  # the shared tolerant JSON finder

    payload = _extract_json_object(text)
    if payload is None:
        return None
    try:
        return NoteSet.model_validate(payload)
    except Exception:  # noqa: BLE001 — an invalid note set triggers the retry, then a page with no prose
        return None


def _message_text(message: Any) -> str:
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""
