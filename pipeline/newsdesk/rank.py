"""
rank.py — what leads the Front Page, and why (plan Appendix E; ruling C1).

THIS FILE IS THE ANSWER TO "WILL YOUR NEWS SECTION DRIFT INTO A TRENDING FEED?"

It cannot, and the reason is structural rather than disciplinary. The order of the page is a fixed
arithmetic formula over five measured quantities, all of them properties of the EVENT — how broadly
it reaches, how many independent newsrooms judged it worth printing, how big a price move it
explains, what class of thing it is, and how fresh it is. There is no term for popularity, no term
for engagement, no term for what the reader clicked last time, and — the deepest guard — no
behavioral signal is INGESTED anywhere in this system, so there is nothing for such a term to be
built from even by accident.

The weights are module constants. Changing one is a structural change to what the app claims its
front page is, and it goes through DECISIONS.md like any other.

The language model never sees a rank and never sets one. It writes prose about clusters this file
has already ordered.

ON class_prior, THE ONE TERM THAT LOOKS LIKE AN OPINION: it is a prior about the CLASS of event, not
about the instance — an FDA approval reprices a company more often than an analyst note does, and
that is a fact about how markets work, not a view about today. It is the smallest weight but one, it
is stated on the surface (the room's header sentence explains the ordering), and it is the only place
in the formula where the app's own judgment appears at all.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# The five weights. They sum to 1.0, and the test asserts it — a formula whose weights quietly
# stopped summing to one would still produce an order, and it would mean nothing.
W_SCOPE = 0.30
W_CORROBORATION = 0.25
W_MAGNITUDE = 0.20
W_CLASS_PRIOR = 0.15
W_RECENCY = 0.10

# How far the event reaches. The biggest single term, because "how many people does this touch" is
# the most honest proxy for "how much does this matter" that does not require an opinion.
SCOPE_MACRO = 1.0        # a Fed decision, a CPI print, a war closing a shipping strait
SCOPE_SECTOR = 0.6       # three or more names, or an event about a whole industry
SCOPE_SINGLE = 0.3       # one company
SCOPE_NO_LISTING = 0.15  # real news, nobody we hold — it still gets a place, at the bottom

# Corroboration saturates at five independent outlets: the difference between one newsroom and three
# is enormous, and the difference between eight and ten is nothing.
CORROBORATION_CEILING = 5

# A move is measured in units of the ticker's OWN volatility, not in percent. A 3% day is enormous
# for a utility and a quiet Tuesday for a biotech, and a formula that could not tell them apart would
# rank every speculative name above every real story. Capped at 3 ATRs, because past that the number
# stops discriminating — everything is simply "huge".
MAGNITUDE_ATR_CAP = 3.0

# The class priors (Appendix E, verbatim).
CLASS_PRIOR: dict[str, float] = {
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

RECENCY_SAME_SESSION = 1.0
RECENCY_PRIOR_SESSION = 0.5
RECENCY_OLDER = 0.25

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


def scope_for(tickers: tuple[str, ...] | list[str], event_type: str, sectors: list[str]) -> float:
    """
    How far does this reach?

    A macro event is macro whether or not it names a company — that is the whole point of it, and it
    is why "Iran closes the Strait of Hormuz" outranks any single earnings beat on this page. Three
    or more names, or a story the taxonomy could only call Broad market, is sector-wide. One name is
    one name. And a story we hold no listing for still appears — at the bottom, honestly labeled.
    """
    if event_type in {"macro", "fed"}:
        return SCOPE_MACRO

    count = len(tickers)
    if count >= 3:
        return SCOPE_SECTOR
    if count >= 1:
        return SCOPE_SINGLE
    return SCOPE_NO_LISTING


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


def class_prior_for(event_type: str) -> float:
    """The prior for this CLASS of event. Unknown classes get the floor, never a middle guess."""
    return CLASS_PRIOR.get(event_type, CLASS_PRIOR["other"])


def recency_for(sessions_ago: int) -> float:
    """Today's news leads. Yesterday's is halved. Older than that is barely holding on."""
    if sessions_ago <= 0:
        return RECENCY_SAME_SESSION
    if sessions_ago == 1:
        return RECENCY_PRIOR_SESSION
    return RECENCY_OLDER


def significance(
    *,
    tickers: tuple[str, ...] | list[str],
    event_type: str,
    sectors: list[str],
    sources: int,
    moves: list[TickerMove],
    sessions_ago: int,
) -> float:
    """
    The one number that orders the Front Page (Appendix E).

    Every input is a property of the EVENT. None of them is a property of the reader, and none of
    them could become one without someone adding a behavioral signal to a pipeline that does not
    collect any.
    """
    return (
        W_SCOPE * scope_for(tickers, event_type, sectors)
        + W_CORROBORATION * corroboration_for(sources)
        + W_MAGNITUDE * magnitude_for(moves)
        + W_CLASS_PRIOR * class_prior_for(event_type)
        + W_RECENCY * recency_for(sessions_ago)
    )
