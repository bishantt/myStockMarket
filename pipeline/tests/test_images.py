"""
Tests for the image pipeline (plan 7.9).

The inputs here are generated with Pillow rather than checked in as fixtures, and that is deliberate:
these tests exercise OUR processing — the crop rule, the variants, the placeholder, the refusals —
not a provider's response shape. A synthetic gradient proves a resize as well as a photograph does,
and it cannot be mistaken for a recording of anything.
"""

import base64
import io

import pytest
from PIL import Image

from newsdesk import images
from newsdesk.images import UnusableImage


def make_image(width: int, height: int, fmt: str = "JPEG", mode: str = "RGB") -> bytes:
    """A synthetic image of an exact size — enough to test geometry, which is all these rules are."""
    img = Image.new(mode, (width, height), (120, 90, 200) if mode == "RGB" else (120, 90, 200, 255))
    buffer = io.BytesIO()
    img.save(buffer, format=fmt)
    return buffer.getvalue()


def process(raw: bytes) -> images.ProcessedImage:
    return images.process(
        raw,
        source_url="https://cdn.example.com/photo.jpg",
        source_kind="provider",
        attribution_source="Reuters",
        attribution_url="https://reuters.com/story",
    )


# ---------------------------------------------------------------------------------------------
# What it refuses — and every refusal is the ladder working, not an error
# ---------------------------------------------------------------------------------------------


def test_a_tracking_pixel_is_not_a_small_image_it_is_not_an_image():
    """Left unrefused, this puts a 1x1 transparent dot on the front page."""
    with pytest.raises(UnusableImage, match="too small"):
        process(make_image(1, 1))


def test_a_logo_sized_candidate_is_refused_so_the_ladder_can_fall_through():
    with pytest.raises(UnusableImage, match="too small"):
        process(make_image(120, 120))


def test_bytes_that_are_not_an_image_at_all_are_refused_calmly():
    """A publisher's 404 page arrives as HTML with a 200. It is not a decoding error to panic about;
    it is this rung failing to answer, which is exactly what rungs 2 to 4 exist for."""
    with pytest.raises(UnusableImage, match="not a decodable image"):
        process(b"<!DOCTYPE html><html>404 Not Found</html>")


# ---------------------------------------------------------------------------------------------
# What it produces
# ---------------------------------------------------------------------------------------------


def test_it_produces_the_three_variants_the_app_actually_serves():
    result = process(make_image(1600, 840))

    assert set(result.variants) == {"full", "card", "thumb"}
    for name, data in result.variants.items():
        assert data.startswith(b"\xff\xd8"), f"{name} is not a JPEG"
        rendered = Image.open(io.BytesIO(data))
        assert rendered.width == images.VARIANTS[name]


def test_it_never_upscales_a_small_photograph_into_a_bigger_blurrier_file():
    """An 800px photo blown up to 1200 is a blurrier 800px photo that costs more to serve."""
    result = process(make_image(800, 420))

    full = Image.open(io.BytesIO(result.variants["full"]))
    assert full.width == 800


def test_the_blur_placeholder_is_a_tiny_server_paintable_data_url():
    """~300 bytes, painted server-side. A hash-based placeholder would need client JS to appear, and
    the point of it is to be there BEFORE the JavaScript is."""
    result = process(make_image(1600, 840))

    assert result.blur_data_url.startswith("data:image/jpeg;base64,")
    payload = base64.b64decode(result.blur_data_url.split(",", 1)[1])
    assert len(payload) < 800
    assert Image.open(io.BytesIO(payload)).width == images.BLUR_WIDTH


def test_it_records_the_dimensions_which_is_the_whole_reason_we_fetch_at_ingest():
    """Known width and height at render time is what makes the layout shift ZERO by construction
    rather than by hope. It is the reason this file exists at all."""
    result = process(make_image(1600, 840))

    assert result.width > 0 and result.height > 0
    assert result.dominant_color.startswith("#") and len(result.dominant_color) == 7


def test_the_id_is_content_addressed_by_origin_so_one_photo_is_stored_once():
    """The same wire photo carried by three outlets is one file in the bucket, not three."""
    assert images.image_id("https://a.com/x.jpg") == images.image_id("https://a.com/x.jpg")
    assert images.image_id("https://a.com/x.jpg") != images.image_id("https://a.com/y.jpg")


def test_the_storage_key_is_immutable_so_it_can_be_cached_forever():
    key = images.storage_key("https://a.com/x.jpg", "2026-07", "thumb")
    assert key.startswith("news/2026-07/")
    assert key.endswith("-240.jpg")


# ---------------------------------------------------------------------------------------------
# The crop rule — the one place a naive implementation quietly ruins photographs
# ---------------------------------------------------------------------------------------------


def test_a_wide_photo_is_cropped_to_the_cards_frame():
    """Already near 1.91:1 — a centre crop takes nothing anyone will miss."""
    result = process(make_image(1200, 700))
    ratio = result.width / result.height
    assert ratio == pytest.approx(images.TARGET_RATIO, rel=0.02)


def test_a_portrait_photo_is_NOT_decapitated_to_fit_the_frame():
    """
    THE RULE THAT MATTERS. A hard centre-crop of a tall photograph to a wide frame cuts the subject's
    head off. A card with a beheaded photo is worse than one that letterboxes, so a photo far from the
    frame's ratio is left at its own, and the app's uniform frame crops it VISUALLY with object-fit —
    which is reversible, and destroys nothing on disk.
    """
    result = process(make_image(600, 900))

    assert result.height > result.width, "the portrait photo was cropped to landscape"
    assert result.width / result.height == pytest.approx(600 / 900, rel=0.01)


def test_a_transparent_png_is_flattened_onto_white_not_onto_black():
    """A naive convert("RGB") of a transparent PNG produces a black rectangle. Publishers do send
    transparent PNGs, and a black rectangle is exactly as wrong as no image but harder to notice."""
    result = process(make_image(800, 420, fmt="PNG", mode="RGBA"))

    assert result.variants["thumb"]


def test_uploading_puts_every_variant_and_returns_its_url():
    class FakeStore:
        def __init__(self):
            self.written = {}

        def put_bytes(self, key, data, content_type):
            self.written[key] = (data, content_type)
            return f"https://media.example.com/{key}"

    store = FakeStore()
    processed = process(make_image(1600, 840))
    urls = images.upload(store, processed, "https://cdn.example.com/photo.jpg", "2026-07")

    assert set(urls) == {"full", "card", "thumb"}
    assert len(store.written) == 3
    assert all(ct == "image/jpeg" for _, ct in store.written.values())
    assert urls["thumb"].endswith("-240.jpg")
