"use client";

import { useActionState } from "react";

import { Tag } from "@/components/Tag";
import { TickerChip } from "@/components/TickerChip";
import { cx } from "@/lib/cx";
import { FOCUS_CAP } from "@/lib/watchlist";
import { removeWatchlistItem, toggleFocus, type ActionResult } from "./actions";

/** One watchlist name as this manager needs it — the display fields plus its focus state. */
export type ManagedItem = {
  id: string;
  symbol: string;
  name: string;
  reason: string;
  isFocus: boolean;
};

/**
 * The editable list of watchlist names. Each row can toggle focus or be removed; the focus cap is
 * enforced by the server action, and the message it returns (cap reached) renders on the row. This
 * is the write-side twin of the read-only Watchlist module on the Desk.
 */
export function WatchlistManager({ items, focusCount }: { items: ManagedItem[]; focusCount: number }) {
  if (items.length === 0) {
    return (
      <p className="font-ui text-sm text-muted">
        Nothing on the watchlist yet. Add a name above and the reason you are watching it.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
        {focusCount} of {FOCUS_CAP} focus
      </p>
      <ul>
        {items.map((item) => (
          <WatchlistManagerRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function WatchlistManagerRow({ item }: { item: ManagedItem }) {
  const [focusState, focusAction, focusPending] = useActionState<ActionResult, FormData>(toggleFocus, { ok: true });
  const [removeState, removeAction, removePending] = useActionState<ActionResult, FormData>(removeWatchlistItem, { ok: true });
  const error = focusState.error ?? removeState.error;

  return (
    <li className="flex flex-col gap-1 border-b border-hairline py-3 last:border-b-0">
      <div className="flex items-center gap-4">
        {/*
         * THE SYMBOL WAS SET IN THE UI SANS, BOLD (PD6). Every other symbol in this app is mono —
         * that is the type system's oldest rule, and this room was the one place that broke it, so
         * the watchlist's own symbols did not look like the symbols on the Desk that render FROM
         * this watchlist. A door now, too: the row's controls are in sibling <form>s, so the anchor
         * nests inside nothing interactive.
         */}
        {/*
         * `w-32`, not `w-24` — and this is PD4's law arriving in a new room. A bare word and a
         * bordered chip are not the same width: "AAPL" as text is ~34px, and "AAPL" as a chip is
         * ~48px once it has a border and its padding. Beside a FOCUS tag that came to ~101px in a
         * 96px column, so the tag wrapped onto its own line and pushed the company name down — the
         * whole of this room's +21px in the baseline.
         *
         * **Making a chip FIT is the LAYOUT's job, not the chip's.** The column is the thing that
         * was wrong, so the column is the thing that changed.
         */}
        <div className="w-32 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <TickerChip symbol={item.symbol} door />
            {item.isFocus ? <Tag variant="catalyst">focus</Tag> : null}
          </div>
          <span className="font-ui text-2xs text-muted">{item.name}</span>
        </div>

        <span className="min-w-0 flex-1 truncate font-ui text-sm text-ink-2">{item.reason}</span>

        <form action={focusAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={focusPending}
            className={cx(
              "min-h-11 rounded-control border px-3 py-1 font-ui text-2xs uppercase tracking-[0.06em] transition-colors duration-(--duration-quick) disabled:opacity-60",
              item.isFocus
                ? "border-transparent bg-accent-soft font-semibold text-accent-deep"
                : "border-hairline text-ink-2 hover:border-hairline-strong",
            )}
          >
            {item.isFocus ? "Unfocus" : "Focus"}
          </button>
        </form>

        <form action={removeAction}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={removePending}
            className="min-h-11 rounded-control border border-hairline px-3 py-1 font-ui text-2xs uppercase tracking-[0.06em] text-ink hover:text-down-text disabled:opacity-60"
          >
            Remove
          </button>
        </form>
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="font-ui text-2xs text-down-text">
          {error}
        </p>
      ) : null}
    </li>
  );
}
