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

AND, SINCE PD0: NO EDITION MAY CLAIM A SESSION THAT DID NOT HAPPEN (ruling E1). Every entry point
below that writes a dated edition row checks its run_date against the NYSE calendar first and raises
NonSessionRunDate before touching the database. See _require_session.
"""

from __future__ import annotations

import json
import math
from datetime import date, datetime
from typing import Any, Iterable, Mapping

import polars as pl
import psycopg
from psycopg.types.json import Json

import macro_stats
from macro_levels import StoredLevels, resolve_index_levels
from trading_calendar import is_trading_session


class NonSessionRunDate(ValueError):
    """A publish was asked to write an edition dated to a day the market never opened."""


def _require_session(run_date: date, writer: str) -> None:
    """
    Refuse a run_date that is not a NYSE trading session. THE LOCK, and the lowest of the three.

    An edition date, a "data through" label, a breadth close, a press-time: each of them is a CLAIM
    THAT THE MARKET TRADED THAT DAY. On 2026-07-11 — a Saturday — this product made all four, for
    two days, in production, because a manually dispatched run asked the wall clock what day it was
    and believed the answer. Four honest formatters then rendered a lie faithfully. Nothing failed.
    Every gate stayed green. That is the disease: not a wrong number, but a wrong PREMISE that every
    number downstream then reports correctly.

    Job A's mode gates and the full night's bar-derived edition both close the paths we KNOW about.
    This closes the ones we do not — and it is deliberately below them, because modes are policy and
    publish is law. A future mode, a backfill script, a refactor that reorders two lines: none of
    them can get a non-session date into this database without deleting this function first, which
    is a thing a reviewer can see.

    It raises BEFORE the connection is touched. A rejected write that reached the wire and rolled
    back is a different promise from one that never happened, and only the second one is worth
    making.

    Not applied to publish_macro_stats: those rows are keyed by the SOURCE's own observation date (a
    mortgage rate published on a Thursday, a rupee reference published on a Sunday), which is a fact
    about a publication and not a claim about a session. E1 governs dates that claim a session.
    """
    if is_trading_session(run_date):
        return

    weekday = run_date.strftime("%A")
    raise NonSessionRunDate(
        f"{writer}: refusing to write an edition dated {run_date.isoformat()} — that is a "
        f"{weekday}, and the NYSE calendar (XNYS) says the market did not open. There was no "
        f"close, so there is no session for this row to be about. (This is the 2026-07-11 bug: a "
        f"run asked the wall clock what day it was instead of asking the market which session had "
        f"closed. See POLISH-AND-DEPTH-PLAN Part 1.2, ruling E1.)"
    )


def _json_safe(value: Any) -> Any:
    """
    Make a value safe for Postgres jsonb — all the way down.

    Two things jsonb will not take. Postgres rejects the non-finite floats NaN and ±Infinity
    outright (an indicator that could not be computed — say RVOL for a name with too little volume
    history — surfaces as a float NaN out of Polars), and `json.dumps` cannot serialize a datetime
    at all.

    IT DID NOT RECURSE, AND THAT COST A WHOLE NIGHT'S RUN. It only ever inspected a scalar float, so
    anything one level down was invisible to it. N5 put each article's publication time — a datetime
    — inside a list of dicts on `news_cluster.articles`, and the entire publish transaction died with
    "Object of type datetime is not JSON serializable" AFTER the run had spent four and a half
    minutes making every model call. The facts, the ranking and the prose were all computed
    correctly, and not one row was written.

    **A function named `_json_safe` that is not safe for JSON is worse than no function**, because
    every caller believes the boundary is guarded. It walks the whole structure now, and a test
    asserts the output actually serializes rather than merely looking right.
    """
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (datetime, date)):
        # ISO 8601, which is what every reader of this column already expects a timestamp to be.
        return value.isoformat()
    if isinstance(value, Mapping):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
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
    batch_id: str | None = None,
) -> None:
    """
    Persist a run's serving data atomically. Commits on success; rolls back on any error.

    The caller passes a psycopg connection so a test can run this against a throwaway database.
    Everything happens inside one transaction — psycopg opens one implicitly and this commits it at
    the end, so nothing is visible to other connections until it all succeeds.

    `batch_id` is the Anthropic extraction-batch id Job A submitted; it is recorded on the
    pipeline_run row so Job B can collect the batch the next evening (plan P3 step 1).
    """
    _require_session(run_date, "publish")
    try:
        with conn.cursor() as cur:
            _upsert_pipeline_run(cur, run_date, stage_status, source_status, batch_id)
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


def publish_compute(
    conn: psycopg.Connection,
    *,
    run_date: date,
    scan_results: pl.DataFrame | None = None,
    signal_logs: Iterable[Mapping[str, Any]] = (),
) -> None:
    """
    Publish a `compute` recompute: the derived layer only (N6, plan 8.1d).

    WHY THIS IS NOT `publish()` WITH MOST ARGUMENTS OMITTED — which is what I tried first, and it is
    a data-destroying bug.

    `_upsert_pipeline_run` sets `source_status = EXCLUDED.source_status` on conflict: a WHOLESALE
    REPLACE. So a recompute calling publish() with a bare status dict would OVERWRITE the night's
    record of how each provider behaved. A night on which Marketaux was degraded would, the moment
    the reader pressed "Recompute scans", start reporting every source healthy — the degradation
    erased, with nothing anywhere saying so.

    That is ruling M2 ("a degraded source cannot be folded away") broken by the back door, and it is
    the exact species of quiet lie this pipeline is built to refuse. A run that called no provider
    KNOWS NOTHING ABOUT ANY PROVIDER'S HEALTH, and the honest thing for it to say about them is
    nothing at all. So this function never touches `source_status`, and it MERGES `stage_status`
    (`||`) rather than replacing it, so the night's own record of what it ran survives the
    recompute that came after it.

    (The same trap is already documented one function up, where `batch_id` is COALESCE'd for
    precisely this reason. The status columns were simply never given the same care.)
    """
    _require_session(run_date, "publish_compute")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pipeline_run (run_date, started_at, finished_at, stage_status, source_status)
                VALUES (%(run_date)s, now(), now(), %(stage)s, '{}'::jsonb)
                ON CONFLICT (run_date) DO UPDATE SET
                    finished_at = now(),
                    stage_status = pipeline_run.stage_status || EXCLUDED.stage_status
                """,
                {
                    "run_date": run_date,
                    # What this run actually did, and nothing more. `ingest` is conspicuously absent.
                    "stage": Json({"compute": "ok", "scan": "ok", "publish": "ok"}),
                },
            )
            _replace_scan_results(cur, run_date, scan_results)
            _insert_signal_logs(cur, signal_logs)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def publish_macro(
    conn: psycopg.Connection,
    *,
    run_date: date,
    macro: Mapping[str, Any],
) -> bool:
    """
    Update ONLY the FRED cells of an existing market_context row. Returns True if a row was updated.

    This is what the 6:00am macro run publishes, and the reason it is a separate function rather than
    a call to publish() with most arguments omitted: a macro-only run has no snapshot, so it has no
    breadth — and breadth is NOT NULL on that table, because a night that ingested the market always
    knows how many names advanced. The dawn run is not ingesting the market; it is going back to fix
    three numbers that FRED had not published yet when the night ran.

    So it updates in place and touches nothing else. If the row does not exist — a dawn run before
    any nightly has ever written that session — there is nothing to fix and it says so by returning
    False. It will NOT create a breadth-less row: a market_context with no breadth would be a macro
    module with a hole in it, and the honest thing is to have no row at all until the night runs.

    The index levels go through the same carry-forward as the nightly (macro_levels), so a dawn run
    whose FRED call fails cannot undo a level the night before had already stored.
    """
    _require_session(run_date, "publish_macro")
    with conn.cursor() as cur:
        levels = resolve_index_levels(
            macro,
            stored=_read_stored_levels(cur, run_date),
            run_date=run_date,
        )
        cur.execute(
            """
            UPDATE market_context SET
                vix = %(vix)s,
                ten_year = %(ten_year)s,
                sp500 = %(sp500)s, sp500_prior = %(sp500_prior)s,
                nasdaq_composite = %(nasdaq_composite)s,
                nasdaq_composite_prior = %(nasdaq_composite_prior)s,
                djia = %(djia)s, djia_prior = %(djia_prior)s,
                index_levels_as_of = %(index_levels_as_of)s
            WHERE run_date = %(run_date)s
            """,
            {
                "run_date": run_date,
                "vix": macro.get("vix"),
                "ten_year": macro.get("ten_year"),
                **levels,
            },
        )
        updated = cur.rowcount
    if updated:
        conn.commit()
    else:
        conn.rollback()
    return bool(updated)


