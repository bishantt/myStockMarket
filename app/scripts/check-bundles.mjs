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
 * The F0 baselines, in gzipped KB, recorded before the feel plan changed anything.
 * Empty until F0 records them; F1 arms the gate by filling this in.
 * @type {Record<string, number>}
 */
const BASELINE_KB = {};

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
if (regressions.length > 0) {
  console.error(`\n✗ B4 fails: ${regressions.length} route(s) grew more than ${SLACK_KB}KB over their baseline.`);
  process.exit(1);
}
console.log("\n✓ B4 — every route is within its baseline + slack.");
