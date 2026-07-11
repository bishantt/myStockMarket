"""
record_edgar.py — capture a real SEC EDGAR submissions response as a fixture (new-provider-adapter).

EDGAR requires a declared User-Agent (a real contact) and caps at ~8 req/s. Records Apple's
submissions document (CIK 0000320193) — the per-CIK recent-filings shape the P2 filing catalysts
read. Run via Actions where EDGAR_USER_AGENT exists. Writes to $MSM_FIXTURES_OUT/edgar.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "edgar"
    out.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30) as client:
        response = client.get(
            "https://data.sec.gov/submissions/CIK0000320193.json",
            headers={"User-Agent": os.environ["EDGAR_USER_AGENT"]},
        )
        response.raise_for_status()
        (out / "submissions_aapl.json").write_text(json.dumps(response.json(), indent=2))
        print(f"  wrote submissions_aapl.json ({len(response.content)} bytes)")


if __name__ == "__main__":
    main()
