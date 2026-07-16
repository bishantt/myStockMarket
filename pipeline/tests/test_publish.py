"""
Tests for publish.py (plan §7.3, §6.2, P1 step 5) against a throwaway Postgres (the `db` fixture).
Covers the happy path, idempotent re-runs, signal_log insert-only + ON CONFLICT DO NOTHING,
per-run scan replacement, and atomic rollback (a failure leaves nothing behind).
"""

import json
import math
from datetime import date, datetime, timezone

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


def test_calendar_refresh_sweeps_a_row_that_has_fallen_behind_the_window(db):
    """
    A row dated BEHIND the run date is litter, and the refresh takes it out.

    THE BUG THIS EXISTS FOR (PD1, live on production for weeks). The refresh used to delete only
    `date >= run_date` — the forward window — and re-insert tonight's fetch. So a row whose date had
    slipped into the PAST was no longer in the window, and nothing ever touched it again. Four of
    them ("Coinbase Cryptocurrencies" and a raw "FOMC Press Release", written by the pre-allowlist
    ingest and dated on a Saturday and a Sunday) sat on the live Desk long after the write path that
    made them had been fixed.

    That is the lesson worth keeping: FIXING A WRITE PATH DOES NOT CLEAN A TABLE. The allowlist
    stopped new litter; it could not reach the litter already there, because the delete only ever
    looked forward.

    The calendar is a FORWARD VIEW. The table holds that window and nothing else — so a refresh
    replaces ALL of it, not just the part still ahead of the clock. There is no history here to
    protect: nothing reads a past calendar row (see loadCalendar in app/lib/morning.ts, which now
    refuses to render one).
    """
    stale = {"date": date(2026, 6, 26), "kind": "macro", "symbol": None, "timing": None,
             "title": "Coinbase Cryptocurrencies", "consensus": None, "prior": None,
             "importance": None, "code": None}
    # An earlier run wrote it, back when that date was still ahead of it.
    pub.publish(db, run_date=date(2026, 6, 25), stage_status={}, source_status={},
                calendar_events=[stale])
    assert _count(db, "calendar_event") == 1

    # Tonight's run is LATER than the stale row's date, so the row now sits behind the window.
    fresh = {"date": date(2026, 7, 15), "kind": "earnings", "symbol": "AAPL", "timing": None,
             "title": "Apple Q3", "consensus": None, "prior": None, "importance": "medium",
             "code": "EARNINGS"}
    pub.publish(db, run_date=RUN, stage_status={}, source_status={}, calendar_events=[fresh])

    # The old refresh left the stale row in place. This one sweeps it.
    rows = db.execute("SELECT title FROM calendar_event ORDER BY date").fetchall()
    assert rows == [("Apple Q3",)]


def test_a_degraded_ingest_still_leaves_a_stale_row_alone(db):
    """
    The sweep is part of the REPLACE, not a separate cleanup — so it only runs when a calendar
    actually arrived. `None` means "no calendar source ran tonight", and a degraded source must
    never blank the calendar (nor half-blank it by deleting the past and inserting nothing).
    """
    stale = {"date": date(2026, 6, 26), "kind": "macro", "symbol": None, "timing": None,
             "title": "Coinbase Cryptocurrencies", "consensus": None, "prior": None,
             "importance": None, "code": None}
    pub.publish(db, run_date=date(2026, 6, 25), stage_status={}, source_status={},
                calendar_events=[stale])

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


# ── the macro board (N3, Part 6) — the cadence rule, against a real database ──────────────────

def _stat(series_key, as_of, value, prior=None, source="fred", meta=None):
    import macro_stats as ms
    from datetime import datetime

    return ms.MacroStatRow(
        series_key=series_key, as_of_date=as_of, value=value, prior=prior,
        as_of_label=ms.label_for(series_key, as_of), source_key=source,
        fetched_at=datetime(2026, 7, 13, 22, 39), meta=meta,
    )


