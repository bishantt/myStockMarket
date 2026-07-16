"""
rank.py — what leads the Front Page, and why (plan Appendix E; ruling C1).

THIS FILE IS THE ANSWER TO "WILL YOUR NEWS SECTION DRIFT INTO A TRENDING FEED?"

It cannot, and the reason is structural rather than disciplinary. The order of the page is a fixed
arithmetic formula (significance v2, plan 4.5) over four measured factors, all of them properties of
the EVENT — what CLASS of thing happened, how many independent newsrooms judged it worth printing,
how big the NAMED ENTITY is, and how fresh it is. It is a PRODUCT, not a sum: each factor gates the
others, so a corroborated macro print leads, a single-outlet macro event outranks a micro-cap PR on
entity weight, and a hard event outranks an opinion at equal corroboration. There is no term for
popularity, no term for engagement, no term for what the reader clicked last time, and — the deepest
guard — no behavioral signal is INGESTED anywhere in this system, so there is nothing for such a term
to be built from even by accident.

The weights are module constants. Changing one is a structural change to what the app claims its
front page is, and it goes through DECISIONS.md like any other.

The language model never sees a rank and never sets one. It writes prose about clusters this file
has already ordered.

ON catalyst_weight, THE ONE FACTOR THAT LOOKS LIKE AN OPINION: it is a prior about the CLASS of event,
not about the instance — an FDA approval reprices a company more often than an analyst note does, and
that is a fact about how markets work, not a view about today. It is stated on the surface (the room's
header sentence explains the ordering), and it is the only place in the formula where the app's own
judgment appears at all.

WHAT V2 DROPPED, AND WHY. v1 (the N-phase) summed five weighted terms, two of them a `scope` term
(ticker count) and a price-`magnitude` term. v2 replaces scope with entity_weight — a mega-cap or an
index outranks a micro-cap PR at equal catalyst, which ticker-count could not see — and drops
magnitude from the order entirely: the front page ranks NEWSWORTHINESS, not who moved most (R5), and
"movers need a catalyst" is the Movers module's rule, not this one. magnitude is still COMPUTED and
kept on the row as diagnostic evidence; it simply no longer sets the order.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ── The four factors of significance v2 (plan 4.5, Appendix E) ────────────────────────────────
# score = catalyst_weight × corroboration × entity_weight × freshness. Every factor is in [0, 1], so
# the product is too, and a maximal story scores exactly 1.0 (the test asserts it). No weights sum to
# one here — a product needs none — but each factor's own ceiling is 1.0, which is what keeps it bounded.

# catalyst_weight — hard events outrank commentary (Appendix E, verbatim). This is the factor that
# keeps a single-name analyst blog off the lead: M&A/FDA/macro/Fed are 1.0, an analyst note is 0.4.
CATALYST_WEIGHT: dict[str, float] = {
    "ma": 1.0,
    "fda": 1.0,
    "macro": 1.0,
    "fed": 1.0,
    "earnings": 0.8,
    "guidance": 0.8,
    "filing": 0.6,
    "legal": 0.6,
    "analyst": 0.4,
    "product": 0.3,
    "other": 0.3,
}

# Corroboration saturates at five independent outlets: the difference between one newsroom and three
# is enormous, and the difference between eight and ten is nothing. As a MULTIPLICATIVE factor it does
# real work — the ~3 corroborated clusters a night rise above the single-outlet pack, which then sorts
# among itself by catalyst × entity × freshness. That is the editorial order the plan asked for.
CORROBORATION_CEILING = 5

# entity_weight — the dollar-volume bucket (reuse `_DV_WINDOW`/scans.py's large/mid split; do NOT
# invent a second liquidity notion). A market-wide event reaches the whole tape, so it takes the max;
# a single-name story is worth its LARGEST linked name; an unknown or sub-$5 name is not a big liquid
# name, so a micro-cap PR trying to look like news scores half.
ENTITY_MARKET_WIDE = 1.0  # a macro/Fed event — its entity is the whole tape
ENTITY_LARGE_MID = 1.0    # a name in the top-N by dollar volume (large/mid)
ENTITY_SMALL = 0.5        # a small, sub-$5, unknown, or no-listing name

# A macro or Fed event is about the whole market, not a company, so its entity is the market itself —
# this is what carries "Iran closes the Strait of Hormuz" to the lead over a merger we hold no ticker
# for. It is the ONE place entity_weight reads the event class, and it is faithful to Appendix E,
# which labels both market-wide clusters as macro.
_MARKET_WIDE_EVENTS = frozenset({"macro", "fed"})

# freshness — today's news leads, yesterday's is halved, older barely holds on. Ties at equal
# significance break NEWEST-first at the sort site (ingest.py), amending v1's oldest-first tie.
FRESHNESS_SAME_SESSION = 1.0
FRESHNESS_PRIOR_SESSION = 0.5
FRESHNESS_OLDER = 0.25

# A move is measured in units of the ticker's OWN volatility, not in percent. A 3% day is enormous
# for a utility and a quiet Tuesday for a biotech. Capped at 3 ATRs, because past that the number
# stops discriminating. Retained as diagnostic evidence on each row (magnitude_for) — NOT a v2 factor.
MAGNITUDE_ATR_CAP = 3.0

# The deterministic event classifier. Stage A (the language model) refines an event_type for the
# clusters it reaches; the ~70 clusters a night that fall past its cap still need one, and calling
# them all "other" would systematically demote every real acquisition that arrived beyond the cap.
#
# Evidence first: Finnhub's own `merger` category is a fact about where the article was filed, and it
# is worth more than any keyword. Keywords answer the rest, matched on word boundaries.
_EVENT_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ma", ("acquire", "acquires", "acquisition", "merger", "merges", "takeover", "buyout",
            "to buy", "bid for", "business combination", "tender offer", "divestiture")),
    ("fda", ("fda", "approval", "phase 3", "phase iii", "clinical trial", "drug", "therapy")),
    ("fed", ("federal reserve", "fed", "fomc", "rate cut", "rate hike", "interest rates",
             "powell", "central bank")),
    # Macro is the widest class and the one that leads the page, so its vocabulary has to cover what
    # actually moves markets — which is not only data releases.
    #
    # THIS LIST WAS EXTENDED BECAUSE THE FIRST DRAFT BURIED THE BIGGEST STORY OF THE RECORDED NIGHT.
    # "Iran's IRGC navy says Strait of Hormuz closed until further notice" matched NOTHING, was
    # classified "other", and sank to the bottom of the page at 0.165 — below a story about India's
    # negotiating posture, which led the page because it contained the words "trade talks". A war
    # shutting the world's most important oil chokepoint is a macro event by any reading, and a
    # classifier that cannot see that is not fit to order a front page.
    ("macro", ("inflation", "cpi", "jobs report", "payrolls", "gdp", "unemployment", "tariff",
               "tariffs", "trade talks", "sanctions", "oil", "oil prices", "crude", "opec",
               "recession", "jobless claims", "treasury yields", "yields", "dollar",
               "strait", "hormuz", "war", "strikes", "attacks", "conflict", "military",
               "embargo", "shipping", "geopolitical", "ceasefire", "missile")),
    ("earnings", ("earnings", "quarterly results", "beats", "misses", "revenue", "profit",
                  "eps", "reports q")),
    ("guidance", ("guidance", "outlook", "forecast", "raises view", "cuts view", "warns")),
    ("analyst", ("upgrade", "downgrade", "price target", "initiated coverage", "analyst")),
    ("legal", ("lawsuit", "antitrust", "settlement", "investigation", "court", "sues", "fined")),
    ("filing", ("8-k", "10-k", "10-q", "sec filing", "prospectus", "s-1")),
    ("product", ("launches", "unveils", "product", "partnership", "contract award")),
)

_EVENT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (
        event,
        re.compile(r"(?<![\w])(?:" + "|".join(re.escape(w) for w in words) + r")(?![\w])", re.I),
    )
    for event, words in _EVENT_KEYWORDS
)


@dataclass(frozen=True)
class TickerMove:
    """One linked ticker's price evidence at publish time — the magnitude term's raw material."""

    symbol: str
    ret1: float | None      # the 1-day return, as a fraction (0.082 = +8.2%)
    atr14_pct: float | None  # ATR14 as a fraction of price — the ticker's OWN normal daily range


def classify_event(category: str, headline: str, summary: str = "") -> str:
    """
    What KIND of thing happened, from evidence alone.

    The provider's own `merger` category is trusted first: it says where the newsroom filed the
    article, which is a fact rather than a guess. Otherwise the headline and summary are matched
    against the keyword table, most-consequential class first, so an acquisition that also mentions
    earnings is an acquisition.

    Falls back to "other", which carries the lowest prior — an honest "we do not know what this is"
    rather than a flattering guess.
    """
    if (category or "").strip().lower() == "merger":
        return "ma"

    text = f"{headline} {summary}"
    for event, pattern in _EVENT_PATTERNS:
        if pattern.search(text):
            return event
    return "other"


def entity_weight_for(
    tickers: tuple[str, ...] | list[str],
    buckets: dict[str, str | None],
    event_type: str,
) -> float:
    """
    How big is the entity this story is about, by dollar-volume bucket?

    A macro or Fed event is about the whole tape, so it takes the max — that is why "Iran closes the
    Strait of Hormuz" leads over a merger whose ticker we hold no listing for. Every other story is
    about specific companies: it is worth its LARGEST linked name (a cluster naming Apple and a
    micro-cap is an Apple story), and a name we cannot size — no listing, delisted, or sub-$5 —
    scores small rather than borrowing the market's weight.
    """
    if event_type in _MARKET_WIDE_EVENTS:
        return ENTITY_MARKET_WIDE
    if not tickers:
        return ENTITY_SMALL
    return max(
        ENTITY_LARGE_MID if buckets.get(symbol) == "large_mid" else ENTITY_SMALL
        for symbol in tickers
    )


def corroboration_for(sources: int) -> float:
    """Independent outlets, saturating at five. `sources` has already collapsed the press wires."""
    return min(max(sources, 0), CORROBORATION_CEILING) / CORROBORATION_CEILING


def magnitude_for(moves: list[TickerMove]) -> float:
    """
    How big a move does this story explain, in units of the tickers' own volatility?

    Zero when nothing is linked — which is the honest answer, not a penalty: a story with no listed
    company explains no move in our universe, and it earns its place on this page through scope,
    which is exactly where a Fed decision earns it.

    A ticker missing either number contributes nothing rather than a zero: an unknown ATR is not a
    calm stock. Averaging a null in as 0 is the same class of error as sorting nulls to the top of an
    ascending column, and this build has already made it once.
    """
    usable = [
        m for m in moves
        if m.ret1 is not None and m.atr14_pct is not None and m.atr14_pct > 0
    ]
    if not usable:
        return 0.0

    scores = [
        min(abs(m.ret1) / m.atr14_pct, MAGNITUDE_ATR_CAP) / MAGNITUDE_ATR_CAP for m in usable
    ]
    return sum(scores) / len(scores)


def catalyst_weight_for(event_type: str) -> float:
    """The weight for this CLASS of event. Unknown classes get the floor, never a middle guess."""
    return CATALYST_WEIGHT.get(event_type, CATALYST_WEIGHT["other"])


def freshness_for(sessions_ago: int) -> float:
    """Today's news leads. Yesterday's is halved. Older than that is barely holding on."""
    if sessions_ago <= 0:
        return FRESHNESS_SAME_SESSION
    if sessions_ago == 1:
        return FRESHNESS_PRIOR_SESSION
    return FRESHNESS_OLDER


def significance(
    *,
    tickers: tuple[str, ...] | list[str],
    event_type: str,
    sources: int,
    buckets: dict[str, str | None],
    sessions_ago: int,
) -> float:
    """
    The one number that orders the Front Page (significance v2, plan 4.5 / Appendix E).

    A PRODUCT of four factors, each a property of the EVENT: catalyst_weight × corroboration ×
    entity_weight × freshness. None of them is a property of the reader, and none of them could become
    one without someone adding a behavioral signal to a pipeline that does not collect any. `buckets`
    maps each symbol to its dollar-volume bucket ("large_mid" / "small" / None), the same split the
    base-rate engine uses.
    """
    return (
        catalyst_weight_for(event_type)
        * corroboration_for(sources)
        * entity_weight_for(tickers, buckets, event_type)
        * freshness_for(sessions_ago)
    )
