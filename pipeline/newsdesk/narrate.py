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

from briefing.depth import CalendarRef
from briefing.extract import sync_extract
from config import price_per_mtok
from briefing.lexicon import lexicon_flags
from briefing.schema import ExtractResult, api_schema
from briefing.stats import build_ticker_stats
from briefing.verify import Stat, build_source_set, check_text

# The card gives the line one line. Enforced on parse, because the API treats a length limit in the
# schema as a hint and pydantic treats it as a contract.
WHY_MAX_CHARS = 160
AFFECTED_MAX_CHARS = 120

# PD7 (plan 9.3): the v2 insight's two new sections.
#
# `context` is 2–3 mechanical sentences, so it gets ~3x the room of a why-line — enough to place the
# move against the name's own volatility, its 52-week position and its sector's night, and no more.
# A cap is a promise about the shape of the thing: 420 characters cannot hold an essay, and the story
# page's layout is built for a paragraph, not a column.
CONTEXT_MAX_CHARS = 420
# At most two dated facts. A "what's coming" list of six is a diary, not a signal, and the reader is
# being told what is SCHEDULED — a fact with a date — never what to do about it (E4).
WATCH_MAX_REFS = 2

# The note schema's version, stamped into model_meta so a row can always say which contract wrote it.
# A pre-PD7 row carries no version at all, and that absence is itself the answer (v1).
NOTE_VERSION = 2

# One note per story for the whole page; the page is capped at 20 stories upstream.
#
# 4096 was too tight and it failed SILENTLY, which is the worst way for a token cap to fail. Twenty
# notes, each with a 40-character cluster id, a 160-character sentence, a 120-character note and its
# citations, is comfortably over 2,500 tokens of JSON before any slack. Run out mid-object and the
# response is a TRUNCATED JSON document — which the tolerant parser cannot balance, so it reports
# "malformed" and the page loses all its prose, with nothing anywhere saying "you ran out of room".
#
# **AND THEN 8192 WAS TOO TIGHT, THE SAME WAY, AND PD7's REAL DISPATCH IS THE ONLY THING THAT FOUND
# IT.** The first live `news` run after the v2 schema landed came back: 2 calls, 16,384 output
# tokens — EXACTLY 2 x 8192, the cap hit dead-on both times — and the night printed "the narrator
# failed its schema twice; the page publishes without prose." Production went from 5 notes to ZERO,
# and every test in this repo stayed green, because the fake clients in the suite have no token cap
# to overflow. This is the SAME BUG the paragraph above was written for, one cap-size up.
#
# TWO THINGS ATE THE BUDGET, and only one of them was obvious:
#   1. v2 output is bigger — 8 clusters now also carry a 420-char `context` and a `watch` array. But
#      that is only ~1,000 extra tokens; the whole response is ~4,000 tokens of JSON. It alone could
#      never have reached 8192. Plan 9.3 said "output cap rises to fit 8x context sections" and PD7
#      simply missed the instruction.
#   2. **`max_tokens` CAPS THINKING PLUS TEXT, AND SONNET 5 THINKS BY DEFAULT.** On Sonnet 4.6, a
#      request that omits `thinking` runs with it OFF. On Sonnet 5 the identical request runs with
#      ADAPTIVE THINKING — a silent default change that arrived with the model, not with our code.
#      So the reasoning tokens were quietly consuming a budget sized for the JSON alone. Nothing in
#      this file asked for thinking; it simply started happening.
#
# 16000 leaves ~12,000 tokens of room for reasoning above a ~4,000-token response, and stays under
# the ~16K line above which a non-streaming request risks an SDK HTTP timeout — so the fix needs no
# streaming rewrite. `effort` (below) is what keeps the reasoning from expanding to fill it.
_MAX_TOKENS = 16000

