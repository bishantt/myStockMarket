"""
taxonomy.py — the closed sector set, the industry map, and the two themes (plan Appendix E).

THIS FILE IS WHY THE LLM CANNOT EDIT THE FRONT PAGE.

Every label the Front Page sorts, filters and ranks by is assigned HERE, by a lookup table checked
into the repo, from evidence the pipeline already holds. The language model narrates; it never
computes and it never categorises. If a model could choose a story's sector, it could choose which
filter the story appears under, and a page that can be re-shelved by a model's mood is not edited by
evidence — which is ruling C1, the deepest guard in this plan.

Three sources answer the sector question, in order, and the order is the honesty:

1. **The instrument table's own `sector`.** If the story links to tickers we hold, we already know
   what they are. This is the strongest evidence and it costs nothing.
2. **Marketaux's `industry` string**, mapped through the fixed table below. It is the provider's
   vocabulary ("Consumer Cyclical", "Financial Services"), not ours, so it is translated rather than
   printed.
3. **"Broad market"** — the honest default. A story we cannot place is not shoved into the nearest
   sector to make the page look complete; it says it is a market-wide story, which is usually true
   of exactly the stories that resist classification (a Fed decision, a jobs print).

Themes are additive and deliberately few. "AI" and "Defense" are the two the plan authorises, and
they are matched on WORD BOUNDARIES — the tests pin the near-misses, because "aid" is not "AI" and
"defensive stocks" is not the defense sector.
"""

from __future__ import annotations

import re

# The closed set. A sector that is not in this tuple cannot be rendered, because the room's filter
# chips are built from it — a twelfth sector appearing in the data would be a chip nobody designed.
SECTORS: tuple[str, ...] = (
    "Technology",
    "Financials",
    "Health care",
    "Energy",
    "Industrials",
    "Consumer discretionary",
    "Consumer staples",
    "Utilities",
    "Materials",
    "Real estate",
    "Communications",
)

# The honest default for a story that resists classification — and it is information, not a failure.
BROAD_MARKET = "Broad market"

# Provider vocabulary → ours. The left side is what Marketaux and the instrument table actually say
# (both use a Yahoo-derived vocabulary); the right side is the closed set above. Keys are lowercased
# at lookup, so casing here is for reading.
INDUSTRY_MAP: dict[str, str] = {
    # Technology
    "technology": "Technology",
    "information technology": "Technology",
    "software": "Technology",
    "semiconductors": "Technology",
    "hardware": "Technology",
    "electronic technology": "Technology",
    "technology services": "Technology",
    # Financials
    "financial services": "Financials",
    "financials": "Financials",
    "banks": "Financials",
    "insurance": "Financials",
    "finance": "Financials",
    # Health care
    "healthcare": "Health care",
    "health care": "Health care",
    "biotechnology": "Health care",
    "pharmaceuticals": "Health care",
    "health technology": "Health care",
    "medical": "Health care",
    # Energy
    "energy": "Energy",
    "oil & gas": "Energy",
    "energy minerals": "Energy",
    # Industrials
    "industrials": "Industrials",
    "industrial goods": "Industrials",
    "aerospace & defense": "Industrials",
    "producer manufacturing": "Industrials",
    "transportation": "Industrials",
    # Consumer discretionary
    "consumer cyclical": "Consumer discretionary",
    "consumer discretionary": "Consumer discretionary",
    "retail trade": "Consumer discretionary",
    "consumer durables": "Consumer discretionary",
    "autos": "Consumer discretionary",
    # Consumer staples
    "consumer defensive": "Consumer staples",
    "consumer staples": "Consumer staples",
    "consumer non-durables": "Consumer staples",
    "food & beverage": "Consumer staples",
    # Utilities
    "utilities": "Utilities",
    # Materials
    "basic materials": "Materials",
    "materials": "Materials",
    "non-energy minerals": "Materials",
    "chemicals": "Materials",
    # Real estate
    "real estate": "Real estate",
    "reit": "Real estate",
    # Communications
    "communication services": "Communications",
    "communications": "Communications",
    "media": "Communications",
    "telecommunications": "Communications",
    "entertainment": "Communications",
}

# The two authorised themes, and the words that mean them. Matched on word boundaries, case
# insensitively. Multi-word phrases are matched as phrases.
THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "AI": (
        "ai",
        "a.i.",
        "artificial intelligence",
        "machine learning",
        "large language model",
        "llm",
        "generative ai",
        "chatgpt",
        "openai",
        "anthropic",
        "neural network",
        "inference chip",
    ),
    "Defense": (
        "defense",
        "defence",
        "pentagon",
        "military",
        "weapons",
        "missile",
        "warfare",
        "armaments",
        "department of defense",
        "nato",
    ),
}

# Built once: for each theme, one regex that finds any of its keywords on a word boundary. This is
# what keeps "aid" and "said" from reading as "AI", and "defensive" from reading as "defense".
_THEME_PATTERNS: dict[str, re.Pattern[str]] = {
    theme: re.compile(
        r"(?<![\w.])(?:" + "|".join(re.escape(word) for word in words) + r")(?![\w])",
        re.IGNORECASE,
    )
    for theme, words in THEME_KEYWORDS.items()
}


def sector_for_industry(industry: str | None) -> str | None:
    """
    Translate one provider industry string into our closed set. Unknown industry → None.

    None is deliberate and is NOT the same as "Broad market": it means this particular piece of
    evidence had nothing to say, and the caller should keep asking its other sources. Collapsing the
    two would let one silent provider decide that a story is market-wide.
    """
    if not industry:
        return None
    return INDUSTRY_MAP.get(industry.strip().lower())


def sectors_for(
    instrument_sectors: list[str | None] | None = None,
    industries: list[str | None] | None = None,
) -> list[str]:
    """
    Every sector a story touches, strongest evidence first (plan Appendix E).

    The instrument table is asked first because it is OUR record of what a company is; the provider's
    industry string is asked second. If neither answers, the story is Broad market — which is a real
    answer, and the right one for the Fed decisions and jobs prints that genuinely have no sector.

    Order follows the closed set, so two stories touching the same sectors always list them the same
    way, and a chip row never reorders itself between renders.
    """
    found: set[str] = set()

    for sector in instrument_sectors or []:
        mapped = sector_for_industry(sector)
        if mapped:
            found.add(mapped)
        elif sector and sector in SECTORS:
            found.add(sector)

    for industry in industries or []:
        mapped = sector_for_industry(industry)
        if mapped:
            found.add(mapped)

    if not found:
        return [BROAD_MARKET]

    return [sector for sector in SECTORS if sector in found]


def themes_for(text: str) -> list[str]:
    """
    The themes a story carries, from its own words (headline + summary).

    Additive, not exclusive: a story can be AI and Defense and Technology at once. The word-boundary
    matching is the whole design — a substring search would find "AI" inside "said", "again" and
    "aid", and the AI filter would fill up with everything.
    """
    if not text:
        return []
    return [theme for theme, pattern in _THEME_PATTERNS.items() if pattern.search(text)]
