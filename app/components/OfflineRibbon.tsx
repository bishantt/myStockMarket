"use client";

import { useEffect, useState } from "react";

import { copy, fill } from "@/lib/copy";

/**
 * OfflineRibbon — the honest offline state (plan §5.3, §5.2, Appendix J offline.ribbon).
 *
 * Offline is a first-class state, not an apology. When the browser goes offline, this quiet band
 * says so and names the vintage of what is on screen — the last synced briefing — so stale data
 * self-identifies rather than masquerading as live. Every module already carries its own "as of"
 * timestamp; this is the one plain sentence that ties them together.
 *
 * It mounts on the primary signal from §5.2: `navigator.onLine === false`, kept current with the
 * online/offline events. It is one of only two things in the app allowed to announce itself
 * (aria-live), the other being a form error (§3.9). No motion, no colour — a hairline band in ink.
 */
export function OfflineRibbon({ syncedDate }: { syncedDate: string }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-y border-hairline bg-surface px-1 py-2 font-ui text-sm text-ink-2"
    >
      {fill(copy.offline.ribbon, { date: syncedDate })}
    </div>
  );
}
