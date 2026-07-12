"use client";

import { useActionState, useEffect, useRef } from "react";
import { JOURNAL_PROMPT } from "@/lib/journal";

import { writeJournalEntry, type JournalResult } from "@/app/(desk)/journal-actions";

/**
 * JournalPrompt — the evening journal entry (plan P3 step 4, §9.2 the PM ritual).
 *
 * A client component because it uses useActionState to show the save result and to clear itself on
 * success. The prompt is fixed and mechanical; the textarea is the reflection. Editorial, not a
 * SaaS card: a hairline box, ink and bone, no shadow. Interactive writes disable while saving.
 */
export function JournalPrompt() {
  const [state, formAction, pending] = useActionState<JournalResult, FormData>(writeJournalEntry, { ok: true });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea after a saved entry, so the evening's next thought starts fresh.
  useEffect(() => {
    if (state.ok && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 pt-4">
      <label className="flex flex-col gap-2">
        {/*
         * The prompt still labels the textarea — it is just not PRINTED here any more, because the
         * disclosure's summary row above now carries it in full. Deleting the span outright would
         * have left the textarea with no accessible name at all: a screen reader would announce an
         * unlabelled edit box at the bottom of the evening ritual.
         */}
        <span className="sr-only">{JOURNAL_PROMPT}</span>
        <textarea
          name="body"
          required
          rows={4}
          maxLength={4000}
          placeholder="A few honest words about today."
          className="min-h-11 max-w-[62ch] rounded-control border border-hairline bg-surface px-3 py-2 font-prose text-base text-ink placeholder:text-muted text-input-touch md:text-sm"
        />
      </label>

      {/* An optional forecast — a call, a probability, and when it resolves. Scored on /track-record. */}
      <details className="max-w-[62ch]">
        <summary className="flex min-h-11 cursor-pointer items-center font-ui text-2xs uppercase tracking-[0.06em] text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep">
          Add a forecast (optional)
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <input
            name="forecast"
            maxLength={500}
            placeholder="The call you are making, e.g. this setup resolves higher."
            className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-prose text-base text-ink placeholder:text-muted text-input-touch md:text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Probability %</span>
              <input
                name="probability"
                type="number"
                min="1"
                max="99"
                className="min-h-11 w-24 rounded-control border border-hairline bg-surface px-2 py-1 font-mono text-input-touch md:text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Resolves on</span>
              <input
                name="resolvesOn"
                type="date"
                className="min-h-11 rounded-control border border-hairline bg-surface px-2 py-1 font-mono text-input-touch md:text-sm text-ink"
              />
            </label>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-control border border-ink bg-ink px-4 py-2 font-ui text-xs font-semibold uppercase tracking-[0.06em] text-surface disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save entry"}
        </button>
        {state.ok && !state.error && !pending ? (
          <span aria-live="polite" className="font-ui text-2xs text-muted" data-testid="journal-saved">
            Saved.
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" aria-live="polite" data-testid="journal-error" className="font-ui text-sm text-down-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
