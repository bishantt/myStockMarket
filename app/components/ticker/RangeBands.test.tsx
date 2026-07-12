import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RangeBands } from "./RangeBands";
import { copy } from "@/lib/copy";
import type { LadderBand } from "@/lib/range-ladder";

/**
 * The Range Ladder's honesty locks, asserted against the RENDERED DOM.
 *
 * The geometry function is already tested (lib/range-ladder.test.ts) and it cannot return a median
 * or a connecting path — no field exists to hold one. These tests close the other half of the door:
 * that the COMPONENT does not draw one anyway, out of some well-meant instinct that a chart of a
 * distribution ought to show its centre.
 *
 * It ought not. A median mark is a point forecast wearing an interval's clothes, and a silhouette
 * joining the horizon rows is a forward-widening cone — the exact visual grammar of a projection
 * that this whole chart exists to avoid. Both would look like helpful additions. Both are the bug.
 */

const BANDS: LadderBand[] = [
  { horizonDays: 5, coverage: 0.8, lo: -0.043, hi: 0.048, label: "5-day", n: 495, windowDays: 500 },
  { horizonDays: 5, coverage: 0.5, lo: -0.018, hi: 0.021, label: "5-day", n: 495, windowDays: 500 },
  { horizonDays: 10, coverage: 0.8, lo: -0.062, hi: 0.071, label: "10-day", n: 490, windowDays: 500 },
  { horizonDays: 10, coverage: 0.5, lo: -0.027, hi: 0.031, label: "10-day", n: 490, windowDays: 500 },
  { horizonDays: 20, coverage: 0.8, lo: -0.089, hi: 0.104, label: "20-day", n: 480, windowDays: 500 },
  { horizonDays: 20, coverage: 0.5, lo: -0.038, hi: 0.045, label: "20-day", n: 480, windowDays: 500 },
];

describe("RangeBands — the Range Ladder", () => {
  it("draws one band pair per horizon", () => {
    const { container } = render(<RangeBands bands={BANDS} />);
    // Two rects per row: the 80% band and the 50% band nested inside it.
    expect(container.querySelectorAll("rect")).toHaveLength(6);
  });

  it("HAS NO MARK AT THE 50TH PERCENTILE — the honesty lock", () => {
    const { container } = render(<RangeBands bands={BANDS} />);

    // The only <line> elements on the chart are the zero lines: one per row, and nothing else. If a
    // median tick were ever added, this count would rise and this test would fail — which is the
    // entire point of counting them rather than looking for one by name.
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(3); // three horizons, three zero lines

    // Every one of them sits at zero — the same x on each row (the shared anchor).
    const xs = [...lines].map((l) => l.getAttribute("x1"));
    expect(new Set(xs).size).toBe(1);

    // And no path is stroked anywhere: a median would most naturally arrive as one.
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });

  it("draws NOTHING that connects one horizon row to the next — no cone", () => {
    const { container } = render(<RangeBands bands={BANDS} />);

    // A silhouette across the rows would have to be a path, a polygon, or a polyline. There are
    // none. The rows are discrete slices, and their discreteness is the honesty.
    expect(container.querySelectorAll("path, polygon, polyline")).toHaveLength(0);
  });

  it("embeds twenty quantile dots per row, and the losses are HOLLOW", () => {
    const { container } = render(<RangeBands bands={BANDS} />);
    const circles = [...container.querySelectorAll("circle")];
    expect(circles).toHaveLength(60); // 20 dots × 3 horizons

    // Below zero renders as an outline, not a fill. The shape channel has to survive at dot size —
    // a colourblind reader must still be able to count the losses, and the losses are the point.
    const hollow = circles.filter((c) => c.getAttribute("fill") === "none");
    expect(hollow.length).toBeGreaterThan(0);
    for (const dot of hollow) {
      expect(dot.getAttribute("stroke")).toBe("var(--color-down)");
    }
  });

  it("prints N and the window on every row — a range without its sample is an assertion", () => {
    render(<RangeBands bands={BANDS} />);
    expect(screen.getByText(/n=495 · 500d window/)).toBeInTheDocument();
    expect(screen.getByText(/n=480 · 500d window/)).toBeInTheDocument();
  });

  it("never renders without the regime-break caveat", () => {
    // A band without its caveat is a forecast (§1.5, rule 1). It is not optional, not collapsible,
    // and not behind a disclosure.
    render(<RangeBands bands={BANDS} />);
    expect(screen.getByText(copy.volband.caveat)).toBeInTheDocument();
  });

  it("labels zero as the last close, so the axis cannot be misread", () => {
    render(<RangeBands bands={BANDS} />);
    expect(screen.getByText(/0% = last close/)).toBeInTheDocument();
  });

  it("carries the pinned frequency sentence on each horizon", () => {
    render(<RangeBands bands={BANDS} />);
    expect(
      screen.getByText(/In the past, 8 in 10 5-day paths from here stayed inside this range/),
    ).toBeInTheDocument();
  });

  it("renders nothing at all when the pipeline stored no bands", () => {
    const { container } = render(<RangeBands bands={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is marked as a probability visual, so nothing may animate it", () => {
    const { container } = render(<RangeBands bands={BANDS} />);
    expect(container.querySelector("[data-p2]")).not.toBeNull();
  });
});
