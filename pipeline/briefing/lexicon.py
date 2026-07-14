"""
lexicon.py — ruling E4's teeth: insight never advises, and frequency words are earned.

The number gate (`verify.py`) asks "is this figure true?". It cannot ask "is this sentence a
recommendation?", because a recommendation need contain no figure at all. "Investors should buy the
dip" passes every tolerance in Appendix E and is exactly the sentence this product exists not to
write. So the gate gains a second, deterministic reader, and this is it.

TWO CHECKS.

**Advice.** The banned verbs, as whole words and as advisory constructions. No LLM in the loop, no
judgement call: a section containing one is dropped, the same as a section containing a fabricated
number, and for the same reason — the model has demonstrated it is not writing the thing it was
asked for.

**Frequency.** A frequency adverb (usually, often, rarely, typically, tends…) is permitted ONLY in a
sentence that also cites a COMPUTED STAT. An uncited "usually" is folk probability wearing prose: it
makes a claim about how often something happens, with no base rate, no N, and no interval. This
product publishes base rates with Wilson intervals and an N-gate specifically so it never has to say
"usually" and hope. The rule, in one line: **if you want to tell the reader how often, show them the
count.**

Note carefully WHICH numbers earn the adverb — the registry's, and only the registry's. A number a
journalist wrote in an article (an extract's key_number) is a fact about the world; a registry stat
is a figure THIS PIPELINE COMPUTED AND CAN DEFEND. Quoting the former beside "usually" is still folk
probability with a decoration next to it. The verify gate checks both kinds for truth; this rule is
about what they EARN, which is a different question.

THE FALSE POSITIVE IS THE DANGEROUS FAILURE HERE, and the patterns below are shaped by that.
A flagged section is DELETED, and a deleted section prints precisely the same nothing as a section
the narrator honestly had nothing to say in — narrate.py's header says so at length. A lexicon that
is too eager would therefore strip honest prose off the front page and no screen anywhere would ever
say it had happened. That is why "a buy rating" (the NAME of an analyst's opinion — a reportable
fact) must survive, while "buy the dip" (an instruction to the reader) must not, and why both
directions are pinned by tests.
"""

from __future__ import annotations

import re
from typing import Iterable

from briefing.verify import Flag, SourceSet, check_text

# The advice patterns. Each is a whole-word or phrase match, and each earns its place:
#
#   should              — a recommendation modal. Mechanical third-person prose about what HAPPENED
#                         has no use for it: every sentence it can appear in is a recommendation or a
#                         forecast, and E4 bans both.
#   buy / sell          — but NOT when they name a RATING ("lifted to a buy rating"), which is a fact
#                         about an analyst's opinion and a perfectly reportable event, and NOT when
#                         they are the first half of a HYPHENATED noun ("the sell-off spread",
#                         "buy-side demand"). A word boundary sits happily before a hyphen, so \bsell\b
#                         matches inside "sell-off" — which flagged, and would have deleted, a
#                         completely ordinary sentence about a market decline. The two lookaheads are
#                         what separate the instruction from the noun.
#   trim / accumulate / — the portfolio verbs. There is no innocent reading of these in a sentence
#   overweight /          addressed to a reader about a stock.
#   underweight / avoid
#   take profit(s)      — the phrase, because "profit" alone is an ordinary noun.
#   recommend           — saying it out loud.
_ADVICE = re.compile(
    r"""
      \bshould\b
    | \b(?:buy|sell)\b (?! \s*- | \s+(?:rating|ratings|side|recommendation) )
    | \b(?:trim|accumulate|overweight|underweight|avoid)\b
    | \btake\s+profits?\b
    | \brecommend(?:s|ed|ation)?\b
    """,
    re.VERBOSE | re.IGNORECASE,
)

# The frequency vocabulary. "tends"/"tend" is a verb rather than an adverb but makes the identical
# claim ("the sector tends to move together" IS a frequency assertion), so it is held to the identical
# rule — the ruling is about the CLAIM, not the part of speech.
_FREQUENCY = re.compile(
    r"\b(?:usually|often|rarely|typically|generally|frequently|seldom|commonly|tends?)\b",
    re.IGNORECASE,
)

# Sentence boundaries, roughly. A decimal point is not a full stop, which is why the split requires
# whitespace after the terminator — "2.83x" must not become two sentences.
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def lexicon_flags(text: str, *, stat_sources: SourceSet, location: str) -> tuple[Flag, ...]:
    """Read one prose section and return E4's flags — advice anywhere, unearned frequency claims.

    `stat_sources` must be built from the REGISTRY STATS ALONE (see the module header for why):

        build_source_set(extracts=[], stats=stats, instruments=[], run_date=run_date)

    A flag here drops the section it was found in, exactly as a fabricated number does.
    """
    if not text or not text.strip():
        return ()

    flags: list[Flag] = []

    for match in _ADVICE.finditer(text):
        flags.append(
            Flag(
                location=location,
                entity=match.group().strip(),
                kind="advice",
                reason="an advice verb — insight never advises (E4)",
            )
        )

    for sentence in _sentences(text):
        for match in _FREQUENCY.finditer(sentence):
            if _cites_a_stat(sentence, stat_sources):
                continue  # earned: the claim is anchored to a number the pipeline computed
            flags.append(
                Flag(
                    location=location,
                    entity=match.group().strip(),
                    kind="frequency",
                    reason="a frequency claim with no computed stat in the same sentence (E4)",
                )
            )

    return tuple(flags)


def _sentences(text: str) -> Iterable[str]:
    """Split into sentences. The adverb and the stat that earns it must sit in the SAME one: a number
    two sentences away does not anchor a frequency claim, it merely sits near it, and asking the
    reader to connect them is asking them to take the connection on trust."""
    return [part for part in _SENTENCE.split(text.strip()) if part]


def _cites_a_stat(sentence: str, stat_sources: SourceSet) -> bool:
    """True if this sentence quotes at least one number that traces back to the registry.

    It reuses the number gate rather than growing a second opinion about what a number is — the one
    thing `verify.py`'s header is most insistent about. `cleared` is exactly "the entities that
    matched a source", which is exactly the question being asked here.
    """
    return bool(check_text(stat_sources, sentence, location="lexicon").cleared)
