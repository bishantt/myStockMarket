"""
nightly.py — Job A's orchestration: the full nightly data flow (plan §2.1, Appendix C, P1 step 5).

One trading night, in order:
  1. list the tradable universe,
  2. ingest end-of-day bars for it,
  3. FAIL LOUDLY if coverage is below the floor (a thin night must not quietly publish a hole),
  4. persist the full-universe bars as Parquet and push them to R2 (the history lake),
  5. run the five scans over the run-date snapshot,
  6. read the macro context (VIX, 10-year) and compute the day's breadth,
  7. publish the SERVED subset to Postgres — the indices, sector ETFs, and the user's watchlist —
     plus the scan matches and the macro-context row, in one transaction.

The design is dependency-injected: every external collaborator (the universe, the bar fetch, the
macro read, the Parquet store, R2, the publish, the served-symbol list) is a field on NightlyDeps,
so the flow is tested end to end with fakes and no live key is ever needed. Job A's main() builds
the real collaborators from settings and calls run_nightly.

Signal log: every scan match writes one INSERT-ONLY signal_log row, with resolves_on set to exactly
ten TRADING days out via the NYSE calendar (trading_calendar.py). The rate fields stay null until
P4 gives the patterns base rates. Publish inserts these ON CONFLICT DO NOTHING, so a rerun of a
night adds nothing — the log records that a pattern fired and when it resolves, permanently.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Callable, Mapping

import polars as pl

import analytics
import detectors as det
import macro_stats
import mood
from catalysts import classify
from parquet_store import PRICES, ParquetStore
from scans import (
    HORIZON_DAYS,
    UNUSUAL_VOLUME,
    build_indicated,
    build_snapshot,
    run_all,
    snapshot_from_indicated,
)
from storage import R2Store
from trading_calendar import is_trading_session
from trading_calendar import sessions_ahead

# The regime line and the primary card horizon (Appendix F). Breadth is a fraction (0-1).
_REGIME_LINE = 0.5
_CARD_HORIZON = 10

# A night must cover at least this share of the universe with bars, or it fails (plan §2.1). A
# missing tenth of the market is a broken ingest, not a publishable morning.
MIN_UNIVERSE_COVERAGE = 0.95

# How many recent bars per served symbol are mirrored into Postgres. The full history stays in the
# Parquet lake; the Desk only needs about a trading year to draw its charts and indicators.
SERVED_HISTORY_BARS = 260

# The scan metrics worth persisting per match (the rest of the snapshot stays in the lake). ret_1
# and rvol20 are what the Desk's Movers module reads; the others are for the setup cards to come.
_SCAN_METRIC_COLS = ("ret_1", "rvol20", "gap_pct", "close", "rsi14", "dist_52w_high", "lottery_flag")

_BAR_COLS = ["symbol", "date", "open", "high", "low", "close", "volume"]


@dataclass(frozen=True)
class CatalystBundle:
    """What the catalyst ingest returns: the night's news + calendar to persist, and per-source
    health. `calendar_events` is None when the calendar sources were down (publish leaves the
    existing calendar untouched); an empty list means they ran and found nothing."""

    news_items: list[dict]
    calendar_events: list[dict] | None
    source_status: dict[str, str]


@dataclass(frozen=True)
class MacroRead:
    """
    What one night's FRED read yields: the two context cells, and the three index levels with the
    level that came before each (redesign §6.1).

    Every field is nullable because every series can fail on its own. The priors are stored, not
    just the levels, because the app can only diff what is persisted — buildMacro never sees the
    pipeline's observations, so a change it cannot compute from the database is a change it must
    render as "—" rather than borrow from an ETF.
    """

    vix: float | None
    ten_year: float | None
    sp500: float | None = None
    sp500_prior: float | None = None
    nasdaq_composite: float | None = None
    nasdaq_composite_prior: float | None = None
    djia: float | None = None
    djia_prior: float | None = None

    def as_columns(self) -> dict[str, float | None]:
        """The macro half of the market_context row, keyed as the table's columns."""
        return {
            "vix": self.vix,
            "ten_year": self.ten_year,
            "sp500": self.sp500,
            "sp500_prior": self.sp500_prior,
            "nasdaq_composite": self.nasdaq_composite,
            "nasdaq_composite_prior": self.nasdaq_composite_prior,
            "djia": self.djia,
            "djia_prior": self.djia_prior,
        }

    def index_levels(self) -> dict[str, float | None]:
        """Just the three index LEVELS — the fields the `fred-indexes` source key describes."""
        return {
            "sp500": self.sp500,
            "nasdaq_composite": self.nasdaq_composite,
            "djia": self.djia,
        }

    def has_every_index_level(self) -> bool:
        """True when all three index series answered with a usable level."""
        return all(level is not None for level in self.index_levels().values())

    def has_any_index_level(self) -> bool:
        """True when at least one index series answered — the test for carrying a set forward."""
        return any(level is not None for level in self.index_levels().values())


