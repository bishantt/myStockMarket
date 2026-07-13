"""
goldapi.py — the gold price (goldapi.io; NEWS-AND-CONTROL-PLAN Part 6.2.3, Appendix A.3).

Gold turned out to be the hardest of the five board cells to source honestly, and the search is
recorded in the plan so nobody repeats it: FRED carries no market gold price any more (the LBMA/IBA
series were deleted in January 2022), LBMA itself is behind an IBA licence, metals-api has no free
tier, and Stooq's keyless CSV died in early 2026. What remains that is both free and legitimate is
GoldAPI, and it is what this adapter reads.

THE LABEL IS PART OF THE CONTRACT. This number renders as an "indicative spot reference · GoldAPI"
and NEVER as an "LBMA price" or a "COMEX settlement". Those are licensed benchmarks with precise
meanings that this app has not bought and cannot verify, and borrowing their authority for a
different number is exactly the species of lie ruling C6 exists to stop.

THE FIXTURES ARE REAL NOW (N4, 2026-07-13). The key (P-5) landed, the recorder ran, and GoldAPI
answered: `xau_usd.json` is that answer and `error_403.json` is what an unkeyed caller still gets.
The documentation-derived fixture this adapter was first written against — `xau_usd_UNVERIFIED.json`,
named so its own filename confessed — has been deleted.

IT WAS WRONG ABOUT SOMETHING REAL, AND THE PARSER BELOW DEPENDS ON THE DIFFERENCE. The invented
fixture stamped the quote at exactly midnight UTC, which is what a settled daily observation looks
like — CPI, the mortgage rate, every other cell on this board. GoldAPI does not publish settled
observations. It stamps the LIVE QUOTE INSTANT, the moment it answers the call. So this cell's
"as of" date is the date we ASKED on, not the date a session closed, and that is precisely why it is
labeled an indicative spot reference rather than a close.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from adapters.base import Adapter

_BASE = "https://www.goldapi.io/api"


@dataclass(frozen=True)
class GoldQuote:
    """Gold's spot reference in a currency, with the previous close beside it for the 1-day change."""

    date: date
    price: float
    prior: float | None
    currency: str = "USD"
    source_key: str = "goldapi"


class GoldApiAdapter(Adapter):
    """
    GoldAPI's spot reader. Construct with the key; without one, do not construct it at all.

    The job checks for the key and simply does not build this adapter when it is absent — which is
    why there is no "no key" branch in here. An adapter that quietly returned nothing when
    unconfigured would let a missing secret look exactly like a missing price, and those are two
    different facts that the board tells the reader apart (rung 4 vs rung 3).
    """

    def __init__(self, client, limiter, *, api_key: str) -> None:
        super().__init__("goldapi", client, limiter)
        self._api_key = api_key

    def spot(self, metal: str = "XAU", currency: str = "USD") -> GoldQuote:
        """
        The current spot reference for one troy ounce.

        The as-of date comes from the provider's own timestamp, in UTC — never from our clock. Same
        rule as every other cell on this board: a number is "as of" when its source published it.
        """
        payload = self.get(
            f"{_BASE}/{metal}/{currency}",
            headers={"x-access-token": self._api_key},
        ).json()

        price = payload.get("price")
        if price is None:
            raise ValueError(f"GoldAPI returned no price for {metal}/{currency}")

        # `prev_close_price` is what makes an honest 1-day change possible. If it is absent the
        # price still renders and the change renders "—" — never borrowed from the open, which is a
        # different number answering a different question.
        prior = payload.get("prev_close_price")

        return GoldQuote(
            date=_quoted_on(payload),
            price=float(price),
            prior=float(prior) if prior is not None else None,
            currency=currency,
        )


def _quoted_on(payload: dict) -> date:
    """The date the provider stamped the quote with. No stamp, no date, no cell — we do not guess."""
    timestamp = payload.get("timestamp")
    if timestamp is None:
        raise ValueError("GoldAPI returned a price with no timestamp — refusing to date it ourselves")
    return datetime.fromtimestamp(int(timestamp), tz=UTC).date()
