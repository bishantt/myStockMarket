"""
Tests for resolve.py — the nightly signal resolver (plan P4 step 5, §6.2).

The pure outcome classifier is tested directly. The DB flow (one resolution per signal; a rerun
produces no second row) runs against the throwaway Postgres via the `db` fixture, and skips locally
without TEST_DATABASE_URL — the insert-only track record must fill within a day of a horizon passing.
"""

from __future__ import annotations

from datetime import date

import resolve


def test_classify_outcome_hit_miss_na():
    assert resolve.classify_outcome(100.0, 110.0) == "hit"   # price higher → hit
    assert resolve.classify_outcome(100.0, 90.0) == "miss"   # lower → miss
    assert resolve.classify_outcome(100.0, 100.0) == "miss"  # flat is not "higher" → miss
    assert resolve.classify_outcome(None, 110.0) == "na"     # no entry price → cannot resolve
    assert resolve.classify_outcome(100.0, None) == "na"     # no exit price → cannot resolve


def _insert_signal(db, *, sid: str, symbol: str, fired: date, resolves: date) -> None:
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO signal_log (id, fired_date, symbol, pattern_key, horizon_days, resolves_on) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (sid, fired, symbol, "unusual-volume", 10, resolves),
        )
    db.commit()


def test_resolver_writes_one_row_per_signal_and_is_idempotent(db):
    _insert_signal(db, sid="sig-1", symbol="ACME", fired=date(2026, 6, 1), resolves=date(2026, 6, 15))

    prices = {("ACME", date(2026, 6, 1)): 100.0, ("ACME", date(2026, 6, 15)): 112.0}
    price_at = lambda symbol, day: prices.get((symbol, day))

    count = resolve.resolve_due(db, price_at, as_of=date(2026, 6, 20))
    assert count == 1
    rows = db.execute("SELECT signal_id, outcome FROM signal_resolution").fetchall()
    assert rows == [("sig-1", "hit")]

    # A rerun resolves nothing new — the horizon is already recorded (insert-only, one per signal).
    again = resolve.resolve_due(db, price_at, as_of=date(2026, 6, 20))
    assert again == 0
    assert db.execute("SELECT count(*) FROM signal_resolution").fetchone()[0] == 1


def test_resolver_skips_signals_whose_horizon_has_not_passed(db):
    _insert_signal(db, sid="sig-future", symbol="ACME", fired=date(2026, 6, 1), resolves=date(2026, 7, 1))
    price_at = lambda symbol, day: 100.0
    count = resolve.resolve_due(db, price_at, as_of=date(2026, 6, 20))  # before resolves_on
    assert count == 0


def test_resolver_records_na_when_a_price_is_missing(db):
    _insert_signal(db, sid="sig-na", symbol="GONE", fired=date(2026, 6, 1), resolves=date(2026, 6, 15))
    price_at = lambda symbol, day: None  # e.g. a delisting — no bar to resolve against
    count = resolve.resolve_due(db, price_at, as_of=date(2026, 6, 20))
    assert count == 1
    assert db.execute("SELECT outcome FROM signal_resolution").fetchone()[0] == "na"
