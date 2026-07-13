"""Tests for rung 2 of the image ladder — the article's own og:image."""

import httpx

from newsdesk import ogimage


PAGE = """
<html><head>
  <meta property="og:title" content="A headline">
  <meta property="og:image" content="/media/photo.jpg">
  <meta name="twitter:image" content="https://cdn.example.com/tw.jpg">
</head><body>...</body></html>
"""


def test_reads_the_og_image_and_resolves_a_relative_url_against_the_page():
    """Publishers write both absolute and relative URLs. A relative one stored verbatim is a URL that
    resolves to nothing from our side."""
    found = ogimage.extract_og_image(PAGE, "https://news.example.com/story/123")
    assert found == "https://news.example.com/media/photo.jpg"


def test_falls_back_to_twitter_image_when_there_is_no_og_image():
    html = '<head><meta name="twitter:image" content="https://cdn.example.com/tw.jpg"></head>'
    assert ogimage.extract_og_image(html, "https://x.com/a") == "https://cdn.example.com/tw.jpg"


def test_a_page_that_declares_no_image_says_so_rather_than_guessing():
    assert ogimage.extract_og_image("<html><head><title>x</title></head></html>", "https://x.com") is None
    assert ogimage.extract_og_image("", "https://x.com") is None


def test_a_site_that_says_no_gets_a_no():
    """The ladder has a designed rung for exactly this, which is what makes honouring robots.txt
    cost us a designed card rather than a blank one."""
    robots = "User-agent: *\nDisallow: /premium/"

    assert not ogimage.robots_allow(robots, "https://x.com/premium/story")
    assert ogimage.robots_allow(robots, "https://x.com/markets/story")


def test_a_site_with_no_robots_file_has_not_said_no():
    assert ogimage.robots_allow("", "https://x.com/anything")


def test_it_identifies_itself_on_every_request():
    """An anonymous scraper is a different thing from a link preview, and the difference is whether
    the publisher can find you."""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("user-agent"))
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="")
        return httpx.Response(200, text=PAGE)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    ogimage.fetch_og_image(client, "https://news.example.com/story/123")

    assert seen
    assert all(agent.startswith("msm-newsdesk/") for agent in seen)
    assert all("+https://" in agent for agent in seen), "the UA must say where to complain"


def test_one_robots_fetch_per_domain_not_one_per_article():
    """Asking one publisher for its robots.txt sixty times in a night is its own small rudeness."""
    robots_hits = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            robots_hits.append(str(request.url))
            return httpx.Response(200, text="")
        return httpx.Response(200, text=PAGE)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    cache: dict[str, bool] = {}
    for n in range(5):
        ogimage.fetch_og_image(client, f"https://news.example.com/story/{n}", robots_cache=cache)

    assert len(robots_hits) == 1


def test_any_failure_returns_none_because_a_failure_here_is_data():
    def dead(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="")
        return httpx.Response(404, text="gone")

    client = httpx.Client(transport=httpx.MockTransport(dead))
    assert ogimage.fetch_og_image(client, "https://news.example.com/story/1") is None
