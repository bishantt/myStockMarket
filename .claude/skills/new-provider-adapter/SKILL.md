# new-provider-adapter

**Status:** MINTED — refined at first real use (Alpaca, P1 step 2, 2026-07-11). Follow it literally.

**When to use:** adding ANY data-provider adapter to `pipeline/adapters/` (Alpaca, Finnhub, FMP,
EDGAR, FRED, Marketaux, and any future replacement from the Blueprint §4.2 ladder).

## Steps
1. **Record REAL fixtures first.** Write `pipeline/scripts/record_<provider>.py` (one call per
   endpoint, writing raw JSON to `$MSM_FIXTURES_OUT/<provider>/`). If the provider needs no key,
   run it from the laptop. If it does, the key lives only in GitHub secrets, so record from Actions:
   `gh workflow run record-fixtures.yml` (checked in, `workflow_dispatch`, uploads the output as an
   artifact), then `gh run download` and commit the files under
   `pipeline/adapters/fixtures/<provider>/`. Add the new recorder to that workflow's steps.
   Fixtures are REAL responses — the exact keys, envelope, pagination, and enum-ish codes matter
   (Alpaca's exchange codes revealed the universe modelling; NRB's error-in-the-body revealed that a
   2xx is not a success; see below).

   **NEVER hand-write a fixture that looks recorded.** This rule is in capitals because the repo
   broke it: R0 wrote three FRED fixtures by hand, in the shape of a real response with plausible
   numbers, and for three phases every test built on them proved that the parser agreed with an
   invention (N3 found it: the fake claimed 8,000 observations where the series has 2,610). **A
   fabricated fixture is not a weak test, it is an INVERTED one** — it certifies the code against a
   fiction and hands you a green tick for it.
   - If a real success response is genuinely out of reach (no key yet), **record the real FAILURE**.
     GoldAPI's unkeyed `403 {"error": "No API Key provided"}` is a real recording and it pins two
     facts: the route is live, and the key travels in an `x-access-token` header.
   - A fixture you had to write from documentation must carry **`_UNVERIFIED` in its filename**
     (`xau_usd_UNVERIFIED.json`), and the test that reads it must say what it can and cannot prove.
     Nobody — including you, six weeks later — can then mistake it for evidence.
2. **Write the failing tests** (before the adapter), driven by the fixtures via
   `httpx.MockTransport` serving `load_fixture("<provider>", "<name>")`: the happy path per
   endpoint; the date/parse edges; **pagination** (a two-page mock, stop on null token); the
   universe/filter rules; and a missing-route test so the harness fails loudly. Rate-limit
   behaviour is covered once in `test_rate_limiter.py` — reuse a `NullLimiter` in adapter tests.
   Provider ceilings for the `TokenBucket`: Alpaca 200/min, Finnhub 60/min, FRED 2/s, EDGAR ≤8/s.
3. **Implement in `pipeline/adapters/<provider>.py`**, subclassing `adapters.base.Adapter`
   (`super().__init__("<provider>", client, limiter)`), calling `self.get(url, params=, headers=)`
   which rate-limits and raises on non-2xx. Parse provider JSON into frozen dataclasses and do
   NOTHING else — no indicator math, no business logic. Watch for multiple hosts (Alpaca: data vs
   paper-api) and paper-vs-live auth.
4. **Isolate failures.** `self.get` raises on error; the JOB (not the adapter) catches per source
   and writes the per-source status into `pipeline_run.sourceStatus`. A provider must never kill
   the run.
5. **Register** the adapter where the job constructs it, and in the source-status inventory.

## Verification
- `uv run pytest pipeline/tests/test_<provider>.py` green, incl. pagination + filter + missing-route.
- Fixtures are real (recorded), not hand-written.
- DECISIONS.md entry if the provider's real shape deviates from the plan (e.g. Alpaca exchange
  codes → universe modelling); LESSONS.md if a real-shape surprise cost time.

## Worked example — Alpaca (P1 step 2, 2026-07-11)
- Recorder: `scripts/record_alpaca.py` → `bars.json` (data.alpaca.markets/v2/stocks/bars, the
  `{"bars": {SYM: [{t,o,h,l,c,v}]}, "next_page_token"}` envelope) and `assets.json`
  (paper-api.alpaca.markets/v2/assets — the paper key 401s on the live host).
- Adapter: `adapters/alpaca.py` — `daily_bars(symbols, start, end)` (adjustment=all, follows
  `next_page_token`, date = `t[:10]` = the trading day, no tz math) and `list_universe()`
  (keep active + tradable + `exchange != "OTC"`; ETFs like SPY are ARCA-listed, so exchange is a
  free string not an NYSE/Nasdaq/AMEX enum — schema corrected, logged 2026-07-11).
- Tests: `tests/test_alpaca.py`, 7 cases, all against the two fixtures. `NullLimiter` for rate.
