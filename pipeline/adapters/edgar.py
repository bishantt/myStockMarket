"""
edgar.py — the SEC EDGAR adapter: per-company recent filings (plan P2 step 1).

EDGAR is the primary-source catalyst: 8-Ks, 10-Qs, and Form 4s straight from the SEC, no vendor in
between. SEC requires a declared User-Agent naming a real contact (or it 403s / rate-limits), and
caps at ~8 requests/second — both honoured here. The adapter parses the submissions document's
parallel-array "recent filings" block into records and does nothing else.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from adapters.base import Adapter

_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"


@dataclass(frozen=True)
class Filing:
    """One SEC filing: its form type (8-K, 10-Q, 4, ...), when it was filed, and how to reach it."""

    form: str
    filing_date: date
    accession: str
    primary_document: str
    description: str


class EdgarAdapter(Adapter):
    """EDGAR submissions reader. The declared User-Agent is sent on every request (SEC requires it)."""

    def __init__(self, client, limiter, user_agent: str) -> None:
        super().__init__("edgar", client, limiter)
        self._user_agent = user_agent

    def recent_filings(self, cik: int | str) -> list[Filing]:
        """
        A company's recent filings, newest first (as SEC returns them).

        The submissions document stores "recent" filings as PARALLEL ARRAYS — form[i], filingDate[i],
        accessionNumber[i] all describe the same filing — so they are zipped back into records here.
        The CIK is zero-padded to ten digits, the form the submissions URL requires.
        """
        payload = self.get(
            _SUBMISSIONS.format(cik=int(cik)),
            headers={"User-Agent": self._user_agent},
        ).json()
        recent = payload["filings"]["recent"]
        return [
            Filing(
                form=recent["form"][i],
                filing_date=date.fromisoformat(recent["filingDate"][i]),
                accession=recent["accessionNumber"][i],
                primary_document=recent["primaryDocument"][i],
                description=recent["primaryDocDescription"][i] if i < len(recent.get("primaryDocDescription", [])) else "",
            )
            for i in range(len(recent["form"]))
        ]