# The reasoning budget, bounded on purpose (a Sonnet 5 control; it does not exist on Haiku, so the
# extraction stage neither sets it nor may).
#
# "medium" and not "low": the narrator is not merely transcribing. It chooses WHICH computed stats
# belong in a two-sentence context, and it has to write a mechanism rather than restate a headline —
# and Sonnet 5 respects low effort strictly enough that under-thinking is a real risk on exactly that
# kind of judgement. It is also not "high": nothing here is an open-ended problem, and unbounded
# adaptive thinking is what silently overflowed the cap in the first place. Medium is the setting
# that says: think enough to choose well, and stop.
_EFFORT = "medium"

# How long Stage A may spend reading articles before it gives up on the tail.
#
# Job A runs at 22:37 UTC and Job B at 00:25 UTC, so there is nearly two hours of slack — but slack
# is not a licence to use it. The facts are already computed when this stage starts, and every extra
# minute here is a minute the front page is not published for a reason nobody would accept: a
# context line. Six minutes reads a healthy night's 60 articles with room to spare, and caps the
# damage of a bad one.
EXTRACT_BUDGET_SECONDS = 360.0

# The per-call bound on the model client. The SDK's default is TEN MINUTES with retries on top, which
# is how 60 sequential calls became a twenty-minute stage on the first live run.
#
# 30 SECONDS WAS TOO TIGHT, and production said so on the very next run: an extraction call timed out
# and — because a failed call used to take the whole stage down with it — the night reported "0 of 0
# extracted". A bound that trips on a healthy night is not a safety rail, it is an outage. 90 seconds
# is far above what a 1024-token Haiku extract takes and far below anything that could hold the page.
CALL_TIMEOUT_SECONDS = 90.0
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
    "context beyond the headline, return why_it_matters as null — an honest null beats padding. "
    # THE LIMITS HAVE TO BE IN THE PROMPT, and this is not belt-and-braces — it is the ONLY place the
    # model can learn them. The API does not enforce string lengths: `api_schema` strips `maxLength`
    # before the schema is sent, because the structured-output layer rejects it. So pydantic enforced
    # a cap on the way back in that nobody had ever stated on the way out, and in production every
    # note the narrator wrote was thrown away for breaking a rule it had never been given.
    f"HARD LIMITS: why_it_matters is at most {WHY_MAX_CHARS} characters and affected_note at most "
    f"{AFFECTED_MAX_CHARS} characters, INCLUDING spaces. A note that runs past its limit is dropped "
    "and the story publishes with no note at all, so a shorter true sentence always beats a longer one. "
    # --- PD7, the v2 sections (Appendix C, verbatim contract) ---
    #
    # DEPTH IS PERMISSION TO SAY MORE, NOT PERMISSION TO KNOW MORE. Every rule the one-liner obeyed
    # applies here unchanged; the only thing that grew is the VOCABULARY, and it grew because the
    # pipeline computed more (9.2), not because the model was trusted more.
    "SOME clusters are marked DEEP and carry a per-ticker stat block and dated calendar rows. For "
    f"those, ALSO write: context (at most {CONTEXT_MAX_CHARS} characters) — 2 to 3 mechanical "
    "sentences placing tonight's move: its scale against the name's OWN normal daily range, where "
    "the name sits in its 52-week range, its recent streak or distance from its 50-day average, what "
    "its sector did tonight, and how often this story has recurred this week. EVERY number in it "
    "must appear VERBATIM in the stats you were given and be cited by its stat_id. "
    f"AND: watch (at most {WATCH_MAX_REFS} entries) — the stat_ids of already-scheduled calendar "
    "events a reader should know are dated. You may ONLY SELECT ids from the calendar rows provided "
    "to you; you may NEVER write a calendar entry, a threshold, or a level. "
    "RULES FOR EVERY SECTION, without exception: no advice verbs (buy, sell, should, add, trim, take "
    "profits, accumulate, avoid); no directional forecasts of any kind; frequency words (usually, "
    "often, rarely, typically, tends) ONLY in a sentence that also cites a computed stat_id — an "
    "uncited 'usually' is a probability claim with no evidence and it will be deleted. If the inputs "
    "give you nothing beyond the headline, return null. An honest null beats padding. "
    # THE READER SEES THE PROSE. This sentence exists because the first live run did not have it, and
    # published "carried by 1 outlet tonight (cls:798fa63d...:corroboration)" — a sha1 hash in a
    # newspaper. Told to cite each number "by its stat_id", the model reasonably wrote the id where a
    # reader could see it. The `citations` array is where ids live; the gate now enforces it.
    "HOW TO CITE: put the stat_ids and doc_ids in the `citations` array. NEVER write a stat_id, a "
    "doc_id, a cluster_id or any hash INSIDE the prose — a human reads the prose, and an identifier "
    "in a sentence is not English. Write the VALUE (\"2.3x its normal daily range\"), and put the ID "
    "in `citations`. A section containing an identifier is deleted."
)


