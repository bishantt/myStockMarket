"""
Tests for publish.py (plan §7.3, §6.2, P1 step 5) against a throwaway Postgres (the `db` fixture).
Covers the happy path, idempotent re-runs, signal_log insert-only + ON CONFLICT DO NOTHING,
per-run scan replacement, and atomic rollback (a failure leaves nothing behind).
"""

import math
from datetime import date

import polars as pl
import pytest

import publish as pub

RUN = date(2026, 6, 30)


def test_json_safe_turns_non_finite_floats_into_none():
    # NaN/±inf out of Polars must become null — Postgres jsonb rejects them, and they are not
    # numbers the app should show anyway.
    assert pub._json_safe(float("nan")) is None
    assert pub._json_safe(float("inf")) is None
    assert pub._json_safe(float("-inf")) is None
    assert pub._json_safe(3.14) == 3.14
    assert pub._json_safe(None) is None
    assert pub._json_safe(False) is False


def test_scan_metrics_with_a_nan_are_stored_as_json_null(db):
    # A real run produces NaN metrics (e.g. RVOL for a thin-volume name); publish must not choke.
    pub.publish(
        db,
        run_date=RUN,
        stage_status={},
        source_status={},
        scan_results=pl.DataFrame(
            {"preset_key": ["unusual-volume"], "symbol": ["THIN"], "rank": [1],
             "ret_1": [0.0], "rvol20": [float("nan")]}
        ),
    )
    metrics = db.execute("SELECT metrics FROM scan_result").fetchone()[0]
    assert metrics["ret_1"] == 0.0
    assert metrics["rvol20"] is None  # NaN became JSON null


def _price_bars(*rows) -> pl.DataFrame:
    return pl.DataFrame(
        rows,
        schema=["symbol", "date", "open", "high", "low", "close", "adj_close", "volume"],
        orient="row",
    )


def _count(conn, table: str) -> int:
    return conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]


def test_writes_every_table_in_one_run(db):
    pub.publish(
        db,
        run_date=RUN,
        stage_status={"ingest": "ok"},
        source_status={"alpaca": "ok"},
        instruments=[{"symbol": "AAPL", "name": "Apple", "exchange": "NASDAQ"}],
        price_bars=_price_bars(("AAPL", RUN, 1.0, 2.0, 0.5, 1.5, 1.5, 1000)),
        scan_results=pl.DataFrame(
            {"preset_key": ["gap-3plus"], "symbol": ["AAPL"], "rank": [1], "gap_pct": [0.05], "lottery_flag": [False]}
        ),
        signal_logs=[{"fired_date": RUN, "symbol": "AAPL", "pattern_key": "gap-3plus", "horizon_days": 10, "resolves_on": date(2026, 7, 14)}],
        market_context={"vix": 15.84, "ten_year": 4.54, "advancers": 3200, "decliners": 1800, "pct_above_50dma": 0.61},
    )
    assert _count(db, "pipeline_run") == 1
    assert _count(db, "instrument") == 1
    assert _count(db, "price_bar") == 1
    assert _count(db, "scan_result") == 1
    assert _count(db, "signal_log") == 1
    assert _count(db, "market_context") == 1


def test_market_context_upserts_by_run_date(db):
    # The macro strip's per-run row is keyed by run date, so a re-run updates it in place rather
    # than duplicating. FRED can be down, so vix / ten_year are nullable.
    base = dict(run_date=RUN, stage_status={}, source_status={})
    pub.publish(db, **base, market_context={"vix": 15.84, "ten_year": 4.54, "advancers": 3200, "decliners": 1800, "pct_above_50dma": 0.61})
    pub.publish(db, **base, market_context={"vix": None, "ten_year": None, "advancers": 2500, "decliners": 2500, "pct_above_50dma": 0.50})
    rows = db.execute("SELECT vix, ten_year, advancers, decliners, pct_above_50dma FROM market_context").fetchall()
    assert rows == [(None, None, 2500, 2500, 0.50)]  # one row, updated in place


def test_rerunning_a_night_makes_no_duplicates(db):
    args = dict(
        run_date=RUN,
        stage_status={}, source_status={},
        instruments=[{"symbol": "AAPL", "name": "Apple", "exchange": "NASDAQ"}],
        price_bars=_price_bars(("AAPL", RUN, 1.0, 2.0, 0.5, 1.5, 1.5, 1000)),
        signal_logs=[{"fired_date": RUN, "symbol": "AAPL", "pattern_key": "gap-3plus", "horizon_days": 10, "resolves_on": date(2026, 7, 14)}],
    )
    pub.publish(db, **args)
    pub.publish(db, **args)  # idempotent re-run
    assert _count(db, "pipeline_run") == 1
    assert _count(db, "price_bar") == 1
    assert _count(db, "signal_log") == 1  # ON CONFLICT DO NOTHING


def test_signal_log_is_insert_only(db):
    sig = [{"fired_date": RUN, "symbol": "AAPL", "pattern_key": "rsi-extreme", "horizon_days": 10, "resolves_on": date(2026, 7, 14)}]
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, signal_logs=sig)
    # The trigger blocks any edit to the log, whoever tries.
    with pytest.raises(psycopg_error := __import__("psycopg").errors.RaiseException):
        with db.cursor() as cur:
            cur.execute("UPDATE signal_log SET symbol = 'X'")
    db.rollback()


def test_a_new_run_replaces_the_prior_scan_results(db):
    base = dict(run_date=RUN, stage_status={}, source_status={})
    pub.publish(db, **base, scan_results=pl.DataFrame({"preset_key": ["gap-3plus"], "symbol": ["AAPL"], "rank": [1], "lottery_flag": [False]}))
    pub.publish(db, **base, scan_results=pl.DataFrame({"preset_key": ["rsi-extreme"], "symbol": ["MSFT"], "rank": [1], "lottery_flag": [False]}))
    rows = db.execute("SELECT preset_key, symbol FROM scan_result").fetchall()
    assert rows == [("rsi-extreme", "MSFT")]  # the first run's results were replaced


def test_a_failure_mid_publish_rolls_everything_back(db):
    # A price bar missing a required field makes the insert fail; the whole run must roll back,
    # so even the pipeline_run row written earlier in the transaction is gone.
    bad = pl.DataFrame(
        [("AAPL", RUN, 1.0, 2.0, 0.5, 1.5, None, 1000)],
        schema=["symbol", "date", "open", "high", "low", "close", "adj_close", "volume"],
        orient="row",
    )
    with pytest.raises(Exception):
        pub.publish(db, run_date=RUN, stage_status={"x": "y"}, source_status={}, price_bars=bad)
    assert _count(db, "pipeline_run") == 0  # nothing committed
