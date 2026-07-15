# CC5 — News, text-first (evidence)

Phase CC5 of CLARITY-AND-CADENCE-PLAN.md. Tag `cc-5` on `5382f06`. Builds 4.4 + R4.

## What CC5 did, in one paragraph

The news is TEXT-FIRST now. `NewsImage` renders a real stored photo (L1/L2) or nothing — the generated
L3/L4 catalyst/publisher cards are DELETED. D5's finding: with the media bucket (P-1) unprovisioned,
every card every night was an L4 grey slab carrying the catalyst word, taller than its own headline, an
eye-magnet that says nothing the catalyst Tag does not. So a card with no photo is its words:
catalyst + sector Tag · headline (a LEAD up to 3 lines, a ROW 2) · why-it-matters (the LEAD's alone) ·
ticker chips OR the single mono word "Market-wide" · a byline (outlet · date · time · source count, the
count only when >1). A real photo, when one exists, renders right-of-headline at 40% on a lead, a small
thumb on a row. The story sheet keeps its structure; only the placeholder block goes. No migration, no
pipeline change.

## R4 — the ruling and its guard

**R4: NO RESERVED GEOMETRY WITHOUT A PICTURE.** A news surface renders an image frame only when a real
stored image exists (L1/L2). The generated frames are retired everywhere; the catalyst already speaks
through its Tag. This amends NEWS-AND-CONTROL §7.7/7.9's "every card ships a visual" and C9's card-level
"No direct listing" — both amended in place with dated correction blocks (the CLARITY plan misattributed
these to UI-REDESIGN §7.7/7.9; the rule lives in NEWS-AND-CONTROL, corrected).

Guard (e2e/news.spec.ts): (1) `data-testid="news-image-generated"` appears NOWHERE — asserted on the
feed and on a no-image story. (2) On a filtered text-first lead: no `<img>`, and the headline `<h3>` is
taller than the card's content chrome (the tag row, the chips). The byline footer (a 44px touch target)
and why-it-matters (multi-line prose) are excluded from the height comparison — R4 is about reserved
DECORATIVE geometry, and that is what the comparison measures (see LESSONS: the guard first failed on a
correct 1-line lead losing to the 44px byline).

## The two judgment calls (both in DECISIONS)

1. **Story-sheet image position — Option B (remove the placeholder, keep the photo).** 4.4 says the
   sheet image goes "below the byline, never between headline and body," but ALSO "only removes the
   placeholder block" and "keep the excellent structure." These conflict; a real photo between headline
   and body is standard news layout, and D5's complaint was the PLACEHOLDER hole. So the figure renders
   only when a real image exists (placeholder gone) and a real photo stays put. Reposition deferred to
   P-1 (Q-CC5-1).
2. **Lead photo → right-of-headline at 40% (was image-left at 55%).** The text-first thesis; 4.4 is
   explicit. Supersedes the PD8 image-left broadsheet lead.

## TDD

`lib/news.test.ts`: `bylineSourceCount(n)` — null at 0 and 1 ("1 source" is D5's noise), "n sources" at
>1 (corroboration is the news). Written RED (3 failing), implemented GREEN. The rest is UI (exempt) +
the R4 e2e guard.

## The gate at `cc-5` (all green on `5382f06`)

- **App unit 781** (was 778; +3 `bylineSourceCount`). **Pipeline 579 passed / 35 skipped** (UNCHANGED —
  CC5 touches no pipeline code).
- typecheck · lint · build · check:routes (14/15 cached) · check:bundles (worst 198.8 KB < 200; /news
  shrank — L3/L4 deleted) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (no new rule —
  R4 deletes the L3/L4 rungs but KEEPS drift rule 20's NewsImage door)** · check:migrations (no
  migration; live DB matches repo).
- e2e:local (--ignore-snapshots): news.spec desktop 26 / phone 25 + 1 skip (R4 height check is
  desktop-only); hardening sweep phone 30/30; all news/story/styleguide/sheet VRT surfaces render.
  Eyeballed the desktop + phone feed and the SMCI text-first story.

## CI (two pushes, one rehearsal each, one tag)

- **Push CI (`7e11b56` = code): `29457189445` green (app + pipeline). Rehearsal #1 (`7e11b56`):
  `29457195791` RED on pixels (expected, all four legs), minted candidates.**
- **Push CI (`5382f06` = 24 baselines): `29458095546` green. Rehearsal #2 (`5382f06`): `29458095405`
  GREEN, all four legs.**
- **Tag run (cc-5 on `5382f06`): `29458574720` — four-leg oracle, green. (7 m 51 s)**

## The VRT re-shoot — 24 baselines, every diff explained

Rehearsal #1 redded 13 shots. Per the PD5 law, EVERY candidate was diffed against its committed baseline
(pngjs counter — vrt-diff.mjs broken, Q-LC1-1): the moved set EQUALS the failure set (nothing hid under
the 600px tolerance), 24 baseline FILES across four legs. Every actual/diff opened (PD3 first-baseline
eyes on the new text-first lead composition):

| surface | legs | what moved |
|---|---|---|
| `news` (feed) | desktop/phone L+D, wide L, mbp16 L (6) | text-first: lead photo → 40% right-of-headline, L4 slabs gone from no-photo cards, byline gains source count, "Market-wide" replaces the eight-times sentence — RESIZE shorter |
| `news-filtered` / `news-week` | desktop/phone (4) | same card changes. news-filtered-phone got +27px TALLER — the FDA lead headline gained its 3rd line (clamp-2→clamp-3, the intended lead change) |
| `news-story-dropped` / `news-story-sparse` | desktop/phone (6) | SMCI / Uber have no stored photo → the placeholder figure between headline and body is gone (~444px shorter) |
| `sheet-overlay-desktop` / `sheet-story-phone` | desktop / phone L+D (4) | the SMCI sheet, both presentations — same placeholder removal, body reflows up |
| `styleguide` | desktop/phone L+D (4) | the imagery ladder shrank to L1/L2 — the L3/L4 specimens gone |

**Nothing unexpected moved:** the Desk front-page module, the image-bearing `news-story` room
(fda-nonopioid keeps its real photo, Option B), login and scans are byte-identical. 24 re-shot, 0 added.
97 total.

## Post-deploy (production)

- **check:live 6/7.** The ONE red — "strip · next-edition promise" (strip says "next edition Thu" while
  the edition is Tuesday Jul 14, whose next session is Wed) — is a DELAYED-NIGHTLY transient, NOT a CC5
  defect. Root cause read, not assumed: tonight's Wednesday nightly-a had not fired at 44 min past its
  22:37 UTC cron (last night's ran 52 min late), so production correctly served Tuesday's edition while
  the strip's WALL-CLOCK next-edition rolled to Thursday — the PD1 transitional window, stretched by a
  GitHub cron delay. CC5 touches no strip/masthead/edition/cron code; the assertion passed at cc-4; and
  the CC5-relevant assertion (news byline links: 20 outbound anchors) is GREEN, proving the new byline
  works in production. The next-edition/strip logic is CC8/CC9's domain (R6 + the edition-state machine),
  so this is a red owed to a later phase, which the Endgame permits. Logged Q-CC5-2.
- **check:nav** report mode, worst 407ms (settings writer room — no regression from cc-4's 411ms).
- **check:lighthouse** gates green: CLS 0.000 then 0.011 (< 0.05), first-load JS 183 KB (< 200), a11y
  100. Advisory perf 75 → 83 on re-sample (synthetic-4G ±10 noise, per the endgame rule); LCP 5.20 →
  4.32s. In line with cc-4's 82.

## Carried-forward / open (none blocking)

- **Q-CC5-1** — the story-sheet image "below the byline" reposition, deferred to P-1.
- **Q-CC5-2** — the check:live strip transient (the strip's next-edition follows the wall clock; owed to
  CC8/CC9).
- **Q-LC1-1** — vrt-diff.mjs broken (pixelmatch absent); the pngjs-only counter is the workaround.
- **P-1** unprovisioned — the text-first default is 4.4's design target, nothing blocked.
- **`dummy/`** — Part 4.4 authorised CC5 to retire it, but it is UNTRACKED audit evidence (51
  screenshots the two plans were built from, not only news) that the executor did not create, so per
  CLAUDE.md's deletion-safety rule it was LEFT in place, not deleted. The news-placeholder screenshots
  in it are stale now; Bishan can `rm -rf dummy/` whenever he likes (Q-CC5-3). The UI-LIBRARY-EVALUATION
  trio (untracked) is a finished deliverable, also left in place.

## Gate-size line

29 drift rules · 97 VRT baselines · 27 e2e specs · 781 unit tests · 16 bundle baselines · 14 manifest
rooms · tag run 7 m 51 s. (Unit tests 778 → 781: +3 `bylineSourceCount`. Drift 29 → 29: R4 deletes
the L3/L4 rungs but keeps drift rule 20's NewsImage door — no new rule. VRT 97 → 97: 24 re-shot, 0
added. e2e specs 27 → 27: R4's guard is new tests inside news.spec.ts, no new file.)
