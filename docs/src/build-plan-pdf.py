#!/usr/bin/env python3
"""Generate docs/src/development-plan.html (and the PDF) from the dp-*.html sources.

WHY THIS SCRIPT EXISTS — read this before "simplifying" anything here.

This document used to have TWO hand-maintained HTML copies:

  * docs/src/dp-01..06.html      -> build-plan-md.py -> DEVELOPMENT-PLAN.md   (what everyone reads)
  * docs/src/development-plan.html -> headless Chrome -> docs/Development-Plan.pdf

Nobody decided that. It simply happened, and then the two copies quietly disagreed for a month.
Measured at N7 (2026-07-13): `development-plan.html` contained **not one** of the 2026-07-12
APP-FEEL-PLAN amendments the dp-* files carried. The PDF's route map had no `/scans/[preset]` row,
still promised `force-dynamic` rendering the app had already abandoned, and described a product that
had not existed for a month. The markdown was right and the PDF was wrong, and nothing anywhere said
so — because both files looked authored, current and confident.

**Two sources of truth for one document is not redundancy. It is a slow-motion lie**, and the copy
that gets read least is the one that rots — which is the PDF, the one the user actually opens.

So there is ONE source now: the dp-*.html parts. The markdown is generated from them, and this
script generates the print HTML and the PDF from them too. Edit dp-*.html; run both scripts.

Usage:
    python3 docs/src/build-plan-pdf.py            # regenerate development-plan.html + the PDF
    python3 docs/src/build-plan-pdf.py --html     # the HTML only (no Chrome needed)
"""
import re
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).parent
PARTS = sorted(SRC.glob("dp-0*.html"))
OUT_HTML = SRC / "development-plan.html"
OUT_PDF = SRC.parent / "Development-Plan.pdf"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

BANNER = """<!-- GENERATED from docs/src/dp-*.html by docs/src/build-plan-pdf.py — DO NOT EDIT.
     This file was hand-maintained once, drifted a month behind the dp-* parts, and shipped a PDF
     describing a product that no longer existed. Edit the dp-*.html parts instead, then re-run
     build-plan-pdf.py (this file + the PDF) and build-plan-md.py (DEVELOPMENT-PLAN.md). -->
"""


def build_html() -> str:
    """Concatenate the parts, in order, into the one print document.

    The dp-* files are a single HTML document split across six files, not six documents: dp-01 opens
    it (doctype, head, <body>), dp-02..05 are middle fragments with no body tags at all, and dp-06
    closes </body></html>. So a raw, in-order concatenation IS the complete document — which is the
    same assumption build-plan-md.py makes when it parses them in sequence. Assert it rather than
    trust it, because a part that quietly stopped closing its tags would produce a PDF that looks
    plausible and is missing its second half.
    """
    if not PARTS:
        raise SystemExit("no dp-*.html parts found")

    joined = "\n".join(part.read_text() for part in PARTS)

    for tag, count in (("<!DOCTYPE html>", 1), ("<body>", 1), ("</body>", 1), ("</html>", 1)):
        found = joined.count(tag)
        if found != count:
            raise SystemExit(
                f"the concatenated parts contain {found}×'{tag}', expected {count}. "
                f"The dp-* files must remain ONE document split across files — see this script's docstring."
            )

    return joined.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + BANNER, 1)


def main() -> None:
    html = build_html()
    OUT_HTML.write_text(html)
    print(f"wrote {OUT_HTML} ({len(html):,} bytes, from {len(PARTS)} parts)")

    if "--html" in sys.argv:
        return

    if not Path(CHROME).exists():
        print(f"Chrome not found at {CHROME} — HTML written, PDF skipped.")
        return

    subprocess.run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={OUT_PDF}",
            OUT_HTML.resolve().as_uri(),
        ],
        check=True,
        capture_output=True,
    )
    print(f"wrote {OUT_PDF} ({OUT_PDF.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
