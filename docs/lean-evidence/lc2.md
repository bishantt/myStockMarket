# LC2 — consolidation

**Tag `lc-2`. Second phase of LEAN-CODEBASE-PLAN.md (Plan B), `lc-1`…`lc-3`.** Executed 2026-07-15 by
Claude Opus 4.8, one phase per session. LC2 is a behavior-preserving consolidation: one e2e session
helper, an importable `waitForLayout`, deduped guard plumbing, and the recorder workflow reconciled
with its skill. It changes no rendered pixel and no e2e behavior — the login is byte-for-byte the same.

## What LC2 did

| Item | Plan | Proof |
|------|------|-------|
| One e2e session helper — `app/e2e/session.ts` (`USER`, `PASSWORD`, `signIn`) | 5.1 | All 24 login-bearing specs import it (table below); `brand` and `pwa` never sign in and are untouched. typecheck + lint green; desktop e2e run 75 passed. |
| `waitForLayout` becomes importable — `app/e2e/layout.ts` | 5.2 | Moved out of `grid.spec.ts`, exported. `grid.spec.ts` imports it; removing the block re-seated the `stations` doc onto `stations`. CLAUDE.md's grid law is now an import, not a copy-paste. |
| Guard plumbing dedupes — `app/scripts/lib/session-cookie.mjs` + `manifest.mjs` | 5.3 | Identity diffs below. Every threshold/allowlist/verdict stays in its guard. |
| `record-fixtures.yml` reconciled with the `new-provider-adapter` skill | 5.6 | The 6 missing KEYED recorders added as steps; the 2 keyless ones left to run locally (the skill's actual rule). |

## 5.1 — the session helper: all 24 login-bearing specs import it

`app/e2e/session.ts` exports `USER`, `PASSWORD`, and `signIn` (goto `/login` → fill → click → the
closing `toHaveURL("/")` that doubles as the wait for the post-login redirect).

| import from `./session` | specs | count |
|-------------------------|-------|-------|
| `signIn` only | a11y, academy, briefing, control-room, desk, drill, grid, hardening, nav-timing, nav, news, overlay, paper, pipeline-strip, scans, settings, setup-cards, theme, ticker-range, track-record, voice, vrt | 22 |
| `signIn, USER, PASSWORD` | auth (keeps 3 inline logins — one lands on `/styleguide`, two are failure paths) | 1 |
| `USER, PASSWORD` only | offline (keeps its own `signIn`: it waits for `navigator.serviceWorker.ready` before filling, load-bearing for the offline-cache tests) | 1 |
| — (no login) | brand, pwa | 2 |

**Total: 24 of 26 specs import the helper.** `offline` is the one spec that keeps a local `signIn`,
exactly as the plan carved out `vrt`'s `shoot()` mouse-parking — a login that genuinely differs is
preserved, not forced through the shared one.

**A finding, logged in DECISIONS.md:** the plan's 5.1 said `signIn` was "byte-identical in 15 spec
files." Measured, it was byte-identical in 12; `nav` differed only by a cosmetic type annotation,
`auth` omitted the final URL assert, and `offline` carried the extra service-worker wait. The
extraction took the true common shape and preserved the three variants' behavior — "identical N
copies" is a hypothesis to verify, not a fact to extract on.

## 5.3 — guard-plumbing identity, proven before/after on the same build

`app/scripts/lib/session-cookie.mjs` — `mintSessionCookie(secret, { username, ttlSeconds })`, one
copy where `check-nav`, `check-live` and `lighthouse-check` each had their own. **A finding:** the
three were NOT identical — `check-live` uses a one-hour TTL, the other two thirty days — so the helper
takes `ttlSeconds` (default 30 days; `check-live` passes one hour). `app/scripts/lib/manifest.mjs` —
`readRoutesManifest()` (the `lib/routes-manifest.json` read shared by `check-nav` + `check-bundles`)
and `routeInventory()` (the `app/**/page.tsx` walk shared by `check-routes` + `check-bundles`, whose
own comment already read "same inventory rule as check-routes.mjs").

Proof of preservation, on the same built `.next` (gating mode, deterministic — no timestamps):

| guard | BEFORE vs AFTER stdout | exit |
|-------|------------------------|------|
| `check:routes` | **byte-identical** (`diff` empty) | 0 → 0 |
| `check:bundles` | **byte-identical** (`diff` empty) | 0 → 0 |

The network guards (`check:nav`, `check:live`, `lighthouse-check`) never print the cookie and their
stdout is non-deterministic (live latency), so the cookie change is proven the honest way instead:
with the clock pinned, the extracted `mintSessionCookie` produces a **byte-identical token** to the
old inline mint, for BOTH TTLs (30-day and 1-hour). And `check:live` was run live against production
and passed all 7 checks (masthead · board · index honesty · calendar · press-time · byline links ·
next-edition) — the extracted 1-hour cookie opens the wall exactly as before.

## 5.6 — the recorder workflow reconciled with its skill

The `new-provider-adapter` skill's real rule (steps 9–14): a KEYLESS recorder runs from the laptop; a
KEYED one records from Actions and joins `record-fixtures.yml`'s steps (its key lives only in
secrets). The workflow had 3 keyed recorders as steps and 8 recorders adrift. Classified against
`gh secret list`:

