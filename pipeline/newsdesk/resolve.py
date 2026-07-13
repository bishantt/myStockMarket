"""
resolve.py — which companies is this article actually about? (N4, forced by the recording)

WHY THIS FILE EXISTS AT ALL. The plan assumed the providers tag their articles with the tickers they
concern. They do not, on the feed that matters. Finnhub's COMPANY news carries the symbol; its
MARKET news — 160 of the ~220 articles a night, and the Front Page's main source — carries an empty
`related` field on every single item. Marketaux does tag entities, but its free tier hands over three
articles per request. So most of the front page arrives with no idea what it is about, and the
clustering rule ("overlapping ticker sets") and the significance formula ("magnitude over the linked
tickers") both have nothing to stand on until something links them.

That something is this file, and it is deliberately DUMB: a lookup against the instrument table we
already hold, with no model anywhere near it. A language model asked "which stocks is this about?"
would answer plausibly and occasionally wrongly, and a wrong answer here is not a small error — it is
a card that tells the reader a story is about a company the story never mentions. Ruling C1 again:
the front page is edited by evidence.

PRECISION IS PREFERRED TO RECALL, AND THE ASYMMETRY IS THE DESIGN. A ticker we fail to link costs the
card one chip and costs the cluster some ranking magnitude. A ticker we link WRONGLY is a false
statement about a company, printed under a headline, next to a real price move. The first is a
shortfall; the second is a lie. So every rule below refuses when it is unsure.

The rules, strongest evidence first:

1. **An exchange-qualified ticker in the text** — "(NASDAQ: AAPL)", "NYSE:FSK". The article is doing
   the linking itself, and it is doing it in the one format that cannot mean anything else.
2. **A multi-word company name** — "General Motors", "Bank of America". Two or more words matched on
   a word boundary is strong: no English sentence contains "Bank of America" by accident.
3. **A single-word company name** — "Nvidia", "Pfizer". Accepted only when the word is not an
   ordinary English word, because a great many companies are named after ordinary English words and
   a headline about a retailer's Target is not a headline about Target. The stoplist below is what
   stands between the Front Page and that class of nonsense.
4. **A bare uppercase symbol** — "AAPL slipped". Accepted only for symbols of three characters or
   more that are not common acronyms, because the two-letter and one-letter tickers collide with
   English constantly and "AI" is both this decade's biggest theme and a real listed company.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Corporate suffixes, stripped before a name is matched. "Apple Inc." is never written that way in a
# headline; "Apple" is. Ordered longest-first so "Co." does not eat the "Co" inside "Corporation".
_SUFFIXES = (
    "incorporated",
    "corporation",
    "technologies",
    "international",
    "holdings",
    "company",
    "limited",
    "group",
    "corp.",
    "corp",
    "inc.",
    "inc",
    "plc",
    "ltd.",
    "ltd",
    "llc",
    "n.v.",
    "s.a.",
    "a.g.",
    "ag",
    "co.",
    "co",
    "sa",
    "nv",
    "class a",
    "class b",
    "class c",
    "common stock",
    "the",
    "&",
)

# Single-word company names that are also ordinary English words. A name in this set is NEVER matched
# by rule 3 — it needs an explicit ticker (rule 1) to link.
#
# This list is the difference between a front page and a random-word generator. Every entry is a real
# US-listed company whose name is a word an ordinary market headline uses in its ordinary sense:
# "the gap between expectations", "shares block-traded", "a target price", "key support", "the match
# between supply and demand".
AMBIGUOUS_NAMES: frozenset[str] = frozenset(
    {
        "target", "gap", "block", "visa", "key", "match", "square", "shell", "total", "unity",
        "peloton", "carnival", "yum", "gates", "boston", "chase", "capital", "first", "general",
        "national", "american", "united", "global", "premier", "summit", "signature", "pioneer",
        "liberty", "sturm", "cheniere", "arch", "range", "apache", "diamond", "eagle", "hope",
        "brands", "energy", "materials", "industries", "resources", "partners", "trust", "realty",
        "growth", "value", "core", "prime", "select", "advance", "progress", "sunrise", "phoenix",
        "aurora", "cardinal", "colgate", "crown", "dollar", "expedia", "ford", "franklin", "harley",
        "hershey", "humana", "invesco", "jack", "kellogg", "lincoln", "loews", "marathon", "martin",
        "mosaic", "newell", "nordson", "olin", "omega", "oracle", "otis", "paramount", "public",
        "regency", "rollins", "ross", "ryder", "sempra", "snap", "stanley", "steel", "stone",
        "sysco", "tapestry", "textron", "tyson", "vulcan", "waters", "welltower", "west", "whirlpool",
    }
)

# All-caps strings that look like tickers and are not. Several of these ARE real symbols — which is
# precisely the problem, and precisely why a bare uppercase token is the weakest rule here.
COMMON_ACRONYMS: frozenset[str] = frozenset(
    {
        "CEO", "CFO", "COO", "CTO", "IPO", "GDP", "CPI", "PPI", "FDA", "SEC", "FTC", "DOJ", "IRS",
        "ETF", "EPS", "USA", "USD", "EUR", "GBP", "AI", "EV", "ESG", "API", "SPAC", "FOMC", "ECB",
        "OPEC", "NATO", "WHO", "UN", "EU", "UK", "US", "IT", "PC", "TV", "VP", "PR", "HR", "AGM",
        "M&A", "YOY", "QOQ", "EBITDA", "ROI", "ATH", "NYSE", "AMEX", "OTC", "SPY", "IPOS",
    }
)

# Rule 1: the article links itself. "(NASDAQ: AAPL)", "NYSE:FSK", "(NYSE: BRK.B)".
_EXCHANGE_TICKER = re.compile(
    r"\b(?:NASDAQ|NYSE(?:ARCA|AMERICAN)?|AMEX|OTC(?:MKTS)?|CBOE)\s*:\s*([A-Z][A-Z.\-]{0,6})\b"
)

# Rule 4: a bare all-caps token that could be a symbol.
_BARE_SYMBOL = re.compile(r"\b([A-Z]{3,5})\b")


@dataclass(frozen=True)
class Instrument:
    """One row of the instrument table, as the resolver needs it."""

    symbol: str
    name: str


def canonical_name(name: str) -> str:
    """
    A company's name as a headline would actually write it: no legal suffixes, no punctuation noise.

    "Apple Inc." → "apple". "Bank of America Corporation" → "bank of america". The suffix strip runs
    repeatedly because real names stack them ("Alphabet Inc. Class A").
    """
    text = name.lower().strip()
    text = re.sub(r"[,\.]+$", "", text)

    changed = True
    while changed:
        changed = False
        for suffix in _SUFFIXES:
            if text.endswith(" " + suffix):
                text = text[: -(len(suffix) + 1)].strip().rstrip(",.")
                changed = True
    return text.strip()


class TickerResolver:
    """
    Resolves article text to symbols, against a fixed universe.

    Built once per night from the instrument table and reused for every article — the name index is
    the expensive part and it does not change between articles.
    """

    def __init__(self, instruments: list[Instrument]) -> None:
        self._by_symbol = {inst.symbol.upper(): inst.symbol for inst in instruments}

        # Name → symbol, keyed on the canonical form. Where two companies canonicalize to the same
        # name, neither is matchable by name: an ambiguous name is not evidence, and picking one of
        # them would be inventing the link the whole file exists to avoid.
        names: dict[str, list[str]] = {}
        for inst in instruments:
            canon = canonical_name(inst.name)
            if canon:
                names.setdefault(canon, []).append(inst.symbol)

        self._by_name = {name: symbols[0] for name, symbols in names.items() if len(symbols) == 1}

        # One regex over every unambiguous name, longest first so "bank of america" wins over "bank"
        # if both were ever present. Matching all names in a single pass keeps this linear in the
        # article's length rather than in the size of the universe.
        matchable = [name for name in self._by_name if self._is_matchable(name)]
        self._name_pattern = (
            re.compile(
                r"(?<![\w])(?:"
                + "|".join(re.escape(name) for name in sorted(matchable, key=len, reverse=True))
                + r")(?![\w])",
                re.IGNORECASE,
            )
            if matchable
            else None
        )

    @staticmethod
    def _is_matchable(canon: str) -> bool:
        """
        May this canonical name be matched on its own, without an explicit ticker beside it?

        A multi-word name always may — "bank of america" does not occur in English by accident. A
        single-word name may only if it is not an ordinary word, which is what AMBIGUOUS_NAMES holds.
        """
        if " " in canon:
            return True
        return canon not in AMBIGUOUS_NAMES and len(canon) > 2

    def resolve(self, text: str) -> tuple[str, ...]:
        """
        Every symbol this text is genuinely about, in the order the rules found them.

        Returns an empty tuple when nothing is certain — which is a real and common answer. A Fed
        decision names no company, and the Front Page has a shape for exactly that story.
        """
        if not text:
            return ()

        found: list[str] = []

        def remember(symbol: str) -> None:
            if symbol not in found:
                found.append(symbol)

        # Rule 1 — the article did the linking itself.
        for candidate in _EXCHANGE_TICKER.findall(text):
            symbol = self._by_symbol.get(candidate.upper())
            if symbol:
                remember(symbol)

        # Rules 2 and 3 — company names, in one pass.
        if self._name_pattern is not None:
            for match in self._name_pattern.finditer(text):
                symbol = self._by_name.get(match.group(0).lower())
                if symbol:
                    remember(symbol)

        # Rule 4 — a bare uppercase token, the weakest evidence, and fenced accordingly.
        for candidate in _BARE_SYMBOL.findall(text):
            if candidate in COMMON_ACRONYMS:
                continue
            symbol = self._by_symbol.get(candidate)
            if symbol:
                remember(symbol)

        return tuple(found)
