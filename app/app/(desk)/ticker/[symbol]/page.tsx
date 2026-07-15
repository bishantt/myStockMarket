import { TickerPageBody } from "@/components/ticker/TickerPageBody";

/**
 * /ticker/[symbol] — the instrument room, v2 (POLISH-AND-DEPTH-PLAN Part 10.1).
 *
 * PD9 lifted the whole room into `components/ticker/TickerPageBody` so this route and the
 * intercepting @modal overlay render the IDENTICAL tree (E9). This file is now only the route
 * contract: the ISR window, the empty-params array that turns ISR on, and the deep-link truth a
 * reader reaches on a hard load or a shared URL.
 *
 * Before touching this route, `app/AGENTS.md` was re-read: the tree runs a customized Next 16 whose
 * docs live in node_modules, and PD9 read the LOCAL parallel/intercepting-routes docs before wiring
 * the overlay.
 */

export const revalidate = 600;

/**
 * The empty array is what turns runtime ISR ON for this route (see the framework note the story page
 * carries too). Ship `revalidate` without it and the route caches nothing.
 */
export async function generateStaticParams(): Promise<{ symbol: string }[]> {
  return [];
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <TickerPageBody symbol={symbol} />;
}
