// @vitest-environment node
import { describe, expect, it } from "vitest";
// The fixtures are plain ESM (.mjs) so that `node prisma/seed.mjs` runs with no toolchain at all.
import { SCAN_ROWS, UNUSUAL_VOLUME, NEAR_52W_HIGH, GAP_3PLUS, GOLDEN_CROSS_FRESH, RSI_EXTREME, SCAN_INSTRUMENTS } from "./scans.mjs";
import { PAPER_TRADES } from "./paper.mjs";
import { simulateFill } from "@/lib/paper";
import { realizedPnl } from "@/lib/ledger";

/**
 * The seed makes promises that tests all over the suite quietly depend on. This file is where those
 * promises are written down and checked.
 *
 * The reason to check a FIXTURE at all: a seed is data, and data has no compiler. If someone
 * "tidies" the unusual-volume rows and nudges SMCI's return, the Desk's e2e assertions break in a
 * way that looks like a UI bug, and the seeded briefing — whose prose quotes those very numbers —
 * quietly starts lying about the movers it is describing. That failure would be nowhere near its
 * cause. So it is caught here instead, at the source, with the reason attached.
 */

type ScanRow = { presetKey: string; rank: number; symbol: string; metrics: Record<string, number | boolean | null> };
type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  bucket: "large-mid" | "small";
  quantity: number;
  referenceOpen: number;
  fillPrice: number;
  costBps: number;
  status: string;
  exitFillPrice: number | null;
  realizedPnl: number | null;
};

const rows = SCAN_ROWS as ScanRow[];
const uv = UNUSUAL_VOLUME as ScanRow[];
const trades = PAPER_TRADES as Trade[];

describe("the seeded scan matches", () => {
  it("gives every preset the row count the plan's tests are written against", () => {
    expect(uv).toHaveLength(32); // 2 pages at 25/page — the fixture exercises pagination
    expect(NEAR_52W_HIGH).toHaveLength(9);
    expect(GAP_3PLUS).toHaveLength(7);
    expect(GOLDEN_CROSS_FRESH).toHaveLength(4);
    // Deliberately empty. A scan that ran and matched nothing is information, and the empty state
    // cannot be rendered honestly — or pixel-locked — unless it is seeded.
    expect(RSI_EXTREME).toHaveLength(0);
  });

  it("freezes the Desk's top three movers, because the seeded briefing quotes their numbers", () => {
    // lib/morning.ts feeds the movers module from this preset (take: 8, by rank). desk.spec.ts
    // asserts these exact formatted values, and BRIEFING's prose says "rose 18.40%" and "fell 9.20%".
    // Change a number here and the briefing starts describing a market that did not happen.
    expect(uv[0]).toMatchObject({ rank: 1, symbol: "SMCI" });
    expect(uv[0].metrics).toMatchObject({ ret_1: 0.184, rvol20: 4.7 });
    expect(uv[1]).toMatchObject({ rank: 2, symbol: "GME" });
    expect(uv[1].metrics).toMatchObject({ ret_1: -0.092, rvol20: 3.3 });
    expect(uv[2]).toMatchObject({ rank: 3, symbol: "PLTR" });
    expect(uv[2].metrics).toMatchObject({ ret_1: 0.061, rvol20: 2.8 });
  });

  it("keeps every awkward row below the movers' cut of 8, so none can wander onto the Desk", () => {
    const awkward = uv.filter((r) => r.metrics.lottery_flag === true || r.metrics.dollar_volume === null);
    expect(awkward.length).toBeGreaterThanOrEqual(4); // 3 lottery rows + 2 null rows (one is both)
    for (const row of awkward) {
      expect(row.rank, `${row.symbol} is an awkward row and must sit below the movers' cut`).toBeGreaterThanOrEqual(9);
    }
  });

  it("carries real nulls, so null-last sorting has something to sort", () => {
    // The pipeline coerces a NaN to null rather than to zero (DECISIONS 2026-07-11): an unknown is
    // not a zero, and the table must sort it last in BOTH directions rather than to the bottom of
    // an ascending sort and the top of a descending one.
    const nulls = uv.filter((r) => r.metrics.dollar_volume === null);
    expect(nulls).toHaveLength(2);
  });

  it("ranks each preset from 1 with no gaps and no duplicates — rank IS the scan order", () => {
    for (const preset of [...new Set(rows.map((r) => r.presetKey))]) {
      const ranks = rows.filter((r) => r.presetKey === preset).map((r) => r.rank).sort((a, b) => a - b);
      expect(ranks, `${preset} ranks`).toEqual(Array.from({ length: ranks.length }, (_, i) => i + 1));
    }
  });

  it("states each preset's criteria metrics on every one of its rows", () => {
    // A match table's columns restate the filter that produced the match. A row missing the metric
    // its own preset filtered on would render "—" in the column that explains why it is there.
    const required: Record<string, string[]> = {
      "unusual-volume": ["ret_1", "rvol20"],
      "near-52w-high": ["dist_52w_high", "ret_1"],
      "gap-3plus": ["gap_pct", "ret_1"],
      "golden-cross-fresh": ["sma50", "sma200"],
    };
    for (const row of rows) {
      for (const key of required[row.presetKey] ?? []) {
        expect(row.metrics[key], `${row.presetKey}/${row.symbol} must state ${key}`).toBeTypeOf("number");
      }
      expect(row.metrics.close, `${row.symbol} must carry a close`).toBeTypeOf("number");
    }
  });

  it("names every symbol it matches, so no table row renders nameless", () => {
    // The match table joins Instrument for its Name column. A symbol with no instrument row is a
    // blank cell in production and a silently weaker test everywhere else.
    const known = new Set([
      ...SCAN_INSTRUMENTS.map((i: { symbol: string }) => i.symbol),
      // The names the base seed already introduces.
      "SPY", "QQQ", "DIA", "IWM", "AAPL", "NVDA", "MSFT", "SMCI", "GME", "PLTR",
    ]);
    for (const row of rows) {
      expect(known.has(row.symbol), `${row.symbol} has a scan match but no Instrument row`).toBe(true);
    }
  });
});

