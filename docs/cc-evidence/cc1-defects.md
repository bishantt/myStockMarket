# CC1 — the two live defects (and three paper cuts)

**Tag `cc-1` · CLARITY-AND-CADENCE-PLAN.md Part 5 CC1 · executed 2026-07-15.**
First phase of the two-plan commission. Execution order: **CC1 → LC1 → LC2 → LC3 → CC2 … CC10.**

CC1 repairs the two defects a reader actually hit — the font that renders wrong on some refreshes,
and the Daily Brief that publishes empty every night — plus three paper cuts (the held-state
skeleton, the calendar's doubled CPI, the ticker record's raw scan slug). It touches no schema and
adds no room, drift rule, e2e spec file, bundle baseline, or oracle leg.

---

## What shipped

### (a) Fonts — the session-losing gamble (D1 / R2)

`app/lib/fonts.ts`: Inter, JetBrains Mono and Newsreader move `display: "optional"` → `"swap"`
(Playfair was already `swap`). `optional` grants a face ~100 ms and then keeps whatever fallback won
that race **for the whole session** — so a cold cache or a post-deploy hash change ships the app in a
sans fallback until the next refresh. That is exactly Bishan's "renders wrong on some refreshes"
symptom, and the face it hits hardest is the mono that carries every number and every masthead.
`swap` paints the fallback and swaps the real face in the instant it arrives; next/font's
metric-adjusted fallback @font-face is generated from the font's metrics independent of `display`, so
the swap frame is near-invisible and — proven below — the pixels do not move.

- **Guard:** `app/lib/fonts.test.ts` reads the source and asserts four `display: "swap"` declarations
  and zero `display: "optional"` (the source-pinning discipline `design-system.test.ts` uses — a
  contract a grep cannot see). The gate re-runs `check:lighthouse` (CLS must not regress).

### (b) The brief — held every night, by a label bug and a unit bug (D2)

`pipeline/briefing/stats.py` only — the gate (`verify.py`) is untouched, because its strictness IS
the product working. Two collaborating bugs, both fixed at the source:

1. **The window was in the label, and the gate ignores the label.** The narrator must write
   "50-day average", "10-year yield", "1-day gain" — and "50", "10", "1" are numbers the gate checks.
   With the window living only in the Stat *label*, every honest sentence was flagged for the very
   window it described. PD7 stated this exact rule for the depth stats and never reached the
   macro/mover stats 100 lines up. Now each value STATES ITS WINDOW in the narrator's own words:
   `"…% of the universe above its 50-day average"`, `"…% 10-year yield"`, `"…% 1-day {direction}"`.
2. **The ×100 unit bug the hold was masking.** `pct_above_50dma` is a 0–1 fraction (nightly.py,
   baserates.py) rendered with a bare `%` — so the brief narrated "0.60%" where the Desk says 60%.
   The fixture fed `60.75` (a percent), modelling the wrong unit, which is why the suite was green
   while production was held. The value now multiplies by 100; the fixture feeds a fraction.

- **Guards:** `test_briefing_stats.py` pins the new value shapes over a fraction input; a new
  red→green test in `test_briefing_verify.py`
  (`test_the_honest_evening_brief_no_longer_holds_over_its_own_windows`) drives the REAL
  `build_stats()` with production-shaped sources, narrates the production sentence shapes, and clears
  with `status == "ok"`, zero flags. Verified it bites: reintroducing the bare-% breadth line turns
  it red (`+ 0.61%`), restoring it turns it green.
- **The second narrator's prompt (the 47a713f rule).** `synthesize.py`'s `_SYSTEM` gains the line
  the Front Page's narrator already carries: write the VALUE, put the id in `citations`, never inside
  the prose. 47a713f caught the Front Page publishing a sha1 hash in a sentence; the briefing had the
  same `citations`-array shape and nothing had ever said the id does not ALSO go in the prose.

### (b′) The brief actually published — the synthesis-budget bug the gate uncovered

The D2 fix makes the honest brief CLEAR the gate. But the first real dispatch showed it still would
not publish — held for "synthesis failed validation", `checked:0`, a DIFFERENT failure than the
verify hold. The reason was swallowed by a bare `except` in `_parse_draft`, so CC1 made it speak:
`_parse_draft` returns the reason and `synthesize` prints it with the message shape. One dispatch
later the log named the whole bug:

    synthesize: attempt 1 — no JSON in a 0-char response (stop_reason=max_tokens, blocks=['thinking'])

