"use client";

import { useSyncExternalStore } from "react";

import { copy, fill } from "@/lib/copy";
import { marketState } from "@/lib/market-hours";
import { formatAsOf, formatUtcDate } from "@/lib/time";

/**
 * The Desk's status line — and the "markets open / markets closed" phrase in it is computed HERE,
 * in the reader's browser, on purpose.
 *
 * IT USED TO BE COMPUTED ON THE SERVER, AND THAT WAS A LIE WITH A TEN-MINUTE FUSE. The Desk is an
 * ISR-cached route (budget B1). A value derived from `new Date()` in a server component is evaluated
 * when the page is GENERATED and then served to everyone who reads it until the cache turns over. A
 * Desk generated at 3:55pm would go on telling every reader "markets open" well past the close.
 *
 * This is the same bug F4 found in the cooling-off interstitial, whose timestamp was interpolated on
 * the server and therefore recorded the moment the page was BUILT rather than the moment the reader
 * clicked. The rule that came out of it holds here: **on a cached page, anything that depends on
 * "now" must be computed in the browser, because the server's "now" is not the reader's.**
 *
 * The pixel oracle found this one. The Desk's baselines had been photographs of whatever the market
 * happened to be doing when CI last ran — green at 3am, red at 10am — which is a baseline that means
 * nothing. With the state computed in the browser, Playwright's pinned clock reaches it, and the shot
 * is deterministic again.
 */
/** The market state never pushes an update at us; we simply read it when React asks. */
const noSubscription = () => () => {};

export function MarketStateLine({
  runDate,
  updatedAt,
  serverOpen,
}: {
  runDate: Date;
  updatedAt: Date | null;
  /** What the server believed when it generated the page. The FIRST PAINT only — never the truth. */
  serverOpen: boolean;
}) {
  /*
   * useSyncExternalStore is the right primitive here and not a flourish: it is React's own way of
   * saying "this value is read from outside React, and the server's copy of it is not the client's".
   * The third argument IS that admission — the server snapshot is the cache's stale guess, the client
   * snapshot is the reader's real clock, and React swaps one for the other on hydration without a
   * mismatch and without a setState inside an effect.
   */
  const open = useSyncExternalStore(
    noSubscription,
    () => marketState(new Date()) === "open", // the reader's clock — the one that is true
    () => serverOpen, // what the cache happened to be built with
  );

  const status = fill(copy.desk.status, {
    state: open ? "open" : "closed",
    close: formatUtcDate(runDate),
    stamp: updatedAt ? formatAsOf(updatedAt) : "—",
  });

  return (
    <p className="font-ui text-sm text-muted" suppressHydrationWarning>
      {status}
    </p>
  );
}
