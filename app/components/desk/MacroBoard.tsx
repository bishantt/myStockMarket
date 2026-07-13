import { Shelf, ShelfItem } from "@/components/Shelf";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { MoodGauge } from "@/components/desk/MoodGauge";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";
import type { MacroBoard as MacroBoardData, MacroCell } from "@/lib/macro-board";

/**
 * MacroBoard — the five household stats inside the Macro Pulse (Part 6.7).
 *
 * The module above this board answers "what did the market do?". This board answers the questions
 * the market cannot: what does a mortgage cost, what did prices actually do, what is gold worth,
 * what is a dollar worth in rupees — and, in the one number here that is ours, how does the market
 * feel. Household costs come first, because that is the reader's own life; the market's own prices
 * follow.
 *
 * WHAT THE STATES LOOK LIKE, AND WHY ONE OF THEM IS LOUD
 *
 * A cell that is current renders quietly, with its window label doing the honest work — a Thursday
 * mortgage rate on a Tuesday is not stale, it is the newest rate that exists. A cell whose number is
 * old enough to mislead goes AMBER and says the word "stale" out loud. That escalation is the same
 * one the pipeline strip established in N2: quiet when things are normal, loud only when the news is
 * genuinely bad — and the loudness always carried by a WORD as well as a colour, so that a
 * screen-reader user is never handed this app's calmest voice on one of its worse nights.
 *
 * Amber here is a sanctioned addition to the reserved-alert consumer list (drift rule 5), argued and
 * logged: a macro number three cadences past its last publication is a real degradation, which is
 * precisely what the reserved amber is reserved FOR.
 */

export function MacroBoard({ board }: { board: MacroBoardData }) {
  return (
    <div className="flex flex-col gap-4 border-t border-hairline pt-4">
      {/*
       * BELOW md: THE MODULE'S SECOND SHELF — the four STATS, and only them.
       *
       * THE GAUGE IS NOT ON THIS SHELF, AND THE FIRST BASELINE IS WHY. It was, briefly. A shelf
       * stretches every card to the height of its tallest, and the gauge — a score, a position
       * strip, two sentences that may never be folded away, and a disclosure — is roughly three
       * times the height of "6.72% · wk of Jul 9". So the four stat cards were padded out with some
       * two hundred pixels of white space each, and the phone Desk grew by 347px to display four
       * short facts and a lot of nothing. That is the footprint disease this very plan was
       * commissioned to cure, reintroduced two phases later, and it was invisible in every test:
       * the DOM was correct, the numbers were right, and only the photograph showed it.
       *
       * The mistake underneath it was a category error. F5's triage says GLANCE stations get bounded
       * and READ stations stay vertical. The four stats are glances — a label, a figure, a window.
       * The gauge is something you READ. It was never shelf material.
       */}
      <div className="md:hidden">
        {/* M8: the count states what is off the edge — the four stats. */}
        <Shelf
          label="Money and mood"
          countLine={fill(copy.pulse.moneyShelf, { n: board.cells.length })}
        >
          {board.cells.map((cell) => (
            <ShelfItem key={cell.key} className="w-[170px]">
              <Surface className="h-full p-3">
                <Cell cell={cell} />
              </Surface>
            </ShelfItem>
          ))}
        </Shelf>
      </div>

      {/*
       * ≥md: the row. Desktop has the width, and a horizontal scroller there is a toy.
       */}
      <div className="hidden flex-wrap gap-x-10 gap-y-4 md:flex">
        {board.cells.map((cell) => (
          <Cell key={cell.key} cell={cell} />
        ))}
      </div>

      {/*
       * The gauge, full width, below the stats — at every size.
       *
       * It reads as what it is: a small module with a number, its scale, and the two sentences that
       * make a home-built sentiment reading legitimate to print at all. Not a fifth cell pretending
       * to be a glance.
       */}
      <div className="border-t border-hairline pt-4">
        <Mood board={board} />
      </div>
    </div>
  );
}

/**
 * One cell: the figure, its window, and — when something is wrong — the words that say what.
 *
 * The note is never the only carrier of bad news and the colour is never the only carrier either.
 * They arrive together, and the words come first.
 */
function Cell({ cell }: { cell: MacroCell }) {
  const stale = cell.state === "stale";

  return (
    <div className="flex flex-col gap-1">
      <span title={cell.title}>
        <StatFigure label={cell.label} value={cell.value} scale="body" delta={cell.delta} />
      </span>

      {/*
       * The window — from the closed C2 vocabulary, and never faded.
       *
       * N2 shipped these tokens at opacity-80 and axe found nine failing contrast nodes, every one a
       * window token. A number's unit is not decoration you may dim: C2's whole claim is that the
       * window IS information.
       */}
      {cell.asOf ? <span className="font-mono text-2xs text-muted">{cell.asOf}</span> : null}

      {/*
       * THE STATE, IN WORDS. Amber only when a number has aged past the point of being useful.
       * "not yet reported" and "source unreachable tonight" stay quiet — they are information, not
       * alarms, and an app that shouts about an unprovisioned API key has nothing left for the night
       * its numbers are actually wrong.
       */}
      {cell.note ? (
        <span className={cx("font-ui text-2xs", stale ? "text-alert" : "text-muted")}>
          {cell.note}
        </span>
      ) : null}

      {cell.provenance ? (
        <span className="font-ui text-2xs text-muted">{cell.provenance}</span>
      ) : null}

      {/* The rupee's mandatory qualifier: we quote no remittance app, and we say so. */}
      {cell.qualifier ? (
        <span className="font-ui text-2xs text-muted">{cell.qualifier}</span>
      ) : null}

      {/* A licence-required attribution — rendered only when its source is the one showing. */}
      {cell.attribution ? (
        <a
          href={cell.attribution.href}
          className="font-ui text-2xs text-muted underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          {cell.attribution.text}
        </a>
      ) : null}
    </div>
  );
}

/**
 * The gauge, or the honest absence of one.
 *
 * There is no third branch here, and that is ruling C8 in its final form: either the score renders
 * with the full breakdown that produced it, or it does not render at all and the board names the
 * instruments that went missing. A bare number is not one of the options.
 */
function Mood({ board }: { board: MacroBoardData }) {
  if ("score" in board.mood) {
    return (
      <MoodGauge
        score={board.mood.score}
        band={board.mood.band}
        components={board.mood.components}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <StatFigure label={copy.macroBoard.moodLabel} value="—" scale="body" />
      <span className="font-ui text-2xs text-muted">{board.mood.reason}</span>
      {/* The ownership line survives even the absence: what is missing is OUR number, not CNN's. */}
      <span className="font-ui text-2xs text-muted">{copy.macroBoard.moodContext}</span>
    </div>
  );
}
