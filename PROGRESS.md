# PROGRESS.md — resumable state

**Current phase:** P0 (walking skeleton + intelligence layer)
**Last green gate (§6.4):** partial, 2026-07-10 — typecheck, lint, 45 unit tests, build,
font budget, and 9 Playwright auth tests all green. The full gate cannot run yet: it needs
Lighthouse (nothing is deployed) and the visual-regression baselines (captured at P0 step 9).
**Checkpoint:** P0 steps 1, 3, 4, 5, 6, 7, 8 done and committed; step 9 is done except the
Vercel deploy. **The P0 loop is proven end to end:** the cloud wrote a pipeline_run row and the
app renders it. Only the Vercel deploy and the remaining Session-0 secrets stand between here
and the P0 exit gate.

**THE LOOP IS CLOSED (2026-07-10).** Dispatched nightly-a → Job A ran green in GitHub Actions
and wrote pipeline_run(run_date=2026-07-10, stage={hello: ok}) to Supabase, cloud-only. The
Desk reads it and shows "as of 14:43 ET · Written by the nightly pipeline in the cloud". CI is
green on every push (app + pipeline jobs; e2e runs on phase-* tags). GitHub secrets set so far:
DATABASE_URL, SESSION_POOLER_URL, CRON_SECRET.

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

## Next 3 tasks (all need Session-0 values from the user)

1. **Vercel deploy — finishes P0 step 9 and unlocks the P0 exit.** Needs the user to link a
   Vercel project (root directory `app/`) and confirm preview Deployment Protection is ON. Then
   set the app env in Vercel: DATABASE_URL (with `?pgbouncer=true`), DIRECT_URL, AUTH_USER,
   AUTH_PASS_HASH (RAW — Vercel injects directly, no escaping), AUTH_COOKIE_SECRET, CRON_SECRET,
   APP_BASE_URL. Build command is `npm run build` (= `next build --webpack`). Deploy, confirm
   login works on the deployed shell and it shows the pipeline timestamp.
2. **App login → finishes P0 step 5.** User picks username + password; run
   `node app/scripts/hash-password.mjs`; local .env gets AUTH_USER + the ESCAPED hash, Vercel
   gets the RAW hash. Discard the plaintext.
3. **Provider keys + probes green (a named P0 exit criterion).** As each of Alpaca / Finnhub /
   FMP / Marketaux / FRED / EDGAR / Anthropic / R2 / healthchecks arrives, set it as a GitHub
   secret and re-run `uv run python -m scripts.probe_providers` until all show OK. Then run the
   §6.4 exit gate and tag `phase-0`.

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
