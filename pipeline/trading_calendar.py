"""
trading_calendar.py — the NYSE trading calendar, for the signal log's horizon (plan §P1, Appendix F).

Every signal_log row records when a fired setup RESOLVES: exactly ten TRADING days out, not ten
calendar days. Weekends and market holidays do not count, so the horizon needs a real exchange
calendar (exchange_calendars, XNYS). This is why signal_log emission waited until the calendar was
wired — a permanent, insert-only log must carry an exact resolves_on, never an approximation.
"""

from __future__ import annotations

from datetime import date
from functools import lru_cache

import exchange_calendars as xcals
import pandas as pd

_CALENDAR = "XNYS"  # NYSE — the calendar the US-equity universe trades on.


@lru_cache(maxsize=1)
def _calendar():
    """The XNYS calendar, built once (it is expensive to construct)."""
    return xcals.get_calendar(_CALENDAR)


def is_trading_session(day: date) -> bool:
    """True if `day` is a NYSE trading session (not a weekend or market holiday).

    Job B's preflight uses this: on a non-session night there is nothing to brief, so it logs, skips
    the briefing, and still pings success — the dead-man check expects a ping every scheduled night.
    """
    return _calendar().is_session(pd.Timestamp(day))


def sessions_ahead(fired_date: date, n: int) -> date:
    """
    Return the trading session `n` sessions after `fired_date` on the NYSE calendar.

    `fired_date` is snapped to the session on or before it (so a fire logged on a trading day
    resolves `n` sessions later, and a fire dated on a weekend resolves relative to the prior
    session). This is the resolves_on for a signal_log row with an `n`-trading-day horizon.
    """
    cal = _calendar()
    base = cal.date_to_session(pd.Timestamp(fired_date), direction="previous")
    index = cal.sessions.get_loc(base)
    return cal.sessions[index + n].date()
