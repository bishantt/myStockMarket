import { cx } from "@/lib/cx";
import { DeltaChip } from "@/components/DeltaChip";

/**
 * StatFigure — a labelled number, and the rules that keep a number from lying.
 *
 * Anatomy (§4.1): an 11px uppercase Inter label, the value beneath it in JetBrains Mono at one of
 * three scales, and an optional delta chip.
 *
 * The delta encodes direction three ways at once — a triangle, an explicit sign, and colour —
 * because colour alone fails for roughly one man in twelve. The blue/orange pair is colourblind-safe,
 * but the redundancy is the actual guarantee, not the hue.
 *
 * The rule that matters most here, and the reason the hero variant exists as its own thing:
 *
 *     SEMANTIC COLOUR NEVER EXCEEDS --text-num-lg.
 *
 * The largest element on any screen is never emotional colour. The hero numeral — the S&P's level,
 * 64px, the single biggest thing on the Desk — renders in plain ink, and its direction lives beside
 * it in small type. A 64px red number is a mood; a 64px ink number with a small orange triangle is
 * a fact. (§3.3, and Research Report §9.7 on scarce colour.)
 *
 * P2 (§3.6): the root carries `data-p2`. This is a money/probability visual — it renders complete
 * on first paint, it never ticks or counts up, and no ancestor may animate or transform it. A jsdom
 * test walks up from every `[data-p2]` node to prove it.
 */

/**
 * THE WRAP CONTRACT (PD4, §7.2) — why the value row wraps instead of clipping.
 *
 * A figure and its delta chip sit on one line when they fit, and the chip drops BELOW the value when
 * they do not. It never truncates, never ellipsizes, never clips.
 *
 * That is not a styling preference, it is the honesty rule applied to layout: truncating a figure is
 * lying about it ("44,326.0…" is not a number), and clipping one is lying about it silently. Wrapping
 * is just typography. So the row is `flex-wrap`, the chip may take a whole line of its own, and the
 * cell grows downward — which is a thing this app is allowed to do, because a module reserves no
 * height (drift rule 24).
 *
 * This heals every consumer at once. The old row was `flex items-baseline gap-2` with no wrap, so a
 * long value beside a chip simply overflowed its card — which is exactly what the Desk's phone cards
 * were doing.
 */

/** Which way the number moved. `flat` covers unchanged and doji — it renders in ink, no triangle. */
export type Direction = "up" | "down" | "flat";

type StatFigureProps = {
  /** The label above the number, e.g. "S&P 500". Rendered uppercase; pass sentence case. */
  label: string;
  /**
   * The value, already formatted. StatFigure never formats a number: formatting lives in
   * lib/format, and base rates render only through components/BaseRate (§1.2).
   */
  value: string;
  /**
   * `hero` is the 64px numeral. Exactly ONE per route may use it, and only `/` does — the
   * anti-drift checklist greps for violations at every phase exit.
   * `figure` is the 44px module-level key figure. `body` is everything else.
   *
   * `dense` (PD4) is `body`'s smaller sibling, and it exists because of ARITHMETIC before taste. The
   * phone's 3-up macro row (§7.1, row B) leaves each cell about 88px of interior at 360px, and a
   * nine-character index level — "20,674.19" — is roughly 113px wide at `body`'s 21px. A mono numeral
   * has no wrap opportunity inside itself, so it cannot be made to fit; it can only overflow. `dense`
   * is the scale at which the figure actually FITS the box it is given.
   *
   * It is also the right editorial answer, which is the happy part: row B carries the equity-tape
   * echoes that the hero directly above already summarizes, so they should read as supporting data
   * rather than as headlines.
   */
  scale?: "hero" | "figure" | "body" | "dense";
  /** How the label and the number are arranged. See the `Layout` note below. */
  layout?: Layout;
  delta?: {
    /** The delta, already formatted and signed, e.g. "+0.42%". */
    value: string;
    direction: Direction;
    /**
     * The period the delta covers, e.g. "1D" — a token from the closed `copy.window` set.
     *
     * It renders INSIDE the chip, beside the number, because that is the whole of ruling C2: a
     * window stated in a footnote is a window most readers never connect to the figure. "+0.42%" is
     * not a fact on its own — over what? — and "+0.42% · 1D" is.
     *
     * REQUIRED SINCE PD5, and the type is now what enforces C2. It was optional, which meant the
     * rule was a comment: any caller could ship a naked percentage and no guard in the build would
     * have said a word. Every caller in the product already passed one — only the styleguide's own
     * specimen omitted it, which is a fair summary of how a rule rots. There is no such thing as a
     * delta without a period, so there is no longer a way to type one.
     */
    window: string;
  };
};

