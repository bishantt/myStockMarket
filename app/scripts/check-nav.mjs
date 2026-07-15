#!/usr/bin/env node
/**
 * check-nav.mjs — budget B2: authenticated TTFB per product route, against the real deployment
 * (APP-FEEL-PLAN §1.4, §5.4, §5.5).
 *
 * This is the probe that produced the plan's diagnosis, checked in so every claim it made stays
 * falsifiable. It signs a session cookie exactly the way lib/auth does (the lighthouse-check.mjs
 * method — same secret, same shape), then times the first byte of every product route.
 *
 * The gate protocol, and the reasoning behind each part:
 *
 *   - WAIT FOR THE DEPLOYMENT FIRST. Probing straight after `git push` measures the PREVIOUS
 *     deployment and reports a green gate for code that is not live yet. With --wait we fingerprint
 *     the deployed JavaScript (the set of chunk hashes the login page asks for, which changes on
 *     any code-bearing deploy) and poll until it differs from the fingerprint of the last run.
 *   - GATE ON THE WARM MEDIAN (samples 2–5). Sample 1 carries cold-function start plus a fresh
 *     cache MISS by design; it is reported against a generous ceiling and never gated. Gating the
 *     cold sample would be gating the one number the architecture deliberately accepts.
 *   - ONE AUTOMATIC RE-PROBE on a miss before failing. A shared edge and a laptop's wifi produce
 *     the occasional outlier, and a gate that fails randomly trains its executor to ignore it
 *     (the same reasoning as B3's catastrophic ceiling — Appendix E-21).
 *
 * Honesty about what this measures: it is a SERVER latency tripwire run from a developer laptop.
 * It is not a proxy for what a phone on a cell radio feels — budget B3 (e2e/nav-timing.spec.ts)
 * owns the felt side. Both are reported; neither pretends to be the other.
 *
 * Run:  AUTH_COOKIE_SECRET=... npm run check:nav
 *       npm run check:nav -- --report        append the table to docs/feel-evidence/nav.md
 *       npm run check:nav -- --wait          wait for a new deployment before probing
 *       npm run check:nav -- --gate          fail the process when the warm median misses B2
 *
 * Never prints the cookie or the secret.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readRoutesManifest } from "./lib/manifest.mjs";
import { mintSessionCookie } from "./lib/session-cookie.mjs";

const TARGET = (process.argv.find((a) => a.startsWith("https://")) ?? "https://mystockmarket-eight.vercel.app").replace(/\/$/, "");
const REPORT = process.argv.includes("--report");
const WAIT = process.argv.includes("--wait");
const GATE = process.argv.includes("--gate");

/** B2: the warm median every product route must meet. The cached path already measures 51–67ms;
 *  150ms is that number plus honest headroom (§5.4). */
const WARM_BUDGET_MS = 150;

/** Sample 1 is cold-start + fresh MISS. Reported against this, never gated. */
const COLD_CEILING_MS = 1500;

const SAMPLES = 5;

/**
 * The rooms to probe — read from lib/routes-manifest.json, the ONE list of rooms (G3).
 *
 * This list used to be hand-kept here, which is the same rot the sweeps had: a room ships, nobody
 * adds it to the probe set, and its latency is never measured. Nothing fails, because nothing was
 * asked to look. The manifest is now the single source and lib/routes-manifest.test.ts reds the unit
 * suite if a `page.tsx` exists with no entry behind it.
 *
 * Each room's `navBudget` says what this script does with it:
 *   gated   — timed, and B2 fails if the warm median misses the budget
 *   control — timed and reported beside the rooms, never gated: it is the static fast path they are
 *             all measured against, so gating the yardstick would be circular
 *   pending — probed BEFORE it is built (see PENDING below)
 *   none    — not probed, and the manifest's note says why (today: /offline, which is by definition
 *             the page you get when the network did not work)
 */
const manifest = readRoutesManifest();
const rooms = manifest.routes;

const PRODUCT_ROUTES = rooms
  .filter((r) => r.navBudget === "gated" || r.navBudget === "pending")
  .map((r) => r.path);

/**
 * The controls: the static fast path the product rooms are measured against.
 *
 * /login is named here by hand and is NOT in the manifest, deliberately — it is the wall, not a room
 * behind it (argued in lib/routes-manifest.test.ts's exemption list). It is the purest static page
 * the app serves, which is exactly what makes it the right control.
 */
const CONTROL_ROUTES = ["/login", ...rooms.filter((r) => r.navBudget === "control").map((r) => r.path)];

