# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

**STOP. Read this line first: `POLISH-AND-DEPTH-PLAN.md` does not start until Bishan says go.**

The gate-efficiency reform is **complete and tagged `gate-final`** (CI green, first try). The next
build is **POLISH-AND-DEPTH-PLAN.md, phase PD0** — but it is explicitly gated on **Bishan's word**,
not merely on a green tag. **If he has not said go in this session's opening message, do not start
PD0.** Ask him, and change nothing in the tree while you wait.

If he HAS said go: this is your prompt.

---

# Your session: PD0 — Session truth, the dating contract. PD0 ONLY.

Read `POLISH-AND-DEPTH-PLAN.md` at the repo root **in full** before touching anything. Your phase is
**PD0** (Part 12). Read **Part 1** (the claims to re-audit) and **Part 3** (the work) closely — Part 3
*is* the phase. Then read **Part 12's standing gate**, which was rewritten on 2026-07-13 and is **not**
the gate you may remember from the older plans.

**PD0 blocks everything else** — it wires the truth (the dating contract) and builds the instruments.
Do not skip ahead. **Do not run PD1's Saturday-row SQL; it is PD1's.**

## State of the tree

- `main` is clean. `gate-final` is tagged and green. Everything is pushed.
- App unit tests: **586 passing**. Pipeline: **464 local** / **490 in CI** (the extra 26 are
  Postgres-backed and skip on this Mac). Anti-drift: **21 rules**.
- Bundle worst case: **`/news` at 196.2 KB** against a **200 KB hard ceiling.** Read that number
  twice — see the PD9 warning below. Fonts: **243 KB** of a 560 KB budget.
- `check:migrations` is clean: the live database is running the schema in this repo.
- Nothing is blocked. Nothing is in flight.

---

## THE EXIT RITUAL — this changed, and it is the entire point of the last five phases

**Read CLAUDE.md's "The Endgame" block before your exit.** Every mechanism below is live and proven
(evidence: `docs/gate-evidence/g0-dedup.md` … `g4-texts.md`). The short version:

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Once per phase:
   **`check:migrations`** (local only — CI structurally cannot answer it).
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE — this is the reform.** `gh workflow run ci.yml -f job=e2e` runs the **full browser
   oracle** (all three shards, ~8 min) on any ref with **no tag involved.** It is **the same job the
   tag runs**, so a green rehearsal is not evidence *about* the tag run — it is the same evidence,
   collected before the tag exists. **Rehearse the exact SHA you are about to tag.**
   In parallel (they overlap deliberately — push and rehearsal share a ref and must): wait for the
   Vercel deploy, then `check:nav` and `check:lighthouse`.
4. **Rehearsal red on pixels?** The run mints its own candidate baselines
   (`vrt-baselines-candidate-<leg>`). Download, **OPEN EVERY IMAGE**, commit only an explained diff.
   **Read `.claude/skills/vrt-update/SKILL.md` FIRST.** An unexplained diff is a **bug**, not a
   re-bake.
5. **Rehearsal green → `git tag pd-0 <the rehearsed SHA>`** — **BY SHA, never `HEAD`.** The nightly
   pushes a heartbeat commit; **main moves under you.** Push the tag, confirm the tag run green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — **never a re-point.**
   But **read the failure first**: G2's "flake" was a real race that had failed its retry too.
7. **ONE docs commit, AFTER the tag:** intelligence files + `docs/pd-evidence/pd0-dates.md` + this
   prompt, rewritten. **That commit is FREE** — a prose-only commit starts no CI run.
8. **Every evidence file ends with the gate-size line.** At `gate-final`: **21 drift rules · 76 VRT
   baselines · 22 e2e specs · 586 unit tests · 16 bundle baselines · 14 manifest rooms.** If PD0
   grows the gate, **book the growth with its reason.**

**THE TRAP AIMED AT YOU:** `on.push` carries `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']`, so
documentation is free. **Nothing in the gate currently READS those paths — that is the only reason
the filter is safe. If you write a guard that reads a document, put its path back in the trigger
FIRST, or the guard breaks silently.**

---

## What the last five phases built (do not redo or distrust any of it)

- **A tag runs exactly ONE job — the browser oracle.** `app` and `pipeline` sit out tag runs and
  dispatch runs (they already ran green on main minutes earlier). Verified `skipped` on all five gate
  tags. **`pd-*` IS ALREADY WIRED** into `on.push.tags` **and** the e2e job's `if:`, and
  `pipeline/tests/test_ci_tag_families.py` fails the build if those two ever drift apart. **PD0's own
  plan text tells you to wire it — VERIFY it, do not redo it.** (There is exactly **ONE** tag-gated
  job, not two: `vrt-baselines` is dispatch-only.) **The TZ-matrix leg IS still PD0's to build.**
- **The oracle is SHARDED** into three legs (`desktop`, `phone`, `wide`), one Postgres each. ~8 min.
- **THERE IS ONE LIST OF ROOMS: `app/lib/routes-manifest.json`.** 14 rooms. The sweeps (a11y,
  hardening), the pixel oracle (vrt), the nav budget and the bundle budget **all read it**.
  `app/lib/routes-manifest.test.ts` walks `app/app/**/page.tsx` and **REDS `npm test`** if the
  filesystem and the manifest disagree **in either direction**. **Add a room? Add it there.**
