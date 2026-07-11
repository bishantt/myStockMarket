"""
publish.py — the single-transaction refresh of the serving tables (plan §7.3, P1 step 5).

Everything the app reads is written here, in ONE transaction, so a reader mid-publish sees the
whole previous generation or the whole new one, never a mix. The app never sees a half-updated
Desk.

What gets written each run:
  pipeline_run   the run's stage/source status (upsert by run date)
  instrument     the served universe (upsert by symbol — delisted names are kept, never deleted)
  price_bar      daily bars for the served symbols (upsert by symbol+date)
  scan_result    this run's preset matches (the run's rows are replaced)
  signal_log     one row per fired setup, INSERT ... ON CONFLICT DO NOTHING — insert-only and
                 idempotent, so re-running a night adds nothing and rewrites nothing
  market_context the day's macro strip — VIX, 10-year yield, breadth (upsert by run date)

Idempotency is the point: a workflow_dispatch re-run of a night produces zero duplicates. The
inputs are plain Python/Polars structures the compute stage builds; this module only persists them.
"""

from __future__ import annotations

import json
import math
from datetime import date
from typing import Any, Iterable, Mapping

import polars as pl
import psycopg
from psycopg.types.json import Json


def _json_safe(value: Any) -> Any:
    """
    Make a metric value safe for Postgres jsonb, which — unlike Python and JSON5 — rejects the
    non-finite floats NaN and ±Infinity outright.

    An indicator that could not be computed (say RVOL for a name with too little volume history)
    surfaces as a float NaN out of Polars. NaN in a metrics map is not a number the app should ever
    show, so it becomes null: the honest "no value" rather than a token Postgres refuses to store.
    """
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def publish(
    conn: psycopg.Connection,
    *,
    run_date: date,
    stage_status: Mapping[str, Any],
    source_status: Mapping[str, Any],
    instruments: Iterable[Mapping[str, Any]] = (),
    price_bars: pl.DataFrame | None = None,
    scan_results: pl.DataFrame | None = None,
    signal_logs: Iterable[Mapping[str, Any]] = (),
    market_context: Mapping[str, Any] | None = None,
    news_items: Iterable[Mapping[str, Any]] = (),
    calendar_events: Iterable[Mapping[str, Any]] | None = None,
) -> None:
    """
    Persist a run's serving data atomically. Commits on success; rolls back on any error.

    The caller passes a psycopg connection so a test can run this against a throwaway database.
    Everything happens inside one transaction — psycopg opens one implicitly and this commits it at
    the end, so nothing is visible to other connections until it all succeeds.
    """
    try:
        with conn.cursor() as cur:
            _upsert_pipeline_run(cur, run_date, stage_status, source_status)
            _upsert_instruments(cur, instruments)
            _upsert_price_bars(cur, price_bars)
            _replace_scan_results(cur, run_date, scan_results)
            _insert_signal_logs(cur, signal_logs)
            _upsert_market_context(cur, run_date, market_context)
            _upsert_news_items(cur, news_items)
            _replace_calendar(cur, run_date, calendar_events)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _upsert_pipeline_run(cur, run_date, stage_status, source_status) -> None:
    cur.execute(
        """
        INSERT INTO pipeline_run (run_date, started_at, finished_at, stage_status, source_status)
        VALUES (%(run_date)s, now(), now(), %(stage)s, %(source)s)
        ON CONFLICT (run_date) DO UPDATE SET
            finished_at = now(), stage_status = EXCLUDED.stage_status,
            source_status = EXCLUDED.source_status
        """,
        {"run_date": run_date, "stage": Json(dict(stage_status)), "source": Json(dict(source_status))},
    )


