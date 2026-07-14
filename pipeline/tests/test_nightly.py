"""
Tests for nightly.py — Job A's orchestration (plan §2.1, P1 step 5).

The flow is exercised with injected fakes, so no live provider key is touched: a fake universe, a
fake bar fetch, a fake macro read, a recording Parquet store / R2 store / publish. The pure helpers
(breadth, served-bar selection, curated scan metrics) are asserted directly on crafted frames.

The one hard rule the plan names explicitly — the universe coverage floor — gets its own test: too
few symbols with bars and the whole night fails loudly, before anything is written or published.
"""

from datetime import date

import polars as pl
import pytest

import nightly
from adapters.alpaca import Bar
from trading_calendar import sessions_ahead


def _bar(symbol, d, close, volume=1000):
    return Bar(symbol=symbol, date=d, open=close, high=close, low=close, close=close, volume=volume)


# The session every fake night in this file ENDS on — its edition. A Wednesday, and a real one.
LAST_SESSION = date(2026, 6, 10)


def _history(symbol, closes, end=LAST_SESSION):
    """A run of bars over consecutive TRADING SESSIONS, ENDING on `end`.

    Two things changed here at PD0, and both are the same point.

    They used to walk consecutive CALENDAR days, which quietly put fixture bars on Saturdays — a
    fake night ending on a day the market never opened. And they were anchored at the START, so a
    history's last bar moved whenever its length did, while the night's `run_date` sat beside it as
    a hard-coded constant that did not move. The fixture therefore described one session and claimed
    another: the production bug of Part 1.2, reproduced inside the test suite, green, for months.

    Anchoring at the END is what a night actually is — a session, with however much history behind
    it — so the edition is now a fixed, checkable date no matter how many closes a test feeds in.
    (Ruling E1: fixtures are held to the same law as production, or a test can certify what
    production forbids.)
    """
    last = len(closes) - 1
    return [_bar(symbol, sessions_ahead(end, i - last), c) for i, c in enumerate(closes)]


class RecordingStore:
    def __init__(self):
        self.root = "/tmp/does-not-matter"
        self.writes = []

    def write_partitioned(self, dataset, frame):
        self.writes.append((dataset, frame.height))
        return []


class RecordingR2:
    def __init__(self):
        self.synced = 0

    def sync_up(self, root):
        self.synced += 1
        return []


class RecordingPublish:
    def __init__(self):
        self.calls = []

    def __call__(self, conn, **kwargs):
        self.calls.append(kwargs)


def _deps(universe, bars_by_symbol, *, macro=None, served=("SPY",), publish=None, r2=None):
    # The night's FRED read: the two context cells plus the three index levels and their priors.
    macro = macro if macro is not None else nightly.MacroRead(
        vix=15.8, ten_year=4.5,
        sp500=6812.34, sp500_prior=6789.10,
        nasdaq_composite=22345.67, nasdaq_composite_prior=22280.15,
        djia=44210.55, djia_prior=44320.80,
    )
    # The expected session is READ OFF THE FIXTURE'S OWN BARS, not written down beside them.
    #
    # It used to be a hard-coded date(2026, 6, 10) sitting next to bar histories that ended on
    # entirely different days — a fake night whose data described one session while its run_date
    # claimed another. That is precisely the production bug (Part 1.2) reproduced in the test suite,
    # sitting there green, for months. run_nightly now refuses such a night (edition_from_bars), and
    # the fixtures are honest by construction rather than by someone remembering to update two
    # numbers together.
    last_session = max(bar.date for bars in bars_by_symbol.values() for bar in bars)
    return nightly.NightlyDeps(
        fetch_universe=lambda: universe,
        fetch_bars=lambda symbols: bars_by_symbol,
        read_macro=lambda: macro,
        read_served_symbols=lambda: list(served),
        store=RecordingStore(),
        r2=r2,
        publish=publish or RecordingPublish(),
        conn=object(),
        run_date=last_session,
    )


# ── the coverage floor ───────────────────────────────────────────────────────────────────────