**claude-sonnet-5 runs adaptive thinking by default, and that reasoning is spent against
`max_tokens`.** At 4096 the thinking alone consumed the whole budget; the call stopped with only a
`thinking` block and NO text — a 0-char "response" that held the briefing, intermittently, roughly
every other night. **PD7 had already met and solved this exact wall in `newsdesk/narrate.py`** (the
front page lost every note the same way) — it never reached the briefing synthesis. The fix brings
synthesize.py onto narrate.py's proven pattern, so the two Sonnet-5 narrators do not drift:
`_MAX_TOKENS = 16000` (room for reasoning above the small bounded JSON, and under the ~21333 line at
which a non-streaming call is refused for possibly running past 10 minutes) plus `effort: "medium"`
inside `output_config`, which BOUNDS the thinking so it cannot expand to fill the budget. A false
start proved the ceiling is real: `max_tokens=32000` crashed Job B with the SDK's "Streaming is
required" (sonnet-5 is not in the SDK's per-model non-streaming table, so only the 10-minute time
guard applies). A unit test now pins `effort` and the `max_tokens` band from both sides.

- **The published proof (the gate's real check — the prose, not the green suite):** after the fix a
  real nightly-b dispatch published the 2026-07-14 brief, `status: ok`, today_focus:
  *"…4905 issues higher against 3630 lower, while **60.49% of the universe sits above its 50-day
  average**. The VIX held at 17.16 and the 10-year Treasury yield stood at 4.62%…"* — "60.49%", never
  "0.60%", and the gate CLEARED both "60.49%" and the window number "50". That is D2 fixed, end to end.
- **The residual is the gate working (plan §2).** Synthesis is now reliable (no more 0-char holds),
  but a given night's draft may still hold when the model over-narrates — one later dispatch held on
  7 flags, all money/date figures in items 2 and 4 (never today_focus), with "60.3%" cleared in the
  same draft. That is a legitimate hold, exactly the base rate the plan anticipated, not the
  structural window-word hold CC1 retired.

### (c) Held-state UI — a skeleton that promised nothing (no-shimmer-on-empty)

`BriefArticle`'s held view drops the four empty slot headers over hairline rules for the one calm
"briefing unavailable" line. A skeleton is a promise that content is arriving; on a held night the
run happened and the content is deliberately not coming, so the skeleton promised something false —
the same law that governs `EmptyModule`. The old pedagogical argument ("the shape teaches") is
retired in the component's own docstring. `BriefArticle.test.tsx` now asserts the slot labels are
ABSENT when held.

### (d) Calendar dedupe (D7)

`catalyst_ingest.gather_catalysts` de-dupes the assembled calendar on `(code, date, symbol)` — the
row's reader identity. FRED posts one release under several ids, and `select_releases` de-dupes only
on `(release_id, date)`, so two ids for CPI both survived and the Desk showed CPI twice on Jul 14. A
faithful two-id fixture (`DuplicateCpiFred`) proves exactly one CPI now reaches the Desk.

### (e) The slug leak (D6)

`app/lib/patterns.ts`: `patternLabel` now resolves a scan-preset key to its title before echoing a
raw key. `signal_log.pattern_key` holds a SCAN PRESET key (`gap-3plus`, written from `scans.py`'s
`preset_key`), while setup cards carry DETECTOR keys (`gap-with-catalyst`); both flow through
`patternLabel`, which knew only the detectors. A name with a fresh scan-fired signal therefore showed
"gap-3plus" on the ticker record where "Gap of 3% or more" belonged. The fix consults both registries
(patterns, then scan presets) and repairs the ticker record AND the track-record page at once; setup
cards are untouched. `app/lib/patterns.test.ts` pins the exact production case and every preset key.

**On the ticker-sheet VRT delta Appendix C predicted:** it does NOT materialize, and that is honest.
The seeded world never reproduced this leak — all three seeded `signal_log` rows are RESOLVED (they
carry `signal_resolution` rows, so they render no active-signal label) and they use DETECTOR keys,
which mapped correctly all along. The production leak is on ACTIVE (unresolved) scan-fired signals,
which the seed does not model. Reproducing it in the seed means adding an active preset-keyed signal
— which surfaces on the forecasts / track-record surfaces and re-shoots several baselines, a swing
too wide for a scoped paper-cut phase. The fix is proven by a unit test that observes the exact
defect at the function that decides it. **Handed to CC4** (which already touches Track record /
forecasts and budgets a wide re-shoot) to add the faithful active signal and give this a rendered
proof. See QUESTIONS-FOR-BISHANT.md, Q-CC1-1.

### FIRST STEP — the tag family

`cc-*` wired into `.github/workflows/ci.yml` at BOTH sites (the `on.push.tags` trigger and the e2e
job's `if:`). `pipeline/tests/test_ci_tag_families.py` proves the two agree, so a family in one but
not the other — a tag that starts a green run the oracle never answered — is a red build.

---

## The gate (local, all green on `11dacfb`)

- **typecheck** clean · **lint** clean · **app unit: 753 passed** (746 + fonts 2 + patternLabel 5;
  BriefArticle held-state case rewritten in place).
- **pipeline: 579 passed, 35 skipped (614)** (+3: the verify red→green, the calendar dedupe, the
  synthesis-budget band guard).
- **build** clean · **check:routes** 14/15 cached (settings allowlisted) · **check:bundles** every
  route within baseline + slack, worst `/paper` 198.2 KB < 200 KB ceiling · **check:fonts** 243 KB /
  560 KB, 317 KB headroom.
  - *Bundle note:* the record-block routes grew ~2–4 KB because `patternLabel` now pulls
    `scan-presets.ts` into the shared chunk. This is the honest cost of ONE definition of the preset
    labels (the codebase's rule against duplicated labels); it is within slack, no baseline moved.
- **check:drift** all 28 pass · **check:migrations** clean (CC1 shipped no migration).
- **e2e (focused, local, phone):** `briefing.spec` + `desk.spec` — 26 passed, 1 skipped. The full
  four-leg oracle is the CI rehearsal below.

## The rehearsal, the deploy, and the production proof

The synthesis-budget bug (b′) forced several code iterations after the first push, each on its own
SHA; the tag lands on the final one, `c545612`, and the numbers below are that SHA's.

- **Rehearsal (the same job the tag runs):** `gh workflow run ci.yml -f job=e2e --ref main` on
  `c545612` → run **29396039314**, all four oracle legs green. (The first rehearsal, run
  **29393777234** on the code SHA, red ONLY on `desk-thin-night-mbp16` — the expected held-brief
  delta — and minted its candidate; every leg green once the baseline landed.)
- **VRT:** exactly one pixel delta, `desk-thin-night-mbp16` — the thin-night held brief, now the calm
  line without the retired skeleton (page 2654 → 2451 px, the skeleton's height). Verified by eye
  against the triptych AND by pixel-count: the other six mbp16 shots came back 0 differing pixels, so
  it is the only change, and the `desk-light-mbp16` 0-px result confirms `display: swap` moved nothing.
- **check:live:** all 7 pass (masthead session 2026-07-14, macro board present, index honesty,
  calendar hygiene clean, press-time, byline links, next-edition promise). **check:migrations** clean
  (no migration). **Lighthouse:** CLS **0.000** — the R2 hard gate holds, `swap` did not regress
  layout — accessibility 100, first-load 183 KB ≤ 200; performance 86 / LCP 3.71s are the documented
  synthetic-4G advisories. **check:nav** report mode (worst 461ms, as at pd-final).
- **The published brief (the PD7 lesson — the prose is the check, not the green suite):** proven in
  (b′) — a real nightly-b dispatch published the 2026-07-14 brief reading "60.49% of the universe
  sits above its 50-day average", gate `status: ok`, "60.49%" and "50" both cleared.

## The tag

- **`cc-1` on `c545612`, by SHA.** Tag run **29396552183** — green, all four oracle legs (8m 01s).

## Gate size at `cc-1`

**28 drift rules · 97 VRT baselines (1 updated: desk-thin-night) · 26 e2e specs · 753 app unit
tests · 614 pipeline tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run
8m 01s (run 29396552183).**

Growth is booked and reasoned: +7 app unit tests (fonts source-pin ×2, patternLabel ×5), +3 pipeline
tests (the honest-brief red→green, the doubled-CPI dedupe, the synthesis-budget band guard). No new
drift rule, room, spec file, bundle baseline, or oracle leg. One VRT baseline updated (the held brief
lost its skeleton), not added.
