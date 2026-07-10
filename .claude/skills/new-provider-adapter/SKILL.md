# new-provider-adapter

**Status:** pre-seeded from the plan (P1 step 2, §6.1, Blueprint Part 4) before any code existed.
Refine on first real use (Alpaca), then treat as minted.

**When to use:** adding ANY data-provider adapter to `pipeline/adapters/` (Alpaca, Finnhub, FMP,
EDGAR, FRED, Marketaux, and any future replacement from the Blueprint §4.2 ladder).

## Steps
1. **Record fixtures first.** One real authenticated call per endpoint via
   `pipeline/scripts/probe_providers.py`; save the raw JSON under
   `pipeline/adapters/fixtures/<provider>/`. Scrub any account identifiers. Tests use ONLY these
   fixtures — never live keys (plan §6.1).
2. **Write the failing tests** (before the adapter): fixture-loaded responses injected via
   `httpx.MockTransport`; the happy path; error/timeout paths (one provider down ⇒ its section
   degrades, the run succeeds); rate-limit behavior (token bucket honors the provider's ceiling —
   Alpaca 200/min, Finnhub 60/min, FRED 2/s, EDGAR ≤8/s with declared User-Agent).
3. **Implement behind the repository interface** in `pipeline/adapters/<provider>.py`,
   subclassing `adapters/base.py` (interface + fixture loader + token-bucket limiter). The
   adapter maps provider JSON to internal types and does NOTHING else — no business logic, no
   indicator math.
4. **Isolate failures.** Every public method wraps provider errors into the adapter's degraded
   status; write the per-source status into `pipeline_run.sourceStatus`. A provider must never
   be able to kill the run (Blueprint §7.3).
5. **Register** the adapter in `pipeline/config.py` and the source-status footer inventory.

## Verification
- `uv run pytest pipeline/tests/test_<provider>.py` green, including the degraded-path test.
- Provider's documented rate limit asserted in a test, not just respected by vibes.
- DECISIONS.md entry if the provider deviates from the Blueprint's documented behavior;
  PATTERNS.md updated if the adapter shape evolved.

## Worked example
(fill in at first use — the Alpaca adapter, P1 step 2, becomes the example)
