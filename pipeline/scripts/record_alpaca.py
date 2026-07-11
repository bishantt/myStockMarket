"""
record_alpaca.py — capture real Alpaca responses as test fixtures (plan §6.1).

Adapter tests replay recorded JSON so they never need a live key. This script makes those
recordings from the real API — run once via GitHub Actions where ALPACA_KEY_ID / ALPACA_SECRET
exist, and the output is uploaded as an artifact and committed to adapters/fixtures/alpaca/.

It records the two shapes the P1 Alpaca adapter parses:
  bars.json    a small multi-symbol daily-bars response (the exact envelope, keys, pagination)
  assets.json  a slice of the tradable-asset listing (the exchange codes and status fields)

It writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Nothing here runs in the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_DATA = "https://data.alpaca.markets"
_TRADING = "https://api.alpaca.markets"


def _auth() -> dict[str, str]:
    key = os.environ["ALPACA_KEY_ID"]
    secret = os.environ["ALPACA_SECRET"]
    return {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "alpaca"
    out.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers=_auth(), timeout=30) as client:
        # A handful of daily bars for a few symbols — enough to capture the envelope shape,
        # the per-symbol arrays, and whether next_page_token appears.
        bars = client.get(
            f"{_DATA}/v2/stocks/bars",
            params={
                "symbols": "AAPL,MSFT,SPY",
                "timeframe": "1Day",
                "start": "2026-06-01",
                "end": "2026-06-05",
                "adjustment": "all",
                "limit": 100,
            },
        )
        bars.raise_for_status()
        (out / "bars.json").write_text(json.dumps(bars.json(), indent=2))
        print(f"  wrote bars.json ({len(bars.content)} bytes)")

        # A slice of the active US-equity universe — captures the exchange codes and the
        # status/tradable/class fields the universe filter depends on.
        assets = client.get(
            f"{_TRADING}/v2/assets",
            params={"status": "active", "asset_class": "us_equity"},
        )
        assets.raise_for_status()
        full = assets.json()
        # Keep a representative sample (a few from each exchange) so the fixture stays small but
        # still exercises the exchange filter. Include known names for deterministic tests.
        wanted = {"AAPL", "MSFT", "SPY", "F", "T", "GE"}
        sample = [a for a in full if a.get("symbol") in wanted]
        # Plus the first few of whatever else, to capture other exchange codes / OTC if present.
        sample += full[:8]
        # De-dup by symbol, preserve order.
        seen = set()
        deduped = []
        for a in sample:
            s = a.get("symbol")
            if s not in seen:
                seen.add(s)
                deduped.append(a)
        (out / "assets.json").write_text(json.dumps(deduped, indent=2))
        print(f"  wrote assets.json ({len(deduped)} assets from {len(full)} total)")


if __name__ == "__main__":
    main()
