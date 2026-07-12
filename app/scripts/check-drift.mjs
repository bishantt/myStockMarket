#!/usr/bin/env node
/**
 * check-drift.mjs — the anti-drift checklist v2, made mechanical (UI-REDESIGN-PLAN §3.10).
 *
 * A design system does not die in one bad commit. It dies in twenty small ones: an ad-hoc hex here
 * because the token was "close but not quite", a `rounded-[14px]` there because 12 looked wrong at
 * 2am, a transition on a card that happens to contain a base rate. Each is defensible alone. The
 * sum is a template.
 *
 * So the rules that CAN be checked by a machine are checked by a machine, at every phase exit.
 * Eleven greps. All must come back empty. The ones marked HONESTY are not style rules wearing a
 * style rule's clothes — they enforce the preserved constitution (§2.2), and a failure there means
 * the product can lie, not merely that it looks wrong.
 *
 * Run: npm run check:drift
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();

/** The two files allowed to hold raw design values. Everything else asks for a token. */
const TOKEN_FILES = ["app/globals.css", "lib/tokens.ts"];

/** The five components allowed to spend the blur budget (§3.4). */
const BLUR_ALLOWED = [
  "app/(desk)/layout.tsx",
  "app/academy/layout.tsx",
  "components/desk/TabBar.tsx",
  "components/rail/RailDialog.tsx",
  "components/CommandPalette.tsx",
  "components/GlossaryPopover.tsx",
];

/**
 * Amber's only two consumers (§3.3, P11): the verification-gate flag and the fired-signal marker.
 *
 * The styleguide is the third name here and is not a third consumer. It is the living spec, and
 * §5.8 requires it to render the reserved-region swatch row — the page whose whole job is to show
 * what amber is reserved FOR cannot be the page forbidden from showing it.
 */
const ALERT_ALLOWED = [
  "components/desk/BriefArticle.tsx",
  "components/desk/Watchlist.tsx",
  "app/styleguide/page.tsx",
];

/** The P2 files: probability and money visuals. Nothing in them may move (§3.6). */
const P2_FILES = [
  "components/BaseRate.tsx",
  "components/StatFigure.tsx",
  "components/desk/CalibrationScatter.tsx",
  "components/desk/SetupCards.tsx",
  "components/desk/MacroPulse.tsx",
  "components/ticker/RangeBands.tsx",
];

const SEARCH_DIRS = ["app", "components", "lib"];
const CODE_EXT = new Set([".ts", ".tsx", ".css", ".mjs"]);

/**
 * Every source file we police, as repo-relative paths.
 *
 * Test files are deliberately out of scope. The checklist polices the product's shipped surface,
 * and a test's job is often to NAME the thing being banned — copy.test.ts pins the canonical
 * base-rate sentence verbatim, which is exactly what rule 10 hunts for in product code. Policing
 * the tests would mean writing tests that cannot say what they are testing.
 */
function sourceFiles() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
      } else if (CODE_EXT.has(extname(entry)) && !/\.test\.tsx?$/.test(entry)) {
        found.push(relative(ROOT, full));
      }
    }
  };
  for (const dir of SEARCH_DIRS) walk(join(ROOT, dir));
  return found.sort();
}

const FILES = sourceFiles();
const read = (f) => readFileSync(join(ROOT, f), "utf8");

/**
 * One rule. `test` returns the offending lines in a file (or none). `skip` lists the files where
 * the thing being banned is legitimately allowed — and every entry in a skip list is a decision
 * someone has to defend.
 */