def test_a_night_below_the_coverage_floor_fails_before_writing_anything():
    universe = [{"symbol": f"S{i}", "name": f"Name {i}", "exchange": "NASDAQ"} for i in range(100)]
    # Only 90 of 100 symbols returned bars — 90% coverage, below the 95% floor.
    bars = {u["symbol"]: _history(u["symbol"], [10.0]) for u in universe[:90]}
    store = RecordingStore()
    publish = RecordingPublish()
    deps = _deps(universe, bars, publish=publish)
    deps = nightly.NightlyDeps(**{**deps.__dict__, "store": store})

    with pytest.raises(RuntimeError, match="coverage"):
        nightly.run_nightly(deps)

    assert store.writes == []  # nothing persisted
    assert publish.calls == []  # nothing published


def test_a_full_night_publishes_the_served_data_and_macro_context():
    universe = [
        {"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"},
        {"symbol": "AAPL", "name": "Apple", "exchange": "NASDAQ"},
    ]
    bars = {
        "SPY": _history("SPY", [500, 502, 505, 503, 508, 511]),
        "AAPL": _history("AAPL", [200, 201, 199, 202, 204, 203]),
    }
    store = RecordingStore()
    r2 = RecordingR2()
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish, r2=r2)
    deps = nightly.NightlyDeps(**{**deps.__dict__, "store": store})

    result = nightly.run_nightly(deps)

    assert result.coverage == 1.0
    assert store.writes and store.writes[0][0] == nightly.PRICES  # prices persisted
    assert r2.synced == 1  # and pushed to R2

    published = publish.calls[0]
    assert published["market_context"]["vix"] == 15.8
    assert published["market_context"]["ten_year"] == 4.5
    # The index LEVELS and their priors travel to the database (redesign §6.1). Without the prior,
    # the app cannot compute a one-day change and must print "—" rather than borrow an ETF's.
    assert published["market_context"]["sp500"] == 6812.34
    assert published["market_context"]["sp500_prior"] == 6789.10
    assert published["market_context"]["nasdaq_composite"] == 22345.67
    assert published["market_context"]["djia"] == 44210.55
    # Only the served symbol (SPY) reaches Postgres; AAPL stays in the Parquet lake.
    served_symbols = set(published["price_bars"]["symbol"].to_list())
    assert served_symbols == {"SPY"}
    assert published["instruments"] == universe


def test_the_catalyst_stage_classifies_news_and_merges_source_status():
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()

    def fetch_catalysts(movers):
        return nightly.CatalystBundle(
            news_items=[
                {"provider": "finnhub", "url": "https://x/1", "published_at": "t", "headline": "Apple beats Q3 earnings", "snippet": "", "tickers": ["AAPL"]},
                {"provider": "edgar", "url": "https://x/2", "published_at": "t", "headline": "Files 8-K", "snippet": "", "tickers": ["MSFT"], "event_type": "filing"},
            ],
            calendar_events=[{"date": date(2026, 6, 15), "kind": "earnings", "title": "Apple Q3"}],
            source_status={"finnhub": "ok", "marketaux": "down", "fmp": "ok"},
        )

    deps = _deps(universe, bars, served=("SPY",), publish=publish)
    deps = nightly.NightlyDeps(**{**deps.__dict__, "fetch_catalysts": fetch_catalysts})

    nightly.run_nightly(deps)

    published = publish.calls[0]
    # News is classified (headline → type), and a pre-typed EDGAR filing is left alone.
    types = {n["url"]: n["event_type"] for n in published["news_items"]}
    assert types["https://x/1"] == "earnings"
    assert types["https://x/2"] == "filing"
    # Per-source status is merged: the base sources plus each catalyst provider's health.
    assert published["source_status"]["marketaux"] == "down"
    assert published["source_status"]["alpaca"] == "ok"
    assert published["calendar_events"][0]["kind"] == "earnings"


def test_fred_outage_marks_the_source_degraded_but_still_publishes():
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()
    deps = _deps(universe, bars, macro=nightly.MacroRead(vix=None, ten_year=None), served=("SPY",), publish=publish)

    nightly.run_nightly(deps)

    published = publish.calls[0]
    assert published["market_context"]["vix"] is None
    assert published["source_status"]["fred"] == "degraded"


# ── the pure helpers ──────────────────────────────────────────────────────────────────────────

