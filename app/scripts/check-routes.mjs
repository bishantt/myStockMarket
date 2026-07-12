#!/usr/bin/env node
/**
 * check-routes.mjs — budget B1: every product route is served from a cache, not re-rendered
 * on every tap (APP-FEEL-PLAN §5.4, Appendix D).
 *
 * The disease this guards against is the one the feel plan was written to cure. Eight of the
 * app's ten rooms were `force-dynamic`: every tap re-rendered on the server and paid a
 * cross-region database bill, and the reader watched a frozen screen for 400–1240ms. The cure —
 * ISR with on-demand revalidation — is invisible once it works, which is exactly why it needs a
 * machine to notice when someone takes it away.
 *
 * A route passes when the build says it will be served from the cache:
 *   - it appears in prerender-manifest `routes` with initialRevalidateSeconds in (0, 600], or
 *   - it appears in prerender-manifest `dynamicRoutes` with fallbackRevalidate in (0, 600].
 *
 * The second branch is where the on-demand families live (`/ticker/[symbol]`): they are not
 * prerendered at build time, so they never appear under `routes` — they are rendered once on
 * first request and cached from then on. A check that only read `routes` would fail them
 * forever and teach its executor to ignore it.
 *
 * An exception must be declared in ALLOWLIST with a written reason, and an allowlisted dynamic
 * route MUST still ship a loading.tsx — if the reader has to wait for the server, they are at
 * least owed something to look at (§5.3 P-3). The allowlist starts empty and should stay that way.
 *
 * The script prints the full table whether it passes or fails. A check that reports what it
 * measured beats a bare verdict (the font-budget lesson, LESSONS 2026-07-10).
 *
 * Run: npm run check:routes             (after npm run build) — gates
 *      npm run check:routes -- --report  prints and records the table, exits 0
 *
 * F0 captured the BEFORE table in report mode (8 of 10 routes dynamic — the diagnosis). F1 cured it
 * and the standing gate has run the gating form ever since.
 */

