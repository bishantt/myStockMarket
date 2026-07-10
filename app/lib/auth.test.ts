// @vitest-environment node
//
// Auth runs on the server — in the proxy and in a server action — never in a browser. It must
// be tested there too. Under jsdom, `TextEncoder` produces a Uint8Array from a different realm,
// so jose's `instanceof Uint8Array` check rejects it and every signing test fails with a
// misleading "payload must be an instance of Uint8Array". The default jsdom environment is set
// in vitest.config.ts for component tests; this file opts out.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RENEW_WHEN_DAYS_REMAINING,
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  createSessionToken,
  shouldRenewSession,
  verifySessionToken,
} from "./auth";
import { verifyPassword } from "./password";

/**
 * Auth is on the plan's always-test-first list (§6.2): wrong password, tampered cookie,
 * protected-route redirect. The first two live here; the redirect is a proxy concern and is
 * asserted end-to-end in Playwright.
 *
 * This app has exactly one user and one credential, and it sits behind a login wall for data
 * licensing reasons (§1.5, rule 15) rather than to protect a social graph. That shapes the
 * threat model but does not soften it: a forged cookie must be impossible, not merely
 * inconvenient.
 */

const SECRET = "a".repeat(64); // 32 bytes of hex, the shape `openssl rand -hex 32` produces.

/**
 * A real bcrypt hash of "correct horse battery staple" at cost 12, generated once with
 * bcryptjs and frozen here. Cost 12 is what scripts/hash-password.mjs uses for the real
 * credential, so these tests exercise the same work factor the product ships with.
 */
const KNOWN_HASH = "$2b$12$7Tg8XWUVRBhEzHK6ZGKhke0LLIIxCLB5Pp8aX8r4NeifFRklIzZvW";

beforeEach(() => {
  vi.stubEnv("AUTH_COOKIE_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("session token", () => {
  it("round-trips the username through a signed token", async () => {
    const token = await createSessionToken("bishan");
    const payload = await verifySessionToken(token);
    expect(payload?.username).toBe("bishan");
  });

  it("rejects a token whose payload has been tampered with", async () => {
    const token = await createSessionToken("bishan");
    const [header, , signature] = token.split(".");

    // Re-encode a payload claiming to be someone else, keeping the original signature.
    const forgedPayload = Buffer.from(
      JSON.stringify({ username: "attacker", exp: 9999999999 }),
    )
      .toString("base64url")
      .replaceAll("=", "");
    const forged = `${header}.${forgedPayload}.${signature}`;

    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("bishan");
    vi.stubEnv("AUTH_COOKIE_SECRET", "b".repeat(64));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a token that is merely garbage", async () => {
    expect(await verifySessionToken("not-a-token")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const token = await createSessionToken("bishan");

    // One day past the 30-day life.
    vi.setSystemTime(new Date("2026-07-31T00:00:01Z"));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("still accepts a token on its final day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const token = await createSessionToken("bishan");

    vi.setSystemTime(new Date("2026-07-30T23:00:00Z"));
    expect((await verifySessionToken(token))?.username).toBe("bishan");
  });

  it("refuses to sign when the secret is absent, rather than signing with nothing", async () => {
    vi.stubEnv("AUTH_COOKIE_SECRET", "");
    await expect(createSessionToken("bishan")).rejects.toThrow(/AUTH_COOKIE_SECRET/);
  });
});

describe("sliding renewal", () => {
  /**
   * The cookie lasts 30 days and is re-issued once fewer than 23 days remain, so a user who
   * opens the app at all regularly never meets a hard expiry — but an idle month still lands
   * on /login (plan §4.4).
   */
  it("does not renew a freshly issued session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const payload = await verifySessionToken(await createSessionToken("bishan"));
    expect(shouldRenewSession(payload!)).toBe(false);
  });

  it("renews once fewer than 23 days of validity remain", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const token = await createSessionToken("bishan");

    // Day 6: 24 days left — not yet.
    vi.setSystemTime(new Date("2026-07-07T00:00:00Z"));
    expect(shouldRenewSession((await verifySessionToken(token))!)).toBe(false);

    // Day 8: 22 days left — renew.
    vi.setSystemTime(new Date("2026-07-09T00:00:00Z"));
    expect(shouldRenewSession((await verifySessionToken(token))!)).toBe(true);
  });

  it("keeps the renewal window inside the session lifetime", () => {
    // A renewal threshold at or above the TTL would renew on every single request; one at or
    // below zero would never renew at all. Both are silent failures, so pin the invariant.
    expect(RENEW_WHEN_DAYS_REMAINING).toBeGreaterThan(0);
    expect(RENEW_WHEN_DAYS_REMAINING).toBeLessThan(SESSION_TTL_DAYS);
  });
});

describe("password verification", () => {
  it("accepts the correct password", async () => {
    expect(await verifyPassword("correct horse battery staple", KNOWN_HASH)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyPassword("Correct horse battery staple", KNOWN_HASH)).toBe(false);
    expect(await verifyPassword("", KNOWN_HASH)).toBe(false);
    expect(await verifyPassword("correct horse battery stapl", KNOWN_HASH)).toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    // A misconfigured AUTH_PASS_HASH must fail closed — deny the login — not crash the route
    // in a way that could be distinguished from a wrong password.
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });
});

describe("the cookie name is stable", () => {
  it("does not change casually — the service worker and proxy both key off it", () => {
    expect(SESSION_COOKIE_NAME).toBe("msm_session");
  });
});