@dataclass(frozen=True)
class MacroStatsRead:
    """
    What one night's macro-board fetch yields: the rows worth storing, and each source's health.

    The rows here are the FOUR EXTERNAL stats only (mortgage, CPI, gold, the rupee). The Mood gauge
    is not among them and cannot be: it is computed from the night's own universe snapshot, and a
    run that did not ingest the market has no business restating how the market feels.
    """

    rows: list[Any]  # list[macro_stats.MacroStatRow]
    source_status: dict[str, str]


@dataclass(frozen=True)
class MoodHistory:
    """
    The three FRED distributions the Mood gauge scores its market-independent components against.

    Each list is OLDEST FIRST — the natural order for series maths — and the newest element is
    tonight's reading. Empty when the source was unreachable, which costs the gauge that one
    component rather than the whole gauge (and if enough of them are empty, the gauge suppresses
    itself and says which are missing).
    """

    vix: list[float]
    sp500: list[float]
    credit: list[float]


@dataclass(frozen=True)
class FrontPageRead:
    """What the newsdesk produced tonight, and how each provider behaved while it did (N4).

    The counts travel with the rows because a cut that does not state its own size is a cut nobody
    can audit (C6): `articles_in` and `boilerplate_dropped` say what arrived and what was refused,
    and `stage_a_capped` says how many stories were ingested and ranked but never read by the
    extraction batch — a visible absence rather than a silent one.
    """

    clusters: list[dict]
    images: list[dict]
    source_status: dict[str, str]
    articles_in: int = 0
    boilerplate_dropped: int = 0
    stage_a_capped: int = 0
    # What the two LLM stages did, in one plain-English line for the night's log. It rides here
    # because a page with no notes is invisible on screen — a null why_it_matters prints nothing,
    # and it prints the same nothing whether the narrator had nothing to add or was never asked.
    narration: str = ""


@dataclass(frozen=True)
class NightlyDeps:
    """Everything run_nightly needs from the outside world — injected so the flow is fully fakeable."""

    fetch_universe: Callable[[], list[Mapping[str, Any]]]
    fetch_bars: Callable[[list[str]], dict[str, list[Any]]]
    read_macro: Callable[[], MacroRead]
    read_served_symbols: Callable[[], list[str]]
    store: Any  # ParquetStore (or a recording fake)
    r2: Any  # R2Store | None
    publish: Callable[..., None]
    conn: Any  # a psycopg connection, passed straight to publish
    # The session this run EXPECTS to publish — the last one whose bell has rung, per the market's
    # own calendar (job_a.full_run_edition). It is NOT the wall-clock date, and it is not the final
    # word either: the ingested bars are, and run_nightly refuses to publish if the two disagree.
    # It is needed up front because the fetch windows are anchored on it (bars, catalysts, the board).
    run_date: date
    # The catalyst ingest (news + calendar) for the movers. Optional: None skips the catalyst stage
    # (the job owns the per-provider try/catch and reports each source's status in the bundle).
    fetch_catalysts: Callable[[list[str]], CatalystBundle] | None = None
    # Submit the LLM extraction batch for the night's news and return its batch id (plan P3 step 1).
    # Optional: None skips extraction (no key configured, or a night with no news). Given the
    # classified news items; the id it persists lets Job B collect the batch the next evening.
    submit_extraction: Callable[[list[dict]], str] | None = None
    # Publish the P4 honesty engine (base rates, setup cards, vol bands). Optional: None skips the
    # analytics stage (used by the fast fake-driven tests). Signature mirrors publish_analytics.
    publish_analytics: Callable[..., None] | None = None
    # The macro board (N3). Each is optional so the fake-driven tests can skip the whole board.
    #
    # `read_macro_stats` fetches the four external stats, catching each source on its own so one
    # dead provider degrades one cell. `read_mood_history` reads the three FRED distributions the
    # gauge needs. `publish_macro_stats` writes whatever is genuinely new (the cadence rule).
    read_macro_stats: Callable[[], MacroStatsRead] | None = None
    read_mood_history: Callable[[], MoodHistory] | None = None
    publish_macro_stats: Callable[..., None] | None = None
    # The Front Page (N4). `build_front_page` fetches the market-wide news, resolves its tickers,
    # clusters it, ranks it and fetches its images; `publish_news` writes the result in one
    # transaction. Both optional, so the fake-driven tests can skip the newsdesk entirely.
    build_front_page: Callable[[], FrontPageRead] | None = None
    publish_news: Callable[..., int] | None = None


