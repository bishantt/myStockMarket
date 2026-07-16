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

import re

# The symbols always mirrored into Postgres. The user's watchlist is added to this at run time. These
# fifteen are also the ONLY funds the Movers floor keeps (CC6): the four index ETFs and eleven sector
# SPDRs are the core the reader knows; every other fund is excluded.
CORE_SERVED: tuple[str, ...] = (
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC",
)

# A fund reads its type in its name — Alpaca gives no security-type field, so it filters us_equity only
# and the type lives in the name (adapters/alpaca.py mirrors this at ingest). "Trust" is deliberately
# NOT a marker: too many common stocks carry it (Northern Trust), and the illiquid trusts and
# structured products that slip through ingest fall out on the dollar-volume floor anyway.
_FUND_NAME = re.compile(r"\b(?:etf|etn|fund)\b", re.IGNORECASE)


def classify_asset_class(name: str) -> str:
    """A coarse instrument class for the Movers liquid floor (CC6): "fund" for an ETF/ETN/pooled
    vehicle, "stock" for a common stock. Name-based, because Alpaca classifies every symbol us_equity.
    The floor keeps a name only if it is a "stock" or one of the CORE_SERVED funds."""
    return "fund" if _FUND_NAME.search(name) else "stock"
