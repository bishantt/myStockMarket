import { cx } from "@/lib/cx";

/**
 * Skeleton — what a room looks like in the half-second before it arrives (APP-FEEL-PLAN §3.5).
 *
 * Before F1 there was no such half-second and no such component, and that was the whole problem:
 * with no loading boundary anywhere, a tapped room simply did not appear until the server had
 * finished, so the reader sat looking at the room they were trying to leave — frozen, for up to
 * 1.3 seconds, with no sign that anything had happened. A skeleton is not decoration here. It is
 * the difference between "this is loading" and "this is broken".
 *
 * THE ONE RULE THAT SHAPES EVERY VARIANT (ruling M4). A bone may stand for a CONTAINER — a
 * masthead, a run of prose, a row, a card. A bone may NEVER stand for a FIGURE.
 *
 *   · `masthead`, `text`, `row` — containers. They shimmer, quietly (the sanctioned 1.6s pulse).
 *   · `figure` — a slot where a price, a percentage or a probability is about to appear. It renders
 *     a STILL em-dash. Not a shimmering bar. A pulsing rectangle exactly where a number is coming
 *     reads as "something is about to happen here, watch this space" — it manufactures anticipation
 *     around money, which is the precise thing the stillness rule (P2) exists to forbid. The
 *     em-dash is also not new: it is the quiet placeholder this app already prints for a number it
 *     does not have.
 *   · `block` — a reservation for a chart or another figure-bearing visual. Still geometry, no
 *     shimmer. The candle chart is a money visual by this codebase's own record ("the chart is a
 *     money visual, and money visuals do not move"), so a 1.6s pulse filling its 420px slot would
 *     be the largest stillness violation in the product.
 *
 * Heights mirror the real thing, so that when the content lands nothing jumps (budget B5).
 */

type SkeletonProps = {
  /** masthead/text/row are containers and shimmer; block and figure never do (M4). */
  variant: "masthead" | "text" | "row" | "block" | "figure";
  /** `text`: how many bars. Each is a different width, because real prose is ragged. */
  lines?: number;
  /** `block`: the height in pixels to reserve — match the real element or CLS is the price. */
  height?: number;
  className?: string;
};

/** The widths a run of prose actually has. A stack of identical bars reads as a table, not text. */
const TEXT_WIDTHS = ["92%", "78%", "85%", "64%", "88%", "72%"];

export function Skeleton({ variant, lines = 3, height = 200, className }: SkeletonProps) {
  if (variant === "figure") {
    // A number that has not arrived. Still, quiet, and honest — it says "no value yet", which is
    // true, rather than "a value is coming", which is a promise a loading state cannot keep.
    return (
      <span
        data-slot="figure"
        aria-hidden="true"
        className={cx("block font-mono text-num-lg leading-none text-muted", className)}
      >
        —
      </span>
    );
  }

  if (variant === "block") {
    // Geometry, not animation: hold the space the chart will occupy and do nothing else.
    return (
      <div
        aria-hidden="true"
        style={{ height }}
        className={cx("w-full rounded-card border border-hairline", className)}
      />
    );
  }

  if (variant === "masthead") {
    return (
      <div aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-3">
          <div className="skeleton-bone shimmer h-3 w-6 rounded-control" />
          <div className="skeleton-bone shimmer h-3 w-32 rounded-control" />
        </div>
        <div className="h-px bg-hairline" />
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div aria-hidden="true" className={cx("flex items-center justify-between gap-4 py-3", className)}>
        <div className="skeleton-bone shimmer h-3 w-16 rounded-control" />
        <div className="skeleton-bone shimmer h-3 w-24 rounded-control" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          style={{ width: TEXT_WIDTHS[i % TEXT_WIDTHS.length] }}
          className="skeleton-bone shimmer h-3 rounded-control"
        />
      ))}
    </div>
  );
}
