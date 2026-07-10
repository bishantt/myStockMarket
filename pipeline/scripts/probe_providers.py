"""
probe_providers.py — one authenticated smoke call per external service (plan §1.4, P0 step 8).

This is the tool that verifies the Session-0 provider keys. Run it once the secrets are in place:

    uv run python -m scripts.probe_providers

For each service it makes the smallest real authenticated request and reports OK, FAIL, or SKIP:
  OK    the credential works.
  FAIL  the credential is present but the call did not succeed — investigate, then fall back per
        the Blueprint §4.2 ladder if needed.
  SKIP  the credential is not configured yet (progressive Session-0 provisioning).

It exits non-zero if anything FAILED, so a green run is a clear signal that every key is live. A
service that is merely SKIP does not fail the run — you may not have provisioned it yet.

No key is ever printed. Errors are truncated and never echo the credential.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Callable

import httpx

from config import Settings, load_settings

_TIMEOUT = 20.0


@dataclass
class Result:
    name: str
    status: str  # "OK" | "FAIL" | "SKIP"
    detail: str


def _http_probe(name: str, request: Callable[[httpx.Client], httpx.Response]) -> Result:
    """Run one HTTP probe, turning any outcome into a Result rather than an exception."""
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = request(client)
        if response.is_success:
            return Result(name, "OK", f"HTTP {response.status_code}")
        return Result(name, "FAIL", f"HTTP {response.status_code}")
    except httpx.HTTPError as exc:
        return Result(name, "FAIL", type(exc).__name__)


def probe_alpaca(s: Settings) -> Result:
    if not (s.alpaca_key_id and s.alpaca_secret):
        return Result("Alpaca", "SKIP", "ALPACA_KEY_ID / ALPACA_SECRET not set")
    return _http_probe(
        "Alpaca",
        lambda c: c.get(
            "https://paper-api.alpaca.markets/v2/account",
            headers={
                "APCA-API-KEY-ID": s.alpaca_key_id or "",
                "APCA-API-SECRET-KEY": s.alpaca_secret or "",
            },
        ),
    )


def probe_finnhub(s: Settings) -> Result:
    if not s.finnhub_key:
        return Result("Finnhub", "SKIP", "FINNHUB_KEY not set")
    return _http_probe(
        "Finnhub",
        lambda c: c.get("https://finnhub.io/api/v1/quote", params={"symbol": "AAPL", "token": s.finnhub_key}),
    )


def probe_fmp(s: Settings) -> Result:
    if not s.fmp_key:
        return Result("FMP", "SKIP", "FMP_KEY not set")
    return _http_probe(
        "FMP",
        lambda c: c.get("https://financialmodelingprep.com/api/v3/profile/AAPL", params={"apikey": s.fmp_key}),
    )


def probe_marketaux(s: Settings) -> Result:
    if not s.marketaux_key:
        return Result("Marketaux", "SKIP", "MARKETAUX_KEY not set")
    return _http_probe(
        "Marketaux",
        lambda c: c.get(
            "https://api.marketaux.com/v1/news/all",
            params={"symbols": "AAPL", "api_token": s.marketaux_key, "limit": 1},
        ),
    )


def probe_fred(s: Settings) -> Result:
    if not s.fred_key:
        return Result("FRED", "SKIP", "FRED_KEY not set")
    return _http_probe(
        "FRED",
        lambda c: c.get(
            "https://api.stlouisfed.org/fred/series",
            params={"series_id": "GDP", "api_key": s.fred_key, "file_type": "json"},
        ),
    )


def probe_edgar(s: Settings) -> Result:
    if not s.edgar_user_agent:
        return Result("EDGAR", "SKIP", "EDGAR_USER_AGENT not set")
    # The SEC requires a real contact in the User-Agent; a request without it is refused. This
    # both confirms reachability and that our declared agent is accepted.
    return _http_probe(
        "EDGAR",
        lambda c: c.get(
            "https://data.sec.gov/submissions/CIK0000320193.json",
            headers={"User-Agent": s.edgar_user_agent or ""},
        ),
    )


def probe_anthropic(s: Settings) -> Result:
    if not s.anthropic_api_key:
        return Result("Anthropic", "SKIP", "ANTHROPIC_API_KEY not set")
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=s.anthropic_api_key)
        message = client.messages.create(
            model=s.model_extract,
            max_tokens=10,
            messages=[{"role": "user", "content": "Reply with the single word: ok"}],
        )
        return Result("Anthropic", "OK", f"model {message.model}")
    except Exception as exc:  # the SDK raises a variety of types; any of them means not-OK
        return Result("Anthropic", "FAIL", type(exc).__name__)


def probe_r2(s: Settings) -> Result:
    if not (s.r2_account_id and s.r2_access_key_id and s.r2_secret):
        return Result("R2", "SKIP", "R2 credentials not set")
    try:
        import boto3

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=s.r2_access_key_id,
            aws_secret_access_key=s.r2_secret,
            region_name="auto",
        )
        key = "probe/roundtrip.txt"
        client.put_object(Bucket=s.r2_bucket, Key=key, Body=b"ok")
        body = client.get_object(Bucket=s.r2_bucket, Key=key)["Body"].read()
        client.delete_object(Bucket=s.r2_bucket, Key=key)
        return Result("R2", "OK" if body == b"ok" else "FAIL", "put/get/delete")
    except Exception as exc:
        return Result("R2", "FAIL", type(exc).__name__)


def probe_healthchecks(s: Settings) -> Result:
    # The read-only API key lets us confirm the check exists without access to the user's inbox.
    if not s.healthchecks_api_key:
        return Result("healthchecks", "SKIP", "HEALTHCHECKS_API_KEY not set")
    return _http_probe(
        "healthchecks",
        lambda c: c.get("https://healthchecks.io/api/v3/checks/", headers={"X-Api-Key": s.healthchecks_api_key or ""}),
    )


PROBES: list[Callable[[Settings], Result]] = [
    probe_alpaca,
    probe_finnhub,
    probe_fmp,
    probe_marketaux,
    probe_fred,
    probe_edgar,
    probe_anthropic,
    probe_r2,
    probe_healthchecks,
]


def main() -> int:
    settings = load_settings()
    results = [probe(settings) for probe in PROBES]

    print("Session-0 provider probes (plan §1.4):\n")
    for r in results:
        mark = {"OK": "✓", "FAIL": "✗", "SKIP": "–"}[r.status]
        print(f"  {mark} {r.name:14s} {r.status:5s} {r.detail}")

    failed = [r for r in results if r.status == "FAIL"]
    skipped = [r for r in results if r.status == "SKIP"]
    print(f"\n{len(results) - len(failed) - len(skipped)} OK · {len(failed)} FAIL · {len(skipped)} not yet configured")

    # Only a real FAIL is a non-zero exit. A SKIP means "not provisioned yet", which is expected
    # while Session-0 secrets are still trickling in.
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
