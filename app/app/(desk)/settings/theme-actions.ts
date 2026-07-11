"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { THEME_COOKIE, normaliseTheme } from "@/lib/theme";

/**
 * The Desk theme action (plan §7 P6 step 6). Writes the chosen theme to a long-lived cookie so the
 * Desk shell can stamp data-theme on the next render. Dark is Desk-only; the Academy never reads this.
 */
export async function setTheme(formData: FormData): Promise<void> {
  const theme = normaliseTheme(formData.get("theme")?.toString());
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — a preference, not a session
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
