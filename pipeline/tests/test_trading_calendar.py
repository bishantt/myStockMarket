"""
Tests for trading_calendar.py — the NYSE trading-day horizon behind signal_log.resolves_on.

The horizon is TRADING days, so it must skip weekends and market holidays. These check the count
is exactly right against the calendar itself, and that a real holiday (US Independence Day) is
skipped.
"""

from datetime import date

import exchange_calendars as xcals
import pandas as pd

from trading_calendar import previous_session, sessions_ahead, sessions_between


def test_matches_stepping_next_session_ten_times():
    # Two implementations, one answer: the offset must equal stepping next_session n times.
    cal = xcals.get_calendar("XNYS")
    start = date(2026, 6, 30)
    ts = pd.Timestamp(start)
    for _ in range(10):
        ts = cal.next_session(ts)
    assert sessions_ahead(start, 10) == ts.date()


def test_skips_a_market_holiday():
    # Ten sessions after 2026-06-30 lands on 2026-07-15 — the 3 July Independence-Day holiday
    # (observed) does not count as a trading day.
    assert sessions_ahead(date(2026, 6, 30), 10) == date(2026, 7, 15)


def test_a_weekend_fired_date_snaps_to_the_prior_session():
    # 2026-07-04 is a Saturday; the prior session is 2 July (3 July is the holiday), so one session
    # ahead is Monday 6 July.
    assert sessions_ahead(date(2026, 7, 4), 1) == date(2026, 7, 6)


# ── sessions_between and previous_session (NEWS-AND-CONTROL-PLAN §3.1) ───────────────────────


def test_sessions_between_counts_trading_days_not_calendar_days():
    # Thursday 2026-07-09 → Friday 2026-07-10 is one session.
    assert sessions_between(date(2026, 7, 9), date(2026, 7, 10)) == 1
    # Friday → the following Monday is ONE session, not three days. Measuring a weekend in calendar
    # days would age Friday's close by three every Monday, and make every Monday look degraded.
    assert sessions_between(date(2026, 7, 10), date(2026, 7, 13)) == 1
    # The same session is zero old.
    assert sessions_between(date(2026, 7, 10), date(2026, 7, 10)) == 0


def test_sessions_between_snaps_a_weekend_date_to_the_session_it_belongs_to():
    # Saturday belongs to Friday. The 6:00am Saturday macro run is reading Friday's close, and
    # Friday's levels are ZERO sessions old at that moment — not one day old.
    assert sessions_between(date(2026, 7, 10), date(2026, 7, 11)) == 0


def test_previous_session_is_the_last_session_that_actually_CLOSED():
    # This is what the 6:00am macro cron needs. At 6am the market has not opened yet, so "today" is
    # not a session whose close exists — the data it is fetching belongs to the session before.
    #
    # Tuesday 6am → Monday's close.
    assert previous_session(date(2026, 7, 14)) == date(2026, 7, 13)
    # Saturday 6am → Friday's close (the cron runs Tue–Sat to catch Friday).
    assert previous_session(date(2026, 7, 11)) == date(2026, 7, 10)
    # Monday 6am → the previous Friday, skipping the weekend entirely.
    assert previous_session(date(2026, 7, 13)) == date(2026, 7, 10)
