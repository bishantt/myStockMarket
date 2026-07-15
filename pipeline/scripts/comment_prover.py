"""comment_prover.py — proves a batch of edits changed ONLY comments (LEAN-CODEBASE Part 6 LC3).

LC3 compresses comments in the hot files. Comments do not render, so the only real risk is that a
"comment" edit quietly changes code — a merged identifier (`a/**/b` → `ab`), a moved string, a
deleted machine-read pragma. This tool proves per batch that it did not, mechanically, by three
methods keyed to the file kind, plus a sacred-pattern count guard. A batch that does not prove is
rejected, not explained.

  - TS/TSX/JS/MJS: tokenize old and new with the real TypeScript scanner (skipTrivia drops whitespace
    AND comments); the non-comment token streams must be byte-identical. This is why it catches the
    `a/**/b` merge: removing that block comment fuses two tokens into one, and the streams diverge.
  - Python: `ast.dump` equality after zeroing every docstring out of both trees, PLUS a check that no
    NON-docstring string constant changed. Docstring compression legitimately edits the AST; nothing
    else may, and `#` comments never touch the AST at all.
  - prisma / css / scss / yaml / sql: no tokenizer, so whole-line-deletion-only — every line a diff
    hunk removes or adds must be a comment line in its own file (a full-line comment, or a shortened
    one). A code-bearing line in a hunk is a rejection.

Part 7.1's guard runs on every file kind: the sacred pragma patterns (Part 3.1) must have identical
per-file counts old vs new, and in clock-sensitive trees (Part 3.2) the derived-date comments must too
— those two lists are the comments a token/AST proof would happily let you delete.

Usage:
  uv run python -m scripts.comment_prover [--base <ref>] <path>...   # prove these files vs <ref>
  uv run python -m scripts.comment_prover [--base <ref>]             # prove every changed tracked file
Base defaults to HEAD. Exit 0 iff every file proved.
"""

from __future__ import annotations

import ast
import difflib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "app"

TS_FAMILY = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
# Which TypeScript ScriptKind to parse each suffix as (regex/JSX/template handling depends on it).
TS_SCRIPT_KIND = {".ts": "ts", ".tsx": "tsx", ".jsx": "jsx", ".js": "js", ".mjs": "js", ".cjs": "js"}
CSS_FAMILY = {".css", ".scss"}
LINE_PREFIX = {".prisma": "//", ".yml": "#", ".yaml": "#", ".sql": "--", ".toml": "#"}
SUPPORTED = {".py"} | TS_FAMILY | CSS_FAMILY | set(LINE_PREFIX)

# Read a source file on stdin, PARSE it with the TypeScript compiler, and print its leaf-token stream
# (kind + text) as JSON. The parser — not the raw scanner — is used deliberately: the scanner alone
# cannot tell a regex from a divide or continue a template's `${}` substitution without parser context,
# so it swallows comments into mis-scanned regex/template tokens (check-drift's regexes, morning's
# template strings). A leaf's getText() excludes comment trivia, so two files that differ only in
# comments yield an identical stream. Run from app/ so `typescript` resolves.
_TS_TOKENIZER_JS = r"""
const ts = require('typescript');
const kinds = { ts: ts.ScriptKind.TS, tsx: ts.ScriptKind.TSX, js: ts.ScriptKind.JS, jsx: ts.ScriptKind.JSX };
const scriptKind = kinds[process.env.PROVER_SCRIPTKIND] || ts.ScriptKind.TS;
let src = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { src += d; });
process.stdin.on('end', () => {
  const sf = ts.createSourceFile('input.tsx', src, ts.ScriptTarget.Latest, false, scriptKind);
  const out = [];
  const walk = (node) => {
    // JSDoc `/** */` comments ARE parsed into the tree (unlike `//` and `/* */` trivia); skip the
    // whole JSDoc subtree so a compressed doc comment does not read as a changed token.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = node.getChildren(sf);
    if (kids.length === 0) {
      if (node.kind !== ts.SyntaxKind.EndOfFileToken) out.push([node.kind, node.getText(sf)]);
      return;
    }
    for (const kid of kids) walk(kid);
  };
  walk(sf);
  process.stdout.write(JSON.stringify(out));
});
"""

# Part 3.1 — deleting any of these reds lint / tsc / ruff or flips a test's runtime. Their per-file
# count must not move under compression.
PRAGMA_PATTERNS = {
    "@vitest-environment": re.compile(r"@vitest-environment"),
    "eslint-disable": re.compile(r"eslint-disable"),
    "@ts-expect-error": re.compile(r"@ts-expect-error"),
    "@ts-ignore/@ts-nocheck": re.compile(r"@ts-(?:ignore|nocheck)"),
    "noqa": re.compile(r"#\s*noqa"),
    "type: ignore": re.compile(r"#\s*type:\s*ignore"),
    "prettier-ignore": re.compile(r"prettier-ignore"),
}

