"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";

import { cx } from "@/lib/cx";
import type { Direction } from "@/components/StatFigure";
import type { RailPayload } from "./Rail";

/**
 * RailDialog — the Radix Dialog UI for the rail (drill level 2), code-split from Rail so its weight
 * stays out of the Desk's first load (plan §4.5). Desktop is a 440px right rail; the phone is a
 * full-width bottom sheet. The scrim (the app's only shadow-like surface) and a 1px ink edge
 * separate it — no drop shadow (§3.4). Radix handles Esc, outside-click, and focus restore.
 */

const DELTA_COLOUR: Record<Direction, string> = {
  up: "text-up-text",
  down: "text-down-text",
  flat: "text-ink",
};

export function RailDialog({
  open,
  payload,
  onOpenChange,
}: {
  open: boolean;
  payload: RailPayload | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "var(--scrim)" }} />
        <Dialog.Content
          aria-describedby={undefined}
          className={cx(
            "fixed z-50 flex flex-col gap-5 border-ink bg-surface p-5 outline-none",
            "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t",
            "desk:inset-y-0 desk:left-auto desk:right-0 desk:w-[440px] desk:max-h-none desk:border-l desk:border-t-0",
          )}
        >
          {payload ? <RailBody payload={payload} /> : <Dialog.Title className="sr-only">Details</Dialog.Title>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
          className="rounded-control border border-hairline px-2 py-1 font-ui text-2xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent"
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
