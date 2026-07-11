"use server";

import { db } from "@/lib/db";
import { isKnownLesson } from "@/lib/academy";

/**
 * Academy lesson-progress write action (plan §7 P5 step 6 — user-state only).
 *
 * Records that the user has read a lesson. Idempotent (keyed by slug), and it only accepts real
 * lesson slugs, so the M3 soft gate can trust the completion set. Best-effort: a failure here must
 * never disturb reading, so it swallows and logs rather than throwing into the render.
 */
export async function markLessonComplete(slug: string): Promise<void> {
  if (!isKnownLesson(slug)) return;
  try {
    await db.lessonProgress.upsert({
      where: { slug },
      create: { slug },
      update: {}, // Already read — nothing to change.
    });
  } catch (error) {
    console.error("markLessonComplete failed", error);
  }
}
