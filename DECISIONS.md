# DECISIONS.md — append-only decision log

Format (plan §9.1): `YYYY-MM-DD · [claude] · [local|structural] · decision · rationale (one line) · alternatives rejected`
(the alternatives-rejected field is written with a `rejected:` prefix.)

**Writing convention.** Entries are plain English: short sentences, plain words, no jargon. The
line format above stays fixed; everything inside it should read clearly to a human skimming the
log. (CLAUDE.md, "Readability & documentation".)

**Marker convention (the veto channel).** Every entry Claude writes carries the `[claude]` marker.
ANY line in this file without `[claude]` is user-authored: it is an instruction at authority
rank 2.5 (above this log and Claude's judgment, below the Research Report and Blueprint). The
session ritual diffs this file first thing every session; honoring a user-authored line is the
session's FIRST task. Structural entries additionally follow plan §1.3.3 (choose the option that
keeps ranks 1–2 intact; Appendix E/F/J changes are structural by definition).

---

2026-07-09 · [claude] · structural · Cookie-session login replaces Basic Auth (plan §4.4) · Basic-Auth 401s break installed PWAs; the Blueprint itself names the single-credential step-up · rejected: Basic Auth, Auth.js
2026-07-09 · [claude] · structural · “Broadsheet Terminal” design system committed token-for-token (plan Part 3) · a real identity the executor cannot drift from · rejected: default shadcn look, dark-first terminal pastiche
2026-07-09 · [claude] · structural · Serwist for the service worker (plan §5) · maintained Workbox successor with first-class Next.js wiring · rejected: hand-rolled SW, next-pwa (unmaintained)
2026-07-09 · [claude] · local · No push notifications and no offline write queue in v1 (plan §5.3, Part 8 backlog) · push needs a calm-tech review first; write queues risk silent divergence · rejected: fire-and-forget offline queue
2026-07-09 · [claude] · structural · Academy lessons as MDX files in git, not DB rows (plan Appendix B) · content belongs in version control · rejected: Blueprint lesson table
2026-07-09 · [claude] · structural · Refresh fades 160–200ms vs RR §9.7 “~500ms” (plan §3.5) · same calm intent, one quiet fade, no shimmer · rejected: literal ~500ms fades
2026-07-09 · [claude] · local · npm for app/, uv for pipeline/ (plan §4.1) · boring and universal; lockfiles pin versions · rejected: pnpm, bun, poetry
2026-07-09 · [claude] · local · Fonts: Archivo + IBM Plex Mono + Newsreader via next/font, self-hosted (plan §3.2, §4.5) · same-origin, precacheable, ≤320KB budget · rejected: remote Google Fonts, Inter-everything
2026-07-09 · [claude] · local · Scaffold: app/ and pipeline/ left as empty directories · create-next-app (P0 step 3) refuses non-empty targets and uv init (P0 step 8) owns pipeline/; workflow YAMLs are authored at P0 step 8 per Appendix C · rejected: hand-written package.json/pyproject stubs (would pre-empt the official scaffolds and pin stale versions)
2026-07-09 · [claude] · local · Two skills pre-seeded ahead of the §9.3 minting moments (new-provider-adapter, base-rate-display) · they transcribe contracts already fixed in the plan (Appendix F/J, §6.1–6.2), and each is marked refine-at-first-use so the rubric’s mint-on-evidence intent is preserved · rejected: waiting for the P1/P4 minting moments (loses the warm-start benefit for zero added risk)
2026-07-10 · [claude] · structural · Readability-first convention adopted for all code, docs, and terminal output (user directive — CLAUDE.md “Readability & documentation”) · the user leads the build and reads everything; plain English and clear-over-clever code are permanent constraints with guardrail force · rejected: machine-brevity style, uncommented functions, shorthand-heavy logs

## P0 — session 1 (2026-07-10)

### Structural

2026-07-10 · [claude] · structural · Newsreader loses the optical-size (opsz) axis; italic stays (plan §3.2 + §4.5, correction block added to both) · the axis costs 153KB on the latin subset — more than Archivo and Plex Mono combined — and pushed the three families to 388KB against the plan's own ≤320KB budget; the two plan clauses contradicted each other and neither is backed by a rank-1/2 source, so the budget wins because it directly serves the Research Report's calm, fast reading experience; fonts now total 237KB, guarded by app/scripts/check-font-budget.mjs · rejected: dropping the display italic instead (loses "the one literary flourish"), raising the budget (weakens the LCP target that Lighthouse checks at every phase exit), keeping both (breaks the contract)

### Local

