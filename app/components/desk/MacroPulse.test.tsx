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
      // The small-caps slot: an ETF by design, and it never claims an index it cannot quote.
      label: "Small caps",
      value: "220.00",
      deltaPct: "+0.10%",
      direction: "up" as const,
      source: "etf-proxy" as const,
      proxySymbol: "IWM",
      proxyChip: "IWM · ETF price",
    },
  ],
  breadth: { advancers: 2100, decliners: 1400, pctAbove50dma: "58%", asOf: "at Thu's close" },
  vix: "13.84",
  tenYear: "4.21%",
  provenance: "S&P 500, Nasdaq Composite: FRED, prior close · Small caps: IWM ETF close · VIX: Cboe via FRED · 10-yr: US Treasury via FRED",
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
      .getAllByText(/VIX|10-year|Nasdaq Composite|Dow|Small caps/)
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

  it("marks an ETF slot with ONE chip — never the old double belt", () => {
    render(<MacroPulse {...PROPS} />);
    // Two renderings (shelf + grid), so two chips — and the point is that NEITHER is silent.
    expect(screen.getAllByText("IWM · ETF price")).toHaveLength(2);

    // The old grammar said "ETF proxy" twice on every proxy row: once as a label suffix
    // ("Russell 2000 · IWM (ETF proxy)") and again as a freestanding chip. On screen that read as
    // noise, and noise is where a beginner stops reading. Both belts are gone.
    expect(screen.queryByText(/\(ETF proxy\)/)).toBeNull();
    expect(screen.queryByText(/^ETF proxy$/)).toBeNull();
  });

  it("never puts an index's name on the small-caps row — we cannot quote that index", () => {
    render(<MacroPulse {...PROPS} />);
    // FRED deleted every free Russell series in 2019 and no licensable substitute exists, so this
    // slot can NEVER carry the Russell 2000's level. Naming it would be a promise the row cannot
    // keep, so the row names the GROUP the number describes instead.
    expect(screen.queryByText(/Russell/)).toBeNull();
    expect(screen.getAllByText("Small caps")).toHaveLength(2);
  });

  it("shows no proxy chip on a slot carrying a true index level", () => {
    const allIndex = {
      ...PROPS,
      indices: [PROPS.indices[0]], // the Nasdaq Composite — a real index level
    };
    render(<MacroPulse {...allIndex} />);
    expect(screen.queryByText(/ETF price/)).not.toBeInTheDocument();
  });

  it("renders the provenance line it was GIVEN, not one it made up (C6)", () => {
    // The component no longer owns this sentence. It used to print a fixed string — "Index levels ·
    // FRED · prior close" — regardless of what the rows above it showed, so on the night FRED's
    // index series failed it sat under four ETF prices and declared them FRED index levels. The
    // builder composes it now, from the rows that actually rendered.
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText(PROPS.provenance)).toBeInTheDocument();
  });

  it("renders a DIFFERENT provenance line when the rows are different — the proof it is not static", () => {
    const degraded = {
      ...PROPS,
      provenance: copy.macro.indexesUnavailable + " · Small caps: IWM ETF close",
    };
    render(<MacroPulse {...degraded} />);
    expect(screen.getByText(degraded.provenance)).toBeInTheDocument();
    expect(screen.queryByText(PROPS.provenance)).toBeNull();
  });

  it("states the window on every delta chip (C2)", () => {
    render(<MacroPulse {...PROPS} />);
    // "+0.42%" is not a fact on its own — over what? — and "+0.42% · 1D" is. The token rides INSIDE
    // the chip, in the same visual unit as the number, never in a footnote.
    expect(screen.getAllByText("· 1D").length).toBeGreaterThan(0);
  });

  it("dates a carried-forward level, and only that one", () => {
    // A level can now be REAL and OLD at the same time: the pipeline keeps what it has rather than
    // letting a flaky FRED night overwrite it with null. When that happens the row says so.
    const stale = {
      ...PROPS,
      spx: { ...PROPS.spx, staleAsOf: "as of Jul 9" },
    };
    render(<MacroPulse {...stale} />);
    expect(screen.getByText("as of Jul 9")).toBeInTheDocument();
  });

  it("puts no date on a row that is current — a date on every row every night is chrome", () => {
    render(<MacroPulse {...PROPS} />);
    // Scoped to a SLOT date ("as of Jul 9"), not any "as of" — the masthead's own timestamp
    // ("as of 16:05 ET") is the module's as-of and is always there by design. The point of the
    // per-slot date is that it appears only on the row that is actually behind.
    expect(screen.queryByText(/^as of [A-Z][a-z]{2} \d{1,2}$/)).toBeNull();
  });

  it("gives breadth its window — the one claim about the WHOLE market had none (C2)", () => {
    render(<MacroPulse {...PROPS} />);
    expect(screen.getByText(/at Thu's close/)).toBeInTheDocument();
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
