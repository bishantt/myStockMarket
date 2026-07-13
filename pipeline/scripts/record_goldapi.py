"""
record_goldapi.py — capture a real GoldAPI response as a test fixture.

THE KEY LANDED AND THIS RECORDER HAS BEEN RUN WITH IT (N4, 2026-07-13).

For three phases GoldAPI had no key (provisioning row P-5), so the only real recording this repo
held was the unkeyed rejection — HTTP 403, `{"error": "No API Key provided"}`. That was never a
consolation prize: it pins the two facts the adapter depends on, which are that the route is real
and that the key travels in an `x-access-token` header rather than a query parameter. It is still
checked in, and this recorder still captures it when run without a key.

What it could not pin was the shape of a SUCCESSFUL response, so the adapter was first written
against a fixture derived from GoldAPI's documentation and named `xau_usd_UNVERIFIED.json` — the
filename doing the confessing, per the rule N3 adopted after finding three hand-written FRED
fixtures that did not confess anything.

The key exists now. This recorder ran, GoldAPI answered 200, and `xau_usd.json` is that answer. The
invention is deleted. It had got one real thing wrong: it stamped the quote at midnight UTC, as
though gold arrived as a settled daily observation. It does not — GoldAPI stamps the live quote
instant.

Writes to $MSM_FIXTURES_OUT (default: adapters/fixtures). Not part of the test suite.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

_XAU_USD = "https://www.goldapi.io/api/XAU/USD"


def main() -> None:
    out = Path(os.environ.get("MSM_FIXTURES_OUT", "adapters/fixtures")) / "goldapi"
    out.mkdir(parents=True, exist_ok=True)

    key = os.environ.get("GOLDAPI_KEY", "")
    headers = {"x-access-token": key} if key else {}

    with httpx.Client(timeout=30) as client:
        response = client.get(_XAU_USD, headers=headers)

    # Deliberately NOT raise_for_status: a rejection is a response worth recording. When this repo
    # had no key, the unkeyed 403 was the only real gold evidence it had, and a recorder that threw
    # on it would have left us with no fixture at all and nothing to say about why.
    name = "xau_usd" if response.status_code == 200 else f"error_{response.status_code}"
    (out / f"{name}.json").write_text(json.dumps(response.json(), indent=2))
    print(f"  wrote {name}.json (HTTP {response.status_code}, {len(response.content)} bytes)")

    if response.status_code != 200:
        print(
            "  NOTE: GoldAPI refused this call, so only the error shape was captured. If GOLDAPI_KEY "
            "is set, this means the key is being REJECTED — the success fixture already exists and "
            "must not be replaced with a rejection."
        )


if __name__ == "__main__":
    main()
