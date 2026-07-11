"""
alpaca.py — the Alpaca adapter: daily bars and the tradable universe (plan P1 step 2).

Alpaca is the source of end-of-day prices for the whole market and of the symbol universe itself.
This adapter parses its two response shapes into plain records the pipeline stores; it never
decides policy beyond the one universe rule it owns (no OTC). It follows the shape defined by
adapters/base.Adapter — every request is rate-limited and raises on failure — so a bad night
degrades this one source rather than failing the run.

The two hosts are deliberate: market data comes from data.alpaca.markets, while the asset listing
is a trading-API call served from paper-api.alpaca.markets (our paper key authenticates there,
not against the live host).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from adapters.base import Adapter

_DATA = "https://data.alpaca.markets"
_TRADING = "https://paper-api.alpaca.markets"


@dataclass(frozen=True)
class Bar:
    """One daily OHLCV bar for a symbol. Prices are split/dividend-adjusted (adjustment=all)."""

    symbol: str
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(frozen=True)
class Asset:
    """One tradable instrument in the universe."""

    symbol: str
    name: str
    exchange: str


class AlpacaAdapter(Adapter):
    """Alpaca EOD bars + universe. Construct with an httpx client and a rate limiter (base class)."""

    def __init__(self, client, limiter) -> None:
        super().__init__("alpaca", client, limiter)

    def daily_bars(
        self, symbols: list[str], start: date, end: date
    ) -> dict[str, list[Bar]]:
        """
        Fetch daily bars for many symbols between start and end (inclusive), following pagination.

        Returns a dict of symbol -> its bars in date order. `adjustment=all` gives split- and
        dividend-adjusted prices, which is what indicator math and forward returns need.
        """
        params = {
            "symbols": ",".join(symbols),
            "timeframe": "1Day",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "adjustment": "all",
            "limit": 10000,
        }

        result: dict[str, list[Bar]] = {symbol: [] for symbol in symbols}
        page_token: str | None = None
        while True:
            page_params = dict(params)
            if page_token:
                page_params["page_token"] = page_token
            payload = self.get(f"{_DATA}/v2/stocks/bars", params=page_params).json()

            for symbol, raw_bars in (payload.get("bars") or {}).items():
                result.setdefault(symbol, [])
                for raw in raw_bars:
                    result[symbol].append(_parse_bar(symbol, raw))

            page_token = payload.get("next_page_token")
            if not page_token:
                break

        return result

    def list_universe(self) -> list[Asset]:
        """
        The tradable universe: active US equities and ETFs, excluding OTC (plan Appendix F).

        Alpaca's asset list includes non-tradable listings and OTC names; both are filtered out
        here. "no OTC" is the one hard universe rule, and it is enforced at ingest so an OTC symbol
        never enters the instrument table. ETFs list on ARCA/BATS, which is why exchange is not
        constrained to NYSE/Nasdaq/AMEX — only OTC is excluded.
        """
        assets = self.get(
            f"{_TRADING}/v2/assets",
            params={"status": "active", "asset_class": "us_equity"},
        ).json()

        universe: list[Asset] = []
        for raw in assets:
            if raw.get("status") != "active" or not raw.get("tradable"):
                continue
            if raw.get("exchange") == "OTC":
                continue
            universe.append(
                Asset(symbol=raw["symbol"], name=raw["name"], exchange=raw["exchange"])
            )
        return universe


def _parse_bar(symbol: str, raw: dict) -> Bar:
    """
    Turn one raw Alpaca bar into a Bar.

    The `t` field is an ISO instant like "2026-06-01T04:00:00Z" — midnight ET expressed in UTC.
    Its date portion is the trading day, so slicing the first ten characters gives the right day
    without any timezone arithmetic (04:00/05:00 UTC is the same calendar date as midnight ET).
    """
    return Bar(
        symbol=symbol,
        date=date.fromisoformat(raw["t"][:10]),
        open=raw["o"],
        high=raw["h"],
        low=raw["l"],
        close=raw["c"],
        volume=raw["v"],
    )