- **DRIFT RULE 21 — the fuse-finder.** No absolute date literal in `prisma/seed.mjs`,
  `prisma/fixtures/*.mjs` or `e2e/**/*.ts` outside **two anchors**: `app/prisma/fixtures/clock.mjs`
  (the seeded world) and `app/e2e/seeded-clock.ts` (the browser suite). **PD0 IS A DATING PHASE —
  this rule will bite you.** Derive from the anchor; never write a second date. Comments are exempt,
  so every derived call site carries its answer (`sessionPlus(3)  // 2026-07-12`).
- **The texts no longer contradict the machine (G4).** CLAUDE.md now carries the reformed ritual and
  one sentence stating that **this repo overrides the `~/.claude` global rules** — no 80%-coverage
  chase (this repo has no coverage tooling at all, deliberately), no planner/reviewer agent ceremony.
  **Follow the plan.**

---

## Four things pre-decided FOR you, so they cost a paragraph instead of a phase

Logged at G4 as dated amendments inside `POLISH-AND-DEPTH-PLAN.md`. **Read them where they sit; do
not re-litigate them.**

1. **PD9's `/news` budget sentence was arithmetically impossible, and is corrected.** The plan said
   the overlay must "hold baseline+10KB." `/news` baselines at **195.1 KB** against a **200 KB
   ceiling that is explicitly NOT re-baselinable** ("Ship less JavaScript") — so baseline+10 =
   **205.1 KB, over the ceiling.** A PD9 that spent its documented slack would have **passed the
   slack check and failed the build.** Real headroom is **≈4.9 KB**, and **PD5's shared kit spends
   from the same pot.** The overlay's code-split is now **pre-authorized, not a fallback.** **The
   ceiling does not move.**
2. **The PD9 sheet's transition is a pre-authorized P2-walk exemption — OPACITY ONLY.** Which means
   **a slide-up sheet is NOT permitted**: `translateY` on an ancestor of a `[data-p2]` node moves the
   figure. The exemption goes in **by name**, beside its reason, the way `.route-fade` did. A blanket
   exemption or a widened selector is a **veto**.
3. **PD5's movers delta chip carries `data-p2`, and any hover is opacity/underline only** — no
   transform. **This is a MARKED ASSUMPTION (Q-G4-1) and Bishan may veto it.** Check
   `QUESTIONS-FOR-BISHANT.md` and `DECISIONS.md` for a non-`[claude]` line before building on it.
4. **`check:migrations` runs LOCALLY, not in CI.** The plan used to claim `nc-6`'s tag CI ran it. **CI
   has never run it and structurally cannot** (it migrates a fresh throwaway container every run).

---

## Questions waiting for Bishan — none of them blocks you

**Read `QUESTIONS-FOR-BISHANT.md`, and diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).**

- **Q-G2-1 [VETO?]** G2 edited `news.spec.ts` (a scope deviation) because the rehearsal went red and
  "red CI blocks a phase exit" is an untouchable.
- **Q-G3-2 [WORTH HIS EYES]** an Academy lesson (`/academy/[slug]`) is **neither swept nor
  pixel-locked.** The manifest made the gap visible. **It is now a one-line change** (`"sweeps":
  ["touch","scroll","axe"]` on that manifest entry). If he says yes, this is a good, cheap thing to
  do early in PD.
- **Q-G4-1 [VETO?]** the movers-chip ruling above.
- **Q-G4-2 [FYI]** I pre-decided one new rung on the font drop-order (JetBrains Mono 600), because the
  old ladder's first two rungs turned out to be already spent. Easily reversed; nothing is built on it.
- **Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2** — all `[FYI]`, decisions made, no action needed.

---

## Known-and-fine, so you do not chase them

- **A Node-version trap on this Mac.** Claude Code runs on **Node 20** and exports its own bin
  directory into every shell it spawns, shadowing the repo's Node 24. `check:fonts` then dies with
  `SyntaxError: ... does not provide an export named 'globSync'` — **not a regression.** Prepend Node
  24 in every shell: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`check:nav` reports `/settings` at ~400–510 ms, every sample a cache `MISS`.** Correct, not a
  regression: it is the app's one *writer* room and is `force-dynamic` by design, with an argued
  exemption in `check-routes.mjs`. **B2 is in report mode for exactly this reason.** Every cached room
  answers in 41–96 ms.
- **Lighthouse: performance 87, LCP 3.86 s.** Advisory only (synthetic-4G), logged in DECISIONS. The
  two **hard** gates pass: **CLS 0.000** and **first-load JS 178 KB** (≤ 200 KB). Accessibility 100.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced for `AUTH_COOKIE_SECRET`.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` and its PDF/HTML) are a completed research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD0, tag `pd-0`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD1**, **report to Bishan in plain English, and STOP.**
Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull, read the constitution + PROGRESS.md + LESSONS.md,
diff DECISIONS.md for user vetoes, `npm test` from `app/` and `uv run pytest` from `pipeline/`,
announce the checkpoint), then begin PD0.