@dataclass(frozen=True)
class NightlyResult:
    """A small summary of what the night did, for the job's log line."""

    run_date: date
    universe_size: int
    coverage: float
    scan_matches: int
    served_symbols: int
    breadth: dict


class EditionDateMismatch(RuntimeError):
    """The bars do not describe the session this run was supposed to be publishing.

    Raised before anything is written. See edition_from_bars for why this is fatal rather than
    something to shrug at and stamp anyway — shrugging and stamping anyway is the entire bug.
    """


def edition_from_bars(bars: pl.DataFrame, expected: date) -> date:
    """
    The session this night's data actually describes — the newest bar in the ingest.

    THE DATE OF AN EDITION IS A FACT ABOUT THE DATA, NOT ABOUT THE CLOCK (ruling E1). `compute` mode
    has followed this law since N6 ("THE RUN DATE COMES FROM THE DATA, NOT THE CLOCK"); PD0 is where
    the full night adopts it, which is where it was needed all along: on 2026-07-11 the clock said
    Saturday, the bars said Friday, and the clock won.

    `expected` is the calendar's answer to the same question (the last session whose bell has rung).
    In a healthy night the two agree exactly, and this function is a formality. When they DISAGREE,
    something is wrong that nobody wants papered over:

      - the provider is stale (Monday evening, Alpaca has not posted Monday's bars yet), and
        publishing would silently republish Friday's edition under a fresh run;
      - or the ingest is broken in some way nobody has thought of yet.

    Either way the night fails, loudly, before a row is written — the same judgment the coverage
    floor already makes twenty lines above. A night that cannot say which session it is describing
    has nothing publishable to say at all.
    """
    if bars.height == 0:
        raise EditionDateMismatch(
            "nightly: no bars were ingested, so this run cannot say which session it describes. "
            "Refusing to publish an edition with no date behind it."
        )

    edition = bars["date"].max()

    if edition != expected:
        raise EditionDateMismatch(
            f"nightly: the ingested bars end on {edition.isoformat()}, but the market calendar says "
            f"the session that has closed is {expected.isoformat()}. The data and the calendar "
            f"disagree about which day this is, so the night is refusing to publish rather than "
            f"stamp one of them over the other. (This is how 2026-07-11 happened: the clock said "
            f"Saturday, the bars said Friday, and nothing checked.) Most likely cause: the price "
            f"provider has not posted the latest session yet — re-run once it has."
        )

    if not is_trading_session(edition):
        # Unreachable through the calendar (`expected` is a session by construction), so this is the
        # backstop for a bar frame carrying a date the market never had. publish() would refuse it
        # anyway; failing here means failing BEFORE the ingest is persisted to the lake.
        raise EditionDateMismatch(
            f"nightly: the bars end on {edition.isoformat()}, which is not a trading session. "
            f"Refusing to publish an edition for a day the market never opened."
        )

    return edition


