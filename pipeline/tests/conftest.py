"""
conftest.py — the throwaway-Postgres harness for DB-integration tests (plan §6.1).

Tests that touch a real database use the `db` fixture. It connects to TEST_DATABASE_URL, applies
the Prisma migrations once (the schema's single source of truth), hands each test a connection, and
truncates every table afterwards. When TEST_DATABASE_URL is unset the tests SKIP loudly — never
silently pass — so a local run without Docker is honest and CI (which provides a Postgres service
container) always exercises them.
"""

import glob
import os
from pathlib import Path

import psycopg
import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

# EVERY table, truncated between tests. TRUNCATE bypasses signal_log's insert-only row trigger
# (which fires per-row on UPDATE/DELETE, not on TRUNCATE), so the log can still be reset.
#
# IT USED TO NAME NINE OF THESE TWENTY-THREE, and the docstring above said "every table" anyway.
# Fourteen tables — briefing, the analytics set, the news set, the board, the paper ledger — were
# never cleared, so their rows accumulated across the whole session and leaked from one test into the
# next. PD0 found it the way these are always found: a new test asserted `SELECT run_date FROM
# briefing` and read back a row written by test_publish.py, twelve tests earlier.
#
# It only showed up in CI, which is the part worth remembering. Every one of these tests SKIPS on a
# machine with no Postgres — so the local suite was green, and the leak was invisible to the person
# most likely to introduce it. A fixture whose docstring is a promise it does not keep is worse than
# no fixture, because every test written against it believes the promise.
_ALL_TABLES = ", ".join([
    # the nightly's serving tables
    "pipeline_run", "instrument", "price_bar", "scan_result", "signal_log", "signal_resolution",
    "market_context", "calendar_event", "watchlist_item",
    # the briefing
    "briefing",
    # the P4 honesty engine
    "base_rate_stat", "setup_card", "vol_band",
    # news (N4/N5)
    "news_item", "news_cluster", "news_image", "catalyst_link",
    # the macro board (N3) and the control room (N6)
    "macro_stat", "manual_run",
    # the reader's own state
    "paper_trade", "journal_entry", "lesson_progress", "concept_state",
])

_MIGRATIONS = sorted(
    glob.glob(str(Path(__file__).resolve().parents[2] / "app" / "prisma" / "migrations" / "*" / "migration.sql"))
)


@pytest.fixture(scope="session")
def _schema() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set — DB integration tests need a throwaway Postgres")
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        already = conn.execute("SELECT to_regclass('public.pipeline_run')").fetchone()[0]
        if not already:
            for migration in _MIGRATIONS:
                conn.execute(Path(migration).read_text())
    return TEST_DATABASE_URL


@pytest.fixture
def db(_schema):
    """A connection to the test database; every table is truncated after the test."""
    conn = psycopg.connect(_schema)
    try:
        yield conn
    finally:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE {_ALL_TABLES} RESTART IDENTITY CASCADE")
        conn.commit()
        conn.close()
