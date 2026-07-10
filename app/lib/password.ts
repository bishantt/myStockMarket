import { compare } from "bcryptjs";

/**
 * password.ts — bcrypt verification, kept deliberately apart from lib/auth.ts.
 *
 * The split is not tidiness. proxy.ts runs on every single request and imports lib/auth.ts to
 * check the session cookie; it has no business hashing passwords. Were `compare` to live in
 * auth.ts, bcryptjs would be bundled into the proxy and executed on every page view for nothing.
 *
 * Password checking happens in exactly one place: the /login server action, once per login.
 */

/**
 * Checks a plaintext password against the stored bcrypt hash from AUTH_PASS_HASH.
 *
 * Fails closed. A malformed or empty hash — a misconfigured environment — returns false rather
 * than throwing, because a thrown error surfaces as a 500 while a wrong password surfaces as a
 * 401, and that difference hands an attacker a way to probe the configuration.
 *
 * bcrypt's comparison is already constant-time with respect to the stored hash. The login
 * action adds a fixed delay on top, so a wrong username and a wrong password consume the same
 * wall-clock time and neither can be distinguished by measurement.
 */
export async function verifyPassword(
  plaintext: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash || !plaintext) return false;

  try {
    return await compare(plaintext, storedHash);
  } catch {
    return false;
  }
}
