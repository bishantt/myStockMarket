#!/usr/bin/env node
/**
 * check-drift.mjs — the anti-drift checklist v2, made mechanical (UI-REDESIGN §3.10).
 *
 * A design system dies not in one bad commit but in twenty small ones — an ad-hoc hex, a
 * `rounded-[14px]`, a transition on a card holding a base rate; each defensible alone, the sum a
 * template. So the rules a machine CAN check are checked at every phase exit, and all must come back
 * empty. The HONESTY rules enforce the preserved constitution (§2.2): a failure there means the product
 * can lie, not merely that it looks wrong.
 *
 * THIS SCRIPT IS THE CHECKLIST. §3.10 v2 is its prose ancestor and now a pointer, not a register — do
 * not restate the rule count anywhere else, cite this file (the count prints itself at the end, the one
 * number that cannot rot).
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
 * THIS LIST IS THE AMBER REGISTER. It is the truth about who may spend amber, and the plans and
 * skills that discuss P11 point HERE rather than restating a count that then rots.
 *
 * They used to restate it, and it rotted exactly as predicted: UI-REDESIGN-PLAN §3.10, APP-FEEL's
 * P11 row and the new-surface skill all said "exactly two consumers" — and so did this docstring —
 * while the list below had grown to FOUR product consumers via two logged structural amendments
 * (N2's PipelineStrip, N3's MacroBoard). An executor obeying the text would have stripped
 * sanctioned amber at an exit. Repaired 2026-07-13 (GATE-EFFICIENCY-PLAN G4, analysis §3.5).
 *
 * P11 (§3.3) is NOT a count. It is: amber is RESERVED, the list is SHORT, and every entry is
 * ARGUED IN PLACE. Adding one is a structural amendment — log it in DECISIONS.md and write the
 * argument here, beside the entry. The count is whatever this array says today.
 *
 * The styleguide is the last name here and is not a consumer at all. It is the living spec, and
 * §5.8 requires it to render the reserved-region swatch row — the page whose whole job is to show
 * what amber is reserved FOR cannot be the page forbidden from showing it.
 */
const ALERT_ALLOWED = [
  "components/desk/BriefArticle.tsx",
  "components/desk/Watchlist.tsx",
  // Added in N2 (NEWS-AND-CONTROL-PLAN Part 4.1, logged as a structural amendment). The strip's
  // AGING state — a session's edition never landed — is a genuine alert about a real degradation,
  // which is precisely what the reserved amber is reserved FOR. It is a sanctioned addition to
  // P11's consumer list, not a loophole: the list stays short and every entry is argued.
  "components/desk/PipelineStrip.tsx",
  // Added in N3 (Part 6.4 rung 5, logged as a structural amendment). The macro board's STALE cell:
  // a household number three full cadences past its last publication has stopped being information
  // and started being furniture, and the reader is entitled to be told so in the app's alert voice.
  //
  // Note what does NOT earn amber here, and the line is deliberate: "not yet reported" (an
  // unprovisioned key) and "source unreachable tonight" (one failed fetch) both render quiet. An app
  // that shouts about a missing API key has nothing left to say on the night its numbers are wrong.
  "components/desk/MacroBoard.tsx",
  "app/styleguide/page.tsx",
];

/**
 * DANGER (red) has exactly ONE consumer, and that is the strictest colour rule in the app.
 *
 * Amber is reserved for "something degraded". Red means something else entirely: "do not trust the
 * numbers on this page." That claim may be made by exactly one surface — the pipeline strip's DEAD
 * state — because the moment a second surface can make it, the reader has to start working out
 * which red is which, and a colour that requires interpretation is not an alarm.
 */
const DANGER_ALLOWED = ["components/desk/PipelineStrip.tsx", "app/styleguide/page.tsx"];