class ClusterNote(BaseModel):
    """One story's insight, as the model returns it — before the gate has looked at it.

    v2 (PD7) adds `context` and `watch`. Both are OPTIONAL at the schema level even for the deep
    clusters, because "I had nothing to add" must remain a legal answer at every level of depth —
    the moment a section becomes mandatory, the model starts padding to fill it, and padding is
    exactly what the honest-null rule exists to prevent.
    """

    model_config = ConfigDict(extra="forbid")

    cluster_id: str = Field(min_length=1)
    why_it_matters: str | None = Field(default=None, max_length=WHY_MAX_CHARS)
    affected_note: str | None = Field(default=None, max_length=AFFECTED_MAX_CHARS)
    context: str | None = Field(default=None, max_length=CONTEXT_MAX_CHARS)
    watch: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)


class NoteSet(BaseModel):
    """Stage B-mini's whole output: one pass over the narrated top of the page."""

    model_config = ConfigDict(extra="forbid")

    notes: list[ClusterNote] = Field(default_factory=list)


@dataclass
class Usage:
    """What one model actually cost, from the API's OWN usage fields. Never estimated, never counted
    by us — a token count this pipeline computed for itself would be a guess with a decimal point."""

    calls: int = 0
    in_tokens: int = 0
    out_tokens: int = 0

    def dollars(self, model: str) -> float:
        """The bill, in dollars. The only arithmetic here; the token counts are measured."""
        price_in, price_out = price_per_mtok(model)
        return (self.in_tokens / 1e6) * price_in + (self.out_tokens / 1e6) * price_out

    def to_json(self) -> dict:
        return {"calls": self.calls, "in_tokens": self.in_tokens, "out_tokens": self.out_tokens}


class _MeteredClient:
    """A thin proxy over the Anthropic client that records the usage of every call made through it.

    Why a proxy rather than threading a counter through both stages: BOTH stages call
    `client.messages.create(model=...)` — Stage A once per article in `briefing/extract.py`, Stage B
    once for the whole page here — so ONE interception point sees the entire night's spend, and
    neither stage has to learn about accounting. `extract.py` is untouched by 9.5, which is the right
    outcome: a module that reads articles should not also be a ledger.

    It buckets by the `model` argument, so the extract model and the synth model are priced apart
    without anyone having to tell it which is which.

    It is deliberately forgiving of a response with no `usage` block: the fake clients in the test
    suite return bare objects, and a metering wrapper that CRASHED the narration stage over a missing
    accounting field would be a cost instrument that takes the front page down. The prose is the least
    important thing in the pipeline; its bookkeeping is even less important than that.
    """

    def __init__(self, inner: Any, usage: dict[str, Usage]) -> None:
        self._inner = inner
        self.messages = _MeteredMessages(inner.messages, usage)