def test_compute_breadth_counts_advancers_decliners_and_share_above_the_50dma():
    snapshot = pl.DataFrame(
        {
            "symbol": ["A", "B", "C", "D"],
            "ret_1": [0.02, -0.01, 0.0, 0.05],
            "close": [110.0, 90.0, 100.0, 120.0],
            "sma50": [100.0, 100.0, None, 100.0],
        }
    )
    breadth = nightly.compute_breadth(snapshot)
    assert breadth["advancers"] == 2  # A and D
    assert breadth["decliners"] == 1  # B
    # Of the three with a 50-day average, two (A, D) are above it → 0.6667.
    assert breadth["pct_above_50dma"] == pytest.approx(0.6667, abs=1e-4)


def test_build_signal_logs_makes_one_insert_only_row_per_match():
    scans = pl.DataFrame(
        {
            "preset_key": ["unusual-volume", "gap-3plus"],
            "symbol": ["AAPL", "MSFT"],
            "rank": [1, 1],
        }
    )
    logs = nightly.build_signal_logs(scans, date(2026, 6, 30))
    assert len(logs) == 2
    assert logs[0] == {
        "fired_date": date(2026, 6, 30),
        "symbol": "AAPL",
        "pattern_key": "unusual-volume",
        "horizon_days": 10,
        # Ten NYSE sessions after 30 June 2026 (skipping the 3 July holiday).
        "resolves_on": date(2026, 7, 15),
    }
    assert logs[1]["pattern_key"] == "gap-3plus"


def test_build_signal_logs_is_empty_when_nothing_matched():
    empty = pl.DataFrame({"preset_key": [], "symbol": [], "rank": []})
    assert nightly.build_signal_logs(empty, date(2026, 6, 30)) == []


def test_served_price_bars_keeps_only_served_symbols_and_adds_adjusted_close():
    bars = pl.DataFrame(
        {
            "symbol": ["SPY", "SPY", "AAPL"],
            "date": [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 2)],
            "open": [1.0, 2.0, 9.0],
            "high": [1.0, 2.0, 9.0],
            "low": [1.0, 2.0, 9.0],
            "close": [1.5, 2.5, 9.5],
            "volume": [10, 20, 30],
        }
    )
    served = nightly.served_price_bars(bars, {"SPY"})
    assert set(served["symbol"].to_list()) == {"SPY"}
    # adj_close is present and, at P1, equals the (already-adjusted) close.
    assert served["adj_close"].to_list() == [1.5, 2.5]


# ── the index-level source status (NEWS-AND-CONTROL-PLAN §3.1) ───────────────────────────────
#
# The production failure this exists to prevent, observed on 2026-07-11: market_context carried
# NULL for all three index levels, VIX and the 10-year came through fine, and the run still recorded
# `fred: ok`. The Desk therefore rendered four ETF proxies under a footer claiming FRED index
# levels, and NOTHING anywhere said the levels were missing.
#
# `fred: ok` was not even wrong — FRED *was* reachable; it answered for VIX and DGS10. The bug is
# that one source key cannot describe two different failures. The index levels need their own key,
# so a run can say "FRED answered, but not for the indexes."


def test_missing_index_levels_degrade_their_own_source_key_even_when_fred_answers():
    # All three index series come back empty; VIX and the 10-year are fine. This is the exact shape
    # of the production row that started this whole phase.
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()
    macro = nightly.MacroRead(vix=15.8, ten_year=4.5)  # levels all default to None
    deps = _deps(universe, bars, macro=macro, served=("SPY",), publish=publish)

    nightly.run_nightly(deps)

    status = publish.calls[0]["source_status"]
    # FRED itself is genuinely fine — it answered for the two context cells. Saying otherwise would
    # be its own small lie, and would light up a source that is not broken.
    assert status["fred"] == "ok"
    # But the index levels are missing, and now the run says so out loud.
    assert status["fred-indexes"] == "degraded"


def test_one_missing_index_series_is_enough_to_degrade():
    # Partial is still degraded: a Desk showing two true index levels and one ETF proxy is a Desk
    # whose reader deserves to know why the third one changed shape.
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()
    macro = nightly.MacroRead(
        vix=15.8, ten_year=4.5,
        sp500=6812.34, sp500_prior=6789.10,
        nasdaq_composite=22345.67, nasdaq_composite_prior=22280.15,
        djia=None, djia_prior=None,  # the Dow alone failed
    )
    deps = _deps(universe, bars, macro=macro, served=("SPY",), publish=publish)

    nightly.run_nightly(deps)

    assert publish.calls[0]["source_status"]["fred-indexes"] == "degraded"


