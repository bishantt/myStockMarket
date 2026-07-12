import Link from "next/link";

import { db } from "@/lib/db";
import { lookupTerm } from "@/lib/glossary";
import { buildReviewQueue, MAX_REVIEWS_PER_DAY, type ConceptState } from "@/lib/review";
import { ReviewSession } from "@/components/academy/ReviewSession";

/**
 * /academy/review — the Leitner review queue (plan §7 P5 step 5, §9.3).
 *
 * The queue holds only concepts the user actually met on the Desk (they opened the glossary popover),
 * and never more than five in a day. Each card asks the reader to recall a term before revealing its
 * definition, then records whether they knew it — a correct answer schedules it further out, a wrong
 * one brings it back tomorrow. Skipping carries no penalty. No prices, no streaks, no score to chase.
 */

export const dynamic = "force-dynamic";

function todayDate(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

export default async function ReviewPage() {
  const rows = await db.conceptState.findMany();
  const states: ConceptState[] = rows.map((row) => ({
    concept: row.concept,
    box: row.box,
    dueOn: row.dueOn,
    firstSeenAt: row.firstSeenAt,
    lastReviewedAt: row.lastReviewedAt,
    timesSeen: row.timesSeen,
    timesCorrect: row.timesCorrect,
  }));

  // Only due concepts, capped at five, and only those that still resolve to a glossary term.
  const due = buildReviewQueue(states, todayDate())
    .map((state) => {
      const entry = lookupTerm(state.concept);
      return entry ? { concept: state.concept, term: entry.term, definition: entry.long, lesson: entry.lesson } : null;
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  return (
    <section className="flex flex-col" aria-label="Review queue">
      <Link href="/academy" className="flex min-h-11 w-fit items-center font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep">
        ← All lessons
      </Link>

      <header className="pt-4">
        <h1 className="font-prose text-2xl text-ink">Review</h1>
        <p className="max-w-[62ch] pt-2 font-prose text-base text-ink-2">
          A short recall of the terms you have met, spaced out over time. At most {MAX_REVIEWS_PER_DAY}{" "}
          a day, and skipping is free — the point is honest memory, not a streak.
        </p>
      </header>

      {due.length === 0 ? (
        <p className="max-w-[62ch] pt-8 font-prose text-base text-muted">
          Nothing is due right now. Terms enter this queue when you open their glossary popover on the
          Desk; come back after you have met a few.
        </p>
      ) : (
        <div className="pt-6">
          <ReviewSession cards={due} />
        </div>
      )}
    </section>
  );
}