def run_nightly(deps: NightlyDeps) -> NightlyResult:
    """Run one full nightly flow. Raises RuntimeError if the universe is empty or under-covered."""
    universe = deps.fetch_universe()
    symbols = [u["symbol"] for u in universe]
    if not symbols:
        raise RuntimeError("nightly: the universe came back empty — refusing to publish a blank night.")

    bars = _bars_frame(deps.fetch_bars(symbols))
    covered = bars["symbol"].n_unique() if bars.height else 0
    coverage = covered / len(symbols)
    if coverage < MIN_UNIVERSE_COVERAGE:
        raise RuntimeError(
            f"nightly: universe coverage {coverage:.1%} is below the {MIN_UNIVERSE_COVERAGE:.0%} "
            f"floor ({covered}/{len(symbols)} symbols had bars). Failing the night — a hole this "
            f"big is a broken ingest, not a publishable morning."
        )

    # WHICH SESSION IS THIS? Asked of the data, checked against the market's calendar, and answered
    # BEFORE anything is persisted. Everything below stamps `edition`; nothing below reads the clock.
    edition = edition_from_bars(bars, deps.run_date)

    # Persist the full-universe history first, then push it to R2 (the re-pullable lake).
    deps.store.write_partitioned(PRICES, bars)
    if deps.r2 is not None:
        deps.r2.sync_up(deps.store.root)

    # The indicator pass is the most expensive thing the night does, and from N3 it is needed twice:
    # once by the scans, and once by the Mood gauge (whose breadth and range-position components are
    # measured across the whole universe's history). It is computed ONCE and shared.
    indicated = build_indicated(bars)
    snapshot = snapshot_from_indicated(indicated)
    scans = run_all(snapshot)

    macro = deps.read_macro()
    breadth = compute_breadth(snapshot)
    market_context = {**macro.as_columns(), **breadth}

    served = set(deps.read_served_symbols())
    served_bars = served_price_bars(bars, served)
    scan_results = curated_scans(scans)
    signal_logs = build_signal_logs(scans, edition)

    # FRED is "ok" if any of its cells came back — the levels and the context cells fail separately,
    # and a partial read still fills part of the strip. Only a total FRED outage is "degraded".
    fred_ok = any(value is not None for value in macro.as_columns().values())
    source_status = {"alpaca": "ok", "fred": "ok" if fred_ok else "degraded"}

    # THE INDEX LEVELS GET THEIR OWN SOURCE KEY, and this is not a nicety — it is the bug that
    # started this phase (NEWS-AND-CONTROL-PLAN §1.1, §3.1).
    #
    # On 2026-07-11 in production, all three index levels came back empty while VIX and the 10-year
    # answered normally. `fred_ok` above was therefore True, the run recorded `fred: ok`, and the
    # Desk quietly fell back to showing four ETF prices under a footer that still claimed FRED index
    # levels. Nothing anywhere said the levels were missing.
    #
    # The honest reading is that `fred: ok` was CORRECT — FRED really did answer. One key simply
    # cannot describe two different failures. So the levels get their own key, and a partial read is
    # degraded too: a Desk showing two true index levels and one ETF proxy has a reader who deserves
    # to know why the third one changed shape.
    #
    # This used to be guarded by `if is_trading_session(deps.run_date)`, because before PD0 a night
    # COULD be dated to a day the market never opened — and flagging missing index levels for a
    # Saturday would have lit an amber lamp that meant nothing. That guard is gone, not because the
    # reasoning was wrong but because the condition can no longer be false: the edition is derived
    # from the bars and cross-checked against the calendar (edition_from_bars), and publish() refuses
    # a non-session date outright. A night that reaches this line is a night the market had.
    source_status["fred-indexes"] = "ok" if macro.has_every_index_level() else "degraded"

    # The catalyst stage: fetch news for the movers + the calendar, classify, and merge each
    # provider's health into the source status. A provider being down degrades its section here, in
    # the source status — the run still succeeds (plan §2, §P2 acceptance).
    news_items: list[dict] = []
    calendar_events: list[dict] | None = None
    if deps.fetch_catalysts is not None:
        movers = mover_symbols(scans)
        bundle = deps.fetch_catalysts(movers)
        news_items = _classify_news(bundle.news_items)
        calendar_events = bundle.calendar_events
        source_status = {**source_status, **bundle.source_status}

    # Submit the LLM extraction batch for tonight's news; Job B collects it tomorrow evening. The
    # batch id is recorded on the pipeline_run row in the same publish. A submission failure degrades
    # the briefing source (the night still publishes its data) rather than failing the run.
    batch_id: str | None = None
    if deps.submit_extraction is not None and news_items:
        try:
            batch_id = deps.submit_extraction(news_items)
        except Exception as error:  # noqa: BLE001 — a failed submit degrades the briefing, not the night
            source_status = {**source_status, "briefing": "degraded"}
            print(f"nightly: extraction batch submit failed ({error}); briefing degrades.")

    # The macro board (N3, Part 6). Fetched BEFORE the publish because each stat's health becomes a
    # source-status key on the run row — and written AFTER it, into its own table, so a slow gold
    # provider can never delay or endanger the transaction that carries the morning itself.
    macro_stat_rows: list[Any] = []
    if deps.read_macro_stats is not None:
        board = deps.read_macro_stats()
        macro_stat_rows.extend(board.rows)
        source_status = {**source_status, **board.source_status}

    gauge_row = _build_mood_row(deps, edition, indicated, breadth)
    if gauge_row is not None:
        macro_stat_rows.append(gauge_row)

    # The Front Page (N4). Fetched BEFORE the publish for the same reason the macro board is — each
    # provider's health becomes a source-status key on the run row — and written AFTER it, in its own
    # transaction, so a slow publisher's image fetch can never delay or endanger the transaction that
    # carries the morning itself. A dead news provider costs the front page and nothing else.
    front_page: FrontPageRead | None = None
    if deps.build_front_page is not None:
        try:
            front_page = deps.build_front_page()
            source_status = {**source_status, **front_page.source_status}
        except Exception as error:  # noqa: BLE001 — a dead newsdesk degrades the front page, not the night
            source_status = {**source_status, "news": "degraded"}
            print(f"nightly: the newsdesk failed ({error}); the front page degrades.")

    deps.publish(
        deps.conn,
        run_date=edition,
        stage_status={"ingest": "ok", "compute": "ok", "scan": "ok", "publish": "ok"},
        source_status=source_status,
        instruments=universe,
        price_bars=served_bars if served_bars.height else None,
        scan_results=scan_results if scan_results.height else None,
        signal_logs=signal_logs,
        market_context=market_context,
        news_items=news_items,
        calendar_events=calendar_events,
        batch_id=batch_id,
    )

    # The front page lands in its own transaction, after the morning is safely stored.
    if front_page is not None and deps.publish_news is not None:
        written = deps.publish_news(
            deps.conn,
            run_date=edition,
            clusters=front_page.clusters,
            images=front_page.images,
        )
        print(
            f"nightly: front page — {front_page.articles_in} articles in, "
            f"{front_page.boilerplate_dropped} regulatory filings dropped, {written} stories "
            f"published, {front_page.stage_a_capped} past the extraction cap."
        )

    # The board's rows go in after the morning is safely published. The cadence rule (which of these
    # are genuinely new) lives inside publish_macro_stats, where the stored rows can be seen.
    if deps.publish_macro_stats is not None and macro_stat_rows:
        deps.publish_macro_stats(deps.conn, rows=macro_stat_rows)

    # The P4 honesty engine: base rates, setup cards, and vol bands over the served universe's
    # history. Published separately so a heavier compute never risks the core morning's transaction.
    # (Scope note, logged in DECISIONS: base rates are computed over the SERVED + watchlist history —
    # the symbols the user actually sees cards for — which is fast and honest via the N-gate. The
    # full-universe historical replay for larger N is a logged enhancement.)
    if deps.publish_analytics is not None:
        _run_analytics(deps.conn, deps.publish_analytics, edition, bars, snapshot, served, market_context)

    return NightlyResult(
        run_date=edition,
        universe_size=len(symbols),
        coverage=coverage,
        scan_matches=scans.height,
        served_symbols=served_bars["symbol"].n_unique() if served_bars.height else 0,
        breadth=breadth,
    )