class _MeteredMessages:
    def __init__(self, inner: Any, usage: dict[str, Usage]) -> None:
        self._inner = inner
        self._usage = usage

    def create(self, **kwargs: Any) -> Any:
        response = self._inner.create(**kwargs)
        model = str(kwargs.get("model", "unknown"))
        bucket = self._usage.setdefault(model, Usage())
        bucket.calls += 1
        reported = getattr(response, "usage", None)
        if reported is not None:
            bucket.in_tokens += int(getattr(reported, "input_tokens", 0) or 0)
            bucket.out_tokens += int(getattr(reported, "output_tokens", 0) or 0)
        return response


@dataclass(frozen=True)
class NoteInput:
    """What the narrator is allowed to know about one story. Note what is absent: the significance
    score, its rank, and its position on the page.

    `deep` says whether this cluster is inside the depth budget (top 8) and therefore gets the v2
    treatment. `stats` is this cluster's OWN stat block and `calendar` its OWN dated rows — both are
    per-cluster, because the gate is per-cluster: a figure lifted from another story is a real number
    in the world and still a fabrication on THIS card.
    """

    cluster_id: str
    headline: str
    event_type: str
    sectors: list[str]
    tickers: tuple[str, ...]
    sources: int
    extract: ExtractResult | None
    deep: bool = False
    stats: tuple[Stat, ...] = ()
    calendar: tuple[CalendarRef, ...] = ()


