/**
 * check-font-budget.mjs — fails the build gate if the fonts grow past their contract.
 *
 * UI-REDESIGN-PLAN §3.1 budgets the FOUR self-hosted families at 560 KB of woff2, latin subset
 * (raised from 320 KB when Playfair Display joined Inter, JetBrains Mono and Newsreader). That
 * number is not decoration: it is what keeps LCP under 2.5s on a Moto-G-class phone over 4G,
 * which is the device the phase-exit Lighthouse run measures.
 *
 * If the total ever exceeds it, the drop order is fixed in advance so the decision is not made at
 * 2am under pressure: Inter 500 first (600 covers emphasis), then Playfair 600 (700 covers titles).
 * NEVER Playfair italic 400 — the login headline and the pull quotes are set in it.
 *
 * "What a latin reader downloads" is the honest way to count. next/font emits a woff2 for
 * every unicode-range Google offers (cyrillic, vietnamese, greek...), but a browser fetches
 * only the ranges the page's text actually needs. So we sum exactly the faces whose
 * unicode-range covers basic latin, and ignore the rest.
 *
 * Run it after `next build`. Exits non-zero, loudly, when the budget is blown.
 */
import { globSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const BUDGET_KB = 560;
const BUILD_DIR = ".next";

/** Every stylesheet Next emitted for the production build. */
function builtStylesheets() {
  return globSync(`${BUILD_DIR}/**/*.css`);
}

/**
 * Pulls out the @font-face blocks that serve basic latin, and returns the woff2 file each
 * one points at. A block qualifies when its unicode-range starts at codepoint zero — that is
 * the range containing ASCII, which any English page is guaranteed to request.
 *
 * Several spellings of that same range exist in the wild, and we have to accept all of them.
 * Google serves `U+0000-00FF`; Turbopack's minifier rewrites it to `U+??`; the webpack builder
 * writes `u+00??`; some tools normalise it to `U+0-FF`. Matching only one spelling is how this
 * check has twice quietly stopped finding any fonts — once per bundler. So match them all.
 */
const LATIN_RANGE = /^u\+(0{0,2}\?\?|0{1,4}-0{0,2}ff)(?![0-9a-f?])/i;

function latinFontFiles() {
  const files = new Set();
  for (const sheet of builtStylesheets()) {
    const css = readFileSync(sheet, "utf8");
    for (const block of css.split("@font-face").slice(1)) {
      const range = /unicode-range:\s*([^;}]+)/i.exec(block);
      const url = /url\(([^)]+\.woff2)\)/i.exec(block);
      if (!range || !url) continue;
      if (!LATIN_RANGE.test(range[1].trim())) continue;
      files.add(basename(url[1].replaceAll(/["']/g, "")));
    }
  }
  return [...files];
}

/** Resolves an emitted font filename to its size on disk, in bytes. */
function sizeOnDisk(filename) {
  const hits = globSync(`${BUILD_DIR}/**/${filename}`);
  if (hits.length === 0) {
    throw new Error(
      `Font "${filename}" is referenced by the built CSS but is not on disk. ` +
        `The build is inconsistent — do not ship it.`,
    );
  }
  return statSync(hits[0]).size;
}

const files = latinFontFiles();
if (files.length === 0) {
  console.error(
    "No latin @font-face rules found in the build output.\n" +
      "Either the fonts stopped loading, or next/font changed its emit format.\n" +
      "Investigate before trusting this check again — a silent pass here is worthless.",
  );
  process.exit(1);
}

const totalBytes = files.reduce((sum, f) => sum + sizeOnDisk(f), 0);
const totalKb = Math.round(totalBytes / 1024);

console.log(`Font budget (redesign §3.1): latin woff2 across the four families`);
for (const f of files.sort()) {
  console.log(`  ${String(Math.round(sizeOnDisk(f) / 1024)).padStart(4)} KB  ${f}`);
}
console.log(`  ${"─".repeat(8)}`);
console.log(`  ${String(totalKb).padStart(4)} KB  total  (budget ${BUDGET_KB} KB)`);

if (totalKb > BUDGET_KB) {
  console.error(
    `\nFAIL: fonts are ${totalKb - BUDGET_KB} KB over budget.\n` +
      `Do not raise the budget to make this pass. Drop a weight, a style, or a variable ` +
      `axis — and log the choice in DECISIONS.md, because §3.2 tokens are structural.`,
  );
  process.exit(1);
}

console.log(`\nPASS: ${BUDGET_KB - totalKb} KB of headroom.`);
