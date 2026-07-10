"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

/**
 * The login form.
 *
 * A client component for one reason: it needs `useActionState` to show the error the server
 * action returns, and `useSearchParams` to carry the `next` destination through. The page
 * around it stays static (see page.tsx) so the service worker has a concrete HTML asset to
 * precache — which is what lets a user with an expired cookie reach a login screen offline.
 *
 * Editorial, not a SaaS card: a hairline box, 2px corners, ink and bone. No shadow, no logo
 * lockup, no "Welcome back!".
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <Field label="Username" name="username" type="text" autoComplete="username" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />

      {/*
       * The error is announced politely — this and the offline ribbon are the only two things
       * in the whole app permitted to announce themselves (plan §3.9).
       */}
      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          data-testid="login-error"
          className="font-ui text-sm text-down-text"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-edge border border-ink bg-ink px-4 py-2 font-ui text-xs font-medium uppercase tracking-[0.06em] text-surface disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

/** A labelled input. Hairline box, 2px radius, petrol focus ring from the global style. */
function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: "text" | "password";
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="rounded-edge border border-hairline bg-surface px-3 py-2 font-mono text-sm text-ink"
      />
    </label>
  );
}