def publish_macro_stats(conn: psycopg.Connection, *, rows: Iterable[Any]) -> list[Any]:
    """
    Write the macro board's new observations — and only the NEW ones. Returns what was written.

    This is where the cadence rule meets the database (macro_stats.is_new_observation). Every source
    is checked nightly, but a source that has published nothing new since last night writes nothing:
    re-writing an unchanged row would move its `fetched_at` to tonight, which is a claim that a
    weekly mortgage rate was refreshed tonight. It was not, and the whole board is built on never
    making that claim.

    THE PRIOR, WHEN THE SOURCE DOES NOT GIVE US ONE. FRED hands over the previous observation with
    the current one, and GoldAPI sends a previous close — for those cells the prior is the source's
    own. The rupee and the Mood gauge have no such thing, so their prior is filled from the row we
    already hold. That is honest as a record of "the observation before this one", and it is safe
    because NEITHER of those two cells renders a delta from it: a delta whose two ends might be days
    apart, wearing a "1D" label, is exactly the sort of quiet lie this plan exists to prevent.
    """
    written: list[Any] = []
    try:
        with conn.cursor() as cur:
            stored = _stored_macro_stats(cur)
            fresh = macro_stats.new_observations(list(rows), stored)

            for row in fresh:
                previous = stored.get(row.series_key)
                columns = row.as_columns()
                if columns["prior"] is None and previous is not None:
                    columns["prior"] = previous[1]

                cur.execute(
                    """
                    INSERT INTO macro_stat
                        (series_key, as_of_date, value, prior, as_of_label, source_key, fetched_at, meta)
                    VALUES
                        (%(series_key)s, %(as_of_date)s, %(value)s, %(prior)s, %(as_of_label)s,
                         %(source_key)s, %(fetched_at)s, %(meta)s)
                    ON CONFLICT (series_key, as_of_date) DO UPDATE SET
                        value = EXCLUDED.value,
                        prior = EXCLUDED.prior,
                        as_of_label = EXCLUDED.as_of_label,
                        source_key = EXCLUDED.source_key,
                        fetched_at = EXCLUDED.fetched_at,
                        meta = EXCLUDED.meta
                    """,
                    {**columns, "meta": Json(columns["meta"]) if columns["meta"] is not None else None},
                )
                written.append(row)
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return written


