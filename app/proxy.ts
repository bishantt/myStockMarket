import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  createSessionToken,
  shouldRenewSession,
  verifySessionToken,
} from "@/lib/auth";

/**
 * proxy.ts — the login wall (plan §4.4). In Next.js 16 this file is what earlier versions
 * called `middleware.ts`; the rename is Next's, and the behaviour is unchanged.
 *
 * It runs before every request that the matcher below admits, and does three things:
 *
 *   1. Lets a small, explicit set of paths through unauthenticated.
 *   2. Turns an unauthenticated request away — as a 401 JSON body for /api/*, and as a
 *      redirect to /login for anything else.
 *   3. Slides the session forward when it is getting old, so daily use never hits a hard
 *      expiry while a dormant month still does.
 *
 * The 401-versus-redirect split is not cosmetic. The service worker must be able to tell "your
 * cookie expired" from "here is a page". If /api/morning answered an expired cookie with a 302
 * to /login, the SW would happily cache the login screen as this morning's briefing, and the
 * user would open the app offline to find their market data replaced by a password box. The
 * cacheWillUpdate guard in the SW (§5.2) is the second line of defence; this is the first.
 */

/**
 * Paths that never require the cookie.
 *
 * Every entry earns its place:
 *   /login                  obviously, or you could never authenticate
 *   /api/revalidate         gated by CRON_SECRET instead — the pipeline calls it, not a browser
 *   /manifest.webmanifest   the browser fetches it before any session exists, to offer install
 *   /sw.js                  same: the service worker registers on /login, pre-auth
 *   /offline                the offline fallback must render when nothing else can
 *   /_next/*                build assets; they carry no data
 *   icons + favicon        install UX needs them to resolve without a cookie (§5.5.1 asserts it)
 *
 * Note what is NOT here: every route that renders data stays behind the wall, including
 * /styleguide, because the licensing wall covers previews too (§1.5, rule 15).
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/offline",
  "/api/revalidate",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/apple-touch-icon.png",
  // "/mark.svg" was here until PD2 and is gone with the file. It was the old placeholder tile —
  // a gradient square with a letter "M" in it — and nothing rendered it: the real logo arrived,
  // scripts/brand-assets.mjs generates every icon from that master, and the tile retired. Its
  // glyph-only sibling (mark-glyph.svg) survives as the monochrome icon's source, but that is a
  // BUILD input, never fetched by a browser, so it needs no door through the wall.
]);

/**
 * Prefixes that are public. Kept separate from the exact-match set so the check stays cheap.
 *
 * `/fixtures/` joined the list in N5, and the reason is a genuine trap rather than a convenience.
 *
 * The image optimizer does not proxy the reader's request — it makes its OWN server-side fetch of
 * the source image, and that fetch carries no session cookie. So a same-origin image sitting behind
 * the login wall gets a 307 to /login, and the optimizer reports back "The requested resource isn't
 * a valid image" and serves a 400. Every photograph in the seeded room rendered as a broken-image
 * icon, while the generated fallback cards — which need no optimizer — rendered perfectly.
 *
 * Nothing is being exposed: these are the three generated placeholder JPEGs committed under
 * `public/fixtures/`, and they are the only same-origin images in the app. In production the news
 * images come from the media bucket (a remote origin the optimizer fetches directly, with no
 * middleware in the path at all), so this is a seed-and-test concern — which is to say it is a
 * VISUAL-REGRESSION concern, and the baselines are the app's eyes.
 *
 * The licensing wall is untouched. It exists to keep market DATA behind a login; a placeholder JPEG
 * that is already committed to this repository is not market data, and `/_next/` and `/icons/` have
 * been public since P1 for exactly the same structural reason.
 */
const PUBLIC_PREFIXES = ["/_next/", "/icons/", "/fixtures/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Writes the session cookie onto a response.
 *
 * httpOnly    no script can read it, so an XSS cannot exfiltrate the session.
 * secure      never sent over plain HTTP — relaxed on localhost, where there is no TLS.
 * sameSite    "lax" survives the top-level navigation that launches the installed PWA, while
 *             still refusing to ride along on cross-site POSTs.
 * path "/"    the whole app, including /api/morning, which the service worker fetches.
 */
function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (!session) {
    // An API caller gets a machine-readable refusal, never a redirect (see the note above).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    // A page request goes to /login, remembering where it was headed so the user lands back
    // where they meant to be rather than dumped on the Desk.
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  // Sliding renewal. Only when the session is genuinely ageing — re-issuing on every request
  // would make the cookie's real lifetime unbounded.
  if (shouldRenewSession(session)) {
    setSessionCookie(response, await createSessionToken(session.username));
  }

  return response;
}

/**
 * Which requests reach the proxy at all.
 *
 * We exclude the static-asset prefixes here as well as in isPublic(). The matcher keeps the
 * proxy from even running for build output — a real saving, since it executes on every request
 * — while isPublic() remains the authority on policy, so a matcher tweak can never accidentally
 * expose a data route.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
