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
    # Kept alongside significance because the Stage-A cap ranks on it directly (see stage_a_clusters).
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
        The clusters the extraction batch will actually read — chosen by PRE-LLM salience.

        Deliberately not by significance, and the plan was right to insist. Significance depends on
        event_type, and for the top clusters event_type is supposed to come FROM Stage A — so
        choosing what Stage A reads by significance would mean choosing it with the answer Stage A
        exists to produce. The circle is broken by ranking here on the two things the pipeline knows
        entirely on its own: how many independent outlets carried the story, and how big a move it
        explains.
        """
        return sorted(
            self.clusters,
            key=lambda c: (-c.sources, -c.magnitude, c.first_seen, c.id),
        )[:STAGE_A_CLUSTER_CAP]

    @property
    def stage_b_clusters(self) -> list[RankedCluster]:
        """The clusters the narrator will write a context line for."""
        return self.clusters[:STAGE_B_CLUSTER_CAP]


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

    seed = by_id.get(cluster._seed().id, {})
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
        magnitude=magnitude,
        image_candidate=candidate,
    )