def _stored_macro_stats(cur) -> dict[str, tuple[date, float]]:
    """The newest stored (as-of date, value) for every series — what the cadence rule compares against."""
    cur.execute(
        """
        SELECT DISTINCT ON (series_key) series_key, as_of_date, value
        FROM macro_stat
        ORDER BY series_key, as_of_date DESC
        """
    )
    return {row[0]: (row[1], row[2]) for row in cur.fetchall()}


def publish_analytics(
    conn: psycopg.Connection,
    *,
    run_date: date,
    base_rates: Iterable[Mapping[str, Any]] = (),
    setup_cards: Iterable[Mapping[str, Any]] = (),
    vol_bands: Iterable[Mapping[str, Any]] = (),
) -> None:
    """Persist the P4 honesty engine atomically: base rates (upserted by their unique key), setup
    cards and vol bands (replaced per run date). Each card is linked to the base_rate_stat it was
    scored against, so the exact N and interval it shows are auditable.

    Commits on success, rolls back on any error — a mid-publish reader sees the prior run's cards,
    never a half-written set.
    """
    _require_session(run_date, "publish_analytics")
    try:
        with conn.cursor() as cur:
            _upsert_base_rates(cur, base_rates)
            rate_ids = _base_rate_id_map(cur)
            _replace_setup_cards(cur, run_date, setup_cards, rate_ids)
            _replace_vol_bands(cur, run_date, vol_bands)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _upsert_base_rates(cur, base_rates) -> None:
    rows = list(base_rates)
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO base_rate_stat
            (id, pattern_key, universe, horizon_days, regime, n, wins, win_rate, ci_low, ci_high,
             fwd_p10, fwd_median, fwd_p90, baseline_up_rate, publication_year, evidence_grade,
             decay_note, computed_at)
        VALUES (gen_random_uuid()::text, %(patternKey)s, %(universe)s, %(horizonDays)s, %(regime)s,
                %(n)s, %(wins)s, %(winRate)s, %(ciLow)s, %(ciHigh)s, %(fwdP10)s, %(fwdMedian)s,
                %(fwdP90)s, %(baselineUpRate)s, %(publicationYear)s, %(evidenceGrade)s, %(decayNote)s, now())
        ON CONFLICT (pattern_key, universe, horizon_days, regime) DO UPDATE SET
            n = EXCLUDED.n, wins = EXCLUDED.wins, win_rate = EXCLUDED.win_rate,
            ci_low = EXCLUDED.ci_low, ci_high = EXCLUDED.ci_high, fwd_p10 = EXCLUDED.fwd_p10,
            fwd_median = EXCLUDED.fwd_median, fwd_p90 = EXCLUDED.fwd_p90,
            baseline_up_rate = EXCLUDED.baseline_up_rate, publication_year = EXCLUDED.publication_year,
            evidence_grade = EXCLUDED.evidence_grade, decay_note = EXCLUDED.decay_note,
            computed_at = now()
        """,
        [_base_rate_params(r) for r in rows],
    )


def _base_rate_params(r: Mapping[str, Any]) -> dict:
    """Fill in the optional base-rate fields so every parameter key is present for executemany."""
    return {
        "patternKey": r["patternKey"], "universe": r["universe"], "horizonDays": r["horizonDays"],
        "regime": r["regime"], "n": r["n"], "wins": r["wins"], "winRate": r["winRate"],
        "ciLow": r["ciLow"], "ciHigh": r["ciHigh"], "fwdP10": r.get("fwdP10"),
        "fwdMedian": r.get("fwdMedian"), "fwdP90": r.get("fwdP90"),
        "baselineUpRate": r.get("baselineUpRate"), "publicationYear": r.get("publicationYear"),
        "evidenceGrade": r["evidenceGrade"], "decayNote": r.get("decayNote"),
    }


def _base_rate_id_map(cur) -> dict[tuple, str]:
    """Map each base_rate_stat's (pattern, universe, horizon, regime) key to its id, so a card can be
    linked to the exact rate it was scored against."""
    cur.execute("SELECT id, pattern_key, universe, horizon_days, regime FROM base_rate_stat")
    return {(row[1], row[2], row[3], row[4]): row[0] for row in cur.fetchall()}


def _replace_setup_cards(cur, run_date, setup_cards, rate_ids) -> None:
    cur.execute("DELETE FROM setup_card WHERE run_date = %s", (run_date,))
    rows = list(setup_cards)
    if not rows:
        return
    params = []
    for card in rows:
        key = tuple(card["baseRateKey"]) if card.get("baseRateKey") else None
        params.append((
            card["runDate"], card["symbol"], card["patternKey"], card["tier"],
            Json(_json_safe_map(card["state"])), Json(dict(card.get("weakeners", {}))),
            rate_ids.get(key) if key else None,
        ))
    cur.executemany(
        """
        INSERT INTO setup_card (id, run_date, symbol, pattern_key, tier, state, weakeners, base_rate_id)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s)
        """,
        params,
    )


def _replace_vol_bands(cur, run_date, vol_bands) -> None:
    # `n` and `window_days` ride with every band: the Range Ladder prints them on each row, because
    # a range without its sample size is an assertion rather than evidence (redesign §3.8).
    cur.execute("DELETE FROM vol_band WHERE run_date = %s", (run_date,))
    rows = [
        (b["runDate"], b["symbol"], b["horizonDays"], b["lo"], b["hi"], b["coverage"], b["label"],
         b.get("n"), b.get("windowDays"))
        for b in vol_bands
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO vol_band
            (id, run_date, symbol, horizon_days, lo, hi, coverage, label, n, window_days)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def _json_safe_map(state: Mapping[str, Any]) -> dict:
    """Scrub non-finite floats out of a card's state map before it becomes jsonb."""
    return {k: _json_safe(v) for k, v in state.items()}


