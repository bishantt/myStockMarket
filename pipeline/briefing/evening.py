"""
evening.py — Job B's briefing orchestration (plan P3 step 2).

One evening, in order:
  1. collect the extraction batch Job A submitted — reading every finished extract, and if the batch
     is still running past the 00:40 UTC cutoff, cancelling it and keeping what completed;
  2. sweep late news that broke after Job A ran, and synchronously extract it plus any batch
     remainder;
  3. make the one synthesis call (Sonnet) that writes the briefing;
  4. run the deterministic verification gate over the draft;
  5. publish the briefing atomically — status "published" if the gate passed, "held" if it flagged a
     number in the Today's-focus block or more than two numbers overall.

The flow is dependency-injected, exactly like Job A's run_nightly: the Anthropic client, the publish
callable, the clock, and the late-news sweep are all fields on BriefingDeps, so the whole evening is
tested end to end with fakes and no key. Job B's main() builds the real collaborators and calls
run_briefing.

A held or synthesis-failed night still publishes a briefing row — with status "held" and the full
verification record — so the Desk can show "briefing unavailable" over the verified scans and the
decision stays auditable. A no-batch night (a holiday, or a night Job A submitted nothing) is
skipped without a row, and Job B's dead-man ping still fires: nothing to brief is a healthy outcome.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

from briefing.extract import collect_batch, sync_extract
from briefing.schema import ExtractResult
from briefing.synthesize import synthesize
from briefing.verify import Stat, verify

# The UTC cutoff at which Job B stops waiting on the batch and finishes synchronously (plan P3 /
# Appendix C: 00:40 UTC). Job B main() passes a real monotonic clock and this cutoff.
DEFAULT_CUTOFF_UTC_HHMM = (0, 40)


@dataclass
class BriefingDeps:
    """Everything Job B's briefing flow needs, injected so it is testable with fakes."""

    run_date: date
    anthropic: Any
    batched_items: list[dict]                       # the articles Job A submitted to the batch
    stats: list[Stat]                               # the computed-stats table for synthesis + the gate
    instruments: frozenset[str]                     # the ticker universe, for the gate
    publish: Callable[..., None]                    # (run_date, am_json, verification_json, model_meta, status)
    batch_id: str | None = None                     # from pipeline_run; None on a no-batch night
    model_extract: str = "claude-haiku-4-5"
    model_synth: str = "claude-sonnet-5"
    late_news: Callable[[], list[dict]] | None = None  # the late-news delta sweep
    clock: Callable[[], float] = time.monotonic
    cutoff: float = float("inf")
    sleep: Callable[[float], None] = time.sleep
    poll_interval: float = 30.0


@dataclass
class BriefingResult:
    """The outcome of one evening: the status published, and small counts for the run log."""

    status: str                 # "published" | "held" | "skipped"
    extract_count: int = 0
    flag_count: int = 0


def run_briefing(deps: BriefingDeps) -> BriefingResult:
    """Run the evening briefing flow and return its outcome. Publishes a briefing row unless the
    night is skipped (no batch to brief)."""
    # Sweep late news once, up front, so the skip decision and the extraction see the same articles.
    late_items = list(deps.late_news()) if deps.late_news else []
    if deps.batch_id is None and not late_items:
        # Nothing was submitted and nothing broke late — a holiday or a thin night. No briefing.
        return BriefingResult(status="skipped")

    extracts = _gather_extracts(deps, late_items)

    draft = synthesize(deps.anthropic, extracts.values(), deps.stats, model=deps.model_synth)
    if draft is None:
        return _publish_held_no_draft(deps, extract_count=len(extracts))

    verification = verify(
        draft,
        extracts=extracts.values(),
        stats=deps.stats,
        instruments=deps.instruments,
        run_date=deps.run_date,
    )
    status = "published" if verification.status == "ok" else "held"
    deps.publish(
        run_date=deps.run_date,
        am_json=draft.model_dump(mode="json"),
        verification_json=verification.to_json(),
        model_meta=_model_meta(deps, len(extracts)),
        status=status,
    )
    return BriefingResult(status=status, extract_count=len(extracts), flag_count=len(verification.flags))


# ----- internals -----

def _gather_extracts(deps: BriefingDeps, late_items: list[dict]) -> dict[str, ExtractResult]:
    """Collect the batch (if any), then synchronously extract the batch remainder and the already-
    swept late-news items. Returns all extracts keyed by doc_id."""
    extracts: dict[str, ExtractResult] = {}
    remainder_items: list[dict] = []

    if deps.batch_id is not None:
        expected = [str(item["id"]) for item in deps.batched_items]
        extracts, remainder = collect_batch(
            deps.anthropic, deps.batch_id, expected,
            clock=deps.clock, cutoff=deps.cutoff, sleep=deps.sleep, poll_interval=deps.poll_interval,
        )
        remainder_ids = set(remainder)
        remainder_items = [item for item in deps.batched_items if str(item["id"]) in remainder_ids]

    to_sync = remainder_items + late_items
    if to_sync:
        extracts.update(sync_extract(deps.anthropic, to_sync, model=deps.model_extract))
    return extracts


def _publish_held_no_draft(deps: BriefingDeps, *, extract_count: int) -> BriefingResult:
    """Publish a held briefing when synthesis failed twice (Appendix G). The am_json carries the
    unavailable shell; the verification JSON records the reason."""
    verification = {"status": "held", "checked": 0, "flags": [], "held_reason": "synthesis failed validation"}
    deps.publish(
        run_date=deps.run_date,
        am_json=_unavailable_shell(),
        verification_json=verification,
        model_meta=_model_meta(deps, extract_count),
        status="held",
    )
    return BriefingResult(status="held", extract_count=extract_count, flag_count=0)


def _unavailable_shell() -> dict:
    """A minimal briefing body for a held night — the app renders its own 'unavailable' copy from
    the status, but a well-formed shell keeps the JSON shape uniform for any reader."""
    return {
        "today_focus": {"headline": "", "body": "", "citations": [], "no_edge_flag": False},
        "items": [],
        "calendar_notes": [],
        "learning_link_slug": None,
    }


def _model_meta(deps: BriefingDeps, extract_count: int) -> dict:
    """The run's model and count metadata, stored on the briefing row for provenance."""
    return {
        "model_extract": deps.model_extract,
        "model_synth": deps.model_synth,
        "extract_count": extract_count,
        "batch_id": deps.batch_id,
    }
