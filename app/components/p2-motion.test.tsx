import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BaseRate } from "@/components/BaseRate";
import { StatFigure } from "@/components/StatFigure";
import { SetupCards } from "@/components/desk/SetupCards";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { BaseRateData } from "@/lib/baserate";

/**
 * p2-motion.test.tsx — the structural enforcement of the app's hardest visual rule.
 *
 * PROBABILITY AND MONEY VISUALS NEVER MOVE (§3.6, preserved rule P2).
 *
 * Base rates, dot arrays, confidence intervals, calibration charts, range bands, Brier figures and
 * delta chips render complete on the first paint. They do not draw in, ease in, count up, or tick.
 * The reason is not taste. An animated probability implies the probability is *arriving* — that
 * something is happening, right now, that the reader might be late for. This product exists to say
 * the opposite.
 *
 * The redesign made this rule harder to keep, because it allowed general UI motion for the first
 * time. A hover-lift on a card, a slide on a drawer, a reveal on a `<details>` — each is innocent
 * until the thing it moves happens to CONTAIN a base rate. Then the base rate moves, and no grep of
 * the base rate's own file would ever notice: the motion is in an ancestor.
 *
 * So the rule is enforced structurally instead. Every P2 component root carries `data-p2`, and this
 * test renders the real components in their real wrappers and walks UP from every `[data-p2]` node
 * to the document root, asserting that nothing above them animates, transitions, or transforms.
 *
 * The one sanctioned exception is the route fade (`.route-fade`): opacity-only, no translation, so
 * every frame shows every visual complete and unmoving *relative to everything else*. It is
 * exempted by name, and by name only.
 */

/** The class allowed to animate an ancestor of a P2 node — the uniform, opacity-only route fade. */
const SANCTIONED_ANIMATION = "route-fade";

/** Tailwind utilities that would move, morph, or fade a subtree. */
const MOTION_CLASS =
  /^(transition|animate-|duration-|motion-safe:|group-hover:scale|hover:scale|hover:-translate|translate-|scale-|rotate-|skew-)/;

/**
 * Walk from a node to the document root, collecting any ancestor that would move it.
 *
 * jsdom does not run the CSS engine, so this reads the class list rather than computed styles —
 * which is the right level anyway: the design system expresses motion as Tailwind utilities and
 * two named CSS classes, so the class list IS the motion contract.
 */
function movingAncestorsOf(node: Element): string[] {
  const offenders: string[] = [];
  let current: Element | null = node.parentElement;

  while (current !== null) {
    const classes = Array.from(current.classList);
    if (!classes.includes(SANCTIONED_ANIMATION)) {
      const moving = classes.filter((c) => MOTION_CLASS.test(c));
      if (moving.length > 0) {
        offenders.push(`<${current.tagName.toLowerCase()} class="${moving.join(" ")}">`);
      }
      // An inline transform or transition is just as capable of moving a subtree.
      const style = current.getAttribute("style") ?? "";
      if (/transform|transition|animation/.test(style)) {
        offenders.push(`<${current.tagName.toLowerCase()} style="${style}">`);
      }
    }
    current = current.parentElement;
  }
  return offenders;
}

/** Assert that every P2 node in the rendered tree stands perfectly still. */
function expectNothingMoves(container: HTMLElement) {
  const p2Nodes = container.querySelectorAll("[data-p2]");
  expect(p2Nodes.length, "the component should mark its probability visuals with data-p2").toBeGreaterThan(0);

  for (const node of p2Nodes) {
    const offenders = movingAncestorsOf(node);
    expect(
      offenders,
      `a probability visual has ${offenders.length} moving ancestor(s): ${offenders.join(", ")}`,
    ).toEqual([]);
  }
}

// ── the fixtures ─────────────────────────────────────────────────────────────────────────────

const BASE_RATE: BaseRateData = {
  n: 108,
  wins: 61,
  winRate: 0.565,
  ciLow: 0.47,
  ciHigh: 0.65,
  baseline: 0.54,
  horizonDays: 10,
  refClass: "US large/mid",
  years: 20,
};

const SETUP_CARD: SetupCardView = {
  id: "setup-1",
  symbol: "AAPL",
  patternLabel: "Golden cross",
  patternKey: "golden-cross",
  tier: "weak",
  cause: "the 50-day crossed above the 200-day",
  baseRate: BASE_RATE,
  weakeners: [],
  weakenerState: {},
  learnSlug: "moving-averages-and-the-golden-cross",
};

// ── the tests ────────────────────────────────────────────────────────────────────────────────

describe("probability and money visuals never move (P2)", () => {
  it("BaseRate marks itself and sits still", () => {
    const { container } = render(<BaseRate data={BASE_RATE} />);
    expectNothingMoves(container);
  });

  it("StatFigure marks itself and sits still — a delta is money, and money does not animate", () => {
    const { container } = render(
      <StatFigure label="S&P 500" value="6,812.34" scale="hero" delta={{ value: "+0.34%", direction: "up" }} />,
    );
    expectNothingMoves(container);
  });

  it("a setup card's <details> expansion never animates the base rate inside it", () => {
    // This is the case the rule exists for. A `<details>` reveal is exactly the kind of pleasant
    // motion the redesign now allows — and a setup card's subtree is a base rate, an interval, and
    // a range panel. So THIS `<details>` opens instantly, while others in the app may fade.
    const { container } = render(<SetupCards asOf={new Date("2026-07-10T20:05:00Z")} cards={[SETUP_CARD]} />);
    expectNothingMoves(container);
  });

  it("catches a moving ancestor when one is introduced (the test can actually fail)", () => {
    // A guard that cannot fail is a guard that proves nothing. This wraps a real P2 component in
    // exactly the kind of innocent hover-lift the design system allows elsewhere, and proves the
    // walk-up notices.
    const { container } = render(
      <div className="transition hover:-translate-y-px">
        <StatFigure label="S&P 500" value="6,812.34" />
      </div>,
    );
    const p2 = container.querySelector("[data-p2]")!;
    expect(movingAncestorsOf(p2).length).toBeGreaterThan(0);
  });

  it("permits the one sanctioned ancestor animation: the opacity-only route fade", () => {
    // The route fade may contain a probability visual precisely BECAUSE it contains no relative
    // motion — the whole page fades as one settled sheet, and every frame shows the visual
    // complete and unmoving with respect to everything around it.
    const { container } = render(
      <div className="route-fade">
        <BaseRate data={BASE_RATE} />
      </div>,
    );
    expectNothingMoves(container);
  });
});