def test_a_macro_stat_checked_again_with_no_new_observation_writes_nothing(db):
    """
    THE NO-THRASH RULE, END TO END.

    Tuesday night. The mortgage rate is checked, and Freddie Mac has published nothing since
    Thursday. The row already in the database is exactly what came back.

    Writing it again would move `fetched_at` to tonight — which is a claim, on the record, that a
    weekly number was refreshed tonight. It was not. So nothing is written, `fetched_at` still says
    Thursday, and the cell goes on truthfully saying "wk of Jul 9".
    """
    from datetime import date as _date, datetime

    thursday = _stat("mortgage30us", _date(2026, 7, 9), 6.49, prior=6.43)
    pub.publish_macro_stats(db, rows=[thursday])

    # Tuesday's check: same observation, same value, a later fetch time.
    import macro_stats as ms
    tuesday_check = ms.MacroStatRow(
        **{**thursday.__dict__, "fetched_at": datetime(2026, 7, 14, 22, 39)}
    )
    written = pub.publish_macro_stats(db, rows=[tuesday_check])

    assert written == []
    [(fetched_at,)] = db.execute("SELECT fetched_at FROM macro_stat WHERE series_key = 'mortgage30us'").fetchall()
    assert fetched_at.day == 13, "an unchanged weekly rate must not be re-stamped with tonight's date"


def test_a_new_weeks_rate_lands_beside_the_old_one_rather_than_replacing_it(db):
    """History accumulates: the key is (series, as-of date), so each week's rate is its own row."""
    from datetime import date as _date

    pub.publish_macro_stats(db, rows=[_stat("mortgage30us", _date(2026, 7, 9), 6.49)])
    written = pub.publish_macro_stats(db, rows=[_stat("mortgage30us", _date(2026, 7, 16), 6.55)])

    assert len(written) == 1
    rows = db.execute(
        "SELECT as_of_date, value FROM macro_stat WHERE series_key = 'mortgage30us' ORDER BY as_of_date"
    ).fetchall()
    assert [(r[0].isoformat(), r[1]) for r in rows] == [("2026-07-09", 6.49), ("2026-07-16", 6.55)]


def test_a_revision_under_the_same_date_updates_the_row_in_place(db):
    """Agencies restate their prints. A changed value under an unchanged date is new information."""
    from datetime import date as _date

    pub.publish_macro_stats(db, rows=[_stat("cpi_yoy", _date(2026, 5, 1), 4.24867)])
    written = pub.publish_macro_stats(db, rows=[_stat("cpi_yoy", _date(2026, 5, 1), 4.31002)])

    assert len(written) == 1
    rows = db.execute("SELECT value FROM macro_stat WHERE series_key = 'cpi_yoy'").fetchall()
    assert rows == [(4.31002,)]   # one row, revised in place — not two rows disagreeing


def test_the_mood_gauge_stores_its_full_component_breakdown(db):
    """
    Ruling C8 at the storage layer. The app makes the breakdown a required prop, so a gauge row
    without one cannot render — which means a row without one is a cell that silently disappears.
    The breakdown travels with the number, always, from the moment it is written.
    """
    from datetime import date as _date

    meta = {
        "score": 42, "band": "leaning fearful",
        "components": [
            {"key": "breadth", "label": "Breadth", "value": 0.61, "window": "% above 50-day",
             "percentile": 0.55, "contributes": "greedy"},
        ],
    }
    pub.publish_macro_stats(db, rows=[_stat("mood", _date(2026, 7, 9), 42.0, source="computed", meta=meta)])

    [(stored,)] = db.execute("SELECT meta FROM macro_stat WHERE series_key = 'mood'").fetchall()
    assert stored["band"] == "leaning fearful"
    assert stored["components"][0]["percentile"] == 0.55


def test_the_prior_is_filled_from_what_we_already_hold_when_the_source_gives_none(db):
    """
    The rupee and the gauge have no source-supplied prior, so theirs is the observation we last
    stored. Neither cell renders a delta from it — a delta whose two ends might be days apart,
    wearing a "1D" label, is exactly the quiet lie this board exists to prevent.
    """
    from datetime import date as _date

    pub.publish_macro_stats(db, rows=[_stat("usd_npr", _date(2026, 7, 10), 152.33, source="nrb")])
    pub.publish_macro_stats(db, rows=[_stat("usd_npr", _date(2026, 7, 13), 152.23, source="nrb")])

    [(prior,)] = db.execute(
        "SELECT prior FROM macro_stat WHERE series_key = 'usd_npr' AND as_of_date = '2026-07-13'"
    ).fetchall()
    assert prior == 152.33


