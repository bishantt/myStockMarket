"""
narrate.py — the Front Page's one line of prose, and the gate that can delete it (plan 7.5, App. D).

This is the one place a language model touches the front page. It runs LAST and is the first thing
thrown away: ingest.py has already found, linked and ordered the stories, so if every model call
failed the page would still be the right stories in the right order — missing only their context lines.

Two stages. Stage A (Haiku, one capped call per story) reads ONE article per cluster and returns the
same `ExtractResult` the evening briefing uses, through the same prompt and parser; a malformed
extract is dropped, never fatal. Stage B-mini (Sonnet, ONE call for the whole page) writes per cluster
`why_it_matters` (the "so what" — the mechanism) and `affected_note` where the effect is wider than
the named tickers.

The narrator is never shown a rank. rank.py computes significance from evidence and the score never
enters the prompt: if it did, the model could write prose justifying the top slot — the app forming
an editorial opinion by the back door, which ruling C1 forbids.

The gate runs on every note and its failure mode is SILENT: a dropped note becomes null and prints
nothing (P9: never a placeholder), which looks exactly like an honest null. So every outcome is
COUNTED, the counts travel back to the job, and the night prints them.
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

# PD7 (plan 9.3): the v2 insight's two new sections. `context` gets ~3x a why-line's room — enough to
# place the move against its own volatility, 52-week position and sector, and no more; the cap promises
# shape, since the page's layout is built for a paragraph, not a column.
CONTEXT_MAX_CHARS = 420
# At most two dated facts. A "what's coming" list of six is a diary, not a signal, and the reader is
# being told what is SCHEDULED — a fact with a date — never what to do about it (E4).
WATCH_MAX_REFS = 2

# The note schema's version, stamped into model_meta so a row can always say which contract wrote it.
# A pre-PD7 row carries no version at all, and that absence is itself the answer (v1).
NOTE_VERSION = 2

# One note per story for the whole page; the page is capped at 20 stories upstream.
#
# A too-tight cap fails SILENTLY, the worst way. 4096 overflowed: 20 notes are well over 2,500 tokens
# of JSON, and running out mid-object returns TRUNCATED JSON the tolerant parser cannot balance, so it
# reports "malformed" and the page loses all its prose with nothing saying "you ran out of room".
# Then 8192 failed the SAME way, and only PD7's real dispatch found it: the first live v2 run came back
# 2 calls × exactly 8192 tokens, printed "failed its schema twice", production went 5 notes → ZERO, and
# every test stayed green because the suite's fake clients have no token cap to overflow.
#
# Two things ate the budget. (1) v2 output is bigger (context + watch) but only ~1,000 extra tokens on
# a ~4,000-token response — it alone could never reach 8192; plan 9.3 said raise the cap and PD7 missed
# it. (2) `max_tokens` CAPS THINKING PLUS TEXT, and Sonnet 5 thinks by default (adaptive) where Sonnet
# 4.6 did not — a silent default that arrived with the model, so reasoning quietly consumed a budget
# sized for the JSON alone. Nothing here asked for thinking; it simply started happening.
#
# 16000 leaves ~12,000 tokens for reasoning above a ~4,000-token response and stays under the ~16K line
# where a non-streaming request risks an SDK HTTP timeout, so no streaming rewrite is needed. `effort`
# (below) keeps the reasoning from expanding to fill it.
_MAX_TOKENS = 16000

# The reasoning budget, bounded on purpose (a Sonnet 5 control; Haiku has none, so the extraction stage
# neither sets it nor may). Not "low": the narrator chooses WHICH stats belong in a context and writes a
# mechanism, and Sonnet 5 respects low effort strictly enough that under-thinking is a real risk on that
# judgement. Not "high": nothing here is open-ended, and unbounded adaptive thinking is what overflowed
# the cap. Medium says: think enough to choose well, and stop.
_EFFORT = "medium"

# How long Stage A may read before it gives up on the tail. There is ~2h of slack between Job A and Job
# B, but the facts are already computed, so every extra minute delays the front page for a reason nobody
# would accept — a context line. Six minutes reads a healthy night's 60 articles with room to spare and
# caps the damage of a bad one.
EXTRACT_BUDGET_SECONDS = 360.0

# The per-call bound. The SDK default is TEN MINUTES with retries on top — how 60 sequential calls
# became a twenty-minute stage on the first live run. 30s was too tight: a healthy extraction timed out
# and (a failed call then took the whole stage down) the night reported "0 of 0 extracted" — a bound
# that trips on a healthy night is an outage, not a rail. 90s is far above a 1024-token Haiku extract
# and far below anything that could hold the page.
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
    # THE LIMITS MUST BE IN THE PROMPT — the only place the model can learn them. `api_schema` strips
    # `maxLength` before sending (the structured-output layer rejects it), so pydantic enforced a cap on
    # the way back that was never stated on the way out, and production threw away every note.
    f"HARD LIMITS: why_it_matters is at most {WHY_MAX_CHARS} characters and affected_note at most "
    f"{AFFECTED_MAX_CHARS} characters, INCLUDING spaces. A note that runs past its limit is dropped "
    "and the story publishes with no note at all, so a shorter true sentence always beats a longer one. "
    # --- PD7, the v2 sections (Appendix C, verbatim contract) ---
    # DEPTH IS PERMISSION TO SAY MORE, NOT TO KNOW MORE. Every one-liner rule applies unchanged; only
    # the vocabulary grew, because the pipeline computed more (9.2), not because the model is trusted more.
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
    # THE READER SEES THE PROSE. Without this the first live run published "carried by 1 outlet tonight
    # (cls:798fa63d...:corroboration)" — a sha1 hash in a newspaper: told to cite "by its stat_id", the
    # model wrote the id in the sentence. Ids live in `citations`; the gate now enforces it.
    "HOW TO CITE: put the stat_ids and doc_ids in the `citations` array. NEVER write a stat_id, a "
    "doc_id, a cluster_id or any hash INSIDE the prose — a human reads the prose, and an identifier "
    "in a sentence is not English. Write the VALUE (\"2.3x its normal daily range\"), and put the ID "
    "in `citations`. A section containing an identifier is deleted."
)


class ClusterNote(BaseModel):
    """One story's insight, as the model returns it — before the gate has looked at it.

    v2 (PD7) adds `context` and `watch`, both OPTIONAL even for deep clusters: "I had nothing to add"
    must stay legal at every depth, because a mandatory section makes the model pad to fill it — exactly
    what the honest-null rule prevents.
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

    A proxy, not a counter threaded through both stages: both call `client.messages.create(model=...)`
    — Stage A per article in `briefing/extract.py`, Stage B once here — so ONE interception point sees
    the whole night's spend and neither stage learns about accounting (`extract.py` stays untouched: a
    module that reads articles should not also be a ledger).

    It buckets by the `model` argument, pricing the extract and synth models apart on its own. And it is
    forgiving of a response with no `usage` block: the suite's fake clients return bare objects, and a
    metering wrapper that crashed the narration over a missing accounting field would take the page down.
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
    """What the narrator is allowed to know about one story. Absent on purpose: the significance score,
    its rank, and its page position.

    `deep` says whether the cluster is inside the depth budget (top 8) and gets the v2 treatment.
    `stats` and `calendar` are this cluster's OWN — per-cluster because the gate is: a figure lifted
    from another story is a real number in the world and still a fabrication on THIS card.
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

    `verification` carries a v2 `sections` map — a per-field verdict of narrated / dropped / silent /
    out_of_budget. It lets the story page tell the reader WHY a section is absent instead of guessing
    (the N5 lesson): a section the gate deleted and one the narrator left blank print identical nothing,
    and no screen can tell them apart unless the pipeline writes down which it was.
    """

    why_it_matters: str | None
    affected_note: str | None
    verification: dict
    context: str | None = None
    watch: list[dict] = field(default_factory=list)


