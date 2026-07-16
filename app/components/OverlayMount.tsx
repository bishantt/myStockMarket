"use client";

import dynamic from "next/dynamic";

/**
 * OverlayMount — the client boundary that lazily loads the detail sheet (PD9, plan 11.4).
 *
 * `/news` is the tightest route in the app: 197.4 KB against a HARD 200 KB ceiling that does not
 * move ("Ship less JavaScript"). The detail sheet drags in Radix Dialog and the overlay chrome, and
 * that weight must NOT land in the shared chunk `/news` and `/` carry. So DetailOverlay loads behind
 * a `next/dynamic` boundary — a separate chunk fetched when the reader first opens a sheet, never
 * part of any room's first load. The intercepting @modal pages render this tiny wrapper; the heavy
 * chrome arrives on demand. `check:bundles` proves `/news` stayed under the ceiling.
 *
 * The `children` are the server-rendered page body (StoryPageBody / TickerPageBody); they pass
 * straight through this client boundary as already-rendered React nodes, so the body is still a
 * Server Component doing its own data reads — only the sheet CHROME is client and code-split.
 */

const DetailOverlay = dynamic(() =>
  import("./DetailOverlay").then((mod) => mod.DetailOverlay),
);

export function OverlayMount({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  /** Controlled mode — forwarded to DetailOverlay (the control-room table opens its sheet this way). */
  onClose?: () => void;
}) {
  return (
    <DetailOverlay title={title} onClose={onClose}>
      {children}
    </DetailOverlay>
  );
}
