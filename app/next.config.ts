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

/**
 * The media bucket, if one exists (provisioning row P-1).
 *
 * It does not today: the pipeline records `news-images: not_configured` on every run, and every card
 * on the Front Page falls to its designed generated rung. The whole point of reading the base from
 * the environment is that turning images on is then a SECRET AND ONE VARIABLE, not a code change —
 * the same string feeds the pipeline's URL construction and this allowlist, so the two cannot
 * disagree about where images live.
 *
 * The seeded night's images are local paths under /fixtures/, which need no allowlist at all.
 */
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE;

const nextConfig: NextConfig = {
  images: mediaBase
    ? {
        remotePatterns: [new URL(`${mediaBase.replace(/\/$/, "")}/**`)],
        // The objects are immutable and their keys are content-hashed, so a long TTL is free: the
        // optimizer is the only client that ever reaches the origin, and it never needs to re-ask.
        minimumCacheTTL: 60 * 60 * 24 * 31,
      }
    : undefined,
};

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
      //
      // The login's brand mark joins them (PD2, plan 5.4). /login is the page a reader reaches when
      // a month-old cookie finally expires on a train with no signal, and it is precached precisely
      // so that it works there. Its mark is a file in public/, which the build manifest does NOT
      // cover — so without this line the offline login would render with a hole where the identity
      // is. The revision is the image's own bytes, so it re-precaches exactly when the logo changes.
      additionalPrecacheEntries: [
        { url: "/offline", revision: revisionOf("app/offline/page.tsx") },
        { url: "/login", revision: revisionOf("app/login/page.tsx", "app/login/LoginForm.tsx") },
        {
          url: "/icons/brandmark-192.webp",
          revision: revisionOf("public/icons/brandmark-192.webp"),
        },
      ],
    })(nextConfig);