const RULES = [
  {
    id: 1,
    name: "no hex colours outside the token sheet",
    skip: TOKEN_FILES,
    // Ignore hex inside a comment: the token sheet's values are quoted in prose all over the code.
    match: (line) => /#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line),
  },
  {
    id: 2,
    name: "no raw gradients outside the token sheet",
    skip: TOKEN_FILES,
    match: (line) => /(linear|radial|conic)-gradient\(/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 3,
    name: "no arbitrary shadows or radii",
    skip: TOKEN_FILES,
    match: (line) => /\bshadow-\[|\brounded-\[/.test(line),
  },
  {
    id: 4,
    name: "backdrop-blur only in the five sanctioned components (§3.4 blur budget)",
    skip: [...TOKEN_FILES, ...BLUR_ALLOWED],
    // Match the USE of blur — the Tailwind utility or the CSS property — not the word. The
    // styleguide's prose has to be able to explain the rule without tripping it.
    match: (line) => /\bbackdrop-blur-|backdrop-filter\s*:/.test(line),
  },
  {
    id: 5,
    name: "HONESTY — amber (alert) has exactly two consumers (§3.3, P11)",
    skip: [...TOKEN_FILES, ...ALERT_ALLOWED],
    match: (line) => /\b(bg|text|border)-alert\b|\balert-wash\b/.test(line),
  },
  {
    id: 6,
    name: "HONESTY — no motion inside a P2 file (probability/money visuals never move, §3.6)",
    only: P2_FILES,
    match: (line) =>
      /\b(transition|animate-|@keyframes)/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 7,
    name: "only the four loaded font families; no small-caps; no dead width axis; no counters",
    skip: TOKEN_FILES,
    match: (line) =>
      /font-stretch-\[|small-caps|\bfont-archivo\b|\bfont-plex\b|countup|react-countup|confetti|particles/i.test(
        line,
      ) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 8,
    name: "no background-attachment anywhere (it is broken on iOS, §3.4)",
    skip: [],
    match: (line) => /background-attachment/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 9,
    name: "no dead classes from the R1 rename (Tailwind drops them silently)",
    skip: [],
    match: (line) =>
      /\b(bg|text|border)-desk-bg\b|\b(bg|text|border)-academy-bg\b|\brounded-edge\b/.test(line),
  },
  {
    id: 10,
    name: "HONESTY — base rates render only through BaseRate (§3.8, P4)",
    // "X of N" and "N=" percentage pairs may not be assembled anywhere else: a rate without its
    // interval, baseline and WEAK cap is a rate that can mislead, and those live in BaseRate.
    skip: [...TOKEN_FILES, "components/BaseRate.tsx", "lib/baserate.ts", "lib/copy.ts"],
    match: (line) =>
      /\{\s*wins\s*\}\s*of\s*\{\s*n\s*\}|\bN\s*=\s*\$\{|\bof\s+\{n\}/.test(line),
  },
  {
    id: 11,
    name: "no slash-opacity on token colours (it silently no-ops in Tailwind v4)",
    skip: TOKEN_FILES,
    match: (line) =>
      /\b(bg|text|border)-(surface|paper|ink|ink-2|muted|faint|hairline|hairline-strong|accent|accent-deep|band|up|down|alert)(-[a-z-]+)?\/\d/.test(
        line,
      ),
  },
  {
    id: 13,
    name: "PERF — no route may go back to force-dynamic (every room is served from a cache)",
    // Rule 13's full form is `npm run check:routes`, which reads the build's own manifest and is the
    // real gate. This grep is the cheap half: it catches the one-line edit that would undo F1 —
    // someone reaching for `force-dynamic` to make a page "always fresh", not realising that every
    // write already busts its own cache and that the cost is a frozen screen on every tap.
    // /api routes are exempt: a route handler is not a page and has nothing to prerender.
    skip: [],
    match: (line, file) =>
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(line) && !file.startsWith("app/api/"),
  },
  {
    id: 15,
    name: "M3 — nothing scrolls itself (no mandatory snap, no smooth scroll, no autoplay)",
    // Ruling M3 draws its line at INITIATION. A reader pushing a shelf sideways is the reader moving
    // the paper, and that is not "motion" in the sense P2 forbids — the page already scrolls
    // vertically past every price and nobody reads that as the number moving. What is banned is the
    // UI moving the paper BY ITSELF: an autoplaying rail, a programmatic smooth scroll, an
    // auto-advance. `snap-mandatory` is here for a related reason — it fights iOS momentum and feels
    // like the interface grabbing the wheel out of your hand. Proximity snapping cooperates with it.
    skip: [],
    match: (line) =>
      /snap-mandatory|scroll-behavior\s*:\s*smooth|\bautoplay\b|auto-advance/i.test(line) &&
      !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 12,
    name: "HONESTY-adjacent — numbers reach the screen through lib/format, and no other door",
    /*
     * `.toFixed()` is how a number gets on screen without anyone deciding how it should look. That is
     * not a style problem. It is how a loss ends up printed with a HYPHEN instead of a true minus, so
     * it fails to align in a column of signed figures; it is how one price gets two decimals and
     * another gets three; it is how "$3,180,000,000" appears in a cell that should read "$3.18B".
     *
     * The whole paper surface did this — the page, the form, and the ledger all called .toFixed()
     * directly — which is why the sweep happened in F4 and why this rule lands with it, not before.
     *
     * Two files are allowed, and both for the same reason: the number never reaches a reader.
     *   · lib/format.ts       — it IS the door.
     *   · CandleChart.tsx     — the charting library formats its own axis labels.
     *   · Watchlist.tsx       — SVG path COORDINATES ("M12.3,4.5"). Geometry, not a figure.
     */
    skip: ["lib/format.ts", "components/ticker/CandleChart.tsx", "components/desk/Watchlist.tsx"],
    match: (line) => /\.toFixed\(/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 17,
    name: "PERF/CORRECTNESS — never revalidatePath(..., 'layout'); it 404s the closed-param routes",
    /*
     * This rule exists because the alternative is a room disappearing.
     *
     * `revalidatePath(path, "layout")` drops the known-params set of any route that declares
     * `dynamicParams = false`. Every URL in that family then returns 404 — permanently, until the
     * next deploy. /scans/[preset] declares exactly that (it is a closed set of five, and the flag is
     * what makes /scans/garbage a real 404 rather than a 200 carrying a not-found page).
     *
     * The theme action called it from P6 and the watchlist action from F1, so the reader would have
     * found this by changing their theme. Once. And every scan table in the app would have been gone
     * until someone redeployed. CI caught it: a VRT baseline came back as a picture of a 404 page.
     *
     * Name the paths you are changing instead. The app has five rooms; listing them is not a burden,
     * and the blast radius is then exactly what you wrote rather than the whole route tree.
     */
    skip: [],
    match: (line) => /revalidatePath\([^)]*,\s*["']layout["']\s*\)/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 16,
    name: "one table, one set of ergonomics — <table> lives only in components/DataTable.tsx",
    // A second hand-rolled table is a second set of sort affordances, a second pagination grammar,
    // and a second chance to ship a leaderboard by accident. The track-record page still has its own
    // and is skip-listed until F6 converts it; when it does, its entry here comes off and the rule
    // closes for good.
    skip: ["components/DataTable.tsx", "app/(desk)/track-record/page.tsx"],
    match: (line) => /<table[\s>]/.test(line),
  },
  {
    id: 14,
    name: "PERF — internal links go through next/link, and nobody turns prefetch off",
    /*
     * A raw <a href="/..."> is a full document reload: the service worker re-runs, the fonts
     * re-request, React re-hydrates from scratch. Two survived on the Desk until F1 and cost the
     * reader a whole page load each.
     *
     * The `href={` form is in this pattern because the first version of the rule missed one. The
     * setup card's "Learn: how this pattern is judged →" link was written as
     * `<a href={`/academy/${slug}`}>` — a template literal, so it never matched a rule that only
     * looked for `href="/`. It sat there through F1, F2 and F3, reloading the whole document every
     * time a reader followed the app's single most important doorway into the Academy. Found in F4,
     * while adding the doorway beside it.
     *
     * `prefetch={false}` is the other way to lose the same thing: once a route is static, the
     * default prefetch is exactly what makes the tap feel instant.
     */
    skip: [],
    match: (line) =>
      /<a\s+href=["']\/(?!\/)/.test(line) || /<a\s+href=\{/.test(line) || /prefetch=\{false\}/.test(line),
  },
];

let failures = 0;

for (const rule of RULES) {
  const scope = rule.only ?? FILES.filter((f) => !(rule.skip ?? []).includes(f));
  const hits = [];

  for (const file of scope) {
    let text;
    try {
      text = read(file);
    } catch {
      continue; // a P2 file that does not exist in this phase yet
    }
    text.split("\n").forEach((line, i) => {
      if (rule.match(line, file)) hits.push(`${file}:${i + 1}  ${line.trim().slice(0, 96)}`);
    });
  }

  if (hits.length > 0) {
    failures += hits.length;
    console.error(`\n✗ rule ${rule.id} — ${rule.name}`);
    for (const hit of hits) console.error(`    ${hit}`);
  } else {
    console.log(`✓ rule ${rule.id} — ${rule.name}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} anti-drift violation(s). The design system does not bend here.`);
  process.exit(1);
}
console.log(`\nAll ${RULES.length} anti-drift rules pass.`);
