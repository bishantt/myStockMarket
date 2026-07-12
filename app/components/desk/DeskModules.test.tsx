import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Movers } from "./Movers";
import { Watchlist } from "./Watchlist";
import { copy } from "@/lib/copy";

const ASOF = new Date("2026-07-09T20:05:00Z");

describe("Movers", () => {
  const movers = [
    {
      symbol: "SMCI", name: "Super Micro", changePct: "+8.2%", direction: "up" as const, rvol: "3.1×",
      catalyst: { type: "earnings", headline: "Super Micro beats Q3 estimates", source: "Reuters", url: "https://ex.com/1" },
    },
    { symbol: "XYZ", name: "Noise Co", changePct: "+5.1%", direction: "up" as const, rvol: "0.8×" },
  ];

  it("shows each mover's symbol, change and RVOL", () => {
    render(<Movers asOf={ASOF} movers={movers} />);
    expect(screen.getByText("SMCI")).toBeInTheDocument();
    expect(screen.getByText("+8.2%")).toBeInTheDocument();
    expect(screen.getByText("3.1×")).toBeInTheDocument();
  });

  it("renders the catalyst type chip, its reason, and a source link", () => {
    render(<Movers asOf={ASOF} movers={movers} />);
    expect(screen.getByText("earnings")).toBeInTheDocument();
    expect(screen.getByText("Super Micro beats Q3 estimates")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Reuters" });
    expect(link).toHaveAttribute("href", "https://ex.com/1");
  });

  it("uses the honest noise line for a mover with no catalyst, never an invented cause", () => {
    render(<Movers asOf={ASOF} movers={movers} />);
    expect(screen.getByText(copy.mover.noNews)).toBeInTheDocument();
  });

  it("handles an empty movers list — a quiet day is information, not an empty shelf", () => {
    render(<Movers asOf={ASOF} movers={[]} />);
    expect(screen.getByText(copy.mover.quiet)).toBeInTheDocument();
  });
});

describe("Watchlist", () => {
  const rows = [
    {
      symbol: "AAPL", name: "Apple", reason: "Earnings next week", price: "212.40", changePct: "+0.4%",
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
