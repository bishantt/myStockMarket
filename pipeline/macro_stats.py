"""
macro_stats.py — the macro board's five household stats, and the cadence rule that keeps them honest
(NEWS-AND-CONTROL-PLAN Part 6.2, 6.4).

THE ONE IDEA THIS FILE EXISTS FOR: **checking is not the same as publishing.**

The five stats update on five different schedules. The mortgage rate is weekly (Freddie Mac's survey
publishes on a Thursday). CPI is monthly, and lands mid-month for the month before. Gold and the
rupee move daily. The Mood gauge is computed once a night.

A pipeline that simply wrote whatever it fetched every night would stamp Thursday's mortgage rate
with Tuesday's date, and a reader would see a rate that appears to be refreshed nightly and is not.
That is not a rounding error, it is a false freshness claim — the same species of lie as an ETF's
price wearing an index's name, which is the bug that started this whole plan.

So every source is CHECKED nightly (one cheap call) and only WRITES when the source's own
observation actually moves. "As of" always names the date the SOURCE published for, never the night
we happened to ask. On the nights in between, nothing is written and nothing is stale: a Thursday
rate on a Tuesday is not out of date, it is simply the newest rate that exists, and the label says
so (degradation rung 2).

The one exception to "only when the date advances" is a REVISION. Statistical agencies revise: FRED
will restate last month's CPI under the same observation date. A rule that only wrote on a date
advance would pin us to the first print forever and quietly disagree with the source. So a row is
also written when the date is unchanged but the VALUE has moved — which is new information, not
thrash.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Mapping

# ── the closed set of series ──────────────────────────────────────────────────────────────────
#
# These five keys are the whole board. They are a CLOSED set on purpose: every one of them has a
# verified source, a stated cadence, and a label grammar, and a sixth key appearing without those
# three things is how a board full of honest cells acquires a dishonest one.

MORTGAGE = "mortgage30us"
CPI_YOY = "cpi_yoy"
GOLD = "gold_usd"
USD_NPR = "usd_npr"
MOOD = "mood"

SERIES_KEYS = (MORTGAGE, CPI_YOY, GOLD, USD_NPR, MOOD)

# How often each source publishes something new. This drives the label grammar here, and (mirrored
# in the app) the point at which a cell is old enough to be called stale.
WEEKLY = "weekly"
MONTHLY = "monthly"
DAILY = "daily"

CADENCE: dict[str, str] = {
    MORTGAGE: WEEKLY,
    CPI_YOY: MONTHLY,
    GOLD: DAILY,
    USD_NPR: DAILY,
    MOOD: DAILY,
}

# The FRED series behind the two FRED-sourced cells, and the units they are asked for.
MORTGAGE_SERIES = "MORTGAGE30US"
CPI_SERIES = "CPIAUCNS"

# The Mood gauge's credit-stress input: ICE BofA US High Yield option-adjusted spread. FRED's
# January 2022 purge deleted a large ICE family and it was not obvious from outside which one — the
# N3 recorder run settled it: the purge took the ICE BENCHMARK ADMINISTRATION series, and this index
# family is untouched, live, and 795 observations deep.
CREDIT_SPREAD_SERIES = "BAMLH0A0HYM2"
# `pc1` = percent change from a year ago, computed BY FRED. We store what the source publishes; the
# moment this pipeline divides one CPI level by another it owns an inflation figure of its own, one
# that can disagree with the headline the reader saw on the news and cannot explain why.
CPI_UNITS = "pc1"

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


@dataclass(frozen=True)
class MacroStatRow:
    """One observation of one stat, exactly as the macro_stat table stores it."""

    series_key: str
    as_of_date: date
    value: float
    prior: float | None
    as_of_label: str
    source_key: str
    fetched_at: datetime
    meta: dict | None = None

    def as_columns(self) -> dict:
        """The row, keyed as the table's columns."""
        return {
            "series_key": self.series_key,
            "as_of_date": self.as_of_date,
            "value": self.value,
            "prior": self.prior,
            "as_of_label": self.as_of_label,
            "source_key": self.source_key,
            "fetched_at": self.fetched_at,
            "meta": self.meta,
        }


def label_for(series_key: str, as_of: date) -> str:
    """
    The window as the reader sees it — the label that makes the number's date legible.

    The grammar follows the CADENCE, not the value: a weekly rate names its week, a monthly print
    names its month, a daily quote names its day. This is the pipeline's copy of a vocabulary the
    app also owns (copy.window, the closed C2 set), and the two are held together by a test on the
    seed fixtures — because two independent spellings of "the week of July 9th" is precisely how a
    closed vocabulary stops being closed.
    """
    cadence = CADENCE.get(series_key, DAILY)
    if cadence == WEEKLY:
        return f"wk of {_MONTHS[as_of.month - 1]} {as_of.day}"
    if cadence == MONTHLY:
        return f"{_MONTHS[as_of.month - 1]} {as_of.year}"
    return f"{_MONTHS[as_of.month - 1]} {as_of.day}"


def is_new_observation(row: MacroStatRow, stored: Mapping[str, tuple[date, float]]) -> bool:
    """
    Should this fetched row be WRITTEN, or is it the same observation we already hold?

    `stored` maps a series key to the (date, value) of its newest stored row.

    Three answers:

    1. **Nothing stored yet** → write. The first observation of a series is always news.
    2. **The source's date advanced** → write. A new week's mortgage rate, a new month's CPI.
    3. **Same date, different value** → write. This is a REVISION, and it is the one case a naive
       "only on a date advance" rule gets wrong: agencies restate their prints, and a pipeline that
       refused to notice would sit there disagreeing with its own source forever.

    Everything else — same date, same value — writes nothing. That is the no-thrash rule, and it is
    what keeps `fetched_at` from turning into a nightly lie about how fresh a weekly number is.
    """
    previous = stored.get(row.series_key)
    if previous is None:
        return True

    stored_date, stored_value = previous
    if row.as_of_date > stored_date:
        return True
    if row.as_of_date == stored_date and row.value != stored_value:
        return True
    return False


def new_observations(
    rows: list[MacroStatRow], stored: Mapping[str, tuple[date, float]]
) -> list[MacroStatRow]:
    """The subset of tonight's fetched rows that are actually worth writing (see is_new_observation)."""
    return [row for row in rows if is_new_observation(row, stored)]


def source_status_key(series_key: str) -> str:
    """
    The per-stat key in `pipeline_run.sourceStatus` — "macro-gold_usd", and so on.

    Each stat gets its OWN status key, for the same reason the index levels got theirs in N1: one
    key cannot describe two different failures. A night where gold is unreachable and the rupee is
    fine is a night with one degraded cell, and the footer should say which one — not shrug and call
    "macro" degraded, which tells the reader that something is wrong and nothing about what.
    """
    return f"macro-{series_key}"
