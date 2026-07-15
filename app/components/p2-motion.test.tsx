import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BaseRate } from "@/components/BaseRate";
import { StatFigure } from "@/components/StatFigure";
import { DetailOverlay } from "@/components/DetailOverlay";
import { SetupCards } from "@/components/desk/SetupCards";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { BaseRateData } from "@/lib/baserate";
import { DataTable } from "@/components/DataTable";
import { Disclosure } from "@/components/Disclosure";
import { MoodGauge } from "@/components/desk/MoodGauge";
import { Movers } from "@/components/desk/Movers";
import type { Mover as MoverFixture } from "@/components/desk/Movers";
import { Watchlist } from "@/components/desk/Watchlist";
import type { WatchRow as WatchFixture } from "@/components/desk/Watchlist";
import { DeltaChip } from "@/components/DeltaChip";
import type { MoodComponent } from "@/lib/macro-board";
import type { Column } from "@/lib/table";

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

/**
 * The classes allowed to animate an ancestor of a P2 node — the uniform, opacity-only fades.
 *
 * The list is short and CLOSED, and it grows one named class at a time with the reason beside it.
 * A blanket exemption, a wildcard, or a widened selector would be a veto: the moment this admits a
 * PATTERN instead of a name, the guard has stopped being able to fail.
 */
const SANCTIONED_ANIMATIONS = new Set([
  // The route fade (§3.6): the whole page arrives as one settled sheet, opacity only — so every
  // frame shows every visual complete and unmoving relative to everything around it.
  "route-fade",
  // The detail sheet (PD9, plan 11.4): the @modal overlay fades in opacity-only, on IDENTICAL terms
  // and for the identical reason — see globals.css `.sheet-fade` and the "detail sheet" block below.
  // A slide-up would be a veto (a translateY over a price moves the price); the sheet arrives by
  // fading or it does not arrive.
  "sheet-fade",
]);

