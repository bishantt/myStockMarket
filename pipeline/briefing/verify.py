"""
verify.py — the deterministic verification gate (plan §1.5 rule 10, Appendix E).

The LLM narrates; it never publishes an unverified number. This module is what enforces that, after
generation, without any model in the loop: it reads every number, money figure, date, and ticker in
the draft briefing and checks each against the allowed source set — the union of the extraction
key-numbers and the computed stats table (plus the instrument universe for tickers). Anything that
does not trace back to a source is flagged on its sentence.

The verdict (Appendix E): each unmatched entity flags its sentence. A flagged number anywhere in the
Today's-focus block, OR more than two flags in total, holds the whole briefing — the app then shows
"briefing unavailable" over verified scans rather than a fabricated sentence. Every decision is
recorded in the verification JSON so a held night is auditable.

Tolerances are Appendix E and are contractual — changing one is a structural decision, and loosening
one additionally requires the §10.5 justification that the encoded rule was wrong. They live as the
named constants below.

Interpretation note (logged in DECISIONS.md): the gate verifies numeric entities wherever they
appear in the prose, and tickers only where they appear as cashtags ($ACME). A bare uppercase word
in prose ("CEO", "US", "AI") is not treated as a ticker claim — matching every uppercase token
against the universe would flag ordinary English. Cashtags are the unambiguous ticker claim, and
numbers — the real fabrication risk — are checked everywhere.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Iterable

from briefing.schema import BriefDraft, ExtractResult

# --- Appendix E tolerances (contractual) ---
_PERCENT_ABS_PP = 0.05      # ±0.05 percentage points absolute floor
_PERCENT_REL = 0.005        # ±0.5% relative
_NUMBER_REL = 0.005         # prices / plain numbers: ±0.5% relative
_MONEY_REL = 0.01           # money with units: ±1%

# --- Verdict thresholds (Appendix E) ---
_MAX_FLAGS_BEFORE_HELD = 2  # more than two flags total ⇒ held

# Magnitude words/letters for money normalization. Order matters only for regex assembly, not value.
_MAGNITUDES: dict[str, float] = {
    "trillion": 1e12, "tn": 1e12, "t": 1e12,
    "billion": 1e9, "bn": 1e9, "b": 1e9,
    "million": 1e6, "mn": 1e6, "m": 1e6,
    "thousand": 1e3, "k": 1e3,
}

# The three-letter month abbreviations, in calendar order, for word-form date parsing.
_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

# One combined scanner, alternatives tried in priority order at each position so a more specific
# entity (a dated ISO string, a money figure, a percent) wins over a bare number sitting inside it.
# A number must be free-standing — not glued to a letter (so "Q3" and "3rd" are not "3").
_SCANNER = re.compile(
    r"""
    (?P<date_iso>\b\d{4}-\d{2}-\d{2}\b)
  | (?P<date_word>\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?\b)
  | (?P<money_unit>\$?\s?\d[\d,]*(?:\.\d+)?\s?(?:trillion|billion|million|thousand|bn|mn|tn|[bmkt])\b)
  | (?P<percent>-?\d[\d,]*(?:\.\d+)?\s?%)
  | (?P<money_dollar>\$\s?\d[\d,]*(?:\.\d+)?)
  | (?P<ticker>\$[A-Za-z]{1,5}\b)
  | (?P<number>(?<![A-Za-z0-9$])-?\d[\d,]*(?:\.\d+)?(?![A-Za-z]))
    """,
    re.VERBOSE | re.IGNORECASE,
)


@dataclass(frozen=True)
class Stat:
    """One entry of the computed-stats table handed to synthesis, in rendered form. The gate parses
    `value` the same way it parses the draft, so "8.24%", "1,200M", "5091", and "2026-07-16" all
    become allowed sources of their kind. `label` names the figure for the synthesis prompt; the
    gate ignores it."""

    stat_id: str
    value: str
    label: str = ""


@dataclass(frozen=True)
class Flag:
    """One entity in the draft that did not trace back to a source. `location` names the slot it sat
    in (a "today_focus." prefix is what makes it hold the briefing)."""

    location: str
    entity: str
    kind: str
    reason: str

    def to_json(self) -> dict:
        return {"location": self.location, "entity": self.entity, "kind": self.kind, "reason": self.reason}


@dataclass(frozen=True)
class VerificationResult:
    """The gate's outcome. `status` is "ok" (publish, possibly with inline flags) or "held" (show
    the unavailable banner). Everything is serialized into the briefing's verification JSON."""

    status: str
    flags: tuple[Flag, ...]
    checked: int
    held_reason: str | None

    def to_json(self) -> dict:
        return {
            "status": self.status,
            "checked": self.checked,
            "held_reason": self.held_reason,
            "flags": [flag.to_json() for flag in self.flags],
        }