def test_a_complete_index_read_reports_ok():
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish)  # the default macro is complete

    nightly.run_nightly(deps)

    assert publish.calls[0]["source_status"]["fred-indexes"] == "ok"


# ── the edition is the session the DATA describes (PD0, plan 3.1, ruling E1) ─────────────────


def test_the_night_stamps_the_session_its_bars_describe():
    """The whole contract, in one assertion: the published run_date IS the newest bar's date.

    Before PD0 this came from `datetime.now(ET).date()` — the wall clock — and on 2026-07-11 the
    wall clock said Saturday while the bars said Friday. Four surfaces then faithfully rendered a
    close that has never existed.
    """
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}  # three sessions, ending Wed 2026-06-10
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish)

    result = nightly.run_nightly(deps)

    assert publish.calls[0]["run_date"] == LAST_SESSION   # 2026-06-10, the newest bar
    assert result.run_date == LAST_SESSION


def test_a_night_whose_bars_disagree_with_the_calendar_publishes_nothing():
    """
    THE STALE-PROVIDER CASE, which is the one that survives every other guard.

    It is Monday evening. The gate is happy (Monday is a session). The calendar says the session
    that closed is Monday. But Alpaca has not posted Monday's bars yet, so the ingest ends on
    Friday. Publishing here would silently rewrite Friday's edition — same rows, fresh run,
    everything green — and the reader would have no way to know the night did nothing.

    So the night fails instead, loudly, before a single row is written. Exactly the judgment the
    coverage floor already makes: a night that cannot say which session it is describing has nothing
    publishable to say at all.
    """
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    bars = {"SPY": _history("SPY", [500, 502, 505])}  # ends Wed 2026-06-10
    store = RecordingStore()
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish)
    # The calendar expected the NEXT session (Thu 06-11); the data stopped a day short.
    deps = nightly.NightlyDeps(**{**deps.__dict__, "store": store, "run_date": date(2026, 6, 11)})

    with pytest.raises(nightly.EditionDateMismatch, match="disagree about which day this is"):
        nightly.run_nightly(deps)

    assert publish.calls == []


def test_a_night_whose_bars_land_on_a_day_the_market_never_opened_publishes_nothing():
    """The backstop, below the calendar cross-check: bars ending on a Saturday are refused outright.

    2026-07-11 is the Saturday production actually stamped. It cannot be reached through the normal
    path any more — but "cannot be reached" is what everyone believed about the last one too.
    """
    universe = [{"symbol": "SPY", "name": "S&P 500 ETF", "exchange": "ARCA"}]
    saturday = date(2026, 7, 11)
    bars = {"SPY": [_bar("SPY", date(2026, 7, 9), 500), _bar("SPY", date(2026, 7, 10), 502),
                    _bar("SPY", saturday, 505)]}
    publish = RecordingPublish()
    deps = _deps(universe, bars, served=("SPY",), publish=publish)  # run_date derives to the Saturday

    with pytest.raises(nightly.EditionDateMismatch, match="not a trading session"):
        nightly.run_nightly(deps)

    assert publish.calls == []


# ── the macro board's stage (N3, Part 6) ─────────────────────────────────────────────────────


class RecordingMacroStatsPublish:
    def __init__(self):
        self.rows = None

    def __call__(self, conn, *, rows):
        self.rows = list(rows)


