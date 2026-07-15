import { SignJWT } from "jose";

/** Thirty days — the session length lib/auth issues, and what check:nav and lighthouse-check mint. */
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Mint a session cookie identical to lib/auth.createSessionToken, so a guard can walk past the login
 * wall — same secret, same HS256 shape, same `msm_session=` name. No caller ever logs the result.
 *
 * ttlSeconds defaults to thirty days (check:nav, lighthouse-check); check:live passes one hour,
 * because a probe cookie has no reason to outlive the run that mints it.
 */
export async function mintSessionCookie(
  secret,
  { username = process.env.AUTH_USER ?? "bishantt", ttlSeconds = THIRTY_DAYS_SECONDS } = {},
) {
  const key = new TextEncoder().encode(secret);
  const iat = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + ttlSeconds)
    .sign(key);
  return `msm_session=${token}`;
}
