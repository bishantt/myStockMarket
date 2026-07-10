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
 * The richer caching the plan describes — the morning-payload StaleWhileRevalidate cache, the
 * cacheWillUpdate guard that stops an expired-cookie /login response from poisoning the page
 * cache, the OfflineRibbon signalling — lands in P1, when the morning payload exists to cache
 * and the pwa-audit skill is minted. Building it now would be caching a payload that does not
 * yet exist.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build: the list of URLs to precache with their revisions.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

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

  // Serwist's recommended strategy set for Next.js: sensible handling of pages, RSC flight
  // requests, static assets, and fonts out of the box. P1 replaces this with the plan's
  // bespoke strategies once there is a morning payload to cache.
  runtimeCaching: defaultCache,

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
