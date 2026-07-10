# LESSONS.md — mistakes and their guards

Read at session start after CLAUDE.md (plan §9.2). A lesson that repeats means the guard was
inadequate — escalate it to a test or a skill. Write each lesson in plain English so a future
session (or the user) understands it without context (CLAUDE.md, "Readability & documentation").
Format:

```
YYYY-MM-DD · symptom → root cause → fix → guard added
```

---

(no entries yet — no build sessions have run)
2026-07-10 · The font-budget check reported "no latin fonts found" on a build that clearly had fonts → I assumed the `unicode-range: U+0000-00FF` that Google Fonts serves survives into the built CSS, but Next's minifier rewrites it to the wildcard `U+??`; a second bug hid behind it, a `\b` word boundary that can never match after a `?` because both sides are non-word characters → the check now accepts all three spellings of the latin range (`U+??`, `U+0000-00FF`, `U+0-FF`) and the regex was tested against real values from the build before being trusted → guard added: the script exits non-zero when it finds ZERO latin faces, so "found nothing" can never masquerade as "budget met"; both its pass and fail paths were exercised deliberately.

2026-07-10 · `node -v` reported 20.20.0 in every shell even after `nvm install 24 && nvm alias default 24` → Claude Code itself runs on Node 20 and exports its own bin directory into the PATH of every command it spawns, which shadows nvm's default before nvm.sh ever runs → build and test commands prepend the Node 24 bin directory to PATH explicitly → guard added: `.nvmrc` (24) and `"engines": {"node": ">=24"}` in app/package.json, so CI and any human shell fail loudly rather than silently building on the wrong runtime.

2026-07-10 · Twelve of the seventeen colour tokens were missing from the built CSS while five were present → Tailwind v4 tree-shakes `@theme` variables that no utility class references, and only the five used directly in plain CSS survived; the chart hook (plan §3.7) reads `--color-ink`/`--color-up`/`--color-down` off computed styles at runtime, which Tailwind cannot see → `@theme static` forces every variable to be emitted → guard added: the phase-exit token grep now asserts all seventeen §3.3 hexes are present in the built stylesheet, so a silent token deletion fails the gate.
