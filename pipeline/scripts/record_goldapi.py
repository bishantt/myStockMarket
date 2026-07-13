"""
record_goldapi.py — capture a real GoldAPI response as a test fixture.

READ THIS BEFORE TRUSTING THE GOLD FIXTURE.

GoldAPI needs a key (provisioning row P-5) and that key does not exist yet. So this recorder has
been RUN, and what it recorded is the honest thing to record: the real, verified response the API
gives an unkeyed caller — HTTP 403, `{"error": "No API Key provided"}`. That fixture is not a
consolation prize. It pins the two facts the adapter actually depends on today: the route is real
and reachable, and the key travels in an `x-access-token` header rather than a query parameter.

What it does NOT pin is the shape of a SUCCESSFUL response. `xau_usd.json` is therefore written
from GoldAPI's published documentation and is marked UNVERIFIED in the adapter's tests, because a
fixture nobody recorded is a guess wearing a recording's clothes — and the whole point of this
project's fixture discipline is that the tests are arguing with a real provider, not with me.

The consequence is deliberate and visible rather than hidden: until the key lands, the gold cell
renders its honest "not yet reported" state (degradation rung 4). When P-5 arrives, run this
recorder WITH the key, overwrite xau_usd.json with the real thing, and delete the UNVERIFIED
marker — the test that reads it will start arguing with GoldAPI instead of with its documentation.

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

    # Deliberately NOT raise_for_status: the unkeyed 403 is a response worth recording, and it is
    # the one this repo has. A recorder that threw on it would leave us with no fixture at all and
    # nothing to say about why.
    name = "xau_usd" if response.status_code == 200 else f"error_{response.status_code}"
    (out / f"{name}.json").write_text(json.dumps(response.json(), indent=2))
    print(f"  wrote {name}.json (HTTP {response.status_code}, {len(response.content)} bytes)")

    if response.status_code != 200:
        print(
            "  NOTE: no GOLDAPI_KEY, so only the error shape is real. The success fixture "
            "(xau_usd.json) stays documentation-derived and UNVERIFIED until P-5 lands."
        )


if __name__ == "__main__":
    main()
