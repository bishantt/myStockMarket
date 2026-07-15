import { OverlayMount } from "@/components/OverlayMount";
import { TickerPageBody } from "@/components/ticker/TickerPageBody";

/**
 * The intercepting @modal ticker route (PD9, plan 11.1).
 *
 * Fires only on an in-app soft navigation — a tap on a TickerChip door (a movers row, a watchlist
 * row, an affected-names table) — where Next intercepts `/ticker/[symbol]` into the @modal slot OVER
 * the still-mounted room. A hard load / refresh / shared link renders the standalone page instead.
 *
 * The matcher is `(.)` for the same reason the story overlay's is — see that file's header (a route
 * group is transparent, so `@modal` sits at the root level and `ticker` is its same-level sibling).
 * The dialog's accessible name is just the symbol from the URL, so no extra read is needed: the body
 * does the six reads and notFound()s a name the app cannot serve.
 *
 * It renders the SAME TickerPageBody the standalone page renders (E9); the overlay chrome
 * code-splits via OverlayMount so it never weighs on the shared `(desk)` chunk.
 */
// ISR, matching the standalone /ticker/[symbol] window (E9: same content, same freshness). The
// empty-params array turns ISR on; without it a `revalidate` route caches nothing.
export const revalidate = 600;

export async function generateStaticParams(): Promise<{ symbol: string }[]> {
  return [];
}

export default async function TickerOverlay({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  return (
    <OverlayMount title={decoded}>
      <TickerPageBody symbol={symbol} />
    </OverlayMount>
  );
}
