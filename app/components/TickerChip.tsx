import Link from "next/link";

import { DeltaChip } from "@/components/DeltaChip";
import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

/**
 * TickerChip — every ticker symbol in this app, rendered one way (PD5, plan §8.2.1).
 *
 * A symbol is a thing with an identity: it is mono, it is a chip, and when it is a door it says so
 * with colour, because colour means interactivity here and nothing else (E6). Before PD5 a symbol
 * was a bare mono span on the Desk, a bordered chip with a move on a news card, and a bare accent
 * link in an affected table — three treatments for one kind of fact, which is how a design system
 * dies. Now there is one.
 *
 * ── TWO MODES, AND THE REASON IS HTML, NOT TASTE ─────────────────────────────────────────────────
 *
 * `door` renders a `<Link>` to /ticker/SYMBOL. Without it, the chip is a plain `<span>`.
 *
 * The label mode is not a lesser variant, it is a REQUIREMENT, and three of the five consumers need
 * it:
 *
 *   · A NEWS CARD is itself one big `<Link>` to the story. An anchor inside an anchor is invalid
 *     HTML — the browser closes the outer one where the inner begins, and what the reader gets is
 *     a card whose bottom half has silently stopped being clickable.
 *   · A MOVERS ROW and a WATCHLIST ROW are `<button>`s (the rail trigger). A link inside a button
 *     is the same illegal nesting wearing a different hat, and it also steals the row's own job:
 *     tapping a mover opens the RAIL — the level-2 peek — not the full page. The rail has its own
 *     exit to /ticker/, which is where that journey belongs.
 *
 * So the chip renders identically either way and only its INTERACTIVITY changes, which is exactly
 * the right split: the symbol looks like a symbol wherever it appears, and it is a door only where
 * a door is legal and wanted.
 *
 * ── THE SINGLE DOOR (drift rule 26) ──────────────────────────────────────────────────────────────
 *
 * This file mints the /ticker/ href, and it is one of only two places allowed to (the other is the
 * rail's exit CTA, argued in the rule itself). The symbol is URL-encoded on the way out — a symbol
 * arrives from a database row, and a row is not a promise about URL-safe characters.
 *
 * ── P2: THE MOVE IS MONEY (Q-G4-1, ruled at PD5) ─────────────────────────────────────────────────
 *
 * The optional trailing move renders through DeltaChip, which carries `data-p2`. That is the ruling
 * Q-G4-1 asked for, and it is the first time in this build that a HOVERABLE element and a P2 FIGURE
 * are the same piece of UI. They reconcile, and here is the seam:
 *
 *   · The chip's hover is a WASH and a BORDER — background and border colour, applied INSTANTLY. A
 *     wash is chrome; it signals a door.
 *   · The NUMBER does not react to the cursor at all. No transform, no scale, no translate, and no
 *     colour transition on the figure — the delta keeps its semantic colour, hovered or not.
 *   · Nothing containing the number transitions. There is no `transition` class in this file, and
 *     drift rule 6 fails the build if one appears (TickerChip is a P2 file).
 *
 * The alternative — drop `data-p2` so the chip could animate freely — trades a permanent honesty
 * guarantee for a hover effect. A number that reacts to the cursor is a number that looks like it is
 * doing something, and this app's whole thesis is that it isn't.
 */

export type TickerMove = {
  /** The signed move, already formatted — "+2.1%". */
  value: string;
  direction: Direction;
  /** The window it was measured over — "1D". Required, like every delta's (ruling C2). */
  window: string;
};

export type TickerChipProps = {
  symbol: string;
  /**
   * Render the chip as a doorway to /ticker/SYMBOL. Omit wherever an ancestor is already
   * interactive — a news card's link, a mover row's rail button — because nesting one would be
   * invalid HTML (see the header).
   */
  door?: boolean;
  /** The optional trailing move. It is money, so it renders through DeltaChip and never moves. */
  move?: TickerMove;
};

/**
 * The chip's shell, shared by both modes so the symbol looks identical whether or not it is a door.
 * `flex-wrap` + `max-w-full`: a chip carrying a move is a symbol AND a delta, and in a narrow cell
 * the delta drops below the symbol rather than spilling under the card next door.
 */
const SHELL =
  "inline-flex max-w-full flex-wrap items-center gap-1 rounded-chip border border-hairline " +
  "bg-surface px-1.5 py-0.5 align-middle font-mono text-2xs";

/** The symbol itself: mono 500 (a weight the type system actually loads), ink, never wrapped. */
const SYMBOL = "whitespace-nowrap font-medium text-ink";

/**
 * The door's hover and focus, and every one of these is a colour or an outline — never a motion.
 * `group-hover` recolours the SYMBOL only, so the delta beside it keeps its semantic colour and the
 * figure stays exactly as still as P2 demands.
 */
const DOOR =
  "group cursor-pointer hover:border-accent hover:bg-accent-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const DOOR_SYMBOL = "group-hover:text-accent-deep group-focus-visible:text-accent-deep";

export function TickerChip({ symbol, door = false, move }: TickerChipProps) {
  const body = (
    <>
      <span className={cx(SYMBOL, door && DOOR_SYMBOL)}>{symbol}</span>
      {move ? (
        // `inline`: the wash and padding belong to the chip we are already inside. A second wash
        // here would be a pill inside a pill.
        <DeltaChip
          value={move.value}
          direction={move.direction}
          window={move.window}
          scale="xs"
          variant="inline"
        />
      ) : null}
    </>
  );

  if (!door) {
    return <span className={SHELL}>{body}</span>;
  }

  return (
    <Link href={`/ticker/${encodeURIComponent(symbol)}`} className={cx(SHELL, DOOR)}>
      {body}
    </Link>
  );
}
