"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { searchPalette, type PaletteItem } from "@/lib/palette";

/**
 * CommandPalette — jump to any route, lesson, or ticker with ⌘K (plan §7 P6 step 5).
 *
 * Opens on ⌘K / Ctrl-K, filters the index as you type, and each result is zone-badged (Desk or
 * Academy) so you always know which room you are jumping into. Arrow keys move, Enter navigates,
 * Escape closes. Calm-tech: a hairline dialog over the one scrim the app allows, no animation.
 */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchPalette(items, query), [items, query]);

  // Global ⌘K / Ctrl-K toggles the palette. Resets happen here (in the handler), not in an effect.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((was) => !was);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus the input when the palette opens — a genuine side effect, no state set here.
  useEffect(() => {
    if (open) queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: "var(--scrim)" }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-lg rounded-panel border border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKey}
          placeholder="Jump to a page, lesson, or ticker…"
          aria-label="Search"
          className="w-full border-b border-hairline bg-transparent px-4 py-3 font-ui text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-3 font-ui text-sm text-muted">No matches.</li>
          ) : (
            results.map((item, index) => (
              <li key={`${item.href}-${item.label}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                  aria-current={index === active}
                  className={
                    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left " +
                    (index === active ? "bg-paper" : "")
                  }
                >
                  <span className="font-ui text-sm text-ink">{item.label}</span>
                  <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">{item.zone}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
