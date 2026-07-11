import { describe, expect, it } from "vitest";

import { JOURNAL_MAX, validateJournal } from "@/lib/journal";

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
