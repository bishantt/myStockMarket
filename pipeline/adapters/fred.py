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
_RELEASE_DATES = "https://api.stlouisfed.org/fred/releases/dates"


@dataclass(frozen=True)
class Observation:
    """One data point of a FRED series."""

    date: date
    value: float


@dataclass(frozen=True)
class ReleaseDate:
    """One scheduled economic-data release: which release, and the date it publishes."""

    release_id: int
    name: str
    date: date


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
        for observation in self._real_observations(series_id):
            return observation

        raise ValueError(f"FRED series {series_id} has no real value in the recent window")

    def latest_two(self, series_id: str) -> list[Observation]:
        """
        Return the two most recent REAL observations of a series, newest first.

        The macro strip needs both: the index level AND the level before it, because a one-day
        change can only be stated honestly by subtracting two real closes. Returns fewer than two
        items when the series has fewer than two real values in the recent window — one value still
        renders the level, and the change renders "—" rather than being borrowed from somewhere else.
        """
        observations: list[Observation] = []
        for observation in self._real_observations(series_id):
            observations.append(observation)
            if len(observations) == 2:
                break
        return observations

    def _real_observations(self, series_id: str):
        """
        Yield a series' observations newest-first, skipping the days FRED marks with a "." (holidays
        and unpublished releases). Both public readers above are thin wrappers around this.
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
                yield Observation(date=date.fromisoformat(observation["date"]), value=float(raw))

    def release_calendar(self, start: date, end: date) -> list[ReleaseDate]:
        """
        The economic-release calendar between start and end — which releases (FOMC statements, CPI,
        payrolls, ...) publish when. This is the P2 extension of the P1 minimal series adapter, and
        it feeds the Desk's CalendarTimeline. Ordered soonest-first as FRED returns.
        """
        payload = self.get(
            _RELEASE_DATES,
            params={
                "api_key": os.environ.get("FRED_KEY", ""),
                "file_type": "json",
                "realtime_start": start.isoformat(),
                "realtime_end": end.isoformat(),
                # "false" is load-bearing (redesign §6.2): asking for release dates with no data
                # repeats every release on every date in the window and is what turned the Session
                # Calendar into a firehose. The allowlist curates what remains; this stops the noise
                # at the source.
                "include_release_dates_with_no_data": "false",
                "sort_order": "asc",
                "limit": 100,
            },
        ).json()
        return [
            ReleaseDate(
                release_id=item["release_id"],
                name=item.get("release_name", ""),
                date=date.fromisoformat(item["date"]),
            )
            for item in payload.get("release_dates", [])
        ]
