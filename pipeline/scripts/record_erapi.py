"""
record_erapi.py — capture a real open.er-api.com response as a test fixture.

This is the FALLBACK source for USD→NPR, used only when Nepal Rastra Bank is unreachable. It is a
different measurement from NRB's — a market mid-rate rather than the central bank's official
reference — which is precisely why the app's label always names which one is on screen (ruling C6).
The two must never be silently swapped for one another.

Its free tier requires a visible attribution link ("Rates By Exchange Rate API"). That is a licence
condition, not a courtesy, and it is rendered whenever this source is the one showing.

No key, so this records from a laptop.

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_LATEST = "https://open.er-api.com/v6/latest/USD"


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "erapi"
    out.mkdir(parents=True, exist_ok=True)
    with httpx.Client(timeout=30) as client:
        response = client.get(_LATEST)
        response.raise_for_status()
        (out / "latest_usd.json").write_text(json.dumps(response.json(), indent=2))
        print(f"  wrote latest_usd.json ({len(response.content)} bytes)")


if __name__ == "__main__":
    main()
