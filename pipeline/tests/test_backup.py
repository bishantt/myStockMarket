"""
Tests for backup.py — proving a pg_dump can actually be restored (plan §P1 step 9).

The acceptance is "backup restored once successfully": a backup nobody has restored is a hope, not
a backup. This inserts a sentinel row, dumps the database, deletes the row, restores the dump, and
checks the row is back — the whole dump → restore round trip against the throwaway Postgres.

Gated twice: it skips without TEST_DATABASE_URL (the `db` fixture) and without the postgres client
tools on PATH. CI installs postgresql-client-17 and provides the service container, so it runs there.
"""

import os
import shutil

import psycopg
import pytest

import backup

pytestmark = pytest.mark.skipif(
    shutil.which("pg_dump") is None or shutil.which("pg_restore") is None,
    reason="postgres client tools (pg_dump/pg_restore) not installed",
)

SENTINEL = "2099-01-01"


def _sentinel_count(url: str) -> int:
    with psycopg.connect(url) as conn:
        return conn.execute(
            "SELECT count(*) FROM pipeline_run WHERE run_date = %s", (SENTINEL,)
        ).fetchone()[0]


def test_dump_then_restore_brings_back_a_deleted_row(db, tmp_path):
    url = os.environ["TEST_DATABASE_URL"]

    # A sentinel row we can watch disappear and come back.
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO pipeline_run (run_date, started_at, finished_at, stage_status, source_status) "
            "VALUES (%s, now(), now(), '{}', '{}')",
            (SENTINEL,),
        )
    db.commit()

    dump_path = backup.dump(url, tmp_path / "roundtrip.dump")
    assert dump_path.exists() and dump_path.stat().st_size > 0

    # Delete it, confirm it is gone, then restore and confirm it is back.
    with db.cursor() as cur:
        cur.execute("DELETE FROM pipeline_run WHERE run_date = %s", (SENTINEL,))
    db.commit()
    assert _sentinel_count(url) == 0

    backup.restore(url, dump_path)
    assert _sentinel_count(url) == 1
