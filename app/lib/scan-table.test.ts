// @vitest-environment node
import { describe, expect, it } from "vitest";

import { columnsFor, type ScanRow } from "./scan-table";
import { SCAN_PRESETS } from "./scan-presets";

/**
 * The column map's contract (Appendix F).
 *
 * The rule being tested is the one that makes the table honest rather than merely useful: **the
 * columns restate the preset's own criteria.** A scan for unusual volume must show the volume and
 * the move; a scan for names near their 52-week high must show the distance to that high. That is
 * how a reader checks the filter's work by eye, and it is the whole anti-black-box promise of this
 * page. A table of columns that had nothing to do with the recipe would be a black box with extra
 * numbers in it.
 */

const row = (metrics: Record<string, number | null>): ScanRow => ({
  symbol: "SMCI",
  name: "Super Micro",
  rank: 1,
  lottery: false,
  metrics,
});

describe("columnsFor", () => {
  it("gives every preset a column set", () => {
    for (const preset of SCAN_PRESETS) {
      expect(columnsFor(preset.key).length, preset.key).toBeGreaterThan(3);
    }
  });

  it("shows each preset the metrics its OWN criteria are stated in", () => {
    // unusual-volume filters on "RVOL ≥ 2.5 AND |1-day return| ≥ 2%" — so it shows both.
    const uv = columnsFor("unusual-volume").map((c) => c.key);
    expect(uv).toContain("rvol20");
    expect(uv).toContain("ret_1");

    // near-52w-high filters on the distance to the high — so that is the headline column.
    expect(columnsFor("near-52w-high").map((c) => c.key)).toContain("dist_52w_high");
    expect(columnsFor("gap-3plus").map((c) => c.key)).toContain("gap_pct");

    const gc = columnsFor("golden-cross-fresh").map((c) => c.key);
    expect(gc).toContain("sma50");
    expect(gc).toContain("sma200");

    const rsi = columnsFor("rsi-extreme").map((c) => c.key);
    expect(rsi).toContain("rsi14");
    expect(rsi).toContain("rsi14_prev");
  });

  it("puts the trigger metrics at priority 1 — they are the reason the row is here", () => {
    const uv = columnsFor("unusual-volume");
    expect(uv.find((c) => c.key === "rvol20")?.priority).toBe(1);
    // Supporting context sits at priority 3: interesting on a desktop, noise on a phone card-row.
    expect(uv.find((c) => c.key === "dollar_volume")?.priority).toBe(3);
  });

  it("keeps the rank column visible on a phone, because rank IS the default order (M1)", () => {
    // The reader must be able to SEE the order they are in, not infer it. Priority 3 would have
    // hidden it on exactly the device where the sort control is a one-line select.
    const rank = columnsFor("unusual-volume").find((c) => c.key === "rank");
    expect(rank?.priority).toBeLessThanOrEqual(2);
  });

  it("never names a column 'top', 'best' or 'hottest' — a scan is not a leaderboard (M1)", () => {
    for (const preset of SCAN_PRESETS) {
      for (const column of columnsFor(preset.key)) {
        expect(column.header, `${preset.key}/${column.key}`).not.toMatch(/\b(top|best|hottest|hot|winners)\b/i);
      }
    }
  });

  it("reads a missing metric as UNKNOWN, not as zero", () => {
    // The pipeline coerces a NaN to null on purpose. A column that silently read it as 0 would put
    // an invented figure in a cell and then sort the row by it.
    const rvol = columnsFor("unusual-volume").find((c) => c.key === "rvol20")!;
    expect(rvol.value(row({ rvol20: null }))).toBeNull();
    expect(rvol.value(row({}))).toBeNull();
    expect(rvol.value(row({ rvol20: 4.7 }))).toBe(4.7);
  });

  it("routes every numeric column through a lib/format kind — no column formats itself", () => {
    const FORMATTED = new Set(["price", "signedPercent", "percent", "multiple", "compact", "int", "mono"]);
    for (const preset of SCAN_PRESETS) {
      for (const column of columnsFor(preset.key)) {
        if (column.kind === "text") continue;
        expect(FORMATTED.has(column.kind), `${preset.key}/${column.key}`).toBe(true);
      }
    }
  });
});

/**
 * RULING C2, ENFORCED AT THE COLUMN MAP (NEWS-AND-CONTROL-PLAN Part 5.2, mechanism 2).
 *
 * "3.1×" is not a fact. "3.1× · 20d avg" is. A relative-volume figure means nothing at all until
 * you know what it is relative TO, and until this phase the definition lived in a footnote on ONE
 * surface and nowhere else — so a reader who met RVOL first in a scan table met a number with no
 * unit and no way to acquire one.
 *
 * A grep cannot see a missing window on an arbitrary JSX number, but it CAN see one here, because
 * every metric in every scan table comes through this one map. So this is where the rule gets
 * teeth: add a metric column without a window token and the build fails.
 *
 * This is the guard, not the honour system. The next person adding a column does not have to have
 * read the plan.
 */
describe("C2 — every metric column states its window", () => {
  /**
   * The columns that are NOT metrics, and why each is exempt.
   *
   * `close` is the interesting one, and it is exempt BY RULE rather than by convenience: C2 says a
   * number whose window is genuinely the whole surface's as-of — a price at last close — carries the
   * shared as-of stamp the masthead already prints, and needs nothing repeated. Every scan table
   * prints "as of <date>" above it. The other three are identifiers, not measurements.
   */
  const NOT_A_METRIC = new Set(["rank", "symbol", "name", "close"]);

  /** The closed window vocabulary, as it appears in a header: "20d", "14d", "1-day", "52w", "1D". */
  const STATES_A_WINDOW = /\d+\s*-?\s*(day|d|w)\b|prior close|1D/i;

  it.each(SCAN_PRESETS.map((p) => p.key))("%s — no metric column is missing its window", (key) => {
    const naked = columnsFor(key)
      .filter((c) => !NOT_A_METRIC.has(c.key))
      .filter((c) => !STATES_A_WINDOW.test(c.header))
      .map((c) => `${c.key} → "${c.header}"`);

    expect(
      naked,
      "a metric without its window is a number the reader cannot interpret — give it a token from copy.window",
    ).toEqual([]);
  });

  it("the guard can fail — a naked header is actually caught", () => {
    // The negative control. Every gate in this codebase that turned out to be worthless was one
    // nobody had ever watched fail, so this one gets watched.
    expect(STATES_A_WINDOW.test("RVOL")).toBe(false);
    expect(STATES_A_WINDOW.test("RVOL · 20d")).toBe(true);
    expect(STATES_A_WINDOW.test("Gap")).toBe(false);
    expect(STATES_A_WINDOW.test("Gap · open vs prior close")).toBe(true);
  });
});
