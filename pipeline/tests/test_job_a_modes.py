"""
Job A's run modes (NEWS-AND-CONTROL-PLAN §3.1 item 3, §8.2).

WHY A MACRO MODE EXISTS AT ALL — the posting-time trap.

FRED publishes the index closes AFTER both nightly jobs have already run. Verified against FRED's
own update stamps: the Dow lands around 6:03pm ET, the S&P around 8:01pm, and the Nasdaq Composite
around 11:38pm — against Job A at 6:37pm and Job B at 8:25pm. So a Job-A-time fetch STRUCTURALLY
serves index levels one session older than everything else on the Desk by the time the user reads it
over coffee the next morning. No amount of retrying fixes that; the data does not exist yet.

The fix is a second run at dawn that re-reads FRED. Since CC8 that run is `dawn` mode
(`30 10 * * 1-5` UTC = 6:30am EDT, Mon–Fri) — macro is the same index-close fix as one stage of it,
and stays a hand-only button. By the pre-open coffee read, every index level is the actual prior close.

THE STAGE LISTS ARE CONSTANTS, AND THAT IS THE POINT. A mode is a promise about what a run will and
will not touch — "macro mode does not ingest bars" is the whole reason it is safe to let a user
press it at noon. If a mode could silently grow a stage, that promise would quietly become false and
nobody would notice. So the lists are pinned here, and adding a stage to one means changing a test
on purpose. (N4 extends this with `news` and `compute`; N6 puts the buttons on it.)
"""

from __future__ import annotations

import pytest

from datetime import date, datetime, timezone

from jobs.job_a import MODE_STAGES, dawn_edition, parse_mode


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
    assert MODE_STAGES["full"] == (
        "ingest", "compute", "scan", "catalysts", "news", "publish", "revalidate",
    )


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


def test_dawn_mode_refreshes_the_morning_and_ingests_no_bar():
    # THE PROMISE (CC8). The dawn run is the Morning Edition's engine: it re-reads the macro (the
    # index closes FRED posts overnight), rebuilds the front page, and refreshes the forward calendar
    # with its event times — then publishes and revalidates. It does NOT ingest a bar, recompute an
    # indicator or rebuild a scan, which is what keeps it safe to run pre-open every weekday.
    assert MODE_STAGES["dawn"] == ("macro", "news", "catalysts", "publish", "revalidate")

    forbidden = {"ingest", "compute", "scan"}
    assert forbidden.isdisjoint(MODE_STAGES["dawn"])


def test_dawn_edition_refreshes_the_last_close_on_a_session_day():
    # A Wednesday, before the open — the dawn refreshes the session that HAS closed (Tuesday).
    now = datetime(2026, 7, 15, 10, 31, tzinfo=timezone.utc)  # 6:31 AM ET, Wed
    assert dawn_edition(now) == date(2026, 7, 14)


def test_dawn_edition_skips_a_non_session_day():
    # The Mon–Fri cron fires on market HOLIDAYS too (it cannot know them). On a day the market never
    # opens there is no morning to prepare, so the dawn skips — the same gate the full nightly keeps.
    independence_day_observed = datetime(2026, 7, 3, 10, 31, tzinfo=timezone.utc)  # Fri Jul 3, holiday
    assert dawn_edition(independence_day_observed) is None
    saturday = datetime(2026, 7, 18, 10, 31, tzinfo=timezone.utc)
    assert dawn_edition(saturday) is None


def test_news_mode_rebuilds_the_front_page_and_touches_no_market_data():
    """
    THE PROMISE, N4's half. "Refresh the news" re-reads the providers and rebuilds the front page. It
    does not ingest a bar, recompute an indicator, rebuild a scan or touch a base rate.

    That promise is what makes the button safe to hand the user at ANY hour — including while the
    market is open — because nothing news mode writes depends on a session having closed. A
    "refresh the news" button that quietly re-ingested the market would be a button that lies about
    what it does, and the user would have no way to know.
    """
    assert MODE_STAGES["news"] == ("news", "publish", "revalidate")

    forbidden = {"ingest", "compute", "scan", "macro"}
    assert forbidden.isdisjoint(MODE_STAGES["news"])


def test_every_declared_mode_has_a_handler_and_no_mode_can_fall_through_to_a_full_night():
    """
    THE DANGEROUS FAILURE, MADE IMPOSSIBLE.

    Every mode main() does not explicitly recognise falls through to the full nightly run. So a mode
    DECLARED in this table without a handler is not a broken button — it is a button that silently
    re-ingests the entire market. Pressed at noon, it would write half a day of unformed bars over
    the last good close.

    "compute" JOINED THIS SET IN N6, and the fact that you are reading this sentence in a diff is
    the point of the test. It was held out of the table for two phases precisely so that the mode,
    its handler and the button that fires it would land in one commit — a declared mode with no
    handler is the dangerous state described above, and the only way to reach it is to edit this
    line. Nobody does that by accident.

    The set is exactly what the job can actually do, and main() refuses anything else rather than
    guessing.
    """
    assert set(MODE_STAGES) == {"full", "macro", "news", "compute", "dawn"}

    from jobs.job_a import main  # noqa: F401 — imported to prove the handler guard exists
    import inspect

    source = inspect.getsource(main)
    assert "has no handler" in source, "main() must refuse a mode it cannot run, not fall through"

    # Every non-full mode is dispatched by name. This is the assertion that actually closes the
    # hole: the "has no handler" string above proves the guard EXISTS, and this proves no declared
    # mode ever reaches it.
    for mode in MODE_STAGES:
        if mode != "full":
            assert f'mode == "{mode}"' in source, f"{mode!r} is declared but main() never dispatches it"


def test_nothing_is_defined_below_the_entrypoint():
    """
    THE BUG THIS EXISTS FOR SHIPPED TO PRODUCTION AND EVERY UNIT TEST PASSED.

    `run_news_mode` was appended to job_a.py after the `if __name__ == "__main__": main()` block.
    Python executes that block the moment it reaches it, so main() ran while run_news_mode was still
    an undefined name, and the first real news-mode run died with a NameError in eleven seconds.

    No unit test could have caught it: a test IMPORTS the module, which defines every function and
    never executes the entrypoint. The module only breaks when it is RUN as a script, which is the one
    thing the test suite never does. So the check is structural instead — read the file's own syntax
    tree and require that nothing is defined after the entrypoint, which is the actual invariant.
    """
    import ast
    from pathlib import Path

    source = Path(__file__).resolve().parent.parent / "jobs" / "job_a.py"
    tree = ast.parse(source.read_text())

    entrypoints = [
        i for i, node in enumerate(tree.body)
        if isinstance(node, ast.If) and ast.unparse(node.test) == "__name__ == '__main__'"
    ]
    assert entrypoints, "job_a has no entrypoint block — this guard is measuring nothing"

    defined_after = [
        node.name
        for node in tree.body[entrypoints[0] + 1:]
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    ]

    assert not defined_after, (
        f"{defined_after} are defined BELOW the `if __name__ == '__main__'` block, so they do not "
        f"exist yet when main() runs. Every unit test will still pass, and the job will die on its "
        f"first real run."
    )