# ── `compute` mode: recompute the derived layer over bars we already have (N6, plan 8.1d) ─────


@dataclass(frozen=True)
class ComputeDeps:
    """Everything `run_compute` needs — and, far more importantly, everything it CANNOT reach.

    THIS STRUCT IS THE PROMISE. Compare it with NightlyDeps above: there is no `fetch_universe`, no
    `fetch_bars`, no `read_macro`, no `fetch_catalysts`, no `build_front_page`, no
    `submit_extraction`. Every one of those is a door to a provider, and none of them is here. That
    is what makes "Recompute scans" the one button in the control room that is safe to press at any
    hour, including with the market open: it physically cannot fetch anything.

    A mode is a promise about what a run will not touch, and a promise the code merely *intends* to
    keep is worth nothing. This one is held by the type, and a test enumerates these five fields.
    """

    # The stored lake, already pulled down from R2. Returns every bar we hold, every symbol.
    read_bars: Callable[[], pl.DataFrame]
    read_served_symbols: Callable[[], list[str]]
    # Publishes the derived layer ONLY, preserving what the night recorded about its sources.
    publish_compute: Callable[..., None]
    publish_analytics: Callable[..., None] | None
    conn: Any


@dataclass(frozen=True)
class ComputeResult:
    """What a recompute did, for the job's log line."""

    run_date: date
    symbols: int
    scan_matches: int


