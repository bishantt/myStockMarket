import { describe, expect, it } from "vitest";

import { compactMoney, decimal, directionOf, multiple, percent, price, signedPercent } from "@/lib/format";

/**
 * Tests for lib/format — the one place numbers become strings (plan §4.3, convention: numbers
 * render only via lib/format and components/BaseRate). Every rule here is a rule a number could
 * otherwise break: grouping, sign, fixed decimals, and the flat band that keeps a rounding wobble
 * from reading as a real move.
 */

describe("price", () => {
  it("groups thousands and keeps two decimals", () => {
    expect(price(17204.1)).toBe("17,204.10");
    expect(price(4.5)).toBe("4.50");
    expect(price(0)).toBe("0.00");
  });
});

describe("signedPercent", () => {
  it("turns a fraction into a signed percent with a leading sign", () => {
    expect(signedPercent(0.0042)).toBe("+0.42%");
    expect(signedPercent(-0.082)).toBe("−8.20%");
  });

  it("shows +0.00% for an exact zero (a real, if boring, fact)", () => {
    expect(signedPercent(0)).toBe("+0.00%");
  });

  it("uses a true minus sign, not a hyphen", () => {
    // The typographic minus (U+2212) aligns with the digits; a hyphen does not.
    expect(signedPercent(-0.01)).toContain("−");
    expect(signedPercent(-0.01)).not.toContain("-");
  });
});

describe("percent", () => {
  it("renders an unsigned whole percent from a fraction by default", () => {
    expect(percent(0.61)).toBe("61%");
    expect(percent(0.5)).toBe("50%");
  });

  it("honours a decimals argument", () => {
    expect(percent(4.54 / 100, 2)).toBe("4.54%");
  });
});

describe("multiple", () => {
  it("renders relative volume as an ×-suffixed multiple to one decimal", () => {
    expect(multiple(3.14)).toBe("3.1×");
    expect(multiple(1)).toBe("1.0×");
  });
});

describe("directionOf", () => {
  it("classifies up, down, and a flat band around zero", () => {
    expect(directionOf(0.01)).toBe("up");
    expect(directionOf(-0.01)).toBe("down");
    expect(directionOf(0)).toBe("flat");
    // A sub-basis-point wobble is not a move — it reads as flat, not a false up.
    expect(directionOf(0.00001)).toBe("flat");
  });
});

describe("decimal — a plain numeral, for figures that are not money or percentages", () => {
  it("renders an RSI reading to one decimal", () => {
    expect(decimal(71.24)).toBe("71.2");
    expect(decimal(29.0)).toBe("29.0");
  });

  it("groups thousands, so an index count does not run together", () => {
    expect(decimal(22345.67, 0)).toBe("22,346");
  });
});

describe("compactMoney — dollar volume at a glance", () => {
  it("renders billions, millions and thousands with their magnitude", () => {
    expect(compactMoney(3_180_000_000)).toBe("$3.18B");
    expect(compactMoney(540_000_000)).toBe("$540.00M");
    expect(compactMoney(96_000)).toBe("$96.00K");
  });

  it("keeps two decimals rather than rounding to a bare '$3B'", () => {
    // $3.18B and $3.99B are different days. An integer would flatten them into the same cell.
    expect(compactMoney(3_990_000_000)).toBe("$3.99B");
  });
});
