import { describe, expect, it } from "vitest";

import {
  BOX_INTERVAL_DAYS,
  MAX_REVIEWS_PER_DAY,
  buildReviewQueue,
  newConceptState,
  reviewConcept,
  type ConceptState,
} from "./review";

/**
 * lib/review.test.ts — the Leitner review scheduler (plan §7 P5 step 5).
 *
 * Two rules the plan makes non-negotiable are proven here: a correct answer promotes a concept to a
 * longer box (and a wrong answer sends it back to box 1), and the daily queue never exceeds five.
 */

const TODAY = new Date("2026-07-11");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

describe("newConceptState", () => {
  it("starts a freshly-encountered concept in box 1, due one day out", () => {
    const state = newConceptState("rvol", TODAY);
    expect(state.concept).toBe("rvol");
    expect(state.box).toBe(1);
    expect(state.dueOn).toEqual(addDays(TODAY, BOX_INTERVAL_DAYS[1]));
    expect(state.timesSeen).toBe(0);
  });
});

describe("reviewConcept", () => {
  it("promotes to the next box on a correct answer and schedules further out", () => {
    const start = newConceptState("gap", TODAY);
    const next = reviewConcept(start, true, TODAY);
    expect(next.box).toBe(2);
    expect(next.dueOn).toEqual(addDays(TODAY, BOX_INTERVAL_DAYS[2]));
    expect(next.timesSeen).toBe(1);
    expect(next.timesCorrect).toBe(1);
  });

  it("caps promotion at the top box (5)", () => {
    let state: ConceptState = { ...newConceptState("rsi", TODAY), box: 5 };
    state = reviewConcept(state, true, TODAY);
    expect(state.box).toBe(5);
    expect(state.dueOn).toEqual(addDays(TODAY, BOX_INTERVAL_DAYS[5]));
  });

  it("sends a concept back to box 1 on a wrong answer, due the next day", () => {
    const state: ConceptState = { ...newConceptState("vix", TODAY), box: 4 };
    const next = reviewConcept(state, false, TODAY);
    expect(next.box).toBe(1);
    expect(next.dueOn).toEqual(addDays(TODAY, BOX_INTERVAL_DAYS[1]));
    expect(next.timesCorrect).toBe(0);
  });

  it("does not mutate the input state (immutability)", () => {
    const start = newConceptState("breadth", TODAY);
    const snapshot = { ...start };
    reviewConcept(start, true, TODAY);
    expect(start).toEqual(snapshot);
  });
});

describe("buildReviewQueue", () => {
  const due = (concept: string, dueOn: Date, box = 1): ConceptState => ({
    concept,
    box,
    dueOn,
    firstSeenAt: TODAY,
    lastReviewedAt: null,
    timesSeen: 0,
    timesCorrect: 0,
  });

  it("includes only concepts due today or earlier", () => {
    const states = [
      due("a", addDays(TODAY, -1)),
      due("b", TODAY),
      due("c", addDays(TODAY, 3)), // not yet due
    ];
    const queue = buildReviewQueue(states, TODAY);
    expect(queue.map((s) => s.concept)).toEqual(["a", "b"]);
  });

  it("never returns more than the daily cap of five", () => {
    const states = Array.from({ length: 9 }, (_, i) => due(`c${i}`, addDays(TODAY, -1)));
    expect(MAX_REVIEWS_PER_DAY).toBe(5);
    expect(buildReviewQueue(states, TODAY)).toHaveLength(5);
  });

  it("orders the most overdue first, then the lowest box", () => {
    const states = [
      due("newer", addDays(TODAY, -1), 3),
      due("older", addDays(TODAY, -5), 2),
      due("sameDayLowBox", addDays(TODAY, -1), 1),
    ];
    const queue = buildReviewQueue(states, TODAY);
    expect(queue.map((s) => s.concept)).toEqual(["older", "sameDayLowBox", "newer"]);
  });
});
