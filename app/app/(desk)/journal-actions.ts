"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { JOURNAL_PROMPT, validateJournal } from "@/lib/journal";

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

  try {
    await db.journalEntry.create({
      data: {
        // The entry is dated by its calendar day (a bare date), matching how the scorecard groups.
        date: new Date(new Date().toISOString().slice(0, 10)),
        prompt: JOURNAL_PROMPT,
        body: validation.value.body,
      },
    });
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("writeJournalEntry failed", error);
    return { ok: false, error: "Could not save your entry — please try again." };
  }
}
