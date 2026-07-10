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
