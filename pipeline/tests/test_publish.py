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


def test_market_context_stores_the_index_levels_and_their_priors(db):
    # Redesign §6.1: the true index levels, with the level before each, so the app can state a
    # one-day change without borrowing an ETF's. Every column is nullable — each FRED series can
    # fail alone, and a missing level sends that slot to its honestly-labelled ETF proxy.
    base = dict(run_date=RUN, stage_status={}, source_status={})
    pub.publish(db, **base, market_context={
        "vix": 15.84, "ten_year": 4.54,
        "sp500": 6812.34, "sp500_prior": 6789.10,
        "nasdaq_composite": 22345.67, "nasdaq_composite_prior": 22280.15,
        "djia": 44210.55, "djia_prior": 44320.80,
        "advancers": 3200, "decliners": 1800, "pct_above_50dma": 0.61,
    })
    [row] = db.execute(
        "SELECT sp500, sp500_prior, nasdaq_composite, nasdaq_composite_prior, djia, djia_prior"
        " FROM market_context"
    ).fetchall()
    assert row == (6812.34, 6789.10, 22345.67, 22280.15, 44210.55, 44320.80)


def test_market_context_tolerates_index_levels_that_fred_could_not_supply(db):
    base = dict(run_date=RUN, stage_status={}, source_status={})
    pub.publish(db, **base, market_context={
        "vix": 15.84, "ten_year": 4.54, "advancers": 3200, "decliners": 1800, "pct_above_50dma": 0.61,
    })
    [row] = db.execute("SELECT sp500, sp500_prior, djia FROM market_context").fetchall()
    assert row == (None, None, None)


def test_calendar_rows_carry_the_chip_code_the_desk_renders(db):
    # The chip vocabulary (CPI, JOBS, FOMC, EARNINGS …) is set by the allowlist and persisted with
    # the row — the Desk never derives it from the raw provider name (redesign §6.2).
    base = dict(run_date=RUN, stage_status={}, source_status={})
    pub.publish(db, **base, calendar_events=[
        {"date": RUN, "kind": "macro", "symbol": None, "timing": None, "title": "Consumer Price Index",
         "consensus": None, "prior": None, "importance": "high", "code": "CPI"},
    ])
    [row] = db.execute("SELECT code, importance, title FROM calendar_event").fetchall()
    assert row == ("CPI", "high", "Consumer Price Index")


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


def test_news_items_upsert_by_provider_and_url(db):
    # News is deduped by (provider, url): a rerun refreshes classification, never duplicates.
    item = {"id": "news-aapl-1", "published_at": date(2026, 6, 30), "provider": "finnhub",
            "url": "https://x/1", "headline": "Apple earnings beat", "snippet": "s",
            "tickers": ["AAPL"], "event_type": None}
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, news_items=[item])
    pub.publish(db, run_date=RUN, stage_status={}, source_status={},
                news_items=[{**item, "event_type": "earnings"}])
    rows = db.execute("SELECT tickers, event_type FROM news_item").fetchall()
    assert len(rows) == 1  # ON CONFLICT (provider, url)
    assert rows[0][0] == ["AAPL"]  # text[] round-trips
    assert rows[0][1] == "earnings"  # refreshed


def test_calendar_replaces_the_forward_window_but_none_leaves_it_alone(db):
    ev = {"date": date(2026, 7, 15), "kind": "earnings", "symbol": "AAPL", "timing": None,
          "title": "Apple Q3", "consensus": 1.5, "prior": 1.4, "importance": None}
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, calendar_events=[ev])
    assert _count(db, "calendar_event") == 1
    # A re-run with a different forward event REPLACES the window.
    pub.publish(db, run_date=RUN, stage_status={}, source_status={},
                calendar_events=[{**ev, "symbol": "MSFT", "title": "Microsoft Q4"}])
    rows = db.execute("SELECT symbol FROM calendar_event").fetchall()
    assert rows == [("MSFT",)]
    # None (the ingest was degraded tonight) leaves the existing calendar untouched.
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, calendar_events=None)
    assert _count(db, "calendar_event") == 1


def test_batch_id_persists_and_is_coalesced_on_rerun(db):
    # Job A records the extraction batch id on pipeline_run; a rerun without a new id keeps it.
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, batch_id="batch-abc")
    got = db.execute("SELECT batch_id FROM pipeline_run WHERE run_date = %s", (RUN,)).fetchone()[0]
    assert got == "batch-abc"
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, batch_id=None)
    kept = db.execute("SELECT batch_id FROM pipeline_run WHERE run_date = %s", (RUN,)).fetchone()[0]
    assert kept == "batch-abc"  # COALESCE keeps the id a rerun did not resupply