# ----- the JSON boundary (N5) -----
#
# The bug: news_cluster.articles carries each article's PUBLISHED TIME, which is a datetime, nested
# inside a list of dicts. `_json_safe` only ever looked at a scalar float, so the datetime sailed
# straight through into json.dumps and the whole publish transaction died with
# "TypeError: Object of type datetime is not JSON serializable" — AFTER the night had already spent
# four and a half minutes doing every model call. The facts, the ranking and the prose were all
# computed correctly and none of it was written.
#
# A function called `_json_safe` that is not safe for JSON is worse than no function: every caller
# believes the boundary is guarded.

from datetime import datetime, timezone

from publish import _json_safe


def test_json_safe_reaches_INSIDE_lists_and_dicts():
    """It never recursed. A NaN or a datetime one level down was invisible to it."""
    payload = {
        "articles": [
            {"source": "Reuters", "published": datetime(2026, 7, 10, 18, 2, tzinfo=timezone.utc)},
        ],
        "score": float("nan"),
    }

    safe = _json_safe(payload)

    assert safe["articles"][0]["published"] == "2026-07-10T18:02:00+00:00"
    assert safe["score"] is None


def test_json_safe_output_actually_serializes():
    """The assertion that matters. The old one would have passed a shape check and still crashed."""
    payload = [{"at": datetime(2026, 7, 10, tzinfo=timezone.utc), "v": float("inf")}]

    json.dumps(_json_safe(payload))  # must not raise


def test_json_safe_still_nulls_a_bare_nan():
    """The original contract, unchanged: a NaN metric is an honest null, not a token Postgres refuses."""
    assert _json_safe(float("nan")) is None
    assert _json_safe(1.5) == 1.5


# ── publish_compute: a recompute may not erase what the night knew (N6) ──────────────────────


def test_a_recompute_does_not_erase_the_nights_record_of_a_degraded_source(db):
    """
    THE BUG THIS FUNCTION EXISTS TO PREVENT, pinned from the outside.

    `publish()` sets `source_status = EXCLUDED.source_status` on conflict — a wholesale replace. So
    a recompute that went through publish() would overwrite the night's per-provider health. A night
    on which Marketaux was degraded would start reporting every source healthy the moment the reader
    pressed "Recompute scans", and the Desk's source list would quietly lose the record.

    That is ruling M2 ("a degraded source cannot be folded away") broken by the back door. A run that
    called no provider knows nothing about any provider, and must say nothing about them.
    """
    # The night ran, and one provider was unhealthy.
    pub.publish(
        db,
        run_date=RUN,
        stage_status={"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"},
        source_status={"alpaca": "ok", "news-marketaux": "degraded"},
    )

    # Then the reader pressed "Recompute scans".
    pub.publish_compute(db, run_date=RUN, scan_results=None, signal_logs=())

    stage, source = db.execute(
        "SELECT stage_status, source_status FROM pipeline_run WHERE run_date = %s", (RUN,)
    ).fetchone()

    # The degradation SURVIVES. This is the whole test.
    assert source == {"alpaca": "ok", "news-marketaux": "degraded"}
    # And the night's own stage record survives too — merged, not replaced. `ingest` is still there,
    # because the night really did ingest; the recompute simply did not.
    assert stage["ingest"] == "ok"
    assert stage["compute"] == "ok"
    assert stage["scan"] == "ok"


def test_a_recompute_replaces_the_scan_results_for_its_session(db):
    """The point of the button: yesterday's matches, recomputed by today's code."""
    pub.publish(
        db,
        run_date=RUN,
        stage_status={},
        source_status={},
        scan_results=pl.DataFrame(
            {"preset_key": ["unusual-volume"], "symbol": ["OLD"], "rank": [1], "ret_1": [0.01]}
        ),
    )

    pub.publish_compute(
        db,
        run_date=RUN,
        scan_results=pl.DataFrame(
            {"preset_key": ["unusual-volume"], "symbol": ["NEW"], "rank": [1], "ret_1": [0.02]}
        ),
        signal_logs=(),
    )

    symbols = [r[0] for r in db.execute("SELECT symbol FROM scan_result WHERE run_date = %s", (RUN,)).fetchall()]
    assert symbols == ["NEW"]


