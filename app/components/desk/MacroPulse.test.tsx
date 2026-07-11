import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MacroPulse } from "./MacroPulse";

/**
 * MacroPulse tests — the module renders its data and, critically, keeps the hero-colour rule:
 * the 64px S&P figure is ink, direction lives in the small delta beside it (plan §3.6).
 */

const PROPS = {
  asOf: new Date("2026-07-09T20:05:00Z"),
  spx: { value: "5,412.88", deltaPct: "+0.42%", direction: "up" as const },
  indices: [
    { label: "Nasdaq", value: "17,204.10", deltaPct: "-0.31%", direction: "down" as const },
    { label: "Dow", value: "39,120.00", deltaPct: "+0.10%", direction: "up" as const },
  ],
  breadth: { advancers: 2100, decliners: 1400, pctAbove50dma: "58%" },
  vix: "13.84",
  tenYear: "4.21%",
};

describe("MacroPulse", () => {
  it("shows the masthead, the hero S&P figure and its delta", () => {
    render(<MacroPulse {...PROPS} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("01");
    expect(heading).toHaveTextContent("Macro pulse");
    expect(screen.getByText("5,412.88")).toBeInTheDocument();
    expect(screen.getByText("+0.42%")).toBeInTheDocument();
  });

  it("renders the S&P figure in ink, never in the up/down colour (hero rule)", () => {
    render(<MacroPulse {...PROPS} />);
    const heroValue = screen.getByText("5,412.88");
    // The hero numeral carries the ink text class; the Wong up/down colour is only on the delta.
    expect(heroValue.className).toContain("text-ink");
    expect(heroValue.className).not.toContain("text-up");
    expect(heroValue.className).not.toContain("text-down");
  });

  it("shows the index row and the FRED context cells", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText("Nasdaq")).toBeInTheDocument();
    expect(screen.getByText("17,204.10")).toBeInTheDocument();
    expect(screen.getByText("VIX")).toBeInTheDocument();
    expect(screen.getByText("13.84")).toBeInTheDocument();
    expect(screen.getByText("4.21%")).toBeInTheDocument();
  });

  it("states breadth in plain factual terms, no colour", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText(/2100 advancing · 1400 declining/)).toBeInTheDocument();
    expect(screen.getByText(/58% above the 50-day average/)).toBeInTheDocument();
  });
});
