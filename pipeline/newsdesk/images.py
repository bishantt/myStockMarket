"""
images.py — every card ships a visual, and none of them is hotlinked (plan 7.9).

TWO NON-NEGOTIABLES DRIVE EVERY DECISION IN THIS FILE.

**We never hotlink a publisher's photo at render time.** Rendering straight from the publisher's URL
rots (they move and expire), leaks the reader's IP address to every publisher on the page, breaks on
referrer blocks, and — the one that decides it — makes the layout shift unknowable, because we never
learn the image's dimensions before it arrives. Fetching once, at INGEST, and storing the width and
height is what lets every card render with its box already the right size. That is how the /news CLS
budget stays at 0.000 rather than merely hoping to.

**Every card ships a visual, and there are no failure states.** Not "most cards" — every card. That
is what the four-rung ladder is for, and rungs 3 and 4 are DESIGNED outcomes rather than apologies: a
publisher-identity card or a catalyst-identity card sits in the same frame, at the same weight, as a
photograph. A reader must be unable to tell which rung answered without being told.

The ladder:
  L1 — the provider's own image field. Answers for nearly everything: 160 of 160 items in the
       recorded market feed carried one, which is better than Appendix A.6 expected.
  L2 — og:image from the article page, when L1 is empty (ogimage.py).
  L3 — the publisher's favicon, composed by the UI onto a generated background.
  L4 — a deterministic catalyst card, built from our own tokens. Needs no network at all, so the
       ladder can ALWAYS reach a rung. There is no fifth outcome and no empty state.

This module owns rungs 1 and 2 and the processing behind them. Rungs 3 and 4 are rendered by the app
(they need no pipeline work beyond recording which rung was reached), which is why `SourceKind` has
only three values that this file can produce.
"""

from __future__ import annotations

import base64
import hashlib
import io
from dataclasses import dataclass

from PIL import Image

# The three variants the app serves, matched to its three slots. Pre-sizing them here is what keeps
# the image-optimization budget cheap on either serving path (Appendix A.6's math).
VARIANTS: dict[str, int] = {
    "full": 1200,   # the story page
    "card": 640,    # the lead card
    "thumb": 240,   # the feed row thumbnail
}

# A candidate below this is a tracking pixel, a spacer, or a logo — not a photograph.
MIN_SOURCE_WIDTH = 200

# JPEG quality for the stored variants. 80 is the knee of the curve: visually indistinguishable from
# 95 on photographs, and roughly a third of the bytes.
JPEG_QUALITY = 80

# The blur placeholder is an 8-pixel-wide JPEG, base64'd into the row (~300 bytes). It is painted
# server-side, so unlike a hash-based placeholder it needs no client JavaScript to appear.
BLUR_WIDTH = 8

# The de-facto og:image aspect ratio, and the frame the cards are cut to.
TARGET_RATIO = 1200 / 630
# Crop to the frame only when the image is already close to it. Beyond this, letterbox instead —
# a hard centre-crop of a portrait photograph chops off the face in it, and a chopped face is a
# worse card than a letterboxed one.
RATIO_TOLERANCE = 0.15


@dataclass(frozen=True)
class ProcessedImage:
    """One article image, fetched, validated, re-encoded, and ready for the bucket."""

    id: str                       # sha1 of the source url — the storage key and the row's id
    source_kind: str              # "provider" (L1) | "og" (L2) | "favicon" (L3)
    variants: dict[str, bytes]    # "full" | "card" | "thumb" → JPEG bytes
    width: int
    height: int
    blur_data_url: str
    dominant_color: str
    attribution_source: str
    attribution_url: str


class UnusableImage(Exception):
    """The candidate was not a usable photograph. This is DATA, not an error — it means the ladder
    falls through to the next rung, which is a designed outcome, not a failure."""


def image_id(source_url: str) -> str:
    """The stable id and storage key for an image: the sha1 of where it came from. Content-addressed
    by origin, so the same photo carried by two outlets is fetched and stored once."""
    return hashlib.sha1(source_url.encode()).hexdigest()


def storage_key(source_url: str, run_month: str, variant: str) -> str:
    """`news/{yyyy-mm}/{sha1}-{width}.jpg` — hashed and immutable, so it can be cached forever."""
    return f"news/{run_month}/{image_id(source_url)}-{VARIANTS[variant]}.jpg"


