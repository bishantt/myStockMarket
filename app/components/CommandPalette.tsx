"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Search } from "lucide-react";

import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { searchPalette, type PaletteItem, type PaletteKind } from "@/lib/palette";

/**
 * CommandPalette — jump to any route, lesson, or ticker with ⌘K (plan §7 P6 step 5).
 *
 * Opens on ⌘K / Ctrl-K, filters the index as you type, and each result is zone-badged (Desk or
 * Academy) so you always know which room you are jumping into. Arrow keys move, Enter navigates,
 * Escape closes.
 *
 * The results are GROUPED — Rooms, then Tickers, then Lessons, always in that order. A palette is
 * the fastest map of a product anyone ever reads, so it may as well teach the shape of the thing.
 * The order is fixed rather than clever: a palette whose layout shifts under you is one you stop
 * trusting, and trust is the only reason to use it over the nav.
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

  // The results, grouped and labelled — the palette teaches the product's map. Rooms first, then
  // tickers, then lessons: the fixed order matters more than any cleverness about recency, because
  // a palette whose layout shifts under you is a palette you stop trusting.
  const groups: Array<{ heading: string; kind: PaletteKind }> = [
    { heading: "Rooms", kind: "route" },
    { heading: "Tickers", kind: "ticker" },
    { heading: "Lessons", kind: "lesson" },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-[12vh]"
      style={{ background: "var(--scrim)" }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="surface-overlay z-50 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder={copy.palette.placeholder}
            aria-label="Search"
            className="w-full bg-transparent py-3 font-ui text-input-touch text-ink placeholder:text-faint focus:outline-none md:text-sm"
          />
        </div>

        {/*
         * The panel caps its height to the VISUAL viewport, not the layout one. On iOS the soft
         * keyboard covers the layout viewport without shrinking it, so a panel sized to `vh` would
         * put its lowest rows underneath the keyboard — exactly where the reader is typing toward.
         */}
        <ul className="max-h-[min(60vh,calc(var(--visual-vh,100vh)-22vh))] overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-3 font-ui text-sm text-muted">No matches.</li>
          ) : (
            groups.map((group) => {
              const items = results.filter((r) => r.kind === group.kind);
              if (items.length === 0) return null;

              return (
                <li key={group.kind}>
                  <p className="px-4 pb-1 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                    {group.heading}
                  </p>
                  <ul>
                    {items.map((item) => {
                      const index = results.indexOf(item);
                      return (
                        <li key={`${item.href}-${item.label}`}>
                          <button
                            type="button"
                            onMouseEnter={() => setActive(index)}
                            onClick={() => go(item)}
                            aria-current={index === active}
                            className={cx(
                              "flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left",
                              "transition-colors duration-(--duration-quick) ease-(--ease-quiet)",
                              index === active ? "bg-accent-soft" : "",
                            )}
                          >
                            <span
                              className={cx(
                                "truncate",
                                item.kind === "ticker"
                                  ? "font-mono text-sm text-ink"
                                  : "font-ui text-sm text-ink",
                              )}
                            >
                              {item.label}
                            </span>
                            <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.06em] text-muted">
                              {item.zone}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
