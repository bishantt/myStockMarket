"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import type { GlossaryEntry } from "@/lib/glossary";

/**
 * GlossaryPopover — the interactive glossary term (plan §3.5, P5 step 3).
 *
 * A term is set as inline text with a dotted underline. Hovering shows a one-line tip (the native
 * title, so it works without JavaScript and for assistive tech); clicking opens a small popover with
 * the full definition and, when a lesson teaches the term, a "Full lesson →" doorway into the
 * Academy. Calm-tech: no animation, a hairline box, ink on paper. Closes on Escape or an outside
 * click so a doorway is never a trap.
 */
export function GlossaryPopover({
  entry,
  children,
}: {
  entry: GlossaryEntry;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  // Close on Escape or a click outside the term — a popover must never trap the reader.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        title={entry.short}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
        className="cursor-help underline decoration-dotted decoration-muted underline-offset-2 hover:decoration-accent focus-visible:decoration-accent"
      >
        {children}
      </button>

      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={entry.term}
          className="absolute left-0 top-full z-20 mt-1 block w-72 rounded-edge border border-hairline bg-surface p-3 text-left shadow-none"
        >
          <span className="block font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-ink">
            {entry.term}
          </span>
          <span className="block max-w-[52ch] pt-1.5 font-prose text-sm text-ink-2">{entry.long}</span>
          {entry.lesson ? (
            <Link
              href={`/academy/${entry.lesson}`}
              className="mt-2 inline-block font-ui text-2xs uppercase tracking-[0.06em] text-accent hover:underline"
            >
              Full lesson →
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
