"""
noise.py — the boilerplate filter (N4).

THE FEED IS NOT WHAT THE PLAN THOUGHT IT WAS, and the merger category is where that shows. Of the 60
items the recording captured, 26 — 43% — are UK Takeover-Panel "Form 8.3" disclosures: mandatory
compliance filings that a shareholder must publish when it holds 1% of a company under offer. They
are legally required, publicly filed, and completely uninformative to a reader trying to understand
why the market moved. "Form 8.3 - Picton Property Income Limited" is not a catalyst. It is paperwork.

Left unfiltered they would do specific damage rather than general clutter: the M&A filter chip — one
of the ten the room offers — would be almost entirely paperwork about UK property trusts, and the
significance formula would pay each one the M&A class prior (the highest there is) for being filed.

This is the same disease R0 found in the Session Calendar, which ingested every FRED release and
printed "Coinbase Cryptocurrencies" and "Commercial Paper" as market catalysts. The cure there was an
allowlist at the write path. The cure here is a denylist at the write path, and it is checked in,
tested, and deliberately NARROW: it names the boilerplate families it knows, and anything it does not
recognise is kept. A filter that guesses would eventually eat a real story, and a front page missing
a real story is a worse failure than one carrying a dull filing.
"""

from __future__ import annotations

import re

# The regulatory-filing families the wires carry. Every one of these is a form, not a story.
#
# Anchored to the START of the headline (or to a "Company PLC : Form 8.3" prefix, which is how the
# wires actually format them), so an article that merely DISCUSSES a filing is untouched.
_BOILERPLATE = re.compile(
    r"""
    (?:^|:\s*)              # start of the headline, or after a "Man Group PLC :" prefix
    \s*
    (?:
        form\s+8[\.\s]      # Form 8.3 / Form 8.5 — Takeover Panel dealing disclosures
      | form\s+1\b          # Form 1 — opening position disclosure
      | transaction\s+in\s+own\s+shares
      | total\s+voting\s+rights
      | holding\(s\)\s+in\s+company
      | director/pdmr\s+shareholding
      | net\s+asset\s+value
      | block\s+listing
      | publication\s+of\s+(?:prospectus|circular|final\s+terms)
      | notice\s+of\s+(?:agm|egm|results)
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)


def is_boilerplate(headline: str) -> bool:
    """
    Is this headline a regulatory filing rather than a story?

    Narrow on purpose. It recognises the specific families the wires push and keeps everything else,
    because the cost of wrongly dropping a real catalyst (a story the reader never learns about, with
    no trace that it was ever there) is far worse than the cost of wrongly keeping a dull one (a card
    that ranks low and sits at the bottom of the feed).
    """
    if not headline:
        return False
    return _BOILERPLATE.search(headline) is not None


def strip_boilerplate(items: list, headline_of=lambda item: item.headline) -> list:
    """Everything in `items` that is a story. Callers log the count they dropped (C6 — a cut that
    states its own size is a cut the reader can audit)."""
    return [item for item in items if not is_boilerplate(headline_of(item))]