def publish_briefing(
    conn: psycopg.Connection,
    *,
    run_date: date,
    am_json: Mapping[str, Any],
    verification_json: Mapping[str, Any],
    model_meta: Mapping[str, Any],
    status: str,
    pm_json: Mapping[str, Any] | None = None,
) -> None:
    """
    Persist the evening briefing atomically (plan P3 step 2 — the single-transaction publish).

    Keyed by run date, so a rerun of a night replaces that day's briefing rather than duplicating
    it. `am_json` is the briefing draft in the Appendix G shape; `verification_json` records every
    gate decision (so a held night is auditable); `status` is "published" or "held". A mid-publish
    reader sees the prior briefing until this commits, never a half-written one.

    `pm_json` is written only when a PM edition is supplied; otherwise a re-publish preserves the
    edition already stored (COALESCE), so writing the AM edition never blanks a later PM one.
    """
    _require_session(run_date, "publish_briefing")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO briefing
                    (run_date, am_json, pm_json, verification_json, model_meta, status)
                VALUES (%(run_date)s, %(am)s, %(pm)s, %(verify)s, %(meta)s, %(status)s)
                ON CONFLICT (run_date) DO UPDATE SET
                    am_json = EXCLUDED.am_json,
                    pm_json = COALESCE(EXCLUDED.pm_json, briefing.pm_json),
                    verification_json = EXCLUDED.verification_json,
                    model_meta = EXCLUDED.model_meta,
                    status = EXCLUDED.status
                """,
                {
                    "run_date": run_date,
                    # These maps come from validated pydantic models and the gate result — plain
                    # strings, ints, bools, and None, no non-finite floats — so they need no scrub.
                    "am": Json(dict(am_json)),
                    "pm": Json(dict(pm_json)) if pm_json is not None else None,
                    "verify": Json(dict(verification_json)),
                    "meta": Json(dict(model_meta)),
                    "status": status,
                },
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _upsert_pipeline_run(cur, run_date, stage_status, source_status, batch_id=None) -> None:
    # batch_id is COALESCE'd on conflict so a rerun that does not resubmit a batch keeps the id
    # already recorded — Job B must still be able to find the batch it was told about.
    cur.execute(
        """
        INSERT INTO pipeline_run (run_date, started_at, finished_at, stage_status, source_status, batch_id)
        VALUES (%(run_date)s, now(), now(), %(stage)s, %(source)s, %(batch_id)s)
        ON CONFLICT (run_date) DO UPDATE SET
            finished_at = now(), stage_status = EXCLUDED.stage_status,
            source_status = EXCLUDED.source_status,
            batch_id = COALESCE(EXCLUDED.batch_id, pipeline_run.batch_id)
        """,
        {
            "run_date": run_date,
            "stage": Json(dict(stage_status)),
            "source": Json(dict(source_status)),
            "batch_id": batch_id,
        },
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
    # The id is the deterministic (provider, url) id the pipeline stamps (nightly._news_id), so it is
    # stable across runs and matches the extraction batch's custom_id. On conflict the id converges
    # to EXCLUDED.id, so the briefing citation ↔ article ↔ URL chain always lines up.
    rows = [
        (n["id"], n["published_at"], n["provider"], n["url"], n["headline"], n.get("snippet", ""),
         list(n.get("tickers", [])), n.get("event_type"), n.get("sentiment"))
        for n in news_items
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO news_item
            (id, published_at, provider, url, headline, snippet, tickers, event_type, sentiment)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (provider, url) DO UPDATE SET
            id = EXCLUDED.id, headline = EXCLUDED.headline, snippet = EXCLUDED.snippet,
            tickers = EXCLUDED.tickers, event_type = EXCLUDED.event_type, sentiment = EXCLUDED.sentiment
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
    # `code` is the chip the Desk renders (CPI, JOBS, FOMC, EARNINGS …) — the calendar's one
    # vocabulary, set by the allowlist rather than by the raw provider name (redesign §6.2).
    rows = [
        (e["date"], e["kind"], e.get("symbol"), e.get("timing"), e["title"],
         e.get("consensus"), e.get("prior"), e.get("importance"), e.get("code"))
        for e in calendar_events
    ]
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO calendar_event
            (id, date, kind, symbol, timing, title, consensus, prior, importance, code)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def _read_stored_levels(cur, run_date) -> StoredLevels | None:
    """The most recent index levels the database already holds, and the session they are for.

    Looked up on or before tonight — including tonight's own row, so a re-run whose FRED call fails
    keeps the levels an earlier run of the same night succeeded in fetching.
    """
    cur.execute(
        """
        SELECT sp500, sp500_prior, nasdaq_composite, nasdaq_composite_prior,
               djia, djia_prior, index_levels_as_of
        FROM market_context
        WHERE run_date <= %(run_date)s
          AND (sp500 IS NOT NULL OR nasdaq_composite IS NOT NULL OR djia IS NOT NULL)
        ORDER BY run_date DESC
        LIMIT 1
        """,
        {"run_date": run_date},
    )
    row = cur.fetchone()
    if row is None:
        return None
    return StoredLevels(
        sp500=row[0],
        sp500_prior=row[1],
        nasdaq_composite=row[2],
        nasdaq_composite_prior=row[3],
        djia=row[4],
        djia_prior=row[5],
        as_of=row[6],
    )


def _upsert_market_context(cur, run_date, market_context: Mapping[str, Any] | None) -> None:
    # The macro strip's one row per run — upsert by run date so a re-run updates in place. Every FRED
    # column is nullable because every FRED series can fail on its own: the VIX, the 10-year yield,
    # and each index level with the level before it (redesign §6.1). Breadth always comes from the
    # ingested universe, so it is always present.
    #
    # The priors are persisted alongside the levels because the app computes the day's change by
    # subtracting them. It has no access to the pipeline's observations — if the prior is not in the
    # row, the change is not knowable, and the Desk prints "—" instead of inventing one.
    #
    # THE INDEX LEVELS ARE NOT WRITTEN BLINDLY. This used to say `sp500 = EXCLUDED.sp500`, which
    # wrote whatever the night fetched — including None. So one flaky FRED call did not merely fail
    # to update the level; it OVERWROTE the good one already stored, and the Desk silently collapsed
    # to an ETF price. A successful run destroyed data.
    #
    # macro_levels.resolve_index_levels() decides instead: tonight's read wins if it produced
    # anything, an empty read keeps what is stored (up to five sessions), and the row records the
    # session those levels are actually for so the app can age them honestly (ruling C7).
    if market_context is None:
        return

    levels = resolve_index_levels(
        market_context,
        stored=_read_stored_levels(cur, run_date),
        run_date=run_date,
    )

    cur.execute(
        """
        INSERT INTO market_context (
            run_date, vix, ten_year,
            sp500, sp500_prior, nasdaq_composite, nasdaq_composite_prior, djia, djia_prior,
            index_levels_as_of,
            advancers, decliners, pct_above_50dma
        )
        VALUES (
            %(run_date)s, %(vix)s, %(ten_year)s,
            %(sp500)s, %(sp500_prior)s, %(nasdaq_composite)s, %(nasdaq_composite_prior)s,
            %(djia)s, %(djia_prior)s,
            %(index_levels_as_of)s,
            %(advancers)s, %(decliners)s, %(pct)s
        )
        ON CONFLICT (run_date) DO UPDATE SET
            vix = EXCLUDED.vix, ten_year = EXCLUDED.ten_year,
            sp500 = EXCLUDED.sp500, sp500_prior = EXCLUDED.sp500_prior,
            nasdaq_composite = EXCLUDED.nasdaq_composite,
            nasdaq_composite_prior = EXCLUDED.nasdaq_composite_prior,
            djia = EXCLUDED.djia, djia_prior = EXCLUDED.djia_prior,
            index_levels_as_of = EXCLUDED.index_levels_as_of,
            advancers = EXCLUDED.advancers,
            decliners = EXCLUDED.decliners, pct_above_50dma = EXCLUDED.pct_above_50dma
        """,
        {
            "run_date": run_date,
            "vix": market_context.get("vix"),
            "ten_year": market_context.get("ten_year"),
            **levels,
            "advancers": market_context["advancers"],
            "decliners": market_context["decliners"],
            "pct": market_context["pct_above_50dma"],
        },
    )


def publish_news(
    conn: psycopg.Connection,
    *,
    run_date: date,
    clusters: Iterable[Any],
    images: Iterable[Any] = (),
) -> int:
    """
    Write tonight's front page — images, clusters, and the ticker links — in ONE transaction.

    ATOMIC BY NECESSITY, NOT BY TIDINESS. A cluster row whose image row did not land renders a card
    with a hole in it; a cluster whose catalyst_link rows did not land renders a story that affects
    nobody. Half a front page is not a degraded front page, it is a wrong one, so the night either
    publishes a coherent page or publishes nothing and says so.

    The catalyst links carry SNAPSHOTTED numbers (ret1, rvol20) rather than joins, and that is
    deliberate: if the story page recomputed a move from live tables, the feed's number and the
    story's number could drift apart within a single night — the same fact, two values, which is the
    species of lie this whole app is built against.

    Insert-only in spirit: a cluster that already exists is UPDATED in place (it keeps its id as more
    articles join it over the following evenings), and nothing is ever deleted.
    """
    _require_session(run_date, "publish_news")
    written = 0
    with conn.transaction():
        with conn.cursor() as cur:
            for image in images:
                cur.execute(
                    """
                    INSERT INTO news_image (
                        id, source_kind, url_full, url_card, url_thumb, width, height,
                        blur_data_url, dominant_color, attribution_source, attribution_url, fetched_at
                    ) VALUES (
                        %(id)s, %(source_kind)s, %(url_full)s, %(url_card)s, %(url_thumb)s,
                        %(width)s, %(height)s, %(blur_data_url)s, %(dominant_color)s,
                        %(attribution_source)s, %(attribution_url)s, %(fetched_at)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        url_full = EXCLUDED.url_full,
                        url_card = EXCLUDED.url_card,
                        url_thumb = EXCLUDED.url_thumb,
                        fetched_at = EXCLUDED.fetched_at
                    """,
                    image,
                )

            for cluster in clusters:
                cur.execute(
                    """
                    INSERT INTO news_cluster (
                        id, run_date, first_seen, headline, event_type, sectors, themes, tickers,
                        significance, sources, why_it_matters, affected_note, extract, verification,
                        articles, image_id
                    ) VALUES (
                        %(id)s, %(run_date)s, %(first_seen)s, %(headline)s, %(event_type)s,
                        %(sectors)s, %(themes)s, %(tickers)s, %(significance)s, %(sources)s,
                        %(why_it_matters)s, %(affected_note)s, %(extract)s, %(verification)s,
                        %(articles)s, %(image_id)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        run_date = EXCLUDED.run_date,
                        headline = EXCLUDED.headline,
                        event_type = EXCLUDED.event_type,
                        sectors = EXCLUDED.sectors,
                        themes = EXCLUDED.themes,
                        tickers = EXCLUDED.tickers,
                        significance = EXCLUDED.significance,
                        sources = EXCLUDED.sources,
                        why_it_matters = EXCLUDED.why_it_matters,
                        affected_note = EXCLUDED.affected_note,
                        extract = EXCLUDED.extract,
                        verification = EXCLUDED.verification,
                        articles = EXCLUDED.articles,
                        image_id = EXCLUDED.image_id
                    """,
                    {**cluster,
                     "extract": Json(_json_safe(cluster.get("extract") or {})),
                     "verification": Json(_json_safe(cluster.get("verification") or {})),
                     "articles": Json(_json_safe(cluster.get("articles") or []))},
                )
                written += 1

                for link in cluster.get("links") or []:
                    cur.execute(
                        """
                        INSERT INTO catalyst_link (id, cluster_id, symbol, ret1, rvol20, has_setup_card)
                        VALUES (gen_random_uuid()::text, %(cluster_id)s, %(symbol)s, %(ret1)s,
                                %(rvol20)s, %(has_setup_card)s)
                        ON CONFLICT (cluster_id, symbol) DO UPDATE SET
                            ret1 = EXCLUDED.ret1,
                            rvol20 = EXCLUDED.rvol20,
                            has_setup_card = EXCLUDED.has_setup_card
                        """,
                        link,
                    )

    return written
