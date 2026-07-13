#!/usr/bin/env node
/**
 * check-bundles.mjs — budget B4: per-route first-load JavaScript (APP-FEEL-PLAN §5.4, §5.5).
 *
 * What this measures, and what it does NOT:
 *
 *   - For a route that the build prerendered, we read the route's own HTML and take exactly the
 *     <script src> set the browser will fetch. That is the first-load JS, not an estimate.
 *   - For an on-demand family (`/ticker/[symbol]`), no HTML exists at build time — the page is
 *     rendered on first request. There we union the route's client-reference-manifest chunks with
 *     build-manifest.rootMainFiles. That is an UPPER BOUND and is labelled as one on every line;
 *     the manifest can name a chunk the rendered page turns out not to need.
 *
 * Sizes are gzip (zlib), because that is a number this machine can produce honestly. Vercel serves
 * brotli, which lands roughly 15% smaller. So these numbers are for comparing THIS instrument to
 * ITSELF across commits — they are not the same unit as the Lighthouse first-load budget (which
 * measures real brotli transfer over the wire), and the two must never be compared to each other.
 * Saying so here is the point: the previous plan draft cited a build artifact that does not exist,
 * and the fix for that class of error is to state the instrument's limits in the instrument.
 *
 * Baselines live in docs/feel-evidence/bundles.md, captured at F0 before anything changed.
 * Targets (armed in F1): every route ≤ its F0 value + 10KB slack; /ticker additionally must drop
 * the chart chunk once CandleChart is code-split (§5.3 P-6).
 *
 * Run: npm run check:bundles   (after npm run build)
 *      npm run check:bundles -- --report    appends the table to docs/feel-evidence/bundles.md
 */

import { existsSync, readFileSync, readdirSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createContext, runInContext } from "node:vm";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
const EVIDENCE = join(ROOT, "..", "docs", "feel-evidence");

/** Slack over the recorded baseline before a route is considered to have regressed. */
const SLACK_KB = 10;

/**
 * THE HARD CEILING — the budget the plan actually set, finally armed (N2).
 *
 * B4's real budget was always "first-load JS ≤ 200KB". Until now this script enforced only DRIFT
 * (baseline + 10KB slack) — which catches a surprise, but has a quiet failure mode: re-baseline a
 * route each time it legitimately grows a little, and after six phases of small honest growth it is
 * at 260KB and nothing ever failed. Every individual step passed. The budget was never checked.
 *
 * So the ceiling is now a separate, absolute gate that no re-baselining can move. Drift catches the
 * unexplained; the ceiling catches the accumulation of the explained.
 */
const CEILING_KB = 200;

/**
 * The baselines, in gzipped KB. A route may not grow more than SLACK_KB past its number.
 *
 * READ THIS BEFORE COMPARING THESE TO THE F0 TABLE — the numbers moved for a reason that is not a
 * regression. At F0 the eight force-dynamic routes had no prerendered HTML, so they could only be
 * measured as UPPER BOUNDS from their client-reference manifests (~142KB each). Since F1 they
 * prerender, so they are measured EXACTLY, from the script tags their own HTML actually asks for
 * (~180KB each). The bundles did not grow by 38KB; the instrument stopped guessing. Baselining the
 * exact figures against the old bounds would have every cured route failing its budget forever, for
 * having become measurable.
 *
 * So the baselines below are the first honest measurement of each route, taken at F1, and the two
 * routes where the method did NOT change are the control that proves the rest of the story:
 *
 *   · `/`                  exact → exact:  179.6 → 179.7 KB   (unchanged, as expected)
 *   · `/ticker/[symbol]`   bound → bound:  193.0 → 143.1 KB   (−49.9 KB — the chart, code-split)
 *
 * That second line is P-6 doing exactly what it was supposed to do: `lightweight-charts` no longer
 * loads for a reader who opens a ticker page, only for one who looks at the chart.
 *
 * @type {Record<string, number>}
 */
