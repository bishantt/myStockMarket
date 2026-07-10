"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  createSessionToken,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

/**
 * The login and logout server actions.
 *
 * There is one user and one credential. The defences here are sized for that reality and are
 * honest about their limits (plan §4.4):
 *
 *   - A fixed ~1s delay on every failed attempt. This is the primary brake, and it applies to a
 *     wrong username and a wrong password identically, so neither can be distinguished by
 *     timing and neither can be tried quickly.
 *   - A best-effort in-memory counter, 10 failures an hour. "Best effort" is the honest word:
 *     serverless instances do not share memory, so an attacker hitting several cold instances
 *     sees several counters. For a single-user app behind an unguessable username that is an
 *     acceptable trade, and pretending otherwise would be worse than saying so.
 */

/** Validated at the boundary. Never trust a form body. */
const LoginInput = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
  /** Where the proxy wanted to send the user before it bounced them here. */
  next: z.string().optional(),
});

const FAILED_ATTEMPT_DELAY_MS = 1000;
const MAX_FAILURES_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * The best-effort failure counter, scoped to one server instance's lifetime. See the caveat in
 * the file comment: this is a speed bump, not a lock.
 */
const failures: number[] = [];

function recentFailureCount(): number {
  const cutoff = Date.now() - ONE_HOUR_MS;
  // Drop anything older than the window, in place, so the array cannot grow without bound.
  while (failures.length > 0 && failures[0] < cutoff) failures.shift();
  return failures.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `next` decides where the user lands after logging in, and it arrives from the query string,
 * so it is attacker-controlled. Only same-origin absolute paths are allowed: anything starting
 * with `//` or containing a scheme could redirect the user to another site while looking, in
 * the address bar, as though our login sent them there.
 */
function safeRedirectTarget(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export type LoginState = { error: string | null };

/**
 * Verifies the credential and, on success, issues the session cookie.
 *
 * The error message never says which half was wrong. "Incorrect username or password" is the
 * whole vocabulary — a more helpful message is a more helpful oracle.
 */
export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginInput.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    await sleep(FAILED_ATTEMPT_DELAY_MS);
    return { error: "Incorrect username or password." };
  }

  if (recentFailureCount() >= MAX_FAILURES_PER_HOUR) {
    await sleep(FAILED_ATTEMPT_DELAY_MS);
    return { error: "Too many attempts. Wait an hour, then try again." };
  }

  const expectedUser = process.env.AUTH_USER;
  const expectedHash = process.env.AUTH_PASS_HASH;

  if (!expectedUser || !expectedHash) {
    // A misconfigured deployment must refuse everyone, loudly in the log and opaquely to the
    // browser. It must never fall open.
    console.error("AUTH_USER or AUTH_PASS_HASH is not set; refusing all logins.");
    await sleep(FAILED_ATTEMPT_DELAY_MS);
    return { error: "Login is unavailable. Check the server configuration." };
  }

  // Always run the bcrypt comparison, even when the username is wrong, so that a wrong username
  // and a wrong password take the same time. Short-circuiting here would leak which one failed.
  const passwordOk = await verifyPassword(parsed.data.password, expectedHash);
  const usernameOk = parsed.data.username === expectedUser;

  if (!usernameOk || !passwordOk) {
    failures.push(Date.now());
    await sleep(FAILED_ATTEMPT_DELAY_MS);
    return { error: "Incorrect username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(expectedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });

  redirect(safeRedirectTarget(parsed.data.next));
}

/**
 * Clears the session and returns the user to /login.
 *
 * The service worker's caches are purged on the client, by the logout button, once this action
 * resolves (plan §5.2). Clearing the cookie alone would leave the last briefing sitting in the
 * `morning-v1` cache, readable offline by whoever holds the phone.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
