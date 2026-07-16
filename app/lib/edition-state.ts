import { etDateOf, isBeforeOpen } from "@/lib/market-hours";

/**
 * edition-state.ts — which edition the Desk is greeting the reader with (CC9, plan 4.7-presentation).
 *
 * THE CLOCK IS THE READER'S, NOT THE SERVER'S, and that is ruling R6 and MarketStateLine's law in one
 * function. The Desk is served from a cache, and a cache carries the clock it was made with. If the
 * masthead's edition were graded on the server it would be graded with the CACHE's clock — and a page
 * cached in the morning and served that evening, or a tab left open across midnight, would go on
 * greeting a morning that is hours gone. So the state is computed in the browser against `now`, and the
 * server only seeds the first paint (PipelineStrip's pattern). This function is the pure half: facts in,
 * a state out, no clock of its own — which is what lets the tests pin `now` to a fixed instant.
 *
 * The four states, and the one law under all of them: THE DESK MAY SAY "MORNING" ONLY WHEN THE MORNING
 * IS REAL (R6). A dawn must have run for the reader's OWN wall-clock trading day; a dawn from any earlier
 * day is a stale cache, not this morning, and the machine refuses it.
 */

export type EditionState =
  /** The evening run is the newest fact — from its publish until midnight ET. The masthead as it was. */
  | "evening"
  /** A dawn ran for today's session and the bell has not rung — the Morning Edition, before the open. */
  | "morning"
  /** Open ≤ now < tonight's evening publish — the Morning masthead stands; only the pill turns. */
  | "session"
  /** After midnight, before the dawn (or a holiday, or a failed cron): stay Evening. Never claim a
   *  morning that has not happened (R6). */
  | "overnight-gap";

/** The three facts the machine grades against `now` — all server-known, all serialisable to the browser. */
export type EditionFacts = {
  /** When the dawn run stamped its entry beside the night's source_status (CC8), ISO — or null if none. */
  dawnRanAt: string | null;
  /** When the latest evening nightly finished (the edition on screen), ISO — or null on a fresh database. */
  eveningPublishedAt: string | null;
  /** The latest run's trading day, a bare "YYYY-MM-DD". The last closed session (E1 keeps it there at dawn). */
  runDate: string;
};

/**
 * The edition state at instant `now`. A dawn counts only when its ET date is the reader's ET date
 * TODAY — that single equality is R6's whole guard against a stale morning. Before the open it is
 * Morning; after it, Session (the masthead is unchanged — only the market pill turns). With no dawn for
 * today, the split is Evening (the evening published today, publish→midnight) vs the overnight gap.
 */
export function editionState(facts: EditionFacts, now: Date): EditionState {
  const nowEt = etDateOf(now);
  const dawnEt = facts.dawnRanAt ? etDateOf(new Date(facts.dawnRanAt)) : null;

  if (dawnEt !== null && dawnEt === nowEt) {
    return isBeforeOpen(now) ? "morning" : "session";
  }

  const publishEt = facts.eveningPublishedAt ? etDateOf(new Date(facts.eveningPublishedAt)) : null;
  return publishEt === nowEt ? "evening" : "overnight-gap";
}

/**
 * Which of the two mastheads a state wears. Morning and Session share the Morning Edition masthead —
 * only the market pill differs between them (the plan's "content unchanged; we do not pretend to be
 * live"). Evening and the overnight gap both wear the Evening Edition masthead of the last closed session.
 */
export function mastheadEdition(state: EditionState): "morning" | "evening" {
  return state === "morning" || state === "session" ? "morning" : "evening";
}
