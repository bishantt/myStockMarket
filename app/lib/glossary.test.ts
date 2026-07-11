import { describe, expect, it } from "vitest";

import { GLOSSARY, GLOSSARY_KEYS, createGlossaryRegistry, lookupTerm } from "./glossary";

/**
 * lib/glossary.test.ts — the glossary data contract and the first-occurrence-per-view registry
 * (plan §7 P5 step 3, Appendix I). Two things are proven here: the seed covers all 40 Appendix I
 * terms with real definitions, and the registry marks a term as "show a popover" only the first time
 * it is seen in a single view (so the Desk never dots the same term twice).
 */

// The 40 Appendix I terms, as their canonical kebab keys — the contractual seed list.
const APPENDIX_I_KEYS = [
  "ticker",
  "bid-ask-spread",
  "market-order",
  "limit-order",
  "pre-market",
  "after-hours",
  "gap",
  "rvol",
  "breadth",
  "advance-decline",
  "50-day-average",
  "200-day-average",
  "golden-cross",
  "rsi",
  "macd",
  "atr",
  "bollinger-bands",
  "52-week-high",
  "base-rate",
  "reference-class",
  "confidence-interval",
  "wilson-interval",
  "always-up-baseline",
  "tendency-tiers",
  "evidence-grade",
  "folklore",
  "decay-stamp",
  "implied-move",
  "bmo-amc",
  "fomc",
  "cpi",
  "jobs-report",
  "vix",
  "drawdown",
  "expectancy",
  "half-kelly",
  "brier-score",
  "calibration",
  "paper-trading",
  "slippage",
];

describe("glossary seed", () => {
  it("covers all 40 Appendix I terms", () => {
    expect(GLOSSARY_KEYS).toHaveLength(40);
    for (const key of APPENDIX_I_KEYS) {
      expect(GLOSSARY, `missing term: ${key}`).toHaveProperty(key);
    }
  });

  it("gives every term a display label, a short tip, and a full definition", () => {
    for (const key of APPENDIX_I_KEYS) {
      const entry = GLOSSARY[key];
      expect(entry.term.length, `${key} term`).toBeGreaterThan(0);
      expect(entry.short.length, `${key} short`).toBeGreaterThan(0);
      expect(entry.long.length, `${key} long`).toBeGreaterThan(0);
    }
  });

  it("mentions no dollar prices in any definition (the no-price rule)", () => {
    for (const key of APPENDIX_I_KEYS) {
      const entry = GLOSSARY[key];
      expect(`${entry.short} ${entry.long}`, `${key} has a price`).not.toMatch(/\$\d/);
    }
  });

  it("looks a term up by key, and returns null for an unknown key", () => {
    expect(lookupTerm("rvol")?.term).toBe("RVOL");
    expect(lookupTerm("not-a-real-term")).toBeNull();
  });
});

describe("first-occurrence registry", () => {
  it("returns true only the first time a term is seen, false thereafter", () => {
    const registry = createGlossaryRegistry();
    expect(registry.firstOccurrence("gap")).toBe(true);
    expect(registry.firstOccurrence("gap")).toBe(false);
    expect(registry.firstOccurrence("gap")).toBe(false);
  });

  it("tracks each term independently", () => {
    const registry = createGlossaryRegistry();
    expect(registry.firstOccurrence("rsi")).toBe(true);
    expect(registry.firstOccurrence("vix")).toBe(true);
    expect(registry.firstOccurrence("rsi")).toBe(false);
    expect(registry.firstOccurrence("vix")).toBe(false);
  });

  it("starts fresh for a new view (new registry instance)", () => {
    const first = createGlossaryRegistry();
    first.firstOccurrence("breadth");
    const second = createGlossaryRegistry();
    expect(second.firstOccurrence("breadth")).toBe(true);
  });
});
