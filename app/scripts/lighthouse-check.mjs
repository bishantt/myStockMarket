/**
 * lighthouse-check.mjs — the authenticated, mobile Lighthouse run for the phase-exit gate
 * (plan §6.4 step 4, §4.5 budgets).
 *
 *   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *   node scripts/lighthouse-check.mjs https://mystockmarket-eight.vercel.app
 *
 * The Desk lives behind the login wall, so Lighthouse cannot reach it anonymously. This script
 * mints a session cookie the same way lib/auth does — signing a JWT with AUTH_COOKIE_SECRET, the
 * exact secret the target deployment uses — and passes it to Lighthouse as an extra header. That
 * is the "CI-minted session cookie" the plan calls for.
 *
 * It runs the mobile preset (Lighthouse's throttled 4G / Moto-G-class profile), reads the metrics,
 * and checks them against the §4.5 budgets. It reports every number and exits non-zero if a
 * budget that matters for real usage fails.
 *
 * Requirements: a real Chrome at CHROME_PATH, and AUTH_COOKIE_SECRET in the environment (or in a
 * .env this process can read). Never prints the cookie or the secret.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT } from "jose";

const BUDGETS = {
  performance: 90, // score, >=
  lcpMs: 2500, // <=
  cls: 0.05, // <
  jsKb: 200, // first-load JS, <=
};

// LCP and the LCP-driven performance score are ADVISORY, not blocking (DECISIONS.md 2026-07-11,
// user-accepted). Under Lighthouse's simulated cold-4G, LCP for a web-font content page floors out
// near 2.5–3.5s and does not track real network improvements (real TTFB is ~100ms, cache HIT); it
// is a lab artifact, not a real-device problem. CLS and first-load JS stay HARD — they are
// deterministic budgets the app must always meet. They are still reported every run.
const ADVISORY = new Set(["performance", "lcp"]);

const target = (process.argv[2] ?? "https://mystockmarket-eight.vercel.app").replace(/\/$/, "");
const secret = process.env.AUTH_COOKIE_SECRET;
const username = process.env.AUTH_USER ?? "bishantt";

if (!secret) {
  console.error("AUTH_COOKIE_SECRET is not set. Export it (it must match the target deployment).");
  process.exit(2);
}
if (!process.env.CHROME_PATH) {
  console.error('CHROME_PATH is not set. Point it at a real Chrome, e.g.\n  export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"');
  process.exit(2);
}

/** Mint a session cookie identical to lib/auth.createSessionToken so the Desk is reachable. */
async function mintCookie() {
  const key = new TextEncoder().encode(secret);
  const iat = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 30 * 24 * 60 * 60)
    .sign(key);
  return `msm_session=${token}`;
}

const work = mkdtempSync(join(tmpdir(), "msm-lh-"));
try {
  const headersFile = join(work, "headers.json");
  writeFileSync(headersFile, JSON.stringify({ Cookie: await mintCookie() }));
  const reportFile = join(work, "report.json");

  console.log(`Lighthouse (mobile, authenticated) → ${target}/`);
  execFileSync(
    "npx",
    [
      "--yes",
      "lighthouse@latest",
      `${target}/`,
      "--form-factor=mobile",
      "--screenEmulation.mobile",
      `--extra-headers=${headersFile}`,
      "--output=json",
      `--output-path=${reportFile}`,
      "--chrome-flags=--headless=new --no-sandbox",
      "--only-categories=performance,accessibility",
      "--quiet",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const r = JSON.parse(readFileSync(reportFile, "utf8"));
  const a = r.audits;
  const perf = Math.round(r.categories.performance.score * 100);
  const a11y = Math.round(r.categories.accessibility.score * 100);
  const lcp = a["largest-contentful-paint"].numericValue;
  const cls = a["cumulative-layout-shift"].numericValue;
  const jsBytes = a["network-requests"].details.items
    .filter((i) => i.resourceType === "Script")
    .reduce((sum, i) => sum + (i.transferSize ?? 0), 0);
  const jsKb = Math.round(jsBytes / 1024);

  // A line's mark: ✓/✗ for a hard budget, a quiet "·" tag for an advisory one (reported, not gating).
  const line = (ok, label, advisory) =>
    advisory ? `  ${ok ? "✓" : "·"} ${label}  (advisory — synthetic-4G, see DECISIONS)` : `  ${ok ? "✓" : "✗"} ${label}`;
  console.log(`\n  Performance : ${perf}`);
  console.log(`  Accessibility: ${a11y}`);
  console.log(`  LCP         : ${(lcp / 1000).toFixed(2)}s`);
  console.log(`  CLS         : ${cls.toFixed(3)}`);
  console.log(`  first-load JS: ${jsKb} KB\n`);
  console.log(line(perf >= BUDGETS.performance, `performance ≥ ${BUDGETS.performance}`, ADVISORY.has("performance")));
  console.log(line(lcp <= BUDGETS.lcpMs, `LCP ≤ ${BUDGETS.lcpMs / 1000}s`, ADVISORY.has("lcp")));
  console.log(line(cls < BUDGETS.cls, `CLS < ${BUDGETS.cls}`));
  console.log(line(jsKb <= BUDGETS.jsKb, `first-load JS ≤ ${BUDGETS.jsKb} KB`));

  // Only the HARD budgets (CLS, first-load JS) can fail the gate; LCP and the LCP-driven perf score
  // are advisory (accepted synthetic-4G artifacts).
  const failures = [cls >= BUDGETS.cls, jsKb > BUDGETS.jsKb].filter(Boolean).length;
  process.exit(failures > 0 ? 1 : 0);
} finally {
  rmSync(work, { recursive: true, force: true });
}
