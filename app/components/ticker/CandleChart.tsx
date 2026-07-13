"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
} from "lightweight-charts";

import type { Candle, VolumeBar } from "@/lib/ticker";

/**
 * CandleChart — the /ticker drill's price chart (plan §3.7, Lightweight Charts v5).
 *
 * Themed to the Broadsheet grammar, and the theming is deliberate about honesty:
 *   - Up candles are HOLLOW (body filled with the page surface, up-coloured border); down candles
 *     are FILLED. Hollow-vs-filled is a second, colour-independent channel — the chart reads for
 *     the ~1-in-12 who cannot rely on the blue/orange (Wong) pair (§3.3, §3.7).
 *   - Volume renders in one muted tone: the bar HEIGHT is the information, so a two-tone histogram
 *     would add colour that competes with the candles for no gain (§3.3 scarce colour).
 *   - Colours are read from the live CSS tokens at runtime (globals.css §3.7 note), so the chart
 *     never hard-codes a hex and can never drift from the design system.
 *
 * ATTRIBUTION, AND WHY IT IS NOT THE LIBRARY'S OWN LOGO (F7 accessibility sweep).
 * Lightweight Charts is Apache-2.0 and its licence asks for the attribution notice and a link to
 * tradingview.com "on the page of your website that is available to your users". Its
 * `attributionLogo` option is offered as ONE way to satisfy that, and we used it — but the option
 * injects an anchor INSIDE the chart container, and this container is `role="img"`, which tells a
 * screen reader that everything inside it is one picture. A link inside a picture is a link nobody
 * can reach: axe flags it (`nested-interactive`) and a keyboard reader simply cannot tab to it. So
 * the logo is off, and the attribution is a real link in the caption below — on the page, visible,
 * and reachable. That satisfies the licence more honestly than the version that hid it.
 *
 * No animation: the chart is a money visual, and money visuals do not move (§1.5 rule 12). The hook
 * builds the chart once, sets the data, fits the content, and tears down on unmount.
 */

// Read a design token off the computed root style. No hex is duplicated here (plan §3.10 rule 1):
// the tokens are defined in globals.css and this effect runs client-side after styles have loaded,
// so getPropertyValue always returns the live value. A monospace keyword is the only literal.
function token(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function CandleChart({ candles, volumes }: { candles: Candle[]; volumes: VolumeBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const styles = getComputedStyle(document.documentElement);
    const ink = token(styles, "--color-ink");
    const ink2 = token(styles, "--color-ink-2");
    const muted = token(styles, "--color-muted");
    const hairline = token(styles, "--color-hairline");
    const surface = token(styles, "--color-surface");
    const up = token(styles, "--color-up");
    const down = token(styles, "--color-down");
    const mono = token(styles, "--font-mono") || "monospace";

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: surface },
        textColor: ink2,
        fontFamily: mono,
        // Off on purpose — the attribution is rendered as a real link below the chart instead.
        // See the header: the injected one lands inside a role="img" and no keyboard can reach it.
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: hairline },
        horzLines: { color: hairline },
      },
      rightPriceScale: { borderColor: hairline },
      timeScale: { borderColor: hairline, rightOffset: 4 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: muted, labelBackgroundColor: ink },
        horzLine: { color: muted, labelBackgroundColor: ink },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      // Hollow up: the body is the page surface, the border carries the up colour. Down is filled.
      upColor: surface,
      downColor: down,
      borderVisible: true,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
    candleSeries.setData(candles);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: muted,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(volumes.map((v) => ({ time: v.time, value: v.value })));

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles, volumes]);

  return (
    <figure className="flex flex-col gap-2">
      <div ref={containerRef} className="h-[420px] w-full" aria-label="Price chart" role="img" />
      <figcaption className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
        Chart by{" "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-accent-deep"
        >
          TradingView
        </a>
      </figcaption>
    </figure>
  );
}
