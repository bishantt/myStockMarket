import { describe, expect, it } from "vitest";

import { buildCalendar, buildMacro, buildMovers, buildSourceStatus, buildWatchlist } from "@/lib/morning";

/**
 * Tests for the pure builders in lib/morning — the row-shape → view-model transforms the Desk
 * loader runs after it reads the database. These cover the maths that turns raw closes and volumes
 * into a day change, a relative volume, and a direction, plus the honest fallbacks when history is
 * thin. The database read itself (getMorning) is exercised by the seeded e2e journey, not here.
 */

describe("buildMacro", () => {
  /**
   * The macro strip is where the product's worst bug lived: it printed the SPY ETF's price under
   * the label "S&P 500", so the Desk's hero numeral read ~755 when the index was near 6,800. The
   * fix is a coupling, and these tests are its lock:
   *
   *     a slot may claim an index name ONLY when its number came from the index series.
   *
   * When the level is missing the slot still renders — as its ETF, labelled as an ETF proxy. There
   * is no third option where an ETF price wears an index's name.
   */
  const ctx = {
    vix: 15.84,
    tenYear: 4.54,
    sp500: 6812.34,
    sp500Prior: 6789.1,
    nasdaqComposite: 22345.67,
    nasdaqCompositePrior: 22280.15,
    djia: 44210.55,
    djiaPrior: 44320.8,
    advancers: 3200,
    decliners: 1800,
    pctAbove50dma: 0.61,
  };
  const closes = {
    SPY: [600, 612],
    QQQ: [500, 505],
    DIA: [440, 435.6],
    IWM: [220, 220],
  };

  it("builds the S&P hero from the true index level and its prior", () => {
    const macro = buildMacro(ctx, closes)!;
    expect(macro.spx).toEqual({
      label: "S&P 500",
      value: "6,812.34",
      deltaPct: "+0.34%",
      direction: "up",
      source: "index",
    });
  });

  it("builds the index row from index levels, and the small-caps slot from its ETF proxy", () => {
    const macro = buildMacro(ctx, closes)!;
    expect(macro.indices).toEqual([
      {
        label: "Nasdaq Composite",
        value: "22,345.67",
        deltaPct: "+0.29%",
        direction: "up",
        source: "index",
      },
      { label: "Dow", value: "44,210.55", deltaPct: "−0.25%", direction: "down", source: "index" },
      // Russell 2000 has no free FRED series, so this slot is honest about being an ETF (E-1).
      {
        label: "Russell 2000 · IWM (ETF proxy)",
        value: "220.00",
        deltaPct: "+0.00%",
        direction: "flat",
        source: "etf-proxy",
        proxySymbol: "IWM",
      },
    ]);
  });

  it("NEVER puts an index name on an ETF price — the label follows the source", () => {
    // The regression lock for the whole bug. With no index levels at all, every slot falls back to
    // its ETF, and every fallback label says so. Nothing claims to be an index that is not one.
    const macro = buildMacro(
      { ...ctx, sp500: null, sp500Prior: null, nasdaqComposite: null, nasdaqCompositePrior: null, djia: null, djiaPrior: null },
      closes,
    )!;
    const slots = [macro.spx, ...macro.indices];
    for (const slot of slots) {
      if (slot.source === "etf-proxy") expect(slot.label).toContain("ETF proxy");
      if (slot.source === "index") expect(slot.label).not.toContain("proxy");
    }
    expect(slots.every((s) => s.source === "etf-proxy")).toBe(true);
  });

  it("labels the Nasdaq proxy as the Nasdaq-100, because QQQ does not track the Composite", () => {
    const macro = buildMacro({ ...ctx, nasdaqComposite: null, nasdaqCompositePrior: null }, closes)!;
    const nasdaq = macro.indices.find((i) => i.proxySymbol === "QQQ")!;
    expect(nasdaq.label).toBe("Nasdaq-100 · QQQ (ETF proxy)");
    expect(nasdaq.value).toBe("505.00"); // QQQ's price, under QQQ's name
  });

  it("falls back per slot, not all-or-nothing", () => {
    const macro = buildMacro({ ...ctx, djia: null, djiaPrior: null }, closes)!;
    expect(macro.spx.source).toBe("index"); // the S&P still has its level
    expect(macro.indices.find((i) => i.proxySymbol === "DIA")!.label).toBe("Dow · DIA (ETF proxy)");
  });

  it("renders — for the change when the prior level is missing, never borrowing the ETF's", () => {
    const macro = buildMacro({ ...ctx, sp500Prior: null }, closes)!;
    expect(macro.spx.value).toBe("6,812.34"); // the level is real, so it prints
    expect(macro.spx.deltaPct).toBe("—"); // the change is not knowable, so it does not
    expect(macro.spx.direction).toBe("flat");
    expect(macro.spx.source).toBe("index");
  });

  it("builds breadth and the FRED context cells", () => {
    const macro = buildMacro(ctx, closes)!;
    expect(macro.breadth).toEqual({ advancers: 3200, decliners: 1800, pctAbove50dma: "61%" });
    expect(macro.vix).toBe("15.84");
    expect(macro.tenYear).toBe("4.54%");
  });

  it("renders — for the FRED cells when FRED was down (null values)", () => {
    const macro = buildMacro({ ...ctx, vix: null, tenYear: null }, closes)!;
    expect(macro.vix).toBe("—");
    expect(macro.tenYear).toBe("—");
  });

  it("returns null when the S&P hero cannot be formed at all (no level, no SPY bars)", () => {
    // The hero is the module's reason to exist; without it the Desk shows the placeholder instead.
    expect(buildMacro({ ...ctx, sp500: null, sp500Prior: null }, { QQQ: [500, 505] })).toBeNull();
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
      { date: new Date("2026-07-15T00:00:00.000Z"), kind: "earnings", symbol: "AAPL", title: "AAPL earnings", consensus: 1.28, prior: 1.4, code: "EARNINGS", importance: "medium" },
      { date: new Date("2026-07-16T00:00:00.000Z"), kind: "macro", symbol: null, title: "Consumer Price Index", consensus: null, prior: null, code: "CPI", importance: "high" },
    ]);
    expect(rows[0]).toMatchObject({ kind: "earnings", symbol: "AAPL", title: "AAPL earnings", consensus: "1.28", prior: "1.40" });
    expect(rows[0].dateLabel).toMatch(/Jul 15/);
    // A macro event has no symbol and no consensus.
    expect(rows[1].symbol).toBeUndefined();
    expect(rows[1].consensus).toBeUndefined();
  });

  it("carries the allowlist's chip code and marks the high-importance rows", () => {
    const rows = buildCalendar([
      { date: new Date("2026-07-14T00:00:00.000Z"), kind: "macro", symbol: null, title: "Consumer Price Index", consensus: null, prior: null, code: "CPI", importance: "high" },
      { date: new Date("2026-07-15T00:00:00.000Z"), kind: "macro", symbol: null, title: "Producer Price Index", consensus: null, prior: null, code: "PPI", importance: "medium" },
    ]);
    expect(rows[0]).toMatchObject({ code: "CPI", high: true });
    expect(rows[1]).toMatchObject({ code: "PPI", high: false });
  });

  it("falls back to the kind for a row written before the allowlist existed", () => {
    // Old rows carry no code. They still render a chip — an empty chip would be worse than a
    // slightly-stale one, and the next nightly run replaces the forward calendar anyway.
    const [row] = buildCalendar([
      { date: new Date("2026-07-15T00:00:00.000Z"), kind: "macro", symbol: null, title: "Something old", consensus: null, prior: null, code: null, importance: null },
    ]);
    expect(row.code).toBe("macro");
    expect(row.high).toBe(false);
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
