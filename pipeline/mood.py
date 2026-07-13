"""
mood.py — the Mood gauge: this app's own, transparent fear/greed number (Part 6.5).

WHY WE BUILD OUR OWN, AND WHY IT LOOKS LIKE THIS

There is no legitimate external fear-and-greed source to buy or borrow. CNN publishes no licensed
API (the endpoint everyone scrapes answered our probe with an HTTP 418 and is a bot-blocked internal
chart feed); alternative.me's index is crypto-only by its own methodology; the rest are paywalled,
about to be paywalled, or forbid automated collection. Appendix A.5 records the whole search.

So the gauge is ours. That fact is not a disclaimer to be buried — it is the entire design premise.
A sentiment number you cannot take apart is a number you have to TRUST, and this application does
not ask anyone to trust it. Which is why the display contract (ruling C8) is absolute: **the score
may never render without its component table**, and the app enforces that in the TYPE rather than by
convention, exactly as BaseRate does.

HOW IT IS COMPUTED

Five components, each scored not by its value but by WHERE ITS VALUE SITS in its own trailing year —
a percentile against 252 sessions of its own history. That is the only honest way to say a number is
"high": a VIX of 15.84 means nothing in the abstract, and everything against the year it sits in.

Every percentile is oriented the same way: HIGHER MEANS GREEDIER. Two of the five inputs run the
other way round in nature (a high VIX and a wide credit spread are both FEAR), so they are inverted
on the way in. After that, one direction, one scale, one meaning — and the score is their unweighted
mean. Unweighted because a weight is an opinion, and an opinion is the thing this number is trying
not to have.

THE ARROW IS DERIVED, NEVER STORED. Each component shows whether it is pulling the gauge up or down.
That is read straight off the percentile (above its own median = greedy), and it is a computed
property rather than a field, because a stored arrow is free to disagree with the percentile beside
it — which is ruling C6's disease in miniature, and which the N0 seed had in fact already contracted
(its momentum component sat at the 48th percentile and was labelled "greedy").

WHAT IT IS NOT. It is not a signal. It writes no signal_log row, feeds no setup card, and carries
the standing line "Context, not a signal — no tendency evidence attaches to this number." Nothing in
this app has ever measured what a mood reading of 42 is followed by, so nothing in this app claims it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import polars as pl

# The trailing window every component is scored against: one trading year.
LOOKBACK = 252

# The shortest history that can produce a percentile worth printing.
#
# A percentile against 40 observations is not a percentile, it is an anecdote with a decimal point.
# Below this floor a component reports itself UNAVAILABLE and drops out of the mean — and if enough
# of them drop out, the gauge suppresses itself entirely rather than averaging two lonely inputs
# into a confident-looking number. That is the same N-gate instinct the base rates run on.
MIN_HISTORY = 60

# Fewer than this many components and there is no gauge. Three of five is the floor: a "market mood"
# computed from two inputs is not a mood, it is those two inputs wearing a costume.
MIN_COMPONENTS = 3

# How close to its 252-day extreme a stock has to be to count as "near" it (range position).
NEAR_EXTREME = 0.05

# The S&P's own mean window for the momentum component.
MOMENTUM_WINDOW = 125

# The word bands. Deliberately FLAT — no "extreme", no exclamation, no intensifier anywhere. The
# mechanical voice is doing real work here: "extreme greed" is a phrase that manufactures urgency,
# and urgency is the one thing this product refuses to sell.
BANDS = (
    (24, "fearful"),
    (44, "leaning fearful"),
    (55, "mixed"),
    (75, "leaning greedy"),
    (100, "greedy"),
)


@dataclass(frozen=True)
class Component:
    """
    One input to the gauge, already oriented so that a HIGHER percentile means GREEDIER.

    `value` is tonight's raw reading in its own natural units (a VIX level, a share of the universe)
    and `window` says what that reading measures — because a percentile with no idea what it is a
    percentile OF is not evidence, it is a decimal.
    """

    key: str
    label: str
    value: float
    window: str
    percentile: float

    @property
    def contributes(self) -> str:
        """
        Which way this component is pulling the gauge — derived, never stored.

        Neutral is a component sitting at its OWN median (the 50th percentile of its own history),
        so above that it is pulling toward greed and below it toward fear. Deriving this rather than
        storing it means the arrow can never disagree with the percentile printed beside it.
        """
        return "greedy" if self.percentile >= 0.5 else "fearful"

    def as_dict(self) -> dict:
        """The component as the app receives it (macro_stat.meta). The arrow travels derived."""
        return {
            "key": self.key,
            "label": self.label,
            "value": self.value,
            "window": self.window,
            "percentile": self.percentile,
            "contributes": self.contributes,
        }


@dataclass(frozen=True)
class Mood:
    """A computed gauge: the score, its band word, and the components that produced it."""

    score: int
    band: str
    components: list[Component]

    def as_meta(self) -> dict:
        """The gauge as macro_stat.meta stores it — score, band, and the full breakdown (C8)."""
        return {
            "score": self.score,
            "band": self.band,
            "components": [c.as_dict() for c in self.components],
        }


def percentile_of(value: float, history: Sequence[float], *, invert: bool = False) -> float | None:
    """
    Where `value` sits in its own trailing history, as a fraction from 0 to 1.

    Returns None when the history is too thin to say anything — which is a real answer, and a better
    one than a number computed from six observations.

    `invert` flips the orientation for the components that run backwards in nature: a HIGH VIX and a
    WIDE credit spread are both FEAR, so their percentiles are subtracted from one. After inversion
    every component means the same thing in the same direction, which is what makes an unweighted
    mean of them defensible at all.
    """
    window = list(history)[-LOOKBACK:] if len(history) > LOOKBACK else list(history)
    if len(window) < MIN_HISTORY:
        return None

    at_or_below = sum(1 for observation in window if observation <= value)
    percentile = at_or_below / len(window)
    return 1.0 - percentile if invert else percentile


def compute(components: Sequence[Component]) -> Mood | None:
    """
    The gauge: the unweighted mean of whichever components are available, on a 0–100 scale.

    Returns None when fewer than MIN_COMPONENTS survived. That suppression is not a failure state to
    be apologised for — it is the honest answer to "how does the market feel tonight?" when most of
    the instruments that would tell us are down, and the board says exactly that, naming which ones
    are missing.
    """
    available = list(components)
    if len(available) < MIN_COMPONENTS:
        return None

    mean = sum(c.percentile for c in available) / len(available)
    score = round(mean * 100)
    return Mood(score=score, band=band_for(score), components=available)


def band_for(score: int) -> str:
    """The word for a score. The words are flat on purpose (see BANDS)."""
    for ceiling, word in BANDS:
        if score <= ceiling:
            return word
    return BANDS[-1][1]


# ── the market-side components, computed from the night's own indicator frame ──────────────────


def breadth_series(indicated: pl.DataFrame) -> pl.DataFrame:
    """
    Per-date breadth: the share of the universe trading above its own 50-day average.

    This is the same measure the Desk's breadth line prints, taken across history so that tonight's
    reading has a distribution to sit in. A breadth of 61% is neither high nor low until you know
    what the last year of breadth looked like.
    """
    return (
        indicated.filter(pl.col("sma50").is_not_null())
        .group_by("date")
        .agg((pl.col("close") > pl.col("sma50")).mean().alias("value"))
        .sort("date")
    )


def range_position_series(indicated: pl.DataFrame) -> pl.DataFrame:
    """
    Per-date range position: the share of the universe near its 252-day HIGH, minus the share near
    its 252-day LOW.

    It answers a question price alone cannot: are stocks finishing the year strong, or is the tape
    being held up by a handful of names while everything else sits on its lows? A market can rise
    with this number falling, and that divergence is exactly the sort of thing a mood reading should
    be able to see.
    """
    with_extremes = indicated.sort("symbol", "date").with_columns(
        pl.col("close").rolling_max(window_size=LOOKBACK, min_samples=LOOKBACK).over("symbol").alias("high252"),
        pl.col("close").rolling_min(window_size=LOOKBACK, min_samples=LOOKBACK).over("symbol").alias("low252"),
    )

    return (
        with_extremes.filter(pl.col("high252").is_not_null() & pl.col("low252").is_not_null())
        .with_columns(
            (pl.col("close") >= pl.col("high252") * (1 - NEAR_EXTREME)).alias("near_high"),
            (pl.col("close") <= pl.col("low252") * (1 + NEAR_EXTREME)).alias("near_low"),
        )
        .group_by("date")
        .agg((pl.col("near_high").mean() - pl.col("near_low").mean()).alias("value"))
        .sort("date")
    )


def momentum_series(levels: Sequence[float]) -> list[float]:
    """
    The S&P's distance from its own 125-session mean, per session, oldest first.

    `levels` are the index's closes OLDEST FIRST. The first MOMENTUM_WINDOW sessions produce no
    value at all (there is no mean to compare them against yet), which is why the FRED history read
    asks for 600 rows rather than 252: the tightest component here spends its first 125 rows before
    it can score anything.
    """
    values = list(levels)
    if len(values) < MOMENTUM_WINDOW:
        return []

    out: list[float] = []
    for end in range(MOMENTUM_WINDOW, len(values) + 1):
        window = values[end - MOMENTUM_WINDOW : end]
        mean = sum(window) / MOMENTUM_WINDOW
        out.append(values[end - 1] / mean - 1.0)
    return out
