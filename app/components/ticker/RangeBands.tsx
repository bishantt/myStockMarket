import { copy, fill } from "@/lib/copy";
import { signedPercent } from "@/lib/format";
import { buildLadder, type LadderBand, type LadderRow } from "@/lib/range-ladder";

/**
 * RangeBands — the Range Ladder. The app's visual centrepiece, and its most dangerous drawing.
 *
 * Every other product draws this as a forward-widening cone: a fan opening to the right of today's
 * price. That silhouette IS the visual grammar of a projection. The eye reads it as "the future
 * goes that way, and here is how sure we are", and no caption underneath undoes that. It is the
 * exact expectation this product exists to refuse.
 *
 * So the same information is SLICED. One row per horizon, each a horizontal band on a signed-return
 * axis, with a strong zero line labelled "0% = last close". Uncertainty visibly grows with time —
 * the most useful thing this chart has to teach — and nothing anywhere points forward.
 *
 * The honesty furniture is not an annotation on this chart. It is the chart:
 *   · there is NO 50th-percentile mark. Not a stroke, not a tick, not a label. A median line is a
 *     point forecast in an interval's clothing. The geometry function does not even return one.
 *   · NOTHING joins the rows. Draw a silhouette across them and the cone is back.
 *   · every row prints its N and its window. A range without its sample size is an assertion.
 *   · the pinned frequency sentence and the regime caveat ride on every row. A band without its
 *     caveat is a forecast (§1.5, rule 1).
 *   · the twenty dots ARE the texture: a reader can count how many past paths ended below zero.
 *
 * It is `data-p2`, and it does not move — not even a fade. A candle chart may fade in, because a
 * chart is a record and fading in a completed record is showing a photograph. A range band is a
 * CLAIM about uncertainty, and any entrance treatment reads as "the forecast is arriving". Records
 * may appear. Claims are simply there.
 *
 * Beneath the SVG sits the same data as text (the accessible equivalent) — screen readers and any
 * no-SVG fallback get the identical numbers, so the picture and the prose can never drift apart.
 */

/**
 * The drawing units.
 *
 * The x-axis spans 0–100 (the geometry function's coordinate space), so these heights are in the
 * SAME units — which is what keeps the SVG's aspect ratio honest and, critically, keeps the quantile
 * dots CIRCULAR. The first version of this component stretched the viewBox with
 * `preserveAspectRatio="none"` to fill the container width, which scaled x about six times more than
 * y and turned every dot into an overlapping ellipse. A dot you cannot count is not a dotplot.
 */
const ROW_HEIGHT = 8;
const BAND_HEIGHT = 4.6;
const DOT_RADIUS = 0.85;

