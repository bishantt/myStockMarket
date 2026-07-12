import type { Column } from "@/lib/table";

/**
 * lib/scan-table.ts — what each preset's match table shows, and why (APP-FEEL-PLAN §4.2, Appendix F).
 *
 * The database has been storing a 34-key metrics snapshot on every single scan match since P4 —
 * rvol20, ret_1, gap_pct, dist_52w_high, rsi14, close, dollar_volume, the lottery flag, the lot —
 * and /scans has been rendering exactly one of them: the symbol. As a bare chip. Capped at 24, with
 * a dead "+ N more" that was not a link.
 *
 * So the "why did this match?" column the reader has always needed costs no pipeline change at all.
 * It is a fatter `select` and this file.
 *
 * THE COLUMN SET RESTATES THE PRESET'S OWN CRITERIA. That is the rule the map is built on: a scan
 * for unusual volume shows you the volume and the move; a scan for names near their 52-week high
 * shows you the distance to that high. The reader can check the filter's work by eye, which is the
 * anti-black-box promise this page exists to keep. Columns that are merely interesting sit at
 * priority 3 (desktop only); the columns that ARE the recipe sit at priority 1.
 */

/** One row of a scan's match table, flattened out of the stored metrics JSON. */
export type ScanRow = {
  symbol: string;
  name: string;
  rank: number;
  /** True when the pipeline flagged this as a lottery-risk name (sub-$5, or skewed under $10). */
  lottery: boolean;
  /** Every metric the preset's columns might read. Missing keys are null — an unknown, not a zero. */
  metrics: Record<string, number | null>;
};

/** Pull a metric, coercing anything that is not a finite number to null (an unknown is not a zero). */
const metric = (key: string) => (row: ScanRow): number | null => {
  const value = row.metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

/** Columns every preset shows: where the row sits in the scan, what it is, and what it costs. */
function commonColumns(): Column<ScanRow>[] {
  return [
    {
      // Rank IS the scan order, and the scan order is the default sort. On a phone card-row the
      // reader must be able to SEE the order they are in, not infer it (M1) — so it rides line 2
      // rather than hiding on the desktop table.
      key: "rank",
      header: "#",
      kind: "int",
      priority: 2,
      value: (row) => row.rank,
    },
    { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (row) => row.symbol },
    { key: "name", header: "Name", kind: "text", priority: 2, value: (row) => row.name },
    { key: "close", header: "Close", kind: "price", priority: 2, value: metric("close") },
  ];
}

/**
 * The trigger and context columns per preset (Appendix F).
 *
 * `is_large_mid` and the rest of the 34-key snapshot stay server-side: they are pipeline internals,
 * not reader information, and a table that shows everything shows nothing.
 */
const TRIGGERS: Record<string, Column<ScanRow>[]> = {
  "unusual-volume": [
    { key: "ret_1", header: "1-day move", kind: "signedPercent", priority: 1, value: metric("ret_1") },
    { key: "rvol20", header: "RVOL", kind: "multiple", priority: 1, value: metric("rvol20") },
    { key: "dollar_volume", header: "$ volume", kind: "compact", priority: 3, value: metric("dollar_volume") },
  ],
  "near-52w-high": [
    { key: "dist_52w_high", header: "From 52w high", kind: "signedPercent", priority: 1, value: metric("dist_52w_high") },
    { key: "ret_1", header: "1-day move", kind: "signedPercent", priority: 2, value: metric("ret_1") },
    { key: "rvol20", header: "RVOL", kind: "multiple", priority: 3, value: metric("rvol20") },
  ],
  "gap-3plus": [
    { key: "gap_pct", header: "Gap", kind: "signedPercent", priority: 1, value: metric("gap_pct") },
    { key: "ret_1", header: "1-day move", kind: "signedPercent", priority: 2, value: metric("ret_1") },
    { key: "rvol20", header: "RVOL", kind: "multiple", priority: 3, value: metric("rvol20") },
  ],
  "golden-cross-fresh": [
    // Both averages are printed exactly as the pipeline computed them. The app derives nothing here:
    // numbers are computed pipeline-side, and a UI that recomputed a moving average would be a
    // second implementation of it, free to disagree with the first.
    { key: "sma50", header: "50-day", kind: "price", priority: 1, value: metric("sma50") },
    { key: "sma200", header: "200-day", kind: "price", priority: 1, value: metric("sma200") },
    { key: "ret_20", header: "20-day move", kind: "signedPercent", priority: 3, value: metric("ret_20") },
  ],
  "rsi-extreme": [
    { key: "rsi14", header: "RSI", kind: "mono", priority: 1, value: metric("rsi14") },
    { key: "rsi14_prev", header: "RSI prior", kind: "mono", priority: 2, value: metric("rsi14_prev") },
    { key: "ret_5", header: "5-day move", kind: "signedPercent", priority: 3, value: metric("ret_5") },
  ],
};

/**
 * The columns for one preset: what it is, then why it matched, then the supporting context.
 *
 * A header in this map may never contain "top", "best", or "hottest". That is not stylistic — those
 * words turn a restatement of the reader's own filter into a claim about which names are good, which
 * is the leaderboard ruling M1 exists to forbid. `e2e/scans.spec.ts` greps the rendered table for
 * them, so the rule is enforced on the page and not merely in this comment.
 */
export function columnsFor(presetKey: string): Column<ScanRow>[] {
  const common = commonColumns();
  const triggers = TRIGGERS[presetKey] ?? [];

  // Symbol and rank first, then the recipe's own metrics, then name/close, then the context columns.
  const [rank, symbol, name, close] = common;
  return [rank, symbol, ...triggers.filter((c) => c.priority !== 3), name, close, ...triggers.filter((c) => c.priority === 3)];
}
