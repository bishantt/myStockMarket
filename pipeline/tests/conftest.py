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

# Every serving table, truncated between tests. TRUNCATE bypasses signal_log's insert-only row
# trigger (which fires per-row on UPDATE/DELETE, not on TRUNCATE), so the log can still be reset.
_ALL_TABLES = "pipeline_run, instrument, price_bar, scan_result, signal_log, watchlist_item"

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
