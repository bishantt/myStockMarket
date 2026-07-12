/**
 * fonts.ts — the four typefaces of "Morning Broadsheet" (UI-REDESIGN-PLAN §3.1), and only these four.
 *
 * All four load through next/font, which downloads them at build time and serves them from our own
 * origin. That matters for two reasons: the installed PWA has to work offline (a font fetched from
 * Google's CDN could not be precached), and a same-origin font makes no third-party request when
 * the user opens the app.
 *
 * Each loader exposes a CSS custom property; globals.css composes those into the --font-display,
 * --font-ui, --font-mono and --font-prose tokens with their fallback stacks, so no component ever
 * names a family directly.
 *
 * The signature pairing is an editorial serif over mono numerals. The law that survives every
 * redesign: NUMBERS ARE MONO, WITHOUT EXCEPTION.
 *
 * Budget for the four, latin subset: ≤ 560KB woff2 (§3.1, raised from 320KB with the fourth
 * family). `npm run check:fonts` prints the per-file sizes and fails the build if the total is over.
 */
import { Inter, JetBrains_Mono, Newsreader, Playfair_Display } from "next/font/google";

/**
 * Playfair Display — the broadsheet made literal. Page titles, card titles, the Desk date, the
 * login headline, pull quotes.
 *
 * Never a number. Never body text. Never below 19px (the "serif floor", §3.1): a display serif's
 * hairlines collapse at text sizes, which is precisely why Newsreader exists below it.
 *
 * It loads `display: "swap"`, alone among the four. The others use `optional`, where a missed swap
 * costs nothing structural because next/font's metric-adjusted fallbacks hold the line boxes. But
 * Playfair SETS the headlines: with `optional`, one slow first load ships Georgia headlines for the
 * whole session, and no metric-matched fallback can mask a display serif at 46–56px. One swap frame
 * is the cheaper price, and it is a deliberate choice (§7.4).
 */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair",
});

/**
 * Inter — structure and UI. Every label, control, table cell, and nav item. Replaces Archivo.
 *
 * Inter is never used for a number. Numbers are JetBrains Mono, always.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
  variable: "--font-inter",
});

/**
 * JetBrains Mono — every quantitative figure in the product: prices, percentages, counts, sample
 * sizes, confidence intervals, timestamps, axis ticks. Plus the mastheads, tags and provenance
 * lines, which speak in the same terminal voice.
 *
 * This is both an identity move and an alignment guarantee: a monospaced face is tabular by
 * construction, so numeric columns line up without any per-column fiddling.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
  variable: "--font-jetbrains",
});

/**
 * Newsreader — the text serif. Academy lesson bodies, briefing paragraphs, and the small editorial
 * italics (setup-card pattern names) that Playfair is too fragile to set.
 *
 * The optical-size (`opsz`) axis is deliberately NOT loaded: measured on the latin subset it cost
 * 153KB on its own, and it refines letterform proportions in a way most readers never consciously
 * see. The display italic survives, which is the part the product actually depends on. (Structural
 * decision, DECISIONS.md 2026-07-10, with a matching correction block in DEVELOPMENT-PLAN.md §3.2.)
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "optional",
  variable: "--font-newsreader",
});

/**
 * The class list that publishes all four font variables to the document.
 *
 * Applied once, on <html> in the root layout. Nothing else should attach a font variable: a
 * component that wants prose asks for `font-prose`, and the token resolves.
 */
export const fontVariables = [
  playfair.variable,
  inter.variable,
  jetbrainsMono.variable,
  newsreader.variable,
].join(" ");
