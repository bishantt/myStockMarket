"""
extract.py — Stage A of the briefing: one Haiku call per article (plan P3 step 1, Appendix G).

Job A submits every relevant article to the Message Batches API and records the batch id in
pipeline_run. Job B collects the batch the next evening: if it has finished, all extracts are read
back; if it is still running past the 00:40 UTC cutoff, the batch is cancelled (which preserves and
bills the already-completed items) and the remainder is extracted synchronously so the briefing
still ships on time.

The module is written so the pure pieces — building a request, parsing a result — are testable with
no client at all, and the batch flow is testable with a fake client and an injected clock. The real
Anthropic client is built by the job from settings; nothing here reaches for a key.

Design choices:
  - The doc_id is forced to the news item's id on parse, never trusted from the model, so an extract
    can never be attributed to the wrong article.
  - The parser tolerates prose around the JSON (extracts the first balanced object), so a stray
    "Here is the extract:" preamble degrades to a clean parse instead of a lost article.
  - A malformed or schema-violating result is dropped (returns None), not fatal: one bad article
    should never sink the night's briefing. The synthesis stage simply has one fewer source.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Iterable

from briefing.schema import ExtractResult, extract_json_schema

# Extraction is a short, mechanical task; a small output cap keeps batch cost down.
_MAX_TOKENS = 1024

# The Stage A system prompt, verbatim from Appendix G.
_SYSTEM = (
    "You extract facts from ONE news article for a financial briefing. Use ONLY the article text. "
    "No outside knowledge. No opinions, no advice, no predictions. If the article states a number, "
    "copy it exactly. Output must satisfy the JSON schema."
)


def build_extract_request(item: dict, *, model: str) -> dict:
    """Build one Message Batches request for a single article.

    `item` is a news_item-shaped dict (id, headline, snippet, url, tickers). The custom_id is the
    news item id, so results key straight back to their article. The article text — and the doc_id —
    travel in the user message; structured output pins the response to the Appendix G schema.
    """
    user_text = _article_prompt(item)
    return {
        "custom_id": str(item["id"]),
        "params": {
            "model": model,
            "max_tokens": _MAX_TOKENS,
            "system": _SYSTEM,
            "messages": [{"role": "user", "content": user_text}],
            "output_config": {"format": {"type": "json_schema", "schema": extract_json_schema()}},
        },
    }


def submit_batch(client: Any, items: Iterable[dict], *, model: str) -> str:
    """Submit every article as one batch and return the batch id for pipeline_run to persist."""
    requests = [build_extract_request(item, model=model) for item in items]
    batch = client.messages.batches.create(requests=requests)
    return batch.id


def collect_batch(
    client: Any,
    batch_id: str,
    expected_ids: list[str],
    *,
    clock: Callable[[], float],
    cutoff: float,
    sleep: Callable[[float], None],
    poll_interval: float = 30.0,
) -> tuple[dict[str, ExtractResult], list[str]]:
    """Poll the batch to completion or the cutoff and return (extracts_by_id, remainder_ids).

    While the batch is still processing and the clock is before the cutoff, it sleeps and polls
    again. Once it ends, every succeeded result is parsed. If the cutoff passes first, the batch is
    cancelled — cancellation preserves and bills the items already done — its completed results are
    read, and the ids that never finished are returned as the remainder for a synchronous pass.
    """
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status == "ended":
            extracts = _read_results(client, batch_id)
            return extracts, _remainder(expected_ids, extracts)
        if clock() >= cutoff:
            client.messages.batches.cancel(batch_id)
            extracts = _read_results(client, batch_id)
            return extracts, _remainder(expected_ids, extracts)
        sleep(poll_interval)


def sync_extract(
    client: Any,
    items: Iterable[dict],
    *,
    model: str,
    out_of_time: Callable[[], bool] | None = None,
) -> dict[str, ExtractResult]:
    """Extract a small remainder synchronously, one call per article. A failed article is skipped.

    `out_of_time`, when given, is checked BEFORE each call and stops the loop when it returns True.
    A caller with a wall-clock budget uses it to give up on the tail rather than run past its
    deadline — the Front Page's newsdesk does exactly that, because its prose must never be able to
    hold the night's FACTS hostage. Without a budget the loop runs to the end, which is Job B's
    behaviour and is correct there (the remainder is small and the briefing needs it).
    """
    extracts: dict[str, ExtractResult] = {}
    for item in items:
        if out_of_time is not None and out_of_time():
            break
        doc_id = str(item["id"])
        message = client.messages.create(
            model=model,
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM,
            messages=[{"role": "user", "content": _article_prompt(item)}],
            output_config={"format": {"type": "json_schema", "schema": extract_json_schema()}},
        )
        parsed = parse_extract(doc_id, _message_text(message))
        if parsed is not None:
            extracts[doc_id] = parsed
    return extracts


def parse_extract(custom_id: str, text: str) -> ExtractResult | None:
    """Parse a model response into an ExtractResult, forcing doc_id to `custom_id`.

    Returns None if the text has no JSON object or the JSON fails schema validation — a single bad
    article is a dropped source, never a crash.
    """
    payload = _extract_json_object(text)
    if payload is None:
        return None
    payload["doc_id"] = custom_id  # never trust the model's echo; bind to the real article
    try:
        return ExtractResult.model_validate(payload)
    except Exception:  # noqa: BLE001 — a schema violation is a dropped source, by design
        return None


# ----- internals -----

def _article_prompt(item: dict) -> str:
    """The user message for one article: its doc_id and text, nothing the model must invent."""
    tickers = ", ".join(item.get("tickers") or []) or "(none tagged)"
    return (
        f"doc_id: {item['id']}\n"
        f"tickers: {tickers}\n"
        f"headline: {item['headline']}\n"
        f"article: {item.get('snippet', '')}\n"
        f"source_url: {item.get('url', '')}"
    )


def _read_results(client: Any, batch_id: str) -> dict[str, ExtractResult]:
    """Read every succeeded result from a finished/cancelled batch into extracts keyed by id."""
    extracts: dict[str, ExtractResult] = {}
    for result in client.messages.batches.results(batch_id):
        if getattr(result.result, "type", None) != "succeeded":
            continue
        parsed = parse_extract(result.custom_id, _message_text(result.result.message))
        if parsed is not None:
            extracts[result.custom_id] = parsed
    return extracts


def _remainder(expected_ids: list[str], extracts: dict[str, ExtractResult]) -> list[str]:
    """The ids that were expected but never produced a valid extract."""
    return [doc_id for doc_id in expected_ids if doc_id not in extracts]


def _message_text(message: Any) -> str:
    """The text of the first text block of a message; empty if there is none."""
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""


def _extract_json_object(text: str) -> dict | None:
    """Return the first balanced JSON object found in `text`, or None. Tolerates surrounding prose so
    a stray preamble does not lose an article."""
    if not text:
        return None
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(text[start : index + 1])
                except json.JSONDecodeError:
                    return None
                return parsed if isinstance(parsed, dict) else None
    return None