def _upsert_instruments(cur, instruments) -> None:
    rows = [
        (i["symbol"], i["name"], i["exchange"], i.get("sector"), i.get("industry"),
         i.get("cik"), i.get("is_active", True), i.get("delisted_at"))
        for i in instruments
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO instrument (symbol, name, exchange, sector, industry, cik, is_active, delisted_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name, exchange = EXCLUDED.exchange, sector = EXCLUDED.sector,
            industry = EXCLUDED.industry, cik = EXCLUDED.cik, is_active = EXCLUDED.is_active,
            delisted_at = EXCLUDED.delisted_at
        """,
        rows,
    )


def _upsert_price_bars(cur, price_bars: pl.DataFrame | None) -> None:
    if price_bars is None or price_bars.height == 0:
        return
    rows = [
        (r["symbol"], r["date"], r["open"], r["high"], r["low"], r["close"], r["adj_close"], int(r["volume"]))
        for r in price_bars.iter_rows(named=True)
    ]
    cur.executemany(
        """
        INSERT INTO price_bar (symbol, date, open, high, low, close, adj_close, vol)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (symbol, date) DO UPDATE SET
            open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
            close = EXCLUDED.close, adj_close = EXCLUDED.adj_close, vol = EXCLUDED.vol
        """,
        rows,
    )


def _replace_scan_results(cur, run_date, scan_results: pl.DataFrame | None) -> None:
    # A run's scan results replace the prior run's for that date — delete then insert, in the
    # same transaction, so a reader never sees the day with no results.
    cur.execute("DELETE FROM scan_result WHERE run_date = %s", (run_date,))
    if scan_results is None or scan_results.height == 0:
        return
    metric_cols = [c for c in scan_results.columns if c not in ("preset_key", "symbol", "rank")]
    rows = []
    for r in scan_results.iter_rows(named=True):
        metrics = {c: _json_safe(r[c]) for c in metric_cols}
        rows.append((run_date, r["preset_key"], r["symbol"], int(r["rank"]), Json(metrics)))
    cur.executemany(
        """
        INSERT INTO scan_result (id, run_date, preset_key, symbol, rank, metrics)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def _insert_signal_logs(cur, signal_logs) -> None:
    rows = [
        (s["fired_date"], s["symbol"], s["pattern_key"], s["horizon_days"], s["resolves_on"])
        for s in signal_logs
    ]
    if not rows:
        return
    # Insert-only and idempotent: the unique key is (fired_date, pattern_key, symbol, horizon_days),
    # so a rerun of the night inserts nothing new. The table also has a trigger blocking UPDATE and
    # DELETE (schema migration), so history can never be rewritten.
    cur.executemany(
        """
        INSERT INTO signal_log (id, fired_date, symbol, pattern_key, horizon_days, resolves_on)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s)
        ON CONFLICT (fired_date, pattern_key, symbol, horizon_days) DO NOTHING
        """,
        rows,
    )


def _upsert_news_items(cur, news_items) -> None:
    # News accumulates (it is historical context), so it is upserted by its natural key
    # (provider, url): a rerun refreshes the classification/sentiment of an article it already has,
    # and never duplicates it. tickers is a text[] — psycopg adapts a Python list to a Postgres array.
    rows = [
        (n["published_at"], n["provider"], n["url"], n["headline"], n.get("snippet", ""),
         list(n.get("tickers", [])), n.get("event_type"), n.get("sentiment"))
        for n in news_items
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO news_item
            (id, published_at, provider, url, headline, snippet, tickers, event_type, sentiment)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (provider, url) DO UPDATE SET
            headline = EXCLUDED.headline, snippet = EXCLUDED.snippet, tickers = EXCLUDED.tickers,
            event_type = EXCLUDED.event_type, sentiment = EXCLUDED.sentiment
        """,
        rows,
    )


def _replace_calendar(cur, run_date, calendar_events) -> None:
    # The calendar is a forward view, so each run replaces it from the run date onward — the fresh
    # schedule wins, and a cancelled or rescheduled event does not linger. `None` means "the catalyst
    # ingest did not run tonight", so the existing calendar is left untouched (a degraded source must
    # not blank the calendar); an empty list means "it ran and found nothing", which does replace.
    if calendar_events is None:
        return
    cur.execute("DELETE FROM calendar_event WHERE date >= %s", (run_date,))
    rows = [
        (e["date"], e["kind"], e.get("symbol"), e.get("timing"), e["title"],
         e.get("consensus"), e.get("prior"), e.get("importance"))
        for e in calendar_events
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO calendar_event
            (id, date, kind, symbol, timing, title, consensus, prior, importance)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def _upsert_market_context(cur, run_date, market_context: Mapping[str, Any] | None) -> None:
    # The macro strip's one row per run — upsert by run date so a re-run updates in place. VIX and
    # the 10-year yield are nullable because FRED can be down; breadth always comes from the
    # ingested universe, so it is always present.
    if market_context is None:
        return
    cur.execute(
        """
        INSERT INTO market_context (run_date, vix, ten_year, advancers, decliners, pct_above_50dma)
        VALUES (%(run_date)s, %(vix)s, %(ten_year)s, %(advancers)s, %(decliners)s, %(pct)s)
        ON CONFLICT (run_date) DO UPDATE SET
            vix = EXCLUDED.vix, ten_year = EXCLUDED.ten_year, advancers = EXCLUDED.advancers,
            decliners = EXCLUDED.decliners, pct_above_50dma = EXCLUDED.pct_above_50dma
        """,
        {
            "run_date": run_date,
            "vix": market_context.get("vix"),
            "ten_year": market_context.get("ten_year"),
            "advancers": market_context["advancers"],
            "decliners": market_context["decliners"],
            "pct": market_context["pct_above_50dma"],
        },
    )
