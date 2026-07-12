/**
 * range-ladder.ts — the geometry of the Range Ladder (UI-REDESIGN-PLAN §3.8, §5.5).
 *
 * The ladder is the app's visual centrepiece, and it is deliberately NOT the chart every other
 * product draws here. The conventional shape is a forward-widening cone: a fan spreading out to the
 * right of today's price. That silhouette IS the visual grammar of a projection — the eye reads it
 * as "the future goes that way, and here is how confident we are" — no matter what the caption says.
 *
 * So the same information is sliced instead. One row per horizon (5, 10, 20 days), each row a
 * horizontal band on a SIGNED-RETURN axis, with a strong zero line labelled "0% = last close".
 * Nothing joins the rows. The reader can see uncertainty growing with time — the most useful thing
 * this chart has to teach — without ever being shown a path into the future.
 *
 * Two rules are enforced by the shape of the data this module returns, not merely by the component
 * that draws it:
 *
 *   1. **There is no 50th percentile.** No field holds one, so no renderer can draw one. A median
 *      mark is a point forecast wearing an interval's clothes.
 *   2. **There is no connecting silhouette.** No field describes a path across rows, so none can be
 *      stroked. Join the bands and the cone is back.
 *
 * This module computes pure geometry in a 0–100 coordinate space. The SVG scales it.
 */

/** One stored band from the pipeline: an empirical quantile range of past h-day paths. */
export type LadderBand = {
  horizonDays: number;
  /** 0.8 (the outer band) or 0.5 (the inner one). */
  coverage: number;
  /** The range as signed fractions of the last close: -0.043 is 4.3% below it. */
  lo: number;
  hi: number;
  label: string;
  /** How many historical paths the band was computed from, and over what window. */
  n: number;
  windowDays: number;
};

/** A drawn band, in the 0–100 coordinate space. */
export type BandGeometry = { x: number; width: number };

/** One of the twenty equal-probability outcomes, placed on the axis. */
export type LadderDot = { x: number; above: boolean };

export type LadderRow = {
  horizonDays: number;
  label: string;
  n: number;
  windowDays: number;
  /** The 80% range. */
  outer: BandGeometry;
  /** The 50% range, nested inside it. */
  inner: BandGeometry;
  /** Where zero — the last close — falls. Identical on every row, by construction. */
  zeroX: number;
  /** Twenty dots: one per 1-in-20 historical outcome, spread across the outer band. */
  dots: LadderDot[];
  /** The raw bounds, for the text/table equivalent that screen readers read. */
  lo: number;
  hi: number;
  innerLo: number;
  innerHi: number;
};

export type Ladder = {
  rows: LadderRow[];
  /** The shared zero anchor. */
  zeroX: number;
};

/** The product's hard stop. A band beyond twenty days is not shown, by law (§1.5, rule 1). */
const MAX_HORIZON_DAYS = 20;

/** Twenty dots — each one a 1-in-20 slice of the historical outcomes (§3.8). */
const DOT_COUNT = 20;

/** A little breathing room at each end so the widest band does not touch the frame. */
const AXIS_PADDING = 0.08;

/**
 * Build the ladder's geometry from the bands the pipeline stored.
 *
 * Every row is scaled against ONE shared axis, spanning the widest band on the chart. That is what
 * makes the rows comparable — and it is the whole point. Autoscaling each row to its own width
 * would draw the 5-day and the 20-day ranges the same size, hiding the fact that uncertainty grows
 * with the horizon. The reader would learn nothing, in a chart that looked informative.
 */
export function buildLadder(bands: LadderBand[]): Ladder {
  const horizons = [...new Set(bands.map((b) => b.horizonDays))]
    .filter((h) => h <= MAX_HORIZON_DAYS)
    .sort((a, b) => a - b);

  // A row IS its outer band: without the 80% range there is nothing to draw and nothing to say.
  const usable = horizons
    .map((horizonDays) => ({
      horizonDays,
      outer: bands.find((b) => b.horizonDays === horizonDays && b.coverage === 0.8),
      inner: bands.find((b) => b.horizonDays === horizonDays && b.coverage === 0.5),
    }))
    .filter((row): row is { horizonDays: number; outer: LadderBand; inner: LadderBand | undefined } =>
      row.outer !== undefined,
    );

  if (usable.length === 0) return { rows: [], zeroX: 50 };

  // The shared axis: symmetric around zero, wide enough for the widest band on the chart. Symmetry
  // matters — an axis skewed to fit an asymmetric range would put zero off-centre and make an
  // ordinary distribution look directional.
  const extent =
    Math.max(...usable.flatMap((r) => [Math.abs(r.outer.lo), Math.abs(r.outer.hi)])) *
    (1 + AXIS_PADDING);

  /** Map a signed return onto the 0–100 axis. */
  const toX = (value: number) => 50 + (value / extent) * 50;
  const zeroX = toX(0);

  const rows: LadderRow[] = usable.map(({ horizonDays, outer, inner }) => {
    const outerGeom: BandGeometry = { x: toX(outer.lo), width: toX(outer.hi) - toX(outer.lo) };
    // A horizon with no 50% band still draws: the inner band collapses to the zero line rather than
    // the row vanishing. The 80% range is the honest headline; the 50% is the texture.
    const innerLo = inner ? inner.lo : 0;
    const innerHi = inner ? inner.hi : 0;
    const innerGeom: BandGeometry = { x: toX(innerLo), width: toX(innerHi) - toX(innerLo) };

    return {
      horizonDays,
      label: outer.label,
      n: outer.n,
      windowDays: outer.windowDays,
      outer: outerGeom,
      inner: innerGeom,
      zeroX,
      dots: quantileDots(outer.lo, outer.hi, toX, zeroX),
      lo: outer.lo,
      hi: outer.hi,
      innerLo,
      innerHi,
    };
  });

  return { rows, zeroX };
}

/**
 * Twenty dots across the outer band — a quantile dotplot, embedded in the row.
 *
 * Each dot is one 1-in-20 historical outcome, placed at the midpoint of its slice. The honesty
 * furniture literally becomes the texture of the chart: a reader can see, and count, that four of
 * these twenty past paths ended below the last close.
 *
 * The dots are spread evenly across the 80% range rather than drawn from the true empirical
 * quantiles, because the pipeline stores the range bounds, not the full distribution. That is a
 * simplification and it is worth being honest about: the dots communicate "twenty equally likely
 * outcomes, spanning this range", which is exactly what the caption claims, and nothing more.
 */
function quantileDots(
  lo: number,
  hi: number,
  toX: (value: number) => number,
  zeroX: number,
): LadderDot[] {
  return Array.from({ length: DOT_COUNT }, (_, i) => {
    const fraction = (i + 0.5) / DOT_COUNT;
    const value = lo + (hi - lo) * fraction;
    const x = toX(value);
    return { x, above: x >= zeroX };
  });
}
