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

# How many rows a "latest value" read asks for. More than one, because FRED writes "." on holidays
# and unpublished days, so the newest ROW is not always the newest VALUE.
_LATEST_LIMIT = 10

# How many rows a history read asks for — the Mood gauge's trailing distributions (Part 6.5). It is
# 600 rather than 252 because the tightest component (momentum: the S&P against its own 125-session
# mean) spends its first 125 rows before producing a single score, and then needs 252 of those
# scores to have a distribution to sit in. See scripts/record_fred.py for the arithmetic.
_HISTORY_LIMIT = 600


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

    def latest_value(self, series_id: str, *, units: str | None = None) -> Observation:
        """
        Return the most recent REAL observation of a series.

        FRED marks missing days (holidays, unpublished releases) with a ".", so the newest row is
        not always a number; this asks for the observations newest-first and returns the first one
        that actually has a value. Raises ValueError if the series has no real value at all.
        """
        for observation in self._real_observations(series_id, units=units):
            return observation

        raise ValueError(f"FRED series {series_id} has no real value in the recent window")

    def latest_two(self, series_id: str, *, units: str | None = None) -> list[Observation]:
        """
        Return the two most recent REAL observations of a series, newest first.

        The macro strip needs both: the index level AND the level before it, because a one-day
        change can only be stated honestly by subtracting two real closes. Returns fewer than two
        items when the series has fewer than two real values in the recent window — one value still
        renders the level, and the change renders "—" rather than being borrowed from somewhere else.

        The macro board needs both for the same reason, one cadence up: a mortgage rate against LAST
        WEEK's, a CPI print against LAST MONTH's. The two observations are whatever the series' own
        cadence makes adjacent — this method does not know or care which.
        """
        observations: list[Observation] = []
        for observation in self._real_observations(series_id, units=units):
            observations.append(observation)
            if len(observations) == 2:
                break
        return observations

    def history(
        self, series_id: str, *, limit: int = _HISTORY_LIMIT, units: str | None = None
    ) -> list[Observation]:
        """
        Return a long run of a series' REAL observations, newest first — the Mood gauge's
        distributions (Part 6.5).

        The gauge does not score a component by its value; it scores it by where that value SITS in
        its own trailing year. A VIX of 15.84 is not "calm" in the abstract — it is calm relative to
        the last 252 sessions of VIX, and a percentile is the only honest way to say so. That means
        every FRED-sourced component needs its distribution, not just its latest number.
        """
        return list(self._real_observations(series_id, units=units, limit=limit))

    def _real_observations(
        self, series_id: str, *, units: str | None = None, limit: int = _LATEST_LIMIT
    ):
        """
        Yield a series' observations newest-first, skipping the days FRED marks with a "." (holidays
        and unpublished releases). Every public reader above is a thin wrapper around this.

        `units` is passed straight through to FRED, and exactly one series uses it: CPI is requested
        as `pc1` — the year-over-year percent change, COMPUTED BY FRED. That is deliberate and it is
        an honesty rule, not an optimisation. The moment this pipeline divides one CPI level by
        another, it owns an inflation number of its own making — one that can disagree with the
        headline the reader saw on the news, with no way to explain the difference. We store what
        the source publishes.
        """
        params: dict[str, object] = {
            "series_id": series_id,
            "api_key": os.environ.get("FRED_KEY", ""),
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        }
        if units:
            params["units"] = units

        payload = self.get(_OBSERVATIONS, params=params).json()

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
