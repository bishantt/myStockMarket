import { cache } from "react";

import { createGlossaryRegistry, lookupTerm } from "@/lib/glossary";
import { GlossaryPopover } from "./GlossaryPopover";

/**
 * GlossaryTerm — wraps a term in the Desk's prose and decorates it as a glossary popover, but only
 * on its FIRST occurrence in a view (plan §3.5, P5 step 3).
 *
 * The first-occurrence discipline lives in a per-request registry: React `cache` scopes one registry
 * to each server render, so the same term mentioned five times on the Desk is dotted once. An unknown
 * key (or a later repeat) renders as plain text — the term still reads, it simply carries no doorway.
 *
 * A server component: the registry decision happens during render; only the small popover it may emit
 * is a client island.
 */

// One glossary registry per request. cache() memoises the call for the lifetime of a single render.
const requestRegistry = cache(() => createGlossaryRegistry());

export function GlossaryTerm({ term, children }: { term: string; children?: React.ReactNode }) {
  const entry = lookupTerm(term);
  const label = children ?? entry?.term ?? term;

  // Unknown term, or not its first appearance this view → plain text, no doorway.
  if (!entry || !requestRegistry().firstOccurrence(term)) {
    return <>{label}</>;
  }

  return (
    <GlossaryPopover entry={entry} termKey={term}>
      {label}
    </GlossaryPopover>
  );
}
