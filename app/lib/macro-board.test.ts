import { describe, expect, it } from "vitest";

import { copy } from "@/lib/copy";
import { buildMacroBoard, isStale, type MacroStatRow } from "@/lib/macro-board";

/**
 * The macro board's degradation ladder (ruling C7) and the gauge's display contract (C8).
 *
 * Every test here is really the same test asked five ways: does this cell tell the truth about how
 * old its number is? A board that looked identical on the night its sources answered and on the
 * night they all went quiet would be the decoration this plan was commissioned to remove.
 */

const RUN = new Date("2026-07-13T00:00:00.000Z"); // a Monday

function row(over: Partial<MacroStatRow> & Pick<MacroStatRow, "seriesKey">): MacroStatRow {
  return {
    asOfDate: new Date("2026-07-09T00:00:00.000Z"),
    value: 1,
    prior: null,
    asOfLabel: "Jul 9",
    sourceKey: "fred",
    meta: null,
    ...over,
  };
}

function cellFor(board: ReturnType<typeof buildMacroBoard>, key: string) {
  return board.cells.find((c) => c.key === key)!;
}

// ── rung 4: nothing stored ────────────────────────────────────────────────────────────────────

describe("C7 rung 4 — a stat that has never reported", () => {
  it("shows an em-dash and says why, rather than a zero or a blank", () => {
    const board = buildMacroBoard([], null, RUN);
    const gold = cellFor(board, "gold_usd");

    expect(gold.value).toBe("—");
    expect(gold.state).toBe("missing");
    expect(gold.note).toBe(copy.macroBoard.notYetReported);
  });

  it("is what gold honestly says in production today, because its key is not provisioned", () => {
    // P-5 (the GoldAPI key) does not exist. The cell has no source, so it has no number — and it
    // renders that fact instead of borrowing one from a provider whose provenance nobody checked.
    const board = buildMacroBoard([], { "macro-gold_usd": "degraded" }, RUN);

    expect(cellFor(board, "gold_usd").value).toBe("—");
  });
});

// ── rung 2: mid-cycle. The label IS the honesty ───────────────────────────────────────────────

describe("C7 rung 2 — a source that has published nothing new, and is not stale for it", () => {
  it("a Thursday mortgage rate read on a Monday is current, not stale", () => {
    // THE CASE THE WHOLE CADENCE RULE EXISTS FOR. Freddie Mac publishes weekly, on a Thursday. On
    // Monday that Thursday rate is not out of date — it is the newest rate that EXISTS. A cell that
    // went amber here would be crying wolf four days out of five.
    const board = buildMacroBoard(
      [row({ seriesKey: "mortgage30us", value: 6.49, prior: 6.43, asOfLabel: "wk of Jul 9" })],
      null,
      RUN,
    );
    const cell = cellFor(board, "mortgage30us");

    expect(cell.state).toBe("ok");
    expect(cell.note).toBeUndefined();
    expect(cell.asOf).toBe("wk of Jul 9");
    expect(cell.value).toBe("6.49%");
  });

  it("a CPI print six weeks old is current, because that is how CPI works", () => {
    // June's CPI is published in mid-July. On any day before that, the newest CPI in existence is
    // May's — and May's print, in mid-July, is six weeks old and perfectly healthy. A stale rule
    // that counted days would paint the CPI cell amber for most of every month, forever.
    const may = row({
      seriesKey: "cpi_yoy",
      asOfDate: new Date("2026-05-01T00:00:00.000Z"),
      value: 4.24867,
      asOfLabel: "May 2026",
    });

    const cell = cellFor(buildMacroBoard([may], null, RUN), "cpi_yoy");

    expect(cell.state).toBe("ok");
    expect(cell.asOf).toBe("May 2026");
    expect(cell.value).toBe("4.2%"); // FRED publishes 4.24867; the reader wants 4.2%
  });

  it("the CPI cell carries no delta chip — a delta of a rate is the easiest number here to misread", () => {
    // "-0.4 vs prior month" beside an inflation rate reads to almost everyone as "prices fell", when
    // what fell is the RATE at which they rose. The month label is the context this number needs.
    const cell = cellFor(
      buildMacroBoard([row({ seriesKey: "cpi_yoy", value: 4.2, prior: 3.8, asOfLabel: "May 2026" })], null, RUN),
      "cpi_yoy",
    );

    expect(cell.delta).toBeUndefined();
  });
});

// ── rung 3: the source failed tonight ─────────────────────────────────────────────────────────

