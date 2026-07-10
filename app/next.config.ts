import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * The Next config, wrapped with Serwist so the service worker (app/sw.ts) is compiled to
 * public/sw.js and given its precache manifest at build time (plan §5.2).
 */

/**
 * A content-based revision for a precached route: the SHA of its source files, truncated.
 *
 * Precache entries need a revision so the browser knows when to re-fetch them. Hashing the
 * source means the revision changes exactly when the page changes — no more, no less — so a
 * deploy that leaves /offline untouched does not needlessly re-precache it, and one that edits
 * it always does.
 */
function revisionOf(...files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(file));
  return hash.digest("hex").slice(0, 12);
}

const nextConfig: NextConfig = {};

/**
 * Serwist injects its precache manifest through a webpack plugin. Next 16 defaults to Turbopack,
 * which ignores that hook and, worse, errors out the moment it sees a `webpack` key in the
 * config. So Serwist is applied ONLY when Turbopack is off — which is exactly the production
 * build, run as `next build --webpack` (see package.json).
 *
 * The split is deliberate and costs nothing real:
 *   - `next dev` stays on Turbopack for fast refresh. The service worker is disabled in dev
 *     anyway, so there is nothing to build there.
 *   - `next build --webpack` turns Turbopack off, so `process.env.TURBOPACK` is unset, Serwist
 *     engages, and public/sw.js is produced. The Playwright suite tests this build, so what is
 *     tested is what ships.
 *
 * When Serwist's Turbopack support lands (github.com/serwist/serwist#54), this whole branch
 * collapses back to a plain wrap. Logged in DECISIONS.md.
 */
export default process.env.TURBOPACK
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      cacheOnNavigation: true,
      reloadOnOnline: true,
      // The two force-static routes, precached by URL so they are available offline. Everything
      // else in the precache comes from the build manifest Serwist injects (plan §5.2).
      additionalPrecacheEntries: [
        { url: "/offline", revision: revisionOf("app/offline/page.tsx") },
        { url: "/login", revision: revisionOf("app/login/page.tsx", "app/login/LoginForm.tsx") },
      ],
    })(nextConfig);
