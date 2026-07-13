"""
Tests for the macro board's cadence rule (Part 6.2, 6.4).

The rule under test is one sentence: a source is CHECKED nightly, but only WRITES when its own
observation actually moves. Everything below is a consequence of that.
"""

from datetime import date, datetime

import macro_stats as ms


FETCHED_AT = datetime(2026, 7, 13, 22, 39)


def _row(series_key: str, as_of: date, value: float, prior: float | None = None) -> ms.MacroStatRow:
    return ms.MacroStatRow(
        series_key=series_key,
        as_of_date=as_of,
        value=value,
        prior=prior,
        as_of_label=ms.label_for(series_key, as_of),
        source_key="fred",
        fetched_at=FETCHED_AT,
    )


# ── the label grammar (the closed window vocabulary, C2) ──────────────────────────────────────

def test_a_weekly_rate_names_its_week():
    assert ms.label_for(ms.MORTGAGE, date(2026, 7, 9)) == "wk of Jul 9"


def test_a_monthly_print_names_its_month():
    assert ms.label_for(ms.CPI_YOY, date(2026, 5, 1)) == "May 2026"


def test_a_daily_quote_names_its_day():
    assert ms.label_for(ms.GOLD, date(2026, 7, 2)) == "Jul 2"
    assert ms.label_for(ms.USD_NPR, date(2026, 7, 13)) == "Jul 13"


# ── the no-thrash rule ────────────────────────────────────────────────────────────────────────

def test_the_first_observation_of_a_series_is_always_written():
    row = _row(ms.MORTGAGE, date(2026, 7, 9), 6.49)
    assert ms.is_new_observation(row, {}) is True


def test_a_weekly_rate_checked_midweek_writes_nothing():
    """
    THE CENTRAL CASE.

    It is Tuesday. Freddie Mac last published on Thursday, and will not publish again until the next
    Thursday. The pipeline calls FRED anyway — the call is cheap and a source that is never checked
    is a source whose outage nobody notices — and gets back exactly what it already has.

    Writing that row again would move `fetched_at` to tonight, which is a claim that the number was
    refreshed tonight. It was not. Nothing is written, and the cell goes on truthfully saying
    "wk of Jul 9".
    """
    stored = {ms.MORTGAGE: (date(2026, 7, 9), 6.49)}
    tuesday_check = _row(ms.MORTGAGE, date(2026, 7, 9), 6.49)

    assert ms.is_new_observation(tuesday_check, stored) is False
    assert ms.new_observations([tuesday_check], stored) == []


def test_a_new_weeks_rate_is_written():
    stored = {ms.MORTGAGE: (date(2026, 7, 9), 6.49)}
    thursday = _row(ms.MORTGAGE, date(2026, 7, 16), 6.55, prior=6.49)

    assert ms.new_observations([thursday], stored) == [thursday]


def test_a_revision_is_written_even_though_the_date_did_not_advance():
    """
    The case a naive "only on a date advance" rule gets wrong.

    Statistical agencies revise. FRED will restate May's CPI under the same May observation date, and
    a pipeline that only ever looked at the date would hold the first print forever — sitting there
    disagreeing with its own source, with every test passing. A changed value under an unchanged
    date is new information, not thrash.
    """
    stored = {ms.CPI_YOY: (date(2026, 5, 1), 4.24867)}
    revised = _row(ms.CPI_YOY, date(2026, 5, 1), 4.31002)

    assert ms.is_new_observation(revised, stored) is True


def test_an_older_observation_never_overwrites_a_newer_one():
    """A source that answers with something stale cannot walk the board backwards."""
    stored = {ms.GOLD: (date(2026, 7, 10), 4085.2)}
    yesterday = _row(ms.GOLD, date(2026, 7, 9), 4071.9)

    assert ms.is_new_observation(yesterday, stored) is False


def test_each_stat_carries_its_own_source_status_key():
    """
    One key cannot describe two failures — the lesson N1 learned the hard way with `fred`.

    A night where gold is unreachable and the rupee is fine has ONE degraded cell. A single "macro"
    status would tell the reader that something is wrong and nothing about what, which is how a
    degradation notice becomes wallpaper.
    """
    assert ms.source_status_key(ms.GOLD) == "macro-gold_usd"
    assert ms.source_status_key(ms.USD_NPR) == "macro-usd_npr"
    assert len({ms.source_status_key(k) for k in ms.SERIES_KEYS}) == len(ms.SERIES_KEYS)


def test_the_series_set_is_closed():
    """Five cells, each with a verified source, a stated cadence, and a label grammar. A sixth key
    arriving without those three things is how an honest board acquires a dishonest cell."""
    assert ms.SERIES_KEYS == ("mortgage30us", "cpi_yoy", "gold_usd", "usd_npr", "mood")
    assert set(ms.CADENCE) == set(ms.SERIES_KEYS)
