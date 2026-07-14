import type { ReactNode } from "react";

/**
 * lib/table.ts — the sort-and-paginate engine behind every table in the app (APP-FEEL-PLAN §3.3).
 *
 * Hand-rolled, and deliberately so (DECISIONS 2026-07-12): sorting and paging a bounded set of at
 * most 500 rows on the client is about eighty lines of code, and the alternative was a dependency
 * whose ergonomics we would immediately re-skin. Same grain as the rest of this repo — the charts
 * are hand-drawn SVG, the number formatting is `lib/format`.
 *
 * The engine is pure and immutable: it copies, never mutates, so a sort can never quietly reorder
 * the array a caller is still holding.
 *
 * TWO RULES HERE ARE HONESTY RULES, NOT ALGORITHM CHOICES.
 *
 *   1. NULL SORTS LAST, IN BOTH DIRECTIONS. A missing metric means "we do not know", and the
 *      pipeline goes out of its way to preserve that — it coerces a NaN to null rather than to zero
 *      (DECISIONS 2026-07-11). A comparator that treats null as 0 undoes that in one line: sort
 *      ascending by RVOL and every unknown floats to the top, presented as the day's smallest
 *      values. Unknowns go to the bottom whichever way the reader sorts.
 *
 *   2. THE SORT IS STABLE. Rows that tie keep the order they arrived in — and they arrive in the
 *      pipeline's own rank order, which is the honest default the UI calls "scan order". An
 *      unstable sort would shuffle tied rows on every render, which is both noise and a quiet lie
 *      about there being an order where there is none. (JavaScript's own `Array.sort` has been
 *      required to be stable since ES2019, so this costs nothing — but it is load-bearing, so it is
 *      written down rather than assumed.)
 */

/** How a column's value is rendered — every kind routes through lib/format, and nothing else. */
export type ColumnKind =
  | "text"
  | "mono"
  | "price"
  | "signedPercent"
  | "percent"
  | "multiple"
  | "compact"
  | "int"
  | "chip";

type ColumnBase<Row> = {
  /** The metrics key or field name. Used as the column's identity when sorting. */
  key: string;
  /** The header the reader sees: "RVOL", "From 52w high". Never "top", "best", or "hottest" (M1). */
  header: string;
  align?: "left" | "right";
  /** Sortable unless a column says otherwise. */
  sortable?: boolean;
  /**
   * Phone card-rows are built from this: 1 = the headline line, 2 = the detail line, 3 = desktop
   * only. A seven-column grid peeked through a 390px keyhole is not a table, it is a keyhole.
   */
  priority: 1 | 2 | 3;
  /** Pull the raw value out of a row. `null` means unknown — it renders "—" and sorts last. */
  value: (row: Row) => string | number | null;
  /**
   * Optionally render the cell yourself, for the cases a `kind` cannot express — the lottery-risk
   * tag that hangs off a symbol, say. SORTING STILL USES `value`, always: a column that sorted by
   * one thing and displayed another would be the quietest possible lie a table can tell.
   */
  render?: (row: Row) => ReactNode;
};

/**
 * A column of signed moves — and it MUST name the window it measured them over.
 *
 * ── THE BUG THIS TYPE EXISTS TO MAKE IMPOSSIBLE (PD6) ────────────────────────────────────────────
 *
 * A delta with no period attached is a number the reader has to guess the meaning of, and a beginner
 * guesses wrong. That is ruling C2, and `DeltaChip` already enforces it: `window` is a REQUIRED prop
 * there, precisely so that a chip which omitted it could not be built.
 *
 * The table walked around that guard for six phases, by holding its own private copy of the chip
 * that took no window at all. The window lived in the COLUMN HEADER instead — "1-day move", "From
 * 52w high" — and on a desktop that is genuinely fine: a `<th>` sits directly above its cells and
 * labels every one of them.
 *
 * ON A PHONE THERE IS NO `<th>`. DataTable renders a card list, and a priority-1 cell is drawn with
 * NO HEADER BESIDE IT (only priority-2 cells get their header printed). Every signed-percent column
 * in the scan tables and in the news room's affected-tickers table is priority 1. So on a phone the
 * row read:
 *
 *     SMCI   ▼ −12.4%   4.7×
 *
 * and nothing anywhere on that screen said the −12.4% was the distance from the 52-week HIGH. It
 * reads as "down 12.4% today", which is not what it is, and the reader has no way to find out. The
 * desktop told the truth; the phone did not; the pixel baseline had photographed both and was
 * defending them.
 *
 * So the window comes back onto the chip, where DeltaChip always wanted it — and it is REQUIRED by
 * the type, which means a future signed-percent column cannot be added without one. The compiler is
 * the guard. It cannot be forgotten, and it cannot be pointed at the wrong file.
 */
type SignedPercentColumn<Row> = ColumnBase<Row> & {
  kind: "signedPercent";
  /**
   * The period the move was measured over, in the chip's own short voice: "1D", "vs 52w high",
   * "vs prior close". Short, because it renders on EVERY row — the long form is the column header's
   * job ("Gap · open vs prior close"), and the two are allowed to say the same thing twice. A unit
   * travels with its number; a header labels a column. On a phone only the first of those survives.
   */
  window: string;
};

export type Column<Row> =
  | (ColumnBase<Row> & { kind: Exclude<ColumnKind, "signedPercent"> })
  | SignedPercentColumn<Row>;

export type SortDirection = "asc" | "desc";

/**
 * Sort rows by one column. Stable, immutable, and null-last in both directions.
 */
export function sortRows<Row>(rows: Row[], column: Column<Row>, direction: SortDirection): Row[] {
  const factor = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = column.value(a);
    const right = column.value(b);

    // Unknowns sink, regardless of direction. This is the rule the whole file exists to protect:
    // the comparison below never sees a null, so it can never rank one.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }

    // Text compares case-insensitively, so "banana" does not sort below "Zebra" on a capital letter.
    return String(left).localeCompare(String(right), undefined, { sensitivity: "base" }) * factor;
  });
}

export type Page<Row> = {
  rows: Row[];
  /** The page actually shown, after clamping — never a page that does not exist. */
  page: number;
  /** Total pages. An empty table is ONE page, not zero: "Page 1 of 0" is not a thing to show a reader. */
  pages: number;
  total: number;
};

export const DEFAULT_PER_PAGE = 25;

/**
 * Cut one page out of the rows, clamping the page number into range.
 *
 * Clamping rather than erroring is deliberate: the page number is UI state, and a reader who sorts
 * a table while sitting on page 7 of a set that just got shorter should land on the last page, not
 * on a blank screen captioned "Page 7 of 2".
 */
export function paginate<Row>(rows: Row[], page: number, per: number = DEFAULT_PER_PAGE): Page<Row> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / per));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const start = (current - 1) * per;

  return {
    rows: rows.slice(start, start + per),
    page: current,
    pages,
    total,
  };
}
