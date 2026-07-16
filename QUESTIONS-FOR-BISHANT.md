# Questions & heads-ups for Bishan

Things I decided myself and kept going on are in DECISIONS.md. This file holds items I want
your eyes on: genuine questions, and judgment calls where you might want to veto. Nothing here
is blocking my work right now.

Format: newest first. I mark each as [FYI], [VETO?], or [NEED] so you can scan.

---

## 2026-07-16 — CC10 (Fresh in, stale out) — **the LAST CC phase; the commission is complete**

CC10 built the janitor (a retention manifest + a nightly deletion stage + the R2 backup trim), the
briefing citation snapshot (one migration), the control-room Janitor row, and the "new" tags (R8).
Tagged `cc-10`. Three heads-ups — two marked assumptions in the janitor manifest, and one deferral I
want your eyes on.

### [FYI · Q-CC10-1, marked] `watchlist_item` is `forever` — the one model the plan's manifest table did not name
The janitor's manifest must name EVERY Prisma model (a bidirectional test reds the build otherwise).
The plan's §4.8 table named 22 of the 23 models; `watchlist_item` — the reader's own watchlist, the
names and the reasons you wrote — was the one it missed. I made it **`forever`**: it is user data, the
record, and the janitor may never touch it (the allow-list refuses it, proven by a test). This is the
only reasonable reading, but it is an assumption I made rather than one the plan wrote down. Veto only
if you ever want a watchlist name to expire, which I cannot imagine you do.

### [VETO? · Q-CC10-2, marked] The calendar "new" tag is DEFERRED — clusters carry it, the calendar does not
§4.8 says clusters AND calendar rows get the "new" tag. Clusters do. The calendar does **not**, and the
reason is structural: `calendar_event` is a **`replace`-policy** table — the pipeline rewrites the whole
forward window every run — and it has **no first-seen column**. So "first published in this edition" is
undefined for a calendar row without a *second* migration (`firstSeenAt`) plus a change to
`_replace_calendar` to preserve that stamp across the nightly replace. Appendix B sanctions exactly ONE
CC10 migration (`sourcesJson`), Appendix C bounds CC10's VRT as "small," and R8 says the tag is
information, not noise — and the only thing I could do *without* the second migration is tag EVERY
calendar row every night, which is noise. So I shipped the cluster tag (the meaningful surface — genuinely
new stories are marked) and left the calendar tag for a small dedicated follow-up. **Assumption shipped:**
the cluster tag is the value R8 wanted; the calendar tag waits for a deliberate `firstSeenAt` migration.
Say the word and it is a ~1-session follow-up (migration + preserve-on-replace + thread it through).

### [VETO? · Q-CC10-3] On a fresh evening, MOST front-page stories wear the "new" tag — by design, but you may find it heavy
The tag marks a cluster first seen since the prior edition went to press. On a normal evening that is
most of the day's news, so most front-page headlines wear a quiet "new". This is honest — the tag's real
signal is its ABSENCE on a carried-over multi-day story (in the seed, only nc-nvda-guidance, first seen
the day before, lacks it). But if a page of mostly-tagged headlines reads as clutter to you rather than
information, the fix is a one-line scope change: e.g. show it ONLY on the Desk's front-page module (the 3
top stories), or only on the /news "This week" view where the contrast is sharp. I built the plan's
literal spec (every new cluster, quietly); veto toward a narrower scope if you'd prefer it.

### [FYI · no action] The janitor's news deletion protects a permanent pre-cutover backlog
The janitor never deletes a news_item published before the "snapshot cutover" (the earliest briefing that
stored its own sources). This is the coupling §4.8 asked for — it keeps a pre-CC10 briefing's sources
joinable — but it means the news that already exists at the CC10 deploy is never purged (a bounded, one-time
backlog; everything published after the cutover trims normally at 45 days). Noted so the storage footprint
in PROGRESS is not a surprise: the janitor's steady-state is small, but it does not reclaim the old backlog.

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC10 re-shot VRT for the new tags + the Janitor row, so "diff every candidate" bit again. `vrt-diff.mjs`
still throws `ERR_MODULE_NOT_FOUND: pixelmatch`; I used the pngjs-only counter (PATTERNS.md). The fix is
one line — `npm i -D pixelmatch` — or a pngjs rewrite. **This is the LAST CC phase, so this question now
travels alone** — it is nobody's phase to fold in until you say the word.

### [carried, NOT CC10's domain] Q-CC6-2 — the event classifier is weak; Q-CC9-1 — "before the open" wording
Both unchanged. Q-CC6-2 (the `classify_event` keyword classifier mislabels headlines) still wants a
decision: a dedicated classifier pass or a folded phase. Q-CC9-1 ("before the open" ruled edition-provenance
so R3 holds) is still marked for veto if you'd rather reword the morning status. Neither was CC10's to touch.

---

## 2026-07-16 — CC9 (The Desk greets the morning)

CC9 taught the Desk to greet a Morning Edition. Module 02 becomes THE MORNING PLAN before the open, the
masthead greets the morning once a dawn has really run, the calendar flips today-first, and check:live
learned the states. Tagged `cc-9`. Presentation phase (app only). Six heads-ups; one question CLOSED,
one CC5 transient FIXED.

### [VETO? · Q-CC9-1, marked] "before the open" is edition provenance, not a live market-state claim
Appendix A's morning status is verbatim: "before the open · market data through {weekday}'s close · news &
macro refreshed {time}". But R3's e2e guard counts the market-state word (`open`/`closed`) in the header
and fails on a second one — and "before the open" contains "open" while the pill says "closed", which is
two. I ruled that **"before the open" is the edition's PROVENANCE** — when it was assembled, the twin of the
evening's "updated 7:36 PM ET" — **not a live claim about whether the market is open now**. The pill stays
the single live market-state truth (R3's actual intent). The morning R3 test strips "before the open" before
counting, with that reasoning in a comment. **Assumption shipped:** the phrase reads as edition-timing, so
the app tells one live market-state truth (the pill). Veto if you'd rather I reword the morning status to
avoid the word "open" (e.g. "pre-market"), or drop the phrase — either is a one-line copy change.

### [FYI · marked] The seeded morning's OVERNIGHT section is empty — populated is verified in production
The Morning Plan's "Overnight" reads news clusters first seen since the evening press time. I chose NOT to
seed overnight clusters: /news has date-range "week" queries, so any cluster I add to exercise "Overnight"
would also change /news (its count, its span) — collateral well beyond CC9's VRT surface (Appendix C:
"masthead + module 02"). So the seeded morning shows the honest empty state ("No new stories crossed the wire
overnight"), and the Overnight card grammar is ALREADY pixel-locked via FrontPagePreview (identical markup).
The populated Overnight is verified in production by the step-5 check (a real dawn dispatch + reading the
morning front page — the pipeline-verification memory's rule). Say the word if you'd rather the seeded VRT
show a populated Overnight; it is a /news re-shoot's worth of collateral.

### [CLOSED · Q-CC8-1] The dawn sheet now describes the full macro+news+calendar dawn
CC8 left the control-room Dawn refresh row describing the macro-only dawn it began as. CC9 fixed it: the
description reads "Rebuilds the morning before the open — overnight news, macro, and the day's calendar," and
its stages/providers now list macro+news+catalysts+publish+revalidate over fred+finnhub+marketaux. The
seeded dawn row also gains a real Last run now (the seed stamps a Friday 6:31 AM dawn), so the control room
shows the dawn's health instead of "—".

### [FIXED · Q-CC5-2] check:live no longer false-reds a healthy morning Desk
The CC5 transient was check:live reading a morning-window Desk. A Morning masthead is dated TODAY, which is
ahead of the last closed session — and the old checkMasthead called that "an edition from the FUTURE". CC9's
edition-state awareness fixes it: a morning masthead is judged by the morning's rule (dated today, a real
session), and the date-derived checks (next-edition, calendar) measure against the last close. The evening
six never relax. `--window=morning` adds the Morning truths (the edition claim matches the dawn's presence;
refreshed before the 9:30 open) — run against a production dawn window.

### [FYI] Module 02 renders BOTH states server-side; the browser switches (a TermProse note)
The masthead, module 02 and the calendar must react to the reader's CLOCK (R6 — a cached morning served that
evening must correct itself), so the browser decides which edition shows. To keep module 02's glossary
decoration a SERVER render (TermProse memoises per server render), both the brief and the Morning Plan are
rendered server-side and the client picks one (EditionSwitch). The evening brief renders first and claims the
glossary terms, so its decoration is unchanged; the morning's collapsed copy of the brief (hidden behind a
"Last evening's brief" fold) gets fewer — invisible, because it is collapsed. Confirmed the evening brief
baseline did not move in the re-shoot. Noted so the double-render is not a surprise.

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC9 is a full re-shoot, so "diff every candidate" bit hardest here. `scripts/vrt-diff.mjs` still throws
`ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter (PATTERNS.md) again. The fix is one
line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call, still.

### [FYI · no action] the tag run's desktop leg flaked 3× on a PRE-EXISTING race before going green
The cc-9 tag run's desktop leg redded three times on a Next.js `NoFallbackError` (a background ISR
race on the dynamic `/scans/[preset]` route) before the fourth attempt passed. It is NOT a CC9
regression: rehearsal #3 on the same SHA passed all four legs, and cc-8's own PASSING tag run carries
the identical error in its log. The tag stayed put (rule #6) and I re-ran until the timing missed.
Noted so a red tag-run leg in the history does not alarm you, and flagged for CC10 (it re-shoots VRT).

### [FYI · carry-forward for CC10] the bundle ceiling is tight — /news at 199.6 KB of 200
The client edition machinery added ~3 KB across the (desk) routes. /news now sits at 199.6 KB against the
hard 200 KB first-load ceiling. It passes, but CC10 (the janitor + "new" tags) has ~0.4 KB of headroom on
that route — worth watching, and a reason to keep CC10's client additions lean.

## 2026-07-16 — CC8 (The dawn run becomes the Morning Edition's engine)

CC8 turned the pre-open dawn cron from a three-number macro fix into the morning refresh: `dawn` mode
(macro + news + catalysts), the cron moved to Mon–Fri 6:30 AM, event times on the calendar, publish_dawn,
and the control-room dawn row now shows a real Last run. Tagged `cc-8`. Pipeline phase; one small app touch.
Three heads-ups, none blocking; one question CLOSED.

### [CLOSED · Q-CC7-1] The Dawn refresh row now shows a real Last run
CC7 shipped the dawn row's Last run as "—" because dawn shared the nightly's `pipeline_run`. CC8's
`publish_dawn` stamps a distinct `dawn` entry beside the night's `source_status`, and `lastRunForDawn` reads
it — so once a dawn has run, the row shows its status, stamp and per-source health. The production dispatch
(step 5) confirmed it: the Jul 15 run gained a `dawn` entry (ranAt 12:23 AM ET, every stage/source ok)
BESIDE the night's 14 source keys, none erased. In the SEEDED world it still reads "—" (the seed models no
dawn run, which is honest).

### [FYI · Q-CC8-1, marked] The dawn sheet still describes the macro-only dawn
CC8's mandated control-room touch was the cadence + Last run. The dawn sheet's description ("Re-reads the
index closes FRED posts overnight") and its stages/providers list still describe the macro-only dawn, not
the richer macro+news+calendar run it now is. I left them for CC9, which builds the morning masthead and the
Morning Plan — the sheet's fuller "Morning Edition" framing belongs with that presentation, told as one
story, rather than half-told now. The assumption I shipped on: the row is honest about WHEN (cadence) and its
last run; its depth copy catches up in CC9. Say the word if you'd rather the sheet describe the full dawn now
(a one-line description + two array edits, VRT-neutral for the sheet).

### [FYI · marked] No Anthropic is spent at dawn — the morning front page carries no prose until CC9
Risk 10 says "No Anthropic spend at dawn," so the dawn's news stage rebuilds the front page FACTS-ONLY
(fresh clusters, no why-it-matters prose). Between the dawn run and the evening nightly, the front page
therefore shows the overnight stories without the evening's prose — the designed facts-only state (P9). The
morning PRESENTATION (whether module 01 shows these as compact overnight cards, and the Morning Plan) is
CC9's to build; CC8 just refreshes the data cheaply. Noted so a prose-less morning front page in production
is not a surprise before CC9 lands.

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC8's settings re-shoot needed "diff every candidate" again — it confirmed the moved set equalled the 5
settings shots and nothing hid under the tolerance. `scripts/vrt-diff.mjs` still throws
`ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter (PATTERNS.md) again. The fix is one
line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call, still.

