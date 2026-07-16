import { describe, expect, it } from "vitest";

import { buildCalendar, buildMacro, buildMorningPlanCalendar, buildMovers, buildScanBreakdown, buildSourceStatus, buildWatchlist, calendarFloor, isLiquidFloorEligible, type MorningEventSource } from "@/lib/morning";
import { SCAN_PRESETS } from "@/lib/scan-presets";

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
  /** The seeded run date — a Thursday, so breadth's window has a weekday to name. */
  const RUN_DATE = new Date("2026-07-09T00:00:00Z");
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

  it("builds the index row from index levels, and the small-caps slot from its ETF", () => {
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
      // The small-caps slot. It is NOT called "Russell 2000": FRED deleted every free Russell series
      // in 2019 and no licensable substitute exists, so this row can never carry that index's level.
      // Naming an index we are structurally unable to measure would be a promise the row cannot
      // keep, so it names the GROUP the number describes and lets the chip say what the number is.
      {
        label: "Small caps",
        value: "220.00",
        deltaPct: "+0.00%",
        direction: "flat",
        source: "etf-proxy",
        proxySymbol: "IWM",
        proxyChip: "IWM · ETF price",
      },
    ]);
  });

  /**
   * THE COUPLING, RESTATED FOR THE NEW GRAMMAR — and it is exactly as strong as before.
   *
   * The founding rule of this module is that a reader must never mistake an ETF's price for an
   * index's level. The OLD grammar enforced it by putting "(ETF proxy)" in the label, and then
   * saying "ETF proxy" a second time in a chip beneath it. Two belts, the same words twice, and it
   * read as noise on screen.
   *
   * The new grammar moves the mark into ONE chip — and the chip now does MORE work than the label
   * suffix ever did. On a degraded index slot, where an index's name and an ETF's price share a row,
   * the chip does not merely flag the fallback; it negates the misreading in words:
   * "SPY · ETF price — not the index level".
   *
   * So the machine-enforced coupling becomes: an ETF-sourced slot must ALWAYS carry a chip, and if
   * its label still names an index, that chip must explicitly deny the index reading. A slot that
   * ever renders an ETF price with no chip at all is the original bug, and this test is what stands
   * between the codebase and it.
   */
  it("NEVER lets an ETF price pass as an index level — every proxy slot carries its chip", () => {
    const macro = buildMacro(
      { ...ctx, sp500: null, sp500Prior: null, nasdaqComposite: null, nasdaqCompositePrior: null, djia: null, djiaPrior: null },
      closes,
    )!;
    const slots = [macro.spx, ...macro.indices];
    expect(slots.every((s) => s.source === "etf-proxy")).toBe(true);

    const INDEX_NAMES = ["S&P 500", "Nasdaq Composite", "Dow"];
    for (const slot of slots) {
      // Rule 1: an ETF-sourced slot ALWAYS carries a chip. No silent fallbacks, ever.
      expect(slot.proxyChip, `${slot.label} must carry a proxy chip`).toBeTruthy();
      expect(slot.proxyChip).toContain("ETF price");

      // Rule 2: if the label still names an index, the chip must DENY the index reading outright —
      // in words, not by implication. The generic denial is "not the index level"; the Nasdaq's is
      // sharper still ("not the Composite"), because QQQ tracks a different index rather than merely
      // approximating the same one. Either way the chip contains an explicit "not the ...".
      if (INDEX_NAMES.includes(slot.label)) {
        expect(
          slot.proxyChip,
          `${slot.label} shows an ETF price and must negate the index reading in words`,
        ).toMatch(/not the (index level|Composite)/);
      }
    }

    // Rule 3: an index-sourced slot never carries a proxy chip.
    const live = buildMacro(ctx, closes)!;
    expect(live.spx.proxyChip).toBeUndefined();
  });

  it("says QQQ tracks the Nasdaq-100, not the Composite — the mismatch is stated, never blurred", () => {
    const macro = buildMacro({ ...ctx, nasdaqComposite: null, nasdaqCompositePrior: null }, closes)!;
    const nasdaq = macro.indices.find((i) => i.proxySymbol === "QQQ")!;
    expect(nasdaq.value).toBe("505.00"); // QQQ's price
    // QQQ holds 100 names; the Composite holds thousands. They are different indexes, and the chip
    // refuses to let one stand in silently for the other.
    expect(nasdaq.proxyChip).toBe("QQQ · Nasdaq-100 ETF price — not the Composite");
  });

  it("falls back per slot, not all-or-nothing", () => {
    const macro = buildMacro({ ...ctx, djia: null, djiaPrior: null }, closes)!;
    expect(macro.spx.source).toBe("index"); // the S&P still has its level
    const dow = macro.indices.find((i) => i.proxySymbol === "DIA")!;
    expect(dow.source).toBe("etf-proxy");
    expect(dow.proxyChip).toBe("DIA · ETF price — not the index level");
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
    expect(macro.breadth).toEqual({
      advancers: 3200,
      decliners: 1800,
      pctAbove50dma: "61%",
      // Breadth's window (C2). With no run date given the builder says "at the close" rather than
      // naming a weekday it cannot know — it never invents the day.
      asOf: "at the close",
    });
    expect(macro.vix).toBe("15.84");
    expect(macro.tenYear).toBe("4.54%");
  });

  // ── the provenance line is COMPOSED, never recited (ruling C6) ─────────────────────────────
  //
  // THE DEFECT THIS REPLACES, verbatim from the user's production screenshot of 2026-07-12: the
  // Desk showed four ETF prices, and underneath them a fixed line reading "Index levels · FRED ·
  // prior close". The sentence was written for the happy path and rendered regardless of what the
  // rows above it actually showed. A provenance line that can disagree with its own surface is
  // worse than no provenance line at all — it converts a visible gap into an invisible lie.

  it("names the live index sources when every level is real", () => {
    const macro = buildMacro(ctx, closes, RUN_DATE)!;
    expect(macro.provenance).toBe(
      "S&P 500, Nasdaq Composite, Dow: FRED, prior close · Small caps: IWM ETF close · " +
        "VIX: Cboe via FRED · 10-yr: US Treasury via FRED",
    );
  });

  it("names WHICH slot fell back, when only some did", () => {
    const macro = buildMacro({ ...ctx, nasdaqComposite: null, nasdaqCompositePrior: null }, closes, RUN_DATE)!;
    expect(macro.provenance).toContain("S&P 500, Dow: FRED, prior close");
    expect(macro.provenance).toContain("Nasdaq Composite: QQQ ETF close (index level unavailable)");
  });

  it("says the index levels are unavailable OUTRIGHT when they all failed", () => {
    // The screenshot state. The old footer claimed FRED index levels here. The new one opens by
    // saying they are missing — because an absence a reader has to infer from four small chips is
    // an absence most readers will simply not notice.
    const macro = buildMacro(
      { ...ctx, sp500: null, sp500Prior: null, nasdaqComposite: null, nasdaqCompositePrior: null, djia: null, djiaPrior: null },
      closes,
      RUN_DATE,
    )!;
    expect(macro.provenance).toContain("Index levels unavailable tonight");
    expect(macro.provenance).not.toContain("FRED, prior close");
  });

  it("changes when the rows change — the property that proves it is not a static string", () => {
    const live = buildMacro(ctx, closes, RUN_DATE)!;
    const degraded = buildMacro({ ...ctx, djia: null, djiaPrior: null }, closes, RUN_DATE)!;
    const noFred = buildMacro({ ...ctx, vix: null, tenYear: null }, closes, RUN_DATE)!;

    expect(live.provenance).not.toBe(degraded.provenance);
    expect(live.provenance).not.toBe(noFred.provenance);
    // A source that did not render is never claimed.
    expect(noFred.provenance).not.toContain("VIX");
    expect(noFred.provenance).not.toContain("10-yr");
  });

  // ── a level can be REAL and OLD at the same time (ruling C7) ───────────────────────────────

  it("dates a carried-forward level instead of collapsing it to an ETF", () => {
    // The pipeline no longer lets a flaky FRED night overwrite a good level with null: it keeps what
    // it has and records the session those levels are really for. So the Desk now has a state it
    // never had before — a true index level that is not tonight's.
    //
    // It prints the level and says how old it is. Throwing away a real index level to avoid printing
    // a date would be discarding the better number for the sake of a tidier row.
    const macro = buildMacro(
      { ...ctx, indexLevelsAsOf: new Date("2026-07-09T00:00:00Z") },
      closes,
      new Date("2026-07-10T00:00:00Z"),
    )!;
    expect(macro.spx.source).toBe("index");
    expect(macro.spx.value).toBe("6,812.34");
    expect(macro.spx.staleAsOf).toBe("as of Thu, Jul 9");
    // And the footer says it too, rather than letting the masthead's as-of speak for a number it
    // does not describe.
    expect(macro.provenance).toContain("FRED, as of Thu, Jul 9");
  });

  it("puts no date on levels that ARE tonight's — a date on every row every night is chrome", () => {
    const macro = buildMacro({ ...ctx, indexLevelsAsOf: RUN_DATE }, closes, RUN_DATE)!;
    expect(macro.spx.staleAsOf).toBeUndefined();
    expect(macro.provenance).toContain("FRED, prior close");
  });

  it("names the weekday in breadth's window when it knows the run date (C2)", () => {
    const macro = buildMacro(ctx, closes, RUN_DATE)!; // 2026-07-09 is a Thursday
    expect(macro.breadth.asOf).toBe("at Thu's close");
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
      emphasizeRvol: true,
      catalyst,
    });
    expect(movers[1].changePct).toBe("−4.50%");
    expect(movers[1].direction).toBe("down");
  });

  it("leaves catalyst undefined when a mover has no matched news (the noise line renders)", () => {
    const [mover] = buildMovers([{ symbol: "XYZ", name: "Xyz", changeFraction: 0.09, rvol: 1.1 }]);
    expect(mover.catalyst).toBeUndefined();
    expect(mover.emphasizeRvol).toBe(false); // 1.1× does not clear the 2× bar
  });

  it("saturates RelVol at the window ceiling — a degenerate 20× reads ≥20×, not a canned 20.0×", () => {
    // rvol20 is bounded by its own window length; a value at the ceiling means a thin/newly-listed
    // name whose prior days had ~no volume. It should say so rather than print a suspicious "20.0×".
    const [capped] = buildMovers([{ symbol: "THIN", name: "Thinly Traded", changeFraction: 0.5, rvol: 20 }]);
    expect(capped.rvol).toBe("≥20×");
    expect(capped.emphasizeRvol).toBe(true);
    // Anything that would round up to 20.0 saturates too; a genuine 19.4× still reads honestly.
    expect(buildMovers([{ symbol: "A", name: "A", changeFraction: 0.1, rvol: 19.97 }])[0].rvol).toBe("≥20×");
    expect(buildMovers([{ symbol: "B", name: "B", changeFraction: 0.1, rvol: 19.4 }])[0].rvol).toBe("19.4×");
  });
});

