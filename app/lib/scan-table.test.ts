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
