"use client";

import { useEffect, useRef } from "react";

import { markLessonComplete } from "@/app/academy/lesson-actions";

/**
 * LessonReadBeacon — records that a lesson has been read, once, on mount (plan §7 P5 step 6).
 *
 * Rendering it at the foot of a lesson marks the lesson complete without a side-effect in the
 * server render or a button to click: opening the lesson is the read. Completion feeds the M3 soft
 * gate. Best-effort — a failed write never disturbs the page.
 */
export function LessonReadBeacon({ slug }: { slug: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void markLessonComplete(slug).catch(() => {});
  }, [slug]);
  return null;
}
