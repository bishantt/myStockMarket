"""
erapi.py — open.er-api.com, the FALLBACK USD→NPR source (Appendix A.4).

This is a fallback, not a peer, and the difference is not a technicality. Nepal Rastra Bank
publishes the OFFICIAL REFERENCE rate — the number the central bank sets. This publishes a MARKET
MID rate. They are two different measurements of two different things, and they will disagree.

So they are never silently interchanged. Whichever one is on screen, the app names it (ruling C6),
and that is why the quote returned here carries its own `source_key`: the label follows the source
mechanically, rather than a human remembering to change a caption.

Its free tier requires the visible attribution "Rates By Exchange Rate API", linked. That is a
licence condition, and the app renders it whenever this source is the one showing.

No key. Errors, as with NRB, can arrive inside an HTTP 200 — the envelope's `result` field is what
decides, not the status line.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from email.utils import parsedate_to_datetime

from adapters.base import Adapter

_LATEST = "https://open.er-api.com/v6/latest"


@dataclass(frozen=True)
class ErApiQuote:
    """One currency's mid-market rate against USD, dated by the SOURCE's own update stamp."""

    date: date
    currency: str
    rate: float
    source_key: str = "erapi"


class ErApiAdapter(Adapter):
    """The keyless mid-market FX reader used when NRB is unreachable."""

    def __init__(self, client, limiter) -> None:
        super().__init__("erapi", client, limiter)

    def latest(self, currency: str, base: str = "USD") -> ErApiQuote:
        """
        The latest mid-market rate for a currency against `base`.

        The as-of date comes from the source's own `time_last_update_utc` stamp — never from our
        clock. That is the rule the entire macro board is built on: a number is "as of" when its
        source published it, not when we happened to ask for it.
        """
        payload = self.get(f"{_LATEST}/{base}").json()

        if payload.get("result") != "success":
            raise ValueError(
                f"er-api answered without success: result={payload.get('result')!r} "
                f"error={payload.get('error-type')!r}"
            )

        rate = payload.get("rates", {}).get(currency)
        if rate is None:
            raise ValueError(f"er-api quotes no {currency} rate against {base}")

        return ErApiQuote(date=_updated_on(payload), currency=currency, rate=float(rate))


def _updated_on(payload: dict) -> date:
    """
    The date the source says it last updated — parsed from its RFC-2822 stamp.

    Falls back to the unix stamp if the human-readable one is ever missing, and only then to today:
    a rate with no date at all is the one thing this board may not print, so the fallbacks exist to
    keep a real answer rather than to manufacture one.
    """
    stamp = payload.get("time_last_update_utc")
    if stamp:
        return parsedate_to_datetime(stamp).date()

    unix = payload.get("time_last_update_unix")
    if unix:
        return datetime.utcfromtimestamp(int(unix)).date()

    raise ValueError("er-api returned a rate with no update stamp — refusing to date it ourselves")
