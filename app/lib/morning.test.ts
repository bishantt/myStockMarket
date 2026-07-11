import { describe, expect, it } from "vitest";

import { buildCalendar, buildMacro, buildMovers, buildSourceStatus, buildWatchlist } from "@/lib/morning";

/**
 * Tests for the pure builders in lib/morning — the row-shape → view-model transforms the Desk
 * loader runs after it reads the database. These cover the maths that turns raw closes and volumes
 * into a day change, a relative volume, and a direction, plus the honest fallbacks when history is
 * thin. The database read itself (getMorning) is exercised by the seeded e2e journey, not here.
 */

describe("buildMacro", () => {
  const ctx = { vix: 15.84, tenYear: 4.54, advancers: 3200, decliners: 1800, pctAbove50dma: 0.61 };
  const closes = {
    SPY: [600, 612],
    QQQ: [500, 505],
    DIA: [440, 435.6],
    IWM: [220, 220],
  };

  it("builds the S&P hero, the index row, breadth, and the FRED cells", () => {
    const macro = buildMacro(ctx, closes)!;
    expect(macro.spx).toEqual({ value: "612.00", deltaPct: "+2.00%", direction: "up" });
    expect(macro.indices).toEqual([
      { label: "Nasdaq", value: "505.00", deltaPct: "+1.00%", direction: "up" },
      { label: "Dow", value: "435.60", deltaPct: "−1.00%", direction: "down" },
      { label: "Russell 2000", value: "220.00", deltaPct: "+0.00%", direction: "flat" },
    ]);
    expect(macro.breadth).toEqual({ advancers: 3200, decliners: 1800, pctAbove50dma: "61%" });
    expect(macro.vix).toBe("15.84");
    expect(macro.tenYear).toBe("4.54%");
  });

  it("renders — for the FRED cells when FRED was down (null values)", () => {
    const macro = buildMacro({ ...ctx, vix: null, tenYear: null }, closes)!;
    expect(macro.vix).toBe("—");
    expect(macro.tenYear).toBe("—");
  });

  it("returns null when the S&P hero cannot be formed (no SPY bars)", () => {
    // The hero is the module's reason to exist; without it the Desk shows the placeholder instead.
    expect(buildMacro(ctx, { QQQ: [500, 505] })).toBeNull();
  });

  it("returns null when there is no macro context row at all", () => {
    expect(buildMacro(null, closes)).toBeNull();
  });
});

describe("buildMovers", () => {
  it("formats change and relative volume, ranked as given, carrying the catalyst", () => {
    const catalyst = { type: "earnings", headline: "GameStop beats", source: "reuters.com", url: "https://reuters.com/1" };
    const movers = buildMovers([
      { symbol: "GME", name: "GameStop", changeFraction: 0.082, rvol: 3.1, catalyst },
      { symbol: "AMC", name: "AMC Entertainment", changeFraction: -0.045, rvol: 2.6 },
    ]);
    expect(movers[0]).toEqual({
      symbol: "GME",
      name: "GameStop",
      changePct: "+8.20%",
      direction: "up",
      rvol: "3.1×",
      catalyst,
    });
    expect(movers[1].changePct).toBe("−4.50%");
    expect(movers[1].direction).toBe("down");
  });

  it("leaves catalyst undefined when a mover has no matched news (the noise line renders)", () => {
    const [mover] = buildMovers([{ symbol: "XYZ", name: "Xyz", changeFraction: 0.09, rvol: 1.1 }]);
    expect(mover.catalyst).toBeUndefined();
  });
});

describe("buildWatchlist", () => {
  it("computes the day change from the last two closes and RVOL from volumes", () => {
    const rows = buildWatchlist([
      {
        symbol: "AAPL",
        name: "Apple",
        reason: "earnings next week",
        isFocus: true,
        closes: [100, 101, 102, 108],
        volumes: [10, 10, 10, 30], // latest 30 vs the 10-average of the prior three
      },
    ]);
    expect(rows[0].changePct).toBe("+5.88%"); // 108 from 102
    expect(rows[0].direction).toBe("up");
    expect(rows[0].rvol).toBe("3.0×");
    expect(rows[0].isFocus).toBe(true);
    expect(rows[0].spark).toEqual([100, 101, 102, 108]);
  });

  it("shows — for RVOL when there is no prior volume to compare against", () => {
    const [row] = buildWatchlist([
      { symbol: "NEW", name: "Newly Added", reason: "just added", isFocus: false, closes: [50], volumes: [10] },
    ]);
    expect(row.rvol).toBe("—");
    expect(row.changePct).toBe("+0.00%"); // a single close has no move
    expect(row.direction).toBe("flat");
  });
});

describe("buildCalendar", () => {
  it("formats event dates in ET and the consensus/prior figures", () => {
    const rows = buildCalendar([
      { date: new Date("2026-07-15T00:00:00.000Z"), kind: "earnings", symbol: "AAPL", title: "Apple Q3", consensus: 1.28, prior: 1.4 },
      { date: new Date("2026-07-16T00:00:00.000Z"), kind: "macro", symbol: null, title: "CPI", consensus: null, prior: null },
    ]);
    expect(rows[0]).toMatchObject({ kind: "earnings", symbol: "AAPL", title: "Apple Q3", consensus: "1.28", prior: "1.40" });
    expect(rows[0].dateLabel).toMatch(/Jul 15/);
    // A macro event has no symbol and no consensus.
    expect(rows[1].symbol).toBeUndefined();
    expect(rows[1].consensus).toBeUndefined();
  });
});

describe("buildSourceStatus", () => {
  it("orders known providers and reports each status", () => {
    const rows = buildSourceStatus({ fred: "ok", alpaca: "ok", finnhub: "degraded" });
    expect(rows.map((r) => r.name)).toEqual(["alpaca", "finnhub", "fred"]);
    expect(rows.find((r) => r.name === "finnhub")?.status).toBe("degraded");
  });

  it("returns an empty list when there is no run", () => {
    expect(buildSourceStatus(null)).toEqual([]);
  });
});
