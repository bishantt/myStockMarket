"""
record_marketaux.py — capture real Marketaux news responses as fixtures (new-provider-adapter).

Marketaux is the market-wide catalyst source: tagged news snippets with per-entity sentiment.
Records a small multi-symbol news pull. Run via Actions where MARKETAUX_KEY exists. Writes to
$MSM_FIXTURES_OUT/marketaux.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "marketaux"
    out.mkdir(parents=True, exist_ok=True)
    key = os.environ["MARKETAUX_KEY"]
    with httpx.Client(timeout=30) as client:
        response = client.get(
            "https://api.marketaux.com/v1/news/all",
            params={"symbols": "AAPL,MSFT,TSLA", "filter_entities": "true", "language": "en", "limit": 3, "api_token": key},
        )
        response.raise_for_status()
        (out / "news_all.json").write_text(json.dumps(response.json(), indent=2))
        print(f"  wrote news_all.json ({len(response.content)} bytes)")


if __name__ == "__main__":
    main()
