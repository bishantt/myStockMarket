"use client";

import { useEffect, useState } from "react";
import { marketState, type MarketState as State } from "@/lib/market-hours";
import { cx } from "@/lib/cx";

/**
 * MarketState — a dot, a word, and no theatre.
 *
 * The Figma drew this as a pulsing emerald dot with a glow. It is a static dot here, beside its own
 * text label, and that is a deliberate overrule (§1.3 #4): a glowing, pulsing live-status indicator
 * is urgency theatre. Session state is peripheral information — the market being open is not news,
 * and nothing in this product may move in order to attract attention.
 *
 * The dot is muted when closed and ink when open. It is NOT the accent colour: indigo means "you
 * can act here", and this is status, not an affordance. And it is never the only channel — the word
 * beside it says the same thing, which is what makes it legible to a colourblind reader.
 *
 * It renders client-side because the state depends on the reader's current instant, and a
 * server-rendered clock would be stale the moment it arrived. It shows nothing until mounted rather
 * than guessing — an indicator that flickers from wrong to right is worse than one that waits.
 *
 * SINCE CC3 THIS IS THE SINGLE MARKET-STATE TRUTH (ruling R3, D10). The state left the masthead's
 * status line, so the pill carries it alone — on the phone too, where the market state used to be
 * stated nowhere. "Market" collapses below `sm` so the phone reads just "CLOSED", which is what fits
 * beside the wordmark and the two icon buttons at 360px.
 */
export function MarketState() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const update = () => setState(marketState(new Date()));
    update();
    // The bell rings on a minute boundary; checking once a minute is more than enough.
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (state === null || state === "unknown") return null;

  const open = state === "open";

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cx("size-1.5 rounded-pill", open ? "bg-ink" : "bg-muted")}
      />
      {/* "Market " collapses below sm — the phone reads "CLOSED"; the same-line trailing space is kept. */}
      <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">
        <span className="hidden sm:inline">Market </span>{open ? "open" : "closed"}
      </span>
    </span>
  );
}
