import { describe, expect, it } from "vitest";

import { FOCUS_CAP, canSetFocus, normalizeSymbol, validateAdd } from "@/lib/watchlist";

/**
 * Tests for lib/watchlist — the pure rules behind the watchlist write actions. The database work
 * (existence checks, inserts) lives in the server actions and is exercised by the seeded e2e; these
 * pin the two rules that must never drift: a reason is required per name, and the focus list is
 * capped at three (plan Appendix B, §9.2 — the focus discipline).
 */

describe("normalizeSymbol", () => {
  it("trims and upper-cases", () => {
    expect(normalizeSymbol("  aapl ")).toBe("AAPL");
    expect(normalizeSymbol("brk.b")).toBe("BRK.B");
  });
});

describe("validateAdd", () => {
  it("accepts a valid ticker and a written reason", () => {
    const result = validateAdd({ symbol: "aapl", reason: "  Earnings next week  " });
    expect(result).toEqual({ ok: true, value: { symbol: "AAPL", reason: "Earnings next week" } });
  });

  it("rejects a blank or whitespace-only reason — a reason is required per name", () => {
    for (const reason of ["", "   ", "\n\t"]) {
      const result = validateAdd({ symbol: "AAPL", reason });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe("reason");
    }
  });

  it("rejects a malformed symbol", () => {
    for (const symbol of ["", "123", "!!", "toolongsymbol"]) {
      const result = validateAdd({ symbol, reason: "a real reason" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe("symbol");
    }
  });

  it("rejects an over-long reason rather than silently truncating it", () => {
    const result = validateAdd({ symbol: "AAPL", reason: "x".repeat(281) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("reason");
  });
});

describe("canSetFocus", () => {
  it("always allows turning focus OFF", () => {
    expect(canSetFocus(FOCUS_CAP, true, false)).toBe(true);
  });

  it("allows focus when under the cap", () => {
    expect(canSetFocus(FOCUS_CAP - 1, false, true)).toBe(true);
  });

  it("refuses a new focus name once the cap is reached", () => {
    expect(canSetFocus(FOCUS_CAP, false, true)).toBe(false);
  });

  it("allows a name that is already focus (no change to the count)", () => {
    expect(canSetFocus(FOCUS_CAP, true, true)).toBe(true);
  });
});
