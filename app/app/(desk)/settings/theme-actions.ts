"use server";

import { cookies } from "next/headers";

import { THEME_COOKIE, normaliseTheme } from "@/lib/theme";

/**
 * The theme action. Writes the chosen theme to a long-lived cookie, and does nothing else.
 *
 * IT NO LONGER REVALIDATES ANYTHING, and that is a deliberate removal rather than an oversight.
 *
 * It used to call `revalidatePath("/", "layout")`, which made sense when the settings page read the
 * cookie on the SERVER to decide which button looked pressed: the server had to re-render to show
 * the new state. Since F1 it does not — the toggle reads `<html data-theme>` in the browser, and
 * stamps it there on click, so the theme is applied by the client and the cookie exists only for the
 * pre-paint script on the next full load. There is no server render left to refresh.
 *
 * And the call was not merely redundant, it was dangerous: a layout-scoped revalidation drops the
 * known-params set of any route that declares `dynamicParams = false`, which 404s every URL in that
 * family until the next deploy (see the long note in app/(desk)/scans/[preset]/page.tsx — it was
 * caught in CI and reproduced locally). Changing the theme should not be able to delete a room.
 */
export async function setTheme(formData: FormData): Promise<void> {
  const theme = normaliseTheme(formData.get("theme")?.toString());
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — a preference, not a session
    sameSite: "lax",
  });
}
