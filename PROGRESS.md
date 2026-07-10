# PROGRESS.md — resumable state

**Current phase:** P0 COMPLETE — tagged `phase-0` (2026-07-10). P1 (data spine) is next.
**Last green gate (§6.4), 2026-07-10:** typecheck, lint, 45 app unit, 13 pytest, webpack build,
font budget (237/320KB), 28 Playwright (auth + PWA, both viewports), anti-drift §3.10 greps —
all green. **Lighthouse** (deployed /, mobile 4G, authenticated via a minted cookie —
scripts/lighthouse-check.mjs): performance 90–95 ✓, a11y 100 ✓, CLS 0.000 ✓, first-load JS
131KB ✓; LCP 2.8–3.4s accepted as a synthetic cold-4G artifact on a contentless page (DECISIONS
2026-07-10, QUESTIONS-FOR-BISHANT.md — a [VETO?] item). **Healthchecks down-drill: PASSED** —
/start with no success → STATUS=down after the 45-min grace → recovery → STATUS=up, all via the
read-only API.
**Checkpoint:** P0 steps 1, 3, 4, 5, 6, 7, 8 done and committed; step 9 is done except the
Vercel deploy. **The P0 loop is proven end to end:** the cloud wrote a pipeline_run row and the
app renders it. Only the Vercel deploy and the remaining Session-0 secrets stand between here
and the P0 exit gate.

**THE LOOP IS CLOSED (2026-07-10).** Dispatched nightly-a → Job A ran green in GitHub Actions
and wrote pipeline_run(run_date=2026-07-10, stage={hello: ok}) to Supabase, cloud-only. The
Desk reads it and shows "as of 14:43 ET · Written by the nightly pipeline in the cloud". CI is
green on every push (app + pipeline jobs; e2e runs on phase-* tags).

**SESSION-0 ALL BUT DONE (2026-07-10).** All 9 provider probes green with real keys
(Alpaca, Finnhub, FMP, Marketaux, FRED, EDGAR, Anthropic, R2 put/get/delete, healthchecks) —
a named P0 exit criterion. 19 GitHub secrets set. App login (bishantt) in local .env, hash
verified through Next's loader + bcrypt. nightly-b dispatched → the healthchecks dead-man check
is **up**, confirmed via the read-only API. The only Session-0 item left is Vercel.
- FMP needed the /stable/ API (v3 retired 2025-08-31) — probe fixed, P2 adapter noted.
- `.env.session0` collection file deleted after distribution; `.vercel-auth-hash.tmp` (raw hash
  for Vercel, git-ignored) is kept for the deploy.

