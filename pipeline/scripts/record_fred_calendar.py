"""
record_fred_calendar.py — capture FRED release-calendar responses (new-provider-adapter, P2).

Extends the P1 minimal FRED adapter (VIXCLS/DGS10 series) to the full release calendar — the
upcoming economic-release dates the P2 CalendarTimeline shows. Run via Actions where FRED_KEY
exists. Writes to $MSM_FIXTURES_OUT/fred (alongside the P1 series fixtures).
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

import httpx


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "fred"
    out.mkdir(parents=True, exist_ok=True)
    key = os.environ["FRED_KEY"]
    today = date.today()
    with httpx.Client(timeout=30) as client:
        response = client.get(
            "https://api.stlouisfed.org/fred/releases/dates",
            params={
                "api_key": key,
                "file_type": "json",
                "realtime_start": today.isoformat(),
                "realtime_end": (today + timedelta(days=14)).isoformat(),
                "include_release_dates_with_no_data": "true",
                "sort_order": "asc",
                "limit": 40,
            },
        )
        response.raise_for_status()
        (out / "release_dates.json").write_text(json.dumps(response.json(), indent=2))
        print(f"  wrote release_dates.json ({len(response.content)} bytes)")


if __name__ == "__main__":
    main()
