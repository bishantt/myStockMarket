import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarTimeline } from "./CalendarTimeline";
import { SourceStatusFooter } from "./SourceStatusFooter";
import { copy } from "@/lib/copy";

const ASOF = new Date("2026-07-11T20:05:00Z");

describe("CalendarTimeline", () => {
  it("shows each event with its chip code, title, and consensus", () => {
    render(<CalendarTimeline asOf={ASOF} events={[
      { dateLabel: "Jul 15", kind: "earnings", code: "EARNINGS", symbol: "AAPL", title: "AAPL earnings", consensus: "1.28", prior: "1.40" },
    ]} />);
    // The chip renders the allowlist's CODE, never the raw kind (redesign §6.2).
    expect(screen.getByText("EARNINGS")).toBeInTheDocument();
    expect(screen.getByText(/AAPL earnings/)).toBeInTheDocument();
    expect(screen.getByText(/cons\. 1\.28/)).toBeInTheDocument();
  });

  it("marks a high-importance event with the word, not just a mark", () => {
    // Outcome never rides on colour alone, and the mark is ink — never amber, which is reserved.
    render(<CalendarTimeline asOf={ASOF} events={[
      { dateLabel: "Jul 14", kind: "macro", code: "CPI", title: "Consumer Price Index", high: true },
    ]} />);
    expect(screen.getByText("CPI")).toBeInTheDocument();
    expect(screen.getByText(copy.calendar.importanceHigh)).toBeInTheDocument();
  });

  it("leaves an ordinary event unmarked", () => {
    render(<CalendarTimeline asOf={ASOF} events={[
      { dateLabel: "Jul 15", kind: "macro", code: "PPI", title: "Producer Price Index" },
    ]} />);
    expect(screen.queryByText(copy.calendar.importanceHigh)).not.toBeInTheDocument();
  });

  it("renders the quiet-stretch card when nothing is scheduled, and says why", () => {
    // An empty calendar is the allowlist working. The card states that rather than apologising.
    render(<CalendarTimeline asOf={ASOF} events={[]} />);
    expect(screen.getByText(copy.calendar.empty)).toBeInTheDocument();
    expect(screen.getByText(copy.calendar.emptySub)).toBeInTheDocument();
  });
});

describe("SourceStatusFooter", () => {
  it("always shows the FRED attribution", () => {
    render(<SourceStatusFooter sources={[{ name: "alpaca", status: "ok" }]} />);
    expect(screen.getByText(copy.attribution.fred)).toBeInTheDocument();
  });

  it("names a degraded source with the honest line", () => {
    render(<SourceStatusFooter sources={[{ name: "alpaca", status: "ok" }, { name: "finnhub", status: "degraded" }]} />);
    expect(screen.getByText(/finnhub unavailable tonight/)).toBeInTheDocument();
  });

  /*
   * THE FOOTPRINT SHRINK (NEWS-AND-CONTROL-PLAN Part 4.2) — and the half of it that matters is the
   * half that does NOT shrink.
   *
   * On a healthy night this footer said "6 sources · all reporting" inside a full card, in the rail.
   * A whole card of chrome to carry one line whose content is "nothing to report" is the footprint
   * disease exactly: the app spending its most expensive material on its least surprising fact.
   *
   * So on an all-ok night it drops its card and becomes a plain footer line under the grid.
   *
   * And on a degraded night it does not shrink AT ALL. It keeps its card, forced open, naming the
   * source that failed — because the entire reason this surface exists is the night something broke,
   * and a footer that gets quieter when the news gets worse is the inverse of the rule the pipeline
   * strip was just built to obey. The component decides this itself rather than trusting its caller:
   * a caller cannot get it wrong, because a caller is never asked.
   */
  it("on an all-ok night it sheds its card — a card is too much chrome for 'nothing to report'", () => {
    const { container } = render(
      <SourceStatusFooter sources={[{ name: "alpaca", status: "ok" }, { name: "fred", status: "ok" }]} />,
    );
    // The Surface card's material is what we are refusing here: no card class, no card padding.
    expect(container.querySelector(".surface")).toBeNull();
    expect(screen.getByText(/all reporting/)).toBeInTheDocument();
  });

  it("on a degraded night it KEEPS its card — the bad night is the one this surface is for", () => {
    const { container } = render(
      <SourceStatusFooter sources={[{ name: "alpaca", status: "ok" }, { name: "finnhub", status: "degraded" }]} />,
    );
    expect(container.querySelector(".surface")).not.toBeNull();

    // And it is still forced open (M2): the rows are on screen with no toggle to hide them. A
    // summary reading "all reporting" with its own refutation folded underneath is the lie M2 exists
    // to forbid, and a shrink that reintroduced it would have been a regression wearing a diet.
    expect(screen.getByText(/finnhub unavailable tonight/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
