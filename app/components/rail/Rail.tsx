"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

// The rail's Radix Dialog UI is loaded on demand — it is not needed until a row is first clicked,
// so keeping it out of the Desk's first-load bundle helps the throttled-CPU LCP (plan §4.5).
const RailDialog = dynamic(() => import("./RailDialog").then((m) => m.RailDialog), { ssr: false });

/**
 * Rail — drill level 2 (plan §3.6 RailSheet, §9.2). A row on the Desk opens a slide-over that shows
 * the name's key facts and a doorway to the full page (level 3, /ticker/[symbol]) — WITHOUT a route
 * change, so the Desk's scroll and selection are preserved and Esc returns you exactly where you
 * were (journey 2).
 *
 * This file holds only the light context and the row trigger; the heavier Radix Dialog UI lives in
 * RailDialog and is code-split, mounted on first open and then kept mounted so Radix can restore
 * focus to the row on close. Opening pushes a history entry, so the Android back gesture closes the
 * rail instead of exiting the app.
 */

/** The facts a row hands the rail. Kept small and serializable — the row already has all of it. */
export type RailPayload = {
  symbol: string;
  name: string;
  /** Already formatted and signed, e.g. "+2.10%". */
  changePct: string;
  direction: Direction;
  /** Relative volume, formatted, e.g. "3.1×". */
  rvol?: string;
  /** A written reason (watchlist) or the honest noise line (movers). */
  note?: string;
};

type RailContextValue = { open: (payload: RailPayload) => void };

// Default is a no-op so a row renders fine in isolation (component tests) without a provider.
const RailContext = createContext<RailContextValue>({ open: () => {} });

export function useRail(): RailContextValue {
  return useContext(RailContext);
}

export function RailProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<RailPayload | null>(null);
  // Once the rail has been opened, keep the Dialog mounted so Radix's close (focus restore) runs.
  const [everOpened, setEverOpened] = useState(false);

  const open = useCallback((next: RailPayload) => {
    setEverOpened(true);
    setPayload(next);
    // Push a history entry so the back gesture (and back button) closes the rail, not the app.
    window.history.pushState({ msmRail: true }, "");
  }, []);

  useEffect(() => {
    const onPop = () => setPayload(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const onOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) return;
    // Closed via Esc / scrim / the close button: pop the entry we pushed, which fires popstate and
    // clears the state. If our entry is somehow gone, close directly.
    const state = window.history.state as { msmRail?: boolean } | null;
    if (state?.msmRail) window.history.back();
    else setPayload(null);
  }, []);

  return (
    <RailContext.Provider value={{ open }}>
      {children}
      {everOpened ? <RailDialog open={payload !== null} payload={payload} onOpenChange={onOpenChange} /> : null}
    </RailContext.Provider>
  );
}

/**
 * RailTrigger — makes a Desk row open the rail. A role="button" wrapper (not a <button>) so it can
 * hold the row's mixed markup as children; keyboard-activatable with Enter and Space.
 */
export function RailTrigger({
  payload,
  className,
  children,
}: {
  payload: RailPayload;
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useRail();
  const activate = () => open(payload);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${payload.symbol} details`}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
      className={cx("cursor-pointer", className)}
    >
      {children}
    </div>
  );
}
