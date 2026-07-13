import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MacroBoard } from "./MacroBoard";
import { copy } from "@/lib/copy";
import { buildMacroBoard, type MacroStatRow } from "@/lib/macro-board";

/**
 * MacroBoard — the rendering half of rulings C7 and C8.
 *
 * lib/macro-board.test.ts proves the STATE MACHINE is right: which cell is stale, which is missing,
 * which source answered. This file proves the SURFACE tells the reader about it — because a
 * perfectly correct state that renders identically to every other state is a state nobody has.
 */

const RUN = new Date("2026-07-13T00:00:00.000Z");

const COMPONENTS = [
  { key: "breadth", label: "Breadth", value: 0.61, window: "% above the 50-day average", percentile: 0.55 },
  { key: "volatility", label: "Volatility (VIX)", value: 15.84, window: "last close", percentile: 0.38 },
  { key: "momentum", label: "Momentum", value: 0.021, window: "vs its 125-session mean", percentile: 0.48 },
  { key: "range", label: "Range position", value: 0.18, window: "near highs minus near lows", percentile: 0.35 },
  { key: "credit", label: "Credit spreads", value: 3.12, window: "HY OAS, last close", percentile: 0.34 },
];

const ROWS: MacroStatRow[] = [
  {
    seriesKey: "mortgage30us",
    asOfDate: new Date("2026-07-09T00:00:00.000Z"),
    value: 6.49,
    prior: 6.43,
    asOfLabel: "wk of Jul 9",
    sourceKey: "fred",
    meta: null,
  },
  {
    seriesKey: "cpi_yoy",
    asOfDate: new Date("2026-05-01T00:00:00.000Z"),
    value: 4.24867,
    prior: 3.81,
    asOfLabel: "May 2026",
    sourceKey: "fred",
    meta: null,
  },
  {
    // A week old on a daily cadence — the amber cell.
    seriesKey: "gold_usd",
    asOfDate: new Date("2026-07-02T00:00:00.000Z"),
    value: 4085.2,
    prior: 4071.9,
    asOfLabel: "Jul 2",
    sourceKey: "goldapi",
    meta: null,
  },
  {
    seriesKey: "usd_npr",
    asOfDate: new Date("2026-07-12T00:00:00.000Z"),
    value: 152.23,
    prior: null,
    asOfLabel: "Jul 12",
    sourceKey: "nrb",
    meta: { buy: 152.23, sell: 152.83 },
  },
  {
    seriesKey: "mood",
    asOfDate: new Date("2026-07-13T00:00:00.000Z"),
    value: 42,
    prior: 47,
    asOfLabel: "Jul 13",
    sourceKey: "computed",
    meta: { score: 42, band: "leaning fearful", components: COMPONENTS },
  },
];

function renderBoard(rows: MacroStatRow[] = ROWS, status: Record<string, unknown> | null = null) {
  return render(<MacroBoard board={buildMacroBoard(rows, status, RUN)} />);
}

