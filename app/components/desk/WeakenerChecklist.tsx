"use client";

import { useActionState } from "react";

import { toggleWeakener, type WeakenerResult } from "@/app/(desk)/setup-card-actions";
import type { Weakener } from "@/lib/weakeners";

/**
 * WeakenerChecklist — the interactive part of a setup card (plan §3.6, P4 step 6).
 *
 * Each weakener is a condition that argues against acting on the signal; ticking it records the
 * user's own read. A client component because it posts each toggle to a server action and keeps the
 * boxes in sync. Editorial, not a form widget: hairline boxes, ink, no shadow. The label carries the
 * meaning; the checkbox is the record.
 */
export function WeakenerChecklist({
  cardId,
  items,
  checked,
}: {
  cardId: string;
  items: Weakener[];
  checked: Record<string, boolean>;
}) {
  const [, formAction] = useActionState<WeakenerResult, FormData>(toggleWeakener, { ok: true });
  if (items.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
        Weakeners — tick what applies
      </legend>
      {items.map((item) => (
        <form key={item.key} action={formAction}>
          <input type="hidden" name="cardId" value={cardId} />
          <input type="hidden" name="key" value={item.key} />
          {/* The LABEL carries the 44px touch target, not the checkbox. A 14px native control cannot grow
              to 44px without wrecking the row — and the label is what a thumb actually hits anyway. */}
            <label className="flex min-h-11 cursor-pointer items-start gap-2 py-2">
            <input
              type="checkbox"
              name="checkbox"
              defaultChecked={!!checked[item.key]}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 border-hairline accent-ink"
            />
            <span className="max-w-[52ch] font-ui text-2xs text-ink-2">{item.label}</span>
          </label>
        </form>
      ))}
    </fieldset>
  );
}
