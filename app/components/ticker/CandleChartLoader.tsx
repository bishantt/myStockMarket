"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/Skeleton";
import type { Candle, VolumeBar } from "@/lib/ticker";

/**
 * CandleChartLoader — the chart, fetched only when a reader actually opens a ticker (§5.3 P-6).
 *
 * `lightweight-charts` is a real library with a real weight, and it was being imported statically
 * into the /ticker client bundle: every reader who opened a ticker page downloaded and parsed the
 * whole charting engine before the page could become interactive, whether or not they ever looked
 * at the chart. It made /ticker the heaviest route in the app by a wide margin.
 *
 * Splitting it out is the same move `Rail.tsx` already makes for its Radix dialog, and it needs this
 * separate file for a boring reason: `next/dynamic` with `ssr: false` cannot be called from a Server
 * Component, and the ticker page is one. So the client boundary lives here.
 *
 * THE FALLBACK IS STILL GEOMETRY, AND THAT IS RULING M4. The chart is a money visual — this
 * codebase says so in CandleChart's own file comment, "the chart is a money visual, and money
 * visuals do not move" — so the 420px hole it leaves while loading is held open by a plain bordered
 * box, not a shimmer. A pulsing rectangle the size of a price chart is the single largest piece of
 * manufactured anticipation this app could possibly show. It reserves the exact height the chart
 * will take, so nothing jumps when it arrives (budget B5).
 */
const CandleChart = dynamic(() => import("./CandleChart").then((m) => m.CandleChart), {
  ssr: false,
  loading: () => <Skeleton variant="block" height={420} />,
});

export function CandleChartLoader({ candles, volumes }: { candles: Candle[]; volumes: VolumeBar[] }) {
  return <CandleChart candles={candles} volumes={volumes} />;
}
