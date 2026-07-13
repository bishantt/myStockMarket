"""
stats.py — the computed-stats table for the briefing (plan P3, Appendix G Stage B input).

Synthesis is told to copy stat values VERBATIM, and the verification gate builds its allowed set of
numbers from these same values, so this module is the single place a number becomes "quotable". A
figure the briefing might mention that is not rendered here cannot pass the gate — which is the
point: the LLM narrates only what the pipeline computed.

Two rendering choices matter:
  - Movers are rendered as UNSIGNED magnitudes with the direction in the label ("SPY 1-day gain",
    "ACME 1-day decline"). The gate checks numbers, not direction words, so a "fell 2.3%" sentence
    must match a source value of 2.3%, not -2.3% — otherwise an honest sentence would be flagged for
    a minus sign the model never wrote. Direction is carried by the label and the source data.
  - Nullable macro figures (VIX, the 10-year yield) are simply omitted when FRED was down, rather
    than rendered as a placeholder the model could quote.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Iterable, Mapping

from briefing.verify import Stat


def build_stats(
    *,
    market_context: Mapping[str, Any] | None,
    movers: Iterable[Mapping[str, Any]],
    calendar: Iterable[Mapping[str, Any]],
    run_date: date,
) -> list[Stat]:
    """Render the night's computed numbers into the stats table.

    `market_context` is the macro strip (vix, ten_year, advancers, decliners, pct_above_50dma), or
    None on a night with none. `movers` carry a symbol and a fractional 1-day return (ret_1) plus
    relative volume (rvol20). `calendar` carries titles, optional consensus/prior, and dates.
    """
    stats: list[Stat] = []
    stats.extend(_macro_stats(market_context))
    stats.extend(_mover_stats(movers))
    stats.extend(_calendar_stats(calendar))
    return stats


def build_ticker_stats(
    symbols: Iterable[str],
    *,
    moves: Mapping[str, Any],
    rvol: Mapping[str, float | None],
) -> list[Stat]:
    """The quotable numbers for the Front Page's narrated stories (plan 7.5).

    The same table, for a different narrator. The front-page notes may cite a linked ticker's 1-day
    move and its relative volume — and nothing else — so those two figures are rendered HERE, through
    the very same function the evening briefing's movers go through. That is the point of putting it
    in this module rather than in the newsdesk: a figure rendered twice, by two functions, is a figure
    that can be rounded two ways, and then the same fact publishes as 3.4% on one surface and 3.44% on
    the other, with both surfaces' gates calling their own version verified.

    `moves` is keyed by symbol and carries a fractional `ret1` (the newsdesk's TickerMove); `rvol` is
    relative volume against the 20-day average. A symbol with neither contributes nothing — an absent
    number must not become a quotable one.
    """
    movers: list[dict] = []
    for symbol in dict.fromkeys(symbols):  # de-duplicated, order preserved
        move = moves.get(symbol)
        ret_1 = getattr(move, "ret1", None) if move is not None else None
        movers.append({"symbol": symbol, "ret_1": ret_1, "rvol20": rvol.get(symbol)})
    return _mover_stats(movers)


def _macro_stats(market_context: Mapping[str, Any] | None) -> list[Stat]:
    if market_context is None:
        return []
    out: list[Stat] = []
    vix = market_context.get("vix")
    if vix is not None:
        out.append(Stat("macro-vix", f"{float(vix):.2f}", label="VIX"))
    ten_year = market_context.get("ten_year")
    if ten_year is not None:
        out.append(Stat("macro-10y", f"{float(ten_year):.2f}%", label="10-year Treasury yield"))
    out.append(Stat("breadth-advancers", str(int(market_context["advancers"])), label="advancing issues"))
    out.append(Stat("breadth-decliners", str(int(market_context["decliners"])), label="declining issues"))
    out.append(
        Stat("breadth-pct50", f"{float(market_context['pct_above_50dma']):.2f}%",
             label="share of the universe above its 50-day average")
    )
    return out


def _mover_stats(movers: Iterable[Mapping[str, Any]]) -> list[Stat]:
    out: list[Stat] = []
    for mover in movers:
        symbol = str(mover["symbol"])
        ret_1 = mover.get("ret_1")
        if ret_1 is not None:
            direction = "gain" if float(ret_1) >= 0 else "decline"
            out.append(
                Stat(f"mover-{symbol}", f"{abs(float(ret_1)) * 100:.2f}%",
                     label=f"{symbol} 1-day {direction}")
            )
        rvol = mover.get("rvol20")
        if rvol is not None:
            out.append(Stat(f"rvol-{symbol}", f"{float(rvol):.1f}", label=f"{symbol} relative volume"))
    return out


def _calendar_stats(calendar: Iterable[Mapping[str, Any]]) -> list[Stat]:
    out: list[Stat] = []
    for index, event in enumerate(calendar):
        title = str(event.get("title", "event"))
        consensus = event.get("consensus")
        if consensus is not None:
            out.append(Stat(f"cal-{index}-consensus", _trim(float(consensus)), label=f"{title} consensus"))
        prior = event.get("prior")
        if prior is not None:
            out.append(Stat(f"cal-{index}-prior", _trim(float(prior)), label=f"{title} prior"))
        event_date = event.get("date")
        if isinstance(event_date, date):
            out.append(Stat(f"cal-{index}-date", event_date.isoformat(), label=f"{title} date"))
    return out


def _trim(value: float) -> str:
    """Render a consensus/prior number without trailing zeros, so "3.2" stays "3.2" not "3.20"."""
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return text or "0"