def run_compute(deps: ComputeDeps) -> ComputeResult:
    """Re-run the indicators, the scans and the analytics over the stored bars. Fetch nothing.

    This is the "I fixed a detector, recompute last night with the new code" button (plan 8.1d).

    THE RUN DATE COMES FROM THE DATA, NOT THE CLOCK, and that is what makes the button safe at any
    hour. Ask the clock and a recompute fired at noon on Tuesday stamps its scans with Tuesday — a
    session that has not closed, whose bars do not exist, and whose row would then sit on the Desk
    presenting itself as today's edition. The lake knows exactly which session it holds; ask it.
    (This build has now shipped a "computed against the wrong clock" bug three times — F4's
    cooling-off stamp, N4's markets-open strip, and N5's relative timestamps. Not a fourth.)
    """
    bars = deps.read_bars()
    if bars.height == 0:
        # An empty read is a broken R2 sync, not a market with no stocks in it. Publishing here
        # would DELETE the session's scan results (the publish replaces them for the run date) and
        # leave the scans room empty behind a green run. Fail loud instead.
        raise RuntimeError(
            "compute: the stored lake came back empty — refusing to publish a blank recompute, "
            "which would delete the session's scan results. Check the R2 sync."
        )

    # The newest session the lake actually holds. This is the edition being recomputed.
    run_date = bars["date"].max()

    indicated = build_indicated(bars)
    snapshot = snapshot_from_indicated(indicated)
    scans = run_all(snapshot)

    served = set(deps.read_served_symbols())
    scan_results = curated_scans(scans)

    # The signal log is INSERT-ONLY and idempotent on (fired_date, pattern_key, symbol, horizon).
    # So a recompute after a detector fix ADDS whatever the new code fires and REMOVES NOTHING — and
    # that is correct, not a limitation. A signal this app published last night is a historical fact
    # about what it told the reader; quietly deleting it because the code changed its mind would be
    # rewriting the track record, which is the one thing the ledger exists to make impossible. (The
    # table has a trigger blocking UPDATE and DELETE, so it is impossible rather than merely
    # discouraged.)
    signal_logs = build_signal_logs(scans, run_date)

    deps.publish_compute(
        deps.conn,
        run_date=run_date,
        scan_results=scan_results if scan_results.height else None,
        signal_logs=signal_logs,
    )

    # The regime the setup cards condition on is breadth, which is a property of the STORED bars —
    # so a recompute can honestly restate it. The macro cells (VIX, the 10-year) are not: those come
    # from FRED, this run did not call FRED, and it therefore has nothing new to say about them.
    if deps.publish_analytics is not None:
        breadth = compute_breadth(snapshot)
        _run_analytics(deps.conn, deps.publish_analytics, run_date, bars, snapshot, served, breadth)

    return ComputeResult(
        run_date=run_date,
        symbols=bars["symbol"].n_unique(),
        scan_matches=scans.height,
    )


def _build_mood_row(deps: NightlyDeps, edition: date, indicated: pl.DataFrame, breadth: dict) -> Any | None:
    """
    Compute tonight's Mood gauge and shape it as a macro_stat row — or return None.

    THE GAUGE IS COMPUTED BY THE FULL NIGHTLY AND BY NOTHING ELSE. Two of its five components
    (breadth, and where the universe sits in its own 252-day range) can only be measured from a run
    that actually ingested the market. The 6am macro refresh does not ingest the market — it exists
    to re-read three numbers FRED published late — so it leaves the gauge alone rather than
    recomputing a thinner version of it and overwriting a five-component reading with a
    three-component one. A run that did not look at the market does not get to say how it feels.

    Every component is assembled independently and any of them may come back None: a dead FRED
    series costs the gauge that one input, not the gauge. If fewer than three survive, `mood.compute`
    suppresses the score entirely and the board says which inputs are missing.
    """
    if deps.read_mood_history is None:
        return None

    try:
        history = deps.read_mood_history()
        components = _mood_components(history, indicated, breadth)
        gauge = mood.compute(components)
        if gauge is None:
            print(
                f"nightly: mood gauge suppressed — only {len(components)} of 5 components available "
                f"(needs {mood.MIN_COMPONENTS}). The board will say which are missing."
            )
            return None

        return macro_stats.MacroStatRow(
            series_key=macro_stats.MOOD,
            as_of_date=edition,
            value=float(gauge.score),
            prior=None,  # filled from the previously stored gauge at publish time
            as_of_label=macro_stats.label_for(macro_stats.MOOD, edition),
            # "computed", never a provider name. This number is ours and the board says so out loud
            # (ruling C8) — the whole reason it exists is that no honest external source does.
            source_key="computed",
            fetched_at=datetime.now(UTC),
            meta=gauge.as_meta(),
        )
    except Exception as error:  # noqa: BLE001 — a broken gauge costs the gauge, never the morning
        print(f"nightly: the mood gauge failed to compute ({error}); the board renders it absent.")
        return None