/** Value type sizes. The hero drops to 48px below 768px — the phone ritual column (§7.1). */
const VALUE_SCALE: Record<NonNullable<StatFigureProps["scale"]>, string> = {
  hero: "text-hero-mobile md:text-hero",
  figure: "text-num-lg",
  body: "text-lg",
  dense: "text-base",
};

/**
 * The chip's type size tracks the value's, and `dense` is why that matters.
 *
 * A `dense` cell is narrow by definition, and the chip is the WIDER of the two things in it — a value
 * is "20,674.19" but a chip is "▼ -0.55% · 1D", which is longer. Leaving the chip at `sm` inside a
 * `dense` cell would mean the value fits and the chip does not, which is the same overflow bug one
 * size down. The chip shrinks with its figure; the mapping is the one line in the render below.
 */

/**
 * The two ways a figure can be arranged, and what each is FOR.
 *
 * `stack` — label above the number. The default, and the right shape whenever the figure has a card
 * to itself: it gives the number a whole line, which is what a figure worth a card deserves.
 *
 * `row` — label on the left, number and chip on the right, on one baseline. This exists because of a
 * measurement (PD4). A phone is ~360–412px wide, and three figure CARDS across it leave about 74–91px
 * of interior each — while an index level ("22,345.67") is ~81px and its delta chip ("▲ +0.29% · 1D")
 * is ~95px. The two cannot share that cell, and no amount of type-scale tuning changes it; the
 * arithmetic simply does not close.
 *
 * A row spends the phone's ONE abundant axis — its width — instead of fighting over its scarcest. The
 * same three figures that overflow as cards fit comfortably as a list, and read as what they are: a
 * tape, subordinate to the figures above them.
 */
type Layout = "stack" | "row";

export function StatFigure({
  label,
  value,
  scale = "body",
  layout = "stack",
  delta,
}: StatFigureProps) {
  const isRow = layout === "row";

  return (
    <div
      data-p2
      className={cx(
        // In a row the label and the number sit on one baseline and the number is pushed to the far
        // side. `flex-wrap` is the safety net rather than the plan: if a long label and a long figure
        // genuinely cannot share a line, the figure takes the next one — it never spills.
        isRow
          ? "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
          : "flex flex-col gap-1",
      )}
    >
      <span className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>

      {/*
       * THE WRAP CONTRACT (§7.2). `flex-wrap` is the whole fix: when the value and its chip cannot
       * share a line, the chip takes the next one. `gap-y-0.5` is the seam it lands on — small,
       * because a wrapped chip is still part of the same figure, not a new fact under it.
       */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {/*
         * Always ink, at every scale. There is no variant of this component in which the number
         * itself carries the up/down colour — that is the whole point.
         */}
        <span className={cx("font-mono font-medium text-ink", VALUE_SCALE[scale])}>
          {value}
        </span>

        {/*
         * THE CHIP IS NO LONGER WRITTEN HERE (PD5). It moved to components/DeltaChip.tsx, whole and
         * unchanged — the two atoms, the wrap rule, the redundant glyph, the un-faded window.
         *
         * The reason it moved is the reason it had to: there were FOUR copies of this chip in the
         * tree (here, Movers, Watchlist, NewsCard), and PD4's wrap fix landed in exactly one of them
         * — this one. The other three kept the shape of the bug PD4 had just spent a phase killing,
         * and nothing failed, because a duplicated component is not a bug, it is a bug's HABITAT.
         *
         * StatFigure now consumes the same chip as everyone else, which is what makes the contract
         * a contract rather than a comment.
         */}
        {delta ? (
          <DeltaChip
            value={delta.value}
            direction={delta.direction}
            window={delta.window}
            scale={scale === "dense" ? "xs" : "sm"}
          />
        ) : null}
      </div>
    </div>
  );
}
