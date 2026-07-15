import { copy, fill } from "@/lib/copy";
import { formatEtClock, formatUtcDateLong, formatWeekdayLong } from "@/lib/time";

/**
 * DeskHeader — the masthead of the broadsheet.
 *
 * An eyebrow, a serif date, and a one-line reader-voice status. It is the one place on the Desk
 * where the display serif runs at full size, and it sets the tone for everything under it: this is
 * an edition, with a date on it, reporting on a session that has already happened.
 *
 * "EVENING EDITION" is not a flourish. The Figma's mock said "PRE-MARKET", which would have been a
 * quiet lie: our pipeline runs after the close and promises a briefing by 9pm ET. The header names
 * the edition the product actually publishes.
 *
 * ONE TRUTH PER LINE (CC3, ruling R3). Line 3 says the data vintage and when it was written —
 * "Tuesday's close · updated 7:36 PM ET" — and nothing else. The market's open/closed state used to
 * ride here too; it left for the pill in the top bar (the single market-state truth), which is also
 * why this line is a plain server render again: with the reader-clock "now" gone it depends only on
 * the run's own fixed dates, so it can be cached with the rest of the page.
 *
 * There is no countdown to the next open. A countdown manufactures urgency, and there is nothing
 * here to be early for.
 */
export function DeskHeader({
  runDate,
  updatedAt,
}: {
  /** The trading day this edition reports on. */
  runDate: Date;
  /** When the pipeline finished writing it. */
  updatedAt: Date | null;
}) {
  // The run date is a BARE calendar date (a trading day) stored at UTC midnight; its UTC components
  // ARE the trading day. Reading them in Eastern time shifts it back a day, and the masthead would
  // carry a different date from the modules beneath it (it briefly did). The long weekday goes
  // through formatWeekdayLong, which parses this same YYYY-MM-DD at UTC noon and cannot drift.
  const status = fill(copy.desk.status, {
    weekday: formatWeekdayLong(runDate.toISOString().slice(0, 10)),
    stamp: updatedAt ? `${formatEtClock(updatedAt)} ET` : "—",
  });

  return (
    <header className="flex flex-col gap-1 pt-6">
      <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
        {copy.desk.edition}
      </p>
      <h1 className="font-display text-display font-bold text-ink">{formatUtcDateLong(runDate)}</h1>
      <p className="font-ui text-sm text-muted">{status}</p>
    </header>
  );
}
