"""
Job A's run modes (NEWS-AND-CONTROL-PLAN §3.1 item 3, §8.2).

WHY A MACRO MODE EXISTS AT ALL — the posting-time trap.

FRED publishes the index closes AFTER both nightly jobs have already run. Verified against FRED's
own update stamps: the Dow lands around 6:03pm ET, the S&P around 8:01pm, and the Nasdaq Composite
around 11:38pm — against Job A at 6:37pm and Job B at 8:25pm. So a Job-A-time fetch STRUCTURALLY
serves index levels one session older than everything else on the Desk by the time the user reads it
over coffee the next morning. No amount of retrying fixes that; the data does not exist yet.

The fix is a second, tiny run at dawn (`0 10 * * 2-6` UTC = 6:00am EDT) that re-reads FRED and
updates nothing else. By the pre-open coffee read, every index level is the actual prior close.

THE STAGE LISTS ARE CONSTANTS, AND THAT IS THE POINT. A mode is a promise about what a run will and
will not touch — "macro mode does not ingest bars" is the whole reason it is safe to let a user
press it at noon. If a mode could silently grow a stage, that promise would quietly become false and
nobody would notice. So the lists are pinned here, and adding a stage to one means changing a test
on purpose. (N4 extends this with `news` and `compute`; N6 puts the buttons on it.)
"""

from __future__ import annotations

import pytest

from jobs.job_a import MODE_STAGES, parse_mode


def test_the_default_mode_is_the_full_nightly():
    # No argument at all — the 22:37 cron path, and the behaviour that existed before modes did.
    assert parse_mode([]) == "full"


def test_a_mode_can_be_named_on_the_command_line():
    assert parse_mode(["--mode", "macro"]) == "macro"
    assert parse_mode(["--mode", "full"]) == "full"


def test_an_unknown_mode_fails_loudly_rather_than_falling_back_to_full():
    # A typo in a workflow's argv must NOT silently run the whole nightly — that would ingest bars
    # at 6am from a cron whose entire purpose is to touch nothing but three numbers.
    with pytest.raises(ValueError, match="unknown mode"):
        parse_mode(["--mode", "makro"])


def test_full_mode_runs_the_whole_night():
    assert MODE_STAGES["full"] == ("ingest", "compute", "scan", "catalysts", "publish", "revalidate")


def test_macro_mode_touches_the_macro_read_and_nothing_else():
    # THE PROMISE. Macro mode does not ingest bars, does not rebuild scans, does not fetch news, and
    # does not spend a cent of LLM budget. It reads FRED, updates three numbers plus two cells, and
    # asks the app to refresh. That is what makes it cheap enough to run at dawn every day and safe
    # enough to hand the user a button for (N6).
    assert MODE_STAGES["macro"] == ("macro", "publish", "revalidate")

    forbidden = {"ingest", "compute", "scan", "catalysts"}
    assert forbidden.isdisjoint(MODE_STAGES["macro"])


def test_every_mode_publishes_and_revalidates():
    # A run that computed something and did not publish it is a run that did nothing. A run that
    # published and did not revalidate leaves the reader looking at a cache of the old answer.
    for mode, stages in MODE_STAGES.items():
        assert "publish" in stages, f"{mode} must publish"
        assert "revalidate" in stages, f"{mode} must revalidate"