- **Added as steps (6 keyed, every secret provisioned):** `record_alpaca` (ALPACA_KEY_ID/SECRET),
  `record_edgar` (EDGAR_USER_AGENT), `record_finnhub` (FINNHUB_KEY), `record_fmp` (FMP_KEY),
  `record_fred_calendar` (FRED_KEY), `record_marketaux` (MARKETAUX_KEY). The workflow now holds all
  9 keyed recorders; YAML parses to 13 steps.
- **Correctly NOT steps (2 keyless):** `record_erapi`, `record_nrb` — neither reads a key, so both
  record from the laptop per the skill. Leaving them out is the skill working, not drift.

Amending the skill to "recorders run locally" (the plan's other option) was rejected: it would be
false for the keyed providers, whose keys are not on any laptop. The workflow header's "adding a
provider means a step" line was refined to state the keyed-vs-keyless rule. Logged in DECISIONS.md.

## The gate (all green on `e3832bb`)

Local gate, all green: **typecheck · lint · app unit 753 passed · pipeline 579 passed / 35 skipped
(614) · build · check:routes** (byte-identical to before) **· check:bundles** (byte-identical; worst
`/paper` 198.2 KB < 200 ceiling) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift**
(28/28) **· check:migrations** (live DB matches the repo schema — no migration in LC2). Bonus:
**check:live** passed 7/7 live (the cookie extraction, confirmed against production).

e2e: a desktop run of the specs touching every extraction pattern — `auth`, `nav`, `a11y` (imported
`signIn`), `desk`, `briefing`, `theme`, `academy` (inline login → `signIn`), `offline` (kept
SW-variant `signIn`) — **75 passed, 15 skipped** (the skips are phone-only tests on the desktop
project). LC2 rewrites all 24 specs, so the full four-leg rehearsal is required and is the tag's
authoritative e2e proof.

- **Branch CI (push, `e3832bb`): run `29423103573`** — app + pipeline green (e2e/vrt correctly
  skipped for a branch push).
- **Rehearsal (four-leg oracle, `e3832bb`): run `29423127958`** — GREEN (7 m 43 s), no
  `vrt-baselines-candidate-*` artifact minted, so no pixel moved. LC2 renders nothing new.
- **Tag run (`lc-2`): run `29423758776`** — the four-leg oracle (desktop · phone · wide · mbp16) green
  (7 m 48 s); candidate-mint steps skipped (no failure), and app/pipeline correctly skipped (a tag
  runs only the browser oracle). 0 pixels moved.

## Gate size (unchanged from lc-1 — consolidation adds no gate surface)

**28 drift rules · 97 VRT baselines (0 updated) · 26 e2e specs · 753 app unit tests · 614 pipeline
tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run 7 m 48 s.**