def _board_deps(*, mood_history=None, board_rows=(), board_status=None, publish_stats=None):
    """A night with enough history for the gauge's market components to actually compute.

    THE LENGTH OF THIS HISTORY IS THE TEST, and it took two goes to get right. The range-position
    component needs a full 252-session window per symbol before it produces its FIRST value, and
    then 60 of those values before a percentile against them means anything. So a fake night with
    260 bars yields nine range readings, the component drops out below the history floor, and the
    gauge quietly computes from four inputs — while a test asserting "a gauge was written" sails
    through, having proved nothing about the path it was written to cover.

    340 sessions is what it takes for all five components to actually exist, which is what makes
    this test capable of failing. (Production is never near this line: the night carries five years
    of bars.)
    """
    sessions = 340
    universe = [{"symbol": s, "name": s, "exchange": "NASDAQ"} for s in ("SPY", "AAA", "BBB")]
    bars = {
        "SPY": _history("SPY", [400.0 + i for i in range(sessions)]),
        "AAA": _history("AAA", [100.0 + i for i in range(sessions)]),
        "BBB": _history("BBB", [300.0 - i * 0.5 for i in range(sessions)]),
    }

    history = mood_history if mood_history is not None else nightly.MoodHistory(
        vix=[15.0 + (i % 10) for i in range(300)],
        sp500=[4000.0 + i for i in range(300)],
        credit=[3.0 + (i % 5) * 0.1 for i in range(300)],
    )

    deps = _deps(universe, bars, served=("SPY",))
    return nightly.NightlyDeps(
        **{
            **deps.__dict__,
            "read_macro_stats": lambda: nightly.MacroStatsRead(
                rows=list(board_rows), source_status=dict(board_status or {}),
            ),
            "read_mood_history": lambda: history,
            "publish_macro_stats": publish_stats or RecordingMacroStatsPublish(),
        }
    )


def test_the_night_computes_the_mood_gauge_and_writes_it_with_its_full_breakdown():
    """
    Ruling C8, enforced at the source: the gauge is stored WITH its components, always.

    If this row could ever be written without them, the app's required-prop guard would be the only
    thing standing between a reader and a naked sentiment number — and a guard at the edge of the
    system is a guard that eventually gets bypassed by a code path nobody thought about.
    """
    publish_stats = RecordingMacroStatsPublish()
    deps = _board_deps(publish_stats=publish_stats)

    nightly.run_nightly(deps)

    gauge = next(r for r in publish_stats.rows if r.series_key == "mood")
    assert gauge.source_key == "computed"          # ours. never a provider's name (C8)
    assert 0 <= gauge.value <= 100
    assert gauge.meta["components"], "a gauge row without its breakdown must never be written"
    assert gauge.meta["band"] in {"fearful", "leaning fearful", "mixed", "leaning greedy", "greedy"}

    # All five components, and every one of them carries what C8 requires: what it measured, over
    # what window, where that sits in its own history, and which way it is pulling.
    keys = {c["key"] for c in gauge.meta["components"]}
    assert keys == {"breadth", "volatility", "momentum", "range", "credit"}
    for component in gauge.meta["components"]:
        assert component["window"] and component["label"]
        assert 0.0 <= component["percentile"] <= 1.0
        assert component["contributes"] in {"greedy", "fearful"}


def test_a_gauge_with_too_few_inputs_is_not_written_at_all():
    """
    Every FRED series is down. Breadth and range survive (they come from our own bars), so two
    components remain — below the floor of three, and the gauge suppresses itself.

    Nothing is written. The board renders "insufficient inputs tonight" and names what is missing,
    which is a true statement, where a two-component average dressed up as a market mood would not be.
    """
    publish_stats = RecordingMacroStatsPublish()
    deps = _board_deps(
        mood_history=nightly.MoodHistory(vix=[], sp500=[], credit=[]),
        publish_stats=publish_stats,
    )

    nightly.run_nightly(deps)

    assert publish_stats.rows is None or not any(r.series_key == "mood" for r in publish_stats.rows)


def test_each_degraded_stat_reports_itself_under_its_own_source_key():
    """
    One key cannot describe two failures (the N1 lesson, applied per cell).

    A night where gold is unreachable and the rupee is fine must say exactly that — not "macro:
    degraded", which tells the reader something is broken and nothing about what.
    """
    publish = RecordingPublish()
    deps = _board_deps(board_status={"macro-gold_usd": "degraded", "macro-usd_npr": "ok"})
    deps = nightly.NightlyDeps(**{**deps.__dict__, "publish": publish})

    nightly.run_nightly(deps)

    status = publish.calls[0]["source_status"]
    assert status["macro-gold_usd"] == "degraded"
    assert status["macro-usd_npr"] == "ok"
