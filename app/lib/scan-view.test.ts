import { describe, expect, it } from "vitest";

import { capMatches, SCAN_MATCH_LIMIT } from "./scan-view";

/** lib/scan-view.test.ts — the scan-match cap that keeps the Scans page calm. */
describe("capMatches", () => {
  it("shows everything and hides nothing when under the cap", () => {
    const result = capMatches(["A", "B", "C"], 24);
    expect(result.shown).toEqual(["A", "B", "C"]);
    expect(result.more).toBe(0);
    expect(result.total).toBe(3);
  });

  it("caps the shown list and reports the remainder", () => {
    const hits = Array.from({ length: 147 }, (_, i) => `T${i}`);
    const result = capMatches(hits, 24);
    expect(result.shown).toHaveLength(24);
    expect(result.more).toBe(123);
    expect(result.total).toBe(147);
  });

  it("defaults to the shared limit", () => {
    const hits = Array.from({ length: 100 }, (_, i) => `T${i}`);
    expect(capMatches(hits).shown).toHaveLength(SCAN_MATCH_LIMIT);
  });
});