### [carried forward — STILL wants your decision] Q-CC6-2 — the event classifier is weak
Unchanged from CC6/CC7: the pre-existing `classify_event` keyword classifier mislabels real headlines, so
the production front page can lead by a weak guess. CC8 did not touch it (it is N4's). It still wants a
decision: a dedicated classifier pass (its own small phase), or folded into a later CC phase? Now MORE
visible, because the dawn's news sweep rebuilds the front page every morning too.


## 2026-07-15 — CC7 (The control room)

CC7 turned Settings' flat pipeline panel into a TABLE of the Desk's three schedules (Nightly full, Dawn
refresh, Evening briefing) plus a detail sheet per row; the five manual modes are now actions inside the
sheets. Tagged `cc-7`. Four heads-ups, none blocking, plus one carried-forward that still wants a decision.

### [VETO? · Q-CC7-2] The action→sheet grouping — macro lives under the Dawn refresh
The plan said "the four manual modes as actions, not rows" without fixing WHICH sheet each lives in. I
grouped them by meaning: **macro → Dawn refresh** (the dawn cron IS macro mode, so a manual dawn refresh
and a manual macro run are the same dispatch), **full/news/compute → Nightly full**, **briefing →
Evening briefing**. Each of the five actions has exactly one home, and a unit test proves the partition
is total and disjoint. If you'd rather all four Job-A modes sat under Nightly full, that's a small change
— but then the Dawn refresh row has no run-now button of its own. Full reasoning in DECISIONS.

### [FYI · Q-CC7-1, marked] The Dawn refresh's Last run reads "—" — it has no record of its own yet
The dawn cron runs macro mode, which shares the nightly's `pipeline_run` row and `market_context` — there
is no per-dawn timestamp in the schema until CC8's `publish_dawn` stamps one. So the dawn row honestly
shows "—" for Last run and Duration, and its sheet says it shares the nightly's record for now. This is
the exact N0 migration pattern (a record arrives on the next relevant run), and **CC8 closes it** — the
control-room row updates to "Dawn refresh · Mon–Fri ~6:30 AM ET" when the dawn run gets its own publish.

### [FYI] One deliberate DetailOverlay extension: a controlled mode
The story and ticker sheets are ROUTING sheets (dismiss = `router.back`, a real deep-linkable URL). The
control-room sheet can't be — the table holds the live polled ledger, and a routing @modal sheet would
render stale server data. So DetailOverlay now has a second mode (`onClose`), used only here; the routing
path is byte-unchanged and overlay.spec passes 10/10 on the phone. If you'd rather two components, say so;
I chose one door (a duplicated overlay is a bug's habitat — the sibling law this build keeps re-learning).

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC7's settings re-shoot needed "diff every candidate" again (it confirmed the moved set equalled the
settings set — 5 shots — and caught nothing hiding under the tolerance). `scripts/vrt-diff.mjs` still
throws `ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter (PATTERNS.md) again. The fix
is one line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call, still.

### [carried forward — NOT CC7's domain, but STILL wants your decision] Q-CC6-2 — the event classifier is weak
This is the big one from CC6, and it is unchanged: the pre-existing `classify_event` keyword classifier
mislabels real headlines (a crypto stablecoin PR as "macro" so it leads; SeekingAlpha opinions as "M&A"),
so the production front page can lead by a weak guess. CC7 is the control room and did not touch it. It
still wants a decision: a **dedicated classifier pass (its own small phase)**, or **folded into a later CC
phase**? Until then the front page leads by the classifier's guess — same as before CC6, just more visible.


## 2026-07-15 — CC6 (Honest relevance)

CC6 made the Desk's relevance deterministic and tested (R5): front-page significance v2 (a 4-term
product), the movers liquid floor, the RelVol "≥20×" label, and the calendar row grammar. Tagged `cc-6`.
Five heads-ups — and the FIRST one matters, because the pipeline-verification read earned its keep.

### [NEEDS YOUR EYES — the real finding] The pre-existing event CLASSIFIER is too weak for v2's promise
I did the plan's step-5 check: dispatched a real `news` run in production and READ the published front
page (not the green suite — the memory's lesson). It surfaced a genuine problem. The top of the page is:

  1. sig 0.60 [**macro**] "Exodus Offers Subscription Payments via Stablecoins…" — a crypto/product PR
  2. sig 0.60 [**macro**] "ETF Prime: ETF Inflows, the Nasdaq 100 Fee War…" — an ETF podcast
  4. sig 0.39 [**ma**]   "PayPal: A Bargain For Stripe, A Bad Deal For Shareholders (NASDAQ:PYPL)" — a SeekingAlpha ANALYST opinion
  5. sig 0.39 [**ma**]   "Alaska Air: A Better Airline, Not Yet A Better Investment (NYSE:ALK)" — an ANALYST opinion
  7. sig 0.39 [**fda**]  "Certara to Report Q2 2026 Financial Results…" — an earnings-date notice

The formula is CORRECT (the seed proves it: Fed/macro → FDA → SMCI earnings, and Appendix E passes). The
problem is `newsdesk/rank.py`'s **`classify_event` keyword classifier — which CC6 did NOT touch (it is
N4's, unchanged)** — mislabels real headlines: a crypto stablecoin PR as "macro" (so it LEADS at
market-wide entity), and the exact SeekingAlpha analyst pieces 4.5 wanted BELOW hard news as "ma". So
v2's headline promise — "hard events over commentary, kills the seekingalpha lead" — is defeated at the
source. This is NOT a CC6 regression: v1 ranked misclassified-macro stories high too (via its `scope`
term), and the entity backfill will NOT fix it (a macro-misclassified story is market-wide regardless of
its bucket). **But v2 makes the classifier's quality load-bearing in a way v1 half-hid, and reading
production is the only thing that shows it.** The fix is a classifier improvement (better keyword/category
handling for crypto, analyst-blog formats like "(NASDAQ:XXX)"/"A Bargain For", ETF commentary) — a real,
separate piece of work I deliberately did NOT smuggle into CC6's end (the exact over-reach this build
regresses on). **Q-CC6-2: do you want a dedicated classifier pass (its own small phase), or fold it into
a later CC phase?** Until then the front page leads by a weak classifier's guess — same as before CC6,
now just more visible.

### [FYI · a pending live-observation gate, NOT a defect] The floor + entity_weight go fully live at the next full nightly
The migration added `instrument.dv_bucket`, which the movers floor and entity_weight read — and which
only the FULL nightly backfills. Production has 12,992 instruments, ALL with a null bucket right now, so
until the 22:37 UTC nightly runs the new code, the floor's data is not ready. I built a **backfill
bridge**: loadMovers falls back to the raw ranked top 8 (the pre-CC6 behavior — the junk parade, no worse
than before) rather than emptying the module, and self-heals on the next nightly. So the floor's full
effect (junk filtered) and entity_weight's mega-cap-over-micro-cap boost are confirmed AT THE NEXT FULL
NIGHTLY — the exact N0-migration pattern (a migration takes effect on the next run). The seeded world shows
CC6 in full (VRT/e2e). **To see it in production sooner:** dispatch a full nightly (`gh workflow run
nightly-a.yml -f mode=full`), then open the Desk — the movers should lose AHD/ASMH and gain the liquid
names, and the front page should lead with the corroborated macro story. I did NOT dispatch one myself (it
re-fetches the whole market, re-clusters, and submits an LLM batch — heavier than the endgame needed, and
the scheduled nightly does it for free).

### [VETO? · marked deviation from 4.5] Q-CC6-1 — the liquidity notion is scans' single-day is_large_mid, not baserates' 63-day median
4.5 said "reuse `_DV_WINDOW` (the base-rate engine's large/mid boundary)." I reused scans.py's existing
`is_large_mid` instead. BOTH use the top-1000-by-dollar-volume cutoff; they differ ONLY in the averaging
window — scans is single-day (today's snapshot), baserates is a 63-day median. I chose scans' because it is
the EXISTING notion the movers already carry (so "no second liquidity notion" is honored by reuse — the
plan named `_DV_WINDOW` unaware scans.py already had this), because single-day liquidity is arguably more
apt for a "today's movers" floor (a small-cap trading $2B today on a real catalyst IS a mover a 63-day
median would wrongly exclude), and because it works with the pipeline's snapshot flow + the tiny nightly
fixtures. If you'd rather the 63-day median (literally `_DV_WINDOW`), it's a swap of `_universe_buckets` to
call `assign_buckets` + a 63-bar nightly fixture. Full reasoning in DECISIONS.

### [FYI · RESOLVED clean] check:live 7/7 and check:migrations both green post-deploy
The CC5 delayed-nightly transient (Q-CC5-2) did NOT recur — check:live was 7/7 (masthead 2026-07-15,
calendar hygiene clean, next-edition Thu correct). check:migrations confirmed production's DB got the CC6
migration on deploy. check:nav worst 457ms (settings writer room, unchanged). check:lighthouse gates green
(CLS 0.002, first-load JS 183 KB, a11y 100); advisory perf 86 (synthetic-4G, in line with prior phases).

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC6's re-shoot needed "diff every candidate" again (it caught the login/sheet-ticker/ticker/track-record
camera-noise shots that moved WITHOUT failing). `scripts/vrt-diff.mjs` still throws
`ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter (PATTERNS.md) again, written inside
app/ and deleted after. The fix is one line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call, still.


## 2026-07-15 — CC5 (News, text-first)

CC5 rebuilt the news TEXT-FIRST (R4/D5): the generated L4/L3 image frames are deleted, so a card with
no stored photo is its words — headline, why-it-matters (on the lead), chips or "Market-wide", and a
byline carrying the source count only when >1. The story sheet lost its placeholder hole. Tagged
`cc-5`. Four heads-ups, none blocking.

### [FYI · RESOLVED — confirmed 7/7] Q-CC5-2 — check:live redded on the strip, then self-resolved
At the post-deploy gate, check:live's "strip · next-edition promise" failed: the strip promised "next
edition Thu" while the edition was Tuesday, Jul 14 (the next session is Wed). I read it before believing
it (your PD1 rule). The cause is not CC5 and not a checker bug: **tonight's Wednesday nightly had not
fired at 44 minutes past its 22:37 UTC cron** (last night's ran 52 minutes late), so production correctly
served Tuesday's edition, and the strip's next-edition — which follows the wall clock — had rolled
forward to Thursday because Wednesday's cron TIME had passed. It is the exact PD1 transitional window,
stretched by a GitHub cron delay. CC5 changed news CARD copy and nothing about the strip, the masthead,
the edition, or the cron; the assertion passed at cc-4 hours earlier; and the CC5-relevant assertion
(news byline links: 20 outbound anchors) is GREEN. The next-edition/strip logic is CC8/CC9's domain (the
edition-state machine), so this is a red "owed to a later phase," which the Endgame permits, and I tagged
cc-5 on the strength of a green four-leg rehearsal. **CONFIRMED RESOLVED:** the Wednesday nightly fired
~60 minutes late (run `29459077778`), published the Jul 15 edition, and a re-run of check:live went
**7/7** — the masthead reads 2026-07-15 and "next edition Thu" is now correct (the session after
Wednesday is Thursday). The diagnosis was exact. Two heads-ups fall out of it: (1) the strip DOES promise
the wrong day in the post-cron/pre-edition window — a real (minor) product wart for CC8/CC9's edition
machine, not a CC5 regression; and (2) **that nightly run is marked `failure` in the history, but only
its trailing Heartbeat step failed** — its empty `chore: heartbeat` commit was rejected because CC5's
docs commit beat it to `main` (the documented "main moves under your endgame" race). It is harmless — a
push keeps the cron alive and CC5's own pushes are that activity, and the edition published fine — but
worth knowing so a red nightly in tonight's history does not alarm you.

### [FYI · deferred to P-1] Q-CC5-1 — the story-sheet image position "below the byline"
4.4 says a real photo on the story sheet should render "below the byline, never between headline and
body" — but it ALSO says CC5 "only removes the placeholder block" and to "keep the excellent structure."
Those conflict, and a REAL photo between the headline and the body is exactly how a news article is laid
out; D5's actual complaint was the grey PLACEHOLDER hole, not a photo. So I removed the placeholder (the
figure renders only when a real image exists) and left real photos where they are. The "below the byline"
reposition is deferred to when P-1 lands and a real photo actually renders in production — moving a
working photo on the best surface in the app, for a path invisible in production today, is the
end-of-phase over-reach this build has regressed on. Say the word if you'd rather I reposition it now.

