"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

/**
 * The setup-card weakener write action (plan P4 step 6 — the app writes user-state only).
 *
 * Toggling a weakener is the one interactive part of a setup card: the user ticks a condition they
 * judge present, and it is recorded on the card's weakeners JSON. Validated at the boundary; the
 * login wall stands in front of the Desk, so this runs only for the authenticated user. A toggle
 * revalidates the Desk so the checkbox state persists across a reload.
 */

export type WeakenerResult = { ok: boolean; error?: string };

const ToggleForm = z.object({
  cardId: z.string().min(1).max(60),
  key: z.string().min(1).max(60),
});

export async function toggleWeakener(_prev: WeakenerResult, formData: FormData): Promise<WeakenerResult> {
  const parsed = ToggleForm.safeParse({ cardId: formData.get("cardId"), key: formData.get("key") });
  if (!parsed.success) return { ok: false, error: "Could not update that weakener." };

  try {
    const card = await db.setupCard.findUnique({
      where: { id: parsed.data.cardId },
      select: { weakeners: true },
    });
    if (!card) return { ok: false, error: "That card is no longer on the Desk." };

    const current = (card.weakeners ?? {}) as Record<string, boolean>;
    const next = { ...current, [parsed.data.key]: !current[parsed.data.key] };

    await db.setupCard.update({ where: { id: parsed.data.cardId }, data: { weakeners: next } });
    // After the response, never during it — see the note in journal-actions.ts. Revalidating "/"
    // inline, from an action invoked on "/", deadlocks the action's own reply.
    after(() => revalidatePath("/"));
    return { ok: true };
  } catch (error) {
    console.error("toggleWeakener failed", error);
    return { ok: false, error: "Could not save — please try again." };
  }
}