describe("C7 rung 3 — the source was unreachable tonight", () => {
  it("keeps the stored value and says the source could not be reached", () => {
    const board = buildMacroBoard(
      [row({
        seriesKey: "usd_npr",
        // Yesterday's rate: current by NRB's own daily clock, so the only thing wrong tonight is
        // that the fetch failed. That is exactly the state this rung describes.
        asOfDate: new Date("2026-07-12T00:00:00.000Z"),
        value: 152.23,
        sourceKey: "nrb",
        meta: { buy: 152.23, sell: 152.83 },
      })],
      { "macro-usd_npr": "degraded" },
      RUN,
    );
    const cell = cellFor(board, "usd_npr");

    expect(cell.value).toBe("152.23 buy · 152.83 sell");
    expect(cell.note).toBe(copy.macroBoard.sourceUnreachable);
    expect(cell.state).toBe("ok"); // the NUMBER is fine; the FETCH is what failed, and they differ
  });
});

// ── rung 5: old enough to mislead. The amber cell ─────────────────────────────────────────────

describe("C7 rung 5 — stale, and the cell says the word", () => {
  it("gold a week old goes amber and names the date it is stuck on", () => {
    const stale = row({
      seriesKey: "gold_usd",
      asOfDate: new Date("2026-07-02T00:00:00.000Z"),
      value: 4085.2,
      asOfLabel: "Jul 2",
      sourceKey: "goldapi",
    });

    const cell = cellFor(buildMacroBoard([stale], null, RUN), "gold_usd");

    expect(cell.state).toBe("stale");
    expect(cell.note).toBe("stale — last Jul 2");
    expect(cell.value).toBe("4,085.20"); // the number still shows. Staleness is data, not absence.
  });

  it("the WORD carries the meaning, so the amber is never alone in saying it", () => {
    // A colour that is the only bearer of a fact is a fact a screen-reader user never receives — and
    // it would be this app's calmest voice on one of its worse nights.
    const stale = row({ seriesKey: "gold_usd", asOfDate: new Date("2026-06-01T00:00:00.000Z"), asOfLabel: "Jun 1" });

    expect(cellFor(buildMacroBoard([stale], null, RUN), "gold_usd").note).toContain("stale");
  });
});

// ── age is counted in the unit the source publishes in ────────────────────────────────────────

describe("staleness is measured on the source's own clock, not the calendar's", () => {
  it("Friday's gold price, read on Monday, is not stale — the market was shut", () => {
    // THE MONDAY-MORNING TRAP. Three calendar days have passed and ZERO sessions have. If this cell
    // counted days it would go amber every single Monday, and a lamp that cries wolf every Monday is
    // a lamp nobody looks at on the morning it is finally telling the truth. (This is the same
    // lesson freshness.ts learned in N2, and it is why both now share one session counter.)
    const friday = new Date("2026-07-10T00:00:00.000Z");
    const monday = new Date("2026-07-13T00:00:00.000Z");

    expect(isStale("gold_usd", friday, monday)).toBe(false);
  });

  it("but the rupee IS measured in calendar days, because NRB publishes on all of them", () => {
    // Nepal Rastra Bank posts a rate every calendar day, weekends included — so for this one cell a
    // weekend genuinely IS three days of missing publications. Same ladder, different clock, because
    // the sources keep different clocks.
    const friday = new Date("2026-07-03T00:00:00.000Z");
    const monday = new Date("2026-07-13T00:00:00.000Z");

    expect(isStale("usd_npr", friday, monday)).toBe(true);
  });

  it("gold does eventually go stale — the session rule is not a blanket amnesty", () => {
    // The negative control for the test above. If sessions-not-days had been implemented as
    // "never stale", the Monday test would still pass and the guard would be worthless.
    const longAgo = new Date("2026-07-01T00:00:00.000Z");

    expect(isStale("gold_usd", longAgo, RUN)).toBe(true);
  });
});

// ── the rupee names its source, because the two sources measure different things ───────────────

describe("C6 — the rupee's label follows whichever source actually answered", () => {
  it("the central bank's reference is named as the central bank's", () => {
    const cell = cellFor(
      buildMacroBoard([row({ seriesKey: "usd_npr", value: 152.23, sourceKey: "nrb", meta: { buy: 152.23, sell: 152.83 } })], null, RUN),
      "usd_npr",
    );

    expect(cell.provenance).toBe(copy.macroBoard.nprSourceNrb);
    expect(cell.attribution).toBeUndefined();
    expect(cell.qualifier).toBe(copy.macroBoard.nprQualifier);
  });

  it("the mid-market fallback is named as a mid-market rate, and carries its licence attribution", () => {
    // The two sources measure DIFFERENT THINGS — an official reference and a market mid — so they
    // are never silently swapped. And the fallback's free tier REQUIRES a visible attribution link,
    // which renders only when the fallback is the one showing, because that is the only time it is
    // a true statement about where this number came from.
    const cell = cellFor(
      buildMacroBoard([row({ seriesKey: "usd_npr", value: 152.05, sourceKey: "erapi", meta: null })], null, RUN),
      "usd_npr",
    );

    expect(cell.provenance).toBe(copy.macroBoard.nprSourceMid);
    expect(cell.attribution?.text).toBe(copy.macroBoard.erApiAttribution);
    expect(cell.value).toBe("152.05"); // a mid-rate has no sides, and does not invent a spread
  });
});

