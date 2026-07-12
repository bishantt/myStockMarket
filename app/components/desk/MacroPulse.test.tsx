import { render, screen, within } from "@testing-library/react";
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

  it("shows the index row and the FRED context cells, in BOTH renderings", () => {
    render(<MacroPulse {...PROPS} />);

    // Since F5 the figures render twice: once in the phone SHELF and once in the ≥md grid. Which one
    // the reader sees is a CSS decision, so both are in the DOM and getAllByText is the honest query.
    // Asserting exactly two of each is the useful form — it proves neither rendering has quietly lost
    // a figure.
    expect(screen.getAllByText("Nasdaq Composite")).toHaveLength(2);
    expect(screen.getAllByText("22,345.67")).toHaveLength(2);
    expect(screen.getAllByText("VIX")).toHaveLength(2);
    expect(screen.getAllByText("13.84")).toHaveLength(2);
    expect(screen.getAllByText("4.21%")).toHaveLength(2);
  });

  it("puts the risk gauges FIRST on the shelf — position is visibility (§4.1)", () => {
    render(<MacroPulse {...PROPS} />);

    // The hero above already states the equity tape, so the figures that merely echo it take the
    // tail and the two carrying INDEPENDENT information ride first. The conventional indices-first
    // order would bury exactly the two figures that are not redundant with the number above them.
    const shelf = screen.getByRole("group", { name: "Macro figures" });
    const labels = within(shelf)
      .getAllByText(/VIX|10-year|Nasdaq Composite|Dow Jones|Russell/)
      .map((el) => el.textContent);
    expect(labels[0]).toBe("VIX");
    expect(labels[1]).toBe("10-year");
  });

  it("states what is off the edge of the shelf (M8) — a shelf that hides an unstated number lies", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText(copy.pulse.swipe)).toBeInTheDocument();
  });

  it("keeps BREADTH off the shelf — the claim about the whole market may not be swiped away", () => {
    render(<MacroPulse {...PROPS} />);
    const shelf = screen.getByRole("group", { name: "Macro figures" });
    expect(within(shelf).queryByText(/advancing/)).toBeNull();
    expect(screen.getByText(/advancing/)).toBeInTheDocument();
  });

  it("marks an ETF-proxy slot with the proxy chip, so the fallback is never silent", () => {
    render(<MacroPulse {...PROPS} />);
    // Two renderings, so two chips — and the point is that NEITHER of them is silent.
    expect(screen.getAllByText("Russell 2000 · IWM (ETF proxy)")).toHaveLength(2);
    expect(screen.getAllByText(copy.macro.proxyChip)).toHaveLength(2);
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
