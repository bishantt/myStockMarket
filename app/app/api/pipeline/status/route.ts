import { NextResponse } from "next/server";

import { readPanel } from "@/lib/pipeline-runs";

/**
 * GET /api/pipeline/status — what the control room is doing right now (N6, plan 8.5).
 *
 * The panel polls this every 15 seconds, and ONLY while it is open and a run is actually live. A
 * dispatched run has no run id yet (the dispatch API answers 204 with an empty body — see
 * lib/github.ts), so this is also where the app hunts for it: `readPanel` reconciles the ledger
 * against GitHub and stores the id the first time it finds it.
 *
 * AUTH. This route is NOT in the proxy's PUBLIC_PATHS, so the login wall stands in front of it and
 * an unauthenticated request gets a 401 JSON body rather than a redirect to /login (proxy.ts makes
 * that split for /api/* deliberately — a redirect here would let the service worker cache a login
 * page as data). There is nothing to add: the wall is the default, and this route simply does not
 * opt out of it. An e2e asserts the 401.
 *
 * The GitHub token never appears in the response. What goes back is the panel's rendered state: what
 * can be pressed, what cannot, and why.
 */

/** Never cache a liveness endpoint. The whole point of it is that the answer changes. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const panel = await readPanel();

    return NextResponse.json(panel, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    // The panel is a diagnostic surface; when the diagnostic itself breaks, say so plainly rather
    // than answering with a shape the client will read as "nothing is running".
    console.error("GET /api/pipeline/status failed", error);
    return NextResponse.json(
      { error: "Could not read the pipeline's status." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
