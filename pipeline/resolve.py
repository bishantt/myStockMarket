"""
resolve.py — the nightly signal resolver (plan P4 step 5).

Every fired signal carries a resolves_on date — exactly ten trading days out. When that date passes,
this resolver records what actually happened: was the price higher at the horizon than when the
signal fired? The outcome is written to signal_resolution, which is INSERT-ONLY, so the app's public
track record — including its misses — can never be quietly rewritten (plan §1.5 rule 7).

The resolver is idempotent by construction: it only looks at signals with no resolution yet, and the
insert conflicts harmlessly on the one-per-signal unique key. Running it twice on the same night
resolves each due signal exactly once.

Price lookup is injected (`price_at(symbol, date) -> float | None`) so the flow is testable with a
fake and Job B can wire it to the Parquet history lake. A missing price — a delisting, a gap —
resolves to "na" rather than a guessed hit or miss.
"""

from __future__ import annotations

from datetime import date
from typing import Callable

import psycopg


def classify_outcome(entry: float | None, exit_price: float | None) -> str:
    """Classify a resolved signal: "hit" if the price was higher at the horizon, "miss" if it was
    not, "na" if either price is missing (unresolvable — a delisting or a data gap)."""
    if entry is None or exit_price is None:
        return "na"
    return "hit" if exit_price > entry else "miss"


def resolve_due(
    conn: psycopg.Connection,
    price_at: Callable[[str, date], float | None],
    *,
    as_of: date,
) -> int:
    """Resolve every signal whose horizon has passed and that has no resolution yet. Returns the
    number of new resolution rows written.

    For each due signal, the entry price is its close on the fire date and the exit price is its
    close on the resolution date; `classify_outcome` turns the pair into hit / miss / na. The insert
    is ON CONFLICT DO NOTHING on the one-per-signal unique, so a rerun adds nothing.
    """
    due = _due_signals(conn, as_of)
    if not due:
        return 0

    written = 0
    for signal_id, symbol, fired_date, resolves_on in due:
        entry = price_at(symbol, fired_date)
        exit_price = price_at(symbol, resolves_on)
        outcome = classify_outcome(entry, exit_price)
        written += _insert_resolution(conn, signal_id, outcome)
    conn.commit()
    return written


def due_signals(conn: psycopg.Connection, as_of: date) -> list[tuple[str, str, date, date]]:
    """The signals whose resolves_on has passed and that carry no resolution row yet, as
    (id, symbol, fired_date, resolves_on). Public so a caller can pre-load the prices it needs before
    resolving."""
    return _due_signals(conn, as_of)


def _due_signals(conn: psycopg.Connection, as_of: date) -> list[tuple[str, str, date, date]]:
    """The signals whose resolves_on has passed and that carry no resolution row yet."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sl.id, sl.symbol, sl.fired_date, sl.resolves_on
            FROM signal_log sl
            LEFT JOIN signal_resolution sr ON sr.signal_id = sl.id
            WHERE sl.resolves_on <= %(as_of)s AND sr.id IS NULL
            """,
            {"as_of": as_of},
        )
        return cur.fetchall()


def _insert_resolution(conn: psycopg.Connection, signal_id: str, outcome: str) -> int:
    """Insert one resolution, ignoring a conflict (a resolution already exists). Returns 1 if a row
    was written, 0 if it was already resolved."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO signal_resolution (id, signal_id, outcome, resolved_at)
            VALUES (gen_random_uuid()::text, %(signal_id)s, %(outcome)s, now())
            ON CONFLICT (signal_id) DO NOTHING
            """,
            {"signal_id": signal_id, "outcome": outcome},
        )
        return cur.rowcount
