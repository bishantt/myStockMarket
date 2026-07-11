"""
fred.py — the minimal FRED adapter for the macro strip (plan P1 step 6, pulled forward from P2).

At P1 this reads exactly two series for the Desk's macro module: VIXCLS (the VIX) and DGS10 (the
10-year Treasury yield). It is deliberately small — the full FRED adapter (the economic release
calendar, more series) lands in P2 on this same base. Attribution is a licence condition and is
rendered in the app (copy key attribution.fred); this module only fetches the numbers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date

from adapters.base import Adapter

_OBSERVATIONS = "https://api.stlouisfed.org/fred/series/observations"


@dataclass(frozen=True)
class Observation:
    """One data point of a FRED series."""

    date: date
    value: float


class FredAdapter(Adapter):
    """FRED series reader. Construct with an httpx client and a rate limiter (FRED caps at 2/s)."""

    def __init__(self, client, limiter) -> None:
        super().__init__("fred", client, limiter)

    def latest_value(self, series_id: str) -> Observation:
        """
        Return the most recent REAL observation of a series.

        FRED marks missing days (holidays, unpublished releases) with a ".", so the newest row is
        not always a number; this asks for the observations newest-first and returns the first one
        that actually has a value. Raises ValueError if the series has no real value at all.
        """
        payload = self.get(
            _OBSERVATIONS,
            params={
                "series_id": series_id,
                "api_key": os.environ.get("FRED_KEY", ""),
                "file_type": "json",
                "sort_order": "desc",
                "limit": 10,
            },
        ).json()

        for observation in payload.get("observations", []):
            raw = observation.get("value")
            if raw and raw != ".":
                return Observation(date=date.fromisoformat(observation["date"]), value=float(raw))

        raise ValueError(f"FRED series {series_id} has no real value in the recent window")
