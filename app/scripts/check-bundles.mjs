#!/usr/bin/env node
/**
 * check-bundles.mjs — budget B4: per-route first-load JavaScript (APP-FEEL §5.4, §5.5).
 *
 * For a prerendered route we read its HTML and take the exact <script src> set the browser fetches —
 * the real first-load JS. For an on-demand family (`/ticker/[symbol]`) no HTML exists at build time, so
 * we union the client-reference-manifest chunks with build-manifest.rootMainFiles: an UPPER BOUND,
 * labelled as one on every line. Sizes are gzip (zlib); Vercel serves brotli (~15% smaller), so these
 * numbers compare THIS instrument to ITSELF across commits and are NOT the same unit as Lighthouse's
 * first-load budget (stating the instrument's limits in the instrument is the point — a previous draft
 * cited a build artifact that does not exist).
 *
 * Baselines: docs/feel-evidence/bundles.md (F0). Targets (F1): every route ≤ its F0 + 10KB slack;
 * /ticker additionally drops the chart chunk once CandleChart is code-split (§5.3 P-6).
 *
 * Run: npm run check:bundles (after npm run build) · add `-- --report` to append the table.
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createContext, runInContext } from "node:vm";
import { readRoutesManifest, routeInventory } from "./lib/manifest.mjs";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
const EVIDENCE = join(ROOT, "..", "docs", "feel-evidence");

/** Slack over the recorded baseline before a route is considered to have regressed. */
const SLACK_KB = 10;

/**
 * THE HARD CEILING — the budget the plan actually set, finally armed (N2). B4's real budget was always
 * "first-load JS ≤ 200KB", but this script enforced only DRIFT (baseline + 10KB slack) — which catches a
 * surprise but has a quiet failure mode: re-baseline a route each time it legitimately grows a little, and
 * six phases later it is at 260KB with nothing ever failing. The ceiling is a separate absolute gate no
 * re-baselining can move: drift catches the unexplained, the ceiling the accumulation of the explained.
 */
const CEILING_KB = 200;

/**
 * The baselines, in gzipped KB. A route may not grow more than SLACK_KB past its number.
 *
 * READ THIS BEFORE COMPARING TO THE F0 TABLE — the numbers moved for a reason that is not a regression. At
 * F0 the eight force-dynamic routes had no prerendered HTML, so they were measured as UPPER BOUNDS (~142KB
 * each); since F1 they prerender and are measured EXACTLY (~180KB each). The bundles did not grow 38KB; the
 * instrument stopped guessing. The two routes where the method did NOT change are the control: `/` exact→
 * exact 179.6→179.7 (unchanged), `/ticker/[symbol]` bound→bound 193.0→143.1 (−49.9, the chart code-split,
 * P-6 working — lightweight-charts no longer loads for a reader who opens a ticker page).
 *
 * @type {Record<string, number>}
 */
/*
 * REBASELINED AT N2, AND THE GUARD GOT STRONGER IN THE SAME BREATH. Every (desk) route grew ~5.4KB from one
 * cause: `PipelineStrip` is a CLIENT component (it regrades freshness against the reader's clock) imported by
 * two entry points (Desk + styleguide), which the bundler hoists — with lib/freshness and the holiday
 * calendar — into a chunk every route carries; and copy.ts gained a window vocabulary and four sections and
 * is imported nearly everywhere. Real, understood, shared — not a leak. BUT RE-BASELINING IS HOW A BUDGET
 * DIES: six honest "it only grew a little" steps end at 260KB with a green gate, which drift cannot catch. So
 * this rebaseline lands with the HARD CEILING above (200KB). Worst route today: /paper at 194.7KB.
 */
