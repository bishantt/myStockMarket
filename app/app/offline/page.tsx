import { SectionMasthead } from "@/components/SectionMasthead";

/**
 * /offline — the fallback the service worker serves when a navigation fails and nothing is
 * cached (plan §5.2).
 *
 * `force-static` is mandatory, exactly as it is for /login: the SW precaches this route by URL,
 * which needs a concrete HTML file to exist at build time. It also means this page can render
 * with no network and no database — it must, because it is the page of last resort.
 *
 * Tone matters here. Offline is a first-class, honest state, not an apology (plan §5.3). The
 * copy states plainly what happened and what the user can still do; it does not fret. Most of
 * the time the user will not see this page at all — a Desk they have already visited is served
 * from cache with its own "as of" timestamp. This shows only when there is genuinely nothing
 * cached to fall back to.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[62ch] flex-col justify-center px-5 py-16">
      <SectionMasthead index={0} title="Offline" />
      <div className="pt-5">
        <p className="font-prose text-prose text-ink">
          You are offline, and this view has not been saved for offline reading yet.
        </p>
        <p className="pt-3 font-prose text-prose text-ink-2">
          Open the Desk once while connected and it will be available here afterwards — the last
          synced briefing, with the time it was current clearly marked. Reconnect and reload to
          catch up.
        </p>
      </div>
    </main>
  );
}