describe("the seeded paper ledger", () => {
  it("has three open trades (one of them a short) and three closed ones", () => {
    const open = trades.filter((t) => t.status === "open");
    const closed = trades.filter((t) => t.status === "closed");
    expect(open).toHaveLength(3);
    expect(closed).toHaveLength(3);
    expect(open.some((t) => t.side === "sell")).toBe(true);
  });

  it("prices every fill the way the paper desk itself would", () => {
    // The room exists to make the certain cost of trading visible. A seed whose fills disagreed
    // with lib/paper.ts would be teaching the opposite lesson in the one place the reader looks.
    for (const t of trades) {
      const { fillPrice, costBps } = simulateFill({ side: t.side, nextOpen: t.referenceOpen, bucket: t.bucket });
      expect(t.costBps, `${t.symbol} cost`).toBe(costBps);
      expect(t.fillPrice, `${t.symbol} fill`).toBeCloseTo(fillPrice, 6);
    }
  });

  it("always moves the fill AGAINST the trader", () => {
    for (const t of trades) {
      if (t.side === "buy") expect(t.fillPrice, `${t.symbol} buy fills above the open`).toBeGreaterThan(t.referenceOpen);
      else expect(t.fillPrice, `${t.symbol} sell fills below the open`).toBeLessThan(t.referenceOpen);
    }
  });

  it("stores a realized P&L that agrees with the ledger's own arithmetic", () => {
    for (const t of trades.filter((x) => x.status === "closed")) {
      const computed = realizedPnl({
        ...t,
        exitFillPrice: t.exitFillPrice,
      } as never);
      expect(t.realizedPnl, `${t.symbol} stored P&L`).toBeCloseTo(computed as number, 6);
    }
  });

  it("closes with a mixed book — including a SHORT that profited", () => {
    // The outcome chip renders gain and loss differently, and the sign convention inverts for a
    // short (it profits when the exit is BELOW the fill). A book of winners-only would never catch
    // an inverted short.
    const closed = trades.filter((t) => t.status === "closed");
    expect(closed.some((t) => (t.realizedPnl ?? 0) > 0)).toBe(true);
    expect(closed.some((t) => (t.realizedPnl ?? 0) < 0)).toBe(true);

    const shortWinner = closed.find((t) => t.side === "sell" && (t.realizedPnl ?? 0) > 0);
    expect(shortWinner, "the seed must contain a profitable short").toBeDefined();
    expect(shortWinner!.exitFillPrice!).toBeLessThan(shortWinner!.fillPrice);
  });
});
