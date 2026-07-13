"""
ogimage.py — rung 2 of the image ladder: the article's own og:image (plan 7.9).

WHEN THIS RUNS: only when the provider gave us no image. In the recorded feed that is rare (160 of
160 market items carried one), which is good news for the budget and no reason to skip the rung —
Finnhub's company news does ship empty image fields, and a provider's URL can still be dead.

FETCH ETIQUETTE, AND WHY WE ARE ENTITLED TO DO THIS AT ALL. Reading an article's og:image is exactly
what Slack, Discord and iMessage do server-side every time someone pastes a link: the tags exist FOR
link previews, which is what this is. We honour it properly rather than approximately — we identify
ourselves in the User-Agent, we respect robots.txt, we make ONE attempt per URL per night, we read at
most 512KB (the tags live in <head>, so a full article body is bytes we have no business fetching),
and we cache the result. A failure is DATA, not an error: it means the ladder falls to rung 3, which
is a designed card, not an apology.
"""

from __future__ import annotations

import re
import urllib.robotparser
from urllib.parse import urljoin, urlsplit

# We say who we are and where to complain. An anonymous scraper is a different thing from a link
# preview, and the difference is whether the publisher can find you.
USER_AGENT = "msm-newsdesk/1 (+https://github.com/bishantt/myStockMarket)"

TIMEOUT_SECONDS = 5.0
# The tags live in <head>. Reading the whole article would be fetching bytes we have no use for.
MAX_BYTES = 512 * 1024

# The three tags, in the order publishers actually populate them. A regex rather than a parser is
# deliberate: this reads four well-formed meta tags out of a document head, and adding an HTML
# parsing dependency to do it would be a dependency to maintain forever for four tags.
_META_PATTERNS = (
    re.compile(r'<meta[^>]+property=["\']og:image:secure_url["\'][^>]+content=["\']([^"\']+)', re.I),
    re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.I),
    re.compile(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)', re.I),
    re.compile(r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)', re.I),
)


def extract_og_image(html: str, page_url: str) -> str | None:
    """
    The article's preview image, from its own meta tags. None when it declares none.

    Relative URLs are resolved against the page, because publishers write both and a relative one
    that we stored verbatim would be a URL that resolves to nothing from our side.
    """
    if not html:
        return None

    head = html[:MAX_BYTES]
    for pattern in _META_PATTERNS:
        match = pattern.search(head)
        if match:
            candidate = match.group(1).strip()
            if candidate:
                return urljoin(page_url, candidate)
    return None


def robots_allow(robots_txt: str, url: str, user_agent: str = USER_AGENT) -> bool:
    """
    Does this site's robots.txt permit us to read this page?

    A site that says no gets a no. The ladder has a rung for it, so honouring the file costs us a
    designed card rather than a blank one — which is the whole reason the designed card exists.
    """
    parser = urllib.robotparser.RobotFileParser()
    parser.parse((robots_txt or "").splitlines())
    return parser.can_fetch(user_agent, url)


def robots_url_for(page_url: str) -> str:
    """The robots.txt that governs this page."""
    parts = urlsplit(page_url)
    return f"{parts.scheme}://{parts.netloc}/robots.txt"


def fetch_og_image(client, page_url: str, *, robots_cache: dict[str, bool] | None = None) -> str | None:
    """
    One polite attempt at one article's og:image. Returns None on ANY failure, which is a fine outcome.

    `client` is an httpx-like client, injected so the tests never touch the network. The robots cache
    is per-domain and per-night: asking one publisher for its robots.txt sixty times would be its own
    small rudeness.
    """
    cache = robots_cache if robots_cache is not None else {}
    domain = urlsplit(page_url).netloc

    if domain not in cache:
        try:
            response = client.get(
                robots_url_for(page_url),
                headers={"User-Agent": USER_AGENT},
                timeout=TIMEOUT_SECONDS,
            )
            body = response.text if response.status_code == 200 else ""
        except Exception:
            # No robots.txt, or it would not load. A site with no robots.txt has not said no.
            body = ""
        cache[domain] = robots_allow(body, page_url)

    if not cache[domain]:
        return None

    try:
        response = client.get(
            page_url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        if response.status_code != 200:
            return None
        return extract_og_image(response.text[:MAX_BYTES], str(response.url))
    except Exception:
        return None
