"use client";

import { useActionState, useEffect, useRef } from "react";

import { addWatchlistItem, type ActionResult } from "./actions";

/**
 * The add-a-name form. A client component because it uses useActionState to show the server's
 * result — a duplicate, an unknown symbol, or a missing reason — and to clear itself on success.
 *
 * Editorial, not a SaaS card: hairline inputs, 2px corners, ink and bone, no shadow. The reason
 * field is required in the markup AND on the server (lib/watchlist), because the reason is the
 * point of the watchlist, not an optional note.
 */
export function AddWatchlistForm() {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(addWatchlistItem, { ok: true });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful add, so the next name starts from an empty form.
  useEffect(() => {
    if (state.ok && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1.5 sm:w-40">
          <span className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">Symbol</span>
          <input
            name="symbol"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={20}
            placeholder="AAPL"
            className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-mono text-input-touch md:text-sm uppercase text-ink placeholder:text-muted"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">
            Why you are watching it
          </span>
          <input
            name="reason"
            type="text"
            required
            maxLength={280}
            placeholder="Earnings next week — watching the reaction."
            className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-ui text-input-touch md:text-sm text-ink placeholder:text-muted"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control border border-ink bg-ink px-4 py-2 font-ui text-xs font-semibold uppercase tracking-[0.06em] text-surface disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" aria-live="polite" data-testid="add-error" className="font-ui text-sm text-down-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
