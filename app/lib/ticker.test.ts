import { describe, expect, it } from "vitest";

import { barsToSeries } from "@/lib/ticker";

/**
 * Tests for the pure chart-series transform in lib/ticker. The database read (getTicker) is
 * exercised by the ticker route in the seeded e2e; this pins the shape the Lightweight Charts hook
 * consumes: business-day time strings, and a volume bar coloured by whether the day closed up.
 */

function bar(date: string, open: number, close: number, vol: number) {
  return { date: new Date(`${date}T00:00:00.000Z`), open, high: Math.max(open, close), low: Math.min(open, close), close, vol };
}

describe("barsToSeries", () => {
  it("maps bars to candle and volume series with business-day time strings", () => {
    const { candles, volumes } = barsToSeries([
      bar("2026-07-08", 100, 102, 1000),
      bar("2026-07-09", 102, 101, 1500),
    ]);
    expect(candles).toEqual([
      { time: "2026-07-08", open: 100, high: 102, low: 100, close: 102 },
      { time: "2026-07-09", open: 102, high: 102, low: 101, close: 101 },
    ]);
    // Volume bars carry the up/down flag (close vs open) so the chart can colour them redundantly.
    expect(volumes).toEqual([
      { time: "2026-07-08", value: 1000, up: true },
      { time: "2026-07-09", value: 1500, up: false },
    ]);
  });

  it("returns empty series for no bars", () => {
    expect(barsToSeries([])).toEqual({ candles: [], volumes: [] });
  });
});
