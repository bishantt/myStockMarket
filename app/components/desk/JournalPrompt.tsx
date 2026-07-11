"use client";

import { useActionState, useEffect, useRef } from "react";

import { writeJournalEntry, type JournalResult } from "@/app/(desk)/journal-actions";
import { JOURNAL_PROMPT } from "@/lib/journal";

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
        <span className="max-w-[62ch] font-prose text-base italic text-ink-2">{JOURNAL_PROMPT}</span>
        <textarea
          name="body"
          required
          rows={4}
          maxLength={4000}
          placeholder="A few honest words about today."
          className="max-w-[62ch] rounded-edge border border-hairline bg-surface px-3 py-2 font-prose text-base text-ink placeholder:text-muted"
        />
      </label>

      {/* An optional forecast — a call, a probability, and when it resolves. Scored on /track-record. */}
      <details className="max-w-[62ch]">
        <summary className="cursor-pointer font-ui text-2xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
          Add a forecast (optional)
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <input
            name="forecast"
            maxLength={500}
            placeholder="The call you are making, e.g. this setup resolves higher."
            className="rounded-edge border border-hairline bg-surface px-3 py-2 font-prose text-base text-ink placeholder:text-muted"
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Probability %</span>
              <input
                name="probability"
                type="number"
                min="1"
                max="99"
                className="w-24 rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Resolves on</span>
              <input
                name="resolvesOn"
                type="date"
                className="rounded-edge border border-hairline bg-surface px-2 py-1 font-mono text-sm text-ink"
              />
            </label>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-edge border border-ink bg-ink px-4 py-2 font-ui text-xs font-medium uppercase tracking-[0.06em] text-surface disabled:opacity-60"
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