### [FYI · Part 0] P-1 (the news media bucket) — the default proceeded, text-first
CC5's design target was the no-image case, so nothing is blocked. NewsImage keeps its L1/L2 code; the
moment you provision a bucket, lead stories gain real photos with no further code change. Today the
seeded world's three fixture photos (fed-hold, fda, amd) exercise the image paths in VRT.

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC5's re-shoot needed "diff every candidate" again (the PD5 law — I confirmed the moved set equalled the
failed set, so nothing hid under the tolerance). `scripts/vrt-diff.mjs` still throws
`ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter from PATTERNS.md again. The fix is
one line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call, still.

### [FYI · your call] Q-CC5-3 — `dummy/` is authorised-to-delete but I LEFT it
Part 4.4 said CC5 may retire the `dummy/` screenshots once the news room is rebuilt. It is rebuilt, so
the news-placeholder shots in there are stale. But `dummy/` is UNTRACKED (never committed) audit evidence
— 51 screenshots both plans were built from, not only news — that YOU created, and CLAUDE.md says to
surface rather than delete files I did not create. Deleting untracked files is irreversible and the only
cost of keeping them is a little local disk, so I left the whole folder alone. `rm -rf dummy/` whenever
you want it gone. The UI-LIBRARY-EVALUATION trio (untracked `.md` + PDF + HTML) is a finished deliverable
and is also left in place.


## 2026-07-15 — CC4 (One hierarchy grammar)

CC4 applied ONE header/meta grammar to every market room (serif room titles, mono-600-ink-2 section
headers, Newsreader deks), rode the dead-space fixes (the Sectors & Scans module, Paper's rebalance,
Track's teaching empty state, the Academy measure), and landed D10's phone cuts (the unified tape, the
once-per-card noise line, the "This week" chip, the chip-scroll fade, the watchlist reason). Tagged
`cc-4`. Four heads-ups, none blocking.

### [FYI · a plan/guard collision, resolved on the guard's side] The as-of "faint on a match" is MUTED
4.3 said a module's as-of stamp renders `text-faint` when it equals the edition's updated stamp and
`ink-2` when it differs. `text-faint` is a 2.2:1 grey, and TWO guards born from the F7 axe lesson forbid
it on information — drift rule 18 (greps for bare `text-faint`) and the axe sweep (fails a 2.2:1
timestamp). So the MATCH case recedes to `text-muted` (the quiet grey, clears AA) and the DIFFER case
comes forward to `ink-2`. The hierarchy the plan wanted — a differing stamp outranks a matching one — is
preserved exactly; only the absolute faintness is traded, to keep the timestamp legible. Today every
module matches (one run), so today's as-of is muted; the differ→ink-2 path is live and unit-tested,
dormant until CC9's morning edition. Veto if you'd rather I carve a rule-18 exception and ship faint.

### [FYI] The as-of treatment is proven by a UNIT test, not an e2e — because VRT masks every timestamp
4.3 said "its e2e guard proves the two renderings differ." But the VRT harness MASKS every `time`
element (they encode wall-clock time), so a screenshot cannot see the as-of colour at all — and the
seeded world has ONE run, so no module's stamp differs from the edition's, so an e2e could only ever
exercise the MATCH rendering. The SectionMasthead unit test proves BOTH renderings (match→muted,
differ→ink-2) directly, which is the complete guard the mechanism needs. CC9's morning edition is the
first world where a real differing stamp exists; if you want an e2e then, that is its natural home.

### [FYI · Q-CC1-1 got a related picture, not the exact one] The Sectors & Scans module renders scan LABELS
CC1 handed CC4 the ticker-slug rendered proof (Appendix C's "ticker sheet — title not slug"). CC4 renders
scan LABELS in the new Sectors & Scans module ("Gap of 3% or more", not "gap-3plus") — so the label path
is now visible in production. But the ACTUAL leak CC1 fixed is on ACTIVE, unresolved, scan-fired signals
on the /ticker record, which the seed still does not model (its signal_log rows are resolved detector
keys). So Q-CC1-1 remains unit-proven at `patternLabel`, with a related label surface now rendered. If
you still want the exact ticker-record picture, it needs a seeded active scan-fired signal — a small
dedicated pass. Not blocking.

### [CLOSED at CC4] Q-PD6-3 — the watchlist reason on a phone
Closed the way the plan chose (4.3): the reason CLAMPS at one line with the full text in a `title`
attribute, so a truncated reason is recoverable on hover/long-press rather than silently lost. PD6 had
sketched a phone reflow; the plan chose the lighter fix, and that is what shipped. Veto if you'd rather
have the reflow (it is a larger `/settings` layout change).

### [still open, unanswered since LC1] Q-LC1-1 — vrt-diff.mjs is broken (pixelmatch absent)
CC4's re-shoot needed "diff every candidate" again (the PD5 law caught styleguide + the story sheet
moving WITHOUT failing). `node scripts/vrt-diff.mjs` still throws `ERR_MODULE_NOT_FOUND: pixelmatch`, so
I used the pngjs-only counter from PATTERNS.md again (write inside app/, run under Node 24, delete after)
plus opening every actual/diff image. The fix is one line — `npm i -D pixelmatch` — or a pngjs rewrite.
Your call, still.

### [FYI · Part 0] P-1 (the news media bucket) is CC5's decision point
CC5 rebuilds the news text-first and deletes the L4/L3 image frames. The L1/L2 rungs only ever render if
P-1 (a media bucket) is provisioned. If you have not provisioned it, the default proceeds — text-first,
no image case — which is 4.4's explicit design TARGET anyway, so nothing is blocked. Provision it any
time and CC5's L1/L2 code (kept) lights up.


## 2026-07-15 — CC3 (The masthead and the toggle)

CC3 gave the Desk one truth per line (R3): the market state appears once (the pill, now on the phone
too), the data vintage once (the masthead's new line 3 "Tuesday's close · updated 7:36 PM ET"), the
pipeline provenance once (the slimmed strip "14 sources · 2 degraded · next edition Wed ~6:37 PM ET").
And it added a one-tap Light ↔ Dark toggle to every top bar, both zones. Tagged `cc-3`. Three
heads-ups, none blocking.

### [FYI] The theme toggle writes the cookie CLIENT-SIDE, not through the Settings server action
The canonical three-way control (System/Light/Dark in Settings) stays exactly as it was — a form
posting a server action. The new one-tap top-bar toggle instead writes `document.cookie` in the
browser (same cookie name, same year-long lifetime) and stamps `data-theme` for the instant flip. The
reason is offline: the app is an installed PWA, and a server-action round trip fails with no network,
where a client cookie write does not — and the only thing that ever reads the cookie is the pre-paint
script, in the browser, on the next load. So there are two writers of one cookie shape. If you'd
rather both go through one door, the clean move is a shared client writer, but that would change the
"unchanged" three-way control, which the plan told me to leave alone. Logged in DECISIONS.

### [FYI] The toggle's icon names the DESTINATION (moon = "switch to dark"), matching its aria-label
A light app shows a moon (tap → dark); a dark app shows a sun (tap → light). This agrees with the
spoken label "Switch to {mode} theme", so a screen-reader user and a sighted user read the same fact.
The other common convention (icon shows the CURRENT state) would disagree with the label. Veto if you
prefer current-state.

### [FYI] A copy change nearly redded check:live — caught at the gate, fixed
Slimming the strip changed "next: Fri" to "next edition Fri". `checkNextEdition` (the production-truth
guard) greps that phrase, so it would have failed check:live the moment CC3 deployed — the one guard
that tests the deployed product, broken by a copy change nothing local would catch. I found it by
reading the guard before running it, fixed the regex + fixture + test, and verified 7/7 green against
production. Logged as a lesson (any strip/masthead copy change must grep scripts/live-truth.mjs).

### [VETO? · Q-LC1-1 STILL open, carried through CC3] vrt-diff.mjs is broken (pixelmatch absent)
CC3's VRT re-shoot needed the "diff every candidate" pass again (the toggle moved every room's top bar
and most fell inside the 600px tolerance — the PD5 trap). vrt-diff.mjs still throws
`ERR_MODULE_NOT_FOUND: pixelmatch`, so I used the pngjs-only counter from PATTERNS.md again. It works;
the tool is just dead. The fix is one line — `npm i -D pixelmatch` — or a pngjs rewrite. Your call
(still unanswered since LC1); I keep working around it.

---

## 2026-07-15 — CC2 (Time, told properly)

CC2 rewrote every reader-facing timestamp to R1's shapes: 12-hour clocks with AM/PM ("7:36 PM"),
dates that carry their weekday ("Tue, Jul 14"), a padded clock for the one mono column (the control
room table), and a one-line provenance stamp for footers. It added a new drift rule (only lib/time.ts
may build an Intl.DateTimeFormat). Tagged `cc-2`. Two heads-ups, neither blocking.

### [VETO? · Q-LC1-1 now has proof] vrt-diff.mjs is BROKEN — pixelmatch vanished, exactly as this risk warned
At CC2's VRT re-shoot, `node scripts/vrt-diff.mjs` threw `ERR_MODULE_NOT_FOUND: pixelmatch`. The LC1
decision (your open Q-LC1-1) was to let vrt-diff reuse Playwright's pngjs+pixelmatch instead of
declaring them — "they will not vanish while Playwright does snapshots." One of them vanished: only
pngjs is still in `app/node_modules`; pixelmatch is gone (a dependency tree dropped it silently, no
test to catch it because nothing runs vrt-diff in CI). **Nothing was blocked** — the triptych diff
images are the real proof, and I used a throwaway pngjs-only counter for the pixel numbers. But the
committed tool is dead until someone acts. The fix is one line — `npm i -D pixelmatch` (the explicit
form I offered you at LC1) — or a small rewrite onto pngjs alone. **I did NOT do it in CC2** (a
timestamps-only phase should not churn package-lock, and this is squarely your Q-LC1-1 call). CC4 is
the next big VRT phase; it can use the pngjs workaround or you can flip the switch before then.

### [FYI] I normalized the hardcoded clocks too, not only the formatter output
R1 says "every clock the reader sees is 7:36 PM ET". A few clocks are hardcoded literals, not formatter
output — the glossary's pre-market/after-hours definitions ("9:30am ET", "4:00pm ET"), the control
room's "nightly lands ~6:37pm ET", the weekend/market-open explanations. I moved all of them to the
house shape ("9:30 AM ET", "4:00 PM ET", "6:37 PM"), because leaving them would render two clock
dialects in the same app — the exact thing R1 abolishes. "midnight ET" stays a word (it is not an
HH:MM clock and reads clearer than "12:00 AM"). Nothing to decide; noted so the glossary and
control-room copy changes are not a surprise in the VRT diff.

## 2026-07-15 — LC3 (hot-file comment compression — the LAST LEAN phase)

LC3 compressed the comments in the 25 hottest files to the "one line of why" standard, proving each
batch comment-only with a new `pipeline/scripts/comment_prover.py`. Every WHY survived; the sacred list
(pragmas, clock derived-dates, check-drift's argued skip-lists, brand-assets' BRAND_FIELD) was left
verbatim. 5800 → 4034 comment lines across the 25 files (−1766, 30%). Nothing renders differently.
Tagged `lc-3`. **LEAN-CODEBASE is now complete (lc-1, lc-2, lc-3 all tagged); the order returns to
Plan A at CC2.** Two heads-ups, neither blocking.

### [FYI] The plan predicted "half"; the honest result is 30% — because the sacred list did its job
LEAN-CODEBASE said LC3 would roughly halve the comment mass (≈4–6k lines). It removed 1766 (30%), not
half, and the reason is that the sacred content is a large share of the hottest files:
check-drift.mjs's argued skip-lists (Part 3.3 forbids touching them — only −55 of 331), news.mjs's
per-cluster significance ARITHMETIC (a why a reader checks by hand), brand-assets' BRAND_FIELD
provenance, and the fixture test-name strings (code, not comments). I kept all of them and compressed
everything else. The prize — the recurring token cost of the files every session reads — is paid: the
prose-heavy files (copy.ts, morning.ts, the desk page, vrt.spec) each shed ~100–140 lines. Nothing to
decide; noted so the number is not a surprise.

### [VETO?] Q-LC1-1 is STILL open (carried through LC2 and LC3, unanswered)
The vrt-diff.mjs devDependency question (LC1 section below) had no veto in DECISIONS.md, so per the
handoff I left it as-is again: vrt-diff reuses Playwright's pngjs/pixelmatch. It is a two-line change
if you ever want the explicit form; it is no longer a LEAN phase's to fold in (LEAN is done), so it now
travels with the CC phases or waits for your word.

## 2026-07-15 — LC2 (consolidation — second phase of LEAN-CODEBASE)

LC2 built one e2e session helper (all 24 login-bearing specs import it), made `waitForLayout`
importable, deduped the guard-script plumbing (session-cookie + manifest libs), and reconciled
`record-fixtures.yml` with the `new-provider-adapter` skill. Tagged `lc-2`. Behavior-preserving; no
guard weakened. Two heads-ups, neither blocking.

### [FYI] Two of the plan's "identical N copies" counts were off — measured, not trusted
LEAN-CODEBASE said `signIn` was byte-identical in 15 spec files (it was 12 — auth, nav and offline
each differ) and the cookie mint was identical three times (it is two TTLs — check-live signs a
one-hour cookie, the others thirty days). Neither changed the plan's intent, only HOW the extraction
had to preserve behavior: the shared `signIn` took the true common shape, the three variants were
kept, and the cookie helper took a `ttlSeconds` parameter. Both proven byte-identical (stdout for the
deterministic guards, token for the cookie). Logged in DECISIONS.md and LESSONS.md. Nothing to decide.

### [FYI] The 5.6 recorder reconciliation — I added the keyed recorders, left the keyless ones local
The plan offered two options (add the missing recorders as steps, OR amend the skill to say recorders
run locally). The skill's actual rule is keyed→step, keyless→local, so I added the 6 keyed recorders
whose secrets are provisioned (alpaca, edgar, finnhub, fmp, fred_calendar, marketaux) as steps and
left the 2 keyless ones (erapi, nrb) to run from the laptop. Amending the skill would have been false
for the keyed providers. Settled and logged in DECISIONS.md; noted here only so you know it was a
judgment call.

### [VETO?] Q-LC1-1 is still open (carried from LC1, unanswered)
The vrt-diff.mjs devDependency question (below, in the LC1 section) had no veto in DECISIONS.md at LC2
start, so per the handoff I left it as-is (vrt-diff reuses Playwright's pngjs/pixelmatch). If you want
the explicit-deps form, LC3 can fold it in — it is a two-line change.

## 2026-07-15 — LC1 (the standard, the deletions, the tool — first phase of LEAN-CODEBASE)

LC1 set the comment standard (CLAUDE.md point 3, "comments are one line of why"), committed two
tools (comment_stats.py, vrt-diff.mjs), executed Part 4's deletions after a fresh per-row reference
re-check, rewrote the README, and gated the nav-timing evidence append on CI. Tagged `lc-1`. One
heads-up, not blocking.

### [VETO?] Q-LC1-1 — vrt-diff.mjs uses Playwright's pngjs/pixelmatch instead of its own devDependencies
LEAN-CODEBASE Part 5.4 says the VRT diff tool's "deps in app devDependencies". I did NOT add them:
both `pngjs` (7.0.0) and `pixelmatch` (5.3.0) already resolve from `app/node_modules` because
Playwright carries them, and the tool's header says to run it from `app/`. My reasoning: LC1's whole
theme is shedding weight — this same phase deletes the orphaned root `node_modules/` that was a
hand-rolled pixelmatch/pngjs install — so re-adding them as explicit deps and churning the lockfile
would work against the phase. They are Playwright's own snapshot-comparison deps, so they will not
vanish while it does VRT, and if they ever do, adding the two lines is a one-minute fix. If you would
rather the tool own its deps explicitly (the plan's literal text), say so and LC2 adds them — it is
a devDependencies + package-lock change, nothing more. Recorded in DECISIONS.md (2026-07-15).

## 2026-07-15 — CC1 (the two live defects + three paper cuts — first phase of the two-plan commission)

CC1 fixed the font that renders wrong on some refreshes, the Daily Brief that publishes empty every
night, the held-state skeleton, the doubled CPI, and the ticker record's raw scan slug. Tagged
`cc-1`. Three heads-ups, none blocking.

### [FYI] Part 0 decisions are still unanswered — the plan's defaults stand
I checked DECISIONS.md for answers to CLARITY-AND-CADENCE Part 0 (P-1 the media bucket, P-2 the
GitHub PAT for the control room, the dawn-cron hour, the retention windows). None are provisioned or
vetoed, so every default proceeds when its phase arrives — text-first news (CC5), a display-only
control room (CC7), a 10:30 UTC Mon–Fri dawn cron (CC8), and the Appendix D retention numbers (CC10).
Nothing to do now; provision or name a number any time and that phase absorbs it.

### [FYI · handed to CC4] Q-CC1-1 — the ticker-slug fix is proven by unit test, not by a picture
Appendix C predicted a "ticker sheet (title not slug)" VRT delta for CC1. It did not happen, and
that is honest rather than a gap. The seeded world never reproduced the leak: all three seeded
`signal_log` rows are RESOLVED (they carry resolutions, so they render no active-signal label) and
they use DETECTOR keys (`golden-cross`), which mapped correctly all along. The production leak is on
ACTIVE, unresolved, SCAN-fired signals (`gap-3plus`), which the seed does not model. Reproducing it
means adding an active preset-keyed signal to the seed — which surfaces on the forecasts /
track-record surfaces and re-shoots several baselines, a swing too wide for a scoped paper-cut phase
(the exact end-of-phase swing this build has regressed on). **I proved the fix with a unit test that
observes the exact defect at `patternLabel`** and **handed the rendered proof to CC4**, which already
touches Track record / forecasts and budgets a wide re-shoot. If you'd rather it had a picture sooner,
say so and I'll add the seed signal in a small dedicated pass.

### [still open, now inherited by CC4] Q-PD6-3 — the watchlist reason truncates on a phone
Unchanged from PD10. On a 412px phone `/settings`'s watchlist row squeezes the reason (the only
copy you authored) to zero characters. It was PD10's to defer and it is now **CC4's** (the hierarchy
+ phone-paper-cuts phase names it explicitly, §4.3 / D10). No action from you needed; noting it so it
does not fall between the two plans.

### [still pending your device] the PD10 iOS on-glass photo checklist
Still owed to your iPhone (docs/pd-evidence/pd10-hardening.md §4): open a story sheet → scroll →
overscroll-dismiss → land where you left, in mobile Safari and again installed-standalone. Not any
phase's work; kept alive so it is not forgotten.

---

## 2026-07-15 — PD10 (hardening, evidence, docs — **the build is COMPLETE**)

PD10 was the last phase. It added no features: it swept the detail sheet's own touch targets and
axe (by opening it), verified the iOS contract in code, brought the docs current, and tagged
`pd-final`. Three things want your eyes, and one of them now needs a decision from you.

### [NEEDS YOUR CALL] Q-PD6-3 — you cannot read your own watchlist reasons on a phone, and this is the last phase

I raised this at PD6 and proposed PD10 as its home. I did **not** fix it here, on purpose, and I
want you to overrule me if you disagree. On a 412px phone, `/settings`'s watchlist row squeezes the
reason — **the only writing you authored yourself** — to zero characters between the symbol chip and
the Focus/Remove buttons. The fix is real but it is a responsive-LAYOUT change (the reason drops to
its own line on a phone) plus a `/settings` VRT re-shoot. That is outside PD10's brief ("hardening,
evidence, docs — no new features"), and it is exactly the "unplanned swing at the end of a long
phase" that this build has regressed on three times — the reason PD6 deferred it in the first place.
**Assumption I shipped on:** leave it for a decision you own, because the build now completes and there
is no later phase to absorb it. It is a ~20-minute follow-up whenever you want it — say the word.

### [FYI · ruled] the sheet's grabber is a decorative pill, and I did not pad it to 44px

The plan asked me to verify the grabber's hit area "on a real measurement". I did: on the live phone
build the ✕ is 44×44 (the sheet's one announced control — it passes), the grabber is 410×24 and
`aria-hidden` (no role, no handler, no announced name), and the thing a reader actually pulls is the
scroll container at 410×746. The 44px rule binds announced targets; a decorative hint that triggers
nothing is not one, and padding it would shift the phone sheet 20px for no functional gain. **Ruled,
logged in DECISIONS.** Veto if you'd rather the visible handle were itself a 44px target.

### [FYI · closed] Q-PD6-1 — the VRT oracle stays blind to a pure hue-shift, on purpose now

I considered arming Playwright's per-pixel `threshold` (the fix for the oracle's blindness to a large
low-contrast wash). I decided **against** it, and the reason is that the build completes here: a
stricter oracle on a build with no maintenance phase left would red all 97 baselines the first time
an upstream Chromium nudges anti-aliasing, with nobody scheduled to re-baseline. A tolerant oracle is
the right instrument for a finished build. The specific PD6 bug is already fixed; the residual is a
documented limitation, mitigated by the standing "decode + count every candidate" discipline. **Q-PD6-1
is closed.**

### [FYI · pending your device] the iOS manual checklist is built to spec, photographs owed

Part 13's manual items are all present in the code — 92**dvh**, `env(safe-area-inset-bottom)` footer
padding, `overscroll-behavior-y: contain` (so the sheet's overscroll-dismiss does not fight Safari's
left-edge swipe-back), opacity-only fade, reduced-motion honoured. What a session **cannot** do is
photograph it on glass: open a story sheet → scroll → overscroll-dismiss → land where you left, in
mobile Safari and again installed-standalone. **Assumption:** built to spec, pending device
confirmation (the Autonomy Contract permits proceeding on a manual gate that needs live observation).
The photos have a home waiting in `docs/pd-evidence/pd10-hardening.md` whenever you can run it.

### Every `[VETO?]` in this file carries its assumption marker

Closeout done: I re-read the open `[VETO?]` items and each states the assumption it shipped on, so if
you never veto, the assumption stands as the decision. Nothing here blocks the completed build.

## 2026-07-14 — PD7 (news depth: the pipeline)

### Q-PD7-1 — [FYI · BOOKED FOR PD8] the eighth depth stat (sector breadth) is deliberately absent

Plan 9.2 lists `sector:{key}:breadth1d` — "advancers/decliners within the sector's scan universe
tonight". **I could not compute it in the news stage, and I chose absence over a wrong number.** The
two tables that looked like they could feed it cannot: `scan_result` holds only the preset MATCHES
(so a breadth count over it is not the sector's breadth — the near-52w-high scan alone skews it
advancing), and `price_bar` holds only the 15 served ETFs. The per-symbol returns for the whole
universe exist only in the in-memory lake during the full nightly, and the newsdesk never sees it —
it's a Postgres closure in both modes. Fixing it means threading the lake into the newsdesk, or a
second migration to store a per-sector breadth. Appendix B already ruled that a second migration is
a deliberate act with its own DECISIONS line, not something a long phase slips in at the end — so I
left the stat out, the narrator has one less word, and nothing invents a number. **No action needed;
just so you know one of the eight isn't there and why.**

### Q-PD7-2 — [FYI · no action] the first real dispatch published a sha1 hash to production, and every guard passed it

Worth your eyes because it is the cleanest example yet of the thing your readability rule is really
about. PD7's live `news` run published this sentence to the production database:

> "This story is carried by 1 outlet tonight (cls:798fa63d458eaeca83850221b351fe71ed9cddae:corroboration)."

The number is true. The citation is correct. The schema validated, the verification gate cleared
every figure, and the night reported a healthy run. **It is a sha1 hash in a newspaper**, and the
only thing that caught it was reading the output — no test in the repo could have. Fixed at both
ends (the prompt now says where citations go; a deterministic guard deletes any section carrying an
identifier). Recorded here because the brief said the real dispatch IS this phase's picture, and it
was right. Full story in `docs/pd-evidence/pd7-insight.md`.

---

## 2026-07-14 — PD6 (the voice: the remaining rooms)

### Q-PD6-1 — [FYI · BOOKED FOR PD10] the pixel oracle is BLIND to a large, low-contrast change

**Nothing is needed from you.** This is the honest version of something PD5 got half right, and I
want it written down before anyone relies on the oracle more than it deserves.

PD5 noticed that the `scans-preset` baseline had changed by ~56,000 pixels **without failing**, and
concluded the tolerance had absorbed it. It had not. The tolerance is `maxDiffPixels: 600` — 56,000
pixels would blow straight through it.

What actually happened is worse. Playwright's screenshot comparison ALSO takes a per-pixel
`threshold` (a colour-distance cutoff, default 0.2), and we have never set it. **A hover wash is a
big region of a *slightly* different colour.** Every one of those 56,000 pixels falls under the
per-pixel cutoff, so *none of them count as differing at all*, and the 600-pixel budget is never
even consulted.

So the oracle is not tolerating that class of change. **It cannot see it.** Any pure hue shift —
a background tint, a wash, a colour token quietly changing value — is invisible to it at any size.

**What I did about it:** the specific bug is fixed. The committed `scans-preset` baselines dated from
**PD2**, before PD4 parked the mouse at (0,0), and were photographs of a table row sitting in a hover
highlight. I confirmed that with my own eyes (the crop is in `docs/pd-evidence/pd6-rooms.md` §7), and
PD6 re-shot them. **Q-PD5-2 is closed.**

**What I did NOT do:** arm the `threshold`. That is a change to the *instrument* all 83 baselines are
measured by, and it belongs in a phase that can re-photograph every one of them and look at the
results — not in a phase that would be doing it as a side-effect. **Booked for PD10 (hardening).**

### Q-PD6-3 — [FYI · NEEDS A HOME] you cannot read your own watchlist reasons on a phone

**Nothing is needed from you, but you may want to tell me where this belongs.**

I found this by looking at a screenshot I was checking for something else entirely.

On a 412px phone, `/settings`' watchlist row is: `[symbol] [why you're watching it] [Unfocus]
[Remove]`. Those four things do not fit, so the reason column — the *only* piece of writing you
authored yourself — gets truncated to **nothing**. The committed baseline shows **zero** characters
of it. My change gives it three ("Ea…"). Both are useless.

**It is not PD6's bug.** It is in the picture PD6 inherited, and PD6's brief for this room is *"type
rhythm only"* (plan Part 8.3). I did not want to redesign a row's phone layout as the fourth
unplanned swing at one small thing at the end of a long phase — that is exactly how the last three
regressions happened.

**The fix is small and obvious when someone owns it:** on a phone the reason should sit on its own
line under the symbol, not fight two buttons for a 20px slot. That is a five-line change to
`WatchlistManager.tsx`. It has no natural home in the remaining plan (PD7 is the pipeline, PD8/PD9
are news and sheets), so **I would put it in PD10's hardening pass unless you say otherwise.**

### Q-PD6-2 — [FYI · BOOKED FOR PD8] the touch sweep visits a news story that has nothing in it

**Nothing is needed from you.**

A ticker chip that is a *door* is a control, so it must be 44px on touch. It shipped at **21px** —
and it had been live on the news story page since PD5, passing the phone sweep every single night.

The sweep visits exactly one story, `nc-fed-hold`. That cluster has **zero** affected tickers in the
seeded world, so the affected-tickers table renders no rows, so there were no doors to measure, so
the room reported clean. **The rule was being kept by the shape of a fixture.**

The bug is fixed at the component, so it is gone everywhere at once, and the 44px contract is now
pinned in `TickerChip`'s own unit test rather than in a sweep that needs the data to cooperate. But
the blind spot is still there: **every control inside that table is still unswept.** PD8 rebuilds the
story page and should point the sweep at a story that actually has one.

### [FYI] The pictures caught two of my own bugs this phase, and no test would have

Worth thirty seconds of your time, because it is the third phase running that this has happened and
the first time the bugs were mine.

1. **The 44px door made every table row 69px.** The fix was right and its side-effect was not: the
   44px target *added* to the table cell's existing padding, so every row in every table grew by half
   again — to make room for something invisible. Every guard passed, including the touch sweep, which
   asks "is it 44px?" and got 44px. I found it by putting the new baseline next to the old one.
2. **A chip is wider than the word it replaces.** The settings watchlist's symbol column was 96px,
   sized for the text "AAPL" (~34px). As a bordered chip that is ~48px, and beside its FOCUS tag it
   no longer fit — so the tag wrapped to its own line and shoved the company name down. Nothing
   failed. It just looked wrong, because it was wrong.

Both are fixed and both are now in LESSONS. No action.

---

## 2026-07-14 — PD5 (the voice: the richness kit)

### Q-PD5-1 — [FYI · BOOKED FOR PD7] the Desk's brief carries glossary doorways but no emphasized numbers

**Nothing is needed from you.** This is a marked assumption, recorded because it looks like a gap and
is not.

Ruling E5 says a number may be set in mono — the "this was checked" typeface — **only if the
deterministic gate cleared it**. That requires an *allow-list*.

- A **news story has one.** The pipeline stores `key_numbers`: the figures the gate checked and
  passed. The news room emphasizes exactly those, and nothing else.
- The **evening brief does not.** Its verification record stores the **flags** — the entities that
  *failed* — and a published brief may still legitimately carry up to two of them.

So the only way to emphasize a brief's numbers today would be to work backwards: mono *everything that
looks like a number* except the flagged ones. That means the **app** would have to decide what counts
as a number — its own rules about whether "Q3" or "2.1x" is a figure — and the pipeline already
answers that question. Two answers to it is exactly how the two halves of this product would start
disagreeing about what has been verified, silently, with every test green.

**What I did:** the brief carries its glossary doorways (a definition is our own claim, so it is always
safe to make) and **no** emphasized figures. Its numbers read as ordinary prose, which claims nothing.

**The fix is a small pipeline change** — have the gate publish what it *cleared*, not just what it
flagged — and it is booked for **PD7**, which is the phase that touches the pipeline anyway.

### Q-PD5-2 — [WORTH YOUR EYES · no action] the pixel oracle has a photograph of a hover state in it, again

**Nothing is needed from you.** Recorded because it is the *third* time this class of bug has been
found, and the pattern is now unmistakable.

The rule for updating a screenshot baseline is: **diff every candidate against its committed one, not
just the ones that failed** — because a shot can change and still pass (there is a 600-pixel
tolerance). Doing that on PD5's rehearsal turned up three baselines that had changed **without
failing**, on pages PD5 never touched: the two scan-preset pages (~56,000 pixels), the login page, and
one settings shot.

Looking at the pictures explains it. The **committed** baseline for the scan-preset page has a **row
highlighted, as if the mouse were resting on it**. The fresh photograph does not. The app is identical;
the *camera* moved.

This is exactly what bit PD4 — the ticker chart's baseline had encoded where the login button
happened to be, because Chromium leaves the pointer wherever it last clicked. PD4 fixed that one shot
by parking the mouse at (0,0). The scan-preset page is telling us the fix did not reach everywhere.

**I did not re-photograph it.** The oracle currently passes it, PD5 did not touch that page, and
re-baselining from a candidate I cannot fully vouch for would be trading one unexplained picture for
another. It wants a dedicated pass — it is a small, contained job, and it belongs to whichever phase
next touches the scans room (PD6).

### Q-G4-1 — **CLOSED** ✅ the movers' delta chip carries `data-p2`

You never had to rule on this: the code did. The chip is a market figure, so it holds still — and the
moment it said so, the build **failed on the Desk's movers and watchlist rows**, which had been
fading their background on hover since the redesign. They had got away with it because their delta
chips were unmarked, so the guard had never looked at them. The hover is instant now. Nothing was
lost but a 120ms fade, and a money figure that never moves was gained.

---

## 2026-07-14 — PD4 (the phone composition)

### [FYI — but I think you'll want to know] Your Desk has been scrolling sideways on a narrow phone

Before PD4 changed anything, I measured the **tagged, green, fully-guarded `pd-3` tree** at 360px —
the width of a Galaxy S in portrait, and of most budget Androids:

> **The Desk overflowed by 16 pixels. In production. And the guard that exists to catch exactly that
> was green.**

The reason is a small, ugly one. The sweep runs at each test project's own screen, and the phone
project is a **Pixel 7 — 412px wide**. At 412 the bug does not happen. So the sweep had been asking
its question only at the comfortable end of the range, and passing, for months.

Two other live bugs came out of the same look: the mortgage cell's window label was rendering **"· vs
/ prior / week" — one word per line**, and the S&P's own delta chip ran off the right edge of the
screen. All three are fixed. Before/after pictures and the exact numbers:
`docs/pd-evidence/pd4-phone.md`.

**No action needed.** I mention it because it is the second phase running where the thing that caught
a real bug was *looking at the screen*, and the thing that missed it was the test suite.

### [VETO?] I did NOT build the tape row the plan specified — the arithmetic wouldn't allow it

Part 7.1 said the three index echoes (Nasdaq, Dow, small caps) should sit **3-up as cards** under the
risk gauges. I built that, then measured it:

| | 360px | 412px |
|---|---|---|
| what a 3-up cell actually gives you | **74px** | **91px** |
| an index level — `22,345.67` | ~81px | ~81px |
| its delta chip — `▲ +0.29% · 1D` | ~95px | ~95px |

The plan estimated "≈112px" of cell. The real number is 74. The level and its chip **cannot fit**,
and a number in a monospace font has nowhere to wrap *inside itself* — so it does not shrink, it
overflows. At 360 the levels ran 8px **into the card next door** and the chips broke into three
lines.

I could have shrunk the type until it fit. I got it to **within 1px** of breaking, and stopped: a
layout one pixel from failure is a coin flip, not a design.

**So the three echoes are now a full-width list** — one row each, label on the left, figure and
change on the right. I believe this *keeps* the plan's actual argument rather than breaking it: that
argument was never "three columns", it was that VIX and the 10-year tell you something the big S&P
number doesn't and deserve room, while Nasdaq/Dow/small-caps mostly repeat it. **Cards above, a list
below** says that more clearly than a big card next to a small one.

**Veto is easy** — it is one component (`MacroPulse`). But please look at the after picture first
(`docs/pd-evidence/pd4/after-pulse-360.png`); I think it reads better than what was drawn.

### [VETO?] The phone login now has your mark on it — I decided this, as PD3 asked me to

This was the open question PD3 left. The brand panel is desktop-only by design (a phone has room for
a headline and a form), but the **mark went out with the panel** — so the first page anyone ever
opens, on the device most people open it on, showed the product's name in text and nothing of its
face.

There is now a 48px lockup above the headline on phones. It **costs nothing**: the phone was already
downloading that image file for the panel it can't see (browsers fetch images inside hidden elements
anyway).

Reversing it is two lines. But I think a login page with no mark on a phone was an oversight, not a
design — and the test that guarded it literally asserted the mark's *absence* and called it "the
design, not a regression". Nobody had ever looked at it.

---

## 2026-07-14 — PD2 (brand: the identity kit)

### [FYI] Your logo file has fake transparency — and I did NOT edit it

`myLogo11.png` is the right artwork and it is now the master at `assets/brand/logo-source.png`,
byte for byte as you gave it to me. But it has **no transparency at all**: the tool that made it
painted the grey-and-white transparency *checkerboard* into the pixels. Dropped straight into an
icon, every one of them would have had a chequered box around the mark.

The generator cuts it out itself (it flood-fills the checkerboard from the edge inward, which is why
it can never eat the white "M" in the middle), so **nothing is broken and nothing needs doing.** But
if you ever re-export the logo, **a genuine RGBA export would be a little cleaner** — I would delete
about forty lines of pixel-keying.

I also checked the other two: `myLogo.png` DOES have real transparency, but it is the **navy/gold/green**
version — the wrong palette, and green candles collide with the colour meanings this app reserves.
`myLogo11.png` is the one.

### [FYI] The app had no browser tab icon. At all. Since the first phase.

`proxy.ts` has allowlisted `/favicon.ico` since P0 and **no such file has ever existed** — the old
generator wrote `favicon.png`, nothing linked it, and the app has been shipping a blank tab this
whole time. It has one now, and a test fetches every brand path so it cannot happen again.

### [VETO?] The phone login has no mark — **DECIDED AT PD4 (2026-07-14): it now has one.** See PD4 above.

The login's brand panel is desktop-only by existing design (below `lg` it collapses and only the
headline and form remain), so the mark you see at 96px on a laptop **is not there on a phone at all**.
I did not change that — plan Part 7 (PD4) owns the phone composition, and this is its call to make.

**If you want the mark on the phone login, say so and PD4 will add it.** It is a two-line change.

### [FYI] A follow-up I chose not to do, and you may disagree

`e2e/briefing.spec.ts` writes a journal entry into the seeded test database and **never cleans up**,
which is what corrupted the Desk's pixel baseline (see below, and DECISIONS). I fixed it by making the
CAMERA look away from the count, which is correct and cheap. **The deeper fix is to make the test
clean up after itself** — but there is no delete path for a journal entry today, so building one is a
feature, not a test fix. Left as a follow-up rather than smuggled into a brand phase.

### [FYI] The gate had been forgiving a real bug for months

Worth knowing because it says something about the gate rather than about the brand.

The pixel oracle allows a 600-pixel difference before it complains. The Desk's baseline said
*"none saved tonight"* while every real run produced *"1 saved tonight"* — a 387-pixel disagreement,
sitting under the tolerance, **for as long as that baseline has existed.** Nobody could have known.
PD2's new mark added 746 more pixels, the total cleared 600, and the old bug fell out of the failure.

And the same tolerance was hiding the mark itself from **45 other shots**: they changed, they did not
fail, and they would have gone on passing while showing a top bar the app no longer has. All 59
changed baselines were re-photographed, not just the 14 that went red.

**Nothing is wrong now.** But "what the gate forgives is where the next bug lives" is now written into
PATTERNS.md, and I will keep looking at tolerances rather than through them.

---

## 2026-07-14 — PD1 (production made current)

**[FYI — DONE, and it is the good news] Your production Desk is now telling the truth, and there is a
command that says so.** `npm run check:live` reports **all six assertions green** against the live
site (one is a PENDING owed to PD8 — the news bylines aren't real links yet, which is a feature that
hasn't been built, not a fault). It now runs at the post-deploy step of **every** phase gate from here
on, so no phase can exit on a deployment nobody looked at.

**[FYI — DONE] The "Coinbase Cryptocurrencies" rows are gone, and they were doing more damage than
either of us thought.** Q-PD0-1 is closed. They weren't just ugly: your Desk shows the **15 earliest**
calendar rows, so those four dead rows (dated on a Saturday and a Sunday) sorted **first** and spent 4
of the 15 slots. Your calendar said it ran **"through Jul 16"**. The database held events through
**Jul 23**. **The junk was evicting six days of your real calendar**, and every test was green, because
every test was asking whether the app rendered its rows correctly — and it did. It now reads *"through
Jul 22"*. Both ends are fenced: the pipeline sweeps the whole table on each run, and the Desk refuses
to render a row older than the edition it is serving.

**[FYI — DONE] Q-N6-1 (the Saturday rows) is executed and closed.** Your decision, carried out after
Monday's edition was verified: 1315 + 1 + 1 rows deleted. **Your `signal_log` was not touched — 4551
rows before, 4551 after.** I also checked *before* deleting whether the poisoned date had reached any
table you had **not** authorised; it hadn't. Full before/after in `docs/pd-evidence/pd1-production.md`.

**[WORTH YOUR EYES — the most interesting thing I found, and it was in my own instrument.]** After the
calendar went clean, `check:live` immediately failed **twice more** — and **production was right both
times; the checker was wrong.** It was 00:25, just past midnight. Two of the six checks compared the
Desk against the **wall clock**. But your Desk serves a dated **edition**, like a newspaper — and
Monday's paper is still Monday's paper at 1am on Tuesday. So the checker demanded the strip promise
"Wed" when the honest answer was "Tue" (tonight's edition), and it called Monday's own FOMC decision "a
row in the past".

**Both would have failed a perfectly healthy Desk every single night**, between midnight and the
evening run — starting the very night this became a gate. A gate that cries wolf nightly is one you
learn to ignore, and then it isn't there on the night it's right. Both checks now take **no clock at
all**. The rule is written into CLAUDE.md: *if a surface is derived from the edition, it is measured
against the edition.* **Nothing to do — I just want you to know the guard was the thing that was
broken, twice, and that I read the failures instead of believing them.**

**[FYI] A tracked file went missing from your working tree during this session and I put it back.**
`Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root, committed back in `cb20a9f`) showed up as
deleted. **I did not delete it**, I can't account for what did, and I restored it byte-for-byte from
`HEAD` rather than commit the deletion. Nothing else was affected. If you deleted it deliberately,
delete it again and commit — I'd rather hand it back than quietly bury it.