def test_a_recompute_cannot_duplicate_the_track_record(db):
    """
    signal_log is insert-only and idempotent on its natural key, so pressing the button twice adds
    nothing the second time. If it did, every signal would double-count in the track record — the
    one artifact in this product whose whole job is to keep it honest about being wrong.
    """
    signals = [
        {"fired_date": RUN, "symbol": "AAPL", "pattern_key": "rsi-reversal",
         "horizon_days": 10, "resolves_on": date(2026, 7, 14)},
    ]

    pub.publish_compute(db, run_date=RUN, scan_results=None, signal_logs=signals)
    pub.publish_compute(db, run_date=RUN, scan_results=None, signal_logs=signals)

    count = db.execute("SELECT count(*) FROM signal_log WHERE fired_date = %s", (RUN,)).fetchone()[0]
    assert count == 1


def test_a_recompute_of_a_session_no_night_ever_ran_records_itself_honestly(db):
    """An orphan recompute writes its own row rather than failing — and claims no source health.

    The lake can hold a session the serving database has no run row for (a failed publish, a restored
    backup). The recompute is still real work and still says what it did; it simply has nothing to
    say about any provider, and an empty source map is the honest way to say nothing.
    """
    pub.publish_compute(db, run_date=RUN, scan_results=None, signal_logs=())

    stage, source = db.execute(
        "SELECT stage_status, source_status FROM pipeline_run WHERE run_date = %s", (RUN,)
    ).fetchone()

    assert stage == {"compute": "ok", "scan": "ok", "publish": "ok"}
    assert "ingest" not in stage  # it did not ingest, and does not claim to
    assert source == {}


# ── publish_dawn: the dawn entry lands BESIDE the night's, never over it (CC8) ────────────────


def test_the_dawn_stamp_lands_beside_the_nights_source_status_never_over_it(db):
    """
    The mirror of the compute test above. The dawn shares the night's run_date (E1: it opens no new
    edition), so it must add its health beside the night's, not replace it. A dawn merged through
    publish() would blank the night's per-provider record — the same M2 back door publish_compute
    was written to close.
    """
    pub.publish(
        db,
        run_date=RUN,
        stage_status={"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"},
        source_status={"alpaca": "ok", "marketaux": "degraded"},
    )
    night_finished = db.execute("SELECT finished_at FROM pipeline_run WHERE run_date = %s", (RUN,)).fetchone()[0]

    ran_at = datetime(2026, 7, 1, 10, 31, tzinfo=timezone.utc)
    pub.publish_dawn(
        db,
        run_date=RUN,
        ran_at=ran_at,
        sources={"fred": "ok", "fmp": "ok"},
        stages={"macro": "ok", "news": "ok", "catalysts": "ok", "publish": "ok"},
    )

    finished, stage, source = db.execute(
        "SELECT finished_at, stage_status, source_status FROM pipeline_run WHERE run_date = %s", (RUN,)
    ).fetchone()

    # The night's per-provider health SURVIVES, untouched — this is the whole test.
    assert source["alpaca"] == "ok"
    assert source["marketaux"] == "degraded"
    # The dawn's own entry lands beside them, self-contained (its timestamp, sources and stages).
    assert source["dawn"]["sources"] == {"fred": "ok", "fmp": "ok"}
    assert source["dawn"]["stages"] == {"macro": "ok", "news": "ok", "catalysts": "ok", "publish": "ok"}
    assert source["dawn"]["ranAt"] == ran_at.isoformat()
    # The night's stage record and finish time are NOT moved — the dawn carries its own instant, so
    # the nightly's own Last run stamp stays the night's.
    assert stage == {"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"}
    assert finished == night_finished


def test_a_dawn_run_for_a_session_no_night_ran_records_only_its_own_entry(db):
    """An orphan dawn writes its own entry rather than failing, and claims nothing about a night that
    never happened — the same honesty publish_compute keeps for an orphan recompute."""
    ran_at = datetime(2026, 7, 1, 10, 31, tzinfo=timezone.utc)
    pub.publish_dawn(db, run_date=RUN, ran_at=ran_at, sources={"fred": "ok"}, stages={"macro": "ok"})

    stage, source = db.execute(
        "SELECT stage_status, source_status FROM pipeline_run WHERE run_date = %s", (RUN,)
    ).fetchone()

    assert stage == {}  # it ingested nothing and computed nothing, and does not claim to
    assert source == {"dawn": {"ranAt": ran_at.isoformat(), "sources": {"fred": "ok"}, "stages": {"macro": "ok"}}}


