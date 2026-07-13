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
 *
 *   - A PLAIN ROUTE passes when it appears in prerender-manifest `routes` with an
 *     initialRevalidateSeconds inside (0, 600] — or `false`, meaning fully static.
 *
 *   - A [param] FAMILY (`/ticker/[symbol]`, `/academy/[slug]`) passes when it appears in
 *     `dynamicRoutes` at all. That membership is the signal, and it is a strong one: a
 *     force-dynamic route never appears there. Before F1 this app had eight dynamic routes and
 *     `dynamicRoutes` was an empty object; the families only entered it once they were cacheable.
 *
 * WHY THE FAMILY BRANCH IS NOT WRITTEN THE WAY THE PLAN SPECIFIED IT. The plan said to read
 * `dynamicRoutes[r].fallbackRevalidate`. That field does not exist in this build's manifest — the
 * entries carry `fallback`, `fallbackRootParams` and `fallbackRouteParams`, and no revalidate at
 * all. (This is the second time a plan draft has named a build artifact that isn't there; the
 * lesson is the same both times — read the manifest, do not recall it.) So the family's staleness
 * ceiling is proved from the two places it genuinely lives:
 *
 *   · its PRERENDERED CHILDREN, if it has any — the 25 lessons each carry their own
 *     initialRevalidateSeconds and name `/academy/[slug]` as their srcRoute; and
 *   · its `revalidate` export, read from the page source, for a family with no children at all
 *     (`/ticker/[symbol]` prerenders nothing by design: 6,000 symbols, a handful ever visited).
 *
 * `fallback` is the last piece: `null` means an unknown param renders on demand and is then cached,
 * which is what an on-demand family needs. `false` means only prerendered params exist and anything
 * else 404s — correct for a closed set like `/scans/[preset]`, but broken for a family that
 * prerenders nothing, since it could then serve nothing at all. Both cases are checked.
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
const ALLOWLIST = [
  {
    route: "/settings",
    reason:
      "A page may be CACHED, or it may be written to and read back in the SAME CLICK — not both. " +
      "Every other room is a reader; settings is a writer, and its whole content is the thing you " +
      "just changed by clicking on it. Each click runs a server action that re-renders this page as " +
      "its reply, and a cached reply can be the page as it was BEFORE your click (we watched a row " +
      "vanish on the next click, intermittently). It renders on request, and it ships a loading.tsx.",
  },
];

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

/** The `export const revalidate = N` a page declares, or null if it declares none. */
function declaredRevalidate(file) {
  try {
    const match = readFileSync(join(ROOT, file), "utf8").match(/export\s+const\s+revalidate\s*=\s*(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** How the build says this route will be served, and whether that counts as cached. */
function verdictFor(route, file) {
  const stat = prerender.routes[route];
  if (stat) {
    const seconds = stat.initialRevalidateSeconds;
    if (seconds === false) return { ok: true, how: "static (no revalidate)" };
    if (seconds > 0 && seconds <= MAX_REVALIDATE_SECONDS) return { ok: true, how: `ISR ${seconds}s (prerendered)` };
    return { ok: false, how: `ISR ${seconds}s — over the ${MAX_REVALIDATE_SECONDS}s staleness ceiling (M5)` };
  }

  const family = prerender.dynamicRoutes[route];
  if (family) {
    // The children this family prerendered at build time, each carrying its own revalidate.
    const children = Object.values(prerender.routes).filter((child) => child.srcRoute === route);

    if (children.length > 0) {
      const worst = Math.max(...children.map((c) => (c.initialRevalidateSeconds === false ? 0 : c.initialRevalidateSeconds)));
      if (worst > MAX_REVALIDATE_SECONDS) {
        return { ok: false, how: `ISR ${worst}s — over the ${MAX_REVALIDATE_SECONDS}s ceiling (M5)` };
      }
      const onDemand = family.fallback === null ? " + on demand" : " (closed set)";
      return { ok: true, how: `ISR ${worst}s · ${children.length} prerendered${onDemand}` };
    }

    // No children: an on-demand-only family. It must be able to render an unknown param, or it can
    // serve nothing at all.
    if (family.fallback === false) {
      return { ok: false, how: "prerenders no params AND refuses unknown ones — this route can serve nothing" };
    }
    const seconds = declaredRevalidate(file);
    if (seconds === null) return { ok: false, how: "on-demand family with no `export const revalidate`" };
    if (seconds > MAX_REVALIDATE_SECONDS) {
      return { ok: false, how: `ISR ${seconds}s — over the ${MAX_REVALIDATE_SECONDS}s ceiling (M5)` };
    }
    return { ok: true, how: `ISR ${seconds}s (on demand, cached per param)` };
  }

  return { ok: false, how: "dynamic — re-rendered on every request" };
}

const inventory = routeInventory();
const product = inventory.filter((r) => !NOT_PRODUCT.test(r.route));
const controls = inventory.filter((r) => NOT_PRODUCT.test(r.route));

const failures = [];
const rows = [];

for (const { route, file } of product) {
  const { ok, how } = verdictFor(route, file);
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
for (const { route, file } of controls) {
  const { how } = verdictFor(route, file);
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