---

## 2026-07-13 — PD0 (the dating contract) — **the polish & depth build begins**

**[WORTH YOUR EYES, and it is good news] Your Desk healed itself before I got there, and I have the
receipts.** When I fetched production tonight, the masthead read **Monday, July 13, 2026**, the strip
read *"Data through Mon Jul 13 close"*, and the macro board was **fully populated** — mortgage 6.49%,
CPI 4.2%, gold 3,995.36, the rupee, and the Mood gauge at 56/100 with all five of its components. The
index levels are the **real FRED ones** (S&P 7,575.39), not ETF prices wearing an index's name. The
board you reported as "absent" was never broken; it was starving on a poisoned edition. PD1 verifies
all of this formally.

**[VETO?] I found something live in production that nobody had reported, and the plan said it would
fix itself.** Your session calendar is **still showing "Coinbase Cryptocurrencies"** — rows written by
the news ingest that was allowlisted away a month ago. The plan predicted the next nightly would
rewrite them. **It didn't, and the reason is exact:** the calendar refresh replaces the **forward**
window, and those rows have fallen **behind** it. A row behind the window is not in the window, so
nothing ever touches it. They rot there.

Two of them are also dated **Jul 11 and Jul 12** — a Saturday and a Sunday.

**This is PD1's to clean** (it is the phase that repairs production), and I have not touched your
database. I am flagging it because it is the first thing `check:live` found on its first run, and it
is a good demonstration of why that instrument had to exist: **fixing a write path does not clean a
table, and nothing that runs in CI could ever have told you.**

