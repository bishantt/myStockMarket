"""
comment_stats.py — measures comment density per directory and per file (LEAN-CODEBASE Part 2).

This is the instrument behind the LEAN-CODEBASE plan's numbers. It exists so LC3's "we roughly
halved the comment mass of the hot files, and every why survived" is a reproducible measurement
rather than folklore: run it before a compression batch, run it after, diff the two tables.

WHAT COUNTS AS A COMMENT LINE, and why the method is fussy about it:
  - Python: a full-line comment (the `#` line has no code before it) found via the `tokenize`
    module, plus docstring lines found via `ast`. Both are used on purpose. A `#` inside a string
    ("price is #1") is not a comment, and a triple-quoted string that is an argument is not a
    docstring — a naive regex miscounts both, and the whole point of the plan's measurement is that
    it does not. Inline trailing comments (`x = 1  # why`) are deliberately NOT counted: the line is
    mostly code, and compressing it does not save a line.
  - C-family (ts, tsx, js, mjs, cjs, css, scss): a character state-machine walks the file tracking
    string / template / line-comment / block-comment state, then a line counts only if it holds
    comment characters and no code. `//` inside a string or a `/* */` that spans ten lines are both
    handled; JS has no `//` operator, so outside a string `//` is always a comment.
  - prisma / yaml: line-prefix only (`//` for prisma, `#` for yaml) — no tokenizer, and none needed.

The C-family scanner tracks JS regex literals (a drift checker is full of them, and the quotes
inside a regex would otherwise flip the scanner into a false "string" state and swallow every
comment after it). Accepted approximation, vanishingly rare here: a comment inside a template's
interpolation reads as string.

Usage:
  uv run python -m scripts.comment_stats            # the Part 2 directory table + top-25 files
  uv run python -m scripts.comment_stats <path>...  # measure only the given files or directories
"""

from __future__ import annotations

import ast
import io
import sys
import tokenize
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# The directory groups of Part 2's table, in its order. Measured as whole trees.
DIRECTORY_GROUPS = [
    "app/components",
    "app/lib",
    "app/app",
    "app/scripts",
    "app/e2e",
    "pipeline",
    "app/prisma",
]

C_FAMILY = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss"}
LINE_PREFIX = {".prisma": "//", ".yml": "#", ".yaml": "#", ".sql": "--", ".toml": "#"}
MEASURABLE = {".py"} | C_FAMILY | set(LINE_PREFIX)

# Vendored or byte-code trees only; generated source (prisma migrations) is still hand-readable and
# is counted, matching Part 2's file census.
SKIP_DIRS = {"node_modules", ".next", "__pycache__", ".venv", "dist"}

# In JS a `/` opens a regex only in expression position — after one of these characters, never after
# a value (identifier, `)`, `]`, number, string). The empty string covers the start of the file.
# `<` and `>` are deliberately absent: no valid code starts a regex after them, and including them
# would read every JSX closing tag `</div>` as the start of a regex.
REGEX_BEFORE = set("=(,[{;:!&|?+-*/%^~") | {""}


def _python_comment_lines(source: str) -> int:
    """Full-line `#` comments (via tokenize) plus docstring lines (via ast), counted once each."""
    comment_lines: set[int] = set()
    docstring_lines: set[int] = set()
    source_lines = source.splitlines()

    try:
        for tok in tokenize.generate_tokens(io.StringIO(source).readline):
            if tok.type == tokenize.COMMENT:
                row, col = tok.start
                if row <= len(source_lines) and source_lines[row - 1][:col].strip() == "":
                    comment_lines.add(row)
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass  # a partial/odd file still yields its docstring count below

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return len(comment_lines)

    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        body = getattr(node, "body", None)
        if not body:
            continue
        first = body[0]
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            for line in range(first.value.lineno, (first.value.end_lineno or first.value.lineno) + 1):
                docstring_lines.add(line)

    return len(comment_lines | docstring_lines)


