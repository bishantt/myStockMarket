"""
Tests for trading_calendar.py — the NYSE trading-day horizon behind signal_log.resolves_on.

The horizon is TRADING days, so it must skip weekends and market holidays. These check the count
is exactly right against the calendar itself, and that a real holiday (US Independence Day) is
skipped.
"""

from datetime import date

import exchange_calendars as xcals
import pandas as pd

from trading_calendar import sessions_ahead


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
