# PROGRESS.md — resumable state

**Current phase:** P0 (walking skeleton + intelligence layer)
**Last green gate (§6.4):** partial, 2026-07-10 — typecheck, lint, 45 unit tests, build,
font budget, and 9 Playwright auth tests all green. The full gate cannot run yet: it needs
Lighthouse (nothing is deployed) and the visual-regression baselines (captured at P0 step 9).
**Checkpoint:** P0 steps 1, 3, 4, 5 and 7 are done and committed. Step 2 (Session-0) is
partly in — Supabase is fully wired and the first migration is applied. Steps 6, 8, 9 remain,
plus the rest of the Session-0 secrets.

**Supabase is live (2026-07-10).** All three connection strings verified; `pipeline_run`
migrated onto the real database; a Prisma write/read/delete round-trip through the pooler
succeeds. `DIRECT_URL` points at the IPv4 session pooler because the free-tier direct host is
IPv6-only on this network (logged). The DB password was visible in chat when pasted — a
rotation at the end of Session-0 is recommended, after which the strings get re-pasted and
re-tested once.

## Where the build actually is

Four commits on `main` (no remote yet — the GitHub repo is Session-0 item #1):

- `89c6cfa` repo initialized; scaffold verified against plan §2.2; DEVELOPMENT-PLAN.md
  confirmed to regenerate byte-identical from `docs/src/dp-*.html`.
- `33fc449` Next 16.2.10 + React 19 + Tailwind v4 scaffolded; the whole §3.2–3.4 token set in
  `globals.css`; three self-hosted fonts at 237KB against a 320KB budget.
- `3995ae5` `lib/time.ts` (DST-tested), `lib/copy.ts` (Appendix J, pinned verbatim),
  `SectionMasthead` / `Tag` / `StatFigure`, the Desk shell, and `/styleguide`.
- `d7da3c3` the login wall: `lib/auth.ts`, `lib/password.ts`, `proxy.ts`, `/login`,
  `scripts/hash-password.mjs`, and an e2e suite that proves the wall stands.

Verified in a real browser, not by eye: the masthead renders Archivo at `font-stretch: 120%`,
weight 700, 0.07em tracking; the hero numeral is IBM Plex Mono 64px in `--ink` (never Wong
colour), dropping to 48px at the phone breakpoint; its delta is 13.5px in `--up-text`.

## Next 3 tasks

1. **P0 step 6 — PWA seed.** `manifest.ts`, `public/mark.svg` (the three-candle tick mark from
   the document covers), `scripts/icons.mjs` (sharp is installed and verified), the generated
   icon set, Serwist wiring, and the `/offline` route. All key-free. `/offline` must be
   `force-static` like `/login`, for the same reason.
2. **P0 step 8, authoring half — pipeline skeleton.** `uv init` in `pipeline/` (uv is
   installed), `config.py` (pydantic settings, env names per Appendix D) with its missing-env
   test, `scripts/probe_providers.py` shell, `jobs/job_a.py` and `jobs/job_b.py` stubs, and the
   three workflow YAMLs per Appendix C. Authoring is key-free; *running* the probes needs keys.
   `config.py` must strip `?pgbouncer=true` from DATABASE_URL before handing it to psycopg.
3. **P0 step 9 + deploy** — needs the GitHub repo (Session-0 #1: user runs `gh auth login`,
   then repo creation is mine), Vercel link, and the app env vars. Wires the Desk module 0 to
   show the last `pipeline_run` timestamp, deploys, runs one `workflow_dispatch`.

## Blocked

- **Session-0 values.** Presented to the user in full on 2026-07-10 (all nine rows of §1.4).
  Nothing is blocked yet, but these will be, in this order:
  - `DIRECT_URL` (Supabase) blocks P0 step 7 (Prisma migrate).
  - Provider keys + Anthropic + healthchecks + R2 block *running* the step-8 probes.
  - `AUTH_USER` / `AUTH_PASS_HASH` block the P0 step 9 deployed-login check. The code is
    finished and tested against fixture credentials; only the real values are missing.
  - `gh` is installed but unauthenticated, so `gh repo create` could not be run autonomously.
    The user runs `gh auth login`; then repo creation and enabling Actions are mine.
- **Fallback in force:** none needed. Everything key-free in P0 (steps 1, 3, 4, 5, 6, and the
  authoring half of 8) proceeds without the user.
- Already generated and sitting in the git-ignored root `.env`: `CRON_SECRET`,
  `AUTH_COOKIE_SECRET`, `R2_BUCKET=msm-history`.

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
