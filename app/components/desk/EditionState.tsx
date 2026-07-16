"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { editionState, mastheadEdition, type EditionFacts, type EditionState } from "@/lib/edition-state";

/**
 * EditionState — the browser's answer to "which edition is the Desk greeting me with?" (CC9).
 *
 * THE CLOCK RUNS IN THE BROWSER, exactly as the pipeline strip's does and for the same reason. The Desk
 * is served from a cache; a render carries the clock it was made with. So the SERVER seeds the first
 * paint with its own instant (so hydration matches its HTML byte for byte, and check:live — which reads
 * the raw SSR HTML — sees the state production is actually in), and the moment this mounts it regrades
 * against the reader's real clock. On the healthy path the two agree and nothing moves; on a stale tab
 * or a cache served hours later, the masthead corrects itself rather than going on greeting a morning
 * that is long gone (R6). There is no timer: the edition changes only at boundaries that are server-data
 * events (a dawn stamps, a nightly publishes), so one correction on mount is the whole of it.
 *
 * The state is provided once and read by every consumer — the masthead, module 02, the calendar — so
 * they never disagree about the hour.
 */
const EditionContext = createContext<EditionState>("evening");

export function EditionStateProvider({
  facts,
  serverNow,
  children,
}: {
  facts: EditionFacts;
  /** The render clock, ISO, so the first client paint matches the server's HTML. */
  serverNow: string;
  children: ReactNode;
}) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock; see PipelineStrip
    setNow(new Date().toISOString());
  }, []);

  const state = editionState(facts, new Date(now));
  return <EditionContext.Provider value={state}>{children}</EditionContext.Provider>;
}

/** The current edition state, from the shared context. */
export function useEdition(): EditionState {
  return useContext(EditionContext);
}

/**
 * Render the `morning` node when the Desk wears the Morning masthead (morning or session), the `evening`
 * node otherwise. Both are server-rendered and passed as props, so both ride in the payload and the
 * switch flips between them with no round trip — and module 02's TermProse stays a server render, which
 * is the whole reason the switch takes nodes rather than being a client module itself. It adds no DOM of
 * its own (a fragment), so the chosen node stays a direct grid child and its `order-N` class still lands.
 */
export function EditionSwitch({ morning, evening }: { morning: ReactNode; evening: ReactNode }) {
  return <>{mastheadEdition(useEdition()) === "morning" ? morning : evening}</>;
}
