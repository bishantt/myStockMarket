/**
 * lib/record.ts — "what our record says" for a single symbol (PD8, plan 9.6 block 7 / 10.1 block 5).
 *
 * The story page and the ticker page both answer the same question about a name: does OUR append-only
 * ledger hold anything relevant — an active setup, a base rate behind it, resolved hits and misses?
 * This is the one read that answers it, so the two pages cannot drift into two different ideas of
 * "the record" (the same discipline the news room keeps: two definitions of a thing eventually
 * disagree, and then two surfaces tell the reader two different truths).
 *
 * It is REUSE, not new probability UI: the setup card becomes the shared `SetupCardView` and renders
 * through `BaseRate` (the N-gate, the interval and the WEAK cap travel with it, §1.5). The resolved
 * counts are the insert-only truth of `signal_resolution` — hits and misses at equal weight, because
 * a ledger that quietly weights its hits is a ledger that flatters itself.
 */

import { db } from "@/lib/db";
import { patternLabel } from "@/lib/patterns";
import { buildSetupCardView } from "@/lib/setup-card-view";
import type { SetupCardView } from "@/components/desk/SetupCards";

/** One signal that has FIRED and not yet resolved — a live claim the ledger is still holding open. */
export type ActiveSignal = {
  patternKey: string;
  patternLabel: string;
  firedDate: Date;
  resolvesOn: Date;
  horizonDays: number;
};

/** Everything the record blocks render for one name. Every field is honestly empty when silent. */
export type SymbolRecord = {
  /** Fired, unresolved signals — the ledger's open positions on this name. */
  activeSignals: ActiveSignal[];
  /** The latest setup card for this name, or null when it has none tonight. */
  setupCard: SetupCardView | null;
  /** Resolved history, at equal weight. `na` outcomes are excluded — they are neither hit nor miss. */
  resolved: { hits: number; misses: number };
};

const EMPTY: SymbolRecord = {
  activeSignals: [],
  setupCard: null,
  resolved: { hits: 0, misses: 0 },
};

/**
 * Is there anything to show? The record block is ABSENT when the ledger is silent (P9), and the
 * CALLER decides whether to render — so this answers the question for it rather than rendering an
 * apology. A name with no setup, no open signal and no resolved history has an empty record, and an
 * empty record is not a failure; it is the common case.
 */
export function hasRecord(record: SymbolRecord): boolean {
  return (
    record.activeSignals.length > 0 ||
    record.setupCard !== null ||
    record.resolved.hits + record.resolved.misses > 0
  );
}

/**
 * Load a symbol's ledger record. Three independent reads in one parallel stage; a failure degrades
 * to the empty record (the block simply does not render), never to a crash on a page the reader asked
 * for — the same honest-degrade contract every loader in this app keeps.
 */
export async function getSymbolRecord(symbol: string): Promise<SymbolRecord> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const [signals, setupRow, resolvedGroups] = await Promise.all([
      db.signalLog.findMany({
        // `resolution: null` on the optional to-one relation means "fired but not yet resolved".
        where: { symbol: normalized, resolution: null },
        orderBy: { firedDate: "desc" },
        select: { patternKey: true, firedDate: true, resolvesOn: true, horizonDays: true },
      }),
      db.setupCard.findFirst({
        where: { symbol: normalized },
        orderBy: { runDate: "desc" },
        select: { id: true, symbol: true, patternKey: true, tier: true, state: true, weakeners: true },
      }),
      db.signalResolution.groupBy({
        by: ["outcome"],
        where: { signal: { symbol: normalized } },
        _count: { _all: true },
      }),
    ]);

    const activeSignals: ActiveSignal[] = signals.map((signal) => ({
      patternKey: signal.patternKey,
      patternLabel: patternLabel(signal.patternKey),
      firedDate: signal.firedDate,
      resolvesOn: signal.resolvesOn,
      horizonDays: signal.horizonDays,
    }));

    const countFor = (outcome: string) =>
      resolvedGroups.find((group) => group.outcome === outcome)?._count._all ?? 0;

    return {
      activeSignals,
      setupCard: setupRow ? buildSetupCardView(setupRow) : null,
      resolved: { hits: countFor("hit"), misses: countFor("miss") },
    };
  } catch (error) {
    console.error(`getSymbolRecord: could not load the record for ${normalized}`, error);
    return EMPTY;
  }
}
