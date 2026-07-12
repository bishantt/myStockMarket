"""
universe.py — which symbols the product serves out of Postgres.

The full price history lives in the Parquet lake; only a slice of it is mirrored into the serving
database the app reads. That slice is this core — the four index ETFs and the eleven sector SPDRs —
plus whatever the user has put on their watchlist at run time.

This lived inside jobs/job_a.py until the redesign's calendar work (§6.2) needed it too: the
earnings-importance rule asks whether a reporting company is one the product actually serves. A
constant two modules depend on belongs to neither of them, so it lives here.
"""

from __future__ import annotations

# The symbols always mirrored into Postgres. The user's watchlist is added to this at run time.
CORE_SERVED: tuple[str, ...] = (
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
)
