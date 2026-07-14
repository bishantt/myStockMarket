"""
test_calendars_agree.py — the app and the pipeline must mean the same thing by "a trading session".

THERE ARE TWO CALENDARS IN THIS PRODUCT, and there have to be.

  pipeline/trading_calendar.py   `exchange_calendars`, XNYS. The real thing, in Python. It decides
                                 which day an edition is stamped with, and (since PD0) publish
                                 refuses any run_date it rejects.
  app/lib/market-hours.ts        A hand-written holiday table through 2028, in TypeScript. It decides
                                 whether the reader is told "Markets open", whether the control room
                                 offers a button, and — from PD0 — whether `check:live` says the
                                 production masthead is telling the truth.

The app cannot use the Python one (it runs in a browser) and the pipeline should not use the
hand-written one (an exchange calendar is a solved problem and this repo is not going to re-solve
it). So there are two, and they are allowed to be two. What they are NOT allowed to be is DIFFERENT.

WHAT A DISAGREEMENT WOULD ACTUALLY DO — and it is worse than it sounds, because every failure mode
lands on the GUARD rather than on the product. Suppose the app's table forgets a holiday the
exchange observes. The pipeline correctly declines to publish an edition that day. The app, believing
it a session, tells the reader the market is open — and `check:live`, the one instrument PD0 builds
that can see production, goes RED against a Desk that is perfectly correct, because it is measuring
the truth against the wrong calendar. Forget one the other way and check:live expects yesterday's
edition while production correctly shows today's: red again, healthy app again. A guard that cries
wolf is a guard that gets ignored, and then it is not there on the night it is right.

So this walks every day the app claims to know and asks both. Not the holiday lists — the ANSWERS. A
holiday list can be right while a weekend rule is wrong; only the answer is worth comparing.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import exchange_calendars as xcals
import pandas as pd
import pytest

from trading_calendar import is_trading_session

_APP_CALENDAR = Path(__file__).resolve().parents[2] / "app" / "lib" / "market-calendar.json"


def _app_calendar() -> tuple[set[str], str]:
    """The app's holiday set and the last day it claims to know — READ FROM ITS OWN FILE.

    Not copied into this test, deliberately. A copy of the app's holiday list living here would be a
    third calendar, and the entire point of this file is that a second copy of a fact is a second
    answer waiting to happen. (The table is JSON precisely so that this test and check-live.mjs can
    both read the one the app actually ships — see lib/market-hours.ts's header.)
    """
    data = json.loads(_APP_CALENDAR.read_text())
    return set(data["holidays"]), data["endsOn"]


def _app_says_session(day: date, holidays: set[str]) -> bool:
    """The app's own isTradingDay logic, restated: not a weekend, not in the holiday table."""
    if day.weekday() >= 5:  # Saturday, Sunday
        return False
    return day.isoformat() not in holidays


def _exchange_through(last: str):
    """
    XNYS, built out to `last`.

    WHY THIS IS NOT trading_calendar's OWN CALENDAR, and it is worth knowing:
    `xcals.get_calendar("XNYS")` builds a ROLLING window — twenty years back, ONE YEAR FORWARD. So
    the pipeline's calendar today knows sessions only to 2027-07-13, while the app's table claims to
    know through 2028-12-31, and asking `is_trading_session` about a day beyond its horizon raises
    DateOutOfBounds rather than answering. That horizon is fine for the pipeline's actual job (a run
    date is always about now, and test_the_pipelines_horizon_covers_any_real_run_date pins that), but
    it cannot be used to audit a table that reaches further out than it does. So the comparison below
    builds a calendar that covers the whole range under test.
    """
    return xcals.get_calendar("XNYS", start="2025-01-01", end=last)


def test_the_two_calendars_agree_on_every_day_the_app_claims_to_know():
    """
    Day by day, from 2026 through the end of the app's table. Every disagreement is named.

    This is the test that would catch a missing Good Friday, a Juneteenth observed on the wrong
    weekday, or a holiday the exchange adds — none of which anything else in this repo asks about,
    because until PD0 nothing in the gate ever put the two calendars in the same room.
    """
    holidays, ends = _app_calendar()
    exchange = _exchange_through(ends)

    day = date(2026, 1, 1)
    # The calendar's index ends on its last SESSION (Friday 2028-12-29), and asking it about a day
    # past that raises rather than answering. The app's table runs two days further, to 2028-12-31 —
    # so the tail is checked separately, and only because it is checked can the loop stop here
    # without quietly skipping days that might have disagreed.
    last = exchange.last_session.date()

    tail = [
        date.fromisoformat(ends) - timedelta(days=offset)
        for offset in range((date.fromisoformat(ends) - last).days)
    ]
    assert all(d.weekday() >= 5 for d in tail), (
        f"the app's calendar runs to {ends} but the exchange index ends at {last.isoformat()}, and "
        f"the days between them are not all weekends: {[d.isoformat() for d in tail]}. Those days "
        f"are unaudited — extend the exchange calendar rather than looking away."
    )

    disagreements = []
    while day <= last:
        app_says = _app_says_session(day, holidays)
        exchange_says = bool(exchange.is_session(pd.Timestamp(day)))
        if app_says != exchange_says:
            disagreements.append(
                f"{day.isoformat()} ({day.strftime('%A')}): "
                f"app says {'session' if app_says else 'closed'}, "
                f"XNYS says {'session' if exchange_says else 'closed'}"
            )
        day += timedelta(days=1)

    assert disagreements == [], (
        "The app and the pipeline disagree about which days the market trades. Every one of these is "
        "a day where check:live would judge a correct production Desk against the wrong calendar:\n  "
        + "\n  ".join(disagreements)
    )


def test_the_comparison_can_actually_fail():
    """
    Negative control. This file is a loop comparing two booleans; if the app's holiday table failed to
    parse it would come back EMPTY, every weekday would look like a session to both sides, and the
    loop would report a clean bill of health for a table it never read.
    """
    holidays, ends = _app_calendar()

    assert len(holidays) >= 25, f"only parsed {len(holidays)} holidays out of market-hours.ts — the regex is broken"
    assert ends == "2028-12-31"
    assert "2026-11-26" in holidays  # Thanksgiving
    assert "2026-07-03" in holidays  # Independence Day, observed — the 4th is a Saturday

    # And the two sides really do produce different answers on different days, so a mismatch is
    # detectable at all.
    assert _app_says_session(date(2026, 7, 13), holidays) is True
    assert _app_says_session(date(2026, 7, 11), holidays) is False
    assert is_trading_session(date(2026, 7, 13)) is True
    assert is_trading_session(date(2026, 7, 11)) is False


@pytest.mark.parametrize(
    "day,name",
    [
        (date(2026, 7, 3), "Independence Day observed — the 4th is a Saturday"),
        (date(2026, 11, 26), "Thanksgiving"),
        (date(2027, 12, 24), "Christmas observed — the 25th is a Saturday"),
        (date(2028, 4, 14), "Good Friday — the one with no fixed date"),
    ],
)
def test_the_awkward_holidays_are_right_in_both(day, name):
    """The observed-shift ones, spelled out by hand.

    A loop that prints "0 disagreements" is easy to trust and impossible to read. These four are
    where a hand-written table actually goes wrong, so they are named, and a reader can check them
    against a wall calendar without running anything.
    """
    holidays, ends = _app_calendar()
    exchange = _exchange_through(ends)

    assert bool(exchange.is_session(pd.Timestamp(day))) is False, name
    assert _app_says_session(day, holidays) is False, name


def test_the_pipelines_horizon_covers_any_real_run_date():
    """
    The pipeline's own calendar is a rolling window — 20 years back, one year forward — and a date
    past its edge RAISES rather than answering False.

    That is not reachable from a run: an edition date is always the session that just closed, and a
    signal resolves ten sessions out. But `_require_session` is now on the publish path, so if the
    horizon ever shrank to nothing this would stop being a curiosity and start being an outage. Pin
    it: the calendar must comfortably answer for any date a run could plausibly carry.
    """
    today = date.today()
    for days_out in (0, 30, 90, 180):
        # Must not raise. (What it ANSWERS depends on the day; that is not the point here.)
        is_trading_session(today + timedelta(days=days_out))
