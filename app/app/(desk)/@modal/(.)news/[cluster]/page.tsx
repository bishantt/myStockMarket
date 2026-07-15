import { notFound } from "next/navigation";

import { OverlayMount } from "@/components/OverlayMount";
import { StoryPageBody } from "@/components/news/StoryPageBody";
import { db } from "@/lib/db";

/**
 * The intercepting @modal story route (PD9, plan 11.1).
 *
 * This fires ONLY on an in-app soft navigation — a tap on a NewsCard in the feed — where Next
 * intercepts `/news/[cluster]` and renders it into the @modal slot OVER the still-mounted room
 * instead of replacing it. A hard load, a refresh, or a shared link bypasses this entirely and
 * renders the standalone page (children slot); the URL is `/news/[cluster]` in every case (E9's
 * canonical-URL guarantee).
 *
 * THE MATCHER IS `(.)`, AND THE BUILD PROVED IT. Intercepting distance is counted in ROUTE SEGMENTS;
 * a route group like `(desk)` contributes none, so this Next version places the `@modal` slot at the
 * ROOT level — the same level as the `news` segment. `(.)` matches a segment on the same level, and
 * this Next rejects `(..)` here outright: "Cannot use (..) marker at the root level, use (.) instead."
 * (The plan said `(.)`; a first guess from the framework's own root-level modal example reached for
 * `(..)`, and `next build` corrected it. Verify the matcher, never trust it — the census's warning.)
 *
 * It renders the SAME StoryPageBody the standalone page renders — that identity is E9, and the
 * reload-while-open e2e asserts the two DOMs are content-identical. The overlay chrome is the only
 * difference, and it code-splits (OverlayMount → next/dynamic) so it never weighs on `/news`.
 */
// ISR, matching the standalone /news/[cluster] window (E9: same content, same freshness). A dynamic
// overlay would re-query on every open; cached, the sheet opens on the same 10-minute edition the
// deep-link page serves. The empty-params array is what turns ISR on (the framework rule the
// standalone page's header spells out); without it a `revalidate` route caches nothing.
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ cluster: string }[]> {
  return [];
}

export default async function StoryOverlay({
  params,
}: {
  params: Promise<{ cluster: string }>;
}) {
  const { cluster } = await params;

  // A minimal read for the dialog's accessible name (the story headline). The body does the full
  // read; this indexed lookup is a few milliseconds and only runs when a sheet actually opens. If the
  // cluster is gone the body will notFound(); we notFound() here too so the sheet never opens titled.
  const row = await db.newsCluster.findUnique({
    where: { id: cluster },
    select: { headline: true },
  });
  if (!row) notFound();

  return (
    <OverlayMount title={row.headline}>
      <StoryPageBody clusterId={cluster} />
    </OverlayMount>
  );
}
