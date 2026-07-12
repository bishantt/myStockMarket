import type { EvidenceGrade } from "@/components/Tag";

/**
 * lib/scan-presets.ts — the five scan presets, their criteria, and their evidence grades
 * (plan Appendix F, §9.2). The criteria strings render VERBATIM on /scans (the reader sees exactly
 * what the filter did — no black box), each carrying its RR Part 4 ledger grade, and the
 * folklore-adjacent preset carries the folklore label. Same keys and thresholds as the P4 detectors
 * — one definition, two consumers.
 */

export type ScanPreset = {
  key: string;
  label: string;
  /** The filter criteria, in plain words, exactly as the scan applied them. */
  criteria: string;
  grade: EvidenceGrade;
  /** True for the folklore-adjacent preset (renders the FOLKLORE label). */
  folklore?: boolean;
};

export const SCAN_PRESETS: ScanPreset[] = [
  {
    key: "unusual-volume",
    label: "Unusual volume",
    criteria: "20-day relative volume ≥ 2.5 AND |1-day return| ≥ 2%.",
    grade: "mixed",
  },
  {
    key: "near-52w-high",
    label: "Near the 52-week high",
    criteria: "Close within 2% of the 252-day high — large/mid only.",
    grade: "mixed",
  },
  {
    key: "gap-3plus",
    label: "Gap of 3% or more",
    criteria: "|Open gap| ≥ 3% versus the prior close.",
    grade: "folklore",
    folklore: true,
  },
  {
    key: "golden-cross-fresh",
    label: "Fresh golden cross",
    criteria: "The 50-day average crossed above the 200-day within the last 2 sessions.",
    grade: "weak",
  },
  {
    key: "rsi-extreme",
    label: "RSI extreme",
    criteria: "RSI-14 crossed 30 upward or 70 downward.",
    grade: "weak",
  },
];

/**
 * Break a preset's criteria into its numbered clauses, for the recipe-card list on /scans.
 *
 * The scan page's identity IS this product's anti-black-box stance: the recipe is public. So the
 * criteria are laid out as a numbered list a reader can check off by eye, rather than a paragraph
 * they have to parse.
 *
 * The WORDS are never changed — the criteria render verbatim, because the promise is that you see
 * exactly what the scan applied. This only breaks them at the "AND" joints and drops the trailing
 * full stop, so the union of the clauses is the original sentence.
 */
export function criteriaClauses(criteria: string): string[] {
  return criteria
    .replace(/\.$/, "")
    .split(/\s+AND\s+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}