@dataclass(frozen=True)
class NoteDecision:
    """What actually publishes for one cluster, and the record of why.

    `verification` carries a `sections` map in v2 — a per-field verdict of narrated / dropped /
    silent / out_of_budget. That map is the whole reason the story page can tell the reader WHY a
    section is absent instead of guessing, and it exists because of the N5 lesson: a section the gate
    deleted and a section the narrator had nothing to say in print the identical nothing, and no
    screen can tell them apart unless the pipeline writes down which one it was.
    """

    why_it_matters: str | None
    affected_note: str | None
    verification: dict
    context: str | None = None
    watch: list[dict] = field(default_factory=list)


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
    # PD7: the SECTION-level instrument. A v2 note has four sections and they are gated separately, so
    # the cluster-level counts above can no longer see everything — a story whose `context` the gate
    # deleted still counts as `narrated` if its why-line survived, and that is correct, and it is also
    # exactly how a broken depth stage would hide. This counter is what makes the deletion visible.
    sections_dropped: int = 0
    extracted: int = 0
    extract_attempted: int = 0
    extract_timed_out: bool = False
    narration_failed: bool = False
    # What the models actually cost tonight, from the API's OWN usage fields, bucketed by model (9.5).
    usage: dict[str, "Usage"] = field(default_factory=dict)

    def summary(self) -> str:
        """One plain-English line for the night's log. It states what was attempted as well as what
        landed, because "0 notes" and "0 notes out of 20 attempted" are different nights."""
        gave_up = " (gave up on the rest — out of time)" if self.extract_timed_out else ""
        if self.narration_failed:
            return (
                f"narration: {self.extracted}/{self.extract_attempted} extracted{gave_up}, "
                f"the narrator failed its schema twice — the page publishes without prose"
            )
        deep = sum(
            1 for decision in self.decisions.values() if decision.context is not None
        )
        return (
            f"narration: {self.extracted}/{self.extract_attempted} extracted{gave_up}, "
            f"{self.narrated} notes written, {self.dropped} dropped by the gate, "
            f"{self.silent} left blank by the narrator; "
            f"{deep} context sections published, {self.sections_dropped} sections dropped"
        )

    def cost_summary(self) -> str:
        """The night's LLM bill, in tokens and dollars, per model (9.5).

        MEASURED, NEVER ESTIMATED. The token counts come from the API's own `usage` block on each
        response; only the dollars are arithmetic, and the per-MTok prices they use are constants
        with a provenance comment in config.py. Plan 0.2.3 priced this phase's depth delta at
        ≈$0.03–0.06/night on top of ~$0.33 and explicitly said "measured at PD7's gate, not
        promised" — so this line is what does the measuring, every single night, forever.
        """
        if not self.usage:
            return "news LLM cost: nothing was spent (no model call ran tonight)"
        parts = []
        total = 0.0
        for model, usage in sorted(self.usage.items()):
            dollars = usage.dollars(model)
            total += dollars
            parts.append(
                f"{model}: {usage.calls} calls, {usage.in_tokens:,} in / "
                f"{usage.out_tokens:,} out = ${dollars:.4f}"
            )
        return f"news LLM cost: ${total:.4f} — " + " · ".join(parts)

    def model_meta(self, *, model_extract: str, model_synth: str) -> dict:
        """The per-night provenance block stamped onto every cluster this run wrote (9.5).

        The story page's provenance footer has been HARDCODING "Claude Haiku" — a claim the row could
        not support and nobody could check. Now the row carries what actually ran.
        """
        return {
            "model_extract": model_extract,
            "model_synth": model_synth,
            "extract_count": self.extracted,
            "note_version": NOTE_VERSION,
            "usage": {model: usage.to_json() for model, usage in sorted(self.usage.items())},
        }


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
        try:
            text = _message_text(_create(client, model, system, messages))
        except Exception as error:  # noqa: BLE001 — the narrator's outage is not the page's
            # Same rule as Stage A: a failed call is a page without prose, never a night without a
            # front page. The facts are already computed and ordered by the time this runs.
            print(f"narrate: the notes call failed ({error}); the page publishes without prose.")
            return None

        notes = _parse_notes(text)
        if notes is not None:
            return notes

        # SAY WHAT CAME BACK. A parse failure that prints nothing is a night that cannot be debugged
        # without re-running it against the live provider, which is exactly the position this stage
        # put us in: "failed its schema twice" is a symptom, and the response is the evidence.
        print(
            f"narrate: the notes response did not parse ({len(text)} chars). "
            f"First 200: {text[:200]!r}"
        )

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
        depth_marker = " | DEEP (also write context + watch)" if cluster.deep else ""
        lines.append(
            f"- cluster_id={cluster.cluster_id} | {cluster.event_type} | tickers={tickers} | "
            f"sectors={sectors} | outlets={cluster.sources} | headline={cluster.headline}"
            f"{depth_marker}"
        )
        extract = cluster.extract
        if extract is None:
            # Stated rather than hidden: Stage A drops a malformed article, so a story can reach the
            # narrator with its headline and nothing else. The model may still write from that — or
            # honestly return null.
            lines.append("    (no extract — write from the headline alone, or return null)")
        else:
            numbers = "; ".join(f"{kn.value_str} ({kn.what})" for kn in extract.key_numbers) or "(none)"
            lines.append(
                f"    doc_id={extract.doc_id} | numbers={numbers} | summary={extract.summary}"
            )

        # The per-cluster depth block. Only a DEEP cluster gets one, and it sits UNDER its story
        # rather than in the shared table below — a stat about SMCI's 52-week range has no business
        # being reachable from a note about the Fed, and the gate would refuse it anyway (it checks
        # each note against its OWN cluster's sources). Putting it here makes the prompt say the same
        # thing the gate enforces, which is the only way the model can succeed on purpose.
        if cluster.deep:
            for stat in cluster.stats:
                label = f" ({stat.label})" if stat.label else ""
                lines.append(f"    stat_id={stat.stat_id} = {stat.value}{label}")
            for ref in cluster.calendar:
                lines.append(
                    f"    cal_id={ref.stat_id} = {ref.date.isoformat()} ({ref.title}) "
                    f"— SELECT this id in `watch`; never write your own"
                )
            if not cluster.stats and not cluster.calendar:
                lines.append("    (no computed depth for this story — return context as null)")

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

        if not any((note.why_it_matters, note.affected_note, note.context, note.watch)):
            # An honest null: "nothing to add beyond the headline". The system working, not failing.
            result.decisions[note.cluster_id] = NoteDecision(
                why_it_matters=None,
                affected_note=None,
                verification={
                    "narrated": False,
                    "note_version": NOTE_VERSION,
                    "reason": "the narrator had nothing to add",
                    "sections": {
                        name: {"status": "silent"}
                        for name in ("why_it_matters", "affected_note", "context", "watch")
                    },
                },
            )
            result.silent += 1
            continue

        # THE SOURCES ARE PER-CLUSTER, and in v2 that now includes the cluster's OWN depth stats.
        # A figure lifted from another story is a real number in the world and still a fabrication on
        # this card — the same shape as the VHI bug, where every number on the card was true and the
        # card was a lie.
        cluster_stats = [*stats, *cluster.stats]
        sources = build_source_set(
            extracts=[cluster.extract] if cluster.extract is not None else [],
            stats=cluster_stats,
            instruments=instruments,
            run_date=run_date,
        )
        # E4's frequency rule is earned by a COMPUTED stat, never by a number the article happened to
        # contain — so the lexicon gets a source set built from the registry ALONE. See lexicon.py.
        stat_sources = build_source_set(
            extracts=[], stats=cluster_stats, instruments=[], run_date=run_date
        )

        sections: dict[str, dict] = {}
        flags: list = []
        cleared: list[str] = []
        checked = 0

        def review(location: str, text: str | None) -> tuple[list, list[str], int]:
            """Run BOTH gates over one prose section: the number gate and E4's lexicon."""
            if not text:
                return [], [], 0
            numbers = check_text(sources, text, location=location)
            words = lexicon_flags(text, stat_sources=stat_sources, location=location)
            return [*numbers.flags, *words], list(numbers.cleared), numbers.checked

        # ----- the v1 pair: why_it_matters + affected_note, still COUPLED -----
        #
        # 9.3's rule is that THE GATE EXTENDS, NOT RELAXES, and that decides this. Decoupling the
        # pair would be a RELAXATION: a note that is dropped whole today would start publishing half
        # of itself. The N5 argument that coupled them stands untouched — they are one thought (a
        # mechanism and its spillover clause), and a model that invented a figure in one has not
        # earned the benefit of the doubt in the other. What v2 adds is new sections, and a new
        # section may be gated independently without relaxing anything, because there was nothing
        # there before.
        pair_flags: list = []
        pair_cleared: list[str] = []
        for location, text in (
            ("why_it_matters", note.why_it_matters),
            ("affected_note", note.affected_note),
        ):
            found, cleared_here, count = review(location, text)
            pair_flags.extend(found)
            pair_cleared.extend(cleared_here)
            checked += count

        pair_dropped = bool(pair_flags)
        why = None if pair_dropped else note.why_it_matters
        affected = None if pair_dropped else note.affected_note
        for location, text in (("why_it_matters", why), ("affected_note", affected)):
            if pair_dropped:
                sections[location] = {"status": "dropped"}
            elif text:
                sections[location] = {"status": "narrated"}
            else:
                sections[location] = {"status": "silent"}
        if pair_dropped:
            flags.extend(pair_flags)
            result.sections_dropped += 1
        else:
            cleared.extend(pair_cleared)

        # ----- context: a NEW section, gated on its own (E3's guard names this exactly:
        # "that section — and only that section — is dropped and counted") -----
        context: str | None = None
        if not cluster.deep:
            # The depth budget is a budget. A context section on a cluster outside the top 8 was not
            # paid for and does not publish, even if the model volunteered one.
            sections["context"] = {"status": "out_of_budget"}
        elif not note.context:
            sections["context"] = {"status": "silent"}
        else:
            found, cleared_here, count = review("context", note.context)
            checked += count
            if found:
                flags.extend(found)
                sections["context"] = {
                    "status": "dropped",
                    "checked": count,
                    "flags": [flag.to_json() for flag in found],
                }
                result.sections_dropped += 1
            else:
                context = note.context
                cleared.extend(cleared_here)
                sections["context"] = {
                    "status": "narrated",
                    "checked": count,
                    # The allow-list for THIS section's prose (Q-PD5-1). The story page emphasizes a
                    # figure only if it is in here.
                    "cleared": cleared_here,
                }

        # ----- watch: verified STRUCTURALLY, not textually -----
        #
        # There is no prose to check. The narrator SELECTED ids, and the only question is whether each
        # one resolves to a calendar row this cluster was actually shown. A dangling ref is dropped —
        # never rendered, never guessed at. This is what makes "the LLM cannot author a calendar
        # entry" a property of the system rather than a request in a prompt.
        watch: list[dict] = []
        if not cluster.deep:
            sections["watch"] = {"status": "out_of_budget"}
        else:
            allowed = {ref.stat_id: ref for ref in cluster.calendar}
            dangling: list[str] = []
            for ref_id in note.watch:
                if len(watch) >= WATCH_MAX_REFS:
                    break
                ref = allowed.get(ref_id)
                if ref is None:
                    dangling.append(ref_id)
                    continue
                if any(entry["stat_id"] == ref.stat_id for entry in watch):
                    continue  # the same date twice is one fact, not two
                watch.append(ref.to_json())
            if dangling:
                result.sections_dropped += 1
            sections["watch"] = {
                "status": "narrated" if watch else ("dropped" if dangling else "silent"),
                "kept": len(watch),
                "dangling": dangling,
            }

        published = any((why, affected, context, watch))
        verification: dict = {
            "narrated": published,
            "note_version": NOTE_VERSION,
            "checked": checked,
            "citations": list(note.citations),
            "flags": [flag.to_json() for flag in flags],
        }
        if pair_dropped:
            # **THE v1 KEY STAYS, AND IT IS LOAD-BEARING IN PRODUCTION RIGHT NOW.**
            #
            # `lib/news.ts` reads `verification.dropped === true` to set `noteDropped`, which is how
            # the story page tells the reader "the gate held this line" instead of "the narrator had
            # nothing to add" — the N5 distinction, and the whole reason that field exists. PD7 is a
            # PIPELINE phase: it ships to production BEFORE PD8 builds the surfaces that read
            # `sections`. Replacing this key with the richer map would have blinded the live story
            # page the first night this ran, and NOTHING would have failed — the app reads an absent
            # key as `false` and says "the narrator had nothing to add" about a line the gate killed.
            #
            # So the new map is added ALONGSIDE the old key, not instead of it. `dropped` keeps its
            # exact v1 meaning — the why/affected PAIR was deleted — which is precisely what the app
            # means by it. PD8 may migrate to `sections` and retire this line; until it does, it stays.
            verification["dropped"] = True
            verification["reason"] = "an entity in the note traced back to no source"

        # The allow-list (Q-PD5-1), across every section that SURVIVED. A cluster already had
        # something that looked like one — its extract's `key_numbers` — but that is the list of
        # numbers the ARTICLE contained, not the list this gate CLEARED, and the two are not the
        # same claim. This one is.
        verification["cleared"] = _dedupe(cleared)
        verification["sections"] = sections

        result.decisions[note.cluster_id] = NoteDecision(
            why_it_matters=why,
            affected_note=affected,
            context=context,
            watch=watch,
            verification=verification,
        )
        if published:
            result.narrated += 1
        else:
            result.dropped += 1

    return result


