"""
schema.py — the Appendix G data shapes for the briefing pipeline.

These pydantic models are the contract between the three stages and the source of truth the
verification gate reads. They are strict on purpose: an extra field, a missing field, or a wrong
type raises on parse, which is exactly the "schema violation ⇒ retry" signal Appendix G calls for.
Constraints the API's structured-output layer cannot enforce (max lengths, the -1..1 sentiment
range) are enforced here, so a model that ignores the length hint still fails validation loudly.

Two schemas, matching Appendix G:

  - Stage A (extraction), one per article: ExtractResult. Grounded entirely in one article's text;
    citations are implicit via doc_id. The `key_numbers` list is what the verification gate later
    treats as the allowed set of numbers a briefing sentence may quote.

  - Stage B (synthesis), one call for the whole night: BriefDraft. Every claim cites a doc_id or a
    stat_id; numbers are copied verbatim from the inputs, never computed. The gate re-checks that
    promise deterministically.

The event-type and sentiment vocabularies, and the labeled item slots, are contractual (Appendix
G) — changing them is a structural decision, not a local edit.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

# The nine catalyst types the extractor may assign (Appendix G). A tenth, "other", is the escape
# hatch so the model never has to force a bad fit. Kept as a str-enum so it round-trips as JSON.
class EventType(str, Enum):
    EARNINGS = "earnings"
    GUIDANCE = "guidance"
    ANALYST = "analyst"
    MA = "ma"
    FDA = "fda"
    MACRO = "macro"
    LEGAL = "legal"
    PRODUCT = "product"
    OTHER = "other"


class KeyNumber(BaseModel):
    """One figure the article states, copied exactly. `value_str` is kept as the article wrote it
    (e.g. "$1.2B", "8.2%", "62 of 110") so the gate can normalize and match it; `what` names it."""

    model_config = ConfigDict(extra="forbid")

    value_str: str = Field(min_length=1, max_length=64)
    what: str = Field(min_length=1, max_length=160)


class ExtractResult(BaseModel):
    """Stage A output for ONE article. Every field is grounded in that article's text; the model is
    told to use only the article and to copy numbers exactly. `doc_id` ties the extract back to the
    news_item it came from, and is how synthesis cites it."""

    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(min_length=1)
    headline_neutral: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1, max_length=1200)  # ≤250 tokens ≈ ≤1200 chars, guarded here
    tickers: list[str] = Field(default_factory=list)
    event_type: EventType
    sentiment: float = Field(ge=-1.0, le=1.0)
    key_numbers: list[KeyNumber] = Field(default_factory=list)
    quote: str | None = Field(default=None, max_length=160)


# ----- Stage B (synthesis) -----

class BriefItem(BaseModel):
    """One of the ≤5 briefing items, each filling the labeled slots (Appendix G / §3.6). Every
    factual claim in these slots must cite a doc_id or stat_id, collected in `citations`; the gate
    checks the numbers in them against the source set."""

    model_config = ConfigDict(extra="forbid")

    what_happened: str = Field(min_length=1)
    why_it_matters: str = Field(min_length=1)
    by_the_numbers: str = Field(default="")
    yes_but: str = Field(default="")
    citations: list[str] = Field(default_factory=list)


class TodayFocus(BaseModel):
    """The one headline that opens the brief. `no_edge_flag` is set when no catalyst was matched and
    the required "no clear edge" statement stands in for a story — a first-class outcome, not a gap.
    A flagged number anywhere in THIS block holds the whole briefing (Appendix E verdict)."""

    model_config = ConfigDict(extra="forbid")

    headline: str = Field(min_length=1)
    body: str = Field(min_length=1)
    citations: list[str] = Field(default_factory=list)
    no_edge_flag: bool = False


class BriefDraft(BaseModel):
    """Stage B output: the whole evening briefing, before verification. `learning_link_slug` is
    validated against the Academy lesson manifest at publish (empty until P5, so early briefs carry
    no Learn link — by design). This is the object the gate inspects and the publisher persists."""

    model_config = ConfigDict(extra="forbid")

    today_focus: TodayFocus
    items: list[BriefItem] = Field(default_factory=list, max_length=5)
    calendar_notes: list[str] = Field(default_factory=list)
    learning_link_slug: str | None = None


def extract_json_schema() -> dict:
    """The JSON schema handed to the extraction call's structured-output format. Derived from the
    pydantic model so the two never drift; string length limits are advisory to the API (it does
    not enforce them) but pydantic enforces them on parse, which is the real guard."""
    return _api_schema(ExtractResult)


def synthesis_json_schema() -> dict:
    """The JSON schema for the synthesis call's structured output. Same derive-from-pydantic rule as
    the extraction schema."""
    return _api_schema(BriefDraft)


def _api_schema(model: type[BaseModel]) -> dict:
    """Turn a pydantic model into a JSON schema the Messages API structured-output layer accepts.

    The API requires `additionalProperties: false` on every object and does not support string
    length or numeric-range constraints, so those are stripped here (pydantic still enforces them on
    the way back in). Enums and $defs pass through unchanged.
    """
    schema = model.model_json_schema()
    return _strip_unsupported(schema)


# Keys the structured-output layer rejects or ignores; removed so the schema is accepted, with
# validation deferred to pydantic on parse (Appendix G's "schema violation ⇒ retry").
_UNSUPPORTED_KEYS = frozenset(
    {"minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
     "minItems", "maxItems", "multipleOf", "pattern", "format", "default"}
)


def _strip_unsupported(node: object) -> object:
    """Walk the schema tree and drop constraint keys the API does not support, and force every
    object to `additionalProperties: false` (which the API requires for strict validation)."""
    if isinstance(node, dict):
        cleaned = {
            key: _strip_unsupported(value)
            for key, value in node.items()
            if key not in _UNSUPPORTED_KEYS
        }
        if cleaned.get("type") == "object":
            cleaned["additionalProperties"] = False
        return cleaned
    if isinstance(node, list):
        return [_strip_unsupported(item) for item in node]
    return node
