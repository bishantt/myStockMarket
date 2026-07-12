"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { isKnownLesson } from "@/lib/academy";

/**
 * Academy lesson-progress write action (plan §7 P5 step 6 — user-state only).
 *
 * Records that the user has read a lesson. Idempotent (keyed by slug), and it only accepts real
 * lesson slugs, so the M3 soft gate can trust the completion set. Best-effort: a failure here must
 * never disturb reading, so it swallows and logs rather than throwing into the render.
 *
 * IT NOW BUSTS THE PAGES IT CHANGES (§5.3 P-7). Finishing a lesson changes three surfaces: the
 * Academy index (its read-count and its ticks), the lesson pages themselves (the M3 soft-gate notice
 * on the pattern lessons), and — less obviously — the paper desk, which reads the same progress to
 * decide whether to suggest finishing the risk module before placing orders.
 *
 * None of that mattered while those routes re-rendered on every request: they simply could not be
 * stale. Now that they are cached, a read beacon that told nobody would leave the reader finishing a
 * lesson and watching the app carry on as if they hadn't. Every write busts its consumers — that is
 * the closure argument ruling M5 rests on, and this is the write that used to be exempt from it.
 */
export async function markLessonComplete(slug: string): Promise<void> {
  if (!isKnownLesson(slug)) return;
  try {
    await db.lessonProgress.upsert({
      where: { slug },
      create: { slug },
      update: {}, // Already read — nothing to change.
    });

    revalidatePath("/academy");
    revalidatePath("/academy/[slug]", "page"); // every lesson: the M3 gate notice may have lifted
    revalidatePath("/paper"); // the M3 nudge on the ticket reads this same progress
  } catch (error) {
    console.error("markLessonComplete failed", error);
  }
}