def verify(
    draft: BriefDraft,
    *,
    extracts: Iterable[ExtractResult],
    stats: Iterable[Stat],
    instruments: Iterable[str],
    run_date: date,
) -> VerificationResult:
    """Check every entity in the draft against the source set and return the verdict.

    The source set is the union of the extraction key-numbers and the stats table; tickers are
    validated against the instrument universe. Numbers use the Appendix E tolerances; dates and
    counts match exactly; tickers match after uppercasing and stripping the leading $.
    """
    sources = _build_sources(extracts, stats, run_date)
    tickers = {symbol.upper() for symbol in instruments}

    flags: list[Flag] = []
    checked = 0
    for location, text in _draft_fields(draft):
        for kind, raw, value in _entities(text, run_date):
            checked += 1
            if not _matches(kind, value, sources, tickers):
                flags.append(Flag(location=location, entity=raw, kind=kind, reason="no source match"))

    held_reason = _verdict(flags)
    status = "held" if held_reason else "ok"
    return VerificationResult(status=status, flags=tuple(flags), checked=checked, held_reason=held_reason)


# ----- internals -----

@dataclass
class _Sources:
    percents: list[float]
    monies: list[float]
    numbers: list[float]   # decimals (prices / plain numbers), matched within tolerance
    counts: set[int]       # integers, matched exactly
    dates: set[str]        # ISO strings, matched exactly


def _build_sources(extracts: Iterable[ExtractResult], stats: Iterable[Stat], run_date: date) -> _Sources:
    """Parse every stat value and every extract key-number into the allowed sets by kind."""
    percents: list[float] = []
    monies: list[float] = []
    numbers: list[float] = []
    counts: set[int] = set()
    dates: set[str] = set()

    def absorb(text: str) -> None:
        for kind, _raw, value in _entities(text, run_date):
            if kind == "percent":
                percents.append(value)
            elif kind == "money":
                monies.append(value)
            elif kind == "date":
                dates.add(value)
            elif kind == "number":
                if float(value).is_integer():
                    counts.add(int(value))
                else:
                    numbers.append(value)

    for stat in stats:
        absorb(stat.value)
    for extract in extracts:
        for number in extract.key_numbers:
            absorb(number.value_str)

    return _Sources(percents=percents, monies=monies, numbers=numbers, counts=counts, dates=dates)


def _draft_fields(draft: BriefDraft) -> list[tuple[str, str]]:
    """The (location, text) pairs the gate scans, in reading order. The today_focus.* locations are
    what a flag needs to hold the briefing."""
    fields: list[tuple[str, str]] = [
        ("today_focus.headline", draft.today_focus.headline),
        ("today_focus.body", draft.today_focus.body),
    ]
    for index, item in enumerate(draft.items):
        fields.append((f"item[{index}].what_happened", item.what_happened))
        fields.append((f"item[{index}].why_it_matters", item.why_it_matters))
        fields.append((f"item[{index}].by_the_numbers", item.by_the_numbers))
        fields.append((f"item[{index}].yes_but", item.yes_but))
    for index, note in enumerate(draft.calendar_notes):
        fields.append((f"calendar_notes[{index}]", note))
    return fields