describe("isLiquidFloorEligible (the Movers liquid floor, CC6/D6)", () => {
  it("keeps a large/mid common stock", () => {
    expect(isLiquidFloorEligible({ symbol: "SMCI", assetClass: "stock", dvBucket: "large_mid" })).toBe(true);
  });

  it("drops anything below the dollar-volume floor, stock or not", () => {
    // The thin structured products and obscure ETFs of the junk parade are small by dollar volume.
    expect(isLiquidFloorEligible({ symbol: "TINY", assetClass: "stock", dvBucket: "small" })).toBe(false);
    expect(isLiquidFloorEligible({ symbol: "OBSC", assetClass: "fund", dvBucket: "small" })).toBe(false);
    // A name we could not size (no bucket yet) is not a big liquid name.
    expect(isLiquidFloorEligible({ symbol: "NEW", assetClass: "stock", dvBucket: null })).toBe(false);
  });

  it("keeps a core index/sector ETF even though it is a fund, but drops every other fund", () => {
    expect(isLiquidFloorEligible({ symbol: "SPY", assetClass: "fund", dvBucket: "large_mid" })).toBe(true);
    expect(isLiquidFloorEligible({ symbol: "XLK", assetClass: "fund", dvBucket: "large_mid" })).toBe(true);
    // A big, liquid, but non-core fund (a leveraged/thematic ETF) is still not a Desk mover.
    expect(isLiquidFloorEligible({ symbol: "TQQQ", assetClass: "fund", dvBucket: "large_mid" })).toBe(false);
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
    // slightly-stale one. What keeps such a row off the Desk is not this function but the floor
    // below: it is only ever asked to format rows the query already agreed to show.
    const [row] = buildCalendar([
      { date: new Date("2026-07-15T00:00:00.000Z"), kind: "macro", symbol: null, title: "Something old", consensus: null, prior: null, code: null, importance: null },
    ]);
    expect(row.code).toBe("macro");
    expect(row.high).toBe(false);
  });
});