def process(
    raw: bytes,
    *,
    source_url: str,
    source_kind: str,
    attribution_source: str,
    attribution_url: str,
) -> ProcessedImage:
    """
    Turn raw downloaded bytes into the three variants, the blur placeholder and the dimensions.

    Refuses anything that is not a real, big-enough raster photograph. The refusal is the ladder
    working: a tracking pixel is not a small image, it is not an image, and passing it through would
    put a 1x1 transparent GIF on the front page.

    EXIF is stripped by re-encoding — a news photo's EXIF can carry the photographer's GPS position,
    and there is no reason for this app to store, let alone serve, where a Reuters photographer stood.
    """
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception as exc:  # Pillow raises a wide family; all of them mean "not a usable image".
        raise UnusableImage(f"not a decodable image: {exc}") from exc

    if image.format == "SVG" or image.width < MIN_SOURCE_WIDTH:
        raise UnusableImage(
            f"too small to be a photograph ({image.width}px wide; a tracking pixel or a logo)"
        )

    # A transparent PNG flattened onto white rather than onto black, which is what a naive convert
    # to RGB does — and a logo with a transparent background would arrive as a black rectangle.
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        flattened = Image.new("RGB", image.size, (255, 255, 255))
        flattened.paste(image, mask=image.split()[-1])
        image = flattened
    else:
        image = image.convert("RGB")

    framed = _fit_to_frame(image)

    variants = {
        name: _encode(_resize_to_width(framed, width), JPEG_QUALITY)
        for name, width in VARIANTS.items()
    }

    return ProcessedImage(
        id=image_id(source_url),
        source_kind=source_kind,
        variants=variants,
        width=framed.width,
        height=framed.height,
        blur_data_url=_blur_placeholder(framed),
        dominant_color=_dominant_color(framed),
        attribution_source=attribution_source,
        attribution_url=attribution_url,
    )


def _fit_to_frame(image: Image.Image) -> Image.Image:
    """
    Centre-crop to the card's ratio, but ONLY when the image is already close to it.

    A photograph within 15% of 1.91:1 loses nothing meaningful to a centre crop. A portrait shot
    cropped to a wide frame loses the subject's head, and a card whose photograph has been decapitated
    is worse than a card that letterboxes. Those are left at their own ratio and the app's uniform
    frame handles them with object-fit, which crops visually without destroying the stored file.
    """
    ratio = image.width / image.height
    if abs(ratio - TARGET_RATIO) / TARGET_RATIO > RATIO_TOLERANCE:
        return image

    target_height = round(image.width / TARGET_RATIO)
    if target_height >= image.height:
        return image

    top = (image.height - target_height) // 2
    return image.crop((0, top, image.width, top + target_height))


def _resize_to_width(image: Image.Image, width: int) -> Image.Image:
    """Never upscale. An 800px photo blown up to 1200 is a blurrier 800px photo in a bigger file."""
    if image.width <= width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def _encode(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    # No EXIF is carried across, because the image was re-opened and re-saved from pixels alone.
    image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


def _blur_placeholder(image: Image.Image) -> str:
    """An 8px-wide JPEG as a data URL — what the reader sees for the instant before the photo lands."""
    tiny = _resize_to_width(image, BLUR_WIDTH)
    encoded = base64.b64encode(_encode(tiny, 40)).decode()
    return f"data:image/jpeg;base64,{encoded}"


def _dominant_color(image: Image.Image) -> str:
    """The image's average colour, as a hex string. Used as the frame's backing while it loads, so
    the card never flashes white in Midnight."""
    single = image.resize((1, 1), Image.LANCZOS)
    r, g, b = single.getpixel((0, 0))[:3]
    return f"#{r:02x}{g:02x}{b:02x}"


def upload(store, image: ProcessedImage, source_url: str, run_month: str) -> dict[str, str]:
    """
    Put the three variants in the media bucket and return their public URLs.

    `store` is anything with `put_bytes(key, data, content_type)` — the real R2 client in production,
    a fake in tests. P-1 (the media bucket) is not provisioned yet; when it is absent the caller does
    not call this, the cards render the L3/L4 rungs, and the night says so in its stage status.
    """
    urls = {}
    for variant, data in image.variants.items():
        key = storage_key(source_url, run_month, variant)
        urls[variant] = store.put_bytes(key, data, "image/jpeg")
    return urls
