import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

/**
 * /login — the editorial login card, and the app's only public page that renders any chrome.
 *
 * `force-static` is deliberate and load-bearing (plan §4.5, §5.2). The service worker
 * precaches this route by URL, which requires a concrete HTML asset to exist at build time. It
 * matters more than it sounds: when a 30-day-old cookie finally expires and the user is on a
 * train with no signal, this is the page they reach. A dynamically rendered /login would leave
 * them staring at the offline fallback with no way to sign back in once signal returned.
 *
 * The service worker also registers on this page, pre-authentication, so update checks keep
 * running even while logged out (§5.5.1).
 */
export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5">
      <div className="w-full max-w-[380px]">
        <header className="pb-6">
          <h1 className="font-ui text-sm font-bold uppercase tracking-[0.08em] text-ink">
            myStockMarket
          </h1>
          <div className="mt-3 h-0.5 bg-ink" />
          <p className="pt-3 font-ui text-sm text-ink-2">
            This app stays behind a login because its market data is licensed for personal
            use only.
          </p>
        </header>

        {/*
         * useSearchParams() suspends during prerendering. The boundary is what lets the page
         * stay static: the shell is built once, and the form hydrates with the `next` param on
         * the client.
         */}
        <Suspense fallback={<div className="h-[232px]" aria-hidden="true" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
