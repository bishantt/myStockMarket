"""
macro_levels.py — deciding which index levels a night actually writes.

One rule, and it is worth stating plainly: **a level you already have is worth more than a level you
failed to fetch.**

Before this module existed, the nightly upsert wrote whatever the night fetched, including None. So
a single flaky FRED call did not merely fail to update the S&P 500's level — it overwrote the good
one already in the database with NULL, and the Desk silently fell back to printing SPY's price
instead. A successful run destroyed data. That is the failure this file prevents
(NEWS-AND-CONTROL-PLAN §3.1).

The levels are handled as a SET, not as three independent cells, because they arrive from one source
on one call cycle and the table dates them with one column (`index_levels_as_of`). Keeping them
together is what lets that single date be true about all of them at once: if tonight fetched
anything, tonight's read wins outright, and any slot it missed falls back to its honest ETF proxy
downstream. Only a total blackout carries the previous set forward, with the previous set's date.

The carry-forward expires after five sessions. Past that, a stale number wearing an index's name is
worse than an ETF's price wearing the ETF's name — the proxy at least tells the truth about what it
is.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Mapping

from trading_calendar import sessions_between

# How stale a carried-forward index level may be before an honest ETF proxy beats it.
#
# Five sessions is one trading week. Inside that window a dated level ("as of Jul 9") still tells the
# reader something true and useful about where the index stands. Beyond it, the number has drifted
# far enough from today that showing it — even correctly dated — misleads more than it informs, and
# the proxy grammar takes over.
MAX_STALE_INDEX_SESSIONS = 5

# The six columns a night writes for the index levels: three levels, each with the level before it.
LEVEL_COLUMNS = (
    "sp500",
    "sp500_prior",
    "nasdaq_composite",
    "nasdaq_composite_prior",
    "djia",
    "djia_prior",
)

# Just the levels — the fields that decide whether a read produced anything at all. A prior without
# its level is not a level.
_LEVELS_ONLY = ("sp500", "nasdaq_composite", "djia")


@dataclass(frozen=True)
class StoredLevels:
    """The index levels already in the database, and the session they are actually for."""

    sp500: float | None
    sp500_prior: float | None
    nasdaq_composite: float | None
    nasdaq_composite_prior: float | None
    djia: float | None
    djia_prior: float | None
    as_of: date | None

    def has_any_level(self) -> bool:
        return any(getattr(self, name) is not None for name in _LEVELS_ONLY)

    def as_columns(self) -> dict[str, float | None]:
        return {name: getattr(self, name) for name in LEVEL_COLUMNS}


def resolve_index_levels(
    fetched: Mapping[str, float | None],
    *,
    stored: StoredLevels | None,
    run_date: date,
    max_stale_sessions: int = MAX_STALE_INDEX_SESSIONS,
) -> dict[str, object]:
    """
    Decide what the index-level columns should be tonight, and what date to stamp them with.

    Returns the six level columns plus `index_levels_as_of`, ready to be written.

    Three outcomes:

    1. **Tonight fetched something.** Tonight's read wins, dated tonight. A slot it missed stays
       None and falls back to its ETF proxy on the surface — we do not backfill one night's gap with
       another night's number, because the row carries a single as-of date and mixing two nights
       under it would make that date a lie about one of the levels.

    2. **Tonight fetched nothing, but the database has a recent set.** Carry it forward, keeping its
       OWN date. The Desk shows a stale-but-dated level instead of collapsing to an ETF — and it
       says how old it is.

    3. **Tonight fetched nothing and there is nothing recent to keep.** Write nulls. The app renders
       honest ETF proxies, which is the right answer when we genuinely do not know the level.
    """
    fetched_any = any(fetched.get(name) is not None for name in _LEVELS_ONLY)

    if fetched_any:
        return {
            **{name: fetched.get(name) for name in LEVEL_COLUMNS},
            "index_levels_as_of": run_date,
        }

    if stored is not None and stored.has_any_level() and stored.as_of is not None:
        age = sessions_between(stored.as_of, run_date)
        if age <= max_stale_sessions:
            return {**stored.as_columns(), "index_levels_as_of": stored.as_of}

    return {
        **{name: None for name in LEVEL_COLUMNS},
        "index_levels_as_of": None,
    }
