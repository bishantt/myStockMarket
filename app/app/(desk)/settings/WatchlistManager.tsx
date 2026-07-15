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
         * `w-24 md:w-32` — A CHIP IS WIDER THAN THE WORD IT REPLACES, AND THE COLUMN WAS SIZED FOR
         * THE WORD (PD6). This took three goes, and the two failures are the useful part.
         *
         * "AAPL" as bare text is ~34px. As a bordered chip it is ~48px, and beside its FOCUS tag
         * that came to ~101px in a 96px column — so the tag wrapped onto its own line and shoved the
         * company name down. **Making a chip FIT is the LAYOUT's job, not the chip's** (PD4's law).
         *
         *   ATTEMPT 1 — `w-32` everywhere. It fixed the desktop and **made /settings scroll sideways
         *     by 16px at 360**: 32px added to a row that was already tight. That is the exact bug PD4
         *     spent a phase killing, and the 360 sweep caught it.
         *   ATTEMPT 2 — `flex-wrap` on the row, so the controls could drop to a second line instead
         *     of overflowing. It fixed 360 and **broke 1366**: the reason text's flex-basis is `auto`
         *     (its full, long width), so under `flex-wrap` it stops SHRINKING and starts PUSHING —
         *     the buttons wrapped to a second line on the desktop too. `wide` passed and hid it, for
         *     the only reason a wider viewport ever hides a wrap: it had 140px more room.
         *
         * The column is RESPONSIVE, which is what it always should have been. Below `md` the chip and
         * its tag stack inside a 96px column — on a phone that is not a defect, it is the better
         * layout, because it hands the reason text back the 32px it was taking. From `md` up there is
         * room for both on one line, and the company names stop wrapping too (which is why the
         * desktop baseline came back 35px SHORTER than the one it replaced).
         */}
        <div className="w-24 shrink-0 md:w-32">
          <div className="flex flex-wrap items-center gap-1.5">
            <TickerChip symbol={item.symbol} door />
            {item.isFocus ? <Tag variant="catalyst">focus</Tag> : null}
          </div>
          <span className="font-ui text-2xs text-muted">{item.name}</span>
        </div>

        {/* Clamped to one line, with the full reason in `title` (D10 / Q-PD6-3): on a narrow phone the
            row cannot give the reason its full width, so it truncates — but the whole reason is now
            recoverable on hover/long-press instead of being silently lost. */}
        <span className="min-w-0 flex-1 truncate font-ui text-sm text-ink-2" title={item.reason}>{item.reason}</span>

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
