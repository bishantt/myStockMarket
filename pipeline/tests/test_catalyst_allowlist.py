"""
Tests for the FRED release allowlist (UI-REDESIGN-PLAN §6.2, Appendix C) — the calendar's gate.

The Session Calendar exists to curate. Before this allowlist the ingest took every FRED release in
the next fourteen days, which is a firehose: Coinbase Cryptocurrencies, Commercial Paper, the Euro
Short Term Rate, daily Treasury quotes. Seven releases actually move a US equity session; those
seven are the vocabulary, and everything else is dropped.

These tests cover both directions. Exclusion alone proves nothing — an allowlist that dropped
everything would pass a noise-only test — so inclusion (a real CPI row and a real jobs report
survive, with the right code and importance) is tested just as hard.
"""

from datetime import date

from adapters.fred import ReleaseDate
from catalyst_allowlist import ALLOWLIST, match_release, select_releases


def _row(release_id: int, name: str, day: int) -> ReleaseDate:
    return ReleaseDate(release_id=release_id, name=name, date=date(2026, 7, day))


# ── matching one name ─────────────────────────────────────────────────────────────────────────

def test_matches_the_seven_allowlisted_releases_by_name():
    assert match_release("Consumer Price Index").code == "CPI"
    assert match_release("Employment Situation").code == "JOBS"
    assert match_release("Producer Price Index").code == "PPI"
    assert match_release("Gross Domestic Product").code == "GDP"
    assert match_release("Personal Income and Outlays").code == "PCE"
    assert match_release("Advance Monthly Sales for Retail and Food Services").code == "RETAIL"
    assert match_release("FOMC Press Release").code == "FOMC"


def test_matching_ignores_case_and_surrounding_whitespace():
    assert match_release("  consumer price index  ").code == "CPI"
    assert match_release("FOMC PRESS RELEASE").code == "FOMC"


def test_drops_the_daily_noise_releases_that_are_not_catalysts():
    # Every one of these appears in the recorded FRED fixture. None of them is a session catalyst.
    for noise in (
        "Coinbase Cryptocurrencies",
        "Commercial Paper",
        "Daily Treasury Inflation-Indexed Securities",
        "Dow Jones Averages",
        "CBOE Market Statistics",
        "H.15 Selected Interest Rates",
        "Standard & Poors",
        "Euro Short Term Rate",
    ):
        assert match_release(noise) is None, f"{noise} must not reach the calendar"


def test_the_allowlist_carries_a_code_kind_and_importance_for_every_entry():
    for entry in ALLOWLIST:
        assert entry.code and entry.display and entry.kind in {"macro", "fed"}
        assert entry.importance in {"high", "medium"}


def test_only_fomc_is_classified_as_a_fed_event():
    assert match_release("FOMC Press Release").kind == "fed"
    assert match_release("Consumer Price Index").kind == "macro"


# ── selecting the calendar's rows ─────────────────────────────────────────────────────────────

def test_selects_allowlisted_rows_and_drops_the_rest():
    rows = [
        _row(441, "Coinbase Cryptocurrencies", 13),
        _row(10, "Consumer Price Index", 14),
        _row(86, "Commercial Paper", 14),
        _row(50, "Employment Situation", 17),
    ]
    selected = select_releases(rows)
    assert [(r.date.day, e.code) for r, e in selected] == [(14, "CPI"), (17, "JOBS")]


def test_collapses_a_release_repeated_on_the_same_date():
    # FRED's calendar can list the same release twice for one date. It is one event.
    rows = [_row(10, "Consumer Price Index", 14), _row(10, "Consumer Price Index", 14)]
    assert len(select_releases(rows)) == 1


def test_keeps_the_same_release_on_genuinely_different_dates():
    # Three FOMC press releases around a meeting are three real dates, not a duplicate.
    rows = [_row(101, "FOMC Press Release", 15), _row(101, "FOMC Press Release", 16)]
    assert [r.date.day for r, _ in select_releases(rows)] == [15, 16]


def test_an_all_noise_window_selects_nothing():
    # The honest empty calendar — the product's quiet-stretch state, not a failure.
    rows = [_row(441, "Coinbase Cryptocurrencies", 13), _row(200, "CBOE Market Statistics", 14)]
    assert select_releases(rows) == []
