import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { PAPER } from "@/lib/tokens";
import "./globals.css";

/**
 * The root layout. It does three jobs and deliberately no more: publish the three font
 * variables, set the document metadata, and open the <body>.
 *
 * The two rooms — Desk and Academy — own their own backgrounds and their own status-bar
 * colour, set in their respective route-group layouts. Keeping that decision out of here is
 * what makes the room switch (cool Desk, warm Academy) possible at all.
 */

export const metadata: Metadata = {
  title: "myStockMarket",
  description: "US-market command center & learning hub",
  // The app sits behind a login wall for data-licensing reasons (plan §1.5, rule 15).
  // Telling crawlers not to index it is belt-and-braces on top of that wall.
  robots: { index: false, follow: false },
};

/**
 * `viewportFit: "cover"` lets the sticky top bar and the mobile bottom sheet paint into an
 * iPhone's safe areas; those components then pad themselves back out with env(safe-area-inset-*).
 * Without it, an installed standalone PWA renders letterboxed on a notched phone.
 *
 * `themeColor` is the live browser/status-bar colour and starts as the Desk's. The Academy
 * layout overrides it, and P6 adds the dark-mode media variants (plan §5.1).
 *
 * Note there is no maximum-scale lock: the Desk is dense, so pinch-zoom is an accessibility
 * requirement, not an annoyance to design away.
 */
export const viewport: Viewport = {
  themeColor: PAPER,
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
