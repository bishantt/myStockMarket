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


# ----- PD7: the depth registry (Part 9.2) -----
#
# THE RENDERED VALUE IS THE GATE'S SOURCE OF TRUTH, and PD7 is where that stopped being a detail.
# `verify.py` parses each value into the allowed set, so the numbers a value CONTAINS are exactly the
# numbers the narrator is licensed to write. For a scalar stat ("18.20") that is invisible. For these
# it is not, because of the WINDOW.
#
# A narrator describing a 52-week range writes the words "52-week" — and "52" is a number. Unless it
# traces to a source, the gate flags an honest sentence for the very window it was asked to describe.
# The same trap sits in "50-day average" and "the last 7 sessions". So each value STATES ITS WINDOW,
# in the words the narrator will use, and the window is licensed through the ordinary mechanism
# rather than by a special case carved into the gate. A stat that describes a window is a stat that
# must say the window out loud.

def build_depth_stats(depths: Iterable[Any]) -> list[Stat]:
    """Render the per-ticker depth measures into quotable stats (Part 9.2).

    A name with nothing measurable renders NOTHING — not an empty stat, not a zero. A stat with no
    number is vocabulary that says nothing and can only mislead the narrator into reaching for it.
    """
    out: list[Stat] = []
    for depth in depths:
        symbol = depth.symbol

        if depth.pos52w is not None:
            position = depth.pos52w
            out.append(
                Stat(
                    f"tkr:{symbol}:pos52w",
                    f"{position.pct:.1f}% of the way up its 52-week range "
                    f"(low {position.low:.2f}, high {position.high:.2f})",
                    label=f"{symbol} position in its 52-week range",
                )
            )

        if depth.move_atr is not None:
            # UNSIGNED, like the movers, and for the movers' reason: the gate checks numbers, not
            # direction words. Direction rides the label and the data.
            out.append(
                Stat(
                    f"tkr:{symbol}:move_atr",
                    f"{depth.move_atr:.1f}x its normal daily range (ATR14)",
                    label=f"{symbol} move in units of its own average daily range",
                )
            )

        if depth.streak is not None:
            streak = depth.streak
            out.append(
                Stat(
                    f"tkr:{symbol}:streak",
                    f"{streak.length} consecutive {streak.direction} sessions",
                    label=f"{symbol} closing streak through tonight",
                )
            )

        if depth.from50d is not None:
            direction = "above" if depth.from50d >= 0 else "below"
            out.append(
                Stat(
                    f"tkr:{symbol}:from50d",
                    f"{abs(depth.from50d):.1f}% {direction} its 50-day average",
                    label=f"{symbol} distance from its 50-day average",
                )
            )
    return out


def build_cluster_stats(cluster_id: str, *, sources: int, history7d: int | None) -> list[Stat]:
    """The story's own two numbers: how many outlets carried it, and how often this name has been in
    the news lately. Corroboration is evidence; recurrence is context. Neither was citable before.

    `history7d` is None when the count is unknown, and then no stat is emitted — the narrator cannot
    say "the third story this week" about a name whose week nobody counted.
    """
    out = [
        Stat(
            f"cls:{cluster_id}:corroboration",
            f"{int(sources)} outlets",
            label="distinct outlets carrying this story",
        )
    ]
    if history7d is not None:
        out.append(
            Stat(
                f"cls:{cluster_id}:history7d",
                f"{int(history7d)} stories on this name in the last 7 sessions",
                label="how often this name has been in the news this week",
            )
        )
    return out


def build_calendar_stats(refs: Iterable[Any]) -> list[Stat]:
    """The dated facts the watch section may point at. The VALUE is the date and nothing else, so the
    gate matches it exactly (dates are never approximate); the event's NAME rides the label, where
    the narrator can read it and the gate ignores it."""
    return [
        Stat(ref.stat_id, ref.date.isoformat(), label=f"{ref.key} next scheduled event: {ref.title}")
        for ref in refs
    ]


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
