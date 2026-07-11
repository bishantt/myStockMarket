import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarTimeline } from "./CalendarTimeline";
import { SourceStatusFooter } from "./SourceStatusFooter";
import { copy } from "@/lib/copy";

const ASOF = new Date("2026-07-11T20:05:00Z");

describe("CalendarTimeline", () => {
  it("shows each event with its kind, title, and consensus", () => {
    render(<CalendarTimeline asOf={ASOF} events={[
      { dateLabel: "Jul 15", kind: "earnings", symbol: "AAPL", title: "Apple Q3", consensus: "1.28", prior: "1.40" },
    ]} />);
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByText(/Apple Q3/)).toBeInTheDocument();
    expect(screen.getByText(/cons\. 1\.28/)).toBeInTheDocument();
  });

  it("shows an empty state when nothing is scheduled", () => {
    render(<CalendarTimeline asOf={ASOF} events={[]} />);
    expect(screen.getByText(/No scheduled events/i)).toBeInTheDocument();
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
