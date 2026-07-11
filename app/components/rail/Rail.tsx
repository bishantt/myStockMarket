"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";

/**
 * Rail — drill level 2 (plan §3.6 RailSheet, §9.2). A row on the Desk opens a slide-over that shows
 * the name's key facts and a doorway to the full page (level 3, /ticker/[symbol]) — WITHOUT a route
 * change, so the Desk's scroll and selection are preserved and Esc returns you exactly where you
 * were (journey 2).
 *
 * Desktop is a 440px right rail; the phone is a full-width bottom sheet. The scrim (the app's only
 * shadow-like surface) and a 1px ink edge separate it — no drop shadow (§3.4).
 *
 * Opening pushes a history entry and popstate closes the sheet, so the Android back gesture closes
 * the rail instead of exiting the app (§3.6, e2e-tested). Radix handles Esc and outside-click and
 * restores focus to the row that opened it.
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

const DELTA_COLOUR: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
  flat: "text-ink",
};

export function RailProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<RailPayload | null>(null);

  const open = useCallback((next: RailPayload) => {
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
      <Dialog.Root open={payload !== null} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "var(--scrim)" }} />
          <Dialog.Content
            aria-describedby={undefined}
            className={cx(
              "fixed z-50 flex flex-col gap-5 border-ink bg-surface p-5 outline-none",
              // Phone: full-width bottom sheet. Desktop (≥1366px): 440px right rail.
              "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t",
              "desk:inset-y-0 desk:left-auto desk:right-0 desk:w-[440px] desk:max-h-none desk:border-l desk:border-t-0",
            )}
          >
            {payload ? <RailBody payload={payload} /> : <Dialog.Title className="sr-only">Details</Dialog.Title>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </RailContext.Provider>
  );
}

function RailBody({ payload }: { payload: RailPayload }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <Dialog.Title className="font-ui text-lg font-bold uppercase tracking-[0.06em] text-ink">
            {payload.symbol}
          </Dialog.Title>
          <p className="pt-1 font-ui text-sm text-muted">{payload.name}</p>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="rounded-edge border border-hairline px-2 py-1 font-ui text-2xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent"
        >
          Close
        </Dialog.Close>
      </div>

      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <div>
          <dt className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Day change</dt>
          <dd className={cx("pt-0.5 font-mono text-lg", DELTA_COLOUR[payload.direction])}>{payload.changePct}</dd>
        </div>
        {payload.rvol ? (
          <div>
            <dt className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Rel. volume</dt>
            <dd className="pt-0.5 font-mono text-lg text-ink-2">{payload.rvol}</dd>
          </div>
        ) : null}
      </dl>

      {payload.note ? <p className="font-ui text-sm text-ink-2">{payload.note}</p> : null}

      <Link
        href={`/ticker/${encodeURIComponent(payload.symbol)}`}
        className="mt-auto font-ui text-xs uppercase tracking-[0.06em] text-ink underline underline-offset-4 hover:text-accent"
      >
        Open full view →
      </Link>
    </>
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