**[FYI] I spent 1.2 KB of your remaining JavaScript headroom, and I want you to see the number
because it is tight.** `/news` went from **195.1 → 196.3 KB** against a **200 KB ceiling that does not
move**. The cause: the NYSE holiday table is now one JSON file instead of a TypeScript one, because
three things need to read it (the app, the new production checker, and a test that holds it against
the real exchange calendar) — and a table only TypeScript can read is a table that gets **copied**,
which is how every duplicated calendar in this codebase has drifted.

Worth knowing: **0.6 KB of that was a comment.** I had written an explanatory `_comment` key inside
the JSON. JSON has no comments — a `_comment` key is *data*, and data in a bundle ships to every
browser. It is gone; the prose lives in the TypeScript now.

**Real headroom is now ≈3.7 KB, not the ≈4.9 KB the plan records.** PD5's shared kit and PD9's overlay
both spend from that same pot. PD9's code-split was already pre-authorised for exactly this reason, so
nothing is blocked — but plan against 3.7.

**[FYI] The plan's own census was wrong, and I did not follow it.** It said there was "exactly one"
local weekday formatter in the app to delete. There was one **display** formatter — and a second thing
using the same mechanism that is *not* a duplicate: `market-hours.ts` asks New York what day it is in
order to decide **whether the market is open**, and compares the answer to "Sat"/"Sun". No reader ever
sees that string. The rule the plan specified ("zero matches outside `lib/time.ts`") would have failed
the build on correct code. Drift rule 22 names **two** doors, each with its reason, and a third fails
the build.

**[FYI] Nothing in PD0 is blocked, and none of the questions below changed.** Q-G4-1 (the movers-chip
ruling) is still open and still costs one paragraph to reverse — **PD5 has not started, so nothing is
built on it yet.** Q-G3-2 (the Academy lesson that is neither swept nor pixel-locked) is still a
one-line change and still worth doing early.

---

## 2026-07-13 — G0 (the gate-efficiency build begins)

**[FYI] One behaviour change you will notice with your own hands: a second push now kills the first
push's CI run.** That is the new concurrency group, and it is what the plan asked for — it is why a
superseded run at `nc-final` burned 785 seconds and this one died in 40. The consequence to be aware
of: if you push a code commit and then push a docs commit a minute later, the **code** run is
cancelled and only the docs run survives. During a phase exit that is exactly what you want (the last
push is the one that ships). Outside one, if you ever want a specific commit's run to finish, let it.
**G2 removes this interaction entirely** by making docs commits trigger no CI at all.

