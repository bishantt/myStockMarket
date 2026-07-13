"""
record_news.py — capture real responses from the two news providers, for N4's Front Page.

WHY THIS EXISTS AT ALL, GIVEN BOTH PROVIDERS ALREADY HAVE FIXTURES.

The repo holds real recordings of Finnhub's COMPANY news (`/company-news?symbol=AAPL`) and of
Marketaux's `news/all` called with a `symbols=` filter. Neither is the call N4 makes. The Front Page
is not "news about the movers" — it is the day's market-wide catalysts, which is a DIFFERENT
ENDPOINT on Finnhub (`/news?category=general`) and a different question asked of Marketaux
(everything US-listed and entity-tagged, sorted by publication time, no symbol list at all).

An endpoint nobody has called is an endpoint nobody has seen. Writing a parser against a fixture
"shaped like" the company-news one, because the provider is the same company, is exactly how this
project ended up with three hand-written FRED fixtures that spent three phases certifying the parser
against an invention. So: record first, parse second. Every field N4 reads — Finnhub's `image`,
`source` and `category`; Marketaux's `image_url`, `description`, per-entity `industry` and
`match_score`, and the `similar` list the clusterer uses as a free hint — is read out of a response
the provider actually sent.

What gets recorded:
  finnhub/news_general.json    — the market-wide feed, page 1
  finnhub/news_general_p2.json — page 2, fetched with `minId` (the pagination N4's budget assumes)
  finnhub/news_merger.json     — the M&A category
  marketaux/news_market.json   — the market-wide tagged feed, called with N4's exact parameters

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_FINNHUB_NEWS = "https://finnhub.io/api/v1/news"
_MARKETAUX_NEWS = "https://api.marketaux.com/v1/news/all"


def _write(out: Path, name: str, payload: object, note: str = "") -> None:
    path = out / f"{name}.json"
    path.write_text(json.dumps(payload, indent=2))
    size = len(payload) if isinstance(payload, list) else len(payload.get("data", []))
    print(f"  wrote {path.name} ({size} items){note}")


def record_finnhub(client: httpx.Client, root: Path, key: str) -> None:
    """
    Finnhub's market-wide news, both categories N4 ingests, plus the second page.

    The `minId` pagination is recorded rather than assumed: N4's ingest budget spends a second call
    on it, and a budget built on a pagination parameter nobody has exercised is a budget built on a
    guess.
    """
    out = root / "finnhub"
    out.mkdir(parents=True, exist_ok=True)

    general = client.get(_FINNHUB_NEWS, params={"category": "general", "token": key})
    general.raise_for_status()
    page1 = general.json()
    _write(out, "news_general", page1)

    # WHAT `minId` ACTUALLY DOES — measured, because the plan's ingest budget assumed the opposite.
    #
    # The budget said "2 calls, the second with minId pagination, ~100-200 items". The first
    # recording killed that: asking with a minId BELOW the oldest id we held returned the identical
    # 100 articles, byte for byte. So minId is a "newer than this" filter, not a page cursor — the
    # endpoint hands back the newest ~100 and there is no way to reach further back.
    #
    # This second recording proves the direction rather than leaving it as my inference: minId set to
    # a MID-RANGE id must return only the items newer than it, i.e. strictly fewer than 100. If it
    # ever comes back with 100 again, the reading above is wrong and the budget must be rethought.
    if page1:
        ids = sorted(item["id"] for item in page1)
        midpoint = ids[len(ids) // 2]
        probe = client.get(
            _FINNHUB_NEWS, params={"category": "general", "minId": midpoint, "token": key}
        )
        probe.raise_for_status()
        body = probe.json()
        _write(out, "news_general_minid", body, f" [minId={midpoint} — the forward-only probe]")
        print(
            f"    minId probe: asked for ids above {midpoint} (the median of page 1) and got "
            f"{len(body)} items. Fewer than 100 means minId filters FORWARD and cannot page back."
        )

    merger = client.get(_FINNHUB_NEWS, params={"category": "merger", "token": key})
    merger.raise_for_status()
    _write(out, "news_merger", merger.json())


def record_marketaux(client: httpx.Client, root: Path, token: str) -> None:
    """
    Marketaux's market-wide tagged feed, called with N4's exact parameters (plan Part 7.3).

    The free tier returns THREE articles per request, which is why N4's budget spends up to 20 calls
    here. One call is recorded — the shape is what the parser needs, and burning 20 of the day's 100
    requests to record 20 copies of the same shape would be a waste of the budget the pipeline needs
    tonight.
    """
    out = root / "marketaux"
    out.mkdir(parents=True, exist_ok=True)

    response = client.get(
        _MARKETAUX_NEWS,
        params={
            "countries": "us",
            "filter_entities": "true",
            "must_have_entities": "true",
            "sort": "published_on",
            "language": "en",
            "api_token": token,
        },
    )
    response.raise_for_status()
    _write(out, "news_market", response.json())


def main() -> None:
    root = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures"))

    finnhub_key = os.environ.get("FINNHUB_KEY", "")
    marketaux_key = os.environ.get("MARKETAUX_KEY", "")

    with httpx.Client(timeout=30) as client:
        if finnhub_key:
            print("Finnhub — market news (general, general p2, merger):")
            record_finnhub(client, root, finnhub_key)
        else:
            print("SKIPPED Finnhub: no FINNHUB_KEY in the environment.")

        if marketaux_key:
            print("Marketaux — market-wide tagged news (N4's parameters):")
            record_marketaux(client, root, marketaux_key)
        else:
            print("SKIPPED Marketaux: no MARKETAUX_KEY in the environment.")


if __name__ == "__main__":
    main()