describe("the macro board", () => {
  it("shows every cell with the window its own source published for", () => {
    renderBoard();

    // Each figure renders twice — once in the phone shelf, once in the ≥md row — so getAllByText is
    // the honest query, and asserting the count proves neither rendering has quietly lost a cell.
    expect(screen.getAllByText(copy.macroBoard.mortgageLabel)).toHaveLength(2);
    expect(screen.getAllByText("wk of Jul 9")).toHaveLength(2);
    expect(screen.getAllByText("May 2026")).toHaveLength(2);
    expect(screen.getAllByText("6.49%")).toHaveLength(2);

    // FRED publishes 4.24867. The reader gets 4.2%, and the pipeline stores the source's precision.
    expect(screen.getAllByText("4.2%")).toHaveLength(2);
  });

  it("paints the STALE cell amber AND says the word (C7 rung 5)", () => {
    renderBoard();

    const [note] = screen.getAllByText("stale — last Jul 2");
    expect(note).toBeInTheDocument();

    // The colour never carries the meaning alone. A screen-reader user gets the same fact a sighted
    // reader gets — otherwise this app speaks in its calmest voice on one of its worse nights.
    expect(note.className).toContain("text-alert");
  });

  it("does NOT paint the quiet states amber — an app that shouts about everything says nothing", () => {
    // "not yet reported" is an unprovisioned key. "source unreachable tonight" is one failed fetch.
    // Neither is a reason to spend the app's alert voice, which is worth exactly as much as its
    // scarcity.
    renderBoard([], { "macro-gold_usd": "degraded" });

    const [note] = screen.getAllByText(copy.macroBoard.notYetReported);
    expect(note.className).not.toContain("text-alert");
  });

  it("still shows a stale number — staleness is data, not absence", () => {
    renderBoard();
    expect(screen.getAllByText("4,085.20").length).toBeGreaterThan(0);
  });

  it("shows the rupee as a PAIR and carries its qualifier", () => {
    renderBoard();

    // Picking one side would silently answer a question the reader never asked.
    expect(screen.getAllByText("152.23 buy · 152.83 sell")).toHaveLength(2);
    // And we quote no remittance app, so we say the number is not the one they will get.
    expect(screen.getAllByText(copy.macroBoard.nprQualifier)).toHaveLength(2);
    expect(screen.getAllByText(copy.macroBoard.nprSourceNrb)).toHaveLength(2);
  });

  it("renders the fallback's licence attribution ONLY when the fallback is the source showing", () => {
    const fallback = ROWS.map((r) =>
      r.seriesKey === "usd_npr" ? { ...r, sourceKey: "erapi", meta: null } : r,
    );

    renderBoard(fallback);

    const [link] = screen.getAllByRole("link", { name: copy.macroBoard.erApiAttribution });
    expect(link).toHaveAttribute("href", "https://www.exchangerate-api.com");
    // And the label follows the source, mechanically: a market mid-rate is never shown under the
    // central bank's name (C6).
    expect(screen.getAllByText(copy.macroBoard.nprSourceMid)).toHaveLength(2);
    expect(screen.queryByText(copy.macroBoard.nprSourceNrb)).toBeNull();
  });

  it("never shows the gauge's number without its breakdown, and never CNN's name (C8)", () => {
    renderBoard();

    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.macroBoard.moodOwnership).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.macroBoard.moodContext).length).toBeGreaterThan(0);

    // The breakdown itself is in the DOM — every input, with what it measured and where that sits in
    // its own history. This is the whole of C8: a sentiment number the reader can take apart.
    for (const component of COMPONENTS) {
      expect(screen.getAllByText(component.label).length).toBeGreaterThan(0);
      expect(screen.getAllByText(component.window).length).toBeGreaterThan(0);
    }

    // And the arrow is DERIVED, so momentum — at the 48th percentile, below its own median — reads
    // "fearful" here even though the seed once stored it as "greedy".
    expect(screen.getAllByText(/48% · fearful/).length).toBeGreaterThan(0);
  });

  it("with the gauge suppressed, the board says which inputs are missing — and shows no number", () => {
    const withoutMood = ROWS.filter((r) => r.seriesKey !== "mood");

    renderBoard(withoutMood);

    expect(screen.queryByText("42")).toBeNull();
    const [reason] = screen.getAllByText(/Insufficient inputs tonight/);
    expect(reason).toHaveTextContent("breadth");
    expect(reason).toHaveTextContent("credit spreads");
  });

  it("orders the board around the reader's own life first", () => {
    renderBoard();

    const labels = screen
      .getAllByText(/30-yr mortgage|Inflation \(CPI YoY\)|Gold \(oz\)|USD → NPR/)
      .map((el) => el.textContent);

    // The shelf renders first, so the first four are its order: household costs, then market prices.
    expect(labels.slice(0, 4)).toEqual([
      copy.macroBoard.mortgageLabel,
      copy.macroBoard.cpiLabel,
      copy.macroBoard.goldLabel,
      copy.macroBoard.nprLabel,
    ]);
  });
});