export function RangeBands({ bands }: { bands: LadderBand[] }) {
  const ladder = buildLadder(bands);
  if (ladder.rows.length === 0) return null;

  const height = ladder.rows.length * ROW_HEIGHT;

  return (
    <section data-p2 aria-label="Typical range" className="flex flex-col gap-3">
      <h2 className="font-display text-title font-bold text-ink">Typical range</h2>

      {/*
       * Uniform scaling — no preserveAspectRatio override. The SVG fills the available width and
       * takes whatever height that implies, so a circle drawn as a circle stays one.
       */}
      <svg
        viewBox={`0 0 100 ${height}`}
        role="img"
        aria-label="Historical ranges by horizon, as returns from the last close"
        className="h-auto w-full"
      >
        {ladder.rows.map((row, index) => {
          const top = index * ROW_HEIGHT;
          const bandTop = top + (ROW_HEIGHT - BAND_HEIGHT) / 2;
          const midline = bandTop + BAND_HEIGHT / 2;

          return (
            <g key={row.horizonDays}>
              {/* The 80% range — the honest headline. */}
              <rect
                x={row.outer.x}
                y={bandTop}
                width={row.outer.width}
                height={BAND_HEIGHT}
                fill="var(--color-band-outer)"
                stroke="var(--color-hairline-strong)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />

              {/* The 50% range, nested inside it. Texture, not a claim of its own. */}
              <rect
                x={row.inner.x}
                y={bandTop}
                width={row.inner.width}
                height={BAND_HEIGHT}
                fill="var(--color-band-inner)"
              />

              {/*
               * The twenty dots: one per 1-in-20 past outcome. Above zero filled, below zero HOLLOW
               * with a full-opacity stroke — the shape channel has to survive at this size, because
               * a colourblind reader must still be able to count the losses.
               */}
              {row.dots.map((dot, i) => (
                <circle
                  key={i}
                  cx={dot.x}
                  cy={midline}
                  r={DOT_RADIUS}
                  fill={dot.above ? "var(--color-up)" : "none"}
                  stroke={dot.above ? "none" : "var(--color-down)"}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.9}
                />
              ))}

              {/*
               * Zero — the last close. The ladder's one strong anchor, and the only ink line on the
               * chart. There is deliberately no line anywhere else: in particular, none at the 50th
               * percentile, which is where a forecast would go.
               */}
              <line
                x1={row.zeroX}
                y1={bandTop - 0.8}
                x2={row.zeroX}
                y2={bandTop + BAND_HEIGHT + 0.8}
                stroke="var(--color-ink)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      <p className="font-mono text-2xs text-muted">0% = last close · {copy.dotplot.caption}</p>

      {/*
       * The accessible equivalent, and the no-SVG fallback. It is not a summary of the chart — it is
       * the same numbers, so the two can never drift. Every row carries the pinned frequency
       * sentence, its sample size, and its window.
       */}
      <ul className="flex flex-col gap-2 pt-1">
        {ladder.rows.map((row) => (
          <RowText key={row.horizonDays} row={row} />
        ))}
      </ul>

      {/* The regime-break caveat. A band without it is a forecast (§1.5, rule 1). Never omitted. */}
      <p className="max-w-[62ch] font-ui text-2xs text-muted">{copy.volband.caveat}</p>
    </section>
  );
}

/**
 * One horizon, in words and numbers — the text the SVG is a picture of.
 *
 * THE SENTENCE HAS A FLOOR, AND IT IS LOAD-BEARING (fixed in PD3, found by the pixel oracle).
 *
 * This row is a `flex-wrap` line of four things: the horizon, the range, the plain-English sentence,
 * and the sample size. The sentence used to be `min-w-0 flex-1` — which is `flex: 1 1 0%`, a
 * flex-basis of **zero**. A flex item whose hypothetical size is zero can never cause the line to
 * WRAP; it can only be CRUSHED. So the row's behaviour depended on a knife edge:
 *
 *   · narrow enough, and the `shrink-0` sample-size caption wrapped to its own line, leaving the
 *     sentence the full width. Three tidy lines. This is what every baseline in the suite showed.
 *   · eight pixels wider, and the row decided all four items "fitted" — because the sentence could
 *     shrink to nothing to make room — so the caption stayed put and the sentence was squeezed into
 *     a column about one word across. "In / the / past, / 8 / in / 10 / 5- / day / paths / from /
 *     here..." rendered vertically, one word per line, for every horizon.
 *
 * PD3 moved the styleguide's gutter by four pixels and the Range Ladder fell straight into the bad
 * band — which is how a fragility that had been sitting in a P2 PROBABILITY VISUAL the whole time
 * finally showed itself. The ticker's own baselines never moved, so nothing had ever failed. The
 * component was one browser resize away from turning the app's honesty surface into word soup.
 *
 * `min-w-[18ch]` gives the sentence a real minimum, and a flex item's min-width DOES participate in
 * line breaking (the hypothetical main size is the flex base size clamped by min/max). So when there
 * is no longer room for eighteen characters of sentence beside everything else, the line WRAPS —
 * which is what it always meant to do — instead of crushing the one part of the row a human reads.
 */
function RowText({ row }: { row: LadderRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline pt-2">
      <span className="w-10 shrink-0 font-mono text-sm text-ink">{row.horizonDays}d</span>
      <span className="font-mono text-sm text-ink-2">
        {signedPercent(row.lo)} to {signedPercent(row.hi)}
      </span>
      <span className="min-w-[18ch] flex-1 font-ui text-2xs text-muted">
        {fill(copy.volband.label, { h: String(row.horizonDays) })}
      </span>
      <span className="shrink-0 font-mono text-2xs text-muted">
        n={row.n} · {row.windowDays}d window
      </span>
    </li>
  );
}