describe("calendarFloor", () => {
  // The floor is what stops a row stranded in the past from being rendered — and, because the rows
  // are taken 15-at-a-time in date order, from EVICTING the real forward events behind it. That is
  // how four pre-allowlist rows dated on a Saturday and a Sunday cut the live Desk's calendar from
  // 15 events to 11 for weeks (PD1).

  it("floors the calendar at the edition's session, so a past row can never be shown", () => {
    const edition = new Date("2026-07-13T00:00:00.000Z"); // Monday's edition
    const floor = calendarFloor(edition, new Date("2026-07-14T04:00:00.000Z"));
    expect(floor.toISOString()).toBe("2026-07-13T00:00:00.000Z");

    // The two rows that sat on production: Saturday and Sunday. Both are below the floor.
    expect(new Date("2026-07-11T00:00:00.000Z") >= floor).toBe(false);
    expect(new Date("2026-07-12T00:00:00.000Z") >= floor).toBe(false);
    // An event ON the edition's own day still belongs — the floor is inclusive.
    expect(new Date("2026-07-13T00:00:00.000Z") >= floor).toBe(true);
  });

  it("follows the edition, not the wall clock", () => {
    // It is past midnight, so the CLOCK says the 14th — but the edition on the Desk is still the
    // 13th's, and the calendar must speak from the same day the masthead does. A clock-based floor
    // would hide the edition's own events for a few hours every night.
    const floor = calendarFloor(new Date("2026-07-13T00:00:00.000Z"), new Date("2026-07-14T03:59:00.000Z"));
    expect(floor.toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });

  it("falls back to today when there is no edition at all", () => {
    // An empty database has no session to speak from. Showing nothing beats showing history.
    const floor = calendarFloor(null, new Date("2026-07-14T18:30:00.000Z"));
    expect(floor.toISOString()).toBe("2026-07-14T00:00:00.000Z");
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

  it("skips the nested dawn entry — it is metadata, not a degraded provider (CC8/CC9)", () => {
    // The dawn refresh stamps a `dawn` OBJECT beside the night's provider strings. Left in, the footer
    // printed "dawn [object Object]" and the strip counted it as a second degraded source.
    const rows = buildSourceStatus({
      alpaca: "ok",
      marketaux: "degraded",
      fred: "ok",
      dawn: { ranAt: "2026-07-10T10:31:00Z", sources: { fred: "ok" }, stages: { macro: "ok" } },
    });
    expect(rows.map((r) => r.name)).not.toContain("dawn");
    // Exactly one degraded source — marketaux, not marketaux + a phantom "dawn".
    expect(rows.filter((r) => r.status !== "ok")).toHaveLength(1);
  });

  it("skips the nested janitor entry too — deletion is not a degraded provider (CC10)", () => {
    // publish_janitor stamps a `janitor` OBJECT beside the night's strings, exactly as the dawn does.
    // The same footer bug would print "janitor [object Object]" and inflate the degraded count.
    const rows = buildSourceStatus({
      alpaca: "ok",
      fred: "ok",
      janitor: { ranAt: "2026-07-10T22:40:00Z", news: 214, scans: 1, backupsKept: 8 },
    });
    expect(rows.map((r) => r.name)).not.toContain("janitor");
    expect(rows.filter((r) => r.status !== "ok")).toHaveLength(0);
  });
});

describe("buildScanBreakdown — the Desk's Sectors & Scans module (CC4, D4)", () => {
  it("returns one row per preset in the FIXED SCAN_PRESETS order, never by count", () => {
    // rsi-extreme is last in SCAN_PRESETS; a big count must NOT float it to the front. Ordering the
    // index by how many each filter caught is the cross-preset leaderboard ruling M1 forbids.
    const rows = buildScanBreakdown({ "rsi-extreme": 99, "unusual-volume": 3 });
    expect(rows.map((r) => r.key)).toEqual(SCAN_PRESETS.map((p) => p.key));
  });

  it("shows 0 for a preset that matched nothing — a scan that found nothing still RAN", () => {
    const rows = buildScanBreakdown({});
    expect(rows).toHaveLength(SCAN_PRESETS.length);
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });

  it("carries each preset's label, grade, and folklore flag", () => {
    const rows = buildScanBreakdown({ "gap-3plus": 5 });
    const gap = rows.find((r) => r.key === "gap-3plus");
    expect(gap?.count).toBe(5);
    expect(gap?.folklore).toBe(true);
    expect(gap?.label).toBe("Gap of 3% or more");
    expect(gap?.grade).toBe("folklore");
  });
});

describe("buildMorningPlanCalendar — today's events, bmo-first (CC9)", () => {
  const ev = (over: Partial<MorningEventSource>): MorningEventSource => ({
    code: null,
    kind: "earnings",
    symbol: null,
    title: "",
    timing: null,
    importance: null,
    ...over,
  });

  it("orders before-the-open earnings first, then the day, then after-close, then the untimed", () => {
    const ordered = buildMorningPlanCalendar([
      ev({ code: "EARNINGS", symbol: "AMC", title: "AMC", timing: "amc" }),
      ev({ code: "EARNINGS", symbol: "NONE", title: "NONE", timing: null }),
      ev({ code: "EARNINGS", symbol: "BMO", title: "BMO", timing: "bmo" }),
      ev({ code: "EARNINGS", symbol: "DAY", title: "DAY", timing: "dmh" }),
    ]);
    expect(ordered.map((e) => e.symbol)).toEqual(["BMO", "DAY", "AMC", "NONE"]);
  });

  it("turns each code into prose and passes a macro clock string through", () => {
    const [earnings, macro] = buildMorningPlanCalendar([
      ev({ code: "EARNINGS", symbol: "JNJ", title: "JNJ", timing: "bmo" }),
      ev({ code: "CPI", kind: "macro", title: "CPI", timing: "8:30 AM ET", importance: "high" }),
    ]);
    expect(earnings.timing).toBe("before the open");
    expect(earnings.symbol).toBe("JNJ");
    expect(macro.timing).toBe("8:30 AM ET");
    expect(macro.high).toBe(true);
  });

  it("ranks a morning macro release (8:30 AM) ahead of an after-close earnings, but behind bmo", () => {
    const ordered = buildMorningPlanCalendar([
      ev({ symbol: "AMC", title: "AMC", timing: "amc" }),
      ev({ code: "CPI", kind: "macro", title: "CPI", timing: "8:30 AM ET" }),
      ev({ symbol: "BMO", title: "BMO", timing: "bmo" }),
    ]);
    expect(ordered.map((e) => e.title)).toEqual(["BMO", "CPI", "AMC"]);
  });

  it("falls back to the kind when the allowlist assigned no code", () => {
    const [row] = buildMorningPlanCalendar([ev({ code: null, kind: "earnings", symbol: "X", title: "X" })]);
    expect(row.code).toBe("earnings");
  });
});
