/**
 * fonts.ts — the three typefaces of "Broadsheet Terminal" (plan §3.2), and only these three.
 *
 * All three are loaded through next/font, which downloads them at build time and serves them
 * from our own origin. That matters for two reasons the plan calls out: the installed PWA has
 * to work offline (a font fetched from Google's CDN would not be precacheable), and a
 * same-origin font makes no third-party request when the user opens the app.
 *
 * Each loader exposes a CSS custom property. globals.css composes those into the `--font-ui`,
 * `--font-mono`, and `--font-prose` theme tokens together with their fallback stacks, so no
 * component ever names a font family directly.
 *
 * Total budget for the three, latin subset: <= 320KB woff2 (plan §4.5).
 */
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";

/**
 * Archivo — structure and UI. Every label, table header, button, and nav item on the Desk.
 *
 * We pull the `wdth` (width) axis in addition to the default `wght`, because section
 * mastheads are set in Archivo Expanded (`wdth` around 120) uppercase with wide tracking.
 * That masthead is the single component carrying half the app's identity, so its axis is
 * not optional.
 *
 * Archivo is never used for a number. Numbers are Plex Mono, always.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

/**
 * IBM Plex Mono — every quantitative figure in the product: prices, percentages, counts,
 * sample sizes, confidence intervals, timestamps, axis ticks.
 *
 * This is the strongest identity move in the design system and simultaneously the alignment
 * guarantee: a monospaced face is tabular by construction, so numeric columns line up
 * without any per-column fiddling.
 *
 * Plex Mono ships no variable version, so the three weights we use are requested explicitly.
 */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

/**
 * Newsreader — prose. Academy lesson bodies, the briefing paragraphs, worked-example text.
 *
 * We load the italic style because the briefing's "Today's focus" headline is set in display
 * italic — the one literary flourish permitted anywhere in the app (plan §3.2).
 *
 * We deliberately do NOT load the optical-size (`opsz`) axis, even though plan §3.2 asks for
 * it. Measured against the Google Fonts API on the latin subset:
 *
 *     ital + opsz + wght   272 KB      <- what §3.2 literally specifies
 *     ital + wght          119 KB      <- what we ship
 *
 * That single axis costs 153 KB, more than Archivo and Plex Mono put together, and it would
 * push the three families to 388 KB against the 320 KB budget in plan §4.5. The budget exists
 * to protect LCP <= 2.5s on a Moto-G-class phone over 4G; optical sizing is a refinement of
 * letterform proportions that most readers will never consciously see. The budget wins, the
 * italic survives, and the total lands at 235 KB. Logged as a structural decision in
 * DECISIONS.md (2026-07-10) with a matching correction block in DEVELOPMENT-PLAN.md.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

/**
 * The class list that publishes all three font variables to the document.
 *
 * Applied once, on <html> in the root layout. Nothing else should attach a font variable:
 * a component that wants prose asks for `font-prose`, and the token resolves.
 */
export const fontVariables = [
  archivo.variable,
  plexMono.variable,
  newsreader.variable,
].join(" ");
