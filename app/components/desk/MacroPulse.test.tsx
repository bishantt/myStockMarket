import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MacroPulse } from "./MacroPulse";
import { copy } from "@/lib/copy";

/**
 * MacroPulse tests — the module renders its data and keeps two rules:
 *
 *  1. The hero-colour rule: the 64px S&P figure is ink; direction lives in the small delta beside
 *     it (plan §3.6).
 *  2. The proxy rule (redesign §6.1): when a slot is showing an ETF rather than a true index level,
 *     the reader can SEE that — an "ETF proxy" chip sits beside it. A silent fallback is exactly
 *     the bug this module was rewritten to kill.
 */

const PROPS = {
  asOf: new Date("2026-07-09T20:05:00Z"),
  spx: {
    label: "S&P 500",
    value: "6,812.34",
    deltaPct: "+0.42%",
    direction: "up" as const,
    source: "index" as const,
  },
  indices: [
    {
      label: "Nasdaq Composite",
      value: "22,345.67",
      deltaPct: "−0.31%",
      direction: "down" as const,
      source: "index" as const,
    },
    {
      label: "Russell 2000 · IWM (ETF proxy)",
      value: "220.00",
      deltaPct: "+0.10%",
      direction: "up" as const,
      source: "etf-proxy" as const,
      proxySymbol: "IWM",
    },
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
    expect(screen.getByText("6,812.34")).toBeInTheDocument();
    expect(screen.getByText("+0.42%")).toBeInTheDocument();
  });

  it("renders the S&P figure in ink, never in the up/down colour (hero rule)", () => {
    render(<MacroPulse {...PROPS} />);
    const heroValue = screen.getByText("6,812.34");
    // The hero numeral carries the ink text class; the up/down colour is only on the delta.
    expect(heroValue.className).toContain("text-ink");
    expect(heroValue.className).not.toContain("text-up");
    expect(heroValue.className).not.toContain("text-down");
  });

  it("shows the index row and the FRED context cells", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText("Nasdaq Composite")).toBeInTheDocument();
    expect(screen.getByText("22,345.67")).toBeInTheDocument();
    expect(screen.getByText("VIX")).toBeInTheDocument();
    expect(screen.getByText("13.84")).toBeInTheDocument();
    expect(screen.getByText("4.21%")).toBeInTheDocument();
  });

  it("marks an ETF-proxy slot with the proxy chip, so the fallback is never silent", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText("Russell 2000 · IWM (ETF proxy)")).toBeInTheDocument();
    expect(screen.getByText(copy.macro.proxyChip)).toBeInTheDocument();
  });

  it("shows no proxy chip on a slot carrying a true index level", () => {
    const allIndex = {
      ...PROPS,
      indices: [PROPS.indices[0]], // the Nasdaq Composite — a real index level
    };
    render(<MacroPulse {...allIndex} />);
    expect(screen.queryByText(copy.macro.proxyChip)).not.toBeInTheDocument();
  });

  it("states where the levels came from", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText(copy.macro.provenance)).toBeInTheDocument();
  });

  it("omits the delta entirely when the change is not knowable", () => {
    // A level with no prior level cannot state a change, so no delta chip renders at all. A chip
    // holding an em dash would still be a direction claim with nothing behind it.
    const noPrior = {
      ...PROPS,
      spx: { ...PROPS.spx, deltaPct: "—", direction: "flat" as const },
      indices: [],
    };
    render(<MacroPulse {...noPrior} />);
    expect(screen.getByText("6,812.34")).toBeInTheDocument();
    expect(screen.queryByText("+0.42%")).not.toBeInTheDocument();
    // No delta text of any shape sits beside the hero.
    expect(screen.queryByText(/^[+−]\d/)).not.toBeInTheDocument();
  });

  it("states breadth in plain factual terms, no colour", () => {
    render(<MacroPulse {...PROPS} />);
    // The counts and the percentage are shown; glossary terms (advancing, 50-day average) are
    // dotted-underline controls, so the surrounding text is split across nodes — assert the parts.
    expect(screen.getByText(/2100/)).toBeInTheDocument();
    expect(screen.getByText(/1400 declining/)).toBeInTheDocument();
    expect(screen.getByText(/58% above the/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50-day average" })).toBeInTheDocument();
  });

  it("decorates breadth terms as glossary popovers (first occurrence)", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByRole("button", { name: "Breadth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "advancing" })).toBeInTheDocument();
  });
});
