/**
 * lib/scan-view.ts — how a scan preset's matches are shown (plan §3.10 restraint, mobile fix).
 *
 * A preset can match a hundred-plus symbols. Dumping every ticker is a wall, not information — so the
 * Desk shows a capped run with an honest "+ N more" tail, keeping the full count visible above. Pure,
 * so the capping is unit-tested; the page just renders the result.
 */

/** The default number of tickers shown before the "+ N more" tail. */
export const SCAN_MATCH_LIMIT = 24;

export type CappedMatches = {
  shown: string[];
  /** How many matches are hidden past the cap (0 when everything fits). */
  more: number;
  total: number;
};

/** Cap a preset's matches to `limit`, reporting how many were hidden. */
export function capMatches(hits: string[], limit: number = SCAN_MATCH_LIMIT): CappedMatches {
  const shown = hits.slice(0, limit);
  return { shown, more: Math.max(0, hits.length - shown.length), total: hits.length };
}
