"""
ingest.py — one night's articles become one night's front page (plan 7.3-7.6).

The whole newsdesk in one readable sequence, and every step of it deterministic:

    fetch  ->  drop the boilerplate  ->  resolve the tickers  ->  cluster  ->  rank

No language model appears anywhere in this file. Stage A and Stage B write PROSE onto clusters this
file has already found, already linked, already ordered — so if every model in the pipeline failed
tonight, the Front Page would still be the right stories in the right order, missing only their
one-line context notes. That is the correct failure mode for a newspaper, and it is the reason the
ordering lives here rather than in a prompt.

THE BUDGET IS SMALLER THAN THE PLAN THOUGHT, AND HONEST ABOUT WHY. The plan bought two Finnhub calls
for the general feed, expecting `minId` to page backwards through 200 articles. It does not — it is a
forward filter, so the second call returns the same articles as the first (measured; see the adapter).
One call per category is the whole of what the endpoint can give.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from newsdesk import noise, rank, taxonomy
from newsdesk.cluster import Item, cluster_items
from newsdesk.rank import TickerMove
from newsdesk.resolve import TickerResolver

# ---------------------------------------------------------------------------------------------
# The nightly ingest budget (plan 7.3, corrected by measurement)
# ---------------------------------------------------------------------------------------------

# Finnhub returns the newest ~100 market articles for one call and cannot page back past them.
FINNHUB_MARKET_CATEGORIES = ("general", "merger")
FINNHUB_CALLS_PER_CATEGORY = 1

# Marketaux's free tier returns THREE articles per request (its own meta says so), and allows 100
# requests a day. Twenty of them is ~60 entity-tagged items — the only tagged entities we get.
MARKETAUX_PAGES = 20
MARKETAUX_ARTICLES_PER_PAGE = 3

# The Stage-A extraction cap. Everything beyond it is still INGESTED and still ranked and still
# rendered — it simply has no narrative line, which is a visible absence rather than a hidden one.
STAGE_A_CLUSTER_CAP = 60
# Stage B narrates the top of the page only. A "why it matters" line on the 40th story of the night
# is a sentence nobody reads, written at a cost.
STAGE_B_CLUSTER_CAP = 20

# THE DEPTH BUDGET (PD7, plan 0.2.3). The v2 insight — the `context` section and the `watch` rows —
# is written for the top 8 stories only; the other twelve narrated clusters keep their v1 one-liner.
#
# This is a COST cap, and it is deliberately a constant with a test rather than a comment, for the
# same reason MODE_STAGES is: depth is the expensive half of the night (a context section is ~3x the
# tokens of a why-line, and it carries a per-cluster stat block into the prompt on top). 0.2.3 priced
# the delta at ≈$0.03–0.06/night against a ~$0.33 baseline and said "measured at PD7's gate, not
# promised" — so PD7 measures it, and the number lands in the evidence file beside this estimate.
#
# Raising it is a one-constant change plus a DECISIONS line. Lowering it costs the reader depth on
# stories they are actually likely to open, which is why 8 and not 5: the top 8 is roughly "what a
# reader scrolls past before deciding the night is uninteresting".
DEEP_CLUSTER_CAP = 8


@dataclass(frozen=True)
class RankedCluster:
    """One story, fully linked and scored, ready to publish. Prose, if any, is added later."""

    id: str
    headline: str
    event_type: str
    sectors: list[str]
    themes: list[str]
    tickers: tuple[str, ...]
    significance: float
    sources: int
    first_seen: datetime
    members: list[Item]
    # The one article the extractor reads for this story: the cluster's SEED — the earliest report
    # from the most-corroborated outlet, which is the same article whose headline the card carries.
    # Reading a later rewrite would extract a story the card does not show.
    representative_id: str = ""
    # Part of the rank's evidence, kept on the row so a score can be explained after the fact.
    magnitude: float = 0.0
    image_candidate: str = ""


@dataclass
class NightResult:
    """What the newsdesk did tonight, and what it dropped — a cut that states its own size."""

    clusters: list[RankedCluster] = field(default_factory=list)
    articles_in: int = 0
    boilerplate_dropped: int = 0
    stage_a_capped: int = 0

    @property
    def stage_a_clusters(self) -> list[RankedCluster]:
        """
        The clusters the extractor will actually read: the top of the page, by significance.

        THIS RULE WAS WRONG ONCE, AND THE WAY IT WAS WRONG IS WORTH KEEPING. It originally ranked
        the extraction queue by "pre-LLM salience" — corroboration first, then ticker-move magnitude
        — to avoid a circle the plan had warned about: significance depends on event_type, and
        event_type was supposed to come from Stage A, so choosing what Stage A reads by significance
        would mean choosing it with the answer Stage A exists to produce.

        The circle does not exist in this tree. `rank.classify_event` classifies the event
        DETERMINISTICALLY, from the provider's own category and the headline, before any model runs
        (N4 built the classifier rather than taking the class from the model). Significance is
        therefore fully known pre-LLM, and nothing is being chosen with an answer it has not got.

        What the old rule actually did, measured on the recorded night: of the 20 stories the
        narrator was asked to write about, EIGHT were never read by the extractor — and they were
        the eight biggest stories of the night, the whole Gulf/Hormuz/oil cluster. Corroboration is
        1 for 131 of 134 clusters and magnitude is 0 for the ~130 that name no company, so a
        single-source macro story — which is precisely what a market-wide event IS — sorted to the
        bottom of the extraction queue while sitting at the top of the page.

        Both caps now rank by the same measure, so the narrated set is a SUBSET of the extracted set
        BY CONSTRUCTION, at any cap sizes. A story the app puts first is a story the app has read.
        """
        return self.clusters[:STAGE_A_CLUSTER_CAP]

    @property
    def stage_b_clusters(self) -> list[RankedCluster]:
        """The clusters the narrator will write a context line for. A subset of stage_a_clusters —
        see the note there, and the test that holds it."""
        return self.clusters[:STAGE_B_CLUSTER_CAP]

    @property
    def deep_clusters(self) -> list[RankedCluster]:
        """The clusters that get the v2 insight — the `context` section and the `watch` rows (PD7).

        A subset of stage_b_clusters by construction, at any cap sizes, because all three caps rank
        by the same measure. Every story the app puts first is a story the app has READ (stage A),
        NARRATED (stage B), and now placed IN CONTEXT (this one) — the three caps nest, and nothing
        can be deep without being narrated without being read.
        """
        return self.clusters[:DEEP_CLUSTER_CAP]


def build_night(
    *,
    articles: list[dict],
    resolver: TickerResolver,
    moves: dict[str, TickerMove],
    session_date: date,
    sectors_by_symbol: dict[str, str] | None = None,
) -> NightResult:
    """
    Turn a night's raw articles into the ranked front page.

    `articles` are provider-agnostic dicts, so Finnhub items and Marketaux items arrive through the
    same door: id, url, headline, summary, source, published, tickers (already known, e.g. from
    Marketaux's entities), industries, category, image, uuid, similar.

    `moves` is the price evidence at publish time, keyed by symbol — the only thing here that knows
    what the market did, and the only input to the magnitude term.
    """
    kept = [a for a in articles if not noise.is_boilerplate(a.get("headline", ""))]
    dropped = len(articles) - len(kept)

    items = [_to_item(article, resolver) for article in kept]
    clusters = cluster_items(items)

    ranked = [
        _rank_cluster(cluster, kept, moves, session_date, sectors_by_symbol or {})
        for cluster in clusters
    ]
    ranked.sort(key=lambda c: (-c.significance, c.first_seen, c.id))

    return NightResult(
        clusters=ranked,
        articles_in=len(articles),
        boilerplate_dropped=dropped,
        stage_a_capped=max(0, len(ranked) - STAGE_A_CLUSTER_CAP),
    )


def _to_item(article: dict, resolver: TickerResolver) -> Item:
    """
    One raw article into a clusterable item, with its companies named.

    A PROVIDER'S SYMBOL IS NOT AUTOMATICALLY OUR SYMBOL, and production taught this the hard way.
    Marketaux tagged "VitalHub Announces Acquisition of Buddy Healthcare" with VHI — correctly, for
    VitalHub on the Toronto exchange. In OUR instrument table VHI is Valhi, Inc., a New York chemicals
    holding company with no connection to the story whatsoever. The card would have printed a real
    price move for Valhi under a headline about a Canadian health-software acquisition.

    So a provider's tag is checked, not trusted: the symbol must exist in our universe AND the company
    the provider says it is must be the company we say it is. When the names disagree, the tag is
    dropped — a symbol collision across exchanges is not a near miss, it is a different company.

    Only where the provider named nothing — every item on the market feed — does the resolver read
    the text itself.
    """
    supplied = tuple(article.get("tickers") or ())
    if supplied:
        names = article.get("ticker_names") or {}
        tickers = tuple(
            symbol for symbol in supplied if resolver.agrees_on(symbol, names.get(symbol))
        )
    else:
        text = f"{article.get('headline', '')} {article.get('summary', '')}"
        tickers = resolver.resolve(text)

    return Item(
        id=str(article["id"]),
        url=article.get("url", ""),
        headline=article.get("headline", ""),
        source=article.get("source", ""),
        published=article["published"],
        tickers=tickers,
        uuid=article.get("uuid", "") or "",
        similar=tuple(article.get("similar") or ()),
    )


def _rank_cluster(
    cluster,
    articles: list[dict],
    moves: dict[str, TickerMove],
    session_date: date,
    sectors_by_symbol: dict[str, str],
) -> RankedCluster:
    """Score one cluster and dress it with everything the publish transaction needs."""
    by_id = {str(a["id"]): a for a in articles}
    members = [by_id[item.id] for item in cluster.members if item.id in by_id]

    seed_id = cluster._seed().id
    seed = by_id.get(seed_id, {})
    category = seed.get("category", "")
    summary = seed.get("summary", "")

    event_type = rank.classify_event(category, cluster.headline, summary)

    industries: list[str | None] = []
    for article in members:
        industries.extend(article.get("industries") or [])

    instrument_sectors = [sectors_by_symbol.get(symbol) for symbol in cluster.tickers]
    sectors = taxonomy.sectors_for(instrument_sectors=instrument_sectors, industries=industries)

    text = " ".join([cluster.headline] + [a.get("summary", "") for a in members])
    themes = taxonomy.themes_for(text)

    linked_moves = [moves[symbol] for symbol in cluster.tickers if symbol in moves]
    sessions_ago = max(0, (session_date - cluster.first_seen.date()).days)
    magnitude = rank.magnitude_for(linked_moves)

    significance = rank.significance(
        tickers=cluster.tickers,
        event_type=event_type,
        sectors=sectors,
        sources=cluster.sources,
        moves=linked_moves,
        sessions_ago=sessions_ago,
    )

    # The image candidate is the first one any member offered — the L1 rung. An empty string means
    # L1 did not answer for this story and the ladder falls to og:image.
    candidate = next((a.get("image", "") for a in members if a.get("image")), "")

    return RankedCluster(
        id=cluster.id,
        headline=cluster.headline,
        event_type=event_type,
        sectors=sectors,
        themes=themes,
        tickers=cluster.tickers,
        significance=significance,
        sources=cluster.sources,
        first_seen=cluster.first_seen,
        members=cluster.members,
        representative_id=seed_id,
        magnitude=magnitude,
        image_candidate=candidate,
    )
