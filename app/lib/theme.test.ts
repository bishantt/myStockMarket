import { describe, expect, it } from "vitest";

import { normaliseTheme, THEMES, THEME_COOKIE_MAX_AGE, nextTheme } from "./theme";

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

/**
 * nextTheme — the one-tap top-bar toggle's cycle logic (CC3, Part 4.2).
 *
 * The toggle only ever lands on an explicit light or dark; System stays available in Settings (the
 * canonical three-way control). The rule it has to get right is the "system" case: a reader on
 * system-follows-OS who is SEEING dark must, on one tap, get explicit light — the opposite of what
 * is on screen — not dark again. So the function resolves "system" against the OS preference first,
 * then flips the resolved appearance. It is pure — the OS preference is an argument, never a global —
 * which is the whole reason it can be unit-tested (the component reads matchMedia and hands it in).
 */
describe("nextTheme — flips the resolved appearance", () => {
  it("flips an explicit choice, ignoring the OS either way", () => {
    expect(nextTheme("light", false)).toBe("dark");
    expect(nextTheme("light", true)).toBe("dark");
    expect(nextTheme("dark", false)).toBe("light");
    expect(nextTheme("dark", true)).toBe("light");
  });

  it("resolves 'system' against the OS, then flips what the reader is actually seeing", () => {
    // system + a light OS → the reader sees light → one tap gives dark.
    expect(nextTheme("system", false)).toBe("dark");
    // system + a dark OS → the reader sees dark → one tap gives light, not dark again.
    expect(nextTheme("system", true)).toBe("light");
  });

  it("never returns 'system' — the toggle is a two-state control", () => {
    for (const from of THEMES) {
      for (const prefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(nextTheme(from, prefersDark));
      }
    }
  });
});

describe("THEME_COOKIE_MAX_AGE", () => {
  it("is a year in seconds — a theme is a preference, not a session", () => {
    expect(THEME_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});
