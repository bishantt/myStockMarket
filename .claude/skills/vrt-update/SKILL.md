# vrt-update

**Status:** minted 2026-07-12 during the UI redesign (R1), when the visual-regression suite
became real.

**When to use:** whenever a change moves pixels — and, more importantly, whenever CI tells you a
change moved pixels that you did not expect it to.

---

## The one rule

**An intentional restyle updates its baselines in the same commit, with the reason in the commit
body. An UNEXPLAINED diff is a build failure, full stop.**

That distinction is the entire value of the suite. The moment baselines get regenerated
reflexively to make CI green, the VRT stops being an oracle and becomes a chore that costs
minutes and catches nothing. The question is never "how do I make this pass". It is:

> Did I mean to change what this looks like?

If yes → update the baseline, and say why.
If no → you have found a bug. Go and look at the diff image.

---

## CI is the pixel oracle

Baselines are generated on **Linux, in CI** — never on a developer's machine. macOS rasterises
fonts differently, so a locally-shot baseline fails in CI on antialiasing alone, and maintaining
two sets for one developer is pure cost (Appendix E-7).

**Locally**, run the behavioural assertions and skip the pixel comparison:

```bash
npm run e2e:local        # playwright test --ignore-snapshots
```

**To regenerate baselines** after an intentional restyle:

```bash
gh workflow run ci.yml -f job=vrt-baselines
# then, when it finishes:
gh run download <run-id> -n vrt-baselines -D app/e2e/vrt.spec.ts-snapshots
git add app/e2e/vrt.spec.ts-snapshots
git commit -m "…

VRT: 14 baselines updated — the Academy's cards became solid paper (R5)."
```

**To read a failure**, the diff images are in the CI artifact `playwright-report` (uploaded on
failure). Look at the triptych — expected, actual, diff — before you touch anything.

---

## What makes the shots deterministic

Four things, and each of them was a flake before it was a rule:

1. **Reduced motion, forced** (`contextOptions: { reducedMotion: "reduce" }`) — kills route fades
   and entrance transitions.
2. **Fonts awaited INSIDE the page.** `await page.evaluate(async () => { await
   document.fonts.ready; })`. Returning the bare `FontFaceSet` from `evaluate` serialises to
   junk, and the shot fires before the type lands.
3. **Timestamps masked.** Every `time` element and every `[data-vrt="mask"]` node is masked. They
   are honest, load-bearing content — this product stamps everything — but they encode wall-clock
   time, so they would differ on every run and make every baseline a false positive.
4. **Seeded data** (`MSM_SEEDED=1`). The numbers come from `prisma/seed.mjs`, so a diff means a
   STYLE change, never a data change.

---

## The trap this suite already fell into once

The "fonts blocked" shot — the one that locks the pre-swap fallback layout — was passing while
testing **nothing**. Signing in first loaded the fonts into the browser's memory cache, so the
later navigation made no network request, the route interception never fired, and the
"fonts-blocked" screenshot was quietly an ordinary one. It was byte-identical to its neighbour,
which is what gave it away.

It now asserts that it actually intercepted something, and it lives in its own no-sign-in
describe block.

**The lesson generalises:** a visual test that cannot fail is worse than no visual test, because
it costs the same to run and buys a false sense of coverage. When you add a shot that is supposed
to capture an *unusual* state (offline, fonts blocked, an error boundary, an empty table), assert
that the unusual state actually happened.
