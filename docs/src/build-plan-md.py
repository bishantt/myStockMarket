#!/usr/bin/env python3
"""Generate DEVELOPMENT-PLAN.md from the dp-*.html sources.

Handles exactly the markup vocabulary used in docs/src/dp-*.html.
Usage: python3 docs/src/build-plan-md.py
"""
import html
import re
from html.parser import HTMLParser
from pathlib import Path

SRC = Path(__file__).parent
OUT = SRC.parent.parent / "DEVELOPMENT-PLAN.md"
FILES = sorted(SRC.glob("dp-0*.html"))

HEADER = """<!-- GENERATED from docs/src/dp-*.html — edit those and re-run docs/src/build-plan-md.py.
     The visually polished version of this document is docs/Development-Plan.pdf. -->

"""


class MD(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []          # list of finished blocks
        self.buf = []          # inline text accumulator
        self.stack = []        # open tag context
        self.list_stack = []   # 'ul' | 'ol' with counters
        self.in_table = False
        self.table_rows = []
        self.table_row = None
        self.cell_buf = None
        self.skip_depth = 0    # inside svg/figure-svg/style/toc

    # ---------- helpers ----------
    def text(self, s):
        if self.skip_depth:
            return
        if self.cell_buf is not None:
            self.cell_buf.append(s)
        else:
            self.buf.append(s)

    def flush_para(self, prefix=""):
        raw = "".join(self.buf)
        self.buf = []
        txt = re.sub(r"\s+", " ", raw).strip()
        if txt:
            self.out.append(prefix + txt)

    # ---------- parser hooks ----------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "")
        if self.skip_depth:
            self.skip_depth += 1
            return
        if tag in ("svg", "style", "script") or (tag == "section" and "toc" in cls.split() and "part" not in cls.split()):
            self.skip_depth = 1
            return
        if tag == "section" and "toc" in cls.split():
            self.skip_depth = 1
            return
        self.stack.append((tag, cls))
        if tag == "div" and "cover" in cls.split():
            pass
        if tag in ("h1", "h2", "h3", "h4"):
            self.flush_para()
        if tag == "p":
            self.flush_para()
        if tag == "pre":
            self.flush_para()
            self.buf = []
        if tag in ("ul", "ol"):
            self.flush_para()
            self.list_stack.append([tag, 0])
        if tag == "li":
            self.flush_para()
        if tag == "table":
            self.flush_para()
            self.in_table = True
            self.table_rows = []
        if tag == "caption":
            self.cell_buf = []
        if tag == "tr" and self.in_table:
            self.table_row = []
        if tag in ("td", "th") and self.in_table:
            self.cell_buf = []
        if tag == "code":
            self.text("`")
        if tag == "strong":
            self.text("**")
        if tag == "em":
            self.text("*")
        if tag == "br":
            self.text(" ")
        if tag == "span" and "chip" in cls.split():
            self.text("[")
        if tag == "span" and "co-label" in cls.split():
            self.text("**")
        if tag == "div" and "callout" in cls.split():
            self.flush_para()
            self.out.append("<CALLOUT>")
        if tag == "figure":
            self.flush_para()
            self.out.append("*(Figure — see the PDF version for the rendered diagram.)*")

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= 1
            return
        cls = ""
        if self.stack and self.stack[-1][0] == tag:
            cls = self.stack[-1][1]
            self.stack.pop()
        if tag == "h1":
            self.flush_para("# ")
        elif tag == "h2":
            self.flush_para("## ")
        elif tag == "h3":
            self.flush_para("### ")
        elif tag == "h4":
            self.flush_para("#### ")
        elif tag == "p":
            klass = cls.split()
            if "dek" in klass or "subtitle" in klass:
                raw = re.sub(r"\s+", " ", "".join(self.buf)).strip()
                self.buf = []
                if raw:
                    self.out.append("*" + raw + "*")
            elif "epigraph" in klass:
                raw = re.sub(r"\s+", " ", "".join(self.buf)).strip()
                self.buf = []
                if raw:
                    self.out.append("> " + raw)
            else:
                self.flush_para()
        elif tag == "pre":
            raw = "".join(self.buf)
            self.buf = []
            self.out.append("```\n" + raw.strip("\n") + "\n```")
        elif tag in ("ul", "ol"):
            self.flush_para()
            if self.list_stack:
                self.list_stack.pop()
        elif tag == "li":
            kind = self.list_stack[-1][0] if self.list_stack else "ul"
            if kind == "ol":
                self.list_stack[-1][1] += 1
                self.flush_para(f"{self.list_stack[-1][1]}. ")
            else:
                self.flush_para("- ")
        elif tag == "caption":
            txt = re.sub(r"\s+", " ", "".join(self.cell_buf)).strip()
            self.cell_buf = None
            if txt:
                self.out.append("**" + txt + "**")
        elif tag in ("td", "th"):
            txt = re.sub(r"\s+", " ", "".join(self.cell_buf)).strip().replace("|", "\\|")
            if self.table_row is not None:
                self.table_row.append(txt)
            self.cell_buf = None
        elif tag == "tr" and self.in_table:
            if self.table_row is not None:
                self.table_rows.append(self.table_row)
            self.table_row = None
        elif tag == "table":
            self.in_table = False
            if self.table_rows:
                w = max(len(r) for r in self.table_rows)
                rows = [r + [""] * (w - len(r)) for r in self.table_rows]
                lines = ["| " + " | ".join(rows[0]) + " |",
                         "|" + "|".join([" --- "] * w) + "|"]
                for r in rows[1:]:
                    lines.append("| " + " | ".join(r) + " |")
                self.out.append("\n".join(lines))
            self.table_rows = []
        elif tag == "code":
            self.text("`")
        elif tag == "strong":
            self.text("**")
        elif tag == "em":
            self.text("*")
        elif tag == "span" and "chip" in cls.split():
            self.text("]")
        elif tag == "span" and "co-label" in cls.split():
            self.text(":** ")
        elif tag == "div" and "callout" in cls.split():
            self.flush_para()
            # convert everything since <CALLOUT> into a blockquote
            try:
                i = len(self.out) - 1 - self.out[::-1].index("<CALLOUT>")
                body = self.out[i + 1:]
                self.out = self.out[:i]
                merged = " ".join(body)
                self.out.append("> " + merged)
            except ValueError:
                pass
        elif tag == "section":
            self.flush_para()
            self.out.append("\n---\n")

    def handle_data(self, data):
        self.text(data)


def convert():
    md = MD()
    for f in FILES:
        md.feed(f.read_text())
    md.flush_para()
    blocks, prev_rule = [], False
    for b in md.out:
        if b == "\n---\n":
            if prev_rule:
                continue
            prev_rule = True
        else:
            prev_rule = False
        blocks.append(b)
    body = "\n\n".join(blocks)
    body = re.sub(r"\n{3,}", "\n\n", body)
    OUT.write_text(HEADER + body + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    convert()