def _entities(text: str, run_date: date) -> list[tuple[str, str, object]]:
    """Scan one string into (kind, raw_text, normalized_value) triples.

    kind is one of: percent, money, number, date, ticker. Percent/money/number values are floats;
    date is an ISO string; ticker is the uppercased symbol (no $). Non-overlapping, left-to-right.
    """
    out: list[tuple[str, str, object]] = []
    for match in _SCANNER.finditer(text):
        group = match.lastgroup
        raw = match.group()
        if group in ("date_iso", "date_word"):
            iso = _to_iso(raw, run_date)
            if iso is not None:
                out.append(("date", raw, iso))
        elif group == "money_unit" or group == "money_dollar":
            out.append(("money", raw, _to_money(raw)))
        elif group == "percent":
            out.append(("percent", raw, _to_float(raw.rstrip("% ").strip())))
        elif group == "ticker":
            out.append(("ticker", raw, raw[1:].upper()))
        elif group == "number":
            out.append(("number", raw, _to_float(raw)))
    return out


def _matches(kind: str, value: object, sources: _Sources, tickers: set[str]) -> bool:
    """True if `value` traces to a source of its kind within the Appendix E tolerance."""
    if kind == "ticker":
        return value in tickers
    if kind == "date":
        return value in sources.dates
    if kind == "percent":
        return any(abs(value - src) <= max(_PERCENT_ABS_PP, _PERCENT_REL * abs(src)) for src in sources.percents)
    if kind == "money":
        return any(_within_relative(value, src, _MONEY_REL) for src in sources.monies)
    if kind == "number":
        if float(value).is_integer():
            return int(value) in sources.counts
        return any(_within_relative(value, src, _NUMBER_REL) for src in sources.numbers)
    return False


def _within_relative(value: float, source: float, rel: float) -> bool:
    """Relative-tolerance match, guarding a zero source with an absolute epsilon."""
    if source == 0:
        return abs(value) <= rel
    return abs(value - source) <= rel * abs(source)


def _verdict(flags: list[Flag]) -> str | None:
    """Return the reason the briefing is held, or None to publish. A flag in the Today's-focus block
    holds it; so does more than two flags total (Appendix E)."""
    if any(flag.location.startswith("today_focus") for flag in flags):
        return "flagged entity in today's focus"
    if len(flags) > _MAX_FLAGS_BEFORE_HELD:
        return f"{len(flags)} flags exceed the limit of {_MAX_FLAGS_BEFORE_HELD}"
    return None


def _to_float(text: str) -> float:
    return float(text.replace(",", "").replace(" ", ""))


def _to_money(raw: str) -> float:
    """Normalize a money string to an absolute number: $1.2B → 1.2e9, 1,200M → 1.2e9, $150 → 150."""
    cleaned = raw.replace("$", "").replace(",", "").strip().lower()
    multiplier = 1.0
    for unit, factor in _MAGNITUDES.items():
        if cleaned.endswith(unit):
            multiplier = factor
            cleaned = cleaned[: -len(unit)].strip()
            break
    return float(cleaned) * multiplier


def _to_iso(raw: str, run_date: date) -> str | None:
    """Normalize a date to ISO. An ISO string passes through; a word form ("Jul 9", "Jul 9, 2026")
    is resolved, assuming the run-date year when none is written (Appendix E)."""
    iso_match = re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw)
    if iso_match:
        return raw
    word = re.fullmatch(r"([A-Za-z]+)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?", raw.strip())
    if not word:
        return None
    month_key = word.group(1)[:3].lower()
    if month_key not in _MONTHS:
        return None
    month = _MONTHS.index(month_key) + 1
    day = int(word.group(2))
    year = int(word.group(3)) if word.group(3) else run_date.year
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None
