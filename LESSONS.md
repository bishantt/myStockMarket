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

2026-07-10 · My own verification printed "✓ typecheck clean" over a real TypeScript error → I wrote `npm run typecheck 2>&1 | tail -8 && echo "✓ clean"`, and in a pipeline the shell reports the LAST command's status, so `tail` (always 0) masked `tsc` (exit 1) → checks now capture output into a variable and branch on the command's own exit code, never on a pipeline's → guard added: the phase-exit gate runs each step through a `run()` helper that fails loudly; a green tick in the terminal now means the command actually succeeded. A gate that cannot fail is not a gate.

2026-07-10 · `tsc --noEmit` failed on a stale `.next/types/validator.ts` referencing a page I had just deleted → tsconfig includes `.next/types/**/*.ts`, and those generated types outlive the file they describe until the next build → re-running `next build` regenerates them; a fresh CI checkout has no `.next` at all, so the plan's gate order (typecheck before build) is safe there → guard: none needed in CI, but locally, delete `.next` after removing a route rather than trusting an incremental type check.

2026-07-10 · The Playwright smoke test could not find the heading "00 — Pipeline" that was plainly on screen → SectionMasthead wrapped the em-dash separator in `aria-hidden="true"`, and the spaces around it were hidden with it, so the heading's accessible name collapsed to "00Pipeline" — a screen reader announced the index and title as one run-on word → the dash is no longer aria-hidden; every major screen reader is silent on an em dash anyway, while the spaces survive → guard added: the e2e suite locates that heading by its accessible name, so if anyone hides the separator again the test fails. Accessible names are the cheapest a11y check there is, and a test that reads the page the way assistive tech does catches this for free.

2026-07-10 · Two auth e2e tests failed on `getByRole("alert")` resolving to two elements → Next renders its own `role="alert"` route announcer (`#__next-route-announcer__`) into every page, so any bare alert-role locator is ambiguous → the login error carries `data-testid="login-error"` and the tests scope to it → guard: prefer a test id over a role when the framework injects elements with the same role.

2026-07-10 · Every jose signing test failed with "payload must be an instance of Uint8Array" → the tests ran under jsdom (the config default, correct for component tests), and jsdom's TextEncoder returns a Uint8Array from a different JS realm, so jose's `instanceof` check rejects it → lib/auth.test.ts declares `// @vitest-environment node`, which is also simply true: auth runs on the server, in the proxy and a server action, never in a browser → guard: server-only modules get the node environment; the error message points at the payload but the cause is the realm.
