import { describe, expect, it } from "vitest";

import { searchPalette, type PaletteItem } from "./palette";

/**
 * lib/palette.test.ts — the ⌘K palette search (plan §7 P6 step 5).
 *
 * The palette indexes routes, lessons, and tickers, each zone-badged. Search is a simple, predictable
 * substring/prefix rank — no fuzzy surprises — so the reader can trust what they type.
 */

const items: PaletteItem[] = [
  { kind: "route", zone: "Desk", label: "Track record", href: "/track-record" },
  { kind: "lesson", zone: "Academy", label: "Reading a base-rate sentence", href: "/academy/reading-a-base-rate-sentence" },
  { kind: "ticker", zone: "Desk", label: "AAPL", href: "/ticker/AAPL" },
  { kind: "route", zone: "Desk", label: "Paper desk", href: "/paper" },
];

describe("searchPalette", () => {
  it("returns everything (capped) for an empty query", () => {
    expect(searchPalette(items, "").length).toBe(items.length);
  });

  it("matches case-insensitively on the label", () => {
    const results = searchPalette(items, "track");
    expect(results.map((r) => r.label)).toEqual(["Track record"]);
  });

  it("ranks a prefix match above a mid-string match", () => {
    const pool: PaletteItem[] = [
      { kind: "ticker", zone: "Desk", label: "MSFT", href: "/ticker/MSFT" },
      { kind: "route", zone: "Desk", label: "Market pulse", href: "/" },
    ];
    const results = searchPalette(pool, "m");
    // Both start with "m"; stable by original order — but a prefix beats a non-prefix when mixed.
    const withMid: PaletteItem[] = [
      { kind: "ticker", zone: "Desk", label: "AMD", href: "/ticker/AMD" }, // 'm' is mid-string
      { kind: "route", zone: "Desk", label: "Movers", href: "/" }, // 'm' is a prefix
    ];
    expect(searchPalette(withMid, "m")[0].label).toBe("Movers");
    expect(results.length).toBe(2);
  });

  it("finds a ticker by its symbol", () => {
    expect(searchPalette(items, "aapl").map((r) => r.href)).toEqual(["/ticker/AAPL"]);
  });

  it("returns nothing for a query that matches no label", () => {
    expect(searchPalette(items, "zzzz")).toEqual([]);
  });
});