def _dedupe(values: Iterable[str]) -> list[str]:
    """Order-preserving de-duplication. The cleared list is a set of PERMISSIONS — the same figure
    quoted twice is one permission, not two."""
    return list(dict.fromkeys(values))


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
    deep_ids: Iterable[str] = (),
    depth_stats: dict[str, list[Stat]] | None = None,
    calendar: dict[str, list[CalendarRef]] | None = None,
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
    # EVERY model call in both stages goes through this wrapper, which is the whole point: it is the
    # one place the night's token spend can be counted, and neither stage has to know it is being
    # counted (9.5). `sync_extract` below is completely untouched by the cost instrument.
    usage: dict[str, Usage] = {}
    client = _MeteredClient(client, usage)

    started = clock()
    extracts = sync_extract(
        client,
        [story.article for story in stage_a],
        model=model_extract,
        out_of_time=lambda: clock() - started >= extract_budget,
    )

    result = NarrationResult()
    result.usage = usage
    result.extracted = len(extracts)
    result.extract_attempted = len(stage_a)
    result.extract_timed_out = len(extracts) < len(stage_a) and clock() - started >= extract_budget
    result.extracts = {
        story.cluster_id: extracts[story.article["id"]].model_dump(mode="json")
        for story in stage_a
        if story.article["id"] in extracts
    }

    narrated_ids = set(stage_b_ids)
    deep = set(deep_ids)
    depth_stats = depth_stats or {}
    calendar = calendar or {}

    narrated_stories = [story for story in stage_a if story.cluster_id in narrated_ids]
    inputs = [
        story.to_note_input(
            extracts.get(story.article["id"]),
            deep=story.cluster_id in deep,
            stats=tuple(depth_stats.get(story.cluster_id, ())),
            calendar=tuple(calendar.get(story.cluster_id, ())),
        )
        for story in narrated_stories
    ]
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
    gated.usage = usage
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

    def to_note_input(
        self,
        extract: ExtractResult | None,
        *,
        deep: bool = False,
        stats: tuple[Stat, ...] = (),
        calendar: tuple[CalendarRef, ...] = (),
    ) -> NoteInput:
        return NoteInput(
            cluster_id=self.cluster_id,
            headline=self.headline,
            event_type=self.event_type,
            sectors=self.sectors,
            tickers=self.tickers,
            sources=self.sources,
            extract=extract,
            deep=deep,
            stats=stats,
            calendar=calendar,
        )


