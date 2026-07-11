"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { lookupTerm } from "@/lib/glossary";
import { BOX_INTERVAL_DAYS, reviewConcept, type ConceptState } from "@/lib/review";

/**
 * Academy review-queue write actions (plan §7 P5 step 5 — the app writes user-state only).
 *
 * Two writes: recording that the user genuinely encountered a concept (they opened its glossary
 * popover), which seeds the Leitner queue; and recording a review outcome, which reschedules the
 * concept up or down a box. The scheduling math lives in lib/review.ts; these actions only persist
 * it. The login wall (proxy.ts) stands in front of the Academy, so both run only for the one user.
 */

/** Today as a bare calendar day (matches how the queue is dated). */
function todayDate(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

/**
 * Record that the user encountered a concept for the first time — an exposure. Idempotent: a concept
 * already in the queue keeps its schedule (re-seeing "RVOL" must not restart its Leitner clock). An
 * unknown key is ignored, so only real glossary terms can enter the queue.
 */
export async function recordConceptExposure(concept: string): Promise<void> {
  if (!lookupTerm(concept)) return;
  const today = todayDate();
  try {
    await db.conceptState.upsert({
      where: { concept },
      create: {
        concept,
        // A freshly-encountered concept starts in box 1, due one day out.
        dueOn: new Date(today.getTime() + BOX_INTERVAL_DAYS[1] * 86_400_000),
      },
      update: {}, // Already known — leave its schedule untouched.
    });
  } catch (error) {
    // An exposure is best-effort telemetry for the review queue; never let it break a page render.
    console.error("recordConceptExposure failed", error);
  }
}

/** The review outcome a card reports: the user knew it, or did not. */
export type ReviewResult = { ok: boolean; error?: string };

/**
 * Record a review outcome for one concept and reschedule it. A correct answer promotes it to a
 * higher Leitner box (further out); a wrong answer resets it to box 1 for tomorrow.
 */
export async function submitReview(concept: string, correct: boolean): Promise<ReviewResult> {
  if (!lookupTerm(concept)) return { ok: false, error: "Unknown concept." };
  try {
    const row = await db.conceptState.findUnique({ where: { concept } });
    if (!row) return { ok: false, error: "That concept is not in your queue." };

    const current: ConceptState = {
      concept: row.concept,
      box: row.box,
      dueOn: row.dueOn,
      firstSeenAt: row.firstSeenAt,
      lastReviewedAt: row.lastReviewedAt,
      timesSeen: row.timesSeen,
      timesCorrect: row.timesCorrect,
    };
    const next = reviewConcept(current, correct, todayDate());

    await db.conceptState.update({
      where: { concept },
      data: {
        box: next.box,
        dueOn: next.dueOn,
        lastReviewedAt: next.lastReviewedAt,
        timesSeen: next.timesSeen,
        timesCorrect: next.timesCorrect,
      },
    });
    revalidatePath("/academy/review");
    return { ok: true };
  } catch (error) {
    console.error("submitReview failed", error);
    return { ok: false, error: "Could not save your review — please try again." };
  }
}
