// @vitest-environment node
import { describe, expect, it } from "vitest";
// The fixtures are plain ESM (.mjs) so that `node prisma/seed.mjs` runs with no toolchain at all.
import { SCAN_ROWS, UNUSUAL_VOLUME, NEAR_52W_HIGH, GAP_3PLUS, GOLDEN_CROSS_FRESH, RSI_EXTREME, SCAN_INSTRUMENTS } from "./scans.mjs";
import { PAPER_TRADES } from "./paper.mjs";
import { MACRO_STATS } from "./macro.mjs";
import { NEWS_CLUSTERS, CATALYST_LINKS, NEWS_IMAGES, NO_STORY_MOVERS } from "./news.mjs";
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The News & Control plan's seed (NEWS-AND-CONTROL-PLAN Parts 6, 7.10)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type Cluster = {
  id: string;
  headline: string;
  eventType: string;
  sectors: string[];
  themes: string[];
  tickers: string[];
  significance: number;
  sources: number;
  whyItMatters: string | null;
  imageId: string | null;
  verification: { status: string; flags: string[] };
};
type Link = { clusterId: string; symbol: string; ret1: number | null; rvol20: number | null; hasSetupCard: boolean };
type Stat = { seriesKey: string; value: number; asOfLabel: string; sourceKey: string; meta: unknown };

const clusters = NEWS_CLUSTERS as Cluster[];
const links = CATALYST_LINKS as Link[];
const stats = MACRO_STATS as Stat[];

