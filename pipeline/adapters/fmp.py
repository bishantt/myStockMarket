"""
fmp.py — the Financial Modeling Prep adapter: the earnings calendar (plan P2 step 1).

FMP supplies the forward earnings calendar the Desk's CalendarTimeline shows — which names report
when, with the consensus estimates. It uses the /stable/ API (FMP retired v3 on 2025-08-31 with a
403). The adapter parses the calendar into records and does nothing else.

Note (logged in DECISIONS): FMP's /stable/earnings-calendar returns the report DATE and consensus
(EPS + revenue estimates), but not the before-open / after-close time of day. The plan assumed
bmo/amc timing here; that field is not on this endpoint, so a P2 event carries its date and
consensus, and the bmo/amc split is deferred.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from adapters.base import Adapter

_BASE = "https://financialmodelingprep.com/stable"


@dataclass(frozen=True)
class EarningsEvent:
    """One scheduled earnings report: the symbol, the date, and the consensus estimates (if any)."""

    symbol: str
    date: date
    eps_estimate: float | None
    revenue_estimate: float | None


class FmpAdapter(Adapter):
    """FMP earnings-calendar reader. The API key rides on the query string (no auth header)."""

    def __init__(self, client, limiter, api_key: str) -> None:
        super().__init__("fmp", client, limiter)
        self._key = api_key

    def earnings_calendar(self, start: date, end: date) -> list[EarningsEvent]:
        """The earnings calendar between start and end (inclusive)."""
        payload = self.get(
            f"{_BASE}/earnings-calendar",
            params={"from": start.isoformat(), "to": end.isoformat(), "apikey": self._key},
        ).json()
        return [
            EarningsEvent(
                symbol=row["symbol"],
                date=date.fromisoformat(row["date"]),
                eps_estimate=row.get("epsEstimated"),
                revenue_estimate=row.get("revenueEstimated"),
            )
            for row in payload
        ]
