/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

/**
 * sw.ts — the service worker source (plan §5.2). @serwist/next compiles this to public/sw.js at
 * build time and injects the precache manifest into `self.__SW_MANIFEST`.
 *
 * What P0 needs from the worker is modest but real: register on the first visit (including
 * /login, pre-authentication, so update checks run even when logged out), precache the build
 * assets plus the two force-static routes, and serve /offline when a navigation fails with
 * nothing cached. That is enough for the app to be installable and to satisfy the §5.5.1
 * assertions.
 *
 * P1 adds the piece that makes offline SAFE: a cacheWillUpdate guard on every runtime strategy.
 * The Desk is a server-rendered document cached on navigation, so "the morning payload cache" is
 * that page cache. The guard is the defence against the expired-cookie failure mode — without it, a
 * 30-day-old cookie makes a navigation to "/" redirect to /login, the worker caches THAT, and the
 * user opens the app offline to find a password box where their briefing was. The guard refuses to
 * cache anything that is not a clean 200 for the page it claims to be (plan §5.2).
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build: the list of URLs to precache with their revisions.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The expired-cookie guard (plan §5.2). Returned to a strategy's cacheWillUpdate hook, it lets a
 * response be cached only when it is a clean 200, was not the result of a redirect, and is not the
 * login page. Any of those three means "this is not the page it claims to be" — most importantly,
 * an expired-cookie navigation that the proxy redirected to /login — and must never poison the
 * cache. Returning null tells Serwist not to cache the response.
 */
const cacheGuard = {
  cacheWillUpdate: async ({ response }: { response: Response }): Promise<Response | null> => {
    if (response.status !== 200 || response.redirected) return null;
    try {
      if (new URL(response.url).pathname === "/login") return null;
    } catch {
      // An opaque/relative URL has no pathname to check; the status/redirect checks still applied.
    }
    return response;
  },
};

// Attach the guard to every runtime strategy Serwist ships for Next.js, so no cache write anywhere
// can store a login redirect (plan §5.2: "a shared cacheWillUpdate plugin on every runtime strategy").
const guardedRuntimeCaching = defaultCache.map((entry) => {
  const handler = entry.handler as { plugins?: unknown[] };
  if (handler && Array.isArray(handler.plugins)) handler.plugins.push(cacheGuard);
  return entry;
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,

  // No automatic skip-waiting. A new worker installs and then WAITS; the footer offers a quiet
  // "Updated — refresh when convenient" rather than yanking the page out from under the reader
  // mid-task (plan §5.2). Calm technology applies to updates too.
  skipWaiting: false,
  clientsClaim: true,

  // Let the browser start fetching the navigation while the worker boots — shaves latency off
  // the first navigation after the worker takes control.
  navigationPreload: true,

  // Serwist's recommended strategy set for Next.js (pages, RSC flight, static assets, fonts), with
  // the expired-cookie guard attached to every strategy above.
  runtimeCaching: guardedRuntimeCaching,

  fallbacks: {
    entries: [
      {
        // When a full-document navigation fails and nothing is cached, serve /offline.
        // Scoped to documents only: a failed RSC or asset request must not render the offline
        // page in place of data.
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