# ----- internals -----

def _create(client: Any, model: str, system: str, messages: list[dict]) -> Any:
    """One structured-output Stage B-mini call.

    `effort` rides INSIDE `output_config`, beside the format — it is not a top-level parameter, and
    putting it at the top level is a 400. See `_EFFORT` for why the reasoning budget is bounded at
    all: an unbounded one is what overflowed `max_tokens` and cost production every note it had.
    """
    return client.messages.create(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=system,
        messages=messages,
        output_config={
            "format": {"type": "json_schema", "schema": notes_json_schema()},
            "effort": _EFFORT,
        },
    )


def _parse_notes(text: str) -> NoteSet | None:
    """Parse the model text into a NoteSet, NOTE BY NOTE.

    Validating the whole set as one object was a mistake, and production found it: a single sentence
    forty characters too long invalidated the other nineteen, and the entire page published without
    prose. That is the same "one bad item kills the batch" disease the extraction stage had one layer
    up, and it is just as wrong here — a note is one sentence about one story, and its failure should
    cost exactly that story its sentence.

    So each note is validated alone and a bad one is dropped. The 160-character cap still bites (an
    over-long note does NOT publish), it simply no longer takes its neighbours with it.

    Returning None — which spends the one retry Appendix D allows — is reserved for a response that
    produced NO usable note at all. That is the signature of something systematically wrong with the
    response, and it is worth one more ask.
    """
    from briefing.extract import _extract_json_object  # the shared tolerant JSON finder

    payload = _extract_json_object(text)
    if payload is None:
        return None

    raw = payload.get("notes")
    if not isinstance(raw, list):
        return None

    notes: list[ClusterNote] = []
    for entry in raw:
        try:
            notes.append(ClusterNote.model_validate(entry))
        except Exception:  # noqa: BLE001 — one malformed note is one dropped note
            continue

    # An empty list the model MEANT is a valid answer ("nothing to add tonight"). An empty list
    # because everything failed to validate is not — that is a response worth asking again for.
    if raw and not notes:
        return None
    return NoteSet(notes=notes)


def _message_text(message: Any) -> str:
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""
