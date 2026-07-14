import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

/**
 * DeltaChip — the one delta chip in this app (PD5, the richness sweep).
 *
 * A signed move and the window it was measured over: "▲ +8.2% · 1D". It is the smallest money
 * visual the product has, and until PD5 there were FOUR copies of it — StatFigure's, Movers',
 * Watchlist's and NewsCard's — each hand-rolled, each with its own class string, all four claiming
 * to encode the same contract.
 *
 * THEY DID NOT ENCODE THE SAME CONTRACT, AND THAT IS WHY THIS FILE EXISTS. PD4 discovered the wrap
 * rule the hard way (a chip that shattered into "▲" / "+0.29%" / "· 1D", three lines, one token
 * each) and fixed it — in StatFigure. The other three copies were never touched, so all three still
 * carried the shape of the bug PD4 had just spent a phase killing: no `flex-wrap`, no atoms, a chip
 * that could only overflow its cell. Nothing failed. Nothing would have. A duplicated component is
 * not a bug, it is a bug's HABITAT: the fix lands in one copy and the other three go on being wrong,
 * quietly, in production.
 *
 * So there is one chip now, and the contract lives in it exactly once.
 *
 * ── THE WRAP CONTRACT (PD4 §7.2, and it is the whole design) ─────────────────────────────────────
 *
 * THE CHIP HAS EXACTLY TWO ATOMS, AND IT MAY BREAK BETWEEN THEM BUT NEVER INSIDE ONE.
 *
 *   ATOM 1 — the SIGNED DELTA ("▲ +8.2%"). The triangle, the sign and the number are one fact told
 *            three redundant ways: a shape for glance, a sign for text, a colour for pattern. The
 *            redundancy IS the colourblind guarantee (P7) — the hue is never the only channel.
 *   ATOM 2 — the WINDOW ("· 1D", "· vs prior week"). It is the delta's UNIT, not a second number.
 *            A percentage with no period attached is a number the reader has to guess the meaning
 *            of, and a beginner will guess wrong (ruling C2), so the window rides inside the chip
 *            rather than in a footnote they must go and find.
 *
 * Each atom is `whitespace-nowrap`; the chip is `flex-wrap`. In a cell too narrow to hold both, the
 * window drops to a second line WHOLE. It never truncates, never ellipsizes, never clips — and it
 * never shatters, which is the failure mode that looks like wrapping and is not. "Wrapping is
 * honest, truncating is not" is a claim about a SENTENCE; a phrase broken one word per line has not
 * been wrapped, it has been shattered.
 *
 * ── P2: THIS THING NEVER MOVES (§3.6, and PD5 is where it finally bites) ─────────────────────────
 *
 * The root carries `data-p2`. A delta is money, and money renders complete on the first paint: it
 * does not ease in, count up, or tick. The `p2-motion` test walks UP from every `[data-p2]` node to
 * the document root and fails if any ancestor animates, transitions or transforms.
 *
 * That walk is why Movers' and Watchlist's rows lost their `transition-colors` hover in PD5. Those
 * rows got away with a transition for six phases for exactly one reason: their delta chips were
 * UNMARKED, so the walk never looked at them. Marking them (Q-G4-1's ruling: the delta chip carries
 * `data-p2`) turned an innocent hover into a build failure — which is the guard doing its job, not
 * an obstacle to route around. The rows still respond to the cursor; the background simply changes
 * INSTANTLY, exactly as NewsCard's already did, and for the reason NewsCard already wrote down: a
 * price that eases into place is a price that looks like it is happening right now.
 */

/**
 * The chip's two sizes. `sm` is the default — every chip beside a figure, a symbol or a row. `xs`
 * exists for `dense` cells (PD4's phone tape), where a `sm` chip fits and a `sm` chip's WINDOW does
 * not: the value is "20,674.19" but the chip is "▼ -0.55% · 1D", which is longer. The chip shrinks
 * with the figure it belongs to, or it is the same overflow bug one size down.
 */
export type DeltaScale = "sm" | "xs";

const CHIP_SCALE: Record<DeltaScale, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

