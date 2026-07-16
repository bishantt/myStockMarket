"use client";

import { copy, fill } from "@/lib/copy";
import { mastheadEdition } from "@/lib/edition-state";
import { etDateOf } from "@/lib/market-hours";
import { formatEtClock, formatUtcDateLong, formatWeekdayLong } from "@/lib/time";
import { useEdition } from "@/components/desk/EditionState";

/**
 * DeskHeader — the masthead of the broadsheet, now edition-aware (CC9).
 *
 * An eyebrow, a serif date, and a one-line reader-voice status. It is the one place on the Desk where
 * the display serif runs at full size, and it sets the tone for everything under it: this is an edition,
 * with a date on it.
 *
 * It renders one of TWO mastheads, chosen by the edition-state machine in the browser (the pill's law:
 * "which edition" depends on the reader's clock, and a server-graded masthead would be graded with the
 * cache's). The EVENING masthead is exactly as CC3 left it — the last closed session, "Thursday's close ·
 * updated 7:36 PM ET". The MORNING masthead greets the reader's own session, "before the open · market
 * data through Thursday's close · news & macro refreshed 6:31 AM ET" (Appendix A), and it appears ONLY
 * when a dawn has really run for today (R6 — the 2026-07-11 rejection of "PRE-MARKET" was of the false
 * label, not of a morning product).
 *
 * The morning date is the dawn's OWN ET date, not a fresh reading of the clock: morning state means the
 * dawn ran today, so its date IS today, and deriving it from the fact keeps the h1 stable across the
 * client correction. There is no countdown to the open — a countdown manufactures urgency (§1.3).
 */
export function DeskHeader({
  runDate,
  updatedAt,
  dawnRanAt,
}: {
  /** The last run's trading day, ISO (a UTC-midnight bare date — its UTC components ARE the session). */
  runDate: string;
  /** When the evening pipeline finished writing the edition, ISO — or null. */
  updatedAt: string | null;
  /** When the dawn ran for the reader's session, ISO — or null when none has (CC9). */
  dawnRanAt: string | null;
}) {
  const edition = mastheadEdition(useEdition());
  // The morning greeting needs a dawn to point at; without one, fall through to the evening masthead.
  const isMorning = edition === "morning" && dawnRanAt !== null;

  // The last closed session's weekday — the vintage both mastheads name ("{weekday}'s close").
  const closeWeekday = formatWeekdayLong(runDate.slice(0, 10));

  const kicker = isMorning ? copy.desk.morningEdition : copy.desk.edition;

  // The h1 date: today's session in the morning (the dawn's own ET date), the last close in the evening.
  const headline = isMorning
    ? formatUtcDateLong(new Date(`${etDateOf(new Date(dawnRanAt!))}T00:00:00.000Z`))
    : formatUtcDateLong(new Date(runDate));

  const status = isMorning
    ? fill(copy.desk.morningStatus, {
        weekday: closeWeekday,
        time: `${formatEtClock(new Date(dawnRanAt!))} ET`,
      })
    : fill(copy.desk.status, {
        weekday: closeWeekday,
        stamp: updatedAt ? `${formatEtClock(new Date(updatedAt))} ET` : "—",
      });

  return (
    <header className="flex flex-col gap-1 pt-6">
      <p className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">{kicker}</p>
      <h1 className="font-display text-display font-bold text-ink">{headline}</h1>
      <p className="font-ui text-sm text-muted">{status}</p>
    </header>
  );
}
