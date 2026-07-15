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
 *
 * A NOTE ON WHAT THE BUDGET ACTUALLY MEASURES, learned the hard way at R6. The check counts the
 * basic-latin faces — the ones any English page is guaranteed to need. But Google splits every
 * family into latin AND latin-ext, and a real browser fetches both: measured on the deployed app,
 * ten woff2 files totalling 429KB, against a budget that read 273KB. The budget is not wrong, it is
 * NARROW, and the gap is the reason the LCP sat at 3.8s while the Speed Index sat at 1.8s.
 *
 * Total blocking time was 20ms in the same run, which is the other half of the finding: the glass,
 * the wash and the orbs cost nothing measurable. Stripping them — the fallback ladder §7.4 offers —
 * would have degraded the design for no gain at all. The weight is in the fonts, so the fonts are
 * where the weight came off.
 */
import { Inter, JetBrains_Mono, Newsreader, Playfair_Display } from "next/font/google";

/**
 * Playfair Display — the broadsheet made literal. Page titles, card titles, the Desk date, the
 * login headline, pull quotes.
 *
 * Never a number. Never body text. Never below 19px (the "serif floor", §3.1): a display serif's
 * hairlines collapse at text sizes, which is precisely why Newsreader exists below it.
 *
 * It loads `display: "swap"` — and since CC1 (ruling R2) so do the other three. `optional` gives a
 * font ~100ms and then commits to whoever won that race FOR THE WHOLE SESSION: on a cold cache or a
 * post-deploy hash change the fallback wins, the real download completes a moment later into an
 * unused cache, and only the NEXT refresh renders correctly. That is exactly the bug D1 diagnosed —
 * the mono that carries every number and every masthead missed its window and shipped a sans fallback
 * for an entire session, which is the "font renders wrong on some refreshes" symptom. `swap` paints
 * the fallback and swaps the real face in the instant it arrives; next/font's metric-adjusted
 * fallbacks make that swap frame near-invisible, and a whole session in the wrong voice is the worse
 * trade. Playfair chose `swap` from the start for this reason at the headline scale (no metric match
 * can mask a display serif at 46–56px); CC1 applies the same reasoning to the three faces below that
 * were still gambling on `optional`. The CC1 gate re-runs check:lighthouse to prove CLS did not move.
 */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  // 700 alone. The budget ladder in §3.1 names Playfair 600 as the second thing to drop, and the
  // R6 measurement called it in: ten font files, 429KB, and an LCP three times the Speed Index.
  // 700 sets every title in the product; 600 was never doing separate work.
  weight: ["700"],
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
  // 500 is gone — the first rung of the §3.1 drop ladder. 600 covers every emphasis in the UI, and
  // the difference between 500 and 600 at 13.5px is not a difference a reader can name.
  weight: ["400", "600"],
  display: "swap",
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
  display: "swap",
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
  display: "swap",
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
