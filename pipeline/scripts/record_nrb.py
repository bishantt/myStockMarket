"""
record_nrb.py — capture real Nepal Rastra Bank responses as test fixtures (new-provider-adapter).

NRB's forex API is the central bank's own public developer endpoint: no key, no signup. So unlike
every other recorder here, this one runs on a laptop — it needs nothing from GitHub's secrets.

Two responses are recorded, because the adapter has to survive both:

  rates.json  — a real Friday→Monday window. It is chosen deliberately: NRB publishes a rate every
                CALENDAR day, and the weekend rows simply repeat Friday's fix. A fixture spanning a
                weekend is the only kind that proves the parser picks the LATEST published day
                rather than the last row in the list, and that it does not mistake a repeated
                weekend rate for a fresh Monday one.
  empty.json   — a window with no published rates at all. The API answers 200 with an empty payload
                rather than an error, which is exactly the shape most likely to be mis-read as
                "rate = 0" by a careless parser. The adapter must return nothing and let the cell
                degrade honestly (ruling C7).

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_BASE = "https://www.nrb.org.np/api/forex/v1/rates"

# All four parameters are required — NRB answers a structured 400 if any is omitted.
_WINDOW = {"page": 1, "per_page": 5, "from": "2026-07-10", "to": "2026-07-13"}

# A window far enough ahead that no rate has been published for it. The API returns 200 with an
# empty payload list — the "the source answered, and had nothing" case.
_EMPTY_WINDOW = {"page": 1, "per_page": 5, "from": "2026-12-01", "to": "2026-12-02"}


def _record(client: httpx.Client, params: dict, out: Path, name: str) -> None:
    response = client.get(_BASE, params=params)
    response.raise_for_status()
    (out / f"{name}.json").write_text(json.dumps(response.json(), indent=2))
    print(f"  wrote {name}.json ({len(response.content)} bytes)")


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "nrb"
    out.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30) as client:
        _record(client, _WINDOW, out, "rates")
        _record(client, _EMPTY_WINDOW, out, "empty")


if __name__ == "__main__":
    main()