/**
 * Routes a later phase will build, probed BEFORE they exist.
 *
 * They are here on purpose. A route family left out of the probe set until the day it ships is a
 * gap that quietly becomes permanent — nobody adds it later, because nothing is failing. So the
 * route is probed from the start, and while it 404s it is reported as PENDING against the phase
 * that owes it, rather than being either silently dropped or scored as a 45ms success (a 404 is the
 * fastest response a server can give; see the F0 note in LESSONS).
 *
 * The moment one of these starts answering 200 it is gated like everything else — no edit needed,
 * and no way to ship it slow by forgetting to take it off a list.
 *
 * EMPTY TODAY, and that is a correction rather than a deletion (G3). The only entry was
 * `/scans/unusual-volume`, marked pending against "F3 builds the per-preset match table" — and F3
 * built it, phases ago. The marker never came off, so the route carried a standing licence to answer
 * 404 without failing the gate. It answers 200 now and is gated like every other room; the mechanism
 * stays, driven by the manifest, for the next route that is probed before it exists.
 */
const PENDING = Object.fromEntries(
  rooms.filter((r) => r.navBudget === "pending").map((r) => [r.path, r.note]),
);

const EVIDENCE = join(process.cwd(), "..", "docs", "feel-evidence");
const FINGERPRINT_FILE = join(EVIDENCE, ".deployed-build");

const secret = process.env.AUTH_COOKIE_SECRET;
if (!secret) {
  console.error("AUTH_COOKIE_SECRET is not set. Export it — it must match the target deployment's secret.");
  process.exit(2);
}

const cookie = await mintSessionCookie(secret);

/**
 * A fingerprint of the deployed build: the hashed set of JavaScript chunks the login page asks
 * for. Any deploy that changes app code changes at least one chunk hash. (A docs-only deploy
 * would not move it — but a docs-only deploy has nothing for this instrument to measure.)
 */
async function deployedFingerprint() {
  const html = await (await fetch(`${TARGET}/login`, { cache: "no-store" })).text();
  const srcs = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]).sort();
  return createHash("sha1").update(srcs.join("\n")).digest("hex").slice(0, 12);
}

