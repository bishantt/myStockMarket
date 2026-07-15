# PROGRESS.md — resumable state

# LC2 IS DONE — tagged `lc-2` (2026-07-15). Third phase of the two-plan commission.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: LC2 (consolidation) is DONE and tagged `lc-2` by SHA on `e3832bb`. Nothing is blocked.
Nothing is in flight. The next phase is LC3** (LEAN-CODEBASE-PLAN.md — the hot-file comment
compression), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What LC2 did, in one paragraph

LC2 is a behavior-preserving consolidation — it changes no rendered pixel and no e2e behavior; the
login is byte-for-byte the same. **(5.1) One e2e session helper:** `app/e2e/session.ts` exports
`USER`, `PASSWORD`, `signIn`, and all 24 login-bearing specs import it (15 hand-rolled `signIn` copies
plus desk's 5 inlined logins are gone). `brand` and `pwa` never sign in and are untouched; `offline`
keeps its own `signIn` (it waits for `serviceWorker.ready` — load-bearing) and imports only the
credentials; `auth` keeps its inline logins and imports `signIn` + the credentials. **(5.2)
`waitForLayout` is importable:** moved out of grid.spec.ts into `app/e2e/layout.ts`, exported — the
grid law is now an import, not a copy-paste. **(5.3) Guard plumbing deduped:**
`app/scripts/lib/session-cookie.mjs` (the cookie mint — check-live keeps its 1-hour TTL via a param,
the others default to 30 days) and `app/scripts/lib/manifest.mjs` (the routes-manifest read + the
page.tsx inventory walk). Every threshold/allowlist/verdict stays in its guard; check:routes and
check:bundles print byte-identical stdout before/after. **(5.6) record-fixtures.yml reconciled:** the
6 missing KEYED recorders added as steps; the 2 keyless ones (erapi, nrb) correctly run locally per
the skill. **Two findings** (both logged): the plan's "15 byte-identical signIn" was 12, and its "3
identical cookie mints" was 2 TTLs — measured, not trusted.

## The gate at `lc-2` (all green on `e3832bb`)

- **App unit: 753 passed. Pipeline: 579 passed, 35 skipped (614).** Unchanged — LC2 adds no test
  (session.ts/layout.ts are helpers, not specs; the lib scripts are not gated). **typecheck · lint ·
  build · check:routes** (byte-identical stdout to before) **· check:bundles** (byte-identical; worst
  /paper 198.2 KB < 200 ceiling) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift** (28/28)
  **· check:migrations** (live DB matches the repo schema — no migration in LC2). Bonus:
  **check:live** passed 7/7 live (the extracted 1-hour cookie, confirmed against production).
- **e2e:** LC2 rewrites all 24 specs, so a full rehearsal is required (the whole browser suite). A
  local desktop run of the specs touching every extraction pattern (auth, nav, a11y, desk, briefing,
  theme, academy, offline) was **75 passed, 15 skipped** (phone-only tests). The `lc-2` tag run is the
  authoritative four-leg proof.
- **5.3 preservation proof:** check:routes and check:bundles stdout is byte-identical before/after on
  the same built `.next` (empty diff); the extracted `mintSessionCookie` yields a byte-identical token
  to the old inline mint for both TTLs (clock pinned). Captured in docs/lean-evidence/lc2.md.
- **Branch CI (push, `e3832bb`): run `29423103573` green** (app + pipeline). **Rehearsal (four-leg
  oracle): run `29423127958` green (7 m 43 s).** **Tag run (`lc-2`): run `29423758776` green (7 m 48 s)**
  — the four-leg oracle, no VRT candidate minted. Full evidence: `docs/lean-evidence/lc2.md`.

## VRT at `lc-2`

Zero baselines changed. LC2 renders no different pixel. **97 VRT baselines total (0 updated, 0
added)** — confirmed by the rehearsal (no `vrt-baselines-candidate-*` artifact minted).

## What outlives LC2 (all in QUESTIONS-FOR-BISHANT.md; none is a phase, none blocking)

1. **Q-LC1-1 — vrt-diff.mjs uses Playwright's pngjs/pixelmatch, not its own devDependencies.** Still
   open at LC2 (no veto in DECISIONS.md, so left as-is per the handoff). LC3 can fold in the explicit
   form in two lines if Bishan prefers it.
2. **Carried from CC1 (still open, none a phase):** Q-CC1-1 (the ticker-slug fix, its rendered picture
   handed to CC4), Q-PD6-3 (watchlist reason truncation on a phone, now CC4's), the PD10 iOS on-glass
   photo checklist (owed to Bishan's iPhone), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — every
   default proceeds when its phase arrives: CC5/CC7/CC8/CC10).

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
The guard scripts (`check:fonts`, `check:routes`, `check:bundles`, `check:migrations`, `check:live`)
need **Node 24** — Claude Code runs on Node 20, which shadows nvm, so prepend it:
`PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" npm run check:fonts`. **The glob trap:**
`~/.nvm/versions/node/v24*` matches TWO installed dirs and breaks the PATH — name the version
(`v24.18.0`) explicitly. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`
first (AUTH_COOKIE_SECRET is in the repo-root .env), and Lighthouse needs `CHROME_PATH`. **Local e2e
runs no longer dirty docs/feel-evidence/nav-timing.md** (LC1 gated that append on `process.env.CI`),
so the old `git checkout --` ritual is gone.

## LC3's committed tools (LC1/LC2 left them; LC3 uses them)

- `pipeline/scripts/comment_stats.py` — `uv run python -m scripts.comment_stats` (from `pipeline/`):
  the LC3 worklist and its before/after instrument (full-line comments via tokenizer, docstrings via
  ast, a regex-aware C-family scanner).
- `app/scripts/vrt-diff.mjs` — `node scripts/vrt-diff.mjs <candidate-dir>` (from `app/`): decodes
  every VRT candidate against its committed twin and prints differing-pixel counts. Use it if any
  rehearsal leg reds on pixels.
- LC3 must ALSO commit `pipeline/scripts/comment_prover.py` (per Part 6 LC3) — the per-batch prover
  that proves comment-only edits (token-stream equality for TS/MJS, ast-dump equality for Python,
  whole-line-deletion-only for prisma/css/yaml).

## Reading the production brief (how the gate's real check is done — from CC1, still true)

No local psql. Query production directly with a throwaway Prisma script RUN FROM `app/` (so it
resolves `@prisma/client`), with the real `.env` sourced: read `briefing.status`,
`verification_json`, and `am_json.today_focus.body`. The suite going green is NOT the check — the
published prose is (standing memory: `pipeline-phase-verification`).