/*
 * REBASELINED AT N2, AND THE GUARD GOT STRONGER IN THE SAME BREATH — read this before trusting it.
 *
 * Every (desk) route grew by ~5.4KB gzipped, and it is one cause: `PipelineStrip` is a CLIENT
 * component (it has to be — it regrades the pipeline's freshness against the reader's clock, not the
 * cache's; see the component) and it is imported by two entry points, the Desk and the styleguide.
 * Two entry points is what makes the bundler hoist it — with lib/freshness and the NYSE holiday
 * calendar behind it — into a chunk that every route then carries. The copy deck also gained a whole
 * window vocabulary and four new sections, and copy.ts is imported by nearly every client component
 * in the app.
 *
 * So the growth is real, understood, and shared. It is not a leak.
 *
 * BUT RE-BASELINING IS EXACTLY HOW A BUDGET DIES, and that is worth being blunt about. Every step of
 * "it only grew a little, and here is why" is individually true, and six phases of them puts the app
 * at 260KB with a green gate the whole way. The drift check cannot catch that, because drift is
 * measured against the last thing that was accepted.
 *
 * That is why this rebaseline lands together with the HARD CEILING above (200KB, the budget the plan
 * actually set and nothing had ever enforced). Drift catches the unexplained; the ceiling catches
 * the accumulation of the explained. The worst route today is /paper at 194.7KB — five KB of head
 * room, which is a fact worth knowing rather than a comfort.
 */
const BASELINE_KB = {
  "/": 185.1,
  "/academy": 169.6,
  "/academy/[slug]": 150.4,
  "/academy/glossary": 169.0,
  "/academy/review": 170.2,
  "/login": 164.1,
  // The Front Page (N5). The room carries a client feed (filters, the window control, pagination),
  // and the story page carries the app's one table — which is why the story is the LIGHTER of the
  // two: the table was already in the shared chunks, and the feed's interactivity is not.
  //
  // CORRECTED FROM 184.2, AND THE CORRECTION IS THE INTERESTING PART. 184.2 was never a real
  // measurement of this route: it was read out of a `.next` that predated the final build, so it
  // described a page that no longer existed. The guard then fired on the next honest build and
  // reported the room "growing 11KB" — for changes that were 51 lines of comments and CSS classes.
  //
  // Rebuilding the baseline COMMIT and measuring it settled it: /news was 194.9KB there too. So the
  // route did not grow; the first number was wrong. A baseline is a measurement, and a measurement
  // taken from a stale artifact is a guess wearing a number's clothes — which is exactly the species
  // of error the bundles guard exists to catch, and it caught mine.
  "/news": 195.1,
  "/news/[cluster]": 161.6,
  "/offline": 163.0,
  "/paper": 194.7,
  "/scans": 186.2,
  "/settings": 181.7,
  // Rebaselined at F2: 163.0 → 173.3. The styleguide is the LIVING SPEC — its job is to render one
  // of everything, so it necessarily grows whenever the design system does, and section 9 added the
  // whole kit (the table, the disclosure, the form controls) to it. It is not a product room; no
  // reader ever loads it on a phone. Growth here is the page working, not a regression — but it is
  // still baselined, so a surprise 40KB would still be caught.
  // Rebaselined at N5: 180.7 → 187.9 — the four news-image rungs joined the living spec.
  "/styleguide": 187.9,
  "/ticker/[symbol]": 148.5,
  "/track-record": 185.1,
};

const reporting = process.argv.includes("--report");

if (!existsSync(NEXT)) {
  console.error("No .next directory. Run `npm run build` first.");
  process.exit(2);
}

const appPaths = JSON.parse(readFileSync(join(NEXT, "app-path-routes-manifest.json"), "utf8"));
const buildManifest = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8"));

/** Gzipped size of a built asset, in bytes. Missing files count as 0 and are named in the output. */
const missing = [];
function gzipBytes(assetPath) {
  const full = join(NEXT, assetPath.startsWith("static/") ? assetPath : join("static", assetPath));
  if (!existsSync(full)) {
    missing.push(assetPath);
    return 0;
  }
  return gzipSync(readFileSync(full)).length;
}

/** The exact script set a prerendered route's HTML tells the browser to fetch. */
function scriptsFromHtml(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  const set = new Set();
  for (const m of html.matchAll(/src="\/_next\/(static\/[^"]+\.js)"/g)) set.add(decodeURIComponent(m[1]));
  return set;
}

/** The chunk set a route's client-reference-manifest names, plus the shared root chunks. */
function scriptsFromManifest(manifestFile, manifestKey) {
  const src = readFileSync(manifestFile, "utf8");
  const ctx = {};
  ctx.globalThis = ctx;
  createContext(ctx);
  runInContext(src, ctx);

  const manifest = ctx.__RSC_MANIFEST?.[manifestKey];
  const set = new Set(buildManifest.rootMainFiles.map((f) => decodeURIComponent(f)));
  if (!manifest) return set;

  // clientModules maps a module id → { chunks: [id, file, id, file, ...] }. Only the .js entries
  // are real assets; the bare numbers between them are webpack chunk ids.
  for (const mod of Object.values(manifest.clientModules ?? {})) {
    for (const chunk of mod.chunks ?? []) {
      if (String(chunk).endsWith(".js")) set.add(decodeURIComponent(String(chunk)));
    }
  }
  return set;
}

