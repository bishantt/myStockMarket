import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./routes-manifest.json";

/**
 * THE COMPLETENESS GUARD — the crown of G3, and the reason this file exists at all.
 *
 * The failure it is here to make impossible has a name in this build: ROT BY OMISSION. A room ships,
 * and nobody adds it to the sweeps. Nothing fails, because nothing was ever asked to look. The room
 * is simply never measured, and the gate stays green the whole time — which is the worst kind of
 * green, because it is indistinguishable from the real thing.
 *
 * It is not hypothetical. `/news` shipped in N5 — the densest room in the app, two horizontally
 * scrolling chip rows and a card grid of links — and it went through TWO tagged phases without a
 * single sweep looking at it. The touch-target rule never measured it. The axe scan never opened it.
 * They found nothing wrong with it, because they never went.
 *
 * The route lists used to be hand-kept in five places (a11y ROUTES, hardening ROUTES/SEEDED_ROUTES,
 * vrt SEEDED_ROOMS, check-nav PRODUCT_ROUTES, check-bundles BASELINE_KB). Five lists, five chances to
 * forget, and forgetting is silent in every one of them. Now there is ONE list —
 * `routes-manifest.json` — and this test stands over it: it walks the filesystem, derives the route
 * every `page.tsx` actually serves, and demands the manifest and the filesystem agree in BOTH
 * directions.
 *
 * So a new room with no manifest entry is a RED UNIT TEST at the next `npm test` — seconds after it
 * is written, by the person writing it, who still remembers why. Not a silent hole discovered two
 * phases later by an analyst reading commit statistics.
 *
 * Both directions matter, and the second is the one people forget:
 *   · filesystem → manifest   a new room that nothing measures  (this is /news, above)
 *   · manifest → filesystem   an entry for a room that is GONE. The sweeps would keep "passing" on
 *                             it forever, because a deleted route serves the 404 page and the 404
 *                             page has no accessibility violations and no controls under 44px. A
 *                             guard that passes because the thing it measures is ABSENT is this
 *                             build's oldest hazard, and it gets caught here too.
 */

/** The app directory, relative to app/ (this file lives in app/lib/). */
const APP_DIR = join(import.meta.dirname, "..", "app");

/**
 * Routes that exist as a `page.tsx` but are deliberately NOT product rooms, and so are not in the
 * manifest. Every exemption is one line saying why — the house rule for every allowlist in this
 * repo. A fourth entry appearing here without an argument is itself the smell.
 */
const NOT_A_PRODUCT_ROOM: Record<string, string> = {
  // The login wall, not a room behind it. It is the one page a reader meets while signed OUT, so the
  // sweeps (which all sign in first) cannot reach it the way they reach a room — a11y and vrt test it
  // by name instead, and check-nav probes it as a static control.
  "/login": "the login wall — signed-out, so it is tested by name rather than swept",
  // The living spec: one of every token and primitive on a single page. No reader ever opens it, it
  // carries no product claim, and its bundle is deliberately allowed to grow with the design system.
  // hardening sweeps it anyway (it is the densest control surface in the repo); vrt pins it.
  "/styleguide": "the living spec — a developer surface, not a room a reader visits",
  // The page of last resort, served by the service worker when a navigation fails and nothing is
  // cached. It is in the manifest as a room (below) but is NOT swept: every sweep begins by signing
  // in and navigating, which is precisely the thing that has to have FAILED for a reader to see this
  // page. e2e/offline.spec.ts owns it, with the network actually turned off.
};

/**
 * Walk `app/app/**\/page.tsx` and derive the route each one serves.
 *
 * The two rules Next.js's App Router applies, and this must apply the same two or it is measuring a
 * different app than the one that ships:
 *   · a segment in parentheses is a ROUTE GROUP — organisational only, contributes nothing to the URL
 *     (this app's `(desk)` group is how every room gets the desk chrome without `/desk` in its URL)
 *   · a segment in square brackets is DYNAMIC, and stays in bracket form here. `/news/[cluster]` is
 *     the thing that must be measured; which cluster you measure it with is the manifest's business.
 */
function routesOnDisk(): string[] {
  const pages: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") pages.push(relative(APP_DIR, full));
    }
  };
  walk(APP_DIR);

  return pages
    // A parallel-route SLOT page is not a new room — it is an alternate PRESENTATION of a room that
    // already exists and is already measured under its canonical path. PD9's `@modal` slot renders
    // /news/[cluster] and /ticker/[symbol] as detail sheets; those two rooms are in the manifest and
    // swept there, and the sheet's own coverage is the overlay e2e (e2e/overlay.spec.ts) and its VRT
    // shots, not this room census. Without this filter the walk would derive a phantom route like
    // `/@modal/[cluster]` — a "room" with no manifest entry — and red the completeness guard on a
    // page that is not a room at all. A slot segment starts with `@`; the intercepting markers inside
    // it start with `(` and are already dropped below.
    .filter((file) => !file.split(/[/\\]/).some((segment) => segment.startsWith("@")))
    .map((file) => {
      const segments = file
        .replace(/[/\\]page\.tsx$/, "")
        .split(/[/\\]/)
        .filter((s) => s !== "" && !s.startsWith("(")); // drop route groups
      return "/" + segments.join("/");
    })
    .map((route) => (route === "/" ? "/" : route.replace(/\/$/, "")))
    .sort();
}

