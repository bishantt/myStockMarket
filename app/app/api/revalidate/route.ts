import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/revalidate — the pipeline's handshake to refresh the Desk (plan §7, Appendix D).
 *
 * The Desk is served from a cached (ISR) render so its TTFB and LCP stay low. After each nightly
 * publish, Job A calls this endpoint to refresh that render, so the next visit sees the new morning
 * without waiting for the time fallback.
 *
 * This route is public at the proxy (the pipeline is not a browser and has no session cookie), so
 * it guards itself with CRON_SECRET — the shared secret from Appendix D. A wrong or missing secret
 * gets a 401 and nothing is revalidated.
 */
export async function POST(request: NextRequest) {
  const provided = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidatePath("/");
  return NextResponse.json({ revalidated: true, path: "/" });
}