// ── C8: the gauge shows its work, or it does not show ─────────────────────────────────────────

describe("C8 — the Mood gauge renders with its breakdown or not at all", () => {
  const components = [
    { key: "breadth", label: "Breadth", value: 0.61, window: "% above the 50-day average", percentile: 0.55 },
    { key: "volatility", label: "Volatility (VIX)", value: 15.84, window: "last close", percentile: 0.38 },
    { key: "momentum", label: "Momentum", value: 0.021, window: "vs its 125-session mean", percentile: 0.48 },
    { key: "range", label: "Range position", value: 0.18, window: "near highs minus near lows", percentile: 0.35 },
    { key: "credit", label: "Credit spreads", value: 3.12, window: "HY OAS, last close", percentile: 0.34 },
  ];

  const gauge = row({
    seriesKey: "mood",
    value: 42,
    sourceKey: "computed",
    meta: { score: 42, band: "leaning fearful", components },
  });

  it("carries the score, its band word, and every component", () => {
    const mood = buildMacroBoard([gauge], null, RUN).mood;

    expect("score" in mood).toBe(true);
    if (!("score" in mood)) return;

    expect(mood.score).toBe(42);
    expect(mood.band).toBe("leaning fearful");
    expect(mood.components).toHaveLength(5);
  });

  it("derives each arrow from its percentile, so the two can never disagree", () => {
    // The N0 seed had ALREADY drifted here: momentum sat at the 48th percentile — below its own
    // median — and was stored with the arrow "greedy". A label free to contradict the number beside
    // it eventually does. So the arrow is computed from the percentile at render time, and a stored
    // one cannot reach the screen.
    const mood = buildMacroBoard([gauge], null, RUN).mood;
    if (!("score" in mood)) throw new Error("expected a gauge");

    const momentum = mood.components.find((c) => c.key === "momentum")!;
    expect(momentum.percentile).toBe("48%");
    expect(momentum.contributes).toBe("fearful");

    const breadth = mood.components.find((c) => c.key === "breadth")!;
    expect(breadth.contributes).toBe("greedy");
  });

  it("a gauge row with no breakdown does not render a number — it renders an absence", () => {
    // THE HEART OF C8. A sentiment number you cannot take apart is a number you have to trust, and
    // this app does not ask for trust. If the breakdown is gone, so is the score.
    const naked = row({ seriesKey: "mood", value: 42, sourceKey: "computed", meta: { score: 42, band: "mixed" } });

    const mood = buildMacroBoard([naked], null, RUN).mood;

    expect("score" in mood).toBe(false);
    if ("score" in mood) return;
    expect(mood.cell.value).toBe("—");
  });

  it("names which inputs are missing rather than just reporting a count", () => {
    const thin = row({
      seriesKey: "mood",
      value: 50,
      meta: { score: 50, band: "mixed", components: components.slice(0, 2) },
    });

    const mood = buildMacroBoard([thin], null, RUN).mood;
    if ("score" in mood) throw new Error("expected the gauge to be unavailable");

    expect(mood.reason).toContain("momentum");
    expect(mood.reason).toContain("range position");
    expect(mood.reason).toContain("credit spreads");
  });

  it("with no gauge stored at all, it says so", () => {
    const mood = buildMacroBoard([], null, RUN).mood;

    expect("score" in mood).toBe(false);
    if ("score" in mood) return;
    expect(mood.cell.state).toBe("missing");
  });
});

// ── the board's reading order ─────────────────────────────────────────────────────────────────

describe("the board's order", () => {
  it("puts the reader's own life before the market's prices", () => {
    // Household costs first — what a mortgage costs, what prices did — then gold and the rupee. The
    // hero above this board already states the equity tape; what it cannot tell anyone is what their
    // money is doing.
    const board = buildMacroBoard([], null, RUN);

    expect(board.cells.map((c) => c.key)).toEqual([
      "mortgage30us",
      "cpi_yoy",
      "gold_usd",
      "usd_npr",
    ]);
  });
});