**[FYI] Nothing in G0 touched the app.** No product code, no styling, no pipeline logic. The only
files that changed are `ci.yml`, one new pytest, `CLAUDE.md` (two annotations), and
`POLISH-AND-DEPTH-PLAN.md` (one dated note saying PD0's `pd-*` wiring is already done). The `gate-0`
tag run is therefore expected to be green on an unchanged suite — and it was, first try, which is
also the proof that the ci.yml surgery broke nothing.

**[FYI] `/settings` still answers in ~481ms warm against a 150ms budget, every sample a cache miss.**
This is **not** a G0 regression — it is the app's one *writer* room, deliberately excluded from the
cache allowlist with a defended reason in `check-routes.mjs` (a page may be cached, or written to and
read back in the same click, never both), and `check:nav` keeps it in report mode for exactly that
reason. N7 measured 455ms in the same state. I mention it only so that seeing the number in this
phase's evidence does not read as something new breaking.

**No open questions from G0.** Nothing was assumed that needs your veto.

---

## 2026-07-13 — N7 (hardening, evidence, docs) — **the News & Control build is closed**

**[FYI] Your guards were passing on a page that does not exist.** The touch-target, sideways-scroll
and accessibility sweeps walk a list of rooms and measure what is on the screen. Ask for a news story
whose id is not in the database and the app shows its "page not found" screen — so on any run without
seeded data, the sweeps were measuring **the 404 page**, finding nothing wrong with it, and reporting
the story page clean. I verified it: the accessibility sweep **passed** a story page against a
database that has never contained that story.

The part worth your attention is why it was invisible. My first fix was to check the HTTP status code
— and it still passed, because **this app answers a missing page with "200 OK" and then shows you the
404 screen.** You already knew half of that: an F-phase note in this file says *"unknown tickers
return HTTP 200 instead of 404"*, and judged it fairly — *"a wrong status code, not a wrong screen"*.
That is true of what **you** see. Nobody asked what it does to a **guard**, and the answer is that it
silently disarms every guard that trusts the status. A cosmetic flaw in the product turned out to be
a load-bearing flaw in the instruments. The sweeps read the page's actual content now, they refuse a
redirect, and the touch sweep fails if it measured no controls at all. All negative-controlled.

**[FYI] The Development Plan PDF has been wrong for a month, and I only found it because I went to
edit it.** There were **two** hand-kept HTML copies of that document: one generates the markdown you
read in the repo, the other generates `docs/Development-Plan.pdf`. Nobody decided that — it just
happened — and then they drifted. **Not one of the 2026-07-12 app-feel amendments had ever reached
the PDF.** Its route map was missing `/scans/[preset]`, a room that has existed for a month, and it
still promised a rendering strategy the app abandoned. The markdown was right, the PDF was wrong, and
both looked equally current and confident.

Two sources of truth for one document is not redundancy — it is a slow-motion lie, and the copy that
rots is the one that gets read least, which is the PDF: **the one you actually open.** There is one
source now, `docs/src/build-plan-pdf.py` builds both outputs from it, and the PDF is re-rendered (37
pages). I have not re-rendered the *other* plan PDFs; say the word and I will.

**[FYI] `/settings` takes ~455ms to open, on purpose, and I want you to know the number.** Every other
room in the app answers in 50–103ms because it is served from a cache. Settings is the one room that
is a *writer* — you add a watchlist name and read the result back in the same click — and the rule
from the app-feel build is that a page may be cached **or** written to and read back, never both. So
it renders fresh on every visit and pays real database time. This is not new (it measured 564ms in
the same state at F7) and it is not the control room's fault. I did take one free round-trip out of
it. If it ever annoys you, that is the number to point at.

**[FYI] One test failure I fixed nothing for, because I could not explain it — and I would rather tell
you than let it disappear into a green tick.** On the first tagged CI run, one `/news` test failed
because the page server-rendered an **empty `<main>`** — the nav and banner were there, the entire
room was not — and the server log carried a Next.js `Internal: NoFallbackError` at the same moment. It
failed on its retry too. On the re-run, after my fixes (none of which touch `/news`'s rendering), it
passed, and it has passed since.

So: a transient server error, not a flake in the test — the page genuinely rendered nothing for a
stretch of that run. I have not reproduced it and I do not have a mechanism. It is logged here rather
than closed, because "it went away" is not a diagnosis, and if `/news` ever comes up blank in
production this is the first thing to read.

### The veto register — every judgment call this build made, and how to reverse it

Nothing here is blocking. Each one names what I **built on the assumption**, so you can undo it.

| Call | What I assumed and built | To reverse |
| --- | --- | --- |
| **Q-N6-1** — the Saturday rows | **CLOSED at PD1 (2026-07-14). DONE — your decision, carried out.** You answered option A (delete them). PD1 ran it *after* Monday's edition was verified against production, exactly as the sequencing required: **`scan_result` 1315 rows · `market_context` 1 · `pipeline_run` 1**, all `run_date = 2026-07-11`, all gone. **`signal_log` was not touched — 4551 rows before, 4551 after**, verified by a script that aborts if the count moves; it is insert-only, trigger-guarded, and has no `run_date` column to filter on. An authorisation check ran first and confirmed the poisoned date reached *exactly* the three tables you authorised and no others. Before/after counts: `docs/pd-evidence/pd1-production.md` §4. | Nothing to reverse — this was your decision, not my assumption. |
| **News is the sixth tab** (N5) | The plan's own default. No decision line overrode it, so I shipped it. The Desk doorway ships either way. | One file (`TabBar`/`RoomNav`). Costs the reader one tap, not the room. |
| **`/settings` is two-up on a wide screen** (N2) | You would rather read three cards side by side than scroll. DOM order changed so tab order still matches reading order. | One-line revert to a single column. |
| **The page ties, and says so** (N4/N5) | On the real feed, two of the ranking's three discriminating signals barely vary, so stories tie. I **reworded the copy** rather than inventing a tiebreaker — a tiebreaker would be the app forming an editorial opinion (ruling C1). | Tell me you want a discriminator and I will name the trade-off first. |
| **Generated news cards use one restrained ground** (N5) | Not twelve sector tints. Colour is scarce and must mean something; a reader cannot learn twelve hues. | A per-sector palette is a contained change to one component. |

---

## 2026-07-13 — N6 (the control room)

**[NEED, two minutes, and it turns the whole panel on] P-2: a GitHub token with `workflow` scope.**
The control room is built, tested and live — but every button is dark, because the app has no
credential to fire a run with. The panel says so plainly, once, at the top: *"Manual runs need a
GitHub token — see QUESTIONS-FOR-BISHANT (P-2)."*

The job: make a **fine-grained personal access token** scoped to **this repository only**, with
**Actions: read and write** (nothing else — it does not need code, issues, or anything more). Then
add it to the **Vercel** project's environment variables as `GH_DISPATCH_TOKEN`. That is the entire
task. No code change, no deploy needed beyond the next one.

**I have already proven the whole path works end to end**, by running the app locally with a real
token and firing real runs at real GitHub: a `macro` run and a `compute` run both dispatched, were
found, were followed to "succeeded", decremented their caps and engaged their cooldowns. The evidence
is in `docs/nc-evidence/n6-control.md` §6. So this is genuinely a secret and nothing else.

---

**[VETO?, and I want your eyes on it] Q-N6-1 — production has been claiming its data runs "through"
a Saturday, and the fix I shipped only stops it happening AGAIN.**

The control room's first screenshot opened with the line **"Data through 2026-07-11"**. July 11 2026
is a **Saturday**. There is no session on a Saturday, no close, and no bars — Alpaca returns Friday's.
A full run had stamped Friday's data with Saturday's date, and the Desk has been telling you its data
runs through a day the market never opened.

**It was not a one-off, and that is the part that matters.** The nightly cron is `37 22 * * 1-5`, so
it never fires at a weekend — but it **does fire on every market holiday**, which is a weekday.
Roughly nine times a year this job wakes on a closed market, ingests nothing new, and publishes a run
dated to a session that did not happen. Nothing fails, so every gate stays green.

**What I did:** `job_a` now skips a non-session day, says so, and exits cleanly. (A skipped run on a
closed market is the correct outcome, not an error — failing the workflow would send you a red e-mail
every Thanksgiving, and an alert that cries wolf is not there on the night it is finally right.)

**What I did NOT do, and want you to decide:** the bad row is still in the database, and so is the
`market_context` row behind it. Tonight's nightly writes `2026-07-13` and supersedes it for every
display purpose, so nothing is visibly wrong from tonight onwards. But the Saturday row stays in the
history, and it will sit in any breadth or base-rate series that walks `market_context` by date.

I did not delete production rows on my own judgment. If you want them gone:

```sql
DELETE FROM market_context WHERE run_date = '2026-07-11';
DELETE FROM scan_result    WHERE run_date = '2026-07-11';
DELETE FROM pipeline_run   WHERE run_date = '2026-07-11';
```

(`signal_log` is deliberately NOT in that list. It has a trigger blocking DELETE, and that is the
point: signals that fired are a historical fact about what the app told you, and the ledger is the one
thing in this product that may never be rewritten. Those rows will resolve on their own schedule.)

---

**[FYI] Q-N6-2 — a Friday nightly that fails cannot be recovered until Monday.**

`full` is `not_applicable` on a weekend, because a full run stamps itself with today's date and a
Saturday is not a session — that is the bug above, and offering a button that reproduces it would be
absurd. So if Friday's nightly dies and you notice on Saturday, there is no button for it.

**The practical cost is small and I want to be precise about it.** Monday's nightly pulls FIVE YEARS
of bars every single time, so Friday's price data is backfilled automatically and nothing is lost from
the lake or from any chart. What genuinely never exists is Friday's `scan_result` and `signal_log`
rows — the signals that would have fired on Friday never fire, and the track record simply has no
entry for that day.

The honest fix is to make a run's date come from *the last session that has actually closed* rather
than from `today`. That is a change to the core nightly, with real blast radius, and I did not want to
make it in the same phase that first noticed the problem. Say the word and it is a small, well-tested
change; leave it and the cost is a missing scan day after a failed Friday, which has happened zero
times so far.

---

## 2026-07-13 — N3 (the macro board)

**[NEED, cheap and it unblocks a whole cell] The gold price needs a free API key, and until it
lands that cell says "not yet reported".** Sign up at goldapi.io (free tier, no card — they advertise
~500 requests/month and we would use about 30), then add it to this repo's GitHub secrets as
`GOLDAPI_KEY`. That is the entire job. I verified the endpoint is real and reachable — it answers an
unkeyed caller with a plain "No API Key provided" — so the moment the secret exists the cell fills in
on the next nightly run with no code change at all. **Nothing is blocked**: the board ships with gold
rendering its honest empty state, which is the truth about what we currently know.

I want to be straight about one consequence. Because I have no key, I could not record a real
successful response from that provider — so the gold parser is currently tested against GoldAPI's own
published documentation rather than against GoldAPI. The fixture is named `xau_usd_UNVERIFIED.json` so
that nobody, including me in six weeks, can mistake it for evidence. When the key arrives that becomes
a real recording and the UNVERIFIED file is deleted.

**[FYI] I found three fake test fixtures in your repo, and they had been passing for three phases.**
The R0 phase needed FRED's index-level responses and, instead of recording them, wrote them by hand in
the shape of a real response with plausible-looking numbers. The giveaway was that the fake claimed the
S&P series has 8,000 observations (it has 2,610) and put the index at 6,812 (it was 7,575). Nothing
broke — the parser works on real data too — but for three phases those tests were proving that the code
agreed with my own imagination rather than with FRED. All three are real recordings now. The rule I have
adopted: **a fixture that was not recorded must say so in its own filename.**

**[FYI] Your Desk grew on the phone, and I want you to know the number.** The macro board adds five
new figures, so the phone Desk is taller than it was. My first attempt was much worse than it needed to
be: I put the Mood gauge on the same horizontal shelf as the four stats, and because a shelf stretches
every card to the height of its tallest, the four short cards got padded out with about 200 pixels of
white space each. Every test passed. I only caught it by looking at the screenshot. The gauge sits
below the shelf now, full width, where it reads as what it is.

**[FYI] A falling mortgage rate was showing up in red.** Every delta in this app is coloured by
direction — up is green, down is red — which is exactly right for a stock and exactly wrong for the
price of housing money, where falling is the best news on the board. The household-cost deltas render in
plain ink now. Gold keeps its colour, because gold really is a market price.

**[FYI] The Mood gauge is ours, it says so, and it is not a signal.** There is no legitimate
fear-and-greed index anyone can license — CNN publishes no API and the endpoint everyone scrapes is an
internal, bot-blocked feed. So the gauge is computed here, from five inputs the pipeline already holds,
and the number never appears without the full breakdown that produced it. It carries the line "Context,
not a signal — no tendency evidence attaches to this number", because nothing in this app has ever
measured what a reading of 42 is followed by, so nothing in this app claims it.

---

## 2026-07-13 — N2 (windows, density, the grid)

**[FYI] Your production database was missing a migration, and nothing could tell you.**
N0 wrote a migration (five new tables and one column), committed it, and every CI run since has
been green. **Production never received it.** The reason is worth knowing, because it is not a
mistake anyone made twice: CI spins up a *brand new, empty* Postgres on every run and migrates it
from zero — so a green pipeline proves the migration *works*, never that it was applied to the
database your app actually reads. Vercel's build ran no migration step at all.

Nothing crashed, which is why it went unnoticed: the app catches a database error and degrades to
its honest empty state (by design — that is what lets CI build with no database at all). So the
Macro Pulse just quietly fell back, night after night, which is the exact disease this plan was
commissioned to end. **I applied the migration** (additive only — five CREATE TABLEs and some new
columns, nothing dropped) and verified it against the live database. Two guards now: your deploy
runs the migration before it builds, and `npm run check:migrations` fails before a push if the
database is behind. Nothing needed from you.

**[FYI] The Desk got 208px shorter on your phone, and nothing was removed.** 3,212px → 3,004px,
measured the same way against the same database, minutes apart. Module 00's card is gone; the strip
that replaces it says *more* than the card did (which session you are reading, when the pipeline
wrote it, when the next edition lands) in one line instead of a card. Evidence:
`docs/nc-evidence/n2-footprint.md`.

**[FYI] Your app now has one red thing in it, and only one.** A dead pipeline — two or more
sessions with no run — puts a red banner across the top of the Desk that you cannot dismiss, saying
what every number on the page actually is. That is the only red in the application, enforced by a
build rule, because the value of that banner is entirely in its scarcity. A stale-but-not-dead
pipeline gets amber. A healthy one gets one quiet grey line.

**[VETO?] `/settings` now lays its three cards out two-up on a wide screen** (add-a-name and theme
side by side, watchlist spanning below). The DOM order changed from add → curate → look to add →
look → curate so that the tab order still matches the reading order. If you preferred the old
single column, it is a one-line revert.

**[FYI] First-load JavaScript grew ~5.4KB on every room.** The freshness strip has to run in your
browser (if it ran on the server it would be graded with the *cache's* clock, and a pipeline that
died overnight would still show as "fresh" on your first load next morning — the one thing it
exists to prevent). That is the cost. Every room is still under the 200KB budget; the worst is
/paper at 194.7KB. I also *armed* that 200KB ceiling, which had never actually been enforced — only
"don't grow more than 10KB since last time" was, and that kind of budget dies by a thousand honest
increments.

---

## 2026-07-12 — the news & control build (N0–N7)

### The one decision that is actually yours

- **[NEED — proceeding on the plan's default, marked and cheap to flip] Where does the News room
  live?** This is Part 0.1 of the plan, and it is the only choice that amends a standing decision of
  yours (D2: a five-room tab bar — Desk, Scans, Paper, Track, Academy).

  **I am building option A: a sixth tab.** The bar becomes Desk · News · Scans · Paper · Track ·
  Academy. At 390px each tab is ~65px wide, above the 44px minimum, and the 10px labels stay
  legible. Reasons: you commissioned News as a *first-class* section; both reference apps you sent
  put News in the bottom bar; and the Desk's bounded "Front page" preview module ships either way.

  **The cost, honestly:** iOS convention tops out at five tabs, so this spends the comfortable
  maximum plus one. If you'd rather keep five, say so and News goes behind a Desk doorway instead —
  **it is a one-file change (`TabBar.tsx`) and nothing else in the plan moves.** The wiring lands in
  N5, so there is time.

### A production bug the audit found — you should know about this one

- **[FYI] Your evening briefing has been running without its AI extraction since P3, silently.**
  `ANTHROPIC_API_KEY` is set correctly in GitHub — you provisioned it on 2026-07-10. But neither
  nightly workflow ever *passes* it to the job, and the pipeline is written to degrade quietly when
  the key is absent: it prints "skipping the extraction batch" and carries on. So the key has been
  sitting there, correct and unused, and the brief has been assembling without the stage that reads
  the articles.

  It is a two-line fix (one `env:` line per workflow) and it lands in N1. Nothing was lost — the
  facts always published; only the LLM narration was missing. But it is worth knowing that a
  "degrade gracefully" path degraded for four days without anyone being told, which is precisely the
  disease this plan's Part 1 is about.

### What I still need you to provision (nothing is blocked)

Every one of these has a fixture-backed path, so the build runs to completion without them. Each
feature flips live the moment its secret lands, and I log the flip.

| # | What | For | Until it lands |
|---|---|---|---|
| P-1 | **A public R2 bucket for article images** (suggest `msm-media`) + a public base URL, on the Cloudflare account you already have. GH secrets `R2_MEDIA_BUCKET`, `R2_MEDIA_PUBLIC_BASE`; Vercel env `NEXT_PUBLIC_MEDIA_BASE`. Your existing R2 token works if it is account-scoped. | N4 — cached article photos | The image pipeline runs on fixtures and cards render the designed fallbacks (which are first-class by design, not failure states). The feed ships and looks right. |
| P-2 | **A fine-grained GitHub PAT**, `actions: read+write`, this repo only. Vercel env `GH_DISPATCH_TOKEN`, `GH_REPO`. | N6 — the control room's run buttons | The panel renders in its "not configured" state, which says plainly that the token is absent. Every other state is tested against a mocked GitHub API. |
| P-5 | **A GoldAPI key** (goldapi.io — free tier, no card). GH secret `GOLDAPI_KEY`. | N3 — the gold cell | The gold cell renders "not yet reported", honestly. (The seed already carries gold as a stale cell, so you will see what that looks like.) |

`ANTHROPIC_API_KEY` (P-3) is **already provisioned** — see the bug above; it just needed wiring.

### Heads-ups, no action needed

- **[RESOLVED at PD1 — this note was WRONG, and it is kept only so nobody re-derives it]**
  ~~I cannot take production screenshots.~~ **I can, and PD1 did** — see
  `docs/pd-evidence/pd1/{before,after}-*.png` (the Desk at phone width and 1512, plus `/news`).
  The note above predates the cookie-minting instruments. **The login wall does not need the app's
  password: it needs `AUTH_COOKIE_SECRET`, which IS in the root `.env`.** `check-nav.mjs`,
  `check-live.mjs` and PD1's screenshot script all mint a valid session cookie exactly as
  `lib/auth.createSessionToken` does, and walk straight in. No credentials required, nothing to
  provision. Production is fully observable from this machine.

- **[FYI] The Macro Pulse bug you screenshotted is confirmed, and it is not what it looks like.**
  Your production database holds exactly one `market_context` row, and its three index levels are
  NULL while VIX and the 10-year (also FRED) came through fine — and the run still recorded
  `fred: ok`. The R0 fix that fetches true index levels is correct and is in the tree; it landed at
  02:20 on 2026-07-12, about seven hours *after* the last pipeline run. So the code is right and the
  data simply predates it. **But the deeper bug is real and is what N1 fixes:** even after it heals,
  the next FRED index outage will be just as silent, because the run has no way to say "the index
  levels are missing tonight". Fixing the data does not fix the instrument.

---

## 2026-07-12 — the app-feel build (F0–F7)

### RESOLVED — you approved this, and it turned out I had the diagnosis half wrong

- **[DONE, was NEED] Grey text on glass.** You approved darkening `--color-muted`. Doing it properly
  meant measuring it properly, and the measurement changed the story — so here is what was actually
  true, because part of what I told you was not.

  **What I told you:** 58 nodes failing, every glass card, both themes, a broken palette.

  **What was true:** the 58 was an artifact of my own test. Every page in this app fades in, and axe
  composites a text colour through any ancestor's transparency — so it was measuring the page *while
  it was still fading in* and reporting the colours of a half-transparent screen. Those are not
  colours anybody ever reads. Wait for the fade to finish and the 58 collapse to **one** real
  finding.

  **The one real finding is exactly the one you approved, and it was a genuine bug:** `--color-muted`
  was verified at 4.83:1 against the PAPER — but muted text almost never sits on the paper, it sits
  on a translucent card, which composites to `#f0effe`. Against what you actually look at, it
  measured **4.48:1**. It missed the readability floor by two hundredths, on the only background that
  counts. It is **`#676577`** now — **4.99:1** on the glass. A shade darker, nothing else moved.

  **Midnight needed it too — and I told you it didn't.** I first reported that Midnight already
  cleared the floor and left it alone. That was measured against the standard card (5.00:1, true) by a
  survey I had run **on the desktop project only** — and the phone Desk's shelf cards are *raised*,
  where the same grey measures **4.44:1**. I measured half the app and called all of it clean. CI
  caught it. Midnight's grey is `#9c99b1` now: **5.10:1** on the lightest card it ever sits on. Both
  themes clear the floor against their worst background, which is the only version of the question
  worth asking.

  **The gate holds the full line now.** Colour contrast is back in, nothing is excluded, and the sweep
  runs in **both themes and both device sizes** (42 checks, green) — which is what would have caught
  my own mistake. Numbers and the full story: `docs/feel-evidence/accessibility.md`.

- **[FYI] One thing fell out of fixing that: the settings room is no longer cached, on purpose.** The
  contrast work made a latent bug reproducible — add a name to your watchlist, click Focus, and the
  row could *vanish*, because the page you got back was the cached copy from before your click. The
  rule that came out of it: **a page may be cached, or it may be written to and read back in the same
  click — not both.** Settings is the only room in the app that is a writer rather than a reader, so
  it renders on request now. It is the one entry in the routes allowlist, with its reason written
  down, and the guard still fails the build for any other route that tries the same flag. B1 reads
  "10 of 11 cached" instead of "all of them", and that is the honest number.

### Still yours to close

- **[PENDING YOUR VERIFICATION] The iOS device checklist — you said you would run this one.** The plan's F7 calls for a manual pass on a real
  iPhone — shelf momentum, the combobox under the keyboard, double-tap on a sort header, the rail
  sheet's home-indicator band — in both mobile Safari and the installed app. I have no device. Every
  item is covered by the automated matrix as far as Chromium/Pixel-7 can cover it, and the specific
  iOS hazards are handled in code with the reasons written down (the mask lives on the shelf's
  non-scrolling wrapper; the combobox dismisses on `pointerdown` because iOS sends no click; the
  listbox caps at five rows because the keyboard leaves ~330px; `touch-action: manipulation` on every
  double-tappable control; the rail sheet has its safe-area inset). **This gate stays open, pending
  your verification — not mine.** I am not closing it on your behalf and I have not marked it passed.


Nothing here blocks me. I have made the most reasonable call on each item, marked in the code and
in DECISIONS.md what was built on that assumption, and kept going — per your standing directive.
A veto of any one of these changes only its own sections; none of them ripple.

### The three judgment calls I would most like you to check

- **[VETO?] Horizontal swipe is not "motion" (plan Part 0.4, ruling M3).** The constitution says
  probability and money figures never move. I have read that as a rule about the UI moving things
  by itself, not about the reader moving the paper: the page already scrolls vertically past every
  money figure and nobody has ever read that as the number moving. So a *shelf* — a swipeable rail
  of figures, used once, for the macro pulse on phones — is allowed to hold money figures. It may
  never autoplay, auto-advance, or animate itself; those are all banned by grep. **If you disagree,
  say so and the pulse figures go back to their grid at every width — it is one table row in §4.1
  and nothing else in the plan moves.**

- **[VETO?] The paper ticket pre-selects NO side (Part 0.5, ruling M9).** Buy/Sell becomes a
  two-button control with neither pressed. Every other field keeps a sensible default, because
  every other field is a parameter — side is the *decision*, and the old form quietly defaulted it
  to "buy" on the one surface whose entire design (cooling-off, cost mirror) exists to slow that
  decision down. **This changes current behaviour**, so it gets a veto line. Cost if you disagree:
  one tap per trade, and restoring it is one line.

- **[VETO?] A "Practice on paper →" link on expanded setup cards (Part 0.7, ruling M10).** This is
  the biggest philosophy call of the three, so here is the honest case both ways. Against: it is the
  app's first one-tap path from an evidence surface (which has just shown you a base rate) to an
  order ticket, and it sits at the moment of maximum conviction. For: the cooling-off interstitial —
  built, tested, and protective — currently has NO producer at all. Nothing in the product
  constructs the URL that fires it; only the e2e test does. Today's organic path (setup card → tab →
  ticket) reaches the same ticket with no cooling-off whatsoever. The link carries the
  `signalViewedAt` timestamp, so it is the one path that actually *arms* the protection. It is
  strictly more protective than the walk it replaces. Four conditions bind it (M10): paper room only,
  timestamp always carried, no side default at the destination, and a plain mechanical label — never
  a button. And its boundary bites: mover rows and scan-table rows get no such link, ever, because
  they are filter hits with no base rate and no weakener list. **Veto and the link disappears; M10
  stays on the books as the rule that would govern any future attempt.**

### Heads-ups, no action needed

- **[FYI] A near-miss worth knowing about, because it explains why the gates exist.** F3 shipped the
  scans table with `dynamicParams = false` — the obvious way to say "there are exactly five scans".
  It turns out that any `revalidatePath(path, "layout")` call wipes that route's list of valid
  parameters, and every URL in the family then returns 404 **permanently, until the next deploy**.
  Two things in the app called it: the theme control (since P6) and the watchlist (since F1). So the
  first time you changed your theme, every scan table in the app would have vanished, and nothing
  would have brought them back except a redeploy. CI caught it — a visual-regression baseline came
  back as a photograph of the 404 page — and I reproduced it locally in two commands. There are now
  no layout-scoped revalidations anywhere in the app, and a drift rule fails the build if one comes
  back.

- **[FYI] Unknown tickers return HTTP 200 instead of 404.** A side effect of the speed layer: an
  ISR-cached `notFound()` serves the "this page could not be found" page with an OK status. You still
  SEE the right page — it is a wrong status code, not a wrong screen — so I have not spent a phase on
  it. `/scans/garbage` returns a real 404 because that route declares its closed set. Noted here so
  it is on the record rather than a surprise.


- **[FYI] The Lighthouse performance score on the Desk went from 93 to 87, on purpose, and I want
  you to know before you see it.** It is the ADVISORY score (the one you already ruled a synthetic
  artifact on 2026-07-11, because it models a cold load on throttled 4G). Both HARD budgets still
  pass: layout shift is 0.000 and first-load JavaScript is 157KB against a 200KB budget. I measured
  the cause rather than guessing at it (docs/feel-evidence/lighthouse-tradeoff.md): the Desk's own
  JavaScript did not grow at all (179.6 → 179.7 KB), the server answers in 12ms, and the page blocks
  the main thread for 20ms. The score drops because the app now **prefetches the five rooms in the
  tab bar while the browser is idle** — and that prefetch is exactly what took a tab tap from
  824–1342ms down to 45–55ms. The lab test measures the one cold load and counts the bandwidth spent
  on your NEXT screen against your current one. My call: six advisory points is worth every tap in
  the app feeling instant. **If you disagree, say so — turning prefetch back off is one line, and
  the cost is that navigation goes back to being slow.**


- **[FYI] Pages will be served from a cache, up to 10 minutes stale.** Every read route moves to
  ISR (revalidate 600s) — that is what takes the app from ~400–1340ms per tap to ~50ms. The honesty
  contract (ruling M5) is that every module already prints its own as-of timestamp, the data only
  changes once a night, and the nightly publish actively busts every cached page. **The one regime
  worth knowing about:** right after the ~8:40pm publish, your first tap into each room pays one
  regeneration (roughly 400–900ms, with a skeleton rather than a frozen screen). Every tap after
  that is instant. I measure that first-tap case explicitly and record it, rather than quoting you
  the flattering steady-state number alone.

- **[FYI] A new route exists: `/scans/[preset]`.** The "+123 more" on the scans page was never
  clickable, and 1,825 matches were unreachable on the night the pipeline first ran. Each preset now
  gets its own page with the full match set as a sortable, paginated table — every match reachable
  up to a stated 500-row cap (above it, the cut is named and sorting is disabled, because sorting a
  silent subset is an unlabelled ranking). Logged as a route-map amendment.

- **[FYI] The seeded test data grew a lot.** 52 scan matches across the presets (one preset seeded
  deliberately EMPTY, so the "0 matches today — that is information" state is actually tested), and
  six paper trades. This is test/dev data only — the seed still refuses to run against Supabase.
  Your Desk will show eight movers instead of three in the seeded screenshots; production is
  unaffected, since it reads the real pipeline.

---

## 2026-07-11 — UI redesign plan ("Morning Broadsheet")

The four blocking items below were **all answered on 2026-07-12**; the plan (Part 0), the
constitution docs, and the PDFs are reconciled to the answers. Nothing here is open.

- **[RESOLVED 2026-07-12] D1 — Theme.** User chose neither offered option: **one theme
  app-wide** — dark means the ENTIRE app is dark (Academy included), light means all light,
  one setting. The "Academy stays light / dark is Desk-only" rule is repealed (docs amended
  with dated notes; supersedes the RR §9.7 positive-polarity rationale). Rooms stay distinct
  via structure/type/spacing within the active theme.
- **[RESOLVED 2026-07-12] D2 — Mobile navigation.** Bottom tab bar, as recommended.
- **[RESOLVED 2026-07-12] D3 — Wordmark.** Keep "myStockMarket" + adopt the gradient mark, as
  recommended.
- **[RESOLVED 2026-07-12] D4 — Rooms.** **Unify on lavender** — one palette everywhere; the
  Academy's identity is structural (solid cards, serif kickers, reading typography), never
  chromatic.

- **[FYI]** The aesthetic constitution was amended today per your directive: CLAUDE.md, plan §3
  (via dp-*.html + regeneration), and RR §9.7 (dated amendment callout) now all agree with
  UI-REDESIGN-PLAN.md; both PDFs re-rendered. Honesty rules untouched.
- **[VETO?]** Bug-fix directions chosen inside your either/or grant: Macro Pulse gets TRUE index
  levels from FRED (SP500/NASDAQCOM/DJIA) with the small-caps slot kept as an explicitly-labeled
  IWM ETF proxy (no free Russell 2000 series); the calendar gets a 7-release FRED allowlist
  (CPI, Jobs, PPI, GDP, PCE, Retail, FOMC) + earnings. Details: plan Part 6, Appendix C.

## 2026-07-11 — P4 (setup cards, base rates, track record)

- **[VETO?] Market regime split for base rates.** The plan says base rates are conditioned by
  "regime" but doesn't crisply define the regimes. I assumed a breadth dichotomy: **risk_on** when
  ≥ 50% of the universe is above its 50-day average on the event date, **risk_off** otherwise —
  matching the breadth-regime detector's 50% line. If you want a finer split (a neutral middle
  band, or a VIX overlay), that's a structural change I'll make on your word. Built on this
  assumption: `baserates.py` (`assign_regimes`), and every base_rate_stat row carries `regime`.

- **[VETO?] Base-rate universe scope.** For P4 the nightly computes base rates over the **served +
  watchlist** symbols' history (the ~15-20 symbols the user actually sees cards for), not the full
  ~13k universe. This is fast, and honest by construction — small N is suppressed by the N-gate and
  capped to WEAK — but the samples are thin, so most patterns will show "insufficient history"
  until the universe of interest and the Parquet lake grow. Computing base rates over the full
  universe's historical replay (larger N) is a heavier nightly step I can enable if you want the
  broader market as the reference class. Logged in DECISIONS.md.

- **[FYI] Decay-note wording is my plain-English capture, not the RR Part 4 verbatim text.** The
  `pattern_meta` decay notes and evidence grades in `baserates.py` follow Appendix F's ledger
  summary (golden-cross weak / BLL 1992·STW 1999, 52w-high mixed / George–Hwang 2004, gap
  folklore, RSI weak, volume mixed / GKM 2001, breadth context-only). When the Research Report
  Part 4 text is to hand, the exact phrasing should be transcribed over my paraphrase.

- **[FYI] breadth-regime evidence grade.** Appendix F calls breadth "context-only", which isn't one
  of the four ledger grades (supported/mixed/weak/folklore). I graded it **weak** with a decay
  note saying it is market context, not a tradable edge. Tell me if you'd rather it render
  differently (e.g. a distinct "context" label).

## 2026-07-10

- **[RESOLVED 2026-07-11] LCP budget miss at phase-0.** You accepted it for P0 and asked me to
  "make it a real gate at P1." Done: the LCP ≤ 2.5s budget is now a HARD gate at the P1 exit —
  `scripts/lighthouse-check.mjs` already exits non-zero on an LCP miss, and P1 will not be tagged
  until LCP passes for real (P1 adds real content, so the measurement becomes meaningful and the
  actual LCP element can be optimised). Recorded in DECISIONS.md (2026-07-11).
  <details><summary>original [VETO?] context</summary>
  Every real budget passed at phase-0 (perf 90-95, a11y 100, CLS 0, JS 131KB, 12-17ms server);
  only LCP (2.8-3.4s, run-to-run variance) missed, as a synthetic cold-4G artifact on a
  contentless page — the app was already optimally built. You accepted this for P0.</details>

- **[CLOSED 2026-07-11] Optional cleanups — all resolved:**
  - **Supabase DB password rotation — DECLINED by Bishan (2026-07-11).** Keeping the current
    password. Closed; will not raise again.
  - **"My First Check" in healthchecks.io — DONE.** Bishan deleted it (2026-07-11). Closed.
  - **Connect the GitHub repo in Vercel — DONE.** Bishan connected it (2026-07-11); `git push`
    now auto-deploys. (I no longer deploy via the CLI.)
  - If you want me to run the healthchecks drill or Lighthouse locally in future, add
    HEALTHCHECKS_PING_URL + HEALTHCHECKS_API_KEY to the repo-root `.env` (Appendix D lists the
    API key as local too). For now I run those through GitHub Actions where the secrets live.

---

## 2026-07-12 — App feel plan ("A Broadsheet, Not a Receipt")

APP-FEEL-PLAN.md is authored and its Part 0 says "Decisions I need from you: NONE" — the
build can start at F0 without you. These are the three judgment calls closest to the line,
each decided and built-on-assumption per the standing autonomy directive; veto any of them
and only its own sections change.

- **[VETO?] User scroll is not "motion" (plan 0.4, ruling M3).** The one new horizontal
  rail (the macro-pulse figures on phones) contains money figures, and the stillness rule
  says probability/money visuals never move. My ruling: a scroll container is the reader
  moving the paper — the page already scrolls vertically past every money figure — so
  user-driven scrolling and its momentum/snap settle are sanctioned, while anything
  self-moving (autoplay, smooth-scroll, animation) stays banned and grepped. If you read
  the stillness rule more strictly, say so and the pulse rail becomes a static grid at
  every width (one table row changes).
- **[VETO?] The paper ticket no longer pre-selects "Buy" (plan 0.5, ruling M9).** Side
  becomes a two-button segmented control with NEITHER pressed; every other field keeps a
  sensible default. Reasoning: side is the decision itself, and a pre-selected buy is a
  quiet nudge on the one surface built to slow that decision down. This changes current
  behavior (the old dropdown defaulted to buy). Cost: one tap per ticket.
- **[VETO?] Setup cards gain a "Practice on paper →" doorway (plan 0.7, ruling M10).** It
  carries the signal-viewed timestamp, which finally makes your cooling-off interstitial
  fire on a real path (today literally nothing in the product produces it — only the e2e
  test does). It is also the app's first one-tap path from a signal card to an order
  ticket, so it is bound by four hard conditions (paper room only, timestamp always
  carried, no side default, mechanical unstyled label) and forbidden from surfaces without
  the full evidence anatomy (mover rows, scan rows). If a signal→ticket link feels wrong
  regardless of conditions, veto it; the interstitial then stays dormant until some other
  producer exists.

- **[FYI] Every read page becomes cached (ISR ≤10 min) with on-demand busting.** Your
  writes and the nightly publish refresh the right pages immediately; the honest edge case
  is stated in the plan (M5/§5.4): right after the ~8:40pm publish, the first tap into each
  room regenerates it — a skeleton, then content — and everything after is instant. The
  measured before/after: dynamic rooms today answer in 400–1240ms with a frozen screen;
  cached routes answer in ~50–70ms.
- **[FYI] `/scans` grows a sub-route per preset** (`/scans/unusual-volume` etc.) carrying
  the full match table — sortable, paginated, every match reachable; the dead "+N more" is
  gone. The route map amendment is logged and lands in the docs sync at F7.

## R0 — the two content fixes (2026-07-12)

- **[NEED — assumption made, not blocking] Every earnings row on the calendar renders as
  "medium" importance, never "high".** The redesign plan's rule (Appendix E-4) is: high if the
  reporting symbol is in the pipeline's *served core*, medium otherwise. I implemented exactly
  that — but the served core is today the four index ETFs and the eleven sector SPDRs, and an ETF
  does not report earnings. So the rule, as written, can never fire "high" for a real company:
  Apple's earnings render medium.
  **My assumption:** that is acceptable, and arguably right — it keeps the "high" marker reserved
  for the market-wide catalysts a beginner most needs to see coming (CPI, the jobs report, FOMC),
  which is the calmest reading of the design. The code says so plainly
  (`pipeline/catalyst_ingest.py`, `earnings_importance`).
  **If you want AAPL-style earnings marked high**, say so and I will pass the served symbol list
  (core + your watchlist, which the pipeline already reads for other purposes) into the catalyst
  ingest — a small, contained plumbing change, roughly an hour.

- **[FYI — no action needed] The seven FRED release names could not be verified against the live
  endpoint.** The plan asks the build to check each allowlisted release name once against FRED and
  log any mismatch here. There is no `FRED_KEY` in the repo-root `.env`, so I could not call the
  live API. What I did instead: the names come from FRED's own recorded release feed (the fixture
  in `pipeline/adapters/fixtures/fred/`), and matching is by **case-insensitive containment**, so a
  release FRED renames slightly ("Consumer Price Index" → "Consumer Price Index (CPI)") still
  lands. The FRED release *ids* recorded beside each entry are documentation only — nothing
  matches on them, so a stale id cannot silently drop a real CPI print.
  **When the FRED key lands**, I will run the one-time verification and report.

