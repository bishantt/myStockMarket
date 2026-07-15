# vrt-update

**Status:** minted 2026-07-12 during the UI redesign (R1), when the visual-regression suite
became real. **Rewritten 2026-07-13 (GATE-EFFICIENCY-PLAN G1)**: the oracle now runs on demand
before any tag exists, it runs as sharded legs (four since PD3 added `mbp16`), and a run that reds
on pixels mints its own candidate baselines. The one rule below did not change and never will.

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

Never run `--update-snapshots` on this Mac. It would rewrite all 76 baselines in macOS
rasterisation and every one of them would then fail in CI.

---

## The normal flow (since G1): rehearse, and let the failing run mint

You no longer tag to find out. Run the oracle on the SHA you are about to tag:

```bash
gh workflow run ci.yml -f job=e2e          # main's HEAD, or --ref <branch> for a scratch branch
gh run watch <run-id>
```

It runs as **four legs** — `desktop`, `phone`, `wide`, `mbp16` (the fourth added at PD3) — each its
own job, its own database, its own artifacts. `fail-fast` is off, so one red leg does not hide the
others.

**If a leg reds on pixels**, that run has already done the work for you. It uploads two things per
leg:

| artifact | what it is |
|---|---|
| `playwright-failures-<leg>` | the **triptych** — expected, actual, diff. This is what you look at. |
| `vrt-baselines-candidate-<leg>` | the **candidate** baselines, freshly shot. Only appears if a snapshot comparison actually failed. |

The candidate is minted only when `test-results/**/*-actual.png` exists — the precise witness of a
pixel diff. A red *assertion* does not mint, because it must not spend four minutes photographing.

### THE CANDIDATE IS A FULL RE-PHOTOGRAPH, NOT A LIST OF WHAT CHANGED

**Do not copy the whole candidate over your baselines.** Measured on 2026-07-13 (G1), with a
controlled one-line change to `/styleguide` and nothing else:

| | desktop leg | phone leg |
|---|---|---|
| shots that actually **failed** the comparison | 2 (`styleguide-light`, `styleguide-dark`) | 2 (same) |
| files that came back **byte-different** in the candidate | **6** | **5** |

The extra four (`desk-light`, `desk-dark`, `ticker-dark`, `track-record-light`) *cannot* have
changed — the edit was in `app/app/styleguide/page.tsx`, which no other room imports. They passed
their comparison, silently and correctly, inside the 600-pixel tolerance. They came back different
anyway because `--update-snapshots=all` re-photographs **every** baseline from what the page renders
right now, and rasterisation jitters a few dozen pixels between runs.

That is the price of `=all`, and `=all` stays (it is an untouchable — it is the only reason a real
change that hides inside the tolerance gets caught). But it means the candidate directory is
**every** shot, not the shots that moved.

Copy the whole thing and you commit four files you cannot explain — which breaks the one rule at the
top of this page. **The triptych is the list of what moved. The candidate is where you fetch it
from.**

**`scripts/vrt-diff.mjs` mechanises "diff every candidate".** Run from `app/`, it decodes every PNG
in a downloaded candidate directory against its committed twin and prints the differing-pixel count
(perceptual, threshold 0.1) — resizes and new shots first, then changed, then unchanged. That is the
CLAUDE.md VRT law ("decode both, count differing pixels") as a committed command instead of a
hand-roll, and it surfaces the shot that MOVED but passed inside the 600-pixel tolerance — the
byte-different-but-not-failed rows above, which the failures-only triptych never shows you.

```bash
cd app
node scripts/vrt-diff.mjs /tmp/vrt-candidates/vrt-baselines-candidate-desktop
```

### Getting them, and the flag that will trip you up

`gh run download` extracts **each artifact into its own subdirectory** when more than one matches.
Only a single named artifact lands flat in `-D` (checked against `gh run download --help`, gh 2.96).
So: download to a scratch directory, look, and copy only what the failures name.

```bash
cd app
gh run download <run-id> -p 'playwright-failures-*'      -D /tmp/vrt-failures
gh run download <run-id> -p 'vrt-baselines-candidate-*'  -D /tmp/vrt-candidates
# → /tmp/vrt-candidates/vrt-baselines-candidate-desktop/*.png   (and -phone, -wide)

# 1. WHAT MOVED? Every failed shot leaves a triptych. This is the list, and it is the only list.
find /tmp/vrt-failures -name '*-diff.png' | sed 's|.*/||' | sort -u

# 2. LOOK AT EVERY ONE. expected | actual | diff. Can you say why it moved?
#    If you cannot: you have found a bug. Stop. Do not update anything.

# 3. Take ONLY those, from the candidate, for the leg that shot them:
cp /tmp/vrt-candidates/vrt-baselines-candidate-desktop/styleguide-light-desktop-linux.png \
   e2e/vrt.spec.ts-snapshots/
#    …one line per shot the triptych named. Tedious on purpose: each line is a thing you explained.

git status --short e2e/vrt.spec.ts-snapshots/    # must match the triptych list exactly
git commit -m "…

VRT: 4 baselines updated — the styleguide sections gained a step of air (gap-12 → gap-14)."
```

The legs cannot collide when flattened: Playwright stamps the project into every filename
(`styleguide-light-desktop-linux.png`), which is also why each candidate artifact carries only its
own leg's files.

---

## The deliberate mint (still here, for a restyle you have already decided on)

When you *know* you moved pixels and want green baselines before you rehearse:

```bash
gh workflow run ci.yml -f job=vrt-baselines
gh run download <run-id> -n vrt-baselines -D app/e2e/vrt.spec.ts-snapshots   # single artifact → flat
```

This is now the exception, not the path. The rehearsal mints for you when it finds a diff, and the
diff is the thing you wanted to see anyway.

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
