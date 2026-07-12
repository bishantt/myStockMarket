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
});
