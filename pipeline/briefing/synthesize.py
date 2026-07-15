"""
synthesize.py — Stage B of the briefing: one synchronous Sonnet call (plan P3 step 2, Appendix G).

Job B makes exactly one synthesis call. It hands the model the structured extracts (each with a
doc_id) and the computed-stats table (each with a stat_id), and asks for the whole evening briefing
in the Appendix G shape: a Today's-focus headline, up to five items with labeled slots, calendar
notes, and one learning-link slug. Every claim must cite a doc_id or a stat_id, and every number
must be copied verbatim from the inputs — the model narrates, it never computes.

Failure handling is Appendix G: a schema violation triggers exactly one retry with the error
appended; a second failure returns None, which the caller turns into a held briefing (the app then
shows "briefing unavailable" over verified scans). Whatever the model returns, the deterministic
verification gate re-checks it afterward regardless.

The module is dependency-injected: `synthesize` takes the Anthropic client, so tests drive it with a
scripted fake and no key is needed.
"""

from __future__ import annotations

from typing import Any, Iterable

from briefing.schema import BriefDraft, ExtractResult, synthesis_json_schema
from briefing.verify import Stat

# The token budget and the reasoning budget, sized exactly as the front-page narrator's are
# (newsdesk/narrate.py, PD7). The two Sonnet-5 narrators in this pipeline solve the IDENTICAL problem
# and must not drift: claude-sonnet-5 runs ADAPTIVE THINKING by default, and that reasoning is spent
# against `max_tokens`. At 4096 the thinking alone routinely consumed the whole budget and the call
# returned `stop_reason=max_tokens` with a lone `thinking` block and NO text — a 0-char "response"
# that held the briefing, intermittently, roughly every other night (CC1 found it by dumping the
# message shape on failure; the front page had lost every note the same way at PD7). Two levers fix it
# TOGETHER: 16000 leaves ~12k of room for reasoning above the small bounded JSON — and stays under the
# ~21k line at which a non-streaming call is refused for possibly running past ten minutes, so no
# streaming rewrite — and `effort` (below) keeps the reasoning from expanding to fill even that.
_MAX_TOKENS = 16000

# The reasoning budget, bounded on purpose (a Sonnet-5 control; Haiku has no such lever, so the
# extraction stage neither sets it nor may). "medium", not "low": synthesis is not transcribing — it
# chooses WHICH extracts and stats belong in the brief — and Sonnet-5 under-thinks on low. Not "high":
# nothing here is open-ended, and unbounded adaptive thinking is what overflowed the cap to begin with.
_EFFORT = "medium"

# The Stage B system prompt, from Appendix G — with the 47a713f rule (below) applied to this second
# narrator. That commit caught the Front Page's narrator publishing "carried by 1 outlet tonight
# (cls:798fa63d…:corroboration)" — a sha1 hash in a sentence a reader was meant to read. Told to cite
# each number "by its stat_id", the model reasonably wrote the id where a reader could see it. The
# briefing has a `citations` array for exactly the same purpose; nothing here had ever said the id
# does not ALSO go in the prose. So the rule that fixed the Front Page is stated here too.
_SYSTEM = (
    "You write the evening briefing for ONE reader, a beginner, in mechanical third person. "
    "Inputs: (1) structured extracts with doc_ids; (2) a computed-stats table. RULES: every claim "
    "cites a doc_id or stat_id in its citations array — and the citations array is the ONLY place an "
    "id belongs. NEVER write a stat_id, doc_id, cluster_id or any hash INSIDE the prose a reader "
    "sees: an identifier in a sentence is not English. Write the VALUE (e.g. \"2.3x its normal daily "
    "range\") and put the id in citations. Use provided numbers VERBATIM — never compute, never round "
    "differently; no directional predictions; no advice verbs (buy/sell/should); uncertainty language "
    "only from the provided lexicon; “no clear reason” is the required statement when no catalyst was "
    "matched; ≤5 items; each item fills the labeled slots."
)


