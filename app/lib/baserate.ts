import { copy, fill } from "@/lib/copy";
import { percent } from "@/lib/format";
import { nRegime, tierFor, type NRegime, type Tier } from "@/lib/constants";
import type { EvidenceGrade } from "@/components/Tag";

/**
 * lib/baserate.ts — the pure view-model behind the one base-rate renderer (plan §4.3, §6.2).
 *
 * The app never COMPUTES a base rate — n, wins, the interval, and the baseline all arrive from the
 * pipeline. This module only decides how to LABEL what arrived, applying the N-gate precision rules
 * and the tier cap in one place so every surface (setup card, scan row, calendar branch, worked
 * example) speaks identically. `components/BaseRate.tsx` is the only renderer; this is its brain.
 *
 * The N-gate (Appendix F / RR Part 8):
 *   - N ≥ 100  → the canonical sentence with the percentage, plus the Wilson 95% CI text.
 *   - N 30–99  → the canonical sentence with the natural-frequency form ("about 6 in 10"), plus the
 *                wide-interval note, and NO percentage or CI numerals.
 *   - N < 30   → the suppression string only; no percentage anywhere.
 */

/** The stored base-rate figures, exactly as the pipeline computed them (the app renders, never derives). */
export type BaseRateData = {
  n: number;
  wins: number;
  winRate: number;
  ciLow: number;
  ciHigh: number;
  baseline: number | null;
  horizonDays: number;
  /** The reference class, e.g. "US large/mid". */
  refClass: string;
  /** Years of history the sample spans (for the sentence); defaults to a plain "several". */
  years?: number;
  publicationYear?: number | null;
  evidenceGrade?: EvidenceGrade | null;
  decayNote?: string | null;
};

export type DecayStamp = { year: number | null; grade: EvidenceGrade | null; note: string | null };

export type BaseRateView = {
  regime: NRegime;
  /** The canonical sentence, filled — or the suppression string when N < 30. */
  sentence: string;
  suppressed: boolean;
  /** The baseline line (shown for a resolvable rate; omitted when suppressed). */
  baselineLine: string | null;
  /** The Wilson 95% CI text (full regime only). */
  ciText: string | null;
  /** The wide-interval note (frequency regime only). */
  wideIntervalNote: string | null;
  tier: Tier | null;
  decay: DecayStamp | null;
};

/** Build the view-model for a stored base rate, applying the N-gate and the tier cap. */
export function buildBaseRate(data: BaseRateData): BaseRateView {
  const regime = nRegime(data.n);
  const decay = decayStamp(data);

  if (regime === "suppressed") {
    return {
      regime,
      sentence: fill(copy.baseRate.insufficient, { n: data.n }),
      suppressed: true,
      baselineLine: null,
      ciText: null,
      wideIntervalNote: null,
      tier: null,
      decay,
    };
  }

  const pctSlot = regime === "full" ? percent(data.winRate) : `about ${frequencyInTen(data.winRate)} in 10`;
  const sentence = fill(copy.baseRate.sentence, {
    years: data.years ?? "several",
    n: data.n,
    refClass: data.refClass,
    h: data.horizonDays,
    wins: data.wins,
    pct: pctSlot,
  });

  const baselineLine =
    data.baseline === null
      ? null
      : fill(copy.baseRate.baseline, { h: data.horizonDays, pct: percent(data.baseline) });

  const ciText = regime === "full" ? `95% interval ${percent(data.ciLow)}–${percent(data.ciHigh)}` : null;
  const wideIntervalNote = regime === "frequency" ? copy.baseRate.wideInterval : null;
  const tier = tierFor(data.winRate, data.ciLow, data.ciHigh, data.baseline ?? undefined);

  return { regime, sentence, suppressed: false, baselineLine, ciText, wideIntervalNote, tier, decay };
}

/** The natural-frequency numerator out of 10 — a rendering, not a claim (like lib/format). */
function frequencyInTen(winRate: number): number {
  return Math.round(winRate * 10);
}

function decayStamp(data: BaseRateData): DecayStamp | null {
  if (data.publicationYear == null && !data.evidenceGrade && !data.decayNote) return null;
  return {
    year: data.publicationYear ?? null,
    grade: (data.evidenceGrade as EvidenceGrade) ?? null,
    note: data.decayNote ?? null,
  };
}
