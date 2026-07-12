"""
catalyst_allowlist.py — which FRED releases are allowed onto the Session Calendar
(UI-REDESIGN-PLAN §6.2 and Appendix C).

The problem this solves: FRED publishes hundreds of "releases", and almost none of them are things
a US equity session reacts to. Left unfiltered the calendar filled up with Coinbase Cryptocurrencies,
Commercial Paper, daily Treasury quotes and the Dow Jones Averages — a firehose, in a module whose
entire reason to exist is curation.

So the calendar has a fixed vocabulary: seven releases, listed below. Everything else is dropped.
The table is the single source of that vocabulary — the chip code the Desk renders, the display
title, whether it is a Fed event or a macro one, and how loudly it is marked. It only ever grows by
a deliberate commit, which is the point: a calendar that quietly admits new event types is a
calendar that quietly becomes a firehose again.

Matching is by name, not by release id. FRED's release ids are recorded beside each entry as
documentation (and to make a future audit easy), but a name match is what decides — the ids are not
load-bearing, so a stale one cannot silently drop a real CPI print.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class Release:
    """One allowlisted release: how the Desk names it, files it, and marks it."""

    #: The chip the calendar row renders — the one vocabulary (never the raw `kind`).
    code: str
    #: The human title shown beside the chip.
    display: str
    #: "fed" for FOMC, "macro" for a data release. Drives nothing visual; kept for the data model.
    kind: str
    #: "high" | "medium" — the Desk marks high with an ink dot and the word, never a colour.
    importance: str
    #: The FRED release id this entry matched when it was recorded. Documentation only.
    release_id: int
    #: The lowercase fragment of the FRED release name that identifies this release.
    match: str


# The seven. Ordered as they appear in Appendix C.
ALLOWLIST: tuple[Release, ...] = (
    Release("CPI", "Consumer Price Index", "macro", "high", 10, "consumer price index"),
    Release("JOBS", "Jobs report", "macro", "high", 50, "employment situation"),
    Release("PPI", "Producer Price Index", "macro", "medium", 46, "producer price index"),
    Release("GDP", "GDP", "macro", "medium", 53, "gross domestic product"),
    Release("PCE", "PCE (inflation)", "macro", "medium", 54, "personal income and outlays"),
    Release("RETAIL", "Retail sales", "macro", "medium", 8,
            "advance monthly sales for retail and food services"),
    Release("FOMC", "FOMC decision", "fed", "high", 101, "fomc press release"),
)


def match_release(name: str) -> Release | None:
    """
    Look up a FRED release name in the allowlist, or return None if it is not a session catalyst.

    The comparison is case-insensitive and ignores surrounding whitespace, and it matches by
    containment so that a release FRED renames slightly ("Consumer Price Index" → "Consumer Price
    Index (CPI)") still lands. Anything the table does not recognise is noise, and noise is dropped.
    """
    normalized = " ".join(name.lower().split())
    for entry in ALLOWLIST:
        if entry.match in normalized:
            return entry
    return None


def select_releases(rows: list[Any]) -> list[tuple[Any, Release]]:
    """
    Turn a window of FRED release dates into the calendar's rows: allowlisted only, each paired with
    its allowlist entry, and each (release, date) appearing exactly once.

    Two things happen here, in this order:

      1. Filtering. A release the allowlist does not recognise never becomes a row at all — it is
         skipped, not appended as an empty one.
      2. De-duplication by (release id, date). FRED can list the same release twice for the same
         day; that is one event. It is NOT de-duplicated by release alone: three FOMC press releases
         around a meeting are three genuinely different dates and all three belong on the calendar.

    Takes the typed ReleaseDate rows from the adapter (which carry the release id) rather than the
    event dicts (which do not) — the filter has to run before the mapping, on the richer shape.
    """
    selected: list[tuple[Any, Release]] = []
    seen: set[tuple[int, date]] = set()

    for row in rows:
        entry = match_release(row.name)
        if entry is None:
            continue
        key = (row.release_id, row.date)
        if key in seen:
            continue
        seen.add(key)
        selected.append((row, entry))

    return selected