/** Time the first byte of one authenticated request. Returns ms and the cache verdict. */
async function probe(path) {
  const started = performance.now();
  const res = await fetch(`${TARGET}${path}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
    cache: "no-store",
  });
  // Reading the first chunk is what "time to first byte" means; we must not wait for the whole body.
  const reader = res.body?.getReader();
  if (reader) {
    await reader.read();
    await reader.cancel();
  }
  const ms = Math.round(performance.now() - started);
  return { ms, status: res.status, cache: res.headers.get("x-vercel-cache") ?? "—", region: (res.headers.get("x-vercel-id") ?? "—").split("::")[0] };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** Probe one route SAMPLES times, in series (parallel samples would measure contention). */
async function probeRoute(path) {
  const samples = [];
  const caches = [];
  let status = 0;
  let region = "—";
  for (let i = 0; i < SAMPLES; i++) {
    const r = await probe(path);
    samples.push(r.ms);
    caches.push(r.cache);
    status = r.status;
    region = r.region;
  }
  return {
    path,
    status,
    region,
    samples,
    caches,
    cold: samples[0],
    warm: median(samples.slice(1)), // samples 2–5 — the steady state a reader actually lives in
  };
}

if (WAIT) {
  const previous = existsSync(FINGERPRINT_FILE) ? readFileSync(FINGERPRINT_FILE, "utf8").trim() : null;
  process.stdout.write(previous ? `Waiting for a new deployment (last seen ${previous}) ` : "No previous fingerprint on record — waiting for the deployment to settle ");
  const deadline = Date.now() + 10 * 60 * 1000;
  let current = await deployedFingerprint();
  let stableFor = 0;
  while (Date.now() < deadline) {
    if (previous && current !== previous) break;
    if (!previous && stableFor >= 2) break;
    await new Promise((r) => setTimeout(r, 10_000));
    const next = await deployedFingerprint();
    stableFor = next === current ? stableFor + 1 : 0;
    current = next;
    process.stdout.write(".");
  }
  console.log(`\nDeployment fingerprint: ${current}${previous && current === previous ? "  (UNCHANGED — probing the previous deploy; treat this table with suspicion)" : "  (new)"}\n`);
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(FINGERPRINT_FILE, current + "\n");
}

console.log(`B2 — authenticated TTFB, ${SAMPLES} samples per route → ${TARGET}\n`);

async function runRound(routes) {
  const out = [];
  for (const path of routes) out.push(await probeRoute(path));
  return out;
}

let results = await runRound(PRODUCT_ROUTES);

/**
 * A route misses if it is slow — OR if it did not actually serve the page.
 *
 * The second clause is not paranoia. On the F0 baseline run `/scans/unusual-volume` did not exist
 * yet and answered 404 in 46ms — comfortably inside the speed budget. A missing page is the fastest
 * page there is, and a budget that rewards that is a budget that would call a deleted route a
 * success. Speed only counts when something was served.
 */
const isPending = (r) => r.status === 404 && PENDING[r.path] !== undefined;
const missed = (r) => !isPending(r) && (r.status !== 200 || r.warm > WARM_BUDGET_MS);

// One automatic re-probe round before declaring a failure — an outlier from a shared edge is not
// a regression, and a gate that cries wolf gets ignored.
let misses = results.filter(missed);
let reprobed = [];
if (GATE && misses.length > 0) {
  console.log(`  ${misses.length} route(s) missed the warm budget. Re-probing them once before failing.\n`);
  reprobed = await runRound(misses.map((r) => r.path));
  results = results.map((r) => reprobed.find((n) => n.path === r.path) ?? r);
  misses = results.filter(missed);
}

const controls = await runRound(CONTROL_ROUTES);
const width = Math.max(...[...PRODUCT_ROUTES, ...CONTROL_ROUTES].map((r) => r.length));

const line = (r, gated) => {
  const pending = isPending(r);
  const mark = pending ? "·" : !gated ? "·" : missed(r) ? "✗" : "✓";
  const notes = [];
  if (pending) notes.push(`  (PENDING — ${PENDING[r.path]}; not built yet, so the timing means nothing)`);
  else if (r.status !== 200) notes.push(`  (HTTP ${r.status} — nothing was served, so the speed number means nothing)`);
  if (r.cold > COLD_CEILING_MS) notes.push("  (cold sample over the 1500ms ceiling)");
  return `  ${mark} ${r.path.padEnd(width)}  warm ${String(r.warm).padStart(5)}ms   cold ${String(r.cold).padStart(5)}ms   [${r.samples.join(", ")}]  ${r.caches.join(",")}  ${r.status} ${r.region}${notes.join("")}`;
};

for (const r of results) console.log(line(r, GATE));
console.log("\n  controls (already static — the fast path this plan moves everything onto)\n");
for (const r of controls) console.log(line(r, false));

const worst = Math.max(...results.map((r) => r.warm));
console.log(`\n  warm median across the product routes: worst ${worst}ms · budget ${WARM_BUDGET_MS}ms`);

if (REPORT) {
  mkdirSync(EVIDENCE, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const table = [
    `\n### ${stamp} UTC — authenticated TTFB (${SAMPLES} samples, ${TARGET})\n`,
    "| Route | HTTP | Warm median (2–5) | Cold (sample 1) | All samples | x-vercel-cache | Region |",
    "|---|---|---|---|---|---|---|",
    ...results.map((r) => {
      const status = r.status === 200 ? "200" : isPending(r) ? `404 _(pending: ${PENDING[r.path]})_` : `${r.status} ⚠︎`;
      return `| \`${r.path}\` | ${status} | **${r.warm}ms** | ${r.cold}ms | ${r.samples.join(", ")} | ${r.caches.join(", ")} | ${r.region} |`;
    }),
    ...controls.map((r) => `| \`${r.path}\` _(control)_ | ${r.status} | ${r.warm}ms | ${r.cold}ms | ${r.samples.join(", ")} | ${r.caches.join(", ")} | ${r.region} |`),
    "",
    "_A non-200 row is not a fast route — it is a route that served nothing. The gate treats it as a miss,_",
    "_unless it is a route a later phase has not built yet, which is reported as pending and never scored._",
    "",
    reprobed.length > 0 ? `_${reprobed.length} route(s) were re-probed once after missing the budget on the first round._\n` : "",
  ].join("\n");
  appendFileSync(join(EVIDENCE, "nav.md"), table);
  console.log(`  appended to docs/feel-evidence/nav.md`);
}

if (!GATE) {
  console.log("\n· B2 is in REPORT MODE (no --gate). The table above is the evidence.");
  process.exit(0);
}
if (misses.length > 0) {
  console.error(`\n✗ B2 fails: ${misses.length} route(s) missed — ${misses.map((m) => (m.status !== 200 ? `${m.path} (HTTP ${m.status})` : `${m.path} (${m.warm}ms)`)).join(", ")}`);
  process.exit(1);
}
console.log(`\n✓ B2 — every product route answers within ${WARM_BUDGET_MS}ms warm.`);
