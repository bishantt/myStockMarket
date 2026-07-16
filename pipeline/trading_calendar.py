"""
trading_calendar.py — the NYSE trading calendar, for the signal log's horizon (plan §P1, Appendix F).

Every signal_log row records when a fired setup RESOLVES: exactly ten TRADING days out, not ten
calendar days. Weekends and market holidays do not count, so the horizon needs a real exchange
calendar (exchange_calendars, XNYS). This is why signal_log emission waited until the calendar was
wired — a permanent, insert-only log must carry an exact resolves_on, never an approximation.
"""

from __future__ import annotations

from datetime import date, datetime
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


def sessions_before(anchor: date, n: int) -> date:
    """
    The trading session `n` sessions BEFORE `anchor` on the NYSE calendar — the mirror of
    sessions_ahead, and what a session-based retention floor is measured in.

    `anchor` is snapped to the session on or before it, so a floor asked from a weekend measures
    from the Friday it belongs to. "Keep the most recent N sessions" is `sessions_before(anchor,
    N - 1)`: the window [that session … anchor] inclusive is exactly N sessions, and the janitor
    deletes rows dated strictly before it. Trading sessions, never calendar days — a weekend is not
    two sessions of age, and trimming by calendar days would retire a Friday's rows on a Monday.
    """
    cal = _calendar()
    base = cal.date_to_session(pd.Timestamp(anchor), direction="previous")
    index = cal.sessions.get_loc(base)
    return cal.sessions[index - n].date()


def previous_session(day: date) -> date:
    """
    The last trading session that actually CLOSED before `day`.

    The 6:00am macro run needs this. FRED posts the index closes long after both nightly jobs have
    run — the Nasdaq Composite lands around 11:38pm ET, hours after Job A finishes at 6:37pm — so a
    second run at dawn is what makes the levels on the morning Desk the real prior close. But at 6am
    today's market has not opened, so the close that run is fetching belongs to the session BEFORE
    today: Tuesday morning reads Monday's close, and Saturday morning reads Friday's.

    Strictly before, therefore — never `day` itself, even when `day` is a session.
    """
    cal = _calendar()
    index = cal.sessions.get_indexer([pd.Timestamp(day)], method="bfill")[0]
    return cal.sessions[index - 1].date()


def latest_closed_session(moment: datetime) -> date:
    """
    The most recent trading session whose CLOSING BELL HAS ALREADY RUNG, as of `moment`.

    This is the honest answer to "what edition are we publishing tonight?", and it is the function
    the Saturday bug existed for the want of (POLISH-AND-DEPTH-PLAN Part 1.2, ruling E1).

    The old code asked the wall clock — `datetime.now(ET).date()` — which answers a different
    question: "what day is it where I am standing?" On Saturday 2026-07-11 the clock said Saturday,
    so Friday's bars were published under a Saturday date, and the Desk spent two days claiming data
    "through Saturday's close". There is no Saturday close. The date of an edition is a fact about
    the MARKET, not about the calendar on the wall, and this is where that fact is looked up.

    Three things it gets right that a hand-rolled version would not:

      - **Before the bell, today does not count.** At 9:00am Monday the market has not opened; the
        newest close that EXISTS is Friday's. A run at 1:00am Tuesday therefore publishes Monday's
        edition, which is exactly the side door the N6 session gate could not close (Q-N6-2): Tuesday
        is a perfectly good session, so the gate waves the run through, and only this function knows
        that Tuesday's close has not happened yet.
      - **Early closes.** The day after Thanksgiving the bell rings at 1:00pm ET, not 4:00pm, and
        the exchange calendar knows it — so the close time is ASKED FOR, never assumed. Hard-coding
        4:00pm would publish the previous session's date over a real half-day's bars, nine-odd times
        a year, on precisely the sleepy days when nobody is checking.
      - **Holidays walk backwards properly.** `previous_session` already crosses weekends and
        holidays; this defers to it rather than subtracting a day and hoping.

    `moment` must be timezone-aware (both jobs pass a market-time `datetime.now`).
    """
    cal = _calendar()
    today = moment.date()

    if is_trading_session(today):
        # Ask the calendar when today's bell rings — it is 4:00pm ET on most days and 1:00pm on the
        # handful of half-days. session_close returns a UTC instant, so the comparison is exact and
        # the caller's timezone cannot skew it.
        close = cal.session_close(pd.Timestamp(today))
        if pd.Timestamp(moment) >= close:
            return today

    return previous_session(today)


def sessions_between(earlier: date, later: date) -> int:
    """
    How many TRADING sessions separate two dates — the honest measure of "how old is this?".

    Calendar days lie about age over a weekend: Friday's close read on Monday morning is one session
    old, not three days old, and calling it three would make every Monday look like a degradation.
    Both dates are snapped to the session on or before them, so a weekend date measures from the
    Friday it belongs to.

    Returns 0 when both land on the same session, and a negative number if `later` precedes
    `earlier` (the caller decides what that means).
    """
    cal = _calendar()
    start = cal.date_to_session(pd.Timestamp(earlier), direction="previous")
    end = cal.date_to_session(pd.Timestamp(later), direction="previous")
    return cal.sessions.get_loc(end) - cal.sessions.get_loc(start)
