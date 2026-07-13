"""
cluster.py — one story arrives as N articles; this is what turns them back into one story (N4).

Deterministic, pure, and with no language model anywhere near it. A model asked "are these the same
story?" would be right most of the time and confidently wrong the rest, and a wrongly merged cluster
prints two unrelated headlines under one card with one set of tickers — a fabricated connection,
which is the exact thing this app exists not to do.

THE PLAN'S RULE HAD TO BE AMENDED, AND THE THRESHOLD WAS MEASURED RATHER THAN CHOSEN.

The plan said two items cluster when any of these holds: same canonical URL, Marketaux `similar`
links them, or token Jaccard >= 0.55 AND overlapping ticker sets AND published within 36h.

Run against the 134 real articles the recorder captured, that rule clusters NOTHING. Not a few things
— nothing at all, zero merges out of 134. Two failures compound:

1. Finnhub's market feed carries no tickers (see resolve.py), so "overlapping ticker sets" is
   unsatisfiable for most pairs: two empty sets do not overlap.
2. 0.55 is simply too high for real headlines. "VitalHub acquires Buddy Healthcare" and "VitalHub
   Announces Acquisition of Buddy Healthcare" are the same story by any reading, and they score 0.50
   — because `acquires` and `acquisition` are different tokens. A bar that high is not strict; it is
   INERT, and an inert clusterer means the Front Page silently prints every story once per outlet
   while its "3 sources" line never appears.

So the threshold was measured against the recording instead of argued about, and the measurement is
sharp. At 0.45 every true merge in the night is found — the VitalHub acquisition, a Reuters headline
rewritten an hour later, a Baker Hughes deal approval and its follow-up — and nothing false is. At
0.40 it immediately fabricates: Qiagen, Conmed and Tiny Ltd merge into ONE cluster because all three
headlines contain "jumps after report of takeover interest". Three different companies, three
different deals, one card. That is the invention this whole file exists to prevent, and it is 0.05
away. The threshold is pinned by tests in BOTH directions.

WHAT THE TICKERS ARE REALLY FOR: A VETO, NOT A BONUS. The plan used ticker overlap as a requirement
to merge. Its honest role is the opposite one — to REFUSE. "Apple beats on revenue" and "Microsoft
beats on revenue" are near-identical strings about different companies, and no amount of textual
agreement should join them. So when both items name companies and those companies differ, they never
merge, whatever the words say. Evidence that actively disagrees is not weak evidence.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from newsdesk.outlets import canonical_outlet, distinct_outlets

# How much two headlines must agree before they are one story. MEASURED, not chosen: at 0.45 every
# true merge in the recorded night is found and no false one is; at 0.40 three unrelated takeover
# stories collapse into a single card. Changing this number is a structural change to what the Front
# Page claims, and the tests pin it from both sides.
JACCARD_MIN = 0.45
# A story does not stay news forever. Beyond this, two similar headlines are two events.
MAX_GAP = timedelta(hours=36)

# Tracking parameters that change per reader and per campaign but never change the article.
_TRACKING_PARAMS = frozenset(
    {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "src", "cmpid", "partner",
        "__source", "yptr", "guccounter", "taid", "soc_src", "soc_trk",
    }
)

# Words that carry no story. Dropped before the Jaccard, because two headlines both containing "the"
# and "says" are not two headlines about the same thing.
_STOPWORDS = frozenset(
    """
    a an the and or but of in on at to for from by with as is are was were be been being
    it its this that these those has have had will would could should may might can
    says say said report reports reported after before amid over under new more most
    up down than then not no yes what why how who when where which about into out
    """.split()
)

_WORD = re.compile(r"[a-z0-9']+")
# Source suffixes the wires staple onto a headline: "… - Reuters", "… | Bloomberg".
_SOURCE_SUFFIX = re.compile(r"\s*[-|–—]\s*(reuters|bloomberg|cnbc|seekingalpha|globenewswire)\s*$", re.I)
# An exchange-qualified ticker inside a headline is a link, not a word about the story.
_TICKER_PAREN = re.compile(r"\((?:nasdaq|nyse|amex|otc)\s*:\s*[a-z.\-]+\)", re.I)


@dataclass(frozen=True)
class Item:
    """One article, as the clusterer needs it."""

    id: str
    url: str
    headline: str
    source: str
    published: datetime
    tickers: tuple[str, ...] = ()
    # Marketaux's uuid, and the uuids it claims cover the same story. Empty in every recording.
    uuid: str = ""
    similar: tuple[str, ...] = ()


@dataclass
class Cluster:
    """One story, and every article that told it."""

    id: str
    members: list[Item] = field(default_factory=list)

    @property
    def headline(self) -> str:
        """
        The representative headline: the EARLIEST article from the most-corroborated outlet.

        Earliest, because the first newsroom to publish wrote the story the others followed. Not the
        longest, not the most detailed, and above all not the most dramatic — a cluster that picked
        its loudest headline would be a cluster edited by tone.
        """
        return self._seed().headline

    @property
    def first_seen(self) -> datetime:
        return min(item.published for item in self.members)

    @property
    def sources(self) -> int:
        """Distinct INDEPENDENT outlets — press wires collapse to one (see outlets.py)."""
        return distinct_outlets([item.source for item in self.members])

    @property
    def tickers(self) -> tuple[str, ...]:
        """
        Every ticker any member named, most-mentioned first.

        Mention count is the only ranking evidence available here; where Marketaux supplied a
        match_score the ingest has already ordered that item's own tickers by it, and rank.py
        re-ranks against price evidence at publish. Ties break alphabetically so the order is stable
        across runs — an unstable ticker order would reshuffle the chips on a card between nights.
        """
        counts: dict[str, int] = {}
        for item in self.members:
            for ticker in item.tickers:
                counts[ticker] = counts.get(ticker, 0) + 1
        return tuple(sorted(counts, key=lambda t: (-counts[t], t)))

    def _seed(self) -> Item:
        """The article the cluster is named for, and whose canonical url gives it its stable id."""
        best_outlet_count: dict[str, int] = {}
        for item in self.members:
            outlet = canonical_outlet(item.source)
            best_outlet_count[outlet] = best_outlet_count.get(outlet, 0) + 1

        return min(
            self.members,
            key=lambda item: (
                -best_outlet_count[canonical_outlet(item.source)],
                item.published,
                item.id,
            ),
        )


def canonical_url(url: str) -> str:
    """
    The article's URL with the noise stripped: no tracking parameters, no fragment, no trailing slash.

    Two links to the same article that differ only by the campaign that delivered them are one
    article, and a clusterer that could not see that would print the same story twice.
    """
    if not url:
        return ""
    parts = urlsplit(url.strip())
    kept = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in _TRACKING_PARAMS]
    path = parts.path.rstrip("/") or "/"
    host = parts.netloc.lower().removeprefix("www.")
    return urlunsplit((parts.scheme.lower(), host, path, urlencode(kept), ""))


def tokens(headline: str) -> frozenset[str]:
    """
    The words of a headline that carry its story.

    Lowercased, stripped of the source suffix the wires staple on and of any exchange-qualified
    ticker, split on word boundaries, with stopwords removed. What is left is what the headline is
    actually about, and it is what the Jaccard compares.
    """
    text = _SOURCE_SUFFIX.sub("", headline or "")
    text = _TICKER_PAREN.sub(" ", text)
    words = _WORD.findall(text.lower())
    return frozenset(word for word in words if word not in _STOPWORDS and len(word) > 1)


def jaccard(left: frozenset[str], right: frozenset[str]) -> float:
    """Overlap of two token sets, 0..1. Two empty headlines are not similar; they are unknown."""
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def same_story(a: Item, b: Item) -> bool:
    """
    Do these two articles tell the same story? The rule, strongest evidence first.

    1. The same canonical URL — the same article, reached two ways. Nothing to argue about.
    2. Marketaux says so, via its `similar` list. Honoured; empty in every recording we hold.
    3. Their companies do not CONTRADICT each other, they were published within 36 hours, and their
       headlines agree at least JACCARD_MIN.

    Step 3's first clause is the ticker veto, and it is the part that earns its keep. Two headlines
    can be nearly identical strings about entirely different companies — "Apple beats on revenue",
    "Microsoft beats on revenue" — and no amount of word agreement should ever join them. So when
    both items name companies and none of those companies is shared, the answer is no, whatever the
    words say.
    """
    if a.id == b.id:
        return False

    if a.url and canonical_url(a.url) == canonical_url(b.url):
        return True

    if a.uuid and a.uuid in b.similar:
        return True
    if b.uuid and b.uuid in a.similar:
        return True

    # The veto: named companies that disagree.
    if a.tickers and b.tickers and not (set(a.tickers) & set(b.tickers)):
        return False

    if abs(a.published - b.published) > MAX_GAP:
        return False

    return jaccard(tokens(a.headline), tokens(b.headline)) >= JACCARD_MIN


def cluster_items(items: list[Item]) -> list[Cluster]:
    """
    Group a night's articles into stories (union-find over the pairwise rule).

    The cluster's id is the sha1 of its SEED member's canonical URL, which is what lets a story keep
    its identity as more articles join it over the following evenings — the seed is the earliest
    article from the best-corroborated outlet, and later arrivals do not change who that was.

    Clusters come back most-corroborated first, then earliest, so the order is stable and owes
    nothing to the order the articles were fetched in.
    """
    parent: dict[str, str] = {item.id: item.id for item in items}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: str, y: str) -> None:
        root_x, root_y = find(x), find(y)
        if root_x != root_y:
            parent[root_y] = root_x

    for i, a in enumerate(items):
        for b in items[i + 1 :]:
            if same_story(a, b):
                union(a.id, b.id)

    groups: dict[str, list[Item]] = {}
    for item in items:
        groups.setdefault(find(item.id), []).append(item)

    clusters = []
    for members in groups.values():
        cluster = Cluster(id="", members=members)
        seed = cluster._seed()
        cluster.id = hashlib.sha1(canonical_url(seed.url).encode()).hexdigest()
        clusters.append(cluster)

    return sorted(clusters, key=lambda c: (-c.sources, c.first_seen, c.id))
