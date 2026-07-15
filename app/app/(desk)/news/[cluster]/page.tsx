import { StoryPageBody } from "@/components/news/StoryPageBody";

/**
 * /news/[cluster] — one story, in full (POLISH-AND-DEPTH-PLAN Part 9.6, the v2 anatomy).
 *
 * PD9 lifted the whole anatomy into `components/news/StoryPageBody` so this route and the
 * intercepting @modal overlay render the IDENTICAL tree (E9). This file is now only the route
 * contract: the ISR window, the empty-params array that turns ISR on, and the deep-link truth the
 * reader reaches on a hard load or a shared URL. Everything the page SAYS lives in the body — see
 * its header for the ten-block anatomy and every honesty rule.
 */

export const revalidate = 600;

/**
 * The empty array is what turns runtime ISR ON for this route, and it is not optional.
 *
 * The framework's own rule, which this repo learned once already on /ticker/[symbol]: "You must
 * always return an array from generateStaticParams, even if it's empty. Otherwise, the route will
 * be dynamically rendered." Ship the `revalidate` above without this and the route caches NOTHING —
 * every story page re-renders on every request, the B1 budget fails, and the reason is invisible in
 * the code because the `revalidate` line is right there looking correct.
 */
export async function generateStaticParams(): Promise<{ cluster: string }[]> {
  return [];
}

type StoryPageProps = { params: Promise<{ cluster: string }> };

export default async function StoryPage({ params }: StoryPageProps) {
  const { cluster } = await params;
  return <StoryPageBody clusterId={cluster} />;
}
