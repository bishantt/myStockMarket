"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { FOCUS_CAP, canSetFocus, validateAdd } from "@/lib/watchlist";

/**
 * The watchlist write actions (plan §7 — the app writes user-state only, §9.2 the focus list).
 *
 * These are the only place the app mutates the database. Each one validates at the boundary (never
 * trusting the form body), applies the pure rules in lib/watchlist, and revalidates the two routes
 * that show the watchlist — the Desk and this settings page — so a change is reflected immediately.
 * The login wall (proxy.ts) already stands in front of /settings, so these run only for the
 * authenticated user.
 *
 * The focus cap is enforced HERE, in the write path, not merely hidden in the UI: that way the rule
 * carries its own plain message and cannot be bypassed by a stale form.
 */

/** What every action returns to the form: success, or a plain-English reason it did not happen. */
export type ActionResult = { ok: boolean; error?: string };

const AddForm = z.object({
  symbol: z.string().min(1).max(20),
  reason: z.string().min(1).max(500),
});

const IdForm = z.object({ id: z.string().min(1).max(60) });

/**
 * Add a name to the watchlist. Requires a symbol that is actually in the tradable universe and a
 * written reason; refuses a duplicate. Shaped for useActionState — takes the previous result and
 * the submitted form, returns the next result.
 */
export async function addWatchlistItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = AddForm.safeParse({ symbol: formData.get("symbol"), reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, error: "Enter a symbol and a reason." };

  const validation = validateAdd(parsed.data);
  if (!validation.ok) return { ok: false, error: validation.error.message };
  const { symbol, reason } = validation.value;

  try {
    const instrument = await db.instrument.findUnique({ where: { symbol }, select: { symbol: true } });
    if (!instrument) return { ok: false, error: `${symbol} is not in the tradable universe.` };

    const existing = await db.watchlistItem.findFirst({ where: { symbol }, select: { id: true } });
    if (existing) return { ok: false, error: `${symbol} is already on your watchlist.` };

    await db.watchlistItem.create({ data: { symbol, reason } });
    revalidateWatchlist();
    return { ok: true };
  } catch (error) {
    console.error("addWatchlistItem failed", error);
    return { ok: false, error: "Could not add it — please try again." };
  }
}

/** Remove a name from the watchlist by id. */
export async function removeWatchlistItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = IdForm.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Nothing to remove." };

  try {
    await db.watchlistItem.delete({ where: { id: parsed.data.id } });
    revalidateWatchlist();
    return { ok: true };
  } catch (error) {
    console.error("removeWatchlistItem failed", error);
    return { ok: false, error: "Could not remove it — please try again." };
  }
}

/**
 * Toggle a name's focus state, enforcing the three-name cap in the write path. Reads the current
 * focus count and this item's state, then applies canSetFocus before writing.
 */
export async function toggleFocus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = IdForm.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "That name is no longer on your watchlist." };

  try {
    const item = await db.watchlistItem.findUnique({
      where: { id: parsed.data.id },
      select: { isFocus: true },
    });
    if (!item) return { ok: false, error: "That name is no longer on your watchlist." };

    const next = !item.isFocus;
    const focusCount = await db.watchlistItem.count({ where: { isFocus: true } });
    if (!canSetFocus(focusCount, item.isFocus, next)) {
      return { ok: false, error: `You can focus at most ${FOCUS_CAP} names — unfocus one first.` };
    }

    await db.watchlistItem.update({ where: { id: parsed.data.id }, data: { isFocus: next } });
    revalidateWatchlist();
    return { ok: true };
  } catch (error) {
    console.error("toggleFocus failed", error);
    return { ok: false, error: "Could not update focus — please try again." };
  }
}

/**
 * Refresh everything a watchlist write changes (§5.3 P-7).
 *
 * The Desk gets LAYOUT scope, not page scope, and the difference is load-bearing: the ⌘K command
 * palette is built in the Desk's layout, not in any page, and its index includes every watchlist
 * ticker. A page-scoped refresh would update the Desk's watchlist module while leaving the palette
 * still offering yesterday's names — and since the layout wraps every room, "yesterday's names"
 * would follow the reader around the whole app.
 *
 * The settings page renders the manager itself, so it is refreshed too.
 */
function revalidateWatchlist(): void {
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}
