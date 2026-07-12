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
    <span className="hidden items-center gap-1.5 md:flex">
      <span
        aria-hidden="true"
        className={cx("size-1.5 rounded-pill", open ? "bg-ink" : "bg-muted")}
      />
      <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">
        {open ? "Market open" : "Market closed"}
      </span>
    </span>
  );
}
