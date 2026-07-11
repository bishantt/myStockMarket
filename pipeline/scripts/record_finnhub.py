"""
record_finnhub.py — capture real Finnhub responses as fixtures (new-provider-adapter skill).

Records the two shapes the P2 catalyst layer needs: company news (the per-ticker catalyst source)
and basic financial metrics. Run once via Actions where FINNHUB_KEY exists; output is uploaded as
an artifact. Writes to $MSM_FIXTURES_OUT/finnhub. Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

import httpx

_BASE = "https://finnhub.io/api/v1"


def _write(out: Path, name: str, payload) -> None:
    (out / f"{name}.json").write_text(json.dumps(payload, indent=2))
    print(f"  wrote {name}.json")


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "finnhub"
    out.mkdir(parents=True, exist_ok=True)
    key = os.environ["FINNHUB_KEY"]
    today = date.today()
    with httpx.Client(timeout=30) as client:
        news = client.get(
            f"{_BASE}/company-news",
            params={"symbol": "AAPL", "from": (today - timedelta(days=14)).isoformat(), "to": today.isoformat(), "token": key},
        )
        news.raise_for_status()
        _write(out, "company_news_aapl", news.json())

        metric = client.get(f"{_BASE}/stock/metric", params={"symbol": "AAPL", "metric": "all", "token": key})
        metric.raise_for_status()
        _write(out, "metric_aapl", metric.json())


if __name__ == "__main__":
    main()
