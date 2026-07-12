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
 * Editorial, not a SaaS card. No logo lockup, no "Welcome back!". The submit button carries the
 * brand gradient — one of exactly two places in the app allowed to (§4.1) — and every input renders
 * at 16px on touch, because iOS zooms on any focused control under 16px and never zooms back out.
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
        className="mt-1 min-h-11 rounded-control bg-[image:var(--gradient-brand)] px-4 py-2.5 font-ui text-sm font-medium text-on-brand transition-[filter] duration-(--duration-quick) ease-(--ease-quiet) hover:brightness-105 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

/**
 * A labelled input.
 *
 * `text-input-touch` (16px) below `md` is not a style choice. iOS zooms the viewport in on any
 * focused input smaller than 16px and does not zoom back out afterwards, which leaves the reader
 * stranded at 1.3x on a page they now have to pan around. The fix is the font size, not a
 * maximum-scale lock — pinch-zoom is an accessibility right (§7.1).
 */
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
        className="min-h-11 rounded-control border border-hairline bg-surface px-3 py-2 font-mono text-input-touch text-ink md:text-sm"
      />
    </label>
  );
}