/**
 * The two PRESENTATIONS of the one contract — and this is a distinction with a reason, not a
 * styling knob.
 *
 * `chip` — the delta stands ALONE (a movers row, a watchlist row, beside a StatFigure). It carries
 *          its own soft wash and its own padding, because a bare coloured number floating on the
 *          paper does not read as a unit; the wash is what makes "▲ +8.2% · 1D" one object.
 *
 * `inline` — the delta sits INSIDE another chip (a TickerChip's trailing move). The wash and the
 *          padding are already there, supplied by the chip around it. Nesting a second wash inside
 *          the first would double the padding, double the border radius, and make a pill inside a
 *          pill — visual noise manufactured by a component that could not tell where it was.
 *
 * What does NOT change between them is everything that matters: the two atoms, the wrap rule, the
 * redundant glyph, and `data-p2`. The contract is one; only its clothing differs.
 */
export type DeltaVariant = "chip" | "inline";

/**
 * The delta chip's colours: semantic text on its own soft wash. These are the `-text` variants,
 * darkened to clear AA at small sizes, because a delta is always small type — never the hero.
 * Flat is ink on nothing: no direction, no colour, no wash, and no triangle either. A fake triangle
 * on an unchanged price would be inventing a direction.
 */
const DELTA_CHIP: Record<Direction, string> = {
  up: "text-up-text bg-up-wash",
  down: "text-down-text bg-down-wash",
  flat: "text-ink",
};

/** The same semantic colours, without the wash — the `inline` variant, which sits inside a chip
 * that already supplies one. Identical text tokens: the meaning of the hue does not change with
 * its clothing (E6 — the dictionary has ONE entry for direction, not two). */
const DELTA_TEXT: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
  flat: "text-ink",
};

/** The redundant, non-colour channel. Flat gets no glyph at all rather than a meaningless one. */
const DELTA_GLYPH: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  flat: "",
};

export type DeltaChipProps = {
  /**
   * The signed move, ALREADY FORMATTED — "+8.2%", "-0.55%". This component never formats a number:
   * formatting lives in lib/format, and it is the caller who knows whether this is a percent, a
   * price or a multiple.
   */
  value: string;
  direction: Direction;
  /**
   * The window the delta was measured over — "1D", "vs prior week". Required, and deliberately so
   * (ruling C2): there is no such thing as a delta without a period, and a chip that let the caller
   * omit it would let the caller ship one.
   */
  window: string;
  scale?: DeltaScale;
  /** `chip` (default) stands alone with its own wash; `inline` sits inside another chip. See above. */
  variant?: DeltaVariant;
};

export function DeltaChip({
  value,
  direction,
  window: over,
  scale = "sm",
  variant = "chip",
}: DeltaChipProps) {
  return (
    <span
      data-p2
      className={cx(
        // The wrap contract is in BOTH variants, because the bug it prevents is in both.
        "flex max-w-full flex-wrap items-baseline gap-x-0.5 gap-y-0 font-mono",
        CHIP_SCALE[scale],
        variant === "chip"
          ? cx("rounded-chip px-1.5 py-0.5", DELTA_CHIP[direction])
          : // Inline: the colour, and nothing else. The wash belongs to the chip around it.
            DELTA_TEXT[direction],
      )}
    >
      {/* ATOM 1 — the signed delta. The glyph is aria-hidden: the signed value beside it already
       * says "up" or "down" out loud, so announcing "black up-pointing triangle" would be noise. */}
      <span className="whitespace-nowrap">
        {direction !== "flat" ? (
          <span aria-hidden="true" className="pr-0.5">
            {DELTA_GLYPH[direction]}
          </span>
        ) : null}
        {value}
      </span>

      {/*
       * ATOM 2 — the window. Quieter by SIZE and WEIGHT, never by opacity, and that is not a style
       * preference: this span carried `opacity-80` until N2, which composites the text toward its
       * background and dropped it under AA at this size. `faint` is for placeholders and disabled
       * states, never for information (drift rule 18) — and a number's unit IS information. It is
       * half the fact, not an annotation on it.
       */}
      <span className="whitespace-nowrap pl-1 text-2xs font-normal">· {over}</span>
    </span>
  );
}
