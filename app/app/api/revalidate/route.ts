import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/revalidate — the pipeline's handshake to refresh the app after a nightly publish
 * (plan §7, Appendix D; APP-FEEL-PLAN §5.3 P-7).
 *
 * Every read route in this app is served from a cached render now, which is what makes navigation
 * instant. The bargain that keeps that honest is ruling M5: a cached page is honest because it is
 * STAMPED — every module prints its own as-of time — and because the moment the underlying data
 * actually changes, the cache is thrown away rather than waited out. This endpoint is the second
 * half of that bargain.
 *
 * It used to refresh the Desk alone, which was right when the Desk was the only cached route. It no
 * longer is. Both nightly jobs already call this endpoint (job_a.py, job_b.py) and NEITHER needs to
 * change: the pipeline's contract is "tell the app the data moved", and knowing what that touches is
 * the app's job, not the pipeline's.
 *
 * This route is public at the proxy (the pipeline is not a browser and carries no session cookie),
 * so it guards itself with CRON_SECRET — the shared secret from Appendix D. A wrong or missing
 * secret gets a 401 and nothing is revalidated.
 */

/** The fixed pages a nightly publish changes. */
const PUBLISHED_PATHS = [
  "/", // the Desk — the morning itself
  "/scans", // the preset cards and their match counts
  "/track-record", // signals resolve overnight, so the record grows
  "/academy", // lesson read-counts
  "/academy/review", // the review queue's due list turns over at midnight
  "/settings", // watchlist rows carry pipeline-written instrument names
  "/paper", // the ticket's reference prices come from served bars
];

/**
 * The on-demand families: routes with a parameter, where "the page" is really many pages.
 *
 * `revalidatePath(path, "page")` with the LITERAL bracket syntax busts every rendered instance of
 * the family — every ticker anyone has opened, every scan preset, every lesson — rather than one
 * URL that happens to be spelled with brackets.
 */
const PUBLISHED_FAMILIES = ["/ticker/[symbol]", "/scans/[preset]", "/academy/[slug]"];

export async function POST(request: NextRequest) {
  const provided = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  for (const path of PUBLISHED_PATHS) revalidatePath(path);
  for (const family of PUBLISHED_FAMILIES) revalidatePath(family, "page");

  // Worth stating for whoever reads this in a job log: invalidating is not regenerating. The NEXT
  // request to each path pays one render, and everybody after that is served from the cache. That
  // is the "first tap after the publish" regime the budgets measure on purpose, rather than hiding
  // it inside a flattering steady-state average.
  return NextResponse.json({
    revalidated: true,
    paths: PUBLISHED_PATHS,
    families: PUBLISHED_FAMILIES,
  });
}