/**
 * The P2 files: probability and money visuals. Nothing in them may move (§3.6).
 *
 * PD5 ADDED FOUR, AND THE ADDITION IS THE PHASE'S SHARPEST FINDING. `components/DeltaChip.tsx` is
 * the app's one delta chip and it carries `data-p2`; `TickerChip` embeds it; `Movers` and
 * `Watchlist` render it on every row.
 *
 * Those last two had carried `transition-colors` on their row hover since the redesign, and they got
 * away with it for one reason only: their delta chips were UNMARKED, so the P2 ancestor walk never
 * looked at them. The rule was being kept by luck. Marking the chips (Q-G4-1: a delta is money) made
 * this list bite, and it failed the build on both rows the moment they joined — which is exactly what
 * a guard is for. Their hover is instant now, like NewsCard's always was.
 */
const P2_FILES = [
  "components/BaseRate.tsx",
  "components/StatFigure.tsx",
  "components/DeltaChip.tsx",
  "components/TickerChip.tsx",
  "components/desk/CalibrationScatter.tsx",
  "components/desk/SetupCards.tsx",
  "components/desk/MacroPulse.tsx",
  "components/desk/Movers.tsx",
  "components/desk/Watchlist.tsx",
  "components/ticker/RangeBands.tsx",
  "components/ticker/RangeStrip.tsx",
];

const SEARCH_DIRS = ["app", "components", "lib"];
const CODE_EXT = new Set([".ts", ".tsx", ".css", ".mjs"]);

/**
 * Every source file we police, as repo-relative paths. Test files are deliberately out of scope: a
 * test's job is often to NAME the thing being banned (copy.test.ts pins the base-rate sentence rule 10
 * hunts for), so policing tests would mean tests that cannot say what they test.
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
 * The files rule 21 polices: the seeded world and the browser suite that photographs it. They sit
 * OUTSIDE SEARCH_DIRS — not the shipped surface, but the fixtures and oracle. Every other rule asks
 * "does the app do something it must not?"; rule 21 asks "does the GATE have a fuse burning?". Unit
 * tests are NOT in scope: a unit test controls its own clock, an e2e reads the seed by the real one —
 * the two places a date can quietly expire.
 */
function fuseFiles() {
  const files = ["prisma/seed.mjs"];
  for (const entry of readdirSync(join(ROOT, "prisma", "fixtures"))) {
    if (extname(entry) === ".mjs") files.push(`prisma/fixtures/${entry}`);
  }
  for (const entry of readdirSync(join(ROOT, "e2e"))) {
    if (extname(entry) === ".ts" && !/\.test\.ts$/.test(entry)) files.push(`e2e/${entry}`);
  }
  return files.sort();
}

/**
 * The files rule 23 polices: the brand's other two homes. Outside SEARCH_DIRS like the fuse files, but
 * the brand's colours live here as surely as in globals.css — public/*.svg is rasterised into every
 * monochrome icon, and scripts/*.mjs does the rasterising, so a hex here tints a real pixel. The
 * generator's own test file is excluded, like every test (rule 1's argument: a test NAMES what it polices).
 */
function brandFiles() {
  const files = [];
  for (const entry of readdirSync(join(ROOT, "scripts"))) {
    if (extname(entry) === ".mjs") files.push(`scripts/${entry}`);
  }
  for (const entry of readdirSync(join(ROOT, "public"))) {
    if (extname(entry) === ".svg") files.push(`public/${entry}`);
  }
  return files.sort();
}

/**
 * The two files allowed to say a date out loud — one per world, and they must agree. Everything else
 * derives from these. The rule is not "never write a date" (the seeded world IS a fixed morning, or the
 * pixel oracle photographs whatever today holds) but "there is exactly ONE date, it has a name, and
 * nothing keeps a second copy."
 */