# Part 3.2 — the clocks rule's derived-date comments. Guarded only where they live: prose dates in
# ordinary headers ("Amended 2026-07-15") are legitimately compressed and must not trip this.
CLOCK_DATE = re.compile(r"(?://|#)\s*20\d\d-\d\d-\d\d")
CLOCK_TREES = ("prisma/fixtures/", "prisma/seed", "app/prisma/fixtures/", "app/prisma/seed", "e2e/")


class ProofError(RuntimeError):
    """The environment cannot run a proof (missing node/typescript, unparseable base) — not a verdict."""


def _git_show(base: str, relpath: str) -> str | None:
    """The file's contents at <base>, or None if it did not exist there (a new file)."""
    result = subprocess.run(
        ["git", "show", f"{base}:{relpath}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def _changed_files(base: str) -> list[str]:
    """Every tracked file changed since <base>, repo-relative."""
    result = subprocess.run(
        ["git", "diff", "--name-only", base, "--"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def _ts_tokens(source: str, script_kind: str) -> list:
    """The leaf-token stream (kind, text) from the TypeScript parser."""
    result = subprocess.run(
        ["node", "-e", _TS_TOKENIZER_JS],
        cwd=APP_DIR,
        input=source,
        capture_output=True,
        text=True,
        env={**os.environ, "PROVER_SCRIPTKIND": script_kind},
    )
    if result.returncode != 0:
        raise ProofError(f"node/typescript tokenizer failed: {result.stderr.strip()[:400]}")
    return json.loads(result.stdout)


def _prove_ts(old: str, new: str, script_kind: str) -> tuple[bool, str]:
    old_tokens = _ts_tokens(old, script_kind)
    new_tokens = _ts_tokens(new, script_kind)
    if old_tokens == new_tokens:
        return True, f"token streams identical ({len(new_tokens)} tokens)"
    for idx, (o, n) in enumerate(zip(old_tokens, new_tokens)):
        if o != n:
            return False, f"token {idx} diverged: {o!r} → {n!r}"
    return False, f"token count changed: {len(old_tokens)} → {len(new_tokens)}"


def _strip_docstrings(tree: ast.AST) -> ast.AST:
    """Zero every docstring in place so ast.dump ignores their content but keeps everything else."""
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
            first.value.value = ""
    return tree


def _non_docstring_strings(source: str) -> list[str]:
    """Every string constant that is NOT a docstring, in source order — the set compression must not move."""
    tree = ast.parse(source)
    docstring_ids: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        body = getattr(node, "body", None)
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            docstring_ids.add(id(body[0].value))
    strings: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstring_ids:
            strings.append(node.value)
    return strings


def _prove_python(old: str, new: str) -> tuple[bool, str]:
    old_dump = ast.dump(_strip_docstrings(ast.parse(old)))
    new_dump = ast.dump(_strip_docstrings(ast.parse(new)))
    if old_dump != new_dump:
        return False, "ast diverged after removing docstrings — code or a non-docstring string changed"
    if sorted(_non_docstring_strings(old)) != sorted(_non_docstring_strings(new)):
        return False, "a non-docstring string constant changed"
    return True, "ast identical after docstring-normalization; non-docstring strings unchanged"


def _css_comment_map(source: str, allow_line_comment: bool) -> list[bool]:
    """Per line: True iff the line holds comment characters and no code. Tracks strings so a `/*`
    inside `content: "/*"` is not read as a comment, and block comments across lines stay honest."""
    lines = source.split("\n")
    is_comment_only = [False] * len(lines)
    has_code = [False] * len(lines)
    has_comment = [False] * len(lines)
    NORMAL, BLOCK, LINE, SQ, DQ = range(5)
    state = NORMAL
    row = i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if ch == "\n":
            if state == LINE:
                state = NORMAL
            row += 1
            i += 1
            continue
        if state == NORMAL:
            if ch == "/" and nxt == "*":
                has_comment[row] = True
                state = BLOCK
                i += 2
                continue
            if allow_line_comment and ch == "/" and nxt == "/":
                has_comment[row] = True
                state = LINE
                i += 2
                continue
            if ch == '"':
                state = DQ
            elif ch == "'":
                state = SQ
            if not ch.isspace():
                has_code[row] = True
            i += 1
            continue
        if state == BLOCK:
            has_comment[row] = True
            if ch == "*" and nxt == "/":
                state = NORMAL
                i += 2
                continue
            i += 1
            continue
        if state == LINE:
            has_comment[row] = True
            i += 1
            continue
        # inside a string
        if not ch.isspace():
            has_code[row] = True
        if ch == "\\":
            i += 2
            continue
        if (state == DQ and ch == '"') or (state == SQ and ch == "'"):
            state = NORMAL
        i += 1
    for r in range(len(lines)):
        is_comment_only[r] = has_comment[r] and not has_code[r]
    return is_comment_only


def _line_is_comment(line: str, suffix: str) -> bool:
    """A prisma/yaml/sql line is a comment line iff its first non-whitespace text is the prefix."""
    return line.lstrip().startswith(LINE_PREFIX[suffix])


def _prove_whole_line(old: str, new: str, suffix: str) -> tuple[bool, str]:
    """Whole-line-deletion-only: every line a hunk removes or adds must be a comment line."""
    old_lines = old.split("\n")
    new_lines = new.split("\n")
    if suffix in CSS_FAMILY:
        old_is_comment = _css_comment_map(old, allow_line_comment=(suffix == ".scss"))
        new_is_comment = _css_comment_map(new, allow_line_comment=(suffix == ".scss"))
    else:
        old_is_comment = [_line_is_comment(ln, suffix) for ln in old_lines]
        new_is_comment = [_line_is_comment(ln, suffix) for ln in new_lines]

    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        for r in range(i1, i2):
            if not old_is_comment[r]:
                return False, f"removed a non-comment line {r + 1}: {old_lines[r].strip()[:60]!r}"
        for r in range(j1, j2):
            if not new_is_comment[r]:
                return False, f"added a non-comment line {r + 1}: {new_lines[r].strip()[:60]!r}"
    return True, "every changed line is a comment line"


def _sacred_counts(text: str, relpath: str) -> dict[str, int]:
    """Counts of the sacred patterns whose presence a comment proof would not otherwise protect."""
    counts = {name: len(pat.findall(text)) for name, pat in PRAGMA_PATTERNS.items()}
    if any(tree in relpath for tree in CLOCK_TREES):
        counts["clock-date"] = len(CLOCK_DATE.findall(text))
    return counts


def _prove_sacred(old: str, new: str, relpath: str) -> tuple[bool, str]:
    old_counts = _sacred_counts(old, relpath)
    new_counts = _sacred_counts(new, relpath)
    for name, old_n in old_counts.items():
        if new_counts[name] != old_n:
            return False, f"sacred pattern {name!r} count moved {old_n} → {new_counts[name]}"
    guarded = [f"{name}×{n}" for name, n in old_counts.items() if n]
    return True, ("sacred: " + ", ".join(guarded)) if guarded else "sacred: none present"


def prove_file(base: str, relpath: str) -> tuple[str, bool, str]:
    """Return (relpath, proved, message) for one changed file."""
    suffix = Path(relpath).suffix
    if suffix not in SUPPORTED:
        return relpath, True, f"skipped (unsupported suffix {suffix})"
    old = _git_show(base, relpath)
    if old is None:
        return relpath, True, "skipped (new file — nothing to prove against)"
    disk = REPO_ROOT / relpath
    new = disk.read_text(encoding="utf-8")
    if old == new:
        return relpath, True, "unchanged"

    sacred_ok, sacred_msg = _prove_sacred(old, new, relpath)
    if not sacred_ok:
        return relpath, False, sacred_msg

    if suffix == ".py":
        ok, msg = _prove_python(old, new)
    elif suffix in TS_FAMILY:
        ok, msg = _prove_ts(old, new, TS_SCRIPT_KIND[suffix])
    else:
        ok, msg = _prove_whole_line(old, new, suffix)
    return relpath, ok, f"{msg}; {sacred_msg}"


def main(argv: list[str]) -> int:
    base = "HEAD"
    paths: list[str] = []
    it = iter(argv)
    for arg in it:
        if arg == "--base":
            base = next(it, "HEAD")
        else:
            paths.append(arg)

    if paths:
        rels = [str(Path(p).resolve().relative_to(REPO_ROOT)) for p in paths]
    else:
        rels = _changed_files(base)

    print(f"comment_prover — base {base}, {len(rels)} file(s)")
    all_ok = True
    for relpath in rels:
        try:
            name, ok, msg = prove_file(base, relpath)
        except ProofError as exc:
            print(f"  ERROR  {relpath}: {exc}")
            return 2
        mark = "ok  " if ok else "FAIL"
        print(f"  {mark} {name}: {msg}")
        all_ok = all_ok and ok

    print("PROVED — comment-only" if all_ok else "REJECTED — a change was not comment-only")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
