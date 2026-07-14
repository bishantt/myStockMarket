import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DataTable } from "./DataTable";
import type { Column } from "@/lib/table";

/**
 * The house table's contract.
 *
 * The interesting assertions are the honesty ones. A sortable table of market data is one small step
 * from a leaderboard, and the step is taken by accident, not on purpose — so:
 *
 *   · the default order is the PIPELINE'S order, and the header says so in words ("scan order").
 *     A reader must always be able to name the order they are looking at, and always be able to get
 *     back to the honest one (M1).
 *   · nulls render "—" and sort last. An unknown is not a zero (§3.3).
 *   · every number goes through lib/format. The paper desk's `.toFixed()` disease does not enter
 *     the kit.
 *   · the sort is INSTANT. A FLIP-animated re-order is a table full of money figures in motion, and
 *     the file is P2-bearing by construction (M3).
 */

type Row = { symbol: string; name: string; rvol: number | null; ret: number };

const rows: Row[] = [
  { symbol: "SMCI", name: "Super Micro", rvol: 4.7, ret: 0.184 },
  { symbol: "GME", name: "GameStop", rvol: 3.3, ret: -0.092 },
  { symbol: "CHPT", name: "ChargePoint", rvol: null, ret: 0.021 },
];

const columns: Column<Row>[] = [
  { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (r) => r.symbol },
  { key: "name", header: "Name", kind: "text", priority: 2, value: (r) => r.name },
  { key: "ret", header: "1-day move", kind: "signedPercent", window: "1D", priority: 1, value: (r) => r.ret },
  { key: "rvol", header: "RVOL", kind: "multiple", priority: 2, value: (r) => r.rvol },
];

function renderTable(extra: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      defaultSort={{ key: "symbol", dir: "asc", label: "scan order" }}
      rowKey={(r) => r.symbol}
      ariaLabel="Unusual volume matches"
      {...extra}
    />,
  );
}

