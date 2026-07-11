import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkedExampleDrawer } from "./WorkedExampleDrawer";
import { buildWorkedExample } from "@/lib/worked-example";

/**
 * WorkedExampleDrawer tests — the drawer opens to the three steps, labels the chart a schematic (not
 * a live price), and shows the failure count in step three (plan §7 P5 step 4).
 */

const example = buildWorkedExample({
  symbol: "DEMO",
  patternKey: "golden-cross",
  patternLabel: "Golden cross",
  cause: "The 50-day average crossed above the 200-day.",
  baseRate: {
    n: 120,
    wins: 66,
    winRate: 0.55,
    ciLow: 0.46,
    ciHigh: 0.64,
    baseline: 0.53,
    horizonDays: 10,
    refClass: "US large/mid",
  },
});

describe("WorkedExampleDrawer", () => {
  it("is closed until the doorway is clicked", () => {
    render(<WorkedExampleDrawer example={example} />);
    expect(screen.queryByRole("group", { name: "Worked example" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /worked example/i }));
    expect(screen.getByRole("group", { name: "Worked example" })).toBeInTheDocument();
  });

  it("shows all three steps in order, with the failure count in step three", () => {
    render(<WorkedExampleDrawer example={example} />);
    fireEvent.click(screen.getByRole("button", { name: /worked example/i }));
    expect(screen.getByText(/what happened in the data/i)).toBeInTheDocument();
    expect(screen.getByText(/why it is believed to matter/i)).toBeInTheDocument();
    expect(screen.getByText(/higher 10 trading days later 66 times and was not higher the other 54 times/i)).toBeInTheDocument();
  });

  it("labels the chart a schematic, never a live price", () => {
    render(<WorkedExampleDrawer example={example} />);
    fireEvent.click(screen.getByRole("button", { name: /worked example/i }));
    expect(screen.getByText(/schematic/i)).toBeInTheDocument();
  });
});
