"use client";

import { useSearchParams } from "next/navigation";

import { PaperEntryForm } from "@/components/desk/PaperEntryForm";

/**
 * PaperEntryIsland — the one dynamic thing on an otherwise cached page (§5.3 P-1, P-4).
 *
 * /paper is served from the cache now, and a page cannot be prerendered if the SERVER reads the
 * request's query string. But the ticket genuinely needs two query parameters: `?symbol=` prefills
 * the form when you arrive from a setup card, and `?signalViewedAt=` is what arms the cooling-off
 * interstitial — the timestamp saying "you looked at a fired signal N minutes ago".
 *
 * So the read moves to the client. The page's shell is built once, at build time, and this island
 * hydrates with the actual URL. Nothing about the cooling-off mechanic changes: it was already
 * computed on the client, and it still is — only the source of the strings moved, from a server
 * prop to the browser's own address bar.
 *
 * The pattern is not new here. /login has done exactly this since it was written, for exactly this
 * reason, and its comment says so.
 */
export function PaperEntryIsland() {
  const searchParams = useSearchParams();

  return (
    <PaperEntryForm
      defaultSymbol={searchParams.get("symbol") ?? ""}
      signalViewedAt={searchParams.get("signalViewedAt")}
    />
  );
}
