import { describe, expect, it } from "vitest";

import { JOURNAL_MAX, validateForecast, validateJournal } from "@/lib/journal";

/** Tests for lib/journal.ts — the pure validation behind the PM journal write. */
describe("validateJournal", () => {
  it("accepts a written reflection and trims it", () => {
    const result = validateJournal("  I overtraded the open.  ");
    expect(result).toEqual({ ok: true, value: { body: "I overtraded the open." } });
  });

  it("refuses an empty or whitespace-only body", () => {
    expect(validateJournal("").ok).toBe(false);
    expect(validateJournal("   ").ok).toBe(false);
  });

  it("refuses a non-string body", () => {
    expect(validateJournal(null).ok).toBe(false);
    expect(validateJournal(42).ok).toBe(false);
  });

  it("refuses a body over the length cap", () => {
    expect(validateJournal("x".repeat(JOURNAL_MAX + 1)).ok).toBe(false);
    expect(validateJournal("x".repeat(JOURNAL_MAX)).ok).toBe(true);
  });
});

describe("validateForecast", () => {
  const TODAY = new Date("2026-07-11");
  const future = "2026-08-01";

  it("accepts a call, a 1–99 probability, and a future date, storing probability as a fraction", () => {
    const result = validateForecast("This setup resolves higher", 70, future, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.probability).toBeCloseTo(0.7, 6);
      expect(result.value.forecast).toBe("This setup resolves higher");
    }
  });

  it("rejects probabilities of 0 or 100 (not honest forecasts) and out-of-range values", () => {
    expect(validateForecast("x", 0, future, TODAY).ok).toBe(false);
    expect(validateForecast("x", 100, future, TODAY).ok).toBe(false);
    expect(validateForecast("x", 150, future, TODAY).ok).toBe(false);
  });

  it("rejects an empty call and a non-future resolution date", () => {
    expect(validateForecast("", 50, future, TODAY).ok).toBe(false);
    expect(validateForecast("x", 50, "2026-07-11", TODAY).ok).toBe(false); // today, not future
    expect(validateForecast("x", 50, "2020-01-01", TODAY).ok).toBe(false);
  });
});