def _mood_components(history: MoodHistory, indicated: pl.DataFrame, breadth: dict) -> list[Any]:
    """
    The five inputs, each scored as a percentile of its OWN trailing year and each oriented so that
    higher means greedier (Part 6.5).

    Two of them are inverted, and this is where that happens: a HIGH VIX and a WIDE credit spread
    are both fear. Everything downstream — the unweighted mean, the band word — depends on all five
    pointing the same way, and this is the only place that is true by construction rather than by
    someone remembering.
    """
    components: list[Any] = []

    # 1. Breadth — the share of the universe above its own 50-day average.
    breadth_history = mood.breadth_series(indicated)["value"].to_list()
    breadth_today = breadth["pct_above_50dma"]
    percentile = mood.percentile_of(breadth_today, breadth_history)
    if percentile is not None:
        components.append(mood.Component(
            key="breadth", label="Breadth", value=breadth_today,
            window="% of universe above its 50-day average", percentile=percentile,
        ))

    # 2. Volatility — the VIX, INVERTED. A high VIX is fear.
    if history.vix:
        percentile = mood.percentile_of(history.vix[-1], history.vix, invert=True)
        if percentile is not None:
            components.append(mood.Component(
                key="volatility", label="Volatility (VIX)", value=history.vix[-1],
                window="last close", percentile=percentile,
            ))

    # 3. Momentum — the S&P against its own 125-session mean.
    momentum = mood.momentum_series(history.sp500)
    if momentum:
        percentile = mood.percentile_of(momentum[-1], momentum)
        if percentile is not None:
            components.append(mood.Component(
                key="momentum", label="Momentum", value=momentum[-1],
                window="S&P 500 vs its 125-session mean", percentile=percentile,
            ))

    # 4. Range position — the share near 252-day highs minus the share near 252-day lows.
    range_history = mood.range_position_series(indicated)["value"].to_list()
    if range_history:
        percentile = mood.percentile_of(range_history[-1], range_history)
        if percentile is not None:
            components.append(mood.Component(
                key="range", label="Range position", value=range_history[-1],
                window="share near 252-day highs minus share near lows", percentile=percentile,
            ))

    # 5. Credit stress — high-yield spreads, INVERTED. Wider spreads are fear.
    if history.credit:
        percentile = mood.percentile_of(history.credit[-1], history.credit, invert=True)
        if percentile is not None:
            components.append(mood.Component(
                key="credit", label="Credit spreads", value=history.credit[-1],
                window="ICE BofA US High Yield OAS, last close", percentile=percentile,
            ))

    return components


def _bars_frame(by_symbol: dict[str, list[Any]]) -> pl.DataFrame:
    """Flatten a {symbol: [Bar, ...]} map into one Polars frame of daily bars."""
    rows = [
        (b.symbol, b.date, b.open, b.high, b.low, b.close, int(b.volume))
        for bars in by_symbol.values()
        for b in bars
    ]
    return pl.DataFrame(rows, schema=_BAR_COLS, orient="row")


def compute_breadth(snapshot: pl.DataFrame) -> dict:
    """
    The day's breadth from the run-date snapshot: how many names advanced, how many declined, and
    what share sit above their 50-day average. Breadth answers "broad or narrow?" — a rally on
    narrow breadth is a different thing from a broad one (Research Report §9.2).
    """
    advancers = int(snapshot.filter(pl.col("ret_1") > 0).height)
    decliners = int(snapshot.filter(pl.col("ret_1") < 0).height)
    with_ma = snapshot.filter(pl.col("sma50").is_not_null())
    pct = with_ma.filter(pl.col("close") > pl.col("sma50")).height / with_ma.height if with_ma.height else 0.0
    return {"advancers": advancers, "decliners": decliners, "pct_above_50dma": round(pct, 4)}


def served_price_bars(bars: pl.DataFrame, served: set[str]) -> pl.DataFrame:
    """
    The subset of bars mirrored into Postgres: only the served symbols, only their most recent
    SERVED_HISTORY_BARS, with an adjusted-close column. Alpaca's adjustment=all already returns
    adjusted prices, so at P1 adj_close equals close; the column exists so the serving schema and
    the indicator math have the field they expect.
    """
    if not served:
        return bars.head(0).with_columns(pl.col("close").alias("adj_close"))
    subset = (
        bars.filter(pl.col("symbol").is_in(list(served)))
        .sort("symbol", "date")
        .group_by("symbol", maintain_order=True)
        .tail(SERVED_HISTORY_BARS)
    )
    return subset.with_columns(pl.col("close").alias("adj_close"))


def mover_symbols(scans: pl.DataFrame) -> list[str]:
    """The movers whose catalysts we look up — the unusual-volume matches (the Desk's Movers set)."""
    if scans.height == 0:
        return []
    return scans.filter(pl.col("preset_key") == UNUSUAL_VOLUME)["symbol"].to_list()