2026-07-10 · [claude] · local · Exact toolchain versions pinned at P0 (plan §4.1 requires recording them here) · Node 24.18.0 · npm 11.16.0 · uv 0.11.28 · gh 2.96.0 · next 16.2.10 · react 19.2.4 · typescript 5.9.3 · tailwindcss 4.3.2 · eslint 9.39.4 · vitest 4.1.10 · zod 4.4.3 · jose 6.2.3 · bcryptjs 3.0.3 · sharp 0.35.3 · jsdom 29.1.1 · lockfiles hold the rest · rejected: floating ranges without a lockfile
2026-07-10 · [claude] · local · globals.css uses `@theme static`, not a bare `@theme` · Tailwind v4 tree-shakes theme variables no utility class references, which would silently delete the tokens the Lightweight Charts hook reads at runtime (plan §3.7) and the ones /styleguide renders as a living spec · rejected: bare @theme (verified: 12 of the 17 colour tokens vanished from the built CSS)
2026-07-10 · [claude] · local · lib/tokens.ts is the second and last file allowed to contain a hex colour · the web manifest and Next's viewport.themeColor are read by the OS before any stylesheet is parsed, so they cannot use a CSS custom property; the anti-drift grep (§3.10) therefore allows exactly globals.css and lib/tokens.ts · rejected: hardcoding hexes at each call site, reading tokens at runtime (impossible for the manifest)
2026-07-10 · [claude] · local · Node 24 pinned three ways: .nvmrc, package.json engines, and an explicit PATH prefix in build commands · the Claude Code process itself runs on Node 20 and its PATH leaks into every shell, so `node` resolves to 20 unless overridden — the nvm default alias is not enough · rejected: relying on nvm's default alias, downgrading the plan's Node 24 pin
2026-07-10 · [claude] · local · create-next-app run with --empty; its README.md deleted; its AGENTS.md and CLAUDE.md pointer kept in app/ · --empty gives the clean scaffold the plan's "prune boilerplate" step wants, and AGENTS.md carries Next 16's own warning that its APIs differ from training data — useful, and additive to the root constitution · rejected: pruning by hand after a full scaffold, deleting AGENTS.md
2026-07-10 · [claude] · local · @types/bcryptjs removed · bcryptjs v3 ships its own type declarations; the DefinitelyTyped stub (v2) would shadow them · rejected: keeping both
2026-07-10 · [claude] · local · npm audit reports a moderate postcss advisory (GHSA-qx2v-qp2m-jg93) reachable only through next's bundled copy · the only offered fix downgrades next to 9.3.3, which is absurd; the advisory is an XSS in CSS stringify output, and we never stringify untrusted CSS · rejected: `npm audit fix --force`. Revisit when next ships a patched postcss.
2026-07-10 · [claude] · local · Font budget enforced by a script, not a comment (app/scripts/check-font-budget.mjs, `npm run check:fonts`) · it counts only the latin-range faces, which is what a browser actually downloads, and both its pass and fail paths were exercised before it was trusted · rejected: eyeballing the build output
2026-07-10 · [claude] · local · DIRECT_URL points at the Supabase session pooler (IPv4), not the true direct host · the free-tier direct host db.<ref>.supabase.co is IPv6-only and does not resolve on the user's IPv4 network (verified: DNS resolution failure); the session pooler is IPv4, supports per-session DDL, and runs migrations fine (verified: CREATE/DROP succeeds) · this is the plan's own §1.4 fallback made concrete; Appendix D's DIRECT_URL role (prisma migrate dev) is preserved, only the endpoint changed · rejected: Supabase IPv4 add-on ($4/mo, breaks the $0 budget), waiting for IPv6 at the user's ISP
2026-07-10 · [claude] · local · Supabase project region is us-west-2 (Oregon); user and most infra are US-East · acceptable — the nightly job has hours of slack and a single reader tolerates ~70ms/query; not worth recreating the project · rejected: recreating the project in us-east-1 (churn for negligible benefit at v1 scale)
2026-07-10 · [claude] · local · Prisma pinned to 6.19.3, not the latest 7.8.0 · the plan names "Prisma 6" specifically in §4.1, and a specific pin outranks the general "latest stable" rule when they conflict; Prisma 7 is a major rewrite (ESM-only client, prisma.config.ts, no automatic .env loading) — churn not worth taking during the walking-skeleton phase, and "boring over clever" (§1.2) favours the well-documented major that matches the plan · rejected: Prisma 7.8.0 (revisit post-v1 as a deliberate upgrade with its own migration)
2026-07-10 · [claude] · local · app/.env is a symlink to the repo-root .env · Next and Prisma both auto-load a `.env` from their cwd, so one symlink gives both the single source of truth with zero secret duplication and no drift; app/.gitignore ignores .env* so it is never committed · rejected: a separate app/.env.local (duplicates secrets, drifts), dotenv-cli wrappers on every command (noisier)
2026-07-10 · [claude] · local · DATABASE_URL carries ?pgbouncer=true for Prisma; the Python pipeline will strip it before psycopg (which rejects the unknown param) · Prisma needs prepared statements disabled on the transaction pooler, psycopg needs the param gone — one canonical URL, sanitized at the one consumer that cannot take it · rejected: two separate DB URLs (muddies Appendix D's single placement authority)
