/**
 * lib/setup-card-view.ts — one stored `setup_card` row into one `SetupCardView` (PD8).
 *
 * This mapping used to live INSIDE `lib/morning.ts`'s `loadSetupCards`, reachable only by the Desk.
 * PD8 needs the SAME mapping per symbol, on the story page's "the record" block and the ticker
 * page's "the record here" block — and the codebase's own hardest-won lesson is that a duplicated
 * renderer is a bug's habitat (PD5: four delta chips, and the fix had landed in one). So the
 * mapping is extracted here, and both the Desk loader and the per-symbol record read it. One
 * definition of "a setup card's view", not three.
 *
 * The app RENDERS the base-rate figures the pipeline computed; it never derives them (§1.5 rule 10).
 * The stored `state` JSON carries n, winRate, the interval, the baseline and the provenance, and
 * this maps them onto the shared `BaseRateData` shape that `components/BaseRate` reads.
 */

import { isKnownLesson } from "@/lib/academy";
import { patternCause, patternLabel, patternLessonSlug } from "@/lib/patterns";
import { weakenersFor } from "@/lib/weakeners";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { Tier } from "@/lib/constants";

/** The stored `setup_card` columns this builder reads. Whatever selects the row must provide these. */
export type SetupCardRow = {
  id: string;
  symbol: string;
  patternKey: string;
  tier: string;
  state: unknown;
  weakeners: unknown;
};

/** The reference-class label the base-rate sentence reads ("US large/mid", "US small"). */
export function refClassLabel(universe: string): string {
  if (universe === "large_mid") return "US large/mid names";
  if (universe === "small") return "US small-cap names";
  return "US names";
}

/** A lesson slug only if the Academy manifest knows it — else null (no doorway yet). */
function knownLessonOrNull(slug: string | null): string | null {
  return slug && isKnownLesson(slug) ? slug : null;
}

/**
 * Build one setup-card view-model from a stored row.
 *
 * `wins` is DERIVED from the stored winRate × n and rounded — the pipeline stores a rate, not a
 * count, and `BaseRate` wants the count to draw its dot array. Deriving it here (rather than storing
 * a second field) means the count can never disagree with the rate it came from (ruling C6, one
 * level down: a value that is a pure function of its neighbour is a future contradiction if stored).
 */
export function buildSetupCardView(row: SetupCardRow): SetupCardView {
  const state = (row.state ?? {}) as Record<string, unknown>;
  const n = Number(state.n ?? 0);
  const winRate = Number(state.winRate ?? 0);

  return {
    id: row.id,
    symbol: row.symbol,
    patternKey: row.patternKey,
    patternLabel: patternLabel(row.patternKey),
    tier: row.tier as Tier,
    cause: patternCause(row.patternKey),
    baseRate: {
      n,
      wins: Math.round(winRate * n),
      winRate,
      ciLow: Number(state.ciLow ?? 0),
      ciHigh: Number(state.ciHigh ?? 0),
      baseline: state.baseline == null ? null : Number(state.baseline),
      horizonDays: Number(state.horizonDays ?? 10),
      refClass: refClassLabel(String(state.universe ?? "")),
      publicationYear: state.publicationYear == null ? null : Number(state.publicationYear),
      evidenceGrade: (state.evidenceGrade as SetupCardView["baseRate"]["evidenceGrade"]) ?? null,
      decayNote: (state.decayNote as string | null) ?? null,
    },
    weakeners: weakenersFor(row.patternKey),
    weakenerState: (row.weakeners ?? {}) as Record<string, boolean>,
    // The card links to its pattern's lesson — but only once that lesson is authored (the doorway
    // gates on the slug existing), so cards for not-yet-written lessons carry none.
    learnSlug: knownLessonOrNull(patternLessonSlug(row.patternKey)),
  };
}
