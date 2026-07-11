import { describe, expect, it } from "vitest";

import { normaliseTheme, THEMES } from "./theme";

/** lib/theme.test.ts — the Desk theme vocabulary is closed and defaults to "system". */
describe("normaliseTheme", () => {
  it("passes through the three valid themes", () => {
    for (const theme of THEMES) expect(normaliseTheme(theme)).toBe(theme);
  });

  it("defaults anything else to system", () => {
    expect(normaliseTheme(undefined)).toBe("system");
    expect(normaliseTheme(null)).toBe("system");
    expect(normaliseTheme("midnight")).toBe("system");
  });
});
