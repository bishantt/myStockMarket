# base-rate-display

**Status:** pre-seeded from the plan (§4.3, §6.2, Appendices F and J) before any code existed.
Refine on first real use (P4 SetupCard work), then treat as minted.

**When to use:** ANY surface that shows a historical base rate, win rate, or tendency tier —
setup cards, scan rows, calendar branches, lesson worked examples, the track record.

## The contract (violating any line is a guardrail violation, plan §1.5)
1. **One renderer.** Only `components/BaseRate.tsx` may format a base rate. No other component,
   page, or utility renders one — grep before adding any percentage display.
2. **N-gates** (Research Report Part 8, plan §1.5). When N is 100 or more, show the percentage
   plus the Wilson 95% CI. When N is 30–99, show the natural frequency (“roughly X in 10”)
   **plus the wide-interval note** — no percentage and no CI numerals. When N is under 30, show
   the suppression string and no percentage anywhere (copy key `baseRate.insufficient`).
3. **Canonical sentence** from the copy deck (Appendix J `baseRate.sentence`) — verbatim, filled,
   never paraphrased. Always accompanied by the baseline line (`baseRate.baseline`).
4. **Tier bands** (Appendix F). A win rate under 50% is weak; 50–58% is weak; 58–70% is
   moderate; above 70% is strong. The cap rule overrides all of these: if the CI spans the
   always-up baseline, the tier is capped at weak no matter what the point estimate says.
5. **Decay stamp** whenever `pattern_meta` carries a publication year; folklore grade renders the
   word “FOLKLORE” with its grade dot (Tag component, §3.6).
6. **The app never computes.** n, wins, ciLow, ciHigh, baseline all arrive from Postgres
   (pipeline-computed). The renderer formats; it never derives.

## Tests to write FIRST (all are §6.2-mandatory)
- Wilson CI textbook cases render correctly: 62/110 → [47%, 65%]; 60/100 → [50.2%, 69.1%].
- All three N regimes (≥100, 30–99, <30) produce exactly the contracted strings — including the
  wide-interval note in the 30–99 regime and its absence elsewhere.
- Tier cap: CI 47–65 vs baseline 55 ⇒ WEAK (the RR Fig 9.3 case as a literal fixture).
- Copy-deck strings byte-identical to `lib/copy.ts`.

## Verification
Vitest suite green; visual baseline of a card in `/styleguide`; §3.10 anti-drift checklist passes
(no colored chips, numerals in Plex Mono, provenance line present).
