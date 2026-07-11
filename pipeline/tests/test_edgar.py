"""Tests for the EDGAR adapter (plan P2 step 1), from a recorded fixture — the User-Agent matters."""

from datetime import date

import httpx

from adapters.base import load_fixture
from adapters.edgar import EdgarAdapter

UA = "myStockMarket bishantripathi@gmail.com"


class NullLimiter:
    def acquire(self) -> None: ...


def _adapter(handler) -> EdgarAdapter:
    return EdgarAdapter(httpx.Client(transport=httpx.MockTransport(handler)), NullLimiter(), UA)


def test_parses_recent_filings_from_the_parallel_arrays():
    adapter = _adapter(lambda r: httpx.Response(200, json=load_fixture("edgar", "submissions_aapl")))
    filings = adapter.recent_filings(320193)
    assert len(filings) > 0
    first = filings[0]
    assert first.form
    assert isinstance(first.filing_date, date)
    assert first.accession


def test_sends_the_declared_user_agent_and_zero_pads_the_cik():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ua"] = request.headers.get("User-Agent")
        seen["url"] = str(request.url)
        return httpx.Response(200, json={"filings": {"recent": {"form": [], "filingDate": [], "accessionNumber": [], "primaryDocument": [], "primaryDocDescription": []}}})

    _adapter(handler).recent_filings(320193)
    assert seen["ua"] == UA  # SEC requires a real declared contact
    assert "CIK0000320193.json" in seen["url"]  # zero-padded to ten digits
