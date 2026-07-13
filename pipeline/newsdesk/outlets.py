"""
outlets.py — who actually corroborated a story, and who merely carried it (N4).

CORROBORATION IS EVIDENCE. VOLUME OF COVERAGE IS NOT. The significance formula pays a cluster for
being reported by several sources, on the reasoning that three newsrooms independently finding a
story worth printing is real evidence that it matters. That reasoning collapses the moment the
"sources" are press-release distributors.

The recording made it concrete: the merger feed's sources are GlobalNewswire (39 of 60),
SeekingAlpha (20) and BusinessWire (1). GlobalNewswire and BusinessWire are not newsrooms — they are
pipes a company pays to push its own announcement down. When VitalHub's acquisition appears twice
under two wire names, that is ONE company saying one thing twice, not two outlets agreeing. Counting
it as two would pay a story for its own press office's distribution budget, which is exactly the
"popular is not important" failure ruling C1 exists to prevent, wearing a costume.

So: every press-release distributor collapses into a single bucket. A story carried by three wires
and nobody else has one source — the company itself.
"""

from __future__ import annotations

# Press-release distributors. A company pays these to carry its announcement verbatim; they do not
# decide whether it is worth carrying, which is the entire thing corroboration measures.
PR_WIRES: frozenset[str] = frozenset(
    {
        "globenewswire",
        "globalnewswire",
        "businesswire",
        "business wire",
        "pr newswire",
        "prnewswire",
        "accesswire",
        "accessnewswire",
        "newsfile",
        "einpresswire",
        "prweb",
        "acquire media",
    }
)

# The single bucket every wire collapses into. It is named for what it actually is, so that a card
# reading "1 source" can honestly be explained as "the company announced it".
PRESS_RELEASE = "press release"


def is_press_wire(source: str) -> bool:
    """Is this a distributor rather than a newsroom?"""
    return (source or "").strip().lower() in PR_WIRES


def canonical_outlet(source: str) -> str:
    """
    The name this source counts under.

    A newsroom counts as itself. Every press-release wire counts as the same single bucket, so that
    three wires carrying one announcement cannot add up to three corroborating sources.
    """
    cleaned = (source or "").strip()
    if not cleaned:
        return ""
    if is_press_wire(cleaned):
        return PRESS_RELEASE
    return cleaned


def distinct_outlets(sources: list[str]) -> int:
    """
    How many genuinely independent sources carried this story.

    This is the number the significance formula pays for and the number the card prints as
    "{n} sources". It must never be inflated by a company's own distribution.
    """
    return len({outlet for outlet in (canonical_outlet(s) for s in sources) if outlet})
