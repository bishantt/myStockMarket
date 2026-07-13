"""
The index levels' carry-forward rule (NEWS-AND-CONTROL-PLAN §3.1 item 2).

THE BUG THIS PREVENTS. `_upsert_market_context` used to write `sp500 = EXCLUDED.sp500` — whatever
tonight fetched, including None. So one flaky FRED night replaced a perfectly good index level with
NULL, and the Desk silently collapsed to showing an ETF's price instead. The data was not merely
missing; it was DESTROYED by a successful run.

The rule that fixes it: a level you already have is worth more than a level you failed to fetch.
A failed fetch leaves what is stored alone, and the row records the date those levels are actually
for — so the app can say "as of Jul 9" instead of implying they are tonight's (ruling C7).

THE LEVELS ARE A SET, NOT THREE INDEPENDENT CELLS. They come from one source, on one call cycle,
and they are dated together by one `index_levels_as_of` column. That is why the carry-forward is
all-or-nothing: if tonight got ANY level, tonight's read wins outright (a slot it missed falls back
to its honest ETF proxy, as it always has). Only a total index blackout carries the previous set
forward. One date can then describe every level on the row without lying about any of them.

And the carry-forward EXPIRES. Past five sessions, a dated-but-stale index level is worse than an
honest ETF proxy: the reader is better served by "here is SPY's price, and it is an ETF" than by a
week-old number wearing the S&P 500's name.
"""

from __future__ import annotations

from datetime import date

import pytest

from macro_levels import StoredLevels, resolve_index_levels

# A complete, fresh FRED read.
FETCHED = {
    "sp500": 6812.34,
    "sp500_prior": 6789.10,
    "nasdaq_composite": 22345.67,
    "nasdaq_composite_prior": 22280.15,
    "djia": 44210.55,
    "djia_prior": 44320.80,
}
# Nothing came back at all — a total index blackout.
BLACKOUT = {key: None for key in FETCHED}

# What the database already holds, from an earlier night.
STORED = StoredLevels(
    sp500=6750.00,
    sp500_prior=6740.00,
    nasdaq_composite=22100.00,
    nasdaq_composite_prior=22050.00,
    djia=44000.00,
    djia_prior=43950.00,
    as_of=date(2026, 7, 9),  # a Thursday
)

# 2026-07-10 is the Friday after; 2026-07-13 the following Monday.
FRIDAY = date(2026, 7, 10)


def test_a_good_read_is_written_as_is_and_dated_tonight():
    result = resolve_index_levels(FETCHED, stored=STORED, run_date=FRIDAY)

    assert result["sp500"] == 6812.34
    assert result["djia"] == 44210.55
    # Tonight's levels are for tonight's session, and the row says so.
    assert result["index_levels_as_of"] == FRIDAY


def test_a_failed_read_does_not_destroy_the_levels_already_stored():
    # THE REGRESSION LOCK. Before this rule, this night wrote NULL over all six columns.
    result = resolve_index_levels(BLACKOUT, stored=STORED, run_date=FRIDAY)

    assert result["sp500"] == 6750.00
    assert result["nasdaq_composite"] == 22100.00
    assert result["djia"] == 44000.00
    # And it is dated honestly — these are Thursday's levels, not Friday's.
    assert result["index_levels_as_of"] == date(2026, 7, 9)


def test_a_partial_read_wins_outright_rather_than_mixing_two_nights():
    # The Dow alone failed. Tonight's read still wins: the two levels it got are tonight's, and the
    # Dow falls back to its honest ETF proxy downstream. Mixing a fresh S&P with a stale Dow under
    # ONE as-of date would make that date a lie about one of them.
    partial = {**FETCHED, "djia": None, "djia_prior": None}

    result = resolve_index_levels(partial, stored=STORED, run_date=FRIDAY)

    assert result["sp500"] == 6812.34
    assert result["djia"] is None  # not 44000.00 — the stale Dow is NOT smuggled in
    assert result["index_levels_as_of"] == FRIDAY


def test_with_nothing_fetched_and_nothing_stored_the_levels_are_simply_absent():
    # First nights, and any night after a long outage. The app renders honest ETF proxies.
    result = resolve_index_levels(BLACKOUT, stored=None, run_date=FRIDAY)

    assert result["sp500"] is None
    assert result["index_levels_as_of"] is None


# ── the five-session expiry, at both boundaries ──────────────────────────────────────────────


def test_levels_five_sessions_old_are_still_carried_forward():
    # 2026-07-09 (Thu) + 5 sessions = 2026-07-16 (Thu). Exactly at the limit: still carried.
    result = resolve_index_levels(BLACKOUT, stored=STORED, run_date=date(2026, 7, 16))

    assert result["sp500"] == 6750.00
    assert result["index_levels_as_of"] == date(2026, 7, 9)


def test_levels_six_sessions_old_are_dropped_for_an_honest_proxy():
    # One session past the limit. A week-old number wearing the S&P 500's name is worse than SPY's
    # price wearing SPY's name, so the levels go and the app falls back to the proxy grammar.
    result = resolve_index_levels(BLACKOUT, stored=STORED, run_date=date(2026, 7, 17))

    assert result["sp500"] is None
    assert result["index_levels_as_of"] is None


def test_a_weekend_read_measures_age_in_sessions_not_calendar_days():
    # The 6:00am Saturday macro run. Friday's levels are ZERO sessions old, not one day old — and a
    # calendar-day measure would start ageing them the moment the market closed for the week.
    stored_friday = StoredLevels(**{**STORED.__dict__, "as_of": FRIDAY})

    result = resolve_index_levels(BLACKOUT, stored=stored_friday, run_date=date(2026, 7, 11))

    assert result["sp500"] == 6750.00
    assert result["index_levels_as_of"] == FRIDAY


@pytest.mark.parametrize("column", list(FETCHED))
def test_every_level_column_is_accounted_for(column: str):
    # A new index column added to the read but forgotten here would silently never be written.
    result = resolve_index_levels(FETCHED, stored=None, run_date=FRIDAY)
    assert column in result
