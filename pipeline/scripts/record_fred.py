"""
record_fred.py — capture real FRED responses as test fixtures (plan §6.1, new-provider-adapter).

Run via GitHub Actions, where FRED_KEY exists; the output is uploaded as an artifact and committed.

WHAT IS RECORDED, AND WHY EACH SHAPE MATTERS

1. The macro-strip series (P1 + N1): VIXCLS, DGS10, and the three index levels. Ten recent
   observations each — enough to carry a value and the value before it.

2. The macro-board series (N3): the 30-year mortgage rate, CPI year-over-year, and the high-yield
   credit spread. Two of them are recorded because their CADENCE is the entire point:

     MORTGAGE30US is WEEKLY. Its newest observation is a Thursday, and on a Tuesday that Thursday
       rate is not stale — it is the newest thing that exists. The fixture is what proves the
       parser reads the SOURCE's date instead of stamping the row with our fetch date.
     CPIAUCNS is MONTHLY, and it is fetched with `units=pc1` — the year-over-year percent change
       COMPUTED BY FRED. We store what the source publishes and compute nothing: the moment this
       app divides one CPI level by another it owns an inflation figure that may not match the
       headline the reader saw on the news, with no way to explain the difference.

3. The Mood gauge's HISTORY (N3). Three of the gauge's five components are percentiles of a FRED
   series against its own trailing year, so the gauge needs more than a latest value — it needs the
   distribution that value sits in. Those are recorded at a longer limit, under a `_history` name,
   so the tests can score a real percentile against a real distribution rather than a toy one.

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_BASE = "https://api.stlouisfed.org/fred/series/observations"

# The most recent observations — enough to capture the shape, a value, and the value before it.
_LATEST_LIMIT = 10

# The trailing window the Mood gauge scores against, plus real headroom.
#
# 252 sessions is one trading year, and the gauge's percentiles are defined against exactly that.
# But one component needs considerably more than 252 rows to produce 252 SCORES: momentum is the
# S&P's distance from its own 125-session mean, so the first 125 rows buy no momentum value at all,
# and a percentile over 252 of them needs 377 sessions before it can even be computed. Add the "."
# rows FRED writes on holidays (skipped, so they cost rows without paying any) and a limit of 420
# lands at ~276 usable momentum values — enough, with 24 to spare.
#
# 24 spare is not a margin, it is a coincidence waiting to become a bug on a quiet holiday week. So
# the window is 600, which leaves the tightest component ~445 values against the 252 it needs.
_HISTORY_LIMIT = 600


def _record(
    client: httpx.Client,
    series_id: str,
    out: Path,
    *,
    limit: int = _LATEST_LIMIT,
    name: str | None = None,
    units: str | None = None,
) -> None:
    params: dict[str, object] = {
        "series_id": series_id,
        "api_key": os.environ["FRED_KEY"],
        "file_type": "json",
        "sort_order": "desc",
        "limit": limit,
    }
    if units:
        params["units"] = units

    response = client.get(_BASE, params=params)
    response.raise_for_status()

    filename = f"{name or series_id.lower()}.json"
    (out / filename).write_text(json.dumps(response.json(), indent=2))
    print(f"  wrote {filename} ({len(response.content)} bytes)")


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "fred"
    out.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=30) as client:
        # The macro strip: the two context cells and the three index levels.
        for series in ("VIXCLS", "DGS10", "SP500", "NASDAQCOM", "DJIA"):
            _record(client, series, out)

        # The macro board.
        _record(client, "MORTGAGE30US", out)
        _record(client, "CPIAUCNS", out, units="pc1", name="cpiaucns_pc1")
        _record(client, "BAMLH0A0HYM2", out)

        # The Mood gauge's trailing distributions.
        for series in ("VIXCLS", "SP500", "BAMLH0A0HYM2"):
            _record(client, series, out, limit=_HISTORY_LIMIT, name=f"{series.lower()}_history")


if __name__ == "__main__":
    main()