def _run_analytics(conn: Any, publish_analytics: Callable[..., None], run_date: date,
                   bars: pl.DataFrame, snapshot: pl.DataFrame, served: set[str],
                   market_context: Mapping[str, Any]) -> None:
    """Compute and publish the P4 honesty engine over the served universe's history.

    Runs the detectors over the served symbols' full indicator history to build base rates, turns
    today's fired events on served symbols into setup cards (tier + stated rate), and computes vol
    bands from each served symbol's recent closes. A failure here degrades the cards, not the
    morning — the core data already published above — so it is caught and logged, not raised.

    It takes its three collaborators explicitly rather than a deps object, because it has TWO
    callers now: the full night, and N6's `compute` recompute. Those two hand it different structs,
    and the honest way to share a function between them is to ask for exactly what it uses.
    """
    try:
        served_bars = bars.filter(pl.col("symbol").is_in(list(served)))
        if served_bars.height == 0:
            return
        indicated = build_indicated(served_bars)
        breadth_history = _breadth_history(indicated)

        base_rates = analytics.build_base_rate_rows(indicated, breadth_history)
        events = det.detect(indicated)
        regime = "risk_on" if market_context["pct_above_50dma"] >= _REGIME_LINE else "risk_off"
        bucket_of = _bucket_of(snapshot, served)
        cards = analytics.build_setup_cards(
            events, base_rates, run_date=run_date, served=served,
            bucket_of=bucket_of, regime=regime, horizon=_CARD_HORIZON,
        )
        vol_bands = analytics.build_vol_bands(_closes_by_symbol(indicated, served), run_date=run_date)

        publish_analytics(
            conn, run_date=run_date, base_rates=base_rates, setup_cards=cards, vol_bands=vol_bands,
        )
        print(f"nightly: analytics — {len(base_rates)} base rates, {len(cards)} cards, {len(vol_bands)} vol bands.")
    except Exception as error:  # noqa: BLE001 — analytics degrades the cards, not the published morning
        print(f"nightly: analytics stage failed ({error}); cards/bands skipped this run.")


def _breadth_history(indicated: pl.DataFrame) -> pl.DataFrame:
    """Per-date breadth (fraction above the 50-day average) over the indicated history — the regime
    series the base rates condition on."""
    return (
        indicated.filter(pl.col("sma50").is_not_null())
        .group_by("date")
        .agg((pl.col("close") > pl.col("sma50")).mean().alias("pct_above_50dma"))
        .sort("date")
    )


def _bucket_of(snapshot: pl.DataFrame, served: set[str]) -> dict[str, str]:
    """Each served symbol's size bucket today, from the run-date snapshot's large/mid flag and price
    (sub-$5 excluded, matching the historical bucketing)."""
    out: dict[str, str] = {}
    for row in snapshot.filter(pl.col("symbol").is_in(list(served))).iter_rows(named=True):
        if row["close"] < 5.0:
            continue
        out[row["symbol"]] = "large_mid" if row.get("is_large_mid") else "small"
    return out


def _closes_by_symbol(indicated: pl.DataFrame, served: set[str]) -> dict[str, list[float]]:
    """Each served symbol's closes, oldest first, for the vol bands."""
    out: dict[str, list[float]] = {}
    for row in indicated.filter(pl.col("symbol").is_in(list(served))).sort(["symbol", "date"]).iter_rows(named=True):
        out.setdefault(row["symbol"], []).append(row["close"])
    return out


def _classify_news(news_items: list[dict]) -> list[dict]:
    """Fill each news item's event_type by classifying its headline, unless it already has one (an
    EDGAR filing arrives typed), and stamp a deterministic id.

    The id is derived from (provider, url), so the same article always gets the same id: Job A can
    use it as the extraction batch's custom_id, publish stores it as the news_item id, and Job B (a
    separate process) reads the same id back to line the batch results up with their articles — and
    the app resolves a briefing citation to the article's URL by that id. Returns new dicts; the
    inputs are not mutated.
    """
    return [
        {
            **item,
            "id": _news_id(item.get("provider", ""), item.get("url", "")),
            "event_type": item.get("event_type") or classify(item.get("headline", "")),
        }
        for item in news_items
    ]


def _news_id(provider: str, url: str) -> str:
    """A stable, short id for a news article from its natural key (provider, url)."""
    return hashlib.sha1(f"{provider}|{url}".encode()).hexdigest()


def build_signal_logs(scans: pl.DataFrame, run_date: date) -> list[dict]:
    """
    One insert-only signal_log row per scan match: which pattern fired, on which symbol, and when it
    resolves — exactly HORIZON_DAYS trading days out on the NYSE calendar. The rate fields stay null
    until P4. Returns an empty list when nothing matched (the calendar is not consulted then).
    """
    if scans.height == 0:
        return []
    resolves_on = sessions_ahead(run_date, HORIZON_DAYS)
    return [
        {
            "fired_date": run_date,
            "symbol": row["symbol"],
            "pattern_key": row["preset_key"],
            "horizon_days": HORIZON_DAYS,
            "resolves_on": resolves_on,
        }
        for row in scans.iter_rows(named=True)
    ]


def curated_scans(scans: pl.DataFrame) -> pl.DataFrame:
    """
    Trim a scan-result frame to the columns Postgres keeps: the identity (preset/symbol/rank) plus a
    curated metric set. Publishing the entire snapshot per match would bloat the metrics JSON with
    fields nothing reads; this keeps only what the Desk and the setup cards use.
    """
    if scans.height == 0:
        return scans
    metric_cols = [c for c in _SCAN_METRIC_COLS if c in scans.columns]
    return scans.select(["preset_key", "symbol", "rank", *metric_cols])
