import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalendarTimeline, type CalendarRow } from "./CalendarTimeline";

/**
 * The calendar's cut, and the one rule that governs it (ruling M2).
 *
 * **A HIGH-IMPORTANCE ROW IS NEVER BEHIND A FOLD.** Not at any width, not for any reason, however
 * long the list gets. This module's job is WARNING — and a module that shows one warning while
 * hiding a second implies a completeness it does not have. A reader who sees "CPI on Friday" and
 * nothing else will reasonably assume Friday is the only thing to brace for; if FOMC was folded away
 * under a "+ 4 more", the calendar has lied by omission.
 *
 * So the cut is on TIME and on ROUTINE rows only, and the high rows are simply always there. The
 * seed places TWO of them (FOMC and the jobs report) deliberately BELOW the routine cut, so this
 * test is exercising the case that would otherwise hide them.
 */

const asOf = new Date("2026-07-09T22:40:00.000Z");

const row = (dateLabel: string, title: string, high = false): CalendarRow => ({
  dateLabel,
  kind: high ? "macro" : "earnings",
  code: high ? "CPI" : "EARNINGS",
  title,
  high,
});

describe("CalendarTimeline — the cut (M2)", () => {
  it("shows every high-importance row, even when it sits far below the routine cut", () => {
    // Eight routine rows crowd the list, and the two warnings sit at positions 8 and 9 — well past
    // any first-N slice. They must still be on screen, un-folded.
    const events: CalendarRow[] = [
      ...Array.from({ length: 8 }, (_, i) => row(`Jul ${10 + i}`, `ACME ${i} earnings`)),
      row("Jul 20", "FOMC decision", true),
      row("Jul 21", "Jobs report", true),
    ];

    render(<CalendarTimeline asOf={asOf} events={events} />);

    // Both warnings are rendered OUTSIDE the disclosure — visible without a tap.
    expect(screen.getByText("FOMC decision")).toBeVisible();
    expect(screen.getByText("Jobs report")).toBeVisible();
  });

  it("folds the routine tail, and says how much it folded and through when (M2's contract)", () => {
    const events: CalendarRow[] = Array.from({ length: 10 }, (_, i) =>
      row(`Jul ${10 + i}`, `ACME ${i} earnings`),
    );

    render(<CalendarTimeline asOf={asOf} events={events} />);

    // Six routine rows stay; four fold. The summary states both the count and the range — a
    // disclosure that hides an unstated number of things can hide a miss.
    expect(screen.getByText(/\+ 4 more · through Jul 19/)).toBeVisible();
  });

  it("never folds anything when the list is short", () => {
    const events = [row("Jul 12", "Consumer Price Index", true), row("Jul 15", "AAPL earnings")];
    const { container } = render(<CalendarTimeline asOf={asOf} events={events} />);

    expect(screen.getByText("Consumer Price Index")).toBeVisible();
    expect(screen.getByText("AAPL earnings")).toBeVisible();
    expect(container.querySelector("details")).toBeNull(); // nothing to disclose
  });

  it("still renders the honest empty state — a quiet fortnight is the product working", () => {
    render(<CalendarTimeline asOf={asOf} events={[]} />);
    expect(screen.getByText(/A quiet stretch/)).toBeVisible();
  });
});

describe("CalendarTimeline — the CC6 grammar and the reported-today collapse (D7)", () => {
  const earningsRow = (dateLabel: string, symbol: string): CalendarRow => ({
    dateLabel,
    kind: "earnings",
    code: "EARNINGS",
    title: `${symbol} earnings`,
    symbol,
  });

  it("speaks an earnings symbol ONCE — the ticker, not 'JPM · JPM earnings'", () => {
    render(<CalendarTimeline asOf={asOf} events={[earningsRow("Wed, Jul 15", "MSFT")]} />);
    // The ticker chip shows the symbol once; the redundant "MSFT earnings" title is gone (the KIND
    // chip already says EARNINGS).
    expect(screen.getByText("MSFT")).toBeVisible();
    expect(screen.queryByText("MSFT earnings")).toBeNull();
    expect(screen.queryByText(/·\s*MSFT/)).toBeNull();
  });

  it("collapses today's reported earnings into ONE retrospective line, below the forward rows", () => {
    render(
      <CalendarTimeline
        asOf={asOf}
        events={[earningsRow("Thu, Jul 16", "MSFT")]}
        reportedToday={["BAC", "C", "GS", "JPM", "WFC"]}
      />,
    );
    expect(screen.getByText(/Reported today/i)).toBeVisible();
    expect(screen.getByText(/BAC · C · GS · JPM · WFC/)).toBeVisible();
  });

  it("shows the reported-today line even when there are no forward events left", () => {
    // A day with nothing ahead but names that reported today is NOT the empty state.
    render(<CalendarTimeline asOf={asOf} events={[]} reportedToday={["JPM"]} />);
    expect(screen.queryByText(/A quiet stretch/)).toBeNull();
    expect(screen.getByText(/Reported today/i)).toBeVisible();
  });
});