**GitHub is live (2026-07-10).** github.com/bishantt/myStockMarket — private, Actions enabled,
all commits pushed. Token has repo + workflow scope. First push needed http.postBuffer raised
(the PDFs exceeded Git's 1MB default) and HTTP/1.1; those are set in the local git config.

**PWA seed done (step 6).** Manifest, six icons from public/mark.svg, Serwist service worker,
/offline. 14 e2e tests green. The production build uses `next build --webpack` (Serwist needs
webpack; Next 16 defaults to Turbopack) — dev stays on Turbopack.

**Supabase is live (2026-07-10).** All three connection strings verified; `pipeline_run`
migrated onto the real database; a Prisma write/read/delete round-trip through the pooler
succeeds. `DIRECT_URL` points at the IPv4 session pooler because the free-tier direct host is
IPv6-only on this network (logged). The DB password was visible in chat when pasted — a
rotation at the end of Session-0 is recommended, after which the strings get re-pasted and
re-tested once.

## Where the build actually is

Eleven commits on `main`, all pushed to github.com/bishantt/myStockMarket (private, CI green):

- repo init + scaffold verified against §2.2; DEVELOPMENT-PLAN.md regenerates byte-identical.
- Next 16.2.10 + React 19 + Tailwind v4; the full §3.2–3.4 token set; fonts 237KB / 320KB.
- `lib/time.ts` (DST-tested), `lib/copy.ts` (Appendix J, pinned), `SectionMasthead` / `Tag` /
  `StatFigure`, the Desk shell, `/styleguide`.
- The login wall: `lib/auth.ts`, `lib/password.ts`, `proxy.ts`, `/login`, hash script.
- Prisma 6.19 schema v0 (`pipeline_run`), migrated onto Supabase, `lib/db.ts`.
- PWA seed: manifest, six icons from `public/mark.svg`, Serwist SW (`app/sw.ts`), `/offline`.
- Pipeline skeleton: `config.py`, `monitoring.py`, `jobs/job_a.py`, `jobs/job_b.py`,
  `scripts/probe_providers.py`; four workflow YAMLs (nightly-a/b, ci, migrate).
- The Desk reads `pipeline_run` and shows the cloud run's timestamp — the loop, closed.

Tests: 45 app unit + 14 Playwright (auth + PWA) + 13 pipeline pytest, all green. CI runs the
app and pipeline jobs on every push; e2e + Lighthouse on `phase-*` tags.

## Next 3 tasks

1. **Close the §6.4 gate → tag phase-0.** (a) Set up Lighthouse (mint the `release-phase` skill
   per §9.3): an authenticated mobile run of `/` with a CI-minted session cookie, asserting the
   perf/a11y budgets and first-load JS ≤ 200KB. (b) The healthchecks down-drill: disable
   nightly-b, wait past the 45-min grace, confirm the check goes DOWN via the read-only API,
   re-enable and confirm recovery. Then `git tag phase-0` + push.
2. **Optional polish before P1:** connect the GitHub repo in the Vercel dashboard (Project →
   Settings → Git, Root Directory = `app`) so `git push` auto-deploys; delete the unused
   "My First Check" in healthchecks; rotate the Supabase DB password (was visible in chat).
3. **P1 begins — the data spine:** Prisma schema v1 (Appendix B), `adapters/base.py` +
   `adapters/alpaca.py` and mint the `new-provider-adapter` skill, `indicators.py` (toy-series
   tests) + `new-indicator` skill, the Parquet/DuckDB store, and the first real Desk modules
   (macro pulse, movers, watchlist).

## Deployment facts (2026-07-10)
- Production: **https://mystockmarket-eight.vercel.app** — our /login wall gates it; preview/
  deployment URLs sit behind Vercel SSO (the licensing wall for previews). Vercel project
  `bishantts-projects/mystockmarket`, linked from `app/`, build command `npm run build`.
- Vercel env (production + preview): DATABASE_URL, DIRECT_URL, AUTH_USER, AUTH_PASS_HASH (raw),
  AUTH_COOKIE_SECRET, CRON_SECRET, APP_BASE_URL — all set.
- Local auth now lives in `app/.env.development.local` (dev-only), NOT root .env — see the
  DECISIONS/LESSONS entries on the e2e hermeticity fix. `.vercel-auth-hash.tmp` (raw hash) can be
  deleted now that Vercel has the value.
- Git auto-deploy is NOT connected yet (the repo is the parent of `app/`; do it in the dashboard).

## Blocked

- **Remaining Session-0 values** (Supabase ✓ and GitHub ✓ are already in): Vercel link +
  preview-protection confirmation · Cloudflare R2 (account id + access key + secret) · provider
  keys (Alpaca, Finnhub, FMP, Marketaux, FRED) · EDGAR name+email · Anthropic key + $15 cap ·
  healthchecks check + read-only API key · the app login username+password. Drop them in the
  git-ignored root `.env` and say so; I distribute per Appendix D. **Fallback in force:** none
  needed — all key-free P0 work is done.
- **Recommended cleanup:** rotate the Supabase DB password (it was visible in chat when pasted),
  then re-paste the three strings for a single re-test.
- Already generated / set: `CRON_SECRET`, `AUTH_COOKIE_SECRET`, `R2_BUCKET` in `.env`;
  DATABASE_URL, SESSION_POOLER_URL, CRON_SECRET as GitHub secrets.

## Decisions worth knowing before you touch anything

- **One structural deviation this session**, logged in DECISIONS.md and annotated into both
  `DEVELOPMENT-PLAN.md` §3.2/§4.5 and their `docs/src/dp-*.html` sources (Part 10 rule 9):
  Newsreader's optical-size axis is dropped. It cost 153KB and broke the plan's own font budget.
  The display italic survives. `npm run check:fonts` enforces the budget from now on.
- `globals.css` uses `@theme static`. A bare `@theme` tree-shakes unused tokens, which silently
  deleted 12 of the 17 colour tokens — including the three the chart hook will read at runtime.
- `lib/tokens.ts` is the only file besides `globals.css` allowed to contain a hex colour.
- Node 24 does **not** resolve by default in this environment: Claude Code runs on Node 20 and
  its PATH leaks into every spawned shell. Prepend
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to build and test commands.

## Scaffold provenance (2026-07-09, planning session — before any build session)

Created: CLAUDE.md · DECISIONS.md · PATTERNS.md · LESSONS.md · this file ·
.claude/skills/ (README + 2 seed procedure skills) · .env.example · .gitignore · README.md ·
.github/workflows/ (empty, .gitkeep) · app/ and pipeline/ (deliberately EMPTY).
`app/` has since been scaffolded; `pipeline/` is still empty and belongs to `uv init`.
