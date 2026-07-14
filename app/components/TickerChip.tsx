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
 * THE DOOR'S BOX IS THE TOUCH TARGET, AND IT IS 44px (PD6). THE CHIP YOU SEE IS STILL 21px.
 *
 * ── THE BUG, AND IT WAS ALREADY IN PRODUCTION WHEN PD6 FOUND IT ──────────────────────────────────
 *
 * A `door` is a CONTROL. Every control in this app is at least 44px on touch — it is in the
 * constitution, the phone sweep enforces it, and a 21px link is a link a thumb cannot reliably hit.
 *
 * The chip shipped at **34×21px**. PD6 put doors on the paper ledger, the track record and the
 * watchlist, and the sweep failed all three instantly — which is the guard working. But the same
 * 21px door had ALREADY been live on the news story page's affected-tickers table since PD5, and the
 * sweep had passed it every single night.
 *
 * IT PASSED BECAUSE IT NEVER LOOKED. The touch sweep visits ONE story, `nc-fed-hold`, and that
 * cluster has **zero** catalyst links in the seeded world — so the affected table renders no rows,
 * so there were no chips to measure, so the room reported clean. The rule was being kept by the
 * shape of a fixture. That is the same law this phase keeps meeting: **a guard only guards what it
 * is pointed at.**
 *
 * ── THE FIX, AND WHY IT IS NOT `min-h-11` ON THE CHIP ────────────────────────────────────────────
 *
 * Making the CHIP 44px tall would put a 44px pill in every table cell and destroy the density that
 * makes a table readable. So the anchor and the chip become two different boxes: the `<Link>` is an
 * invisible 44px-tall hit area, and the visual chip sits inside it, unchanged at 21px. The reader
 * sees the same chip; the thumb gets a target it can actually land on.
 *
 * This costs nothing in a table — a `<td>` is already ~45px tall with its padding, so the row does
 * not grow. That is exactly why the door belongs in tables and NOT on the scans index's three-row
 * teaser, whose rows are shorter than the target and would have to grow to hold one.
 */
const DOOR_HIT_AREA =
  "group inline-flex min-h-11 max-w-full items-center align-middle " +
  "focus-visible:rounded-chip focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent";

/**
 * The door's hover, and every one of these is a colour — never a motion. It lives on the visual chip
 * (the hit area is invisible and must stay that way), driven by `group-hover` from the anchor, so
 * hovering anywhere in the 44px box lights the chip the reader can actually see.
 */
const DOOR_VISUAL = "cursor-pointer group-hover:border-accent group-hover:bg-accent-muted";

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
    <Link href={`/ticker/${encodeURIComponent(symbol)}`} className={DOOR_HIT_AREA}>
      <span className={cx(SHELL, DOOR_VISUAL)}>{body}</span>
    </Link>
  );
}