def synthesize(
    client: Any,
    extracts: Iterable[ExtractResult],
    stats: Iterable[Stat],
    *,
    model: str,
) -> BriefDraft | None:
    """Make the one synthesis call and return the parsed draft, or None after a second failure.

    On a schema violation the failed text and a correction instruction are appended and the call is
    retried once (Appendix G). A None return is the caller's signal to hold the briefing.
    """
    system, user = build_synthesis_prompt(list(extracts), list(stats))
    messages: list[dict] = [{"role": "user", "content": user}]

    for attempt in range(2):
        message = _create(client, model, system, messages)
        text = _message_text(message)
        draft, reason = _parse_draft(text)
        if draft is not None:
            return draft
        # SAY WHY it failed. A synthesis failure holds the WHOLE briefing, and the reason used to be
        # swallowed by a bare `except`, so "synthesis failed validation" reached the record with no
        # trace of what went wrong. The message SHAPE is what named the real cause here —
        # `stop_reason=max_tokens` with only a `thinking` block is the token-budget starvation this
        # module now sizes `_MAX_TOKENS` against — so the reason and that shape both print. The PD7
        # lesson one level down: a held night must be auditable.
        blocks = [getattr(b, "type", "?") for b in (getattr(message, "content", []) or [])]
        print(
            f"synthesize: attempt {attempt + 1} produced no usable draft — {reason} "
            f"(stop_reason={getattr(message, 'stop_reason', '?')}, blocks={blocks})"
        )
        # Append the failed attempt and a correction turn, then retry once (Appendix G).
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


def build_synthesis_prompt(extracts: list[ExtractResult], stats: list[Stat]) -> tuple[str, str]:
    """Assemble the (system, user) prompt. The user message lists the extracts with their doc_ids
    and the stats table with stat_ids and numbers, so the model can cite and copy but never invent."""
    lines: list[str] = ["EXTRACTS (cite by doc_id):"]
    if not extracts:
        lines.append("(none tonight)")
    for extract in extracts:
        numbers = "; ".join(f"{kn.value_str} ({kn.what})" for kn in extract.key_numbers) or "(none)"
        tickers = ", ".join(extract.tickers) or "(none)"
        lines.append(
            f"- doc_id={extract.doc_id} | {extract.event_type.value} | tickers={tickers} | "
            f"headline={extract.headline_neutral} | numbers={numbers} | summary={extract.summary}"
        )

    lines.append("")
    lines.append("STATS (cite by stat_id; copy the value verbatim):")
    if not stats:
        lines.append("(none tonight)")
    for stat in stats:
        label = f" ({stat.label})" if stat.label else ""
        lines.append(f"- stat_id={stat.stat_id} = {stat.value}{label}")

    return _SYSTEM, "\n".join(lines)


# ----- internals -----

def _create(client: Any, model: str, system: str, messages: list[dict]) -> Any:
    """One structured-output synthesis call.

    `effort` rides INSIDE `output_config`, beside the format — it is not a top-level parameter (that
    is a 400), and it is the bound that stops Sonnet-5's adaptive thinking from overflowing
    `max_tokens` and returning an empty response. Same shape as newsdesk/narrate.py."""
    return client.messages.create(
        model=model,
        max_tokens=_MAX_TOKENS,
        system=system,
        messages=messages,
        output_config={
            "format": {"type": "json_schema", "schema": synthesis_json_schema()},
            "effort": _EFFORT,
        },
    )


def _parse_draft(text: str) -> tuple[BriefDraft | None, str]:
    """Parse the model text into a BriefDraft, tolerating prose around the JSON object.

    Returns (draft, "") on success or (None, reason) on failure — the reason names WHAT went wrong so
    the caller can log it. The API's structured-output layer cannot enforce lengths or the ≤5-item
    cap (schema.py strips those), so the model can return API-valid JSON that pydantic then rejects;
    that rejection is the common held-for-synthesis-failure cause and must not vanish."""
    from briefing.extract import _extract_json_object  # shared tolerant JSON finder

    payload = _extract_json_object(text)
    if payload is None:
        return None, f"no JSON object found in a {len(text)}-char response"
    try:
        return BriefDraft.model_validate(payload), ""
    except Exception as error:  # noqa: BLE001 — an invalid draft triggers the retry / hold, not a crash
        return None, f"schema validation failed — {error}"


def _message_text(message: Any) -> str:
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""
