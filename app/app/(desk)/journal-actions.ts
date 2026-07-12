"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/lib/db";
import { JOURNAL_PROMPT, validateForecast, validateJournal } from "@/lib/journal";
import { brierScore } from "@/lib/brier";

/**
 * The PM journal write action (plan P3 step 4 — the app writes user-state only).
 *
 * Validates the body at the boundary (never trusting the form), stamps today's date and the fixed
 * prompt, and inserts one journal_entry. The forecast fields stay null in P3 (a plain reflection);
 * they fill in when the scorecard goes live in P4. The login wall (proxy.ts) stands in front of the
 * Desk, so this runs only for the authenticated user.
 */

/** What the form gets back: success, or a plain-English reason the entry was not saved. */
export type JournalResult = { ok: boolean; error?: string };

export async function writeJournalEntry(_prev: JournalResult, formData: FormData): Promise<JournalResult> {
  const validation = validateJournal(formData.get("body"));
  if (!validation.ok) return { ok: false, error: validation.error };

  // A forecast is optional. When the "add a forecast" fields are filled, validate and attach them.
  const rawForecast = formData.get("forecast");
  const hasForecast = typeof rawForecast === "string" && rawForecast.trim().length > 0;
  let forecastData: { forecast: string; probability: number; resolvesOn: Date } | null = null;
  if (hasForecast) {
    const f = validateForecast(rawForecast, formData.get("probability"), formData.get("resolvesOn"), new Date());
    if (!f.ok) return { ok: false, error: f.error };
    forecastData = f.value;
  }

  try {
    await db.journalEntry.create({
      data: {
        // The entry is dated by its calendar day (a bare date), matching how the scorecard groups.
        date: new Date(new Date().toISOString().slice(0, 10)),
        prompt: JOURNAL_PROMPT,
        body: validation.value.body,
        forecast: forecastData?.forecast ?? null,
        probability: forecastData?.probability ?? null,
        resolvesOn: forecastData?.resolvesOn ?? null,
      },
    });
    // See the note at the foot of this file: these run AFTER the response, or the action deadlocks.
    after(() => {
      revalidatePath("/");
      // A FILED forecast also changes /track-record, which renders the open ones (§5.3 P-7).
    //
      // This was a real freshness hole, and it was invisible until F1: /track-record used to
      // re-render on every request, so it always happened to show a new forecast whether or not
      // anything had told it to. The moment the page became cached, a forecast filed on the Desk
      // would have taken up to ten minutes to appear on the page whose entire job is to show it.
      // The write that changes a page is the write that must bust it.
      if (forecastData) revalidatePath("/track-record");
    });

    return { ok: true };
  } catch (error) {
    console.error("writeJournalEntry failed", error);
    return { ok: false, error: "Could not save your entry — please try again." };
  }
}

/** Resolve a forecast: record whether it happened and score it with Brier (plan §7 P6 step 3). */
export async function resolveForecast(_prev: JournalResult, formData: FormData): Promise<JournalResult> {
  const id = formData.get("id");
  const happened = formData.get("happened"); // "yes" | "no"
  if (typeof id !== "string" || (happened !== "yes" && happened !== "no")) {
    return { ok: false, error: "Mark the forecast hit or missed." };
  }
  try {
    const entry = await db.journalEntry.findUnique({ where: { id } });
    if (!entry || entry.probability === null) return { ok: false, error: "That forecast no longer exists." };
    if (entry.outcome) return { ok: false, error: "That forecast is already resolved." };

    const outcome: 0 | 1 = happened === "yes" ? 1 : 0;
    await db.journalEntry.update({
      where: { id },
      data: {
        outcome: happened === "yes" ? "hit" : "miss",
        brier: brierScore(entry.probability, outcome),
      },
    });
    revalidatePath("/track-record");
    return { ok: true };
  } catch (error) {
    console.error("resolveForecast failed", error);
    return { ok: false, error: "Could not resolve the forecast — please try again." };
  }
}

/**
 * WHY THESE REVALIDATIONS RUN INSIDE `after()`, AND NOT INLINE.
 *
 * Calling `revalidatePath("/")` inside a server action that was invoked FROM "/" hangs the action's
 * response. The write lands — the row is in the database — but the reply never reaches the browser,
 * so the button sits on "Saving…" forever and the form never clears. The reader is left believing
 * their entry was lost, and writes it again.
 *
 * Reproduced and isolated: with the `revalidatePath("/")` line removed, the same action returns in
 * 14 seconds of test wall-clock and the form clears. With it, twenty seconds is not enough. The
 * action is invalidating the very page whose fresh render it is trying to stream back as its own
 * response, and the two deadlock.
 *
 * This is not new to the app-feel plan — it has been true of EVERY Desk write since the Desk became
 * an ISR route (2026-07-11): the journal, and the setup cards' weakener checkboxes. It went unnoticed
 * because the e2e that was meant to catch it asserted a marker which renders on `useActionState`'s
 * INITIAL state, so it passed without the write ever happening (LESSONS, 2026-07-12).
 *
 * `after()` is the framework's own answer: it schedules work to run once the response is finished.
 * The reader gets their reply immediately, and the cache entry is invalidated a moment later, for
 * everyone who comes next. Nothing about the freshness contract changes — only the ordering.
 */