import { existsSync, readFileSync, readdirSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
const EVIDENCE = join(ROOT, "..", "docs", "feel-evidence");
const REPORT = process.argv.includes("--report");

/** The ceiling on staleness. Ruling M5: a cached page is honest because it is stamped, and the
 *  stamp is only honest if the page behind it is at most this old. */
const MAX_REVALIDATE_SECONDS = 600;

/**
 * Routes allowed to render on every request, each with the reason someone had to defend.
 * Every entry here also needs a sibling loading.tsx (enforced below).
 * @type {{ route: string, reason: string }[]}
 */
const ALLOWLIST = [];

/** Routes that are not product rooms: infrastructure, the login wall, the living spec. */
const NOT_PRODUCT = /^\/(login|offline|styleguide|_not-found|_global-error|api\/|manifest\.webmanifest)/;

if (!existsSync(NEXT)) {
  console.error("No .next directory. Run `npm run build` first — this check reads the build's own manifests.");
  process.exit(2);
}

const prerender = JSON.parse(readFileSync(join(NEXT, "prerender-manifest.json"), "utf8"));
const appPaths = JSON.parse(readFileSync(join(NEXT, "app-path-routes-manifest.json"), "utf8"));

/**
 * Every page.tsx in the tree, as the URL path it actually serves.
 *
 * We walk the filesystem rather than trusting the manifest alone, because the failure we fear is
 * a route that exists and is dynamic — and a purely manifest-driven inventory would happily
 * report "all routes cached" about a set that quietly excluded the broken one.
 */
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

  // "(desk)/scans/page.tsx" → the app-router key "/(desk)/scans/page" → the served path "/scans".
  // The route-group parentheses do not appear in the URL, and the manifest is the authority on
  // that mapping, so we ask it rather than re-deriving the rule here.
  return pages
    .map((file) => {
      const key = "/" + file.replace(/\.tsx$/, "");
      return { file: `app/${file}`, route: appPaths[key] ?? null, key };
    })
    .filter((r) => r.route !== null)
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** How the build says this route will be served, and whether that counts as cached. */
function verdictFor(route) {
  const stat = prerender.routes[route];
  if (stat && stat.initialRevalidateSeconds > 0 && stat.initialRevalidateSeconds <= MAX_REVALIDATE_SECONDS) {
    return { ok: true, how: `ISR ${stat.initialRevalidateSeconds}s (prerendered)` };
  }
  if (stat && stat.initialRevalidateSeconds === false) {
    return { ok: true, how: "static (no revalidate)" };
  }
  if (stat && stat.initialRevalidateSeconds > MAX_REVALIDATE_SECONDS) {
    return { ok: false, how: `ISR ${stat.initialRevalidateSeconds}s — over the ${MAX_REVALIDATE_SECONDS}s staleness ceiling (M5)` };
  }

  const dyn = prerender.dynamicRoutes[route];
  if (dyn && dyn.fallbackRevalidate > 0 && dyn.fallbackRevalidate <= MAX_REVALIDATE_SECONDS) {
    return { ok: true, how: `ISR ${dyn.fallbackRevalidate}s (on-demand family)` };
  }
  if (dyn && dyn.fallbackRevalidate > MAX_REVALIDATE_SECONDS) {
    return { ok: false, how: `ISR ${dyn.fallbackRevalidate}s — over the ${MAX_REVALIDATE_SECONDS}s ceiling (M5)` };
  }

  return { ok: false, how: "dynamic — re-rendered on every request" };
}

const inventory = routeInventory();
const product = inventory.filter((r) => !NOT_PRODUCT.test(r.route));
const controls = inventory.filter((r) => NOT_PRODUCT.test(r.route));

const failures = [];
const rows = [];

for (const { route, file } of product) {
  const { ok, how } = verdictFor(route);
  const allowed = ALLOWLIST.find((a) => a.route === route);

  if (ok) {
    rows.push({ route, how, mark: "✓" });
    continue;
  }

  if (allowed) {
    // An allowlisted dynamic route is a promise that the reader gets a skeleton while they wait.
    // The promise is checked, not trusted.
    const loading = file.replace(/page\.tsx$/, "loading.tsx");
    if (existsSync(join(ROOT, loading))) {
      rows.push({ route, how: `${how} — ALLOWED: ${allowed.reason}`, mark: "·" });
    } else {
      rows.push({ route, how: `${how} — ALLOWED but has no ${loading}`, mark: "✗" });
      failures.push(`${route} is allowlisted as dynamic but ships no loading.tsx — the reader waits on a frozen page (§5.3 P-3).`);
    }
    continue;
  }

  rows.push({ route, how, mark: "✗" });
  failures.push(`${route} — ${how}. Convert it to ISR (export const revalidate = 600) or allowlist it with a reason AND a loading.tsx.`);
}

const width = Math.max(...inventory.map((r) => r.route.length), 12);
console.log("B1 — route serving modes (product rooms)\n");
for (const r of rows) console.log(`  ${r.mark} ${r.route.padEnd(width)}  ${r.how}`);

console.log("\n  controls (not product rooms — reported, never gated)\n");
for (const { route } of controls) {
  const { how } = verdictFor(route);
  console.log(`  · ${route.padEnd(width)}  ${how}`);
}

const cached = rows.filter((r) => r.mark === "✓").length;
console.log(`\n  ${cached} of ${product.length} product routes served from cache · allowlist: ${ALLOWLIST.length} entr${ALLOWLIST.length === 1 ? "y" : "ies"}`);

if (REPORT) {
  mkdirSync(EVIDENCE, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const table = [
    `\n### ${stamp} UTC — route serving modes (${cached} of ${product.length} product routes cached)\n`,
    "| Route | How it is served |",
    "|---|---|",
    ...rows.map((r) => `| \`${r.route}\` | ${r.mark === "✓" ? "" : "**"}${r.how}${r.mark === "✓" ? "" : "**"} |`),
    "",
  ].join("\n");
  appendFileSync(join(EVIDENCE, "routes.md"), table);
  console.log(`  appended to docs/feel-evidence/routes.md`);
  console.log("\n· B1 is in REPORT MODE (--report). The table above is the evidence; the gating form drops the flag.");
  process.exit(0);
}

if (failures.length > 0) {
  console.error("\n✗ B1 fails:\n");
  for (const f of failures) console.error(`    ${f}`);
  console.error("\nA dynamic product route is a frozen screen on every tap. That is the disease this plan cured.");
  process.exit(1);
}
console.log("\n✓ B1 — every product route is served from a cache.");