const DATE_ANCHORS = [
  // The seeded world's anchor: the synthetic trading day everything in prisma/ is measured from.
  "prisma/fixtures/clock.mjs",
  // The browser suite's anchor: the instant vrt.spec.ts and desk.spec.ts pin the page's clock to.
  "e2e/seeded-clock.ts",
];

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
    name: "HONESTY — amber (alert) has a short, argued consumer list (§3.3, P11)",
    skip: [...TOKEN_FILES, ...ALERT_ALLOWED],
    match: (line) => /\b(bg|text|border)-alert\b|\balert-wash\b/.test(line),
  },
  {
    id: 19,
    name: "HONESTY — danger (red) has exactly ONE consumer: the dead-pipeline strip",
    /*
     * The one surface allowed to be loud (NEWS-AND-CONTROL Part 4.1): a silently dead pipeline serving
     * stale data is the catastrophic failure, so it gets a red banner nobody can miss or dismiss. The
     * value is entirely in its scarcity — a second red surface makes the reader ask "which red is this?",
     * and the answer arrives too late. One consumer; this rule fails the build for the second.
     */
    skip: [...TOKEN_FILES, ...DANGER_ALLOWED],
    match: (line) => /\b(bg|text|border)-danger\b|\bdanger-wash\b/.test(line),
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
    //
    // /api routes are exempt: a route handler is not a page and has nothing to prerender.
    //
    // /settings is exempt, ONCE, and the exemption is spelled out in three places that must agree:
    // its page.tsx, the ALLOWLIST in check-routes.mjs, and here. The reason is a rule this codebase
    // learned twice: A PAGE MAY BE CACHED, OR IT MAY BE WRITTEN TO AND READ BACK IN THE SAME CLICK —
    // NOT BOTH. Settings is the only room in the app that is a writer rather than a reader. If you
    // are about to add a second entry to this list, the question to answer first is whether the page
    // you are exempting is really a writer, or whether you are just reaching for the flag.
    skip: ["app/(desk)/settings/page.tsx"],
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
    id: 18,
    name: "A11Y — `faint` is for placeholders and disabled states, never for information",
    /*
     * The token sheet has said so since R1 — "placeholders/disabled; never body text" — and the app
     * ignored it. An axe pass at F7 found up to 58 failing nodes on one page, every one a `text-faint`
     * carrying real information (a disclosure's count, an em-dash, a column label). The numbers: `faint`
     * measures 2.23:1 on Morning's paper (AA wants 4.5:1), `muted` measures 4.83:1 and passes — never a
     * palette problem, a misuse of it. A DISABLED state is allowed (WCAG exempts disabled controls). Both
     * spellings count: `disabled:text-faint` and `has-[:disabled]:text-faint` on a wrapping LABEL (the only
     * form when the greyed thing is the label). The rule knew only the first and fired on correct code —
     * and a guard that rejects correct code teaches people to work around it.
     */
    skip: TOKEN_FILES,
    match: (line) => /\btext-faint\b/.test(line) && !/disabled\]?:text-faint/.test(line),
  },
  {
    id: 17,
    name: "PERF/CORRECTNESS — never revalidatePath(..., 'layout'); it 404s the closed-param routes",
    /*
     * This rule exists because the alternative is a room disappearing. `revalidatePath(path, "layout")`
     * drops the known-params set of any route with `dynamicParams = false` — every URL in that family
     * then 404s until the next deploy. /scans/[preset] declares exactly that. The theme action (P6) and
     * watchlist action (F1) both called it, so a reader changing their theme once would have 404'd every
     * scan table until a redeploy; CI caught it when a VRT baseline came back a picture of a 404. Name the
     * paths you change instead: the app has five rooms, and the blast radius is then exactly what you wrote.
     */
    skip: [],
    match: (line) => /revalidatePath\([^)]*,\s*["']layout["']\s*\)/.test(line) && !/^\s*(\*|\/\/)/.test(line),
  },
  {
    id: 20,
    name: "one door for imagery — news visuals render only through components/news/NewsImage.tsx",
    /*
     * The imagery rule (plan 7.9). One component owns every news visual, and the reasons are all
     * things that go quietly wrong when a second one appears:
     *
     *   - ETIQUETTE. Images are fetched at INGEST, into our own bucket, with a descriptive user
     *     agent and robots.txt honoured. A second consumer that hotlinks a publisher's URL at render
     *     time is stealing their bandwidth on every page view, and it would look identical on screen.
     *   - LAYOUT SHIFT. Every rendered image carries explicit width/height from its stored row, which
     *     is what makes the room's CLS zero BY CONSTRUCTION rather than by luck. An <img> without
     *     them reflows the page under the reader's thumb.
     *   - THE FALLBACK RUNGS. When no photo exists — which today is EVERY card, since the bucket does
     *     not exist yet (P-1) — the generated card is what ships, and it is a designed outcome rather
     *     than a hole. A second consumer would render an empty box and call it a failure state.
     *
     * `next/image` and `<img>` are both caught: the point is that the news bucket has one door, not
     * that one API is safer than the other.
     */
    /*
     * THE SECOND DOOR, ADDED AT PD2, AND IT IS ARGUED RATHER THAN ASSUMED.
     *
     * components/BrandMark.tsx renders the house mark, and it is an <img>, so this rule would catch
     * it. It is allowed through because NOT ONE of the three reasons above applies to it:
     *
     *   - ETIQUETTE. There is no publisher. The mark is our own file, committed to this repo and
     *     generated from one master by scripts/brand-assets.mjs. Nothing is hotlinked, because there
     *     is nothing to hotlink.
     *   - LAYOUT SHIFT. BrandMark's width and height are not read from a database row that might be
     *     null — they are constants in the component, one per named size. CLS is zero for the same
     *     reason NewsImage's is, by construction rather than by luck.
     *   - THE FALLBACK RUNGS. There are none, and there should be none. A news card without a photo
     *     has a designed answer; a brand without its mark is not a state the product has.
     *
     * A second consumer of the mark would still be wrong — it would size it by hand and drift from
     * the generated assets — which is why the door is a COMPONENT and not an exemption. One door,
     * not a hole in the wall. Logged in DECISIONS.md.
     */
    skip: ["components/news/NewsImage.tsx", "components/BrandMark.tsx"],
    match: (line, file) =>
      /^(components|app)\//.test(file) &&
      (/<img[\s>]/.test(line) || /from ["']next\/image["']/.test(line)),
  },
  {
    id: 16,
    name: "one table, one set of ergonomics — <table> lives only in components/DataTable.tsx",
    // A second hand-rolled table is a second set of sort affordances, a second pagination grammar,
    // and a second chance to ship a leaderboard by accident. The track-record page was skip-listed
    // until F6 converted it; that entry is gone now and the rule is closed. There is one table in
    // this app.
    //
    // COMMENTS ARE EXEMPT (added PD5), for the reason rules 1, 4, 21, 23 and 24 already give: a rule
    // must let prose NAME the thing it bans, or the code cannot explain itself. PD5 wrote the colour
    // dictionary as a GRID and left a comment saying why it is not a `<table>` — and this rule
    // promptly failed the build on the word. The markup is what ships; a tag inside a comment
    // renders nothing.
    skip: ["components/DataTable.tsx"],
    match: (line) => /<table[\s>]/.test(line) && !/^\s*(\*|\/\/|\/\*|<!--)/.test(line),
  },
  {
    id: 21,
    name: "THE FUSE-FINDER — no absolute date outside the two anchors (seeded world + browser suite)",
    /*
     * "An absolute fixture under a relative rule has a fuse on it — /paper's baseline expired 28 minutes
     * after the run that certified it" (recording in prisma/fixtures/paper.mjs's header). The paper
     * ledger's closed trades sat on absolute dates while the page counted them against a rolling 7-day
     * window; the window walked forward, the fixture did not, and the gate went red one evening because of
     * the calendar, looking exactly like a regression. This class cost two exits, so it becomes a grep.
     *
     * It does NOT say "never write a date": the seeded world IS a fixed morning and must be. It says there
     * is exactly ONE date per world, it has a NAME, and everything derives from it — a second unnamed copy
     * is how the two silently drift apart. Comments are exempt like rule 1's hex, and a trailing
     * `// 2026-07-12` beside a derived expression is ENCOURAGED — it lets a human check the arithmetic
     * against a calendar without running the code.
     */
    only: fuseFiles(),
    skip: DATE_ANCHORS,
    match: (line) => {
      // A whole-line comment says nothing to the machine, so it can say anything to the reader.
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return false;
      // Drop a trailing line comment before looking. The lookbehind spares `https://…` from being
      // mistaken for the start of one.
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      return /\b20\d\d-\d\d-\d\d/.test(code);
    },
  },
  {
    id: 22,
    name: "E2 — one door for weekday words (lib/time.ts renders them; lib/market-hours.ts decides on them)",
    /*
     * THE DUPLICATE THIS ABOLISHES, and what it would have cost.
     *
     * lib/morning.ts carried its own `weekdayName` — an Intl.DateTimeFormat with {weekday: "short",
     * timeZone: "UTC"} — which was, byte for byte, what lib/time.ts's formatUtcWeekday already did.
     * Two identical formatters, one of them invisible. Nothing was broken. That is the point: a
     * second copy of a formatter is not a bug, it is a bug's HABITAT. The day anyone changes the
     * timezone, the locale or the width on one of them, the app names one weekday two ways and no
     * test on earth notices, because both answers are individually correct.
     *
     * The breadth line said "at Fri's close" through the copy. The masthead said "Friday, July 10"
     * through the original. On 2026-07-11 they both said Saturday, faithfully, about a day with no
     * close — which is a different bug (Part 1.2, fixed in the pipeline) but the same lesson: a
     * claim about a day is a claim, and claims get made in ONE place where they can be audited.
     *
     * TWO DOORS, NOT ONE, AND THE DIFFERENCE IS THE WHOLE RULE. The plan's census said there was
     * exactly one local weekday formatter to delete. There were two things using {weekday}, and the
     * second is not a duplicate at all:
     *
     *   lib/time.ts        RENDERS a weekday as a WORD, for a reader. "Fri", "Friday".
     *   lib/market-hours.ts DECIDES with a weekday: it asks New York what day it is so it can answer
     *                       "is the market open?" — and compares the answer to "Sat"/"Sun". No reader
     *                       ever sees that string. It is the calendar, and the calendar is allowed to
     *                       know what day it is.
     *
     * A rule that banned the second one would have forced the market-state check to import a
     * display formatter to do arithmetic with, which is worse than the thing it was preventing. So
     * both doors are named here, each with its reason, and a THIRD one fails the build.
     */
    skip: ["lib/time.ts", "lib/market-hours.ts"],
    match: (line) => {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return false;
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      // `weekday:` as an Intl.DateTimeFormat option — the only way to mint a weekday word.
      return /\bweekday\s*:\s*["'](long|short|narrow)["']/.test(code);
    },
  },
  {
    id: 29,
    name: "E1 — one door for date/time rendering: only lib/time.ts constructs an Intl.DateTimeFormat",
    /*
     * THE SIBLING OF RULE 22, ONE STEP UP. Rule 22 keeps weekday WORDS to one door; this keeps the whole
     * date/time FORMATTER to one. CC2 (ruling R1) rewrote every reader-facing shape — 12-hour clocks,
     * weekday-bearing dates — and could do it cleanly only because exactly ONE file turns an instant into
     * a string. A second Intl.DateTimeFormat is a second answer to "how does this app tell time", and the
     * day the two disagree no test notices, because each is individually valid (rule 22's exact failure).
     *
     * TWO DOORS, for the same reason rule 22 has two:
     *   lib/time.ts         RENDERS an instant or a bare date as a reader-facing string.
     *   lib/market-hours.ts DECIDES with time — it asks New York what the ET date and minute are so it can
     *                       answer "is the market open?". No reader sees that string; it is arithmetic.
     * A third file fails the build. scripts/ is out of SEARCH_DIRS (the guards' own en-CA parsers are
     * already out of scope), as is the pipeline's Python — R1 scopes this to the app, which renders here.
     */
    skip: ["lib/time.ts", "lib/market-hours.ts"],
    match: (line) => {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) return false;
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      return /\bIntl\.DateTimeFormat\s*\(/.test(code);
    },
  },
  {
    id: 14,
    name: "PERF — internal links go through next/link, and nobody turns prefetch off",
    /*
     * A raw <a href="/..."> is a full document reload — the service worker re-runs, fonts re-request,
     * React re-hydrates. Two survived on the Desk until F1. The `href={` form is here because the first
     * rule missed one: the setup card's Academy link was `<a href={`/academy/${slug}`}>`, a template
     * literal a `href="/`-only rule never matched, reloading the app's most important doorway for three
     * phases. `prefetch={false}` is the other way to lose the same thing — on a static route the default
     * prefetch is what makes the tap feel instant.
     */
    skip: [],
    match: (line) =>
      /<a\s+href=["']\/(?!\/)/.test(line) || /<a\s+href=\{/.test(line) || /prefetch=\{false\}/.test(line),
  },
  {
    id: 23,
    name: "the brand's hexes have exactly one door outside the token sheet — scripts/brand-assets.mjs",
    /*
     * THE HOLE THIS CLOSES, found while building the identity kit in PD2.
     *
     * Rule 1 bans a raw hex outside the two token files. But rule 1 only ever looked at app/,
     * components/ and lib/ (see SEARCH_DIRS), and the brand does not only live there: it also lives
     * in the SVGs under public/ and in the generator that rasterises them. Those two places have
     * been free to state any colour they liked, and nothing would have said a word. That was fine
     * while the icons came from a flat SVG tile with the gradient written into it. It stopped being
     * fine the moment a generator started stamping a brand colour into ten binary files that no
     * grep can read afterwards.
     *
     * So the scan is extended to the two directories rule 1 never covered, and exactly ONE door is
     * cut: scripts/brand-assets.mjs, which declares BRAND_FIELD at the top with its provenance —
     * and, crucially, does not merely STATE the colour but ASSERTS it, by re-sampling the master and
     * refusing to run if the pixels disagree. That is the difference between a constant and a claim,
     * and it is why this file is allowed to hold one.
     *
     * Comments are exempt, exactly as in rule 1: the prose has to be able to name the colour it is
     * talking about, and a hex in a comment tints nothing.
     */
    only: brandFiles(),
    skip: ["scripts/brand-assets.mjs"],
    match: (line) =>
      /#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*(\*|\/\/|\/\*|<!--)/.test(line),
  },
  {
    id: 24,
    name: "LAW 2 — a module reserves no height: no `min-h-` on any surface (PD3 §6.2)",
    /*
     * THE LAW: a module with content renders at its natural height, and an empty module renders a
     * slim information band. NOTHING reserves height.
     *
     * WHY IT IS A BUILD FAILURE AND NOT A PREFERENCE. PD3 was commissioned to kill a dead hole in
     * the Desk's grid — an empty stretch of nothing under a short module, on the app's main surface,
     * photographed by the user. Law 1 (independent column flow) removed the mechanism that CREATED
     * that hole. This rule removes the temptation to build one by hand.
     *
     * A `min-h` on a module is a promise, made in whitespace, that content is coming to fill it. On
     * the night the pipeline did not run, that promise is a lie, and the reader scrolls past the
     * same emptiness either way — only now the app looks broken rather than quiet. The honest empty
     * state is components/EmptyModule.tsx: a masthead, one line, a timestamp, and it stops.
     *
     * TODAY THIS RULE FINDS NOTHING, and that is exactly why it is worth writing. The tree is clean
     * right now; the plan's own words were "today true; now a stated law with a grep". A law that
     * only gets written after it is broken has already cost you the thing it was protecting.
     *
     * THE THREE EXEMPTIONS, each argued, none of them a loophole:
     *
     *   · `min-h-11` — the 44px touch floor. This is the OPPOSITE rule, and it is a requirement:
     *     every control on a phone must be at least 44px tall, and e2e/hardening.spec.ts fails the
     *     build if one is not. A control is not a module, and reserving height for a THUMB is not
     *     reserving height for absent content.
     *   · `min-h-0` — a RESET to zero, which reserves nothing at all. It is the exact opposite of
     *     the thing this rule bans, and the tree already depends on it: a mover's source link
     *     carries `min-h-11 md:min-h-0`, taking its 44px on a phone and giving it back above `md`,
     *     where there is no thumb to protect and 44px of link would be a hole in a sentence. (This
     *     exemption is here because the rule FOUND that line on its first run and called it a
     *     violation. It was right to look and wrong to fail — so the rule learned the difference
     *     between reserving height and refusing to.)
     *   · `min-h-dvh` / `min-h-screen` — the page shell, which must fill the viewport so the wash
     *     paints the whole window. That is the page, not a module in it.
     *
     * Anything else — `min-h-[200px]`, `min-h-64`, a min-height in a style object — is the thing
     * this rule exists to stop, and it fails the build with the file and line that did it.
     */
    match: (line) => {
      if (/^\s*(\*|\/\/|\/\*|<!--)/.test(line)) return false; // prose may name the rule it describes
      const tailwind = /\bmin-h-(?!11\b|0\b|dvh\b|screen\b)[[\w.-]/.test(line);
      const inlineStyle = /\bminHeight\s*:/.test(line);
      return tailwind || inlineStyle;
    },
  },
  {
    id: 25,
    name: "one door for the room container — the measure is stated only in components/PageContainer.tsx",
    /*
     * Every room sits in the same measured column: centred, capped at 1360px, 1500px in the `wide`
     * band, 16px gutters stepping to 32px at `desk`. One decision — written out by hand in FIVE
     * places until PD3 (both layouts' `<main>`, both top bars, the styleguide).
     *
     * They agreed with each other, which is not the same as being safe. The next change to this
     * column was a five-file sweep, and forgetting one file produces a room that is subtly narrower
     * than every other room, on one breakpoint, which nobody would ever catch by looking. This is
     * the same lock this codebase already puts on its table (DataTable), its news imagery
     * (NewsImage) and its brand mark (BrandMark): a shared decision gets exactly one door.
     *
     * The rule watches the two literals that ARE the decision — the caps. A room that wants a
     * different measure is making a real design argument, and it should have to come here and make
     * it, rather than typing a number into a className at 2am.
     */
    skip: ["components/PageContainer.tsx"],
    match: (line) =>
      !/^\s*(\*|\/\/|\/\*|<!--)/.test(line) &&
      (/max-w-\[1360px\]/.test(line) || /max-w-\[1500px\]/.test(line)),
  },
  {
    id: 26,
    name: "one door for the ticker route — a /ticker/ link is a TickerChip (PD5 §8.2.1)",
    /*
     * THE DRIFT THIS CLOSES. Before PD5 a ticker symbol was rendered THREE ways: a bare mono span on
     * the Desk's movers and watchlist, a bordered chip with a move on a news card, and a bare accent
     * link in an affected table. One kind of fact, three treatments, and no two of them agreed on
     * whether a symbol was even a door. That is how a design system dies — not in one bad decision,
     * but in three reasonable ones taken on three different afternoons.
     *
     * components/TickerChip.tsx is the one door now. It renders every symbol identically and mints
     * the only /ticker/ href in the app, so a NEW bare link to a ticker page — in a scan table, an
     * academy lesson, a future room — fails the build instead of quietly becoming the fourth
     * treatment.
     *
     * THE TWO ARGUED EXCEPTIONS, and note what they have in common: NEITHER IS A SYMBOL.
     *
     *   · components/rail/RailDialog.tsx — "Open full view →". The rail is the level-2 peek, and this
     *     is its single exit to the full page. It is a SENTENCE, a call to act; the symbol above it
     *     in the sheet is a different thing entirely.
     *   · components/news/AffectedTable.tsx — "Setup card →". A signpost saying the ticker page holds
     *     an evidence card for this name. Also a sentence, and it renders BESIDE a TickerChip that is
     *     already the symbol's door.
     *
     * This is the same shape as rule 20's second door (BrandMark): one door for the THING, plus
     * named CTAs that happen to travel to the same room. A door is a component; an exception is a
     * decision someone had to defend in writing. Both are here.
     */
    skip: [
      "components/TickerChip.tsx",
      "components/rail/RailDialog.tsx",
      "components/news/AffectedTable.tsx",
    ],
    match: (line, file) => {
      if (/^\s*(\*|\/\/|\/\*|<!--)/.test(line)) return false; // prose may name the route
      if (!/^(components|app)\//.test(file)) return false; // lib/ holds route strings, not links
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      // An href to the ticker room, in either the literal or the template-literal form. Rule 14
      // learned this lesson already: a rule that only looks for `href="/…"` misses `href={`/…`}`,
      // and the one it missed sat in the tree for four phases.
      return /href=\{?["'`]?\/ticker\//.test(code);
    },
  },
  {
    id: 27,
    name: "TYPE — no bold inside serif prose: the weight is not loaded, so the browser fakes it (§8)",
    /*
     * The app loads Inter 400/600, JetBrains Mono 400/500/600, Playfair 700 + italic, Newsreader roman +
     * italic — EVERY weight that exists. There is no bold Newsreader. So `font-bold` on a `font-prose` or
     * `font-serif` element renders SYNTHESIZED bold: the browser smears the roman outline sideways, muddy
     * and breaking the vertical rhythm (rule 7 already bans the other synthesis routes). The type system's
     * answer to "this word matters" is ITALIC (§8.2.4), MONO for a gate-verified figure (§8.2.3), or a
     * doorway UNDERLINE (§8.2.2) — each carries INFORMATION; a bold word carries only volume. The tree
     * passes the day this is written, which is when a rule is worth writing: PD5 hands every surface a
     * richness kit, and "make it stand out" is the 2am request this expects for the rest of the build.
     */
    match: (line) => {
      if (/^\s*(\*|\/\/|\/\*|<!--)/.test(line)) return false;
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      // Both must be on the same element for this to be a real synthesis. A `font-bold` elsewhere in
      // the file is an Inter or a Mono weight, and those are loaded.
      return /\bfont-(prose|serif)\b/.test(code) && /\bfont-(bold|semibold|black|extrabold)\b/.test(code);
    },
  },
  {
    id: 28,
    name: "the direction wash has exactly TWO doors — DeltaChip and OutcomeChip (PD6 §8.2)",
    /*
     * THE RULE PD5 NEEDED AND DID NOT HAVE, AND THE ONE THAT WOULD HAVE CAUGHT ALL OF IT.
     *
     * PD5 built `components/DeltaChip.tsx` to be the app's ONE delta chip. It hunted the siblings by
     * hand, found four, fixed them, and wrote down the law: *a duplicated component is not a bug, it
     * is a bug's HABITAT*.
     *
     * THERE WERE SIX. `DataTable.tsx` held a private `function DeltaChip` that shadowed the kit
     * component's own name, and `scans/page.tsx` held a sixth inline. Both were rendering on the
     * front-facing rooms every night. Neither carried PD4's wrap contract. Neither carried a WINDOW,
     * so on a phone — where a priority-1 cell is drawn with no column header beside it — the scan
     * tables and the news room's affected-tickers table showed a bare "▼ −12.4%" for a column that
     * meant "12.4% below the 52-week high". A hand grep found four of six and nothing failed.
     *
     * A HAND GREP IS NOT A GUARD. So here is the guard, and it is pointed at the one thing all six
     * copies had in common and could not have avoided: **a direction-coloured BACKGROUND**. That wash
     * is what makes a chip a chip. Any new hand-rolled delta or outcome chip must paint one, and the
     * moment it does, the build fails and tells the author which door to use.
     *
     * IT MATCHES THE WASH, NOT THE TEXT, AND THAT IS DELIBERATE. `text-down-text` is legitimately
     * used by every error message in the app (a failed login, a rejected watchlist symbol) — those
     * are not chips and must not be dragged in here. A direction-coloured *fill* has exactly one
     * meaning in this product: "this is a signed market fact". Two components own that meaning.
     *
     * The styleguide is the third door and it is not an exception — it RENDERS the two components as
     * specimens, so it never names the wash itself.
     */
    skip: ["components/DeltaChip.tsx", "components/OutcomeChip.tsx"],
    match: (line, file) => {
      if (/^\s*(\*|\/\/|\/\*|<!--)/.test(line)) return false; // prose may name the token
      if (!/^(components|app)\//.test(file)) return false;
      const code = line.replace(/(?<![:/])\/\/.*$/, "");
      return /\bbg-(up|down)-wash\b/.test(code);
    },
  },
];

let failures = 0;

for (const rule of RULES) {
  // `only` narrows to a named set; `skip` carves the argued exceptions out of it. They used to be
  // either/or, which meant an `only` rule could not have an allowlist — and rule 21 is exactly that
  // shape: a named set minus the two files allowed to hold the anchor.
  const scope = (rule.only ?? FILES).filter((f) => !(rule.skip ?? []).includes(f));
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
