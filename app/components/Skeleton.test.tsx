import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./Skeleton";

/**
 * Ruling M4, made mechanical.
 *
 * A skeleton may stand for a CONTAINER — a masthead, a run of text, a card — and those may shimmer,
 * quietly. It may never stand for a FIGURE. A shimmering bar in the slot where a price or a
 * probability is about to appear reads as "a number is coming, put your attention here", and
 * manufacturing that anticipation around a money figure is precisely what the stillness rule exists
 * to prevent. So a figure slot loads as a still em-dash, and the chart's reservation is still
 * geometry — the chart is a money visual by this codebase's own record, and money visuals do not
 * move, including while they are absent.
 *
 * These tests are the guard. Without them M4 is a paragraph, and a future skeleton written in a
 * hurry would copy the shimmer everywhere, because shimmer is what skeletons look like everywhere
 * else in the industry.
 */
describe("Skeleton — the M4 boundary", () => {
  it("shimmers a masthead bone (a container, and containers may shimmer)", () => {
    const { container } = render(<Skeleton variant="masthead" />);
    expect(container.querySelector(".shimmer")).not.toBeNull();
  });

  it("shimmers text bones, and renders the number of bars it was asked for", () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    expect(container.querySelectorAll(".skeleton-bone")).toHaveLength(3);
    expect(container.querySelector(".shimmer")).not.toBeNull();
  });

  it("NEVER shimmers a block — a chart reservation is still geometry", () => {
    // The 420px chart slot is the largest money visual in the app. A 1.6s pulse occupying it while
    // it loads would be the biggest stillness violation in the product.
    const { container } = render(<Skeleton variant="block" height={420} />);
    expect(container.querySelector(".shimmer")).toBeNull();
    expect(container.querySelectorAll("[class*='animate-']")).toHaveLength(0);
  });

  it("NEVER shimmers a figure — it renders a still em-dash where the number will stand", () => {
    const { container } = render(<Skeleton variant="figure" />);
    expect(container.querySelector(".shimmer")).toBeNull();
    // The em-dash is the quiet placeholder this codebase already uses for an absent number.
    expect(screen.getByText("—")).toBeVisible();
    // And it is TEXT, not a bar dressed up as one.
    expect(container.querySelector(".skeleton-bone")).toBeNull();
  });

  it("marks a figure slot as a figure, so the rule is greppable and not merely remembered", () => {
    const { container } = render(<Skeleton variant="figure" />);
    expect(container.querySelector('[data-slot="figure"]')).not.toBeNull();
  });
});
