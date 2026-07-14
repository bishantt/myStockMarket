import { Disclosure } from "@/components/Disclosure";
import { copy } from "@/lib/copy";
import { SectionMasthead } from "@/components/SectionMasthead";
import { RailTrigger } from "@/components/rail/Rail";
import { TickerChip } from "@/components/TickerChip";
import { DeltaChip } from "@/components/DeltaChip";
import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

/**
 * Watchlist — Desk module 05, the focus list (plan §9.2, §3.6).
 *
 * Pros cap attention deliberately: an unbounded list produces scattered, emotional decisions, so
 * the focus list is capped at three names (the cap itself is explained in the UI, and enforced by
 * the write path, not shown here). Each name carries a required written reason — the app makes the
 * user articulate why they are watching it. RVOL rides on the row because it is a base rate in
 * disguise: "is this name unusually active today?".
 */

export type WatchRow = {
  symbol: string;
  name: string;
  /** The user's written reason for watching it (required). */
  reason: string;
  /** The last close, already formatted. */
  price: string;
  changePct: string;
  direction: Direction;
  rvol: string;
  isFocus: boolean;
  /**
   * True when this symbol has an unresolved fired signal. Forces the row into the visible set (see
   * splitWatchlist). No producer sets this yet — the marker's own producer has never been built.
   */
  hasFiredSignal?: boolean;
  /** A small set of recent closes for the sparkline (already numeric). */
  spark: number[];
};


/**
 * A tiny inline sparkline: a stroke in the direction's colour, over a soft area fill.
 *
 * Two things about it are worth stating, because they look like rule violations and are not:
 *
 * 1. **It is coloured by direction, and colour is its only channel.** That is legal HERE, and only
 *    here, because the price and the delta chip sit immediately beside it — carrying the triangle,
 *    the sign, and the number. The sparkline is a shape that a redundant, colourblind-safe delta is
 *    already saying out loud. Move it away from that delta and it stops being legal. (§3.8.)
 *
 * 2. **It is a record, not a forecast**, so it may render at all: fourteen days of history, drawn
 *    complete. It never sweeps or draws in — a left-to-right reveal on a price series reads as
 *    momentum, as "…and then", which is precisely the expectation this product refuses to create.
 *
 * It is aria-hidden: the numbers it summarises are already on the row in text.
 */
function Sparkline({ points, direction }: { points: number[]; direction: Direction }) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * 100,
    y: 100 - ((p - min) / range) * 100,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  // The area closes the path down to the baseline, so the fill has something to fill.
  const area = `${line} L100,100 L0,100 Z`;

  const stroke = direction === "down" ? "text-down" : "text-up";
  const fill = direction === "down" ? "url(#spark-down)" : "url(#spark-up)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cx("h-9 w-20 shrink-0", stroke)}
    >
      <defs>
        <linearGradient id="spark-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-up)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-up)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-down)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--color-down)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Which rows stay in view, and which fold away (§4.1).
 *
 * The focus names are the point of this module, so they are always visible. Everything else folds.
 *
 * AND THE FIRED-SIGNAL RULE, WHICH IS DORMANT BY DESIGN: a row whose symbol has an unresolved fired
 * signal FORCES ITSELF into the visible set — even past the focus cap — and decrements the
 * disclosure's count. The marker exists to be seen; a warning behind a fold is not a warning (M2's
 * list). The producer for that marker does not exist yet (nothing in the tree renders a fired-signal
 * flag today; the redesign specced it and nothing has ever set it), so this branch is currently
 * unreachable. It is built now, with its slot, so that the day the marker lands it is already
 * impossible to hide it. PROGRESS.md records the dependency so this is never mistaken for dead code.
 */
function splitWatchlist(rows: WatchRow[]): { visible: WatchRow[]; folded: WatchRow[] } {
  const visible = rows.filter((r) => r.isFocus || r.hasFiredSignal === true);
  const folded = rows.filter((r) => !r.isFocus && r.hasFiredSignal !== true);
  return { visible, folded };
}

export function Watchlist({ asOf, rows }: { asOf: Date; rows: WatchRow[] }) {
  const { visible, folded } = splitWatchlist(rows);

  return (
    <section aria-label="Watchlist">
      <SectionMasthead index={5} title="Focus watchlist" asOf={asOf} />

      {rows.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">
          Nothing on the watchlist yet. Add a name and the reason you are watching it.
        </p>
      ) : (
        <>
        <ul className="pt-2">
          {visible.map((r) => (
            <li key={r.symbol} className="border-b border-hairline last:border-b-0">
              <WatchRowBody row={r} />
            </li>
          ))}
        </ul>

        {folded.length > 0 ? (
          <Disclosure label={copy.disclosure.watchlist} count={folded.length}>
            <ul>
              {folded.map((r) => (
                <li key={r.symbol} className="border-b border-hairline last:border-b-0">
                  <WatchRowBody row={r} />
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}

        {/*
         * THE SPARKLINE'S WINDOW, STATED ONCE (ruling C2, and the plan's own exception to it).
         *
         * Until now the sparkline was the least honest thing on the Desk: a line with no axis, no
         * scale and no period — a shape that says "up" or "down" over some unstated stretch of time.
         * A reader could not tell if they were looking at a month or a year, and the shape means
         * completely different things depending on which.
         *
         * It gets a caption rather than a per-row token, and that is deliberate: every row's spark
         * covers the SAME window, so repeating "30 sessions" thirty times would stutter without
         * adding a single fact. C2 asks for the window in the same visual unit as the number, and
         * where all the rows share one window, the unit is the module.
         */}
        <p className="pt-3 font-mono text-2xs text-muted">{copy.watchlist.sparkCaption}</p>
        </>
      )}
    </section>
  );
}

/**
 * One watchlist row: the name, its move, and — always — the WRITTEN REASON the reader is watching it.
 * The reason is not decoration. A watchlist without reasons is a list of tickers, which is a list of
 * temptations; with them it is a record of thinking that can be checked against what happened.
 */
function WatchRowBody({ row: r }: { row: WatchRow }) {
  return (
<RailTrigger
                payload={{
                  symbol: r.symbol,
                  name: r.name,
                  changePct: r.changePct,
                  direction: r.direction,
                  rvol: r.rvol,
                  note: r.reason,
                }}
                /*
                 * INSTANT, not eased — the same ruling as Movers, for the same reason. This row's
                 * delta chip is a DeltaChip now, so it carries `data-p2`, and a `transition-colors`
                 * over a money visual is what drift rule 6 and the P2 ancestor walk both exist to
                 * catch. The hover still lands; it simply lands at once.
                 */
                className="flex items-center gap-3 rounded-panel px-2 py-2.5 hover:bg-accent-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Label mode: the row is a <button> that opens the rail. See Movers. */}
                    <TickerChip symbol={r.symbol} />
                    {r.isFocus ? (
                      <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">focus</span>
                    ) : null}
                  </div>
                  <span className="block truncate pt-1 font-ui text-2xs text-muted">{r.reason}</span>
                </div>
                <Sparkline points={r.spark} direction={r.direction} />

                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-mono text-sm text-ink">{r.price}</span>
                  {/* The window rides inside the chip (C2) — see the same rule in Movers. */}
                  <DeltaChip
                    value={r.changePct}
                    direction={r.direction}
                    window={copy.window.d1}
                    scale="xs"
                  />
                </span>
              </RailTrigger>
  );
}
