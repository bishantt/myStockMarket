"""
record_fred.py — capture real FRED responses as test fixtures (plan §6.1, new-provider-adapter).

Records the two series the P1 macro module needs — VIXCLS (the VIX) and DGS10 (the 10-year
Treasury yield) — as recorded observation responses, so the adapter tests never touch a live key.
Run once via GitHub Actions where FRED_KEY exists; the output is uploaded as an artifact.

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _record(client: httpx.Client, series_id: str, out: Path) -> None:
    response = client.get(
        _BASE,
        params={
            "series_id": series_id,
            "api_key": os.environ["FRED_KEY"],
            "file_type": "json",
            "sort_order": "desc",
            "limit": 10,  # the most recent observations — enough to capture the shape and a value
        },
    )
    response.raise_for_status()
    (out / f"{series_id.lower()}.json").write_text(json.dumps(response.json(), indent=2))
    print(f"  wrote {series_id.lower()}.json ({len(response.content)} bytes)")


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "fred"
    out.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30) as client:
        _record(client, "VIXCLS", out)
        _record(client, "DGS10", out)


if __name__ == "__main__":
    main()