describe("DataTable", () => {
  it("names the default order in the header, so the reader can always say what they are looking at", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: /Symbol/ })).toHaveTextContent("scan order");
  });

  it("never calls the order 'top', 'best' or 'hottest' (M1 — a table is not a leaderboard)", () => {
    const { container } = renderTable();
    expect(container.textContent).not.toMatch(/\b(top|best|hottest|winners)\b/i);
  });

  it("moves aria-sort onto the column the reader sorted by", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole("button", { name: /RVOL/ }));

    expect(screen.getByRole("columnheader", { name: /RVOL/ })).toHaveAttribute("aria-sort");
    expect(screen.getByRole("columnheader", { name: /Symbol/ })).not.toHaveAttribute("aria-sort");
  });

  it("flips direction when the same header is tapped twice", async () => {
    const user = userEvent.setup();
    renderTable();
    const header = screen.getByRole("button", { name: /RVOL/ });

    await user.click(header);
    const first = screen.getByRole("columnheader", { name: /RVOL/ }).getAttribute("aria-sort");
    await user.click(header);
    const second = screen.getByRole("columnheader", { name: /RVOL/ }).getAttribute("aria-sort");

    expect(first).not.toBe(second);
  });

  it("sorts nulls LAST, whichever way the reader sorts — an unknown is not a zero", async () => {
    const user = userEvent.setup();
    renderTable();
    const header = screen.getByRole("button", { name: /RVOL/ });

    await user.click(header); // descending
    let bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[bodyRows.length - 1]).getByText("CHPT")).toBeVisible();

    await user.click(header); // ascending — CHPT must STILL be last
    bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[bodyRows.length - 1]).getByText("CHPT")).toBeVisible();
  });

  it("renders an unknown value as an em-dash, never as a zero", () => {
    renderTable();
    const chptRow = screen.getAllByRole("row").find((r) => within(r).queryByText("CHPT"));
    expect(within(chptRow!).getByText("—")).toBeVisible();
  });

  it("formats every number through lib/format — no raw toFixed anywhere", () => {
    renderTable();
    // Scoped to the desktop table. BOTH renderings are in the DOM at once — the phone card-rows and
    // the real table — because which one the reader sees is a CSS decision, and jsdom applies no
    // CSS. Scoping is how each rendering gets asserted on its own terms rather than colliding.
    const table = within(screen.getByRole("table"));
    expect(table.getByText("+18.40%")).toBeVisible(); // signedPercent
    expect(table.getByText("−9.20%")).toBeVisible(); // a TRUE minus (U+2212), not a hyphen
    expect(table.getByText("4.7×")).toBeVisible(); // multiple
  });

  it("splits the phone card-rows by priority: the headline line, then the detail line", () => {
    renderTable();
    // The phone rendering is the <ul>, not the <table>. Line 1 is priority-1 columns (symbol + the
    // primary metric); line 2 is priority-2 columns as label:value pairs.
    const cards = screen.getAllByRole("listitem");
    const smci = cards.find((c) => within(c).queryByText("SMCI"))!;
    expect(within(smci).getByText("SMCI")).toBeVisible(); // priority 1
    expect(within(smci).getByText("+18.40%")).toBeVisible(); // priority 1
    expect(within(smci).getByText("Super Micro")).toBeVisible(); // priority 2, with its label
    expect(within(smci).getByText("RVOL")).toBeVisible();
  });

  it("marks delta cells as money, so the P2 ancestor walk can police them", () => {
    const { container } = renderTable();
    expect(container.querySelectorAll("[data-p2]").length).toBeGreaterThan(0);
  });

  /*
   * ── THE WINDOW (PD6) ────────────────────────────────────────────────────────────────────────────
   *
   * A delta with no period attached is a number the reader has to guess the meaning of (ruling C2).
   * The table used to answer that in the COLUMN HEADER and nowhere else — which works on a desktop,
   * where a `<th>` sits above every cell, and fails completely on a phone, where a priority-1 cell is
   * drawn with NO header beside it. Every signed-percent column in the app is priority 1 or 2.
   *
   * So the phone showed "▼ −12.4%" for a column meaning "12.4% below the 52-week high", and a reader
   * would read it as a bad day. Both of these tests would have failed on the tree PD6 inherited.
   */
  it("prints the delta's window on the chip, in BOTH layouts — the header is not on the phone", () => {
    renderTable();
    // Two renderings of the row exist in the DOM at once (the desktop table and the phone card list;
    // CSS hides one). Both must carry the window, because either one may be the one on screen.
    expect(screen.getAllByText("· 1D")).toHaveLength(rows.length * 2);
  });

  it("renders every delta through the kit's ONE chip — the table may not keep a private copy", () => {
    renderTable();
    // The kit chip's signature: two atoms, and a glyph that is hidden from screen readers because the
    // signed value beside it already says the direction out loud. A hand-rolled copy has never once
    // reproduced all three of these at once, which is exactly why five of them drifted.
    const chip = screen.getAllByText("+18.40%")[0].closest("[data-p2]")!;
    expect(chip).toHaveTextContent("· 1D");
    expect(chip.querySelector("[aria-hidden='true']")).toHaveTextContent("▲");
  });

  it("renders a change that rounds to nothing as FLAT — no triangle, no wash, no invented direction", () => {
    // The table's private chip tested `value >= 0`, so a +0.00000% change was painted a green ▲. The
    // kit routes through `directionOf`, which has a flat band. A triangle on an unchanged price is a
    // direction the market did not have.
    render(
      <DataTable
        columns={columns}
        rows={[{ symbol: "FLAT", name: "Flatline", rvol: 1, ret: 0 }]}
        defaultSort={{ key: "symbol", dir: "asc" }}
        rowKey={(r) => r.symbol}
        ariaLabel="flat"
      />,
    );
    const chip = screen.getAllByText("+0.00%")[0].closest("[data-p2]")!;
    expect(chip.querySelector("[aria-hidden='true']")).toBeNull();
    expect(chip.className).not.toMatch(/bg-(up|down)-wash/);
  });

  it("carries NO transition or animation anywhere — a sorted row is a money figure in motion (M3)", () => {
    // The movers row survives the ancestor walk today only because its delta chips are unmarked.
    // This kit marks them, and therefore cannot copy the movers' hover classes. That is the point.
    const { container } = renderTable();
    expect(container.querySelector("[class*='transition-']")).toBeNull();
    expect(container.querySelector("[class*='duration-']")).toBeNull();
    expect(container.querySelector("[class*='animate-']")).toBeNull();
  });

  it("states the reader's position in words, never as a bar (M6/P13)", () => {
    render(
      <DataTable
        columns={columns}
        rows={Array.from({ length: 32 }, (_, i) => ({ symbol: `S${i}`, name: `n${i}`, rvol: i, ret: 0.01 }))}
        defaultSort={{ key: "symbol", dir: "asc" }}
        rowKey={(r) => r.symbol}
        ariaLabel="many"
        perPage={25}
      />,
    );
    expect(screen.getByText("Page 1 of 2 · 32 rows")).toBeVisible();
  });

  it("pages forward, and every row is reachable — there is no dead '+N more' here", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 32 }, (_, i) => ({ symbol: `S${i}`, name: `n${i}`, rvol: i, ret: 0.01 }));
    render(
      <DataTable
        columns={columns}
        rows={many}
        defaultSort={{ key: "symbol", dir: "asc" }}
        rowKey={(r) => r.symbol}
        ariaLabel="many"
        perPage={25}
      />,
    );
    expect(screen.queryByText("S31")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(within(screen.getByRole("table")).getByText("S31")).toBeVisible();
  });

  it("renders the footnote — M1's sentence has exactly one home, under the table", () => {
    renderTable({ footnote: "Matches are filter hits, not forecasts." });
    expect(screen.getByText("Matches are filter hits, not forecasts.")).toBeVisible();
  });

  it("disables sorting entirely when the consumer says the set is capped (M6)", () => {
    // Above the 500-row cap the table shows a stated subset. Sorting it would present "the biggest
    // movers among the most salient" as "the biggest movers" — an unlabelled subset ranking.
    renderTable({ sortable: false });
    expect(screen.queryByRole("button", { name: /RVOL/ })).toBeNull();
  });
});