/** Every page.tsx mapped to the URL it serves (same inventory rule as check-routes.mjs). */
function routeInventory() {
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
      } else if (entry === "page.tsx") {
        pages.push(relative(join(ROOT, "app"), full));
      }
    }
  };
  walk(join(ROOT, "app"));
  return pages
    .map((file) => {
      const key = "/" + file.replace(/\.tsx$/, "");
      return { route: appPaths[key] ?? null, key };
    })
    .filter((r) => r.route && !/^\/(_not-found|_global-error)/.test(r.route))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** Where a route's prerendered HTML would sit, if it was prerendered at all. */
function htmlPathFor(route) {
  const name = route === "/" ? "index" : route.replace(/^\//, "");
  return join(NEXT, "server", "app", `${name}.html`);
}

const rows = [];
for (const { route, key } of routeInventory()) {
  const html = htmlPathFor(route);
  let scripts;
  let exact;

  if (existsSync(html)) {
    scripts = scriptsFromHtml(html);
    exact = true;
  } else {
    const manifestFile = join(NEXT, "server", "app", `${key}_client-reference-manifest.js`);
    if (!existsSync(manifestFile)) continue;
    scripts = scriptsFromManifest(manifestFile, key);
    exact = false;
  }

  const bytes = [...scripts].reduce((sum, s) => sum + gzipBytes(s), 0);
  rows.push({ route, kb: +(bytes / 1024).toFixed(1), chunks: scripts.size, exact });
}

const width = Math.max(...rows.map((r) => r.route.length));
console.log("B4 — first-load JS per route (gzip; NOT comparable to Lighthouse's brotli transfer)\n");
for (const r of rows) {
  const kind = r.exact ? "exact " : "≤bound";
  const base = BASELINE_KB[r.route];
  const verdict = base === undefined ? "" : r.kb <= base + SLACK_KB ? `  ✓ (baseline ${base})` : `  ✗ over baseline ${base} + ${SLACK_KB}KB slack`;
  console.log(`  ${r.route.padEnd(width)}  ${String(r.kb).padStart(6)} KB  ${kind}  ${String(r.chunks).padStart(2)} chunks${verdict}`);
}

if (missing.length > 0) {
  console.log(`\n  note: ${missing.length} manifest-named chunk(s) had no file on disk and counted as 0 KB:`);
  for (const m of [...new Set(missing)]) console.log(`    ${m}`);
}

const regressions = rows.filter((r) => BASELINE_KB[r.route] !== undefined && r.kb > BASELINE_KB[r.route] + SLACK_KB);
const overCeiling = rows.filter((r) => r.kb > CEILING_KB);

if (reporting) {
  mkdirSync(EVIDENCE, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const table = [
    `\n### ${stamp} UTC — first-load JS per route (gzip)\n`,
    "| Route | gzip KB | Kind | Chunks |",
    "|---|---|---|---|",
    ...rows.map((r) => `| \`${r.route}\` | ${r.kb} | ${r.exact ? "exact" : "upper bound"} | ${r.chunks} |`),
    "",
  ].join("\n");
  appendFileSync(join(EVIDENCE, "bundles.md"), table);
  console.log(`\n  appended to docs/feel-evidence/bundles.md`);
}

if (Object.keys(BASELINE_KB).length === 0) {
  console.log("\n· B4 is in REPORT MODE — no baselines recorded yet. The table above is the evidence; F1 arms the gate.");
  process.exit(0);
}
// The absolute budget first. No re-baselining can move this one, which is the point of it.
if (overCeiling.length > 0) {
  console.error(`\n✗ B4 fails the HARD CEILING (${CEILING_KB}KB first-load JS):`);
  for (const r of overCeiling) console.error(`    ${r.route} — ${r.kb} KB`);
  console.error("  Drift can be re-baselined with a reason. This cannot. Ship less JavaScript.");
  process.exit(1);
}
if (regressions.length > 0) {
  console.error(`\n✗ B4 fails: ${regressions.length} route(s) grew more than ${SLACK_KB}KB over their baseline.`);
  process.exit(1);
}
console.log(
  `\n✓ B4 — every route is within its baseline + slack, and under the ${CEILING_KB}KB ceiling ` +
    `(worst: ${Math.max(...rows.map((r) => r.kb))} KB).`,
);
