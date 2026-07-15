import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RangeStrip } from "./RangeStrip";
import type { RangeStripData } from "@/lib/ticker-depth";

/**
 * The strip STATES ITS WINDOW (§5.2), and it only calls itself "52-week" when the window really is a
 * year. A thin history — the seed's 22-session symbols, a name freshly served — must say the true
 * count, not borrow a claim it cannot support. That honesty is the whole reason the label is
 * conditional, so it is the thing pinned here.
 */
function strip(over: Partial<RangeStripData> = {}): RangeStripData {
  return { low: 90, high: 120, current: 110, position: 0.6667, sessions: 252, through: "2026-07-09", ...over };
}

describe("RangeStrip", () => {
  it("says '52-week range' with the real session count over a full year", () => {
    render(<RangeStrip strip={strip({ sessions: 252 })} />);
    expect(screen.getByText(/52-week range · 252 sessions/)).toBeInTheDocument();
  });

  it("says 'Trading range' with the true count over a thin history — never a borrowed year", () => {
    render(<RangeStrip strip={strip({ sessions: 22 })} />);
    expect(screen.getByText(/Trading range · 22 sessions/)).toBeInTheDocument();
    expect(screen.queryByText(/52-week/)).not.toBeInTheDocument();
  });

  it("renders the low, current and high, and marks itself as money that does not move", () => {
    const { container } = render(<RangeStrip strip={strip()} />);
    expect(screen.getByText("90.00")).toBeInTheDocument();
    expect(screen.getByText("110.00")).toBeInTheDocument();
    expect(screen.getByText("120.00")).toBeInTheDocument();
    // data-p2: a price is money, and money does not animate (§3.6).
    expect(container.querySelector("[data-p2]")).not.toBeNull();
  });
});