def test_briefing_publishes_and_reruns_replace(db):
    am = {"today_focus": {"headline": "H", "body": "B", "citations": [], "no_edge_flag": False},
          "items": [], "calendar_notes": [], "learning_link_slug": None}
    verification = {"status": "ok", "checked": 3, "held_reason": None, "flags": []}
    meta = {"model_synth": "claude-sonnet-5", "extract_count": 2}
    pub.publish_briefing(db, run_date=RUN, am_json=am, verification_json=verification,
                         model_meta=meta, status="published")
    row = db.execute(
        "SELECT status, am_json, verification_json FROM briefing WHERE run_date = %s", (RUN,)
    ).fetchone()
    assert row[0] == "published"
    assert row[1]["today_focus"]["headline"] == "H"
    assert row[2]["checked"] == 3
    # A rerun replaces the day's briefing rather than duplicating it.
    pub.publish_briefing(db, run_date=RUN, am_json={**am, "learning_link_slug": "x"},
                         verification_json=verification, model_meta=meta, status="held")
    rows = db.execute("SELECT status FROM briefing WHERE run_date = %s", (RUN,)).fetchall()
    assert rows == [("held",)]


def test_briefing_am_rerun_preserves_an_existing_pm_edition(db):
    am = {"today_focus": {"headline": "H", "body": "B", "citations": [], "no_edge_flag": False},
          "items": [], "calendar_notes": [], "learning_link_slug": None}
    verification = {"status": "ok", "checked": 0, "held_reason": None, "flags": []}
    meta = {"model_synth": "claude-sonnet-5"}
    pm = {"today_focus": {"headline": "PM", "body": "PM", "citations": [], "no_edge_flag": False},
          "items": [], "calendar_notes": [], "learning_link_slug": None}
    pub.publish_briefing(db, run_date=RUN, am_json=am, verification_json=verification,
                         model_meta=meta, status="published", pm_json=pm)
    # A later AM re-publish (pm_json omitted) must not blank the PM edition.
    pub.publish_briefing(db, run_date=RUN, am_json=am, verification_json=verification,
                         model_meta=meta, status="published")
    got = db.execute("SELECT pm_json FROM briefing WHERE run_date = %s", (RUN,)).fetchone()[0]
    assert got["today_focus"]["headline"] == "PM"


# ── the index levels never regress (NEWS-AND-CONTROL-PLAN §3.1 item 2) ───────────────────────


def test_a_failed_fred_night_does_not_wipe_the_index_levels_it_already_had(db):
    """THE REGRESSION LOCK, against real Postgres.

    Before this rule the upsert said `sp500 = EXCLUDED.sp500` — whatever tonight fetched, including
    None. So a single flaky FRED night overwrote a perfectly good index level with NULL and the Desk
    silently collapsed to printing SPY's price under the S&P 500's name. A SUCCESSFUL RUN DESTROYED
    DATA, which is the worst kind of bug this codebase can have: it looked like everything worked.

    Tonight fetches nothing. The levels must survive, dated for the session they actually belong to.
    """
    base = dict(run_date=RUN, stage_status={}, source_status={})
    breadth = {"advancers": 3200, "decliners": 1800, "pct_above_50dma": 0.61}

    # A good night: the levels land.
    pub.publish(db, **base, market_context={
        "vix": 15.84, "ten_year": 4.54,
        "sp500": 6812.34, "sp500_prior": 6789.10,
        "nasdaq_composite": 22345.67, "nasdaq_composite_prior": 22280.15,
        "djia": 44210.55, "djia_prior": 44320.80,
        **breadth,
    })

    # A flaky night: FRED answers for the context cells but not one index series.
    pub.publish(db, **base, market_context={
        "vix": 16.10, "ten_year": 4.51,
        "sp500": None, "sp500_prior": None,
        "nasdaq_composite": None, "nasdaq_composite_prior": None,
        "djia": None, "djia_prior": None,
        **breadth,
    })

    row = db.execute(
        "SELECT sp500, nasdaq_composite, djia, index_levels_as_of, vix FROM market_context"
    ).fetchall()
    assert len(row) == 1
    sp500, nasdaq, djia, as_of, vix = row[0]

    # The levels SURVIVED the failed fetch.
    assert sp500 == 6812.34
    assert nasdaq == 22345.67
    assert djia == 44210.55
    # ...and they are dated for the session they are really for, so the app can age them honestly.
    assert as_of == RUN
    # The cells that DID come back are updated normally — this is not a freeze, it is a floor.
    assert vix == 16.10
