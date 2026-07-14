import type { MetadataRoute } from "next";
import { PAPER } from "@/lib/tokens";

/**
 * The web app manifest (plan §5.1). Next serves this at /manifest.webmanifest, and the proxy
 * lets it through unauthenticated — the browser reads it to offer "install" before any session
 * exists.
 *
 * `start_url` is a plain "/", with no ?source=pwa tracking parameter. A query string there would
 * fork the service worker's single-entry page cache into two URLs; installed-state is detected
 * with the `display-mode: standalone` media query instead (§5.1).
 *
 * `theme_color` here is a static install-time value — the light Desk bone. The *live*
 * status-bar colour comes from each layout's viewport.themeColor and follows the room, with
 * dark-mode variants arriving at P6. The two must not be confused: this one is frozen at install.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "myStockMarket",
    short_name: "Desk",
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PAPER,
    theme_color: PAPER,
    description: "US-market command center & learning hub",
    /**
     * The icon set, all generated from one master by scripts/brand-assets.mjs (PD2, plan 5.2).
     *
     * The three PURPOSES are three different promises, and mixing them up is how an installed app
     * ends up with a mark floating in a white box:
     *   - `any`       — the icon as it is. Transparent, because the mark is a circle and the OS
     *                   should see a circle.
     *   - `maskable`  — the OS may crop this to ANY shape it likes and guarantees only that a
     *                   centred circle of radius 40% survives. So it is OPAQUE, on the brand field,
     *                   with the mark inset to 77% — whatever shape gets carved, it carves field.
     *                   Both sizes are listed now: Android picks the nearest, and offering only 512
     *                   made a 192px launcher downscale a 512 every time it drew the icon.
     *   - `monochrome`— Android tints this one itself, so it must be a single flat colour on
     *                   transparency. A rendered logo cannot be that, so it stays the old drawn
     *                   glyph (public/mark-glyph.svg) — the one place that letterform survives.
     */
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-monochrome-96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
    // Long-press shortcuts on the installed icon. Both are cheap doorways to the two surfaces
    // the user reaches for most: how reliable the signals are, and today's review.
    shortcuts: [
      { name: "Track record", url: "/track-record" },
      { name: "Review queue", url: "/academy/review" },
    ],
  };
}
