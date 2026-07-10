import { SignJWT, jwtVerify } from "jose";

/**
 * auth.ts — the single-user login wall (plan §4.4, declared deviation #1 from Blueprint §7.1).
 *
 * Why a cookie session rather than the Blueprint's HTTP Basic Auth: an installed, standalone
 * PWA with a service worker interacts badly with Basic-Auth 401 challenges — re-prompt loops,
 * failed SW fetches, an ugly install experience. The Blueprint itself names a single-credential
 * login as the eventual step-up; this ships it at P0, hand-rolled rather than via Auth.js,
 * because one user with one credential does not justify a framework dependency.
 *
 * What the wall is actually for: data licensing (§1.5, rule 15). Every provider's free tier is
 * personal-use, so no data page may ever be public — including preview deployments. It is not
 * protecting a social graph, but a forged cookie must still be impossible rather than merely
 * inconvenient, which is why the token is signed and verified, never just decoded.
 *
 * The password itself never exists in this repo. The user chooses it once, at Session-0;
 * scripts/hash-password.mjs turns it into a bcrypt hash at cost 12; only the hash is stored,
 * in AUTH_PASS_HASH, and the plaintext is discarded.
 */

/**
 * The session cookie's name. The proxy reads it on every request and the logout action clears
 * it, so it is pinned by a test — a silent rename would log the user out permanently while
 * looking, from the code, entirely correct.
 */
export const SESSION_COOKIE_NAME = "msm_session";

/** How long a session lives. An idle month lands the user back on /login. */
export const SESSION_TTL_DAYS = 30;

/**
 * Sliding renewal: the proxy re-issues the cookie once fewer than this many days of validity
 * remain. With a 30-day life and a 23-day threshold, anyone who opens the app even once a week
 * never meets a hard expiry, while a genuinely dormant session still ages out.
 */
export const RENEW_WHEN_DAYS_REMAINING = 23;

const SECONDS_PER_DAY = 24 * 60 * 60;

/** What we put in the token. Deliberately nothing but the username and the standard claims. */
export type SessionPayload = {
  username: string;
  /** Expiry, as seconds since the epoch (the JWT `exp` claim). */
  exp: number;
};

/**
 * Reads and validates the signing secret at call time rather than at module load.
 *
 * Call time matters: reading it at import would make the module unusable in any context where
 * the env is populated later, and would move a configuration failure from a clear error
 * message to an obscure import-time crash.
 *
 * An absent secret throws. It must never fall back to a default — a well-known signing key is
 * the same as no signature at all.
 */
function signingKey(): Uint8Array {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_COOKIE_SECRET is not set. Generate one with `openssl rand -hex 32` and place it " +
        "per DEVELOPMENT-PLAN.md Appendix D. Refusing to sign a session with an empty key.",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Issues a signed session token for the given username.
 *
 * HS256 with a 32-byte secret. The token is placed in an httpOnly, Secure, SameSite=Lax cookie
 * by the caller — httpOnly so no script can read it, SameSite=Lax so it survives the top-level
 * navigation that opens the installed PWA.
 */
export async function createSessionToken(username: string): Promise<string> {
  const key = signingKey();
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_DAYS * SECONDS_PER_DAY)
    .sign(key);
}

/**
 * Verifies a session token's signature and expiry.
 *
 * Returns the payload on success and `null` on any failure whatsoever — bad signature, expired,
 * malformed, wrong algorithm, missing secret. Callers get one bit of information, which is all
 * they need and all they should have: this request is authenticated, or it is not.
 *
 * `algorithms` is pinned explicitly. Without it, a token declaring `"alg": "none"` would be a
 * classic forgery path.
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.username !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return { username: payload.username, exp: payload.exp };
  } catch {
    // Every failure mode collapses to "not authenticated". We deliberately do not distinguish
    // an expired token from a forged one to the caller.
    return null;
  }
}

/**
 * True when the session is close enough to expiry that the proxy should mint a fresh cookie.
 *
 * Called on every authenticated request, so it must be cheap and must not renew constantly:
 * re-issuing a Set-Cookie header on every page view is wasteful and makes the cookie's real
 * lifetime unbounded.
 */
export function shouldRenewSession(payload: SessionPayload): boolean {
  const secondsRemaining = payload.exp - Math.floor(Date.now() / 1000);
  return secondsRemaining < RENEW_WHEN_DAYS_REMAINING * SECONDS_PER_DAY;
}