def test_a_second_dawn_replaces_its_own_entry_but_still_keeps_the_nights(db):
    """A re-run at dawn overwrites the previous dawn entry (latest wins) while the night's keys ride
    through untouched — `||` replaces the shared `dawn` key, keeps every other."""
    pub.publish(db, run_date=RUN, stage_status={"ingest": "ok"}, source_status={"alpaca": "ok"})
    pub.publish_dawn(db, run_date=RUN, ran_at=datetime(2026, 7, 1, 10, 31, tzinfo=timezone.utc),
                     sources={"fred": "degraded"}, stages={"macro": "ok"})
    pub.publish_dawn(db, run_date=RUN, ran_at=datetime(2026, 7, 1, 10, 33, tzinfo=timezone.utc),
                     sources={"fred": "ok"}, stages={"macro": "ok"})

    source = db.execute("SELECT source_status FROM pipeline_run WHERE run_date = %s", (RUN,)).fetchone()[0]
    assert source["alpaca"] == "ok"  # the night's key survives both dawns
    assert source["dawn"]["sources"] == {"fred": "ok"}  # the later dawn won
    assert source["dawn"]["ranAt"].endswith("10:33:00+00:00")


# ── publish_janitor: the retirement stamp lands BESIDE the night's, never over it (CC10) ──────


def test_the_janitor_stamp_lands_beside_the_nights_source_status_never_over_it(db):
    """The twin of the dawn test. The janitor is a stage of the full run and shares its run_date, so its
    entry must merge beside the night's provider health, not replace it — a healthy night must never read
    degraded because deletion ran."""
    pub.publish(
        db,
        run_date=RUN,
        stage_status={"ingest": "ok", "publish": "ok"},
        source_status={"alpaca": "ok", "marketaux": "degraded"},
    )
    ran_at = datetime(2026, 7, 1, 22, 40, tzinfo=timezone.utc)
    entry = {"ranAt": ran_at.isoformat(), "news": 214, "days": 45, "scans": 1,
             "backupsKept": 8, "backupsSeen": 9, "deleted": {"news_item": 200, "scan_result": 30}}
    pub.publish_janitor(db, run_date=RUN, entry=entry)

    source = db.execute("SELECT source_status FROM pipeline_run WHERE run_date = %s", (RUN,)).fetchone()[0]
    # The night's per-provider health survives untouched.
    assert source["alpaca"] == "ok"
    assert source["marketaux"] == "degraded"
    # The janitor's report lands beside them, self-contained.
    assert source["janitor"]["news"] == 214
    assert source["janitor"]["scans"] == 1
    assert source["janitor"]["backupsKept"] == 8
    assert source["janitor"]["ranAt"] == ran_at.isoformat()


# ── publish_calendar: the dawn refreshes the forward view, and nothing else (CC8) ─────────────


def test_publish_calendar_replaces_the_forward_view(db):
    pub.publish_calendar(db, calendar_events=[
        {"date": date(2026, 7, 15), "kind": "earnings", "symbol": "AAPL", "timing": "amc",
         "title": "AAPL earnings", "consensus": None, "prior": None, "importance": "medium", "code": "EARNINGS"},
    ])
    [(code, timing)] = db.execute("SELECT code, timing FROM calendar_event").fetchall()
    assert (code, timing) == ("EARNINGS", "amc")


def test_publish_calendar_leaves_the_table_untouched_when_no_source_ran(db):
    pub.publish_calendar(db, calendar_events=[
        {"date": date(2026, 7, 15), "kind": "macro", "symbol": None, "timing": "8:30 AM ET",
         "title": "Consumer Price Index", "consensus": None, "prior": None, "importance": "high", "code": "CPI"},
    ])
    # None means the calendar sources were down — it must LEAVE the existing calendar, never blank it.
    pub.publish_calendar(db, calendar_events=None)
    assert _count(db, "calendar_event") == 1
