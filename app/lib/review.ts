/**
 * lib/review.ts — the Leitner spaced-repetition scheduler for the Academy review queue
 * (plan §7 P5 step 5).
 *
 * A concept the user has actually encountered (they opened its glossary popover) enters a Leitner
 * system: answer it right and it moves to a higher box that comes due further out; answer it wrong
 * and it drops back to box 1 for tomorrow. The daily queue is capped at five, and skipping carries no
 * penalty (a skip simply leaves the concept due). Everything here is pure and immutable so the
 * scheduling math is unit-tested without a database; the server actions in academy/review-actions.ts
 * persist the results.
 */

/** The five Leitner boxes, and how many days out a concept in each box is scheduled. Roughly
 * doubling intervals: a well-known concept is asked rarely; a shaky one comes back tomorrow. */
export const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 9, 5: 21 };

export const TOP_BOX = 5;

/** The plan's hard cap: the review queue never shows more than five concepts in a day. */
export const MAX_REVIEWS_PER_DAY = 5;

/** One concept's spaced-repetition state. Dates are bare calendar days. */
export type ConceptState = {
  concept: string;
  box: number;
  dueOn: Date;
  firstSeenAt: Date;
  lastReviewedAt: Date | null;
  timesSeen: number;
  timesCorrect: number;
};

/** Add whole days to a bare date, returning a new Date (never mutating the input). */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** The due date for a concept that has just landed in `box`, counted from `today`. */
function dueDateFor(box: number, today: Date): Date {
  return addDays(today, BOX_INTERVAL_DAYS[box] ?? BOX_INTERVAL_DAYS[1]);
}

/** A freshly-encountered concept: box 1, due one day out, not yet reviewed. */
export function newConceptState(concept: string, today: Date): ConceptState {
  return {
    concept,
    box: 1,
    dueOn: dueDateFor(1, today),
    firstSeenAt: today,
    lastReviewedAt: null,
    timesSeen: 0,
    timesCorrect: 0,
  };
}

/**
 * Apply one review outcome. A correct answer promotes the concept one box (capped at the top) and
 * schedules it further out; a wrong answer resets it to box 1 for tomorrow. Returns a new state.
 */
export function reviewConcept(state: ConceptState, correct: boolean, today: Date): ConceptState {
  const box = correct ? Math.min(state.box + 1, TOP_BOX) : 1;
  return {
    ...state,
    box,
    dueOn: dueDateFor(box, today),
    lastReviewedAt: today,
    timesSeen: state.timesSeen + 1,
    timesCorrect: state.timesCorrect + (correct ? 1 : 0),
  };
}

/**
 * The concepts due for review today, most overdue first (then lowest box first), capped at five.
 * A concept is due when its `dueOn` is today or earlier.
 */
export function buildReviewQueue(states: ConceptState[], today: Date): ConceptState[] {
  return states
    .filter((state) => state.dueOn.getTime() <= today.getTime())
    .sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime() || a.box - b.box)
    .slice(0, MAX_REVIEWS_PER_DAY);
}
