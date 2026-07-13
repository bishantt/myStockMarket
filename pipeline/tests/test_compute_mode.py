"""
test_compute_mode.py — `compute` mode: recompute the derived layer over the stored lake (N6, plan 8.1d).

WHAT THIS MODE IS FOR. The user fixes a bug in a detector, or a scan's recipe changes, and last
night's numbers were computed by the old code. `compute` re-runs the indicators, the scans and the
analytics over bars we ALREADY HAVE, and fetches nothing at all. It is the "recompute scans" button.

WHAT IT MUST NEVER DO, and why these tests are shaped the way they are. A mode is a PROMISE ABOUT
WHAT A RUN WILL NOT TOUCH. `compute` promises to touch no provider — no Alpaca, no FRED, no news, no
LLM — so pressing it at noon cannot re-ingest the market mid-session and write half a day of unformed
bars over the last good close. That promise is held STRUCTURALLY here rather than by a comment: the
deps object `run_compute` accepts has no provider in it, and a test enumerates its fields. To break
the promise you would have to add a field AND edit the test that forbids it, which is a decision
rather than an accident.
"""

from __future__ import annotations

import inspect
from datetime import date, datetime, timedelta

import polars as pl
import pytest

import nightly
from jobs import job_a


# ── the mode's stage list is a pinned constant ───────────────────────────────────────────────

def test_compute_is_declared_with_the_exact_stages_it_runs():
    """A mode may never silently grow a stage — the panel's copy promises what each one touches."""
    assert job_a.MODE_STAGES["compute"] == ("compute", "scan", "publish", "revalidate")


def test_compute_ingests_nothing_and_narrates_nothing():
    """The stage list itself is the promise the 'Recompute scans' button makes to the reader.

    Named stages, not a count: a test asserting `len(stages) == 4` would pass just as happily if
    someone swapped `scan` for `ingest`.
    """
    stages = job_a.MODE_STAGES["compute"]
    for forbidden in ("ingest", "catalysts", "news", "macro"):
        assert forbidden not in stages, (
            f"compute mode must not run the {forbidden!r} stage — it is the one mode that is safe "
            f"to press while the market is open, and that is only true because it fetches nothing."
        )


def test_every_declared_mode_has_a_handler():
    """The guard that N4 added, now that `compute` is real: an undeclared handler is a full nightly.

    Every mode in MODE_STAGES must be dispatched by main(). A mode declared here with no branch in
    main() used to fall through to the FULL night — the bug that would have turned a noon
    "refresh the news" into a whole-market re-ingest.
    """
    source = inspect.getsource(job_a.main)
    for mode in job_a.MODE_STAGES:
        if mode == "full":
            continue  # full IS the fall-through, by definition
        assert f'mode == "{mode}"' in source, f"MODE_STAGES declares {mode!r} but main() never dispatches it"


# ── the structural promise: compute cannot reach a provider ──────────────────────────────────

def test_compute_deps_carries_no_provider_at_all():
    """THE LOAD-BEARING TEST OF THIS MODE.

    `run_compute` can only touch what its deps hand it. This enumerates every field on that struct
    and refuses anything that could reach the outside world for new data. The full nightly's deps
    carry `fetch_universe`, `fetch_bars`, `read_macro`, `fetch_catalysts`, `build_front_page`,
    `submit_extraction` — every one of them a door to a provider. None of them may appear here.

    This is the same shape as rank.py's significance() signature test: the rule is held by the TYPE,
    so letting a provider in would require editing this test, which nobody does by accident.
    """
    fields = set(nightly.ComputeDeps.__dataclass_fields__)
    assert fields == {"read_bars", "read_served_symbols", "publish_compute", "publish_analytics", "conn"}

    forbidden = {
        "fetch_universe", "fetch_bars", "read_macro", "fetch_catalysts",
        "build_front_page", "submit_extraction", "read_macro_stats", "read_mood_history", "r2", "store",
    }
    assert not (fields & forbidden), f"compute mode must not be handed a provider: {fields & forbidden}"


# ── behaviour ────────────────────────────────────────────────────────────────────────────────

def _history(symbol: str, closes: list[float], *, start: date = date(2026, 1, 2)) -> list[dict]:
    """A run of daily bars, one per day, walking forward from `start`."""
    return [
        {
            "symbol": symbol,
            "date": start + timedelta(days=i),
            "open": c,
            "high": c * 1.01,
            "low": c * 0.99,
            "close": c,
            "volume": 1_000_000 + i,
        }
        for i, c in enumerate(closes)
    ]


def _lake(symbols: dict[str, list[float]]) -> pl.DataFrame:
    """The stored lake as run_compute reads it: one flat frame of bars, every symbol, every year."""
    rows: list[dict] = []
    for symbol, closes in symbols.items():
        rows.extend(_history(symbol, closes))
    return pl.DataFrame(rows)


class RecordingComputePublish:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def __call__(self, conn, **kwargs) -> None:
        self.calls.append(kwargs)


def _deps(lake: pl.DataFrame, *, served=("SPY",), publish=None, publish_analytics=None):
    return nightly.ComputeDeps(
        read_bars=lambda: lake,
        read_served_symbols=lambda: list(served),
        publish_compute=publish or RecordingComputePublish(),
        publish_analytics=publish_analytics,
        conn=object(),
    )


