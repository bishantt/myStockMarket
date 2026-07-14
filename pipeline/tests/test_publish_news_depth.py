"""
test_publish_news_depth.py — PD7's three new columns actually reach the database (Appendix B, 9.5).

**THIS FILE EXISTS BECAUSE `publish_news`'s COLUMN WRITE HAD NO DATABASE TEST AT ALL.**

Before PD7 the only test that touched `publish_news` was `test_publish_invariant.py`, which asserts
it REFUSES a non-session date — a guard on the door, not a check of what gets carried through it. So
the INSERT's column list, its ON CONFLICT clause, and the JSON adaptation of every payload were
covered by nothing. A misspelled column, a parameter that never got bound, a JSON field silently
dropped: the whole suite would have stayed green and production would have found out.

That was survivable while the shape was stable. PD7 adds three columns to it, so it is not survivable
any more, and the honest fix is a test that writes a row and reads it back — the only way to know
that what the pipeline THINKS it published is what the table actually holds.

Two halves, and the second is the one that would have bitten:
  1. a v2 cluster round-trips — context, the snapshotted watch rows, and model_meta all come back;
  2. a v1-shaped caller (no context, no watch, no model_meta — the night the narrator never ran)
     still publishes, because every new column is nullable or defaulted and every read is a `.get`.
"""

from __future__ import annotations

from datetime import date, datetime

import psycopg
import pytest

import publish as pub

SESSION = date(2026, 7, 13)  # a real Monday session — E1 refuses anything else


def _cluster(**overrides) -> dict:
    base = {
        "id": "nc-test",
        "run_date": SESSION,
        "first_seen": datetime(2026, 7, 13, 18, 2),
        "headline": "A thing happened",
        "event_type": "ma",
        "sectors": ["Energy"],
        "themes": [],
        "tickers": ["BKR"],
        "significance": 0.5,
        "sources": 3,
        "why_it_matters": "The mechanism, in one line.",
        "affected_note": None,
        "extract": {"summary": "s", "key_numbers": []},
        "verification": {"narrated": True, "flags": [], "cleared": ["$13.6B"]},
        "articles": [],
        "image_id": None,
        "links": [],
    }
    base.update(overrides)
    return base


def _row(db: psycopg.Connection) -> tuple:
    with db.cursor() as cur:
        cur.execute(
            "SELECT context, watch, model_meta, verification FROM news_cluster WHERE id = 'nc-test'"
        )
        return cur.fetchone()


def test_a_v2_cluster_round_trips_every_new_column(db) -> None:
    """What the pipeline thinks it published is what the table holds. Read it back and see."""
    watch = [
        {
            "stat_id": "cal:BKR:next", "key": "BKR", "code": None,
            "kind": "earnings", "title": "BKR earnings", "date": "2026-07-15",
        }
    ]
    meta = {
        "model_extract": "claude-haiku-4-5",
        "model_synth": "claude-sonnet-5",
        "extract_count": 12,
        "note_version": 2,
        "usage": {"claude-sonnet-5": {"calls": 1, "in_tokens": 9000, "out_tokens": 1800}},
    }
    written = pub.publish_news(
        db,
        run_date=SESSION,
        clusters=[
            _cluster(
                context="The move is 2.8x its normal daily range (ATR14).",
                watch=watch,
                model_meta=meta,
            )
        ],
    )
    db.commit()

    assert written == 1
    context, stored_watch, stored_meta, _verification = _row(db)
    assert context == "The move is 2.8x its normal daily range (ATR14)."
    assert stored_watch == watch, "the watch rows are SNAPSHOTTED, not re-resolved at render time"
    assert stored_meta["note_version"] == 2
    assert stored_meta["usage"]["claude-sonnet-5"]["out_tokens"] == 1800


def test_the_cleared_allow_list_reaches_the_database(db) -> None:
    """Q-PD5-1's whole point. The gate's allow-list is worthless if it stops at the pipeline's edge —
    E5 is an APP ruling, and the app can only honour it if the list is in the row."""
    pub.publish_news(db, run_date=SESSION, clusters=[_cluster()])
    db.commit()

    *_, verification = _row(db)
    assert verification["cleared"] == ["$13.6B"]


def test_a_v1_SHAPED_CALLER_STILL_PUBLISHES(db) -> None:
    """The night the narrator never ran — no API key, a dead provider, two schema failures — builds
    cluster dicts with none of PD7's keys in them. Every one of the three columns is nullable or
    defaulted and every read is a `.get`, so the facts publish exactly as they always have.

    This is the case the migration was designed around ("no backfill"), and it is the case that runs
    on any night the model is unavailable — which is to say, the case that must never break."""
    written = pub.publish_news(db, run_date=SESSION, clusters=[_cluster()])
    db.commit()

    assert written == 1
    context, watch, meta, _ = _row(db)
    assert context is None
    assert watch == [], "the column's DEFAULT '[]' is what an absent watch must land as"
    assert meta is None


def test_a_rerun_updates_the_depth_in_place(db) -> None:
    """A cluster keeps its id as more articles join it over the following evenings, so a story that
    is re-narrated must REPLACE its context rather than accumulate a second one. The ON CONFLICT
    clause has to name the new columns, and nothing but a round-trip would prove it does."""
    pub.publish_news(db, run_date=SESSION, clusters=[_cluster(context="first")])
    db.commit()
    pub.publish_news(db, run_date=SESSION, clusters=[_cluster(context="second")])
    db.commit()

    context, *_ = _row(db)
    assert context == "second", "ON CONFLICT does not update the new column"
