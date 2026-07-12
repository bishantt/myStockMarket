import { describe, expect, it } from "vitest";
import { SCAN_PRESETS, criteriaClauses } from "./scan-presets";

/**
 * The scan page promises the reader sees exactly what the scan applied. So the clause split may
 * change the LAYOUT of the criteria and never the words.
 */
describe("criteriaClauses", () => {
  it("splits a compound criterion at its AND joints", () => {
    expect(criteriaClauses("20-day relative volume ≥ 2.5 AND |1-day return| ≥ 2%.")).toEqual([
      "20-day relative volume ≥ 2.5",
      "|1-day return| ≥ 2%",
    ]);
  });

  it("leaves a single criterion whole", () => {
    expect(criteriaClauses("Close within 2% of the 252-day high — large/mid only.")).toEqual([
      "Close within 2% of the 252-day high — large/mid only",
    ]);
  });

  it("never loses or invents a word, for any preset we actually ship", () => {
    // The honesty check. Rejoining the clauses must reproduce the original criteria exactly, so a
    // reader reading the numbered list is reading the scan's real filter and not a paraphrase.
    for (const preset of SCAN_PRESETS) {
      const rejoined = criteriaClauses(preset.criteria).join(" AND ") + ".";
      expect(rejoined, `preset ${preset.key} lost words in the split`).toBe(preset.criteria);
    }
  });
});
