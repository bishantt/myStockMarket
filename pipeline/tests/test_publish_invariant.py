"""
test_publish_invariant.py — E1's lock: publish refuses a date the market never had.

WHY THIS SITS BELOW THE MODE GATES, AND WHY IT IS NOT REDUNDANT WITH THEM.

Job A already refuses to run on a non-session day (the gate, N6), and the full night already
derives its edition from the bars and cross-checks it against the calendar (the derivation, PD0).
Both of those are POLICY: they live in a job, they can be bypassed by a new mode, a new caller, a
refactor, a script someone writes at 2am to backfill something.

Publish is LAW. It is the one choke point every dated row in this product passes through, and after
this file it cannot be talked into writing an edition for a day the market never opened — not by a
new mode, not by a future maintainer, not by the author of the bug it was written for.

The refusals need no database: the guard raises before the connection is touched, which is the whole
point of putting it at the top. So they run on any machine, including this one. The acceptances need
a real Postgres and skip where there isn't one (CI has one).

The dates are the real ones:
  2026-07-11  Saturday   — the date production actually stamped, for two days
  2026-11-26  Thursday   — Thanksgiving: a WEEKDAY with no session, and therefore the path the
                           cron can reach entirely on its own, roughly nine times a year
  2026-07-13  Monday     — a real session, the edition that should have been there
"""

from __future__ import annotations

from datetime import date

import pytest

import publish as pub

SATURDAY = date(2026, 7, 11)
THANKSGIVING = date(2026, 11, 26)
SESSION = date(2026, 7, 13)

# Every publish entry point that writes a DATED EDITION ROW, with the minimum arguments each needs.
# publish_macro_stats is deliberately absent — see test_the_board_may_be_dated_off_session below.
EDITION_WRITERS = {
    "publish": lambda conn, run_date: pub.publish(
        conn, run_date=run_date, stage_status={}, source_status={},
    ),
    "publish_compute": lambda conn, run_date: pub.publish_compute(
        conn, run_date=run_date, scan_results=None, signal_logs=(),
    ),
    "publish_macro": lambda conn, run_date: pub.publish_macro(
        conn, run_date=run_date, macro={"vix": 15.8},
    ),
    "publish_analytics": lambda conn, run_date: pub.publish_analytics(
        conn, run_date=run_date,
    ),
    "publish_briefing": lambda conn, run_date: pub.publish_briefing(
        conn, run_date=run_date, am_json={}, verification_json={}, model_meta={}, status="published",
    ),
    "publish_news": lambda conn, run_date: pub.publish_news(
        conn, run_date=run_date, clusters=(), images=(),
    ),
}


class ExplodingConnection:
    """A connection that fails the test if it is touched at all.

    The refusal has to happen BEFORE the database, or a rejected write is still a write that reached
    the wire — and "it rolled back" is a different promise from "it never happened".
    """

    def cursor(self, *args, **kwargs):
        raise AssertionError(
            "publish reached the database with a non-session run_date. The guard must refuse before "
            "the connection is touched, not roll back afterwards."
        )

    def commit(self):
        raise AssertionError("publish committed a non-session run_date.")

    def rollback(self):
        raise AssertionError("publish reached the database with a non-session run_date.")


@pytest.mark.parametrize("writer", sorted(EDITION_WRITERS))
def test_every_publish_entry_point_refuses_a_saturday(writer):
    """2026-07-11. There is no Saturday close, so there is nothing an edition dated to one can mean."""
    with pytest.raises(pub.NonSessionRunDate) as raised:
        EDITION_WRITERS[writer](ExplodingConnection(), SATURDAY)

    # The message has to carry the whole sentence: a future 2am debugger deserves the date, the day
    # it fell on, and which calendar judged it — not "invalid run_date".
    message = str(raised.value)
    assert "2026-07-11" in message
    assert "Saturday" in message
    assert "XNYS" in message


@pytest.mark.parametrize("writer", sorted(EDITION_WRITERS))
def test_every_publish_entry_point_refuses_a_market_holiday(writer):
    """Thanksgiving 2026 — a Thursday. The weekday holidays are the ones the cron actually reaches."""
    with pytest.raises(pub.NonSessionRunDate) as raised:
        EDITION_WRITERS[writer](ExplodingConnection(), THANKSGIVING)

    assert "2026-11-26" in str(raised.value)
    assert "Thursday" in str(raised.value)


def test_the_guard_can_actually_fail():
    """
    Negative control. A guard that never says yes is not a guard, it is an outage — and this suite
    would look identical either way. (The N-build's lesson: every sweep must prove it swept something.)
    """
    from trading_calendar import is_trading_session

    assert is_trading_session(SESSION) is True
    assert is_trading_session(SATURDAY) is False
    assert is_trading_session(THANKSGIVING) is False


def test_the_board_may_be_dated_off_session_and_that_is_correct():
    """
    publish_macro_stats is NOT guarded, deliberately, and the reason is the ruling's own wording:
    E1 governs a date that CLAIMS A SESSION. The board's rows do not.

    A macro_stat row is keyed by the SOURCE's own observation date — the day Freddie Mac published a
    mortgage rate, the day the BLS printed CPI, the day Nepal Rastra Bank posted a rupee reference.
    Those are facts about a publication, not about a trading session, and several of them land on
    days the market is shut (the rupee is published every calendar day, weekends included). Guarding
    them would refuse true rows for a rule that was never about them.

    This test exists so that absence is a decision on the record rather than an oversight nobody
    notices until they add the guard "for consistency" and break the board on a Sunday.
    """
    assert not hasattr(pub, "_guarded_publish_macro_stats")
    assert "publish_macro_stats" not in EDITION_WRITERS


# ── acceptance: a real session writes, and the guard is not just refusing everything ──────────


def test_publish_accepts_a_real_session(db):
    pub.publish(db, run_date=SESSION, stage_status={"ingest": "ok"}, source_status={"alpaca": "ok"})

    with db.cursor() as cur:
        cur.execute("SELECT count(*) FROM pipeline_run WHERE run_date = %s", (SESSION,))
        assert cur.fetchone()[0] == 1


def test_publish_briefing_accepts_a_real_session(db):
    pub.publish(db, run_date=SESSION, stage_status={}, source_status={})  # the FK parent
    pub.publish_briefing(
        db, run_date=SESSION, am_json={"headline": "x"}, verification_json={}, model_meta={},
        status="published",
    )

    # Ask for THE ROW THIS TEST WROTE, not for "the only row in the table".
    #
    # The first version of this test said `SELECT run_date FROM briefing` and asserted the single
    # result. It passed on this Mac — where every db-backed test SKIPS for want of a Postgres — and
    # failed in CI, where it read back 2026-06-30: a briefing row left behind by test_publish.py.
    # The `db` fixture's docstring promises "every table, truncated between tests"; its list names 9
    # of the schema's 23, and `briefing` is not among them (see conftest, now fixed).
    #
    # The fixture's bug is fixed. This assertion is scoped anyway, because a test that depends on a
    # table being otherwise empty is a test that depends on every other test in the suite.
    with db.cursor() as cur:
        cur.execute("SELECT count(*) FROM briefing WHERE run_date = %s", (SESSION,))
        assert cur.fetchone()[0] == 1


def test_publish_news_accepts_a_real_session(db):
    written = pub.publish_news(db, run_date=SESSION, clusters=(), images=())
    assert written == 0  # an empty front page is still a lawful one