const families = manifest.routes.map((r) => r.family);

describe("the routes manifest is the one list of rooms", () => {
  it("names every room that exists on disk — a new page.tsx with no entry fails HERE, not two phases later", () => {
    const missing = routesOnDisk()
      .filter((route) => NOT_A_PRODUCT_ROOM[route] === undefined)
      .filter((route) => !families.includes(route));

    expect(
      missing,
      "these routes have a page.tsx but no entry in lib/routes-manifest.json, so NOTHING measures " +
        "them — no touch-target sweep, no axe scan, no nav budget, no pixel baseline. This is exactly " +
        "how /news shipped in N5 and went unmeasured for two tagged phases. Add the route to the " +
        "manifest (see its header for what each field means), or, if it is genuinely not a product " +
        "room, add it to NOT_A_PRODUCT_ROOM above with the one line saying why.",
    ).toEqual([]);
  });

  it("names only rooms that still exist — an entry for a deleted room is a sweep that passes on a 404", () => {
    const onDisk = routesOnDisk();
    const ghosts = families.filter((family) => !onDisk.includes(family));

    expect(
      ghosts,
      "these entries name a route with no page.tsx behind it. The sweeps would go on 'passing' on " +
        "them forever: a route that is gone serves the 404 page, and the 404 page has no controls " +
        "under 44px and no accessibility violations. A guard that passes because the thing it " +
        "measures is ABSENT is the oldest hazard in this build.",
    ).toEqual([]);
  });

  it("gives every dynamic family a concrete instance to actually measure", () => {
    // `/news/[cluster]` cannot be fetched. The sweeps need a real URL, so each dynamic family carries
    // the canonical instance the specs already use — and a room measured through a cluster id that is
    // not seeded is a room measured as its 404 page (N7's finding, and the reason `open()` exists).
    const unusable = manifest.routes
      .filter((r) => r.family.includes("["))
      .filter((r) => r.path.includes("["));

    expect(
      unusable.map((r) => r.family),
      "a dynamic family needs a concrete `path` — a real, seeded instance — or nothing can open it",
    ).toEqual([]);
  });

  /**
   * A ROOM FLAGGED FOR THE 16-INCH LOCK MUST ACTUALLY BE SHOT AT 16 INCHES (PD3).
   *
   * The manifest's own warning, applied to the manifest's newest field: "a field nobody reads is a
   * measurement that is not being taken, wearing a measurement's clothes." `mbp16: true` says this
   * room is pixel-locked at 1512. vrt.spec.ts's generated room loop delivers on that promise by
   * reading `vrtRoom` — so a room with `mbp16: true` and `vrtRoom: null` is a promise nothing keeps.
   * Nothing would fail. The room would simply never be photographed, and the flag would sit there
   * looking like coverage.
   *
   * There is exactly ONE room where that combination is legitimate, and it is argued rather than
   * assumed: the ticker. Its baselines are shot BESPOKE in vrt.spec.ts against /ticker/AAPL (the
   * Range Ladder only renders with seeded vol bands behind it), while the sweeps and the nav budget
   * open /ticker/SPY, which needs no seed. So its `vrtRoom` is null while the room genuinely does
   * have pictures — including a 16-inch one.
   */
  it("every room flagged for the 16-inch lock is actually shot at 1512", () => {
    const SHOT_BY_HAND: Record<string, string> = {
      "/ticker/SPY":
        "bespoke shots in vrt.spec.ts at /ticker/AAPL — the Range Ladder needs seeded vol bands, " +
        "which SPY does not have. The room has pictures; it just does not get them from the loop.",
    };

    const promisedButUnphotographed = manifest.routes
      .filter((r) => r.mbp16 && r.vrtRoom === null)
      .filter((r) => !(r.path in SHOT_BY_HAND))
      .map((r) => r.path);

    expect(
      promisedButUnphotographed,
      "these rooms claim a 16-inch pixel lock but no shot exists for them — either give them a " +
        "`vrtRoom` so the generated loop photographs them, write a bespoke shot and argue it in " +
        "SHOT_BY_HAND above, or set `mbp16: false` and mean it",
    ).toEqual([]);
  });
});
