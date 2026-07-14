#!/usr/bin/env node
/**
 * check-live.mjs — ask the DEPLOYED app whether it is telling the truth (plan 3.6, ruling E10).
 *
 * "The instrument outranks the vibe." Every other guard in this repo asks whether the code is
 * correct. This one asks whether PRODUCTION IS RIGHT — and it is the only one that can, because
 * every other guard runs against a database it built itself thirty seconds earlier.
 *
 * That gap is not theoretical. It is how this app spent two days telling its reader that its data
 * ran "through Saturday's close" — a close that has never existed — with a green CI on every commit.
 * It is also how production ran for days without N0's migration: CI migrates a fresh throwaway
 * container on every run, so a green pipeline proves a migration WORKS, never that it was APPLIED to
 * the database the app actually reads. `check:migrations` closed that hole. This closes the other
 * one: `check:migrations` asks whether production has the right SCHEMA; this asks whether it is
 * serving the right TRUTH.
 *
 * Both are local-only by nature, and that is not a shortcoming — CI structurally cannot answer
 * either question. From PD1 this runs at the post-deploy step of every phase gate.
 *
 *   Run:  AUTH_COOKIE_SECRET=... npm run check:live
 *         npm run check:live -- --report      append the table to docs/pd-evidence/live.md
 *
 * The assertions live in live-truth.mjs, which is pure and is tested against a recording of the
 * healthy Desk AND a reconstruction of the Saturday one. A checker that cannot fail its fixtures is
 * decoration. Never prints the cookie or the secret.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";
import { checkLive } from "./live-truth.mjs";

const TARGET = (process.argv.find((a) => a.startsWith("https://"))
  ?? "https://mystockmarket-eight.vercel.app").replace(/\/$/, "");
const REPORT = process.argv.includes("--report");

const secret = process.env.AUTH_COOKIE_SECRET;
if (!secret) {
  console.error("AUTH_COOKIE_SECRET is not set. Export it — it must match the target deployment's secret.");
  console.error("(It is in the repo-root .env: `set -a; source .env; set +a`.)");
  process.exit(2);
}

/** Mint a session cookie identical to lib/auth.createSessionToken, so the login wall lets us in. */
async function mintCookie() {
  const key = new TextEncoder().encode(secret);
  const iat = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ username: process.env.AUTH_USER ?? "bishantt" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60 * 60)
    .sign(key);
  return `msm_session=${token}`;
}

async function fetchPage(cookie, path) {
  const res = await fetch(`${TARGET}${path}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
    cache: "no-store",
  });
  if (res.status !== 200) {
    // A redirect here means the cookie did not open the wall — which would otherwise show up as
    // "the Desk names no date at all", a confusing way to say "you are not logged in".
    throw new Error(
      `${path} answered ${res.status}${res.status === 307 ? " (redirected to /login — is AUTH_COOKIE_SECRET the deployment's?)" : ""}`,
    );
  }
  return res.text();
}

const cookie = await mintCookie();
const [deskHtml, newsHtml] = await Promise.all([fetchPage(cookie, "/"), fetchPage(cookie, "/news")]);

const now = new Date();
const results = checkLive({ deskHtml, newsHtml, now });

// ── the table ─────────────────────────────────────────────────────────────────────────────────

const MARK = { PASS: "✓", FAIL: "✗", PENDING: "…" };
const width = Math.max(...results.map((r) => r.surface.length));

console.log(`\ncheck:live — ${TARGET}`);
console.log(`asked at ${now.toISOString()} (${now.toLocaleString("en-US", { timeZone: "America/New_York" })} ET)\n`);

for (const r of results) {
  console.log(`${MARK[r.verdict]} ${r.surface.padEnd(width)}  expected: ${r.expected}`);
  console.log(`  ${" ".repeat(width)}  found:    ${r.found}`);
  if (r.owed) console.log(`  ${" ".repeat(width)}  owed by:  ${r.owed}`);
  console.log("");
}

const failures = results.filter((r) => r.verdict === "FAIL");
const pendings = results.filter((r) => r.verdict === "PENDING");

if (REPORT) {
  const dir = join(process.cwd(), "..", "docs", "pd-evidence");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const rows = results
    .map((r) => `| ${r.surface} | ${r.expected} | ${r.found} | ${r.verdict} |`)
    .join("\n");
  appendFileSync(
    join(dir, "live.md"),
    `\n### ${now.toISOString()} — ${TARGET}\n\n`
      + `| surface | expected | found | verdict |\n|---|---|---|---|\n${rows}\n`,
  );
}

if (failures.length > 0) {
  console.error(
    `${failures.length} of ${results.length} checks FAILED. Production is not telling the truth about `
      + `${failures.map((f) => f.surface.split(" · ")[0]).join(", ")}.`,
  );
  process.exit(1);
}

console.log(
  `All ${results.length - pendings.length} live checks pass`
    + (pendings.length > 0 ? ` (${pendings.length} pending a later phase).` : "."),
);
