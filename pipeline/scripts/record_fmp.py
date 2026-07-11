"""
record_fmp.py — capture real FMP earnings-calendar responses as fixtures (new-provider-adapter).

FMP retired the v3 API (2025-08-31, HTTP 403); this uses /stable/. Records the earnings calendar
over a two-week window — the bmo/amc timing the P2 CalendarTimeline needs. Run via Actions where
FMP_KEY exists. Writes to $MSM_FIXTURES_OUT/fmp.
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

import httpx

_BASE = "https://financialmodelingprep.com/stable"


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "fmp"
    out.mkdir(parents=True, exist_ok=True)
    key = os.environ["FMP_KEY"]
    today = date.today()
    with httpx.Client(timeout=30) as client:
        response = client.get(
            f"{_BASE}/earnings-calendar",
            params={"from": today.isoformat(), "to": (today + timedelta(days=14)).isoformat(), "apikey": key},
        )
        response.raise_for_status()
        (out / "earnings_calendar.json").write_text(json.dumps(response.json(), indent=2))
        print(f"  wrote earnings_calendar.json ({len(response.content)} bytes)")


if __name__ == "__main__":
    main()