---

## After the redesign (2026-07-12) — three things for you

- **[FYI] The live calendar will still show noise until the next pipeline run.** The allowlist
  filters at the WRITE path, which is the right place — but the rows already in your database were
  written by the old ingest, so the Desk's calendar keeps showing "Coinbase Cryptocurrencies" until
  Job A next runs and replaces the forward calendar. Nothing to do; it cleans itself.

- **[FYI] Same for the Range Ladder on the ticker page.** The vol_band rows in your database predate
  the new `n` / `window_days` columns, and a band without its sample size does not render at all
  (deliberately — a range without its N is an assertion). So the ladder is currently invisible on
  /ticker/[symbol] and will appear after the next nightly run. You can see it now on /styleguide,
  which renders it on fixture data.

- **[NEED, low stakes] LCP is 3.09s against a 2.5s target, and it is the last thing not green.**
  Every other budget passes and passes well (performance 93, accessibility 100, CLS 0.000, first-load
  JS 128KB). LCP has been advisory since 2026-07-11 by your own call — it is a synthetic cold-4G lab
  artifact, and real TTFB is ~100ms. I cut two font weights at R6 and took it from 3.97s to 3.09s.
  **Getting under 2.5s from here means dropping a font family**, most plausibly Newsreader (the
  Academy's reading serif) — and I do not think that trade is worth it, because the Academy being a
  genuine reading room is a large part of what makes the two-room split work. Tell me if you disagree
  and I will do it.


---

## P-5 — GoldAPI key · **CLOSED 2026-07-13** ✅

You added `GOLDAPI_KEY` to the repo secrets. It took one more thing than that, and it is worth knowing
what: **the secret existed and the job still could not see it.** `nightly-a`'s env block never passed
the key through, so the gold cell would have gone on printing "not yet reported" every night — the same
shape as the `ANTHROPIC_API_KEY` bug that silently skipped every LLM stage in production for four
phases. Fixed, and now guarded by a test that derives each job's real secret requirements from the code
(`pipeline/tests/test_workflow_env.py`), so this cannot happen a third time.

The fabricated fixture is gone: the recorder ran with your key, GoldAPI answered, and the real recording
replaced `xau_usd_UNVERIFIED.json`. **Verified live in production:**

```
gold_usd   2026-07-13   value=4034.215   prior=4120.515   Jul 13   (goldapi)
```

Nothing needed from you.

---

## Q-N4-1 — [FYI · ANSWERED IN N5 by amending the copy, not the ranking] ✅

**The Front Page works, and its ranking signal is thinner than the plan assumed. You should know this
before you look at the room in N5.**

The significance formula (Appendix E) weights five things: scope 30%, corroboration 25%, magnitude 20%,
class prior 15%, recency 10%. On the real feed:

- **corroboration is 1 for 131 of 134 clusters.** The market feed has three outlets (Reuters, Bloomberg,
  CNBC) and few genuine duplicate stories, so almost nothing is corroborated by a second newsroom.
- **magnitude is 0 for ~130 of them.** Most stories name no listed company, so there is no move to
  measure.

That is **45% of the formula's weight sitting nearly constant**, and the page's order collapses onto
scope + class prior — both derived from a keyword classifier. The visible result: on the recorded night,
**ten-plus stories tied at exactly 0.600**, with the lead slot decided by a publication-time tiebreak. In
production the lead came out as *"ONGC approves project to expand strategic crude reserve"* (an Indian
oil company) ahead of *"Tech stocks skid as Gulf conflict sends oil surging"*.

**This is not broken, and I have not "fixed" it by inventing a discriminator** — a term for
"US-market relevance" would be the app forming an editorial opinion, which is the one thing ruling C1
forbids. On a day when the Gulf is on fire, a front page full of Gulf stories is the honest front page.

**My assumption, marked and vetoable:** the room ships in N5 with the ordering exactly as measured, and
the C1 header sentence is worded so it does not overclaim — it will say the page is ordered by
significance and that many stories can tie, rather than implying a fine ranking the data cannot support.

**What would genuinely strengthen it, if you want it later** (each is a real cost, none is a bug fix):
1. **A third news provider.** Corroboration is the term with the most missing information; a fourth and
   fifth outlet would make it discriminate. Finnhub + Marketaux is what the free tiers give.
2. **A paid Marketaux tier.** The free tier returns THREE articles per request (its own meta says so),
   which is why entity-tagged items are ~60 of ~220. Entity tags are the only thing that gives most
   stories a ticker, and a ticker is what gives them a magnitude.
3. **Leave it.** A tied page on a macro day is a true description of a macro day.

---

## Q-N4-2 — [FYI] the news images are built but have no bucket

The whole image pipeline is built and tested — the L1–L4 ladder, the 1200/640/240 variants, the blur
placeholder, EXIF stripping, the crop rule that refuses to decapitate a portrait photo. It writes
nothing, because **P-1 (the R2 media bucket) does not exist**. Every run records
`news-images: not_configured`, and the cards will render the designed L3/L4 fallback rungs, which are
first-class outcomes by design rather than empty states.

Two facts that make this less urgent than it sounds: **every item in the recorded feed carried a
publisher image** (160 of 160 — Appendix A.6 expected them to be "often empty"), so L1 will answer for
nearly every card the moment a bucket exists. And flipping it live is a secret plus one env var, not a
code change.

**Nothing is blocked.** N5 builds the room against the L3/L4 rungs, which it must do properly anyway.

---

## Q-N5-1 — [FYI] the sixth tab is now real, and it is the one thing here you may simply dislike

**News is a tab.** The bar is now Desk · News · Scans · Paper · Track · Academy — six rooms, ~65px
each on your phone. That is above the 44px touch floor with the 10px labels still legible, and it is
one more than the five iOS convention tops out at. The plan recommended it (Part 0.1, option A) and
no DECISIONS line said otherwise, so I built the default.

**If it feels crowded, this is a one-file change** (`components/desk/TabBar.tsx`). Removing the tab
costs you one tap, not the room: the Desk's front-page module (module 08 — top 3 stories, its own
stated cut, a doorway) ships in both options and is already there.

**One thing you will notice immediately: the Desk's icon changed.** It gave up the newspaper glyph
to the room actually titled "Front page" and took a sunrise. A bar with a room called "Front page"
sitting next to a differently-named room wearing the newspaper icon is a bar arguing with itself,
and the Desk *is* the morning ritual. Assumption made and marked; say the word and it goes back.

---

## Q-N5-2 — [FYI] the Front Page has no photographs yet, and it is not broken

Every card on the live room renders the **generated catalyst card** — the event's own name set large
in the display serif, with its tickers beneath. That is the designed L4 rung, and it is a first-class
outcome rather than an empty state. It is also, today, the *entire* room.

The reason is still **P-1: there is no media bucket.** The image pipeline is built and tested; it
records `news-images: not_configured` on every run and stores nothing.

