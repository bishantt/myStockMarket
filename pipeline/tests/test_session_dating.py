"""
test_session_dating.py — the dating contract (POLISH-AND-DEPTH-PLAN Part 3.1, ruling E1).

THE BUG THESE TESTS EXIST FOR, stated once so nobody has to reconstruct it:

On Saturday 2026-07-11 at 15:33 ET someone manually dispatched the nightly. Saturday is not a
session; there was no close and there were no new bars, so Alpaca returned FRIDAY's. The job asked
the WALL CLOCK what day it was, got "Saturday", and stamped Friday's data with Saturday's date.
Nothing failed. Every gate stayed green. And for two days the Desk told its reader, in four
different places, that its data ran "through Saturday's close" — a close that has never existed.

The date of an edition is not a fact about the clock. It is a fact about the MARKET: which session
actually closed. So the derivation asks the market's own calendar, and the ingested bars are what
prove the answer. The three layers, each tested here:

  1. the gate       — a non-session day is refused outright (this landed in N6; it is verified here)
  2. the derivation — the edition is the session the DATA describes, cross-checked against the
                      calendar's expectation, and a disagreement fails the night loudly
  3. the invariant  — publish() refuses a non-session run_date (test_publish_invariant.py)

Every clock in this file is a real, named instant. `_et(...)` builds one in market time, because a
test about the market's day that reasons in UTC is a test you have to do the arithmetic for twice.
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from jobs.job_a import full_run_edition
from jobs.job_b import briefing_edition
from trading_calendar import latest_closed_session

_ET = ZoneInfo("America/New_York")


def _et(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    """An instant in market time — the clock the reader and the exchange both live on."""
    return datetime(year, month, day, hour, minute, tzinfo=_ET)


# ── latest_closed_session: which session's bell has actually rung? ─────────────────────────────


def test_after_the_bell_the_session_is_today():
    """The cron's own moment: Monday 6:37pm ET, well after the 4pm close. Today's session is done."""
    assert latest_closed_session(_et(2026, 7, 13, 18, 37)) == date(2026, 7, 13)


def test_before_the_bell_the_session_is_the_previous_one():
    """9:00am Monday: the market has not opened. Today has no close yet, so the newest one is Friday's."""
    assert latest_closed_session(_et(2026, 7, 13, 9, 0)) == date(2026, 7, 10)


def test_after_midnight_the_session_is_yesterdays():
    """
    Q-N6-2, the side door the N6 gate did not close.

    1:00am ET on a Tuesday. Tuesday IS a trading session, so the gate admits the run — and the old
    code then stamped everything TUESDAY, over bars that end on Monday. A phantom edition for a
    session that had not opened, let alone closed.
    """
    assert latest_closed_session(_et(2026, 7, 14, 1, 0)) == date(2026, 7, 13)


def test_the_poisoned_saturday_resolves_to_friday():
    """The real instant of the real bad run: Saturday 2026-07-11, 15:33 ET. The truth is Friday."""
    assert latest_closed_session(_et(2026, 7, 11, 15, 33)) == date(2026, 7, 10)


def test_a_market_holiday_resolves_to_the_session_before_it():
    """
    Thanksgiving 2026 (Thursday 26 November) — a WEEKDAY with no session.

    This is the path the cron actually walks: `37 22 * * 1-5` never fires at a weekend, but it fires
    on every market holiday, roughly nine times a year.
    """
    assert latest_closed_session(_et(2026, 11, 26, 18, 37)) == date(2026, 11, 25)


def test_an_early_close_counts_as_closed():
    """
    The day after Thanksgiving closes at 1:00pm ET, and the calendar knows it.

    At 1:30pm the bell has rung, so the session is today's. Hard-coding 4:00pm as "the close" would
    make this run publish Wednesday's edition over Friday's bars — a one-day lie, nine times a year,
    on exactly the low-attention days nobody is looking.
    """
    assert latest_closed_session(_et(2026, 11, 27, 13, 30)) == date(2026, 11, 27)


def test_before_an_early_close_the_session_is_still_the_previous_one():
    """12:30pm on the half day: the bell has NOT rung. The newest close is Wednesday's (Thursday was
    Thanksgiving), which is also the proof that this walks BACK over a holiday, not just a weekend."""
    assert latest_closed_session(_et(2026, 11, 27, 12, 30)) == date(2026, 11, 25)


# ── job A: the edition a full run publishes ───────────────────────────────────────────────────


def test_full_run_skips_a_day_with_no_session():
    """A weekend dispatch is refused before anything else happens — None means "skip, cleanly"."""
    assert full_run_edition(_et(2026, 7, 11, 15, 33)) is None


def test_full_run_skips_a_market_holiday():
    """The holiday path, which is the one the cron can actually reach on its own."""
    assert full_run_edition(_et(2026, 11, 26, 18, 37)) is None


def test_full_run_at_the_cron_publishes_todays_session():
    """The everyday case, unchanged: the 6:37pm run publishes the session that just closed."""
    assert full_run_edition(_et(2026, 7, 13, 18, 37)) == date(2026, 7, 13)


def test_full_run_after_midnight_publishes_yesterdays_edition():
    """
    THE FIX, in one assertion. A recovery run fired at 1:00am ET on Tuesday now publishes MONDAY's
    edition — the session its bars actually describe — instead of stamping a Tuesday that has not
    happened. The gate cannot catch this one: Tuesday is a perfectly good trading session.
    """
    assert full_run_edition(_et(2026, 7, 14, 1, 0)) == date(2026, 7, 13)


# ── job B: the briefing addresses an edition, not a clock ─────────────────────────────────────


def test_briefing_stamps_the_edition_job_a_published():
    """The cron's own moment: 8:25pm ET Monday, with Monday's edition on the table."""
    assert briefing_edition(_et(2026, 7, 13, 20, 25), date(2026, 7, 13)) == date(2026, 7, 13)


def test_briefing_refuses_when_there_is_no_edition():
    """Nothing has ever been published. There is no edition to write the front of."""
    assert briefing_edition(_et(2026, 7, 13, 20, 25), None) is None


def test_briefing_refuses_to_re_brief_a_stale_edition():
    """
    Job A failed tonight, so the newest edition on the table is still Friday's.

    Briefing it again would synthesize a NEW brief for a night that already has one and overwrite it
    — and it would do so at Monday's usual hour, so the row would look freshly considered. The
    honest outcome is to write nothing and say why. (Job A's own failure already sent the red mail;
    Job B's silence here is not the alarm, it is the refusal to paper over one.)
    """
    assert briefing_edition(_et(2026, 7, 13, 20, 25), date(2026, 7, 10)) is None


def test_briefing_after_midnight_addresses_the_session_that_closed():
    """A job B dispatched at 1:00am Tuesday briefs MONDAY's edition — the one it can actually read."""
    assert briefing_edition(_et(2026, 7, 14, 1, 0), date(2026, 7, 13)) == date(2026, 7, 13)


@pytest.mark.parametrize("moment", [_et(2026, 7, 11, 20, 25), _et(2026, 11, 26, 20, 25)])
def test_briefing_skips_a_non_session_night(moment):
    """A weekend or a holiday night has nothing to brief, whatever happens to sit in the table."""
    assert briefing_edition(moment, date(2026, 7, 10)) is None