describe("the seeded news night", () => {
  /**
   * THE ONE THAT MATTERS. The Front Page's entire editorial claim is that it is edited by evidence
   * and not by attention — so the day's biggest price move must not be able to buy the top slot.
   *
   * SMCI rose 18.4%, the largest move on the seeded tape. It ranks THIRD. The lead is a Fed
   * statement that moved no single stock at all. If a future change ever lets magnitude float to
   * the top, this test is the thing that says so, and it says so at the fixture rather than three
   * layers up in a rendered feed.
   */
  it("does not let the biggest mover lead the front page (C1)", () => {
    const byRank = [...clusters].sort((a, b) => b.significance - a.significance);

    // The biggest move among clustered tickers, found from the data rather than asserted by name.
    const biggestMove = [...links].sort((a, b) => Math.abs(b.ret1 ?? 0) - Math.abs(a.ret1 ?? 0))[0];
    expect(biggestMove.symbol).toBe("SMCI");
    expect(biggestMove.ret1).toBeCloseTo(0.184, 6);

    const smciRank = byRank.findIndex((c) => c.tickers.includes("SMCI")) + 1;
    expect(smciRank, "the biggest mover must not lead").toBe(3);

    // And the lead is the one that moved nothing.
    expect(byRank[0].id).toBe("nc-fed-hold");
    expect(byRank[0].tickers, "the lead moved no single stock").toHaveLength(0);
  });

  /**
   * Every significance score is RECOMPUTED here from Appendix E's formula, using the same inputs
   * the fixture's own comments state. This is the oracle the pipeline's rank.py (N4) gets checked
   * against: if the formula and the seeded numbers ever drift apart, one of them is wrong, and a
   * feed whose stated ordering rule does not produce its actual order is exactly the dishonesty
   * ruling C1 exists to prevent.
   */
  it("scores every cluster by the stated formula, not by taste (Appendix E)", () => {
    const CLASS_PRIOR: Record<string, number> = {
      ma: 1.0, fda: 1.0, macro: 1.0,
      earnings: 0.8, guidance: 0.8,
      filing: 0.6, legal: 0.6,
      analyst: 0.4,
      product: 0.3,
    };
    // The magnitude term, per cluster: mean over its tickers of min(|ret1| / ATR14%, 3) / 3.
    // ATR14 percentages are the ones the fixture's comments state.
    const ATR14: Record<string, number> = {
      MRNA: 0.040, LLY: 0.018, PFE: 0.015, SMCI: 0.065, AMD: 0.035, NVDA: 0.032,
      JPM: 0.020, TSLA: 0.042, COIN: 0.068, AAPL: 0.022, GME: 0.075, XOM: 0.016,
      LMT: 0.015, MSFT: 0.019, UBER: 0.024,
    };
    // Scope: macro-wide 1.0; ≥3 tickers is sector-wide 0.6; otherwise single-name 0.3.
    const scopeOf = (c: Cluster) =>
      c.eventType === "macro" ? 1.0 : c.tickers.length >= 3 ? 0.6 : 0.3;
    // Recency: the two prior-session clusters decay to 0.5; the rest are same-session.
    const PRIOR_SESSION = new Set(["nc-nvda-guidance"]);
    const recencyOf = (c: Cluster) => (PRIOR_SESSION.has(c.id) ? 0.5 : 1.0);

    for (const c of clusters) {
      const mine = links.filter((l) => l.clusterId === c.id);
      const magnitude =
        mine.length === 0
          ? 0
          : mine.reduce((sum, l) => sum + Math.min(Math.abs(l.ret1 ?? 0) / ATR14[l.symbol], 3) / 3, 0) / mine.length;

      const expected =
        0.30 * scopeOf(c) +
        0.25 * (Math.min(c.sources, 5) / 5) +
        0.20 * magnitude +
        0.15 * CLASS_PRIOR[c.eventType] +
        0.10 * recencyOf(c);

      // Three decimals: the fixture stores the score rounded to what a reader could verify by hand.
      expect(c.significance, `${c.id} significance`).toBeCloseTo(expected, 2);
    }
  });

  it("covers the catalyst types and sectors the later phases filter across (7.10)", () => {
    expect(clusters).toHaveLength(14);
    expect(new Set(clusters.map((c) => c.eventType)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(clusters.flatMap((c) => c.sectors)).size).toBeGreaterThanOrEqual(5);
    // The three named cases the plan requires by name.
    expect(clusters.some((c) => c.eventType === "fda")).toBe(true);
    expect(clusters.some((c) => c.eventType === "ma")).toBe(true);
    expect(clusters.some((c) => c.eventType === "macro" && c.tickers.length === 0)).toBe(true);
    // Both themes render somewhere, so the theme chips have something to filter to.
    const themes = new Set(clusters.flatMap((c) => c.themes));
    expect(themes.has("AI")).toBe(true);
    expect(themes.has("Defense")).toBe(true);
  });

  /**
   * The gate-dropped narrative. When the verification gate cannot trace a sentence's numbers to a
   * source, the sentence is DROPPED — the facts still publish. There is no placeholder and no
   * softened rewrite, because an unverified number may not reach the page (P9). The seed carries
   * exactly one of these so the UI has to handle it.
   */
  it("carries one cluster whose prose the gate dropped, with its facts intact", () => {
    const dropped = clusters.filter((c) => c.verification.status === "dropped");
    expect(dropped).toHaveLength(1);
    expect(dropped[0].id).toBe("nc-jpm-earnings");
    expect(dropped[0].whyItMatters, "the prose is dropped, not softened").toBeNull();
    expect(dropped[0].verification.flags.length).toBeGreaterThan(0);
    // The facts survive: the card still has its extract and its ticker link.
    expect(links.some((l) => l.clusterId === "nc-jpm-earnings")).toBe(true);
  });

  /**
   * Every Date in the seed is a REAL date.
   *
   * This test exists because of a bug it would have caught. The image rows were built with a helper
   * `t("22")` — meant to be 22:00 — which produced the string "2026-07-09T22:00.000Z": no seconds
   * field, and therefore an Invalid Date. Prisma rejected it and the seed died, but only in CI, on
   * the tag, minutes after everything local had gone green. The other fixture tests all passed,
   * because they asserted the INTERESTING fields — the significance scores, the ordering, the blur
   * placeholders — and never looked at a timestamp.
   *
   * A fixture's boring fields are still fields. `new Date("nonsense")` does not throw; it returns an
   * object that looks like a Date and fails only when something finally tries to use it.
   */
  it("has no Invalid Dates hiding in it — every timestamp is a real one", () => {
    const check = (value: unknown, where: string) => {
      if (value instanceof Date) {
        expect(Number.isNaN(value.getTime()), `${where} is an Invalid Date`).toBe(false);
      }
    };
    const walk = (row: Record<string, unknown>, where: string) => {
      for (const [key, value] of Object.entries(row)) check(value, `${where}.${key}`);
    };

    (NEWS_IMAGES as Record<string, unknown>[]).forEach((r, i) => walk(r, `NEWS_IMAGES[${i}]`));
    (NEWS_CLUSTERS as unknown as Record<string, unknown>[]).forEach((r, i) =>
      walk(r, `NEWS_CLUSTERS[${i}]`),
    );
    (MACRO_STATS as unknown as Record<string, unknown>[]).forEach((r, i) =>
      walk(r, `MACRO_STATS[${i}]`),
    );
  });

  it("exercises every rung of the image ladder", () => {
    // L1/L2 — real cached images on three clusters.
    const withImages = clusters.filter((c) => c.imageId !== null);
    expect(withImages).toHaveLength(3);
    expect(NEWS_IMAGES).toHaveLength(3);
    // Every stored image knows its own shape and carries a blur placeholder. This is what makes
    // layout shift zero — a card that knows the picture's dimensions never jumps when it arrives.
    for (const img of NEWS_IMAGES as { width: number; height: number; blurDataUrl: string }[]) {
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
      expect(img.blurDataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    }
    // L3/L4 — the rest have no stored image and fall through to the designed treatments.
    expect(clusters.filter((c) => c.imageId === null).length).toBeGreaterThanOrEqual(10);
  });

  /**
   * The hardest lesson the room teaches, seeded as an absence: three of the Desk's eight movers
   * have no story at all. If someone ever "helpfully" invents catalysts for them, this fails.
   */
  it("leaves the no-catalyst movers without a story, on purpose (C9)", () => {
    const clustered = new Set(links.map((l) => l.symbol));
    for (const symbol of NO_STORY_MOVERS as string[]) {
      expect(clustered.has(symbol), `${symbol} must have NO catalyst — the noise line is the point`).toBe(false);
    }
    expect((NO_STORY_MOVERS as string[]).length).toBeGreaterThanOrEqual(2);
  });

  it("snapshots each ticker's numbers on its link, so the feed and the story cannot disagree", () => {
    for (const l of links) {
      expect(l.ret1, `${l.symbol} needs a snapshotted return`).not.toBeNull();
      expect(l.rvol20, `${l.symbol} needs a snapshotted RVOL`).not.toBeNull();
    }
    // Only SMCI has evidence behind it, so only SMCI offers the setup-card doorway. A doorway to
    // evidence that does not exist is worse than no doorway.
    const withDoorway = links.filter((l) => l.hasSetupCard);
    expect(withDoorway.map((l) => l.symbol)).toEqual(["SMCI"]);
  });
});

describe("the seeded macro board", () => {
  it("seeds all five stats the board renders", () => {
    expect(stats.map((s) => s.seriesKey).sort()).toEqual(
      ["cpi_yoy", "gold_usd", "mood", "mortgage30us", "usd_npr"],
    );
  });

  /**
   * Every cell states the window it covers, because the module masthead's as-of describes the RUN,
   * not the observation — and a Thursday mortgage rate stamped with tonight's date is a lie (C2).
   */
  it("gives every stat its own as-of label, never the run's", () => {
    for (const s of stats) {
      expect(s.asOfLabel, `${s.seriesKey} needs its own window`).toBeTruthy();
    }
    expect(stats.find((s) => s.seriesKey === "mortgage30us")!.asOfLabel).toBe("wk of Jul 9");
    expect(stats.find((s) => s.seriesKey === "cpi_yoy")!.asOfLabel).toBe("Jun 2026");
  });

  /**
   * One cell is deliberately stale. A board that only ever renders its happy path has no test for
   * the day a source goes quiet — and this happens to be gold's honest state until the GoldAPI key
   * is provisioned (P-5).
   */
  it("seeds gold stale, so the amber degraded cell has a source (C7 rung 5)", () => {
    const gold = stats.find((s) => s.seriesKey === "gold_usd")!;
    expect(gold.asOfLabel).toBe("Jul 2"); // a week behind the Jul 9 run date, on a daily cadence
  });

  /**
   * The Mood gauge's number may NEVER render without its component table (C8). Enforcing that in
   * the component is N3's job; making sure the DATA can satisfy it is this test's.
   */
  it("gives the Mood gauge a component breakdown whose percentiles produce its score (C8)", () => {
    const mood = stats.find((s) => s.seriesKey === "mood")!;
    const meta = mood.meta as {
      score: number;
      band: string;
      components: { key: string; percentile: number; window: string }[];
    };
    expect(meta.components.length).toBe(5);
    for (const c of meta.components) {
      expect(c.window, `${c.key} must state its window`).toBeTruthy();
    }
    // The score is the unweighted mean of the component percentiles — worked out by hand in the
    // fixture, recomputed here, so the pipeline's own arithmetic (N3) has something to agree with.
    const mean = meta.components.reduce((sum, c) => sum + c.percentile, 0) / meta.components.length;
    expect(Math.round(mean * 100)).toBe(meta.score);
    expect(meta.score).toBe(42);
    expect(meta.band).toBe("leaning fearful"); // 25–44
  });

  /**
   * THE GUARD THAT WOULD HAVE CAUGHT N0's DRIFT ON THE DAY IT WAS WRITTEN.
   *
   * Each component shows an arrow: which way it is pulling the score. Neutral is a component sitting
   * at its OWN median, so above the 50th percentile it pulls toward greed and below it toward fear.
   *
   * This fixture shipped in N0 with momentum at the 48th percentile — below its own median — carrying
   * the arrow "greedy". Nothing broke. Nothing was checking. It is exactly the shape of failure this
   * build keeps finding: a label that is free to disagree with the data beneath it, and eventually
   * does.
   *
   * Both the pipeline and the app now DERIVE the arrow from the percentile, so the two can never
   * disagree at runtime. This test holds the seed to the same rule, so the stored data cannot quietly
   * carry a contradiction that the renderers are silently correcting.
   */
  it("every component's arrow agrees with its own percentile (the N0 drift, now guarded)", () => {
    const mood = stats.find((s) => s.seriesKey === "mood")!;
    const meta = mood.meta as {
      components: { key: string; percentile: number; contributes: string }[];
    };

    for (const c of meta.components) {
      const expected = c.percentile >= 0.5 ? "greedy" : "fearful";
      expect(c.contributes, `${c.key} sits at the ${Math.round(c.percentile * 100)}th percentile`).toBe(
        expected,
      );
    }
  });
});
