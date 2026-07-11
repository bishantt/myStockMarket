import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Movers } from "./Movers";
import { Watchlist } from "./Watchlist";
import { copy } from "@/lib/copy";

const ASOF = new Date("2026-07-09T20:05:00Z");

describe("Movers", () => {
  const movers = [
    { symbol: "SMCI", name: "Super Micro", changePct: "+8.2%", direction: "up" as const, rvol: "3.1×", likelyNoise: false },
    { symbol: "XYZ", name: "Noise Co", changePct: "+5.1%", direction: "up" as const, rvol: "0.8×", likelyNoise: true },
  ];

  it("shows each mover's symbol, change and RVOL", () => {
    render(<Movers asOf={ASOF} movers={movers} />);
    expect(screen.getByText("SMCI")).toBeInTheDocument();
    expect(screen.getByText("+8.2%")).toBeInTheDocument();
    expect(screen.getByText("3.1×")).toBeInTheDocument();
  });

  it("uses the honest noise line for a low-RVOL move, never an invented cause", () => {
    render(<Movers asOf={ASOF} movers={movers} />);
    expect(screen.getByText(copy.mover.noNews)).toBeInTheDocument();
  });

  it("handles an empty movers list", () => {
    render(<Movers asOf={ASOF} movers={[]} />);
    expect(screen.getByText(/No notable movers/i)).toBeInTheDocument();
  });
});

describe("Watchlist", () => {
  const rows = [
    {
      symbol: "AAPL", name: "Apple", reason: "Earnings next week", changePct: "+0.4%",
      direction: "up" as const, rvol: "1.1×", isFocus: true, spark: [10, 11, 10.5, 12, 11.8],
    },
  ];

  it("shows the name, its required reason, and marks a focus name", () => {
    render(<Watchlist asOf={ASOF} rows={rows} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Earnings next week")).toBeInTheDocument();
    expect(screen.getByText("focus")).toBeInTheDocument();
  });

  it("draws a sparkline when there are enough points", () => {
    const { container } = render(<Watchlist asOf={ASOF} rows={rows} />);
    expect(container.querySelector("svg path")).toBeTruthy();
  });

  it("prompts to add a name (with its reason) when empty", () => {
    render(<Watchlist asOf={ASOF} rows={[]} />);
    expect(screen.getByText(/Add a name and the reason you are watching it/i)).toBeInTheDocument();
  });
});
