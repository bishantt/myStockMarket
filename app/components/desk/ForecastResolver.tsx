"use client";

import { useActionState } from "react";

import { resolveForecast } from "@/app/(desk)/journal-actions";
import type { JournalResult } from "@/app/(desk)/journal-actions";

/**
 * ForecastResolver — mark an open forecast hit or missed (plan §7 P6 step 3).
 *
 * Two buttons, no ceremony: the forecast is scored with Brier the moment it resolves. A client
 * component because each button posts to the resolve action; the misses matter as much as the hits,
 * so neither is dressed up.
 */
export function ForecastResolver({ id }: { id: string }) {
  const [state, formAction] = useActionState<JournalResult, FormData>(resolveForecast, { ok: true });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        name="happened"
        value="yes"
        className="min-h-11 rounded-control border border-hairline px-2 py-0.5 font-ui text-2xs uppercase tracking-[0.05em] text-ink hover:border-accent"
      >
        Happened
      </button>
      <button
        type="submit"
        name="happened"
        value="no"
        className="min-h-11 rounded-control border border-hairline px-2 py-0.5 font-ui text-2xs uppercase tracking-[0.05em] text-ink hover:border-accent"
      >
        Did not
      </button>
      {/* `text-down-text`, not `text-down` (PD6). The bare `down` token is the CHART's red — it is
       * tuned to be read as a fill or a stroke, not as type, and this error string is text-2xs, the
       * smallest size in the app. Every other error message in the app already used the darkened
       * `-text` variant; this was the one that did not, and at this size it is exactly the case the
       * `-text` variants exist for. */}
      {state.ok === false && state.error ? <span className="font-ui text-2xs text-down-text">{state.error}</span> : null}
    </form>
  );
}