@dataclass
class NarrationResult:
    """The night's prose, with its outcomes counted.

    `narrated` + `dropped` + `silent` must account for every cluster the narrator was asked about — the
    only instrument that tells a working narrator with nothing to say from a broken one, since on the
    page both print nothing.
    """

    decisions: dict[str, NoteDecision] = field(default_factory=dict)
    # Each story's Stage-A extract, keyed by CLUSTER id and already JSON — lands in news_cluster.extract
    # and is the facts the story page shows the note was written from. No entry ⇒ published without one.
    extracts: dict[str, dict] = field(default_factory=dict)
    narrated: int = 0
    dropped: int = 0
    silent: int = 0
    # PD7: the SECTION-level instrument. A v2 note's four sections are gated separately, so the
    # cluster-level counts miss things — a story whose `context` was deleted still counts `narrated` if
    # its why-line survived, which is correct and also how a broken depth stage would hide. This makes
    # the deletion visible.
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

        MEASURED, NEVER ESTIMATED: token counts come from the API's own `usage` block, only the dollars
        are arithmetic (prices are constants with a provenance comment in config.py). Plan 0.2.3 priced
        the depth delta at ≈$0.03–0.06/night on ~$0.33 and said "measured at PD7's gate, not promised" —
        this line is the measuring, every night, forever.
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

        The story page's provenance footer had HARDCODED "Claude Haiku" — a claim the row could not
        support and nobody could check. Now the row carries what actually ran.
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

    None is not an error: the caller writes null notes and the page publishes its facts without prose
    (Appendix D). No clusters ⇒ no call — an empty page does not pay a model to tell it so.
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

        # SAY WHAT CAME BACK. A parse failure that prints nothing can't be debugged without re-running
        # against the live provider — the position this stage put us in: "failed its schema twice" is a
        # symptom, the response is the evidence.
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
            # Stated, not hidden: Stage A drops a malformed article, so a story can reach the narrator
            # with only its headline. The model may still write from that, or honestly return null.
            lines.append("    (no extract — write from the headline alone, or return null)")
        else:
            numbers = "; ".join(f"{kn.value_str} ({kn.what})" for kn in extract.key_numbers) or "(none)"
            lines.append(
                f"    doc_id={extract.doc_id} | numbers={numbers} | summary={extract.summary}"
            )

        # The per-cluster depth block. Only DEEP clusters get one, and it sits UNDER its story, not in
        # the shared table — a stat about SMCI's 52-week range must not be reachable from a Fed note, and
        # the gate would refuse it anyway (each note checked against its OWN cluster's sources). Here the
        # prompt says what the gate enforces, the only way the model can succeed on purpose.
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

    Per-cluster on purpose: a figure lifted from another story is a real number in the world and still
    a fabrication on this card — the VHI bug's shape, where every number was true and the card was a lie.

    Harsher than the briefing's verdict, and it should be. The brief tolerates two flags across a whole
    page because holding the entire briefing over one bad figure costs the reader everything; a note is
    one sentence, and dropping it leaves the card's facts standing. So ANY flag drops the note — and the
    sentence beside it, because a model that invented one figure has not earned the doubt on the next.
    """
    stats = list(stats)
    instruments = list(instruments)
    by_id = {cluster.cluster_id: cluster for cluster in clusters}
    result = NarrationResult()

    for note in notes:
        cluster = by_id.get(note.cluster_id)
        if cluster is None:
            # The model was handed the cluster ids and may only write about those. An invented id is not
            # a story, and it never reaches the publish transaction.
            continue

        if not any((note.why_it_matters, note.affected_note, note.context, note.watch)):
            # An honest null: "nothing to add beyond the headline" — the system working, not failing.
            # But the reason must be TRUE per section. A cluster outside the depth budget was never asked
            # for a context, so `silent` would tell PD8's story page the narrator was stumped by a section
            # it was never shown — a false sentence. The first live run showed 13 `silent` sections on a
            # page where only 8 clusters are deep. The `sections` map exists to distinguish absences that
            # print identically; it must not be sloppy about which this is.
            budgeted = "silent" if cluster.deep else "out_of_budget"
            result.decisions[note.cluster_id] = NoteDecision(
                why_it_matters=None,
                affected_note=None,
                verification={
                    "narrated": False,
                    "note_version": NOTE_VERSION,
                    "reason": "the narrator had nothing to add",
                    "sections": {
                        "why_it_matters": {"status": "silent"},
                        "affected_note": {"status": "silent"},
                        "context": {"status": budgeted},
                        "watch": {"status": budgeted},
                    },
                },
            )
            result.silent += 1
            continue

        # THE SOURCES ARE PER-CLUSTER, in v2 including the cluster's OWN depth stats. A figure lifted
        # from another story is real in the world and a fabrication on this card — the VHI bug's shape,
        # where every number was true and the card was a lie.
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
        # 9.3's rule: THE GATE EXTENDS, NOT RELAXES. Decoupling the pair would relax it — a note dropped
        # whole today would start publishing half itself. The N5 coupling stands: they are one thought (a
        # mechanism and its spillover), and a model that invented a figure in one hasn't earned the doubt
        # in the other. v2 only adds new sections, which may be gated independently without relaxing
        # anything, because there was nothing there before.
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
        # No prose to check: the narrator SELECTED ids, and the only question is whether each resolves to
        # a calendar row this cluster was shown. A dangling ref is dropped, never rendered — this is what
        # makes "the LLM cannot author a calendar entry" a property of the system, not a request in a prompt.
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
            # THE v1 KEY STAYS, AND IT IS LOAD-BEARING IN PRODUCTION NOW. `lib/news.ts` reads
            # `verification.dropped === true` to set `noteDropped` — how the story page says "the gate held
            # this line" vs "the narrator had nothing to add" (the N5 distinction). PD7 ships BEFORE PD8
            # builds the surfaces that read `sections`, so replacing this key would blind the live page and
            # NOTHING would fail — an absent key reads as `false`. So the map is added ALONGSIDE the old key.
            # `dropped` keeps its exact v1 meaning (the why/affected PAIR was deleted). PD8 may retire it.
            verification["dropped"] = True
            verification["reason"] = "an entity in the note traced back to no source"

        # The allow-list (Q-PD5-1), across every section that SURVIVED. The extract's `key_numbers`
        # looks like one but is the numbers the ARTICLE contained, not the list this gate CLEARED — not
        # the same claim. This one is.
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
    """Both stages, end to end: read the top stories, write their context lines, gate every line.

    `stage_a` is the capped list to extract (each with its ONE representative article); `stage_b_ids`
    names the subset that gets prose — a subset by construction, since both caps rank by significance.

    Nothing here can take the page down: a failed extract, a failed narration call, a flagged note each
    cost only a line, and the facts (headline, companies, numbers, order) publish regardless — the whole
    reason the model runs last.

    And nothing may hold the night open. Stage A makes up to 60 sequential calls and the SDK default
    per-call timeout is TEN MINUTES with retries, so one slow provider night could delay publish for
    hours while the computed facts sit in memory (the first live run sat here 20+ minutes). When the
    budget is gone the extractor stops, the rest go to the narrator with headlines, and the page ships.
    The night says how many it gave up on.
    """
    # EVERY model call in both stages goes through this wrapper — the one place the night's token spend
    # is counted, and neither stage knows it is being counted (9.5). `sync_extract` below is untouched.
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

    `effort` rides INSIDE `output_config`, beside the format — top-level is a 400. See `_EFFORT` for
    why the budget is bounded: an unbounded one overflowed `max_tokens` and cost production every note.
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

    Validating the whole set as one object was a mistake production found: one sentence 40 chars too long
    invalidated the other nineteen and the page published without prose — the "one bad item kills the
    batch" disease, and a note's failure should cost only that story its sentence. So each is validated
    alone and a bad one dropped; the 160-char cap still bites, it just no longer takes neighbours with it.

    Returning None spends the one Appendix D retry, and is reserved for a response with NO usable note at
    all — the signature of something systematically wrong, worth one more ask.
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
