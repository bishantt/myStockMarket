"use client";

import { useActionState } from "react";

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
        <div className="w-24 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-ui text-sm font-semibold text-ink">{item.symbol}</span>
            {item.isFocus ? (
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">focus</span>
            ) : null}
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
