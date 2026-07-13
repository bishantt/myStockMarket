import { copy } from "@/lib/copy";
import { formatUtcDateLong } from "@/lib/time";

import { MarketStateLine } from "./MarketStateLine";

/**
 * DeskHeader — the masthead of the broadsheet.
 *
 * An eyebrow, a serif date, and a status line. It is the one place on the Desk where the display
 * serif runs at full size, and it sets the tone for everything under it: this is an edition, with a
 * date on it, reporting on a session that has already happened.
 *
 * "EVENING EDITION" is not a flourish. The Figma's mock said "PRE-MARKET", which would have been a
 * quiet lie: our pipeline runs after the close and promises a briefing by 9pm ET. The header names
 * the edition the product actually publishes.
 *
 * The status line carries the as-of context for every delta chip below it — the whole Desk is a
 * record of one session's close, and saying so once, at the top, means each module does not have to.
 *
 * There is no countdown to the next open. A countdown manufactures urgency, and there is nothing
 * here to be early for.
 */
export function DeskHeader({
  runDate,
  updatedAt,
  marketOpen,
}: {
  /** The trading day this edition reports on. */
  runDate: Date;
  /** When the pipeline finished writing it. */
  updatedAt: Date | null;
  marketOpen: boolean;
}) {
  // The run date is a BARE calendar date (a trading day), stored at UTC midnight. It has to be
  // formatted from its UTC components: rendering it in Eastern time shifts it back a day, and the
  // masthead would carry a different date from the modules beneath it. (It briefly did.)
  //
  // The status line moved into a client component, and that is a correctness fix rather than a
  // refactor: "markets open" was computed on the server, on a CACHED route, so it was frozen at the
  // moment the page was generated and could still say "open" half an hour after the close. See
  // MarketStateLine.
  return (
    <header className="flex flex-col gap-1 pt-6">
      <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
        {copy.desk.edition}
      </p>
      <h1 className="font-display text-display font-bold text-ink">{formatUtcDateLong(runDate)}</h1>
      <MarketStateLine runDate={runDate} updatedAt={updatedAt} serverOpen={marketOpen} />
    </header>
  );
}
