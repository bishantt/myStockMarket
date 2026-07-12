// @vitest-environment node
import { describe, expect, it } from "vitest";

import { paginate, sortRows, type Column } from "./table";

/**
 * The table engine's contract, written down before the engine was.
 *
 * Two of these tests are honesty rules wearing an algorithm's clothes:
 *
 *   · NULL SORTS LAST IN BOTH DIRECTIONS. A missing RVOL is "we do not know", not "zero". The
 *     pipeline already refuses to coerce a NaN to a 0 (DECISIONS 2026-07-11) and the table must not
 *     undo that: sorting ascending by a metric and finding the unknowns at the top, dressed as the
 *     smallest values, is a lie told by a comparator.
 *   · THE SORT IS STABLE. Rows that tie keep the order they arrived in, which is the pipeline's own
 *     rank — the honest default. An unstable sort would silently re-order tied rows on every render
 *     and make "scan order" mean nothing.
 */

type Row = { symbol: string; rvol: number | null; rank: number };

const col: Column<Row> = {
  key: "rvol",
  header: "RVOL",
  kind: "multiple",
  priority: 1,
  value: (row) => row.rvol,
};

const rows: Row[] = [
  { symbol: "AAA", rvol: 2.5, rank: 1 },
  { symbol: "BBB", rvol: null, rank: 2 },
  { symbol: "CCC", rvol: 4.7, rank: 3 },
  { symbol: "DDD", rvol: 2.5, rank: 4 }, // ties with AAA — stability is observable here
  { symbol: "EEE", rvol: null, rank: 5 },
];

describe("sortRows", () => {
  it("sorts descending by the column's value", () => {
    const sorted = sortRows(rows, col, "desc");
    expect(sorted.slice(0, 3).map((r) => r.symbol)).toEqual(["CCC", "AAA", "DDD"]);
  });

  it("sorts ascending by the column's value", () => {
    const sorted = sortRows(rows, col, "asc");
    expect(sorted.slice(0, 3).map((r) => r.symbol)).toEqual(["AAA", "DDD", "CCC"]);
  });

  it("puts nulls LAST descending — an unknown is not a large value", () => {
    const sorted = sortRows(rows, col, "desc");
    expect(sorted.slice(-2).map((r) => r.symbol)).toEqual(["BBB", "EEE"]);
  });

  it("puts nulls LAST ascending too — an unknown is not a zero", () => {
    // This is the one that matters. A naive comparator treats null as 0 and floats every unknown
    // to the top of an ascending sort, where it reads as "the smallest RVOL today".
    const sorted = sortRows(rows, col, "asc");
    expect(sorted.slice(-2).map((r) => r.symbol)).toEqual(["BBB", "EEE"]);
  });

  it("is stable: tied rows keep the order they came in (which is the pipeline's rank)", () => {
    expect(sortRows(rows, col, "desc").filter((r) => r.rvol === 2.5).map((r) => r.symbol)).toEqual(["AAA", "DDD"]);
    expect(sortRows(rows, col, "asc").filter((r) => r.rvol === 2.5).map((r) => r.symbol)).toEqual(["AAA", "DDD"]);
  });

  it("sorts text case-insensitively, so a lowercase name does not sort below Z", () => {
    const nameCol: Column<{ name: string }> = {
      key: "name",
      header: "Name",
      kind: "text",
      priority: 2,
      value: (row) => row.name,
    };
    const names = [{ name: "banana" }, { name: "Apple" }, { name: "cherry" }];
    expect(sortRows(names, nameCol, "asc").map((r) => r.name)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("copies rather than mutating — the caller's array is untouched", () => {
    const original = [...rows];
    sortRows(rows, col, "desc");
    expect(rows).toEqual(original);
  });
});

describe("paginate", () => {
  const many = Array.from({ length: 32 }, (_, i) => ({ symbol: `S${i}`, rvol: i, rank: i + 1 }));

  it("cuts a page and reports the position in words the UI can print", () => {
    const page2 = paginate(many, 2, 25);
    expect(page2.rows).toHaveLength(7);
    expect(page2.page).toBe(2);
    expect(page2.pages).toBe(2);
    expect(page2.total).toBe(32);
  });

  it("defaults to 25 rows a page", () => {
    expect(paginate(many, 1).rows).toHaveLength(25);
  });

  it("clamps a page number past the end back to the last page", () => {
    // Never a blank screen with "Page 9 of 2" printed under it.
    expect(paginate(many, 9, 25).page).toBe(2);
  });

  it("clamps a page number below 1", () => {
    expect(paginate(many, 0, 25).page).toBe(1);
    expect(paginate(many, -3, 25).page).toBe(1);
  });

  it("handles an empty set without claiming zero pages", () => {
    // "Page 1 of 0" is not a thing a reader should ever see. An empty table is still one page.
    const empty = paginate([], 1, 25);
    expect(empty.rows).toEqual([]);
    expect(empty.pages).toBe(1);
    expect(empty.page).toBe(1);
    expect(empty.total).toBe(0);
  });

  it("does not invent a second page when the rows fit exactly", () => {
    const exactly25 = many.slice(0, 25);
    expect(paginate(exactly25, 1, 25).pages).toBe(1);
  });

  it("counts a single row as one page", () => {
    expect(paginate(many.slice(0, 1), 1, 25).pages).toBe(1);
  });
});