def test_compute_takes_its_run_date_from_the_DATA_not_the_clock():
    """A recompute recomputes the newest session THE LAKE ACTUALLY HOLDS.

    This is the whole reason the button is safe to press at any hour. Ask the clock and a run fired
    at noon on Tuesday would stamp its scans with Tuesday — a session that has not closed, whose
    bars do not exist, and whose row would sit on the Desk claiming to be today's edition. The lake
    knows exactly which session it holds. Ask it.
    """
    lake = _lake({"SPY": [500, 502, 505, 503, 508, 511], "AAPL": [200, 201, 199, 202, 204, 203]})
    newest_bar = lake["date"].max()
    publish = RecordingComputePublish()

    nightly.run_compute(_deps(lake, publish=publish))

    assert publish.calls[0]["run_date"] == newest_bar


def test_compute_recomputes_the_scans_and_publishes_them():
    lake = _lake({"SPY": [500, 502, 505, 503, 508, 511], "AAPL": [200, 201, 199, 202, 204, 203]})
    publish = RecordingComputePublish()

    result = nightly.run_compute(_deps(lake, publish=publish))

    assert len(publish.calls) == 1
    published = publish.calls[0]
    # It republishes the derived layer...
    assert "scan_results" in published
    assert "signal_logs" in published
    # ...and NOTHING ELSE. These are the columns a recompute has no business rewriting: it read no
    # provider, so it knows nothing new about the universe, the macro context, or the news.
    for untouched in ("instruments", "market_context", "news_items", "calendar_events", "source_status"):
        assert untouched not in published, (
            f"compute published {untouched!r} — a run that fetched nothing may not rewrite it."
        )
    assert result.run_date == lake["date"].max()


def test_compute_refuses_an_empty_lake_rather_than_publishing_a_blank_recompute():
    """An empty read is a broken sync, not a market with no stocks in it.

    Publishing here would DELETE every scan result for the session (the publish replaces them) and
    leave the scans room empty, with a green run behind it. Fail loud.
    """
    empty = pl.DataFrame(schema={"symbol": pl.Utf8, "date": pl.Date, "open": pl.Float64,
                                 "high": pl.Float64, "low": pl.Float64, "close": pl.Float64,
                                 "volume": pl.Int64})
    publish = RecordingComputePublish()

    with pytest.raises(RuntimeError, match="empty"):
        nightly.run_compute(_deps(empty, publish=publish))

    assert publish.calls == []  # nothing published


def test_compute_runs_the_analytics_over_the_served_names():
    """The setup cards and base rates are derived too — a recompute that skipped them would leave
    the Desk's cards computed by the old code the button was pressed to replace."""
    closes = [100 + i * 0.5 for i in range(80)]
    lake = _lake({"SPY": closes, "AAPL": [200 + i * 0.3 for i in range(80)]})
    analytics_calls: list[dict] = []

    nightly.run_compute(
        _deps(lake, served=("SPY", "AAPL"),
              publish_analytics=lambda conn, **kw: analytics_calls.append(kw))
    )

    assert len(analytics_calls) == 1
    assert analytics_calls[0]["run_date"] == lake["date"].max()


# ── the full night refuses a day the market never opened (found by N6's panel, in production) ──


def test_a_full_run_on_a_non_session_day_skips_instead_of_stamping_a_false_date(monkeypatch, capsys):
    """
    THE BUG THIS CLOSES WAS LIVE IN PRODUCTION, and N6's own panel is what showed it.

    The control room opened with the line **"Data through 2026-07-11"** — a SATURDAY. There is no
    close on a Saturday, so there are no bars: Alpaca returns Friday's. The run had stamped Friday's
    data with Saturday's date, and the Desk had been telling the reader its data ran "through" a day
    the market never opened.

    And it was not a one-off. The cron is `37 22 * * 1-5`, so it never fires at a weekend — but it
    DOES fire on every market HOLIDAY, which is a weekday. Roughly nine times a year this job would
    wake on a closed market, ingest nothing new, and publish a run dated to a session that did not
    happen. Nothing failed, so every gate stayed green.

    A skipped run on a closed market is the CORRECT outcome, not an error — the job exits cleanly.
    Failing the workflow would send a red e-mail every Thanksgiving, and an alert that cries wolf is
    not there on the night it is finally right.
    """
    import jobs.job_a as ja

    # Christmas Day 2026 — a Friday, so the Mon–Fri cron really does fire on it.
    holiday = datetime(2026, 12, 25, 22, 37, tzinfo=ja._MARKET_TZ)

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return holiday

    monkeypatch.setattr(ja, "datetime", FrozenDatetime)
    monkeypatch.setattr(ja, "load_settings", lambda: object())
    # If the guard fails to fire, main() reaches for a real Alpaca client and this blows up LOUDLY —
    # which is the point. The test must not be able to pass by the job doing the work quietly.
    monkeypatch.setattr(ja, "_alpaca", _refuse("alpaca"))
    monkeypatch.setattr(ja, "_fred", _refuse("fred"))
    monkeypatch.setattr(ja, "parse_mode", lambda argv: "full")

    ja.main()

    out = capsys.readouterr().out
    assert "not a trading session" in out
    assert "Skipping" in out


def test_the_non_session_guard_can_actually_fail():
    """Negative control: on a real session the guard must NOT fire, or the nightly never runs."""
    from trading_calendar import is_trading_session

    assert is_trading_session(date(2026, 12, 24)) is True   # Thursday, a half day — still a session
    assert is_trading_session(date(2026, 12, 25)) is False  # Christmas — closed
    assert is_trading_session(date(2026, 7, 11)) is False   # the Saturday production stamped
    assert is_trading_session(date(2026, 7, 10)) is True    # the Friday it should have stamped


def _refuse(name: str):
    def boom(*_args, **_kwargs):
        raise AssertionError(
            f"the non-session guard did not fire: main() reached for {name} on a closed market"
        )
    return boom
