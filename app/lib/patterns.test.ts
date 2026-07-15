import { describe, expect, it } from "vitest";

import { patternLabel } from "./patterns";
import { SCAN_PRESETS } from "./scan-presets";

/**
 * patterns.test.ts — patternLabel resolves BOTH keyspaces (CC1/D6).
 *
 * The record block runs `signal_log.pattern_key` through patternLabel, and that column holds a SCAN
 * PRESET key ("gap-3plus"), not the detector key the setup cards use. patternLabel used to echo any
 * key it did not recognise, so a name with a fresh scan-fired signal showed "gap-3plus" on the ticker
 * sheet where "Gap of 3% or more" belonged. These pin the fix at the function that decides it.
 */

describe("patternLabel", () => {
  it("resolves the raw scan-preset slug D6 leaked to its scan title", () => {
    expect(patternLabel("gap-3plus")).toBe("Gap of 3% or more");
    expect(patternLabel("near-52w-high")).toBe("Near the 52-week high");
    expect(patternLabel("golden-cross-fresh")).toBe("Fresh golden cross");
  });

  it("still resolves the detector pattern keys the setup cards carry", () => {
    expect(patternLabel("gap-with-catalyst")).toBe("Gap with a catalyst");
    expect(patternLabel("golden-cross")).toBe("Golden cross");
    expect(patternLabel("52w-high-proximity")).toBe("Near the 52-week high");
  });

  it("resolves keys shared verbatim by both registries", () => {
    expect(patternLabel("unusual-volume")).toBe("Unusual volume");
    expect(patternLabel("rsi-extreme")).toBe("RSI extreme");
  });

  it("never echoes a scan-preset slug — every preset key resolves to its own title", () => {
    for (const preset of SCAN_PRESETS) {
      expect(patternLabel(preset.key)).toBe(preset.label);
    }
  });

  it("returns the key itself only for a truly unknown key", () => {
    expect(patternLabel("not-a-real-pattern")).toBe("not-a-real-pattern");
  });
});
