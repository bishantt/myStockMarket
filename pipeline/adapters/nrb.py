"""
nrb.py — Nepal Rastra Bank's official forex rates (NEWS-AND-CONTROL-PLAN Part 6.2.4, Appendix A.4).

Nepal's central bank publishes its own reference rates through a documented public API — no key, no
signup. It is the right source for the USD→NPR cell precisely because of what it IS: the official
reference, published by the institution that sets it. It is NOT what a remittance app will quote,
and the board says so on-surface ("Remittance apps may differ."), because we quote no remittance
app: none of them exposes a legitimate public rate API, and inventing one would be exactly the lie
this product exists to avoid.

TWO THINGS THE REAL RESPONSES TAUGHT US, both of which a hand-written fixture would have hidden:

1. **Errors arrive in the BODY, not in the HTTP status.** Ask for a window with nothing published
   and NRB answers HTTP 200 — `raise_for_status()` waves it through — carrying an envelope that
   says `status.code: 400` and an empty payload. So this adapter never treats a 2xx as a success on
   its own; it looks for the data and raises when there is none.

2. **The payload is ascending: the newest day is LAST.** Reading `payload[0]` would have served
   Friday's rate on a Monday — a wrong number that looks perfectly plausible, which is the worst
   kind of wrong number there is. Every read here is a max-by-date.

The `unit` field is load-bearing too. NRB quotes some currencies per 100 units (the Indian rupee is
one), so a raw `buy` is not a rate until it is divided by its unit. USD happens to be unit=1, which
means a USD-only parser would be right by luck and wrong the moment anyone added a second currency.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from adapters.base import Adapter

_RATES = "https://www.nrb.org.np/api/forex/v1/rates"


@dataclass(frozen=True)
class NrbRate:
    """One currency's official buy and sell rate for one published day, normalised to ONE unit."""

    date: date
    currency: str
    buy: float
    sell: float
    source_key: str = "nrb"


class NrbAdapter(Adapter):
    """Nepal Rastra Bank's forex reader. No key; be polite with the limiter anyway."""

    def __init__(self, client, limiter) -> None:
        super().__init__("nrb", client, limiter)

    def latest_rate(self, currency: str, start: date, end: date) -> NrbRate:
        """
        The most recently PUBLISHED rate for a currency inside a date window.

        NRB publishes every calendar day — weekend rows simply repeat the fix set on the preceding
        business afternoon — so a window that ends today always has a newest day, and that day is
        what the cell shows.

        Raises ValueError when the source published nothing usable: an empty window, or a currency
        it does not quote. That is deliberately an exception rather than a None, because the caller
        must make a decision about it (keep the last stored value, mark the source degraded), and a
        None is far too easy to let slide into a rate of zero.
        """
        payload = self.get(
            _RATES,
            # All four parameters are required — omitting any one earns a structured 400.
            params={
                "page": 1,
                "per_page": 5,
                "from": start.isoformat(),
                "to": end.isoformat(),
            },
        ).json()

        best: NrbRate | None = None
        for day in payload.get("data", {}).get("payload", []):
            published = date.fromisoformat(day["date"])
            if best is not None and published <= best.date:
                continue
            rate = _rate_for(day, currency, published)
            if rate is not None:
                best = rate

        if best is None:
            # The envelope's own status code goes into the message: on the empty-window response it
            # says 400 while the HTTP status says 200, and a log line that names both is what stops
            # the next person losing an afternoon to it.
            envelope = payload.get("status", {}).get("code")
            raise ValueError(
                f"NRB published no {currency} rate between {start} and {end} "
                f"(envelope status {envelope})"
            )
        return best


def _rate_for(day: dict, currency: str, published: date) -> NrbRate | None:
    """Pull one currency out of a published day, normalised from its quoted unit to a single unit."""
    for row in day.get("rates", []):
        info = row.get("currency", {})
        if info.get("iso3") != currency:
            continue
        # Quoted per `unit` of the foreign currency — 100 for the Indian rupee, 1 for the dollar.
        # The rates arrive as STRINGS; float() is where they become numbers.
        unit = float(info.get("unit", 1)) or 1.0
        return NrbRate(
            date=published,
            currency=currency,
            buy=float(row["buy"]) / unit,
            sell=float(row["sell"]) / unit,
        )
    return None
