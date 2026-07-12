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
        className="rounded-control border border-hairline px-2 py-0.5 font-ui text-2xs uppercase tracking-[0.05em] text-ink hover:border-accent"
      >
        Happened
      </button>
      <button
        type="submit"
        name="happened"
        value="no"
        className="rounded-control border border-hairline px-2 py-0.5 font-ui text-2xs uppercase tracking-[0.05em] text-ink hover:border-accent"
      >
        Did not
      </button>
      {state.ok === false && state.error ? <span className="font-ui text-2xs text-down">{state.error}</span> : null}
    </form>
  );
}