def _cfamily_comment_lines(source: str) -> int:
    """A per-line verdict from a whole-file scan: a line is a comment line if it holds comment
    characters and no code. State carries across lines so block comments and templates are honest."""
    lines = source.split("\n")
    has_code = [False] * len(lines)
    has_comment = [False] * len(lines)

    NORMAL, LINE_COMMENT, BLOCK_COMMENT, SQ, DQ, TMPL, REGEX = range(7)
    state = NORMAL
    row = 0
    i = 0
    n = len(source)
    last_sig = ""  # last significant code character, for the regex-vs-division decision
    in_char_class = False  # inside a regex [...], where `/` does not close the literal

    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if ch == "\n":
            if state == LINE_COMMENT:
                state = NORMAL  # a line comment dies at the newline; strings/blocks live on
            row += 1
            i += 1
            continue

        if state == NORMAL:
            if ch == "/" and nxt == "/":
                has_comment[row] = True
                state = LINE_COMMENT
                i += 2
                continue
            if ch == "/" and nxt == "*":
                has_comment[row] = True
                state = BLOCK_COMMENT
                i += 2
                continue
            if ch == "/" and last_sig in REGEX_BEFORE:
                has_code[row] = True
                state = REGEX
                in_char_class = False
                last_sig = "/"
                i += 1
                continue
            if ch == "'":
                state = SQ
            elif ch == '"':
                state = DQ
            elif ch == "`":
                state = TMPL
            if not ch.isspace():
                has_code[row] = True
                last_sig = ch
            i += 1
            continue

        if state == LINE_COMMENT:
            has_comment[row] = True
            i += 1
            continue

        if state == BLOCK_COMMENT:
            has_comment[row] = True
            if ch == "*" and nxt == "/":
                state = NORMAL
                i += 2
                continue
            i += 1
            continue

        if state == REGEX:
            has_code[row] = True
            if ch == "\\":
                i += 2
                continue
            if ch == "[":
                in_char_class = True
            elif ch == "]":
                in_char_class = False
            elif ch == "/" and not in_char_class:
                state = NORMAL
                last_sig = "/"  # a completed regex is a value; a following `/` is division
            i += 1
            continue

        # inside a string of some kind: a backslash escapes the next character
        if not ch.isspace():
            has_code[row] = True
        if ch == "\\":
            i += 2
            continue
        if (state == SQ and ch == "'") or (state == DQ and ch == '"') or (state == TMPL and ch == "`"):
            last_sig = ch  # a closed string is a value
            state = NORMAL
        i += 1

    return sum(1 for r in range(len(lines)) if has_comment[r] and not has_code[r])


def _line_prefix_comment_lines(source: str, prefix: str) -> int:
    """Whole-line comments only: a line whose first non-whitespace text is `prefix`."""
    return sum(1 for line in source.splitlines() if line.lstrip().startswith(prefix))


def measure_file(path: Path) -> tuple[int, int]:
    """Return (total_lines, comment_lines) for one source file; (0, 0) if it cannot be read."""
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return (0, 0)
    total = len(source.splitlines())
    suffix = path.suffix
    if suffix == ".py":
        return (total, _python_comment_lines(source))
    if suffix in C_FAMILY:
        return (total, _cfamily_comment_lines(source))
    if suffix in LINE_PREFIX:
        return (total, _line_prefix_comment_lines(source, LINE_PREFIX[suffix]))
    return (total, 0)


def _iter_source_files(root: Path):
    """Every measurable source file under root, skipping generated and vendored trees."""
    if root.is_file():
        if root.suffix in MEASURABLE:
            yield root
        return
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in MEASURABLE:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        yield path


def _rel(path: Path) -> str:
    """A repo-relative label when the path is under the repo, else the path as given."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _measure_tree(root: Path) -> tuple[int, int, int, list[tuple[str, int]]]:
    """Aggregate a tree: (file_count, total_lines, comment_lines, per-file comment counts)."""
    files = 0
    total = 0
    comments = 0
    per_file: list[tuple[str, int]] = []
    for path in _iter_source_files(root):
        f_total, f_comments = measure_file(path)
        files += 1
        total += f_total
        comments += f_comments
        per_file.append((_rel(path), f_comments))
    return files, total, comments, per_file


def _print_table(rows: list[tuple[str, int, int, int]]) -> None:
    print(f"{'directory':<20} {'files':>6} {'lines':>8} {'comment+doc':>12} {'%':>6}")
    print("-" * 56)
    for name, files, total, comments in rows:
        pct = (comments / total * 100) if total else 0.0
        print(f"{name:<20} {files:>6} {total:>8} {comments:>12} {pct:>5.1f}%")


def main(argv: list[str]) -> int:
    targets = [Path(a).resolve() for a in argv] if argv else [REPO_ROOT / g for g in DIRECTORY_GROUPS]

    table: list[tuple[str, int, int, int]] = []
    all_files: list[tuple[str, int]] = []
    for target in targets:
        if not target.exists():
            print(f"skip (missing): {target}", file=sys.stderr)
            continue
        files, total, comments, per_file = _measure_tree(target)
        table.append((_rel(target), files, total, comments))
        all_files.extend(per_file)

    _print_table(table)

    print("\nTop 25 files by comment mass:")
    for name, count in sorted(all_files, key=lambda x: (-x[1], x[0]))[:25]:
        print(f"  {count:>5}  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