**Every article in the recorded feed carried a publisher image (160 of 160)**, so L1 will answer for
nearly every card the moment a bucket exists — and turning it on is **a secret plus one environment
variable**, not a code change (`NEXT_PUBLIC_MEDIA_BASE` feeds both the pipeline's URL construction and
the app's image allowlist, so the two cannot disagree about where images live).

Worth looking at with your own eyes and telling me whether the claim holds: **does a text-treatment
card sitting next to a photo card read as an editorial choice, or as a failure?** The styleguide
(`/styleguide`, section 14) renders all four rungs side by side precisely so you can judge that. It is
the one design claim in this phase that no test can hold.

---

## Q-N5-3 — [FYI] the ranking still ties, and the room now says so out loud

Following Q-N4-1: I did **not** invent a tiebreaker, and the header sentence was rewritten so it does
not promise a ranking the data cannot support. It now reads:

> *"Ordered by catalyst significance: how broad the event is, how many separate outlets carried it,
> and how large a move it explains. Stories that score the same tie, and ties run oldest first."*

On a macro day, the real feed genuinely produces ten-plus stories at exactly the same score. The page
ties, and it admits it. The three things that would actually strengthen the signal (a third news
provider, a paid Marketaux tier, or a wider instrument universe) are still listed under Q-N4-1 — each
is a real cost, and none is a bug fix.

---

## Q-G1-1 — [FYI, no action needed] sharding the oracle buys wall-clock with billed minutes

G1 split the browser suite into three parallel legs (desktop / phone / wide), as the plan directed.
It is a real trade and I want it visible rather than buried in an evidence file:

| | before | after |
|---|---|---|
| **wall-clock** of a tag run (what you wait for) | 14 m 53 s | **7 m 58 s** (−46%) |
| **billed job-minutes** of a tag run (what you pay) | ~14.8 | **~18.6** (+26%) |

The extra minutes are real: three legs each pay their own `npm ci`, Playwright install, migrate+seed
and production build. That fixed setup is now paid three times instead of once.

**My assumption, and what I built on:** waiting is the thing this plan exists to kill — an exit pays
that wall-clock several times over, with a human sitting there — and CI minutes are cheap next to a
person's evening. So I took the trade. G0 had already bought back ~21% of billed minutes by deleting
the duplicated tag jobs, and G2 (docs commits stop firing CI) will give back more, so the total bill
should still land well below where it started.

**If you disagree**, the fix is one commit: revert `b137f81` and the oracle goes back to a single
serial job at ~15 m. The rehearsal — which is most of G1's value, and the thing that made `gate-1` go
green on the first try — does not depend on the sharding at all and would be unaffected.

---

## Q-G2-1 — [VETO?] I edited an e2e spec during G2, which the plan reserved for G3

**What happened.** G2's rehearsal went red on a tree where **no app code had changed at all** —
byte-identical to the one `gate-1` proved green. The failing test was the `/news` chip sweep
(`news.spec.ts:97`, "expected 13 stories reachable, received 0").

It was not a flake. `locator.all()` is the one Playwright call that does not wait for elements, and
the catalyst filter row is a client component inside a streamed Suspense boundary — so the test
enumerated a list that had not arrived, swept nothing, and reported zero. It failed on its retry too.

**The conflict.** GATE-EFFICIENCY-PLAN's non-goals reserve spec edits for G3. But *"Red CI blocks a
phase exit — no exceptions"* is an untouchable (Part 1.3), and Part 5 says that when the plan and an
untouchable disagree, **the untouchable wins**.

**What I did, and the assumption inside it:** I fixed the test — waited for the row, then asserted it
had chips to sweep — rather than running `gh run rerun --failed` until it went green. My assumption is
that you would rather have one out-of-scope, ten-line test fix than a phase tagged on top of a known
race that was re-rolled into greenness. That command is for a *suspected* flake, and this one was
understood.

**If you disagree:** the commit is `5739b11` and reverting it costs nothing but the return of the
flake. Nothing else in G2 depends on it.

**Worth knowing regardless:** it is the **only** `.all()` in the entire e2e suite, so this was an
instance, not a class — there is no sweep of similar fixes waiting.

---

## Q-G2-2 — [FYI, no action needed] the nightly heartbeat no longer triggers CI

`nightly-a.yml` pushes an **empty** `chore: heartbeat` commit to main after each full nightly run, to
stop GitHub disabling the cron after 60 idle days. Now that docs commits are filtered, I checked what
a path filter does to a commit that changes *no* paths at all — GitHub does not document it. Pushed
one deliberately and looked: **no run is created.**

**The heartbeat still does its job.** What keeps the cron alive is repository *activity*, and GitHub
counts a **push** as activity — not a workflow run. So the cron survives, and CI stops type-checking a
commit with no content. It saves ~2.5 minutes a night and changes nothing that matters.

**It does not change the tagging rule.** The heartbeat can still land mid-endgame and move `main`
under you; that hazard was never about CI. **Tag the SHA you rehearsed, by SHA** — unchanged.

---

## Q-G3-1 — [FYI, decision made] the manifest has no per-route `wide` flag

**The plan asked for one** (G3 item 1: `wide` — "gets the wide viewport"). **I left it out, and the
reason is the same honesty rule the rest of this phase is built on.**

The wide viewport (1536) is not scoped by ROUTE in this codebase. It is scoped by **spec file**:
`playwright.config.ts`'s `wide` project carries `testMatch: /(vrt|hardening)\.spec\.ts/`, so it runs
every route those two files walk and nothing else. There is no per-route decision anywhere for it to
read. Adding the field would have created **a field nobody reads** — which is a measurement that is
not being taken, wearing a measurement's clothes, and this phase exists to abolish exactly that.

Whether a given *shot* runs at 1536 (and in which theme) is a per-shot quirk, and those stay in
`vrt.spec.ts` where the plan itself said they should.

**If you want the flag anyway**, the honest version is to make `playwright.config.ts` read the
manifest and scope the `wide` project by route — that is a real change with real behavior, and it
belongs in its own phase, not smuggled into a no-behavior-change one.

---

## Q-G3-2 — [WORTH YOUR EYES] an Academy lesson is neither swept nor pixel-locked

The manifest made this visible the moment there was one list to look at. `/academy/[slug]` — a
lesson page — is probed by the nav budget and **nothing else**:

- no touch-target sweep (the glossary popovers live in a lesson, and they are tap targets)
- no sideways-scroll sweep
- no axe scan
- no VRT baseline

The Academy *frame* is swept at `/academy`, and lessons are prose inside it, so this is not as bad as
it sounds. But "a lesson is just prose in a frame we already check" is an **assumption**, and the one
thing this phase has established is that assumptions of that shape are how `/news` went unmeasured for
two tagged phases.

**My assumption, and what I built on it:** I left it exactly as it was. G3's whole proof is *zero
behavior change* — the rehearsal has to sweep the same routes and compare the same 76 baselines — so
adding a lesson to the sweeps was the one thing I could not do in this phase without destroying its
own evidence. The manifest records the gap in the route's `note`, in as many words.

**Closing it is now a one-line change** (`"sweeps": ["touch", "scroll", "axe"]` on that entry) plus
whatever the sweeps then find. Worth doing in G4 or early PD. Tell me if you want it and I will book
the cost.

---

## Q-G3-3 — [FYI, deviation recorded] the "3am and 3pm" line went to `new-surface`, not `new-lesson`

The plan (G3 item 4) said to add *"does this assertion hold at 3am and 3pm, Saturday included?"* to
**the `new-lesson` skill's checklist**.

`new-lesson` is the skill for authoring **Academy lesson MDX** under `content/academy/`. It has
nothing to do with test assertions — the plan pointed at the wrong skill. The tree wins on the detail.

It went into `.claude/skills/new-surface/SKILL.md` instead, directly beneath its sibling (the
routes-manifest line), because that is the checklist somebody actually runs when they build a surface
and write its tests. Same intent, a place it will actually be read.

---

## Q-G3-4 — [FYI, a guard got STRICTER] `/scans/unusual-volume` is no longer allowed to 404

`check-nav.mjs` carried `PENDING = { "/scans/unusual-volume": "F3 builds the per-preset match table" }`
— a marker meaning *"this route does not exist yet; probe it, but do not fail the gate when it 404s."*

**F3 built it. Phases ago. The marker never came off.** So the route has been carrying a standing
licence to answer 404 without failing B2 ever since. It answers 200, so nothing was actually wrong —
but the licence was live, and a 404 is the fastest response a server can give.

The marker is gone and the route is gated like every other room. The PENDING *mechanism* stays, driven
by the manifest's `navBudget: "pending"`, for the next route that gets probed before it is built.

**This is a guard getting stricter, not weaker**, so it needs no permission under Part 1.3 — but it is
a behavior change in a phase whose banner is "zero behavior change", so it is named here rather than
buried. It cannot affect the sweeps or the pixels; `check:nav` is a local instrument and B2 is in
report mode.

---

## Q-G4-1 — [VETO?] the movers delta chip: I made it hold still, and that costs it its hover

**The decision, and it is an assumption.** PD5 introduces `TickerChip` — one consistent chip for
every ticker symbol that navigates. It has an optional trailing move (`+2.1% · 1D`). That trailing
move is a **market figure**, and TickerChip is the first component in this whole build where a
*hoverable, interactive* element and a *probability/money figure* are literally the same piece of
UI. The collision has been deferred twice. PD5 forces it, and PD5 has not started, so I decided it
now rather than let it detonate at PD5's exit.

**What I ruled, and PD5 is written on it:**
1. The delta chip carries `data-p2`. It is a market figure — exactly what P2 exists to hold still.
2. Any hover TickerChip keeps must be **non-animating on the figure**: opacity and underline only.
   No transform, no scale, no translate, no color transition on the number itself. The accent wash
   on hover stays — that is chrome, and it correctly signals "this is a door."

**Why I chose it this way.** The alternative is to drop `data-p2` so the chip can animate freely.
That trades a permanent honesty guarantee for a hover effect. P2 is not a style rule: a number that
reacts to the cursor is a number that *looks like it is doing something*, and the entire thesis of
this app is that it isn't. So where the two cannot be reconciled, the figure wins and the
interactivity goes. Here they reconcile fine — a wash is not a transform.

**What a veto changes.** If you want the delta chip to be a fully live, animating hover target, say
so and PD5 drops `data-p2` from it — but understand that this is the first crack in P2, and the
next surface will cite it. I would not do it. **Nothing is built on this yet** — PD has not started;
only the plan text carries the ruling. Changing it now costs one paragraph. Changing it at PD5's
exit costs a phase.

---

## Q-G4-2 — [FYI, decision made, easily reversed] I pre-decided one new rung on the font drop-order

**What I found.** `check-font-budget.mjs` carries an emergency drop-order — "fixed in advance so the
decision is not made at 2am under pressure." It named **Inter 500 first, then Playfair 600**. Both of
those were **already dropped, at R6.** That is *why* there is font headroom today. So the ladder was
empty, and the way you would have discovered that is by reaching for it at 2am.

**What I did.** Marked both rungs SPENT (with their `lib/fonts.ts` line numbers), and pre-decided one
new rung so the ladder is not a blank page: **JetBrains Mono 600.** Reasoning: 500 carries the chips
and the inline `KeyFigure`s that PD5's kit is about to lean on heavily, and 400 is the body numeral —
which leaves 600 as the one mono weight whose work another weight can absorb. I also added
**Newsreader italic** to the NEVER list (the setup-card pattern names and folklore labels are set in
it, and its `opsz` axis already cost 153KB and is gone).

**Why this is low-stakes.** There is substantial headroom and no new weights planned, so the ladder
is not currently needed by anyone. This is a comment, not a behavior change — no font was touched.
If you disagree with the rung, it is a one-line edit. I deliberately did **not** write the current
total into the comment: that is the number that rots, and `npm run check:fonts` prints it live.

---

## Q-PD3-1 — [WORTH YOUR EYES] the pixel oracle was defending a bug, live, for months

**No decision needed. This is the most important thing I found this phase, and you should know it.**

On `/ticker`, on a phone, the **Range Ladder** — the panel that tells a reader what a range actually
*means*, which is one of the most important honesty surfaces this product has — has been rendering its
sentences **one word per line**:

> In / the / past, / 8 / in / 10 / 5- / day / paths / from / here / stayed / inside / this / range.

That is what you would have seen on your phone. And the visual-regression suite had **photographed it,
filed it as the correct baseline, and passed it on every single CI run for months.**

**Why nothing ever failed.** A pixel baseline is a comparison against the *previous* picture. It catches
CHANGE. It cannot catch a page that was **already wrong when the first picture was taken** — in that
case the baseline *is* the bug, and the oracle's job quietly becomes *defending* it.

PD2 gave us "a baseline that is TOLERATED is still a baseline that is WRONG." **This is the harder
version: a baseline that is EXACT can still be wrong.** The tolerance was innocent here. The picture was
the lie.

**How it actually surfaced, because it was luck and I want to be honest about that.** Not from a test.
PD3 extracted a shared container, which moved the styleguide's gutter by **four pixels**. That made the
styleguide's copy of the same component fall into a *different* wrong state, which changed its
**height** — the new picture came back **272px taller**. And **a page that gets wider is not supposed to
get taller.** I only had that number at all because PD2's law says to diff *every* candidate rather than
read the failure list. I pulled the thread because the arithmetic was absurd, not because anything was
red.

**What I have changed as a result:** any brand-new surface's FIRST baseline now gets eyes before it is
committed — it is the only moment anyone will ever look at it with fresh judgement. After that, it is
just "unchanged", forever.

*(The cause was `flex-1`, which is a flex-basis of ZERO — a zero-basis flex item can never make its line
wrap, it can only be crushed. Fixed, and swept across 14 widths from 320 to 1536.)*

---

## Q-PD3-2 — [WORTH YOUR EYES] the Desk's phone tab order now differs from its visual order, and it cannot be otherwise

**I made the call and built it. It is reversible, but the reversal has a price, and you should know what
the trade actually is.**

To kill the dead gap, the Desk's main column and rail must flow **independently**. That requires
wrapping each column in its own element. **CSS can only group children that are next to each other in
the markup** — and your ritual interleaves the two columns (brief, calendar, movers, watchlist…).

So a ritual-ordered DOM and column-grouped wrappers are **mutually exclusive. There is no CSS that gives
you both.** Something has to give.

**What I chose:** the DOM reads main-then-rail (the narrative, then the reference matter) at every width
— which is the reading order your own plan already blessed for desktop in amendment 0.2.2, and it is now
what a screen reader hears everywhere rather than two different orders. **On a phone, the ritual you see
is restored with CSS**, so what you *look at* is exactly what it always was.

**The price:** below 1024px, someone navigating with a **keyboard** tabs in the DOM order (main, then
rail) while *seeing* the ritual order. That is a real accessibility divergence, **no tool can detect
it** (axe included — it is a comparison between two orders, not a property of either), so I have pinned
both orders in tests so it can never drift by accident.

**If you want the DOM to follow the ritual instead, the dead gap comes back.** I tried the alternative
that seems to give you both (a rail that spans the main column's rows) and it is strictly worse — when
the rail is taller than the main column, the grid stretches the rows to fit it and the gap returns,
merely *spread out* between the modules instead of pooled under one.

**No action needed unless you disagree.**

---

## Q-PD8-1 — the Desk's evening brief could now emphasize its verified figures (E5), and I deferred it

**Status: deferred, capability available. No action needed unless you want it sooner.**

PD7 made the gate publish its CLEARED list, and Q-PD5-1's headline was "this unblocks ruling E5 on the
Desk". PD8 honoured E5 on the surface it BUILT — the news story page's "Context tonight" prose sets its
verified figures in mono (via `verification.sections.context.cleared`). But the Desk's evening BRIEF
still carries **no emphasized figures**: its lede reads as plain prose.

I did not wire the brief's KeyFigure this phase, on purpose:

1. **It is outside PD8's scope.** PD8 is Part 9.6/9.7 (story + feed) and Part 10 (ticker). The Desk
   brief is a different surface (`components/desk/BriefArticle.tsx`), not in those sections.
2. **It would churn the Desk VRT** — the flagship room — for a feature that belongs to a different
   part of the plan.
3. **The briefing's own record may need the same wiring the news notes got.** The seeded briefing's
   `verificationJson` is `{status, checked, held_reason, flags}` — I did not confirm it carries a
   `cleared` list the way a news cluster's `verification.sections` does. If it does not, the brief
   cannot honestly emphasize anything yet, and forcing it would be the deny-list trap E5 forbids.

**My assumption:** the brief's KeyFigure is a small, clean follow-on for a later phase (or a quick
Desk-scoped task whenever you want it), not a PD8 deliverable. The story page proves the capability
works end to end; the brief is the same pattern applied to one more surface. Marked in DECISIONS and
here. If you'd rather it landed now, say so and it is an afternoon's work.