const BASELINE_KB = {
  "/": 185.1,
  "/academy": 169.6,
  "/academy/[slug]": 150.4,
  "/academy/glossary": 169.0,
  "/academy/review": 170.2,
  "/login": 164.1,
  // The Front Page (N5): the room carries a client feed (filters, window control, pagination); the story
  // page carries the app's one table (already in shared chunks, so the story is the LIGHTER of the two).
  // CORRECTED FROM 184.2: that was never a real measurement — read from a `.next` that predated the final
  // build — so the guard fired on the next honest build, reporting "growing 11KB" for 51 lines of comments
  // and CSS. Rebuilding the baseline COMMIT measured /news at 194.9KB there too: a measurement from a stale
  // artifact is a guess wearing a number's clothes, exactly the error this guard exists to catch.
  "/news": 195.1,
  "/news/[cluster]": 161.6,
  "/offline": 163.0,
  "/paper": 194.7,
  "/scans": 186.2,
  /*
   * THE MATCH TABLE, BASELINED AT LAST (G3). /scans/[preset] shipped in F3 — the app's one DataTable — and
   * never had a baseline: not by decision, but because `BASELINE_KB["/scans/[preset]"]` was `undefined`, the
   * verdict column printed empty, and the route was reported without being judged, every run since F3. A
   * SILENCE in a gate is indistinguishable from a pass — the disease this phase cures — and the routes
   * manifest surfaced it the moment there was one list to reconcile against. 153.6 KB, an upper bound (no
   * prerendered HTML for a bracket route). Comfortably under the 200KB ceiling.
   */
  "/scans/[preset]": 153.6,
  /*
   * REBASELINED DOWN AT PD6: 181.7 → 154.7, AND A BASELINE THAT IS TOO HIGH IS A HOLE IN THE GUARD. Found by
   * accident: PD6 saw /settings report 154.7 against a 181.7 baseline and went looking for 27KB it had not
   * saved (a rebuild of `pd-5` measures 153.5). The route had been ~28KB lighter than its baseline for some
   * time, unnoticed, because a guard that fires only on GROWTH is silent about a number too generous. It is
   * the mirror of the fear above: a stale HIGH baseline means /settings could have grown 28KB (the richness
   * kit twice) to a cheerful ✓. The ceiling (200KB) is unaffected; this restores the DRIFT half of the gate.
   */
  "/settings": 154.7,
  // Rebaselined at F2 (163.0 → 173.3): the styleguide is the LIVING SPEC — it renders one of everything, so
  // it grows whenever the design system does (section 9 added the whole kit). Not a product room; no reader
  // loads it on a phone. Still baselined, so a surprise 40KB is caught.
  // Rebaselined at N5 (180.7 → 187.9): the four news-image rungs joined the living spec.
  "/styleguide": 187.9,
  "/ticker/[symbol]": 148.5,
  /*
   * Rebaselined at PD6: 185.1 → 192.7 (+7.2 KB). The richness kit landed here: `TrackRecordTable` is a client
   * component, so a `TickerChip` in its symbol column pulled the chip (and `DeltaChip`) across the client
   * boundary, and `TermProse` pulled in the glossary popover island. Measured A/B against a `pd-5` rebuild
   * (185.5 → 192.7), /track-record and /paper then request an identical chunk set apart from their page chunk —
   * three shared chunks the neighbours already carried, no mystery left. Rebaselined rather than left to ride
   * the slack: at 2.4KB of headroom the next innocent edit would red the build and teach that the guard cries
   * wolf. Slack absorbs noise, not a chosen change; the change is named here, and the 200KB ceiling still binds.
   */
  "/track-record": 192.7,
};

/**
 * THE BASELINE KEYS AND THE ONE LIST OF ROOMS MUST AGREE (G3, R8). The baseline VALUES stay above (a
 * measurement belongs next to the instrument that took it); what moves to lib/routes-manifest.json is WHICH
 * ROOMS EXIST, a question that was answered in five disagreeing places. This reconciliation found a real hole
 * the moment it was written: the manifest knew `/scans/[preset]` and BASELINE_KB did not, so the room shipped
 * in F3 with its first-load JS never judged (undefined baseline → empty verdict → reported, never judged) —
 * the same rot-by-omission that let /news ship unswept. The two lists are now held against each other, both
 * directions, before any measuring starts.
 */
const NOT_A_PRODUCT_ROOM = {
  // Not rooms, so not in the manifest — but they are still built, still shipped to a browser, and
  // still capable of growing a surprise 40KB. They keep their baselines here, named and argued.
  "/login": "the login wall — the first thing anyone loads, and the leanest page we ship",
  "/styleguide": "the living spec — it grows with the design system on purpose, but not unwatched",
};

function reconcileWithTheManifest() {
  const manifest = readRoutesManifest(ROOT);
  const families = manifest.routes.map((r) => r.family);
  const baselined = Object.keys(BASELINE_KB);

  const unbaselined = families.filter((f) => !baselined.includes(f));
  const orphaned = baselined.filter((k) => !families.includes(k) && NOT_A_PRODUCT_ROOM[k] === undefined);

  if (unbaselined.length === 0 && orphaned.length === 0) return;

  console.error("\n✗ B4 fails: the baselines and lib/routes-manifest.json disagree about what exists.\n");
  for (const route of unbaselined) {
    console.error(
      `    ${route} is a room in the manifest with NO baseline here — so its first-load JavaScript ` +
        `is never judged, and it could double without anything failing. Read its number off the ` +
        `table above and add it to BASELINE_KB, with the reason.`,
    );
  }
  for (const route of orphaned) {
    console.error(
      `    ${route} has a baseline here but is not a room in the manifest — either it was deleted ` +
        `(remove the baseline) or it is not a product room (add it to NOT_A_PRODUCT_ROOM with a reason).`,
    );
  }
  process.exit(1);
}

const reporting = process.argv.includes("--report");

if (!existsSync(NEXT)) {
  console.error("No .next directory. Run `npm run build` first.");
  process.exit(2);
}

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

/** Where a route's prerendered HTML would sit, if it was prerendered at all. */
function htmlPathFor(route) {
  const name = route === "/" ? "index" : route.replace(/^\//, "");
  return join(NEXT, "server", "app", `${name}.html`);
}

const rows = [];
for (const { route, key } of routeInventory(ROOT).filter((r) => !/^\/(_not-found|_global-error)/.test(r.route))) {
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

// Reconcile AFTER the table is printed. A check that tells you to read a number off a table it
// never showed you is a check that makes you run it twice.
reconcileWithTheManifest();

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
