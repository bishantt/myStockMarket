import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { AppWash } from "@/components/AppWash";
import { BrandMark } from "@/components/BrandMark";
import { copy } from "@/lib/copy";

/**
 * /login — the first thing anyone sees, and the only public page in the app.
 *
 * `force-static` is deliberate and load-bearing (plan §4.5, §5.2). The service worker precaches
 * this route by URL, which requires a concrete HTML asset to exist at build time. It matters more
 * than it sounds: when a 30-day-old cookie finally expires and the reader is on a train with no
 * signal, this is the page they reach. A dynamically rendered /login would leave them staring at
 * the offline fallback with no way back in once signal returned.
 *
 * That constraint shapes the design. Every bit of decoration here is CSS — the brand gradient, the
 * ruled-paper overlay, the wash. No images, nothing fetched, nothing server-computed. And the theme
 * arrives via the root layout's pre-paint script rather than a server cookie read, which is exactly
 * why that script exists (§7.3): a `cookies()` call in the root layout would make this page dynamic
 * and quietly break the whole offline story.
 *
 * The service worker also registers here, pre-authentication, so update checks keep running while
 * logged out (§5.5.1).
 */
export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <>
      <AppWash />

      <main className="relative z-10 grid min-h-dvh lg:grid-cols-2">
        <BrandPanel />

        <div className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-[400px]">
            {/*
             * THE MARK, ON A PHONE (PD4). The brand panel beside this column is `hidden lg:flex`, and
             * until now the mark went out with it — so the first page anyone ever opened, on the
             * device most people open it on, showed this product's name in text and nothing of its
             * face. The panel is still the right thing to collapse; the identity was not.
             *
             * It is `aria-hidden` in effect (BrandMark's alt defaults to ""), because the headline and
             * the wordmark below say "myStockMarket" in text already. Announcing it a third time is
             * noise, not access.
             */}
            <BrandMark size="panelPhone" className="mb-4 lg:hidden" />

            {/* On a phone the brand panel collapses, and the headline comes with it — once. */}
            <h1 className="pb-3 font-display text-display font-bold text-ink lg:hidden">
              Your personal <em className="font-normal italic">broadsheet</em> for the market.
            </h1>

            <p className="max-w-[42ch] pb-8 font-ui text-sm text-muted">{copy.login.wall}</p>

            {/*
             * useSearchParams() suspends during prerendering. This boundary is what keeps the page
             * static: the shell builds once, and the form hydrates with the `next` param on the
             * client.
             */}
            <Suspense fallback={<div className="h-[280px]" aria-hidden="true" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * The brand panel — one of exactly two places allowed to use `--gradient-brand`.
 *
 * It carries the product's actual argument, in the product's actual voice: not a prediction oracle,
 * not a signal feed, a record of what happened — including the misses. If the first sentence a
 * reader ever saw over-promised, everything after it would be an apology.
 *
 * Hidden below `lg`. A 375px screen has room for a headline and a form, and that is all it needs.
 */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[image:var(--gradient-brand)] lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* The ruled-paper grid — a ledger's lines, at 6% white. Pure CSS; the page stays static. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-brand-grid)]"
      />

      <div className="relative flex items-center gap-2.5">
        <BrandMark size="inline" />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-on-brand">
          myStockMarket
        </span>
      </div>

      <div className="relative">
        {/*
         * The mark, at the size it is meant to be seen (PD2, plan 5.5). This is the one surface in
         * the product where the identity is allowed to be large, and it is the first thing anyone
         * ever sees of this app — the OG card echoes this exact composition on purpose, so a link
         * previewed in Slack and the page it opens read as the same product.
         *
         * The wordmark BELOW stays type, not an image: it is part of the headline's typography.
         */}
        <BrandMark size="panel" className="mb-6" />
        <h1 className="max-w-[16ch] font-display text-display-hero font-bold text-on-brand">
          Your personal <em className="font-normal italic">broadsheet</em> for the market.
        </h1>
        <p className="max-w-[48ch] pt-6 font-ui text-base text-on-brand-soft">
          {copy.login.subline}
        </p>
      </div>

      <blockquote className="relative max-w-[44ch] border-l border-on-brand-rule pl-4">
        <p className="font-prose text-base italic text-on-brand-soft">{copy.login.quote}</p>
        <footer className="pt-2 font-mono text-2xs uppercase tracking-[0.08em] text-on-brand-soft">
          {copy.login.quoteAttribution}
        </footer>
      </blockquote>
    </aside>
  );
}