/** Tailwind utilities that would move, morph, or fade a subtree. */
const MOTION_CLASS =
  /^(transition|animate-|duration-|motion-safe:|group-hover:scale|hover:scale|hover:-translate|translate-|scale-|rotate-|skew-|content-fade$)/;

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
    if (!classes.some((c) => SANCTIONED_ANIMATIONS.has(c))) {
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
      <StatFigure label="S&P 500" value="6,812.34" scale="hero" delta={{ value: "+0.34%", direction: "up", window: "1D" }} />,
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

/**
 * THE KIT (APP-FEEL-PLAN F2). The new primitives are dragged through the same walk, and two of these
 * are NEGATIVE CONTROLS — they prove the guard can still fail. A guard that silently stopped matching
 * would pass forever, and this codebase has been bitten by exactly that once already (the VRT shot
 * that tested nothing).
 */
describe("the kit does not move the numbers it carries", () => {
  const columns: Column<{ symbol: string; ret: number }>[] = [
    { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (r) => r.symbol },
    { key: "ret", header: "1-day move", kind: "signedPercent", window: "1D", priority: 1, value: (r) => r.ret },
  ];
  const rows = [{ symbol: "SMCI", ret: 0.184 }];

  it("a DataTable's delta chips have no moving ancestor", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={rows}
        defaultSort={{ key: "symbol", dir: "asc" }}
        rowKey={(r) => r.symbol}
        ariaLabel="matches"
      />,
    );
    // The chips must actually be marked, or this test is asserting nothing at all.
    expect(container.querySelectorAll("[data-p2]").length).toBeGreaterThan(0);
    expectNothingMoves(container);
  });

  it("a Disclosure over a money figure reveals it INSTANTLY, with no fade", () => {
    const { container } = render(
      <Disclosure label="All movers" count={3} context="by rank" defaultOpen>
        <StatFigure label="Last close" value="$41.20" scale="body" />
      </Disclosure>,
    );
    expectNothingMoves(container);
  });

  // ---- Negative controls: the guard must BITE ------------------------------------------------

  it("NEGATIVE CONTROL — a table row given the movers' hover motion FAILS the walk", () => {
    // This is the exact shortcut a hurried consumer takes: copy the movers row's hover treatment,
    // which is `transition-colors duration-...`, onto a table row. The movers row gets away with it
    // only because its delta chips are unmarked. The kit marks them, so the same classes over the
    // same chips are now a violation — and the walk has to say so.
    const { container } = render(
      <div className="transition-colors duration-(--duration-quick)">
        <span data-p2="true">+18.40%</span>
      </div>,
    );
    const offenders = movingAncestorsOf(container.querySelector("[data-p2]")!);
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("NEGATIVE CONTROL — a faded Disclosure over a base rate FAILS the walk", () => {
    // `fade` is opt-in for exactly this reason: switched on over a P2 subtree it animates the
    // arrival of a probability, and the default (instant) is what keeps the safe path the lazy path.
    const { container } = render(
      <Disclosure label="Evidence" count={1} fade defaultOpen>
        <span data-p2="true">55%</span>
      </Disclosure>,
    );
    const offenders = movingAncestorsOf(container.querySelector("[data-p2]")!);
    expect(offenders, "a fade over a data-p2 subtree must be caught").not.toHaveLength(0);
  });
});

/**
 * THE DESK'S TWO ROWS JOIN THE WALK (PD5), AND THEY ARE THE REASON THE WALK EXISTS.
 *
 * Movers and Watchlist render a delta on every row. Until PD5 those deltas were hand-rolled spans
 * carrying no `data-p2`, so this walk — the app's strictest guard — had never once looked at the two
 * busiest money surfaces on the Desk. Both rows carried `transition-colors` on their hover, and both
 * were fine, because nothing was watching.
 *
 * The chips are DeltaChips now and they carry `data-p2` (Q-G4-1's ruling: a delta is money). The
 * first run of this file after that change failed on BOTH rows, exactly as it should have. Their
 * hover is instant now.
 *
 * These two tests are worth more than they look: they are the ones that would have caught the bug,
 * and they are the ones that will catch the next person who adds a tasteful `transition` to a Desk
 * row without noticing there is a price inside it.
 */
describe("the Desk's rows never animate the money on them (PD5)", () => {
  const MOVER: MoverFixture = {
    symbol: "SMCI",
    name: "Super Micro Computer",
    changePct: "+18.40%",
    direction: "up",
    rvol: "4.7×",
    catalyst: {
      type: "earnings",
      headline: "Raised full-year guidance",
      source: "Reuters",
      url: "https://example.com/a",
    },
  };

  const WATCH: WatchFixture = {
    symbol: "AAPL",
    name: "Apple",
    reason: "Holding above its 50-day",
    price: "$212.40",
    changePct: "-0.55%",
    direction: "down",
    rvol: "1.1×",
    isFocus: true,
    spark: [210, 211, 209, 212, 212.4],
  };

  it("a movers row's delta chip has no moving ancestor", () => {
    const { container } = render(<Movers asOf={new Date("2026-07-10T20:05:00Z")} movers={[MOVER]} />);
    expectNothingMoves(container);
  });

  it("a watchlist row's delta chip has no moving ancestor", () => {
    const { container } = render(<Watchlist asOf={new Date("2026-07-10T20:05:00Z")} rows={[WATCH]} />);
    expectNothingMoves(container);
  });

  it("NEGATIVE CONTROL — the hover the rows USED to carry still fails the walk", () => {
    // `transition-colors duration-(--duration-quick)` is the exact class string both rows carried.
    // It is not banned because it is ugly; it is banned because of what sits underneath it.
    const { container } = render(
      <div className="transition-colors duration-(--duration-quick) hover:bg-accent-muted">
        <DeltaChip value="+18.40%" direction="up" window="1D" />
      </div>,
    );

    const offenders = movingAncestorsOf(container.querySelector("[data-p2]")!);
    expect(offenders.length, "the row hover over a delta chip must be caught").toBeGreaterThan(0);
  });
});

/**
 * The Mood gauge (N3) joins the walk.
 *
 * The gauge is not a probability and it is not money, so it did not have to carry `data-p2` — and
 * that is exactly why it does. A sentiment reading that eased into place, or slid in behind a
 * shelf's transform, would be a sentiment reading that ARRIVES: it would imply that something is
 * happening right now, that the market's mood has just moved, and that a reader might be late for
 * it. That feeling is the single thing this entire product is built not to manufacture — and the
 * gauge, of all the numbers on the Desk, is the one most likely to be misread as a signal despite
 * the two lines under it saying it is not.
 *
 * So it opts IN to the strictest rule the app has, and the ancestor walk now protects it too.
 */
describe("the Mood gauge never moves either (P2, extended in N3)", () => {
  const COMPONENTS: [MoodComponent, ...MoodComponent[]] = [
    { key: "breadth", label: "Breadth", value: "0.61", window: "% above the 50-day average", percentile: "55%", contributes: "greedy" },
    { key: "volatility", label: "Volatility (VIX)", value: "15.84", window: "last close", percentile: "38%", contributes: "fearful" },
    { key: "credit", label: "Credit spreads", value: "3.12", window: "HY OAS, last close", percentile: "34%", contributes: "fearful" },
  ];

  it("renders the score inside a data-p2 subtree with nothing moving above it", () => {
    const { container } = render(
      <MoodGauge score={42} band="leaning fearful" components={COMPONENTS} />,
    );

    const gauge = container.querySelector("[data-p2]");
    expect(gauge, "the gauge's figure must be a P2 node").not.toBeNull();
    expect(movingAncestorsOf(gauge!)).toHaveLength(0);
  });

  it("throws rather than render a score without its breakdown (C8, the runtime half)", () => {
    // The TYPE already forbids this — `components` is a non-empty tuple, so a bare gauge does not
    // compile. The throw is for the boundary the type cannot see: a row arriving from the database,
    // an `any` out of a JSON parse, a future caller in plain JavaScript. C8 is a promise to the
    // reader, not to the compiler, so it is kept in both places.
    const empty = [] as unknown as [MoodComponent, ...MoodComponent[]];

    expect(() => render(<MoodGauge score={42} band="mixed" components={empty} />)).toThrow(/C8/);
  });
});

/**
 * THE DETAIL SHEET JOINS THE WALK (PD9), AND IT IS THE HARDEST CASE THE RULE HAS FACED.
 *
 * The @modal overlay opens OVER rooms full of prices, so a data-p2 node genuinely has the sheet as an
 * animating ancestor — the exact situation E7 was written for, and the reason the plan pre-authorized
 * `.sheet-fade` as a P2-walk exemption BY NAME before PD9 was built. The sheet is allowed to fade
 * (opacity), and it is allowed nothing else. These tests render the REAL DetailOverlay around a real
 * P2 figure and walk up from the figure THROUGH the sheet chrome to the document root — the "extended
 * scan set" 11.4 asks for. Radix portals the sheet to document.body, so the walk starts there.
 */
describe("the detail sheet fades but never moves the figures it carries (PD9)", () => {
  it("a P2 figure inside the MOUNTED sheet has no moving ancestor but the opacity fade", () => {
    render(
      <DetailOverlay title="Test story">
        <StatFigure
          label="Last close"
          value="$212.40"
          scale="figure"
          delta={{ value: "+0.29%", direction: "up", window: "1D" }}
        />
      </DetailOverlay>,
    );
    // The sheet portals to document.body — the figure lives there, not in render's container.
    const figure = document.body.querySelector("[data-p2]");
    expect(figure, "the sheet must actually contain the P2 figure it is being tested with").not.toBeNull();
    expect(movingAncestorsOf(figure!)).toEqual([]);
  });

  it("permits the opacity-only sheet fade by name", () => {
    const { container } = render(
      <div className="sheet-fade">
        <BaseRate data={BASE_RATE} />
      </div>,
    );
    expectNothingMoves(container);
  });

  it("NEGATIVE CONTROL — a slide-up (translateY) ANCESTOR over the sheet's figures FAILS the walk", () => {
    // The one thing the sheet may never do. A slide-up puts a translate above a price, and a price
    // that moves is a price that looks like it is happening. The translate sits on a wrapper ABOVE
    // the fade element (a same-element transform escapes the by-name exemption — which is exactly why
    // globals.css `.sheet-fade` is opacity-only keyframes and the sheet adds no transform utility).
    const { container } = render(
      <div className="translate-y-4">
        <div className="sheet-fade">
          <span data-p2="true">55%</span>
        </div>
      </div>,
    );
    const offenders = movingAncestorsOf(container.querySelector("[data-p2]")!);
    expect(offenders.length, "a translate ancestor over a price must be caught").toBeGreaterThan(0);
  });
});
