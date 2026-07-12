"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cx } from "@/lib/cx";
import type { InstrumentHit } from "@/lib/instruments";

/**
 * Combobox — type a few letters, pick a ticker (APP-FEEL-PLAN §3.4).
 *
 * The `Instrument` table has held a name for every symbol since P1, and the paper ticket has been
 * asking the reader to type tickers from memory into a bare text box the entire time. This is the
 * WAI-ARIA combobox pattern, hand-built: there is no combobox in Radix, and this app adds no
 * dependency it can write in a hundred lines.
 *
 * THREE THINGS HERE ARE iOS FIXES, AND EACH ONE IS A BUG THAT WOULD OTHERWISE SHIP:
 *
 *  1. **Dismissal listens on `pointerdown`, not `click`.** iOS Safari does not synthesize a click
 *     event on non-interactive page regions, so the usual document-level click-outside listener
 *     simply never fires there — the listbox would stay open until you tabbed away. A
 *     pointerdown-on-listbox flag keeps an option tap from being eaten by the blur that races it.
 *  2. **Five rows, maximum.** The keyboard plus QuickType leave roughly 300–360px under a mid-page
 *     input. An eight-row list at 44px a row runs underneath the keyboard with no cue and nothing to
 *     scroll it into view; the reader sees three options and does not know the other five exist.
 *  3. **`autocapitalize="characters" autocorrect="off" spellcheck={false}`.** Left alone, iOS
 *     helpfully "corrects" SMCI into a word.
 *
 * Free typing stays legal. An unknown symbol is allowed on a paper ticket — it always has been, and
 * the zod boundary in the action still validates. This suggests; it does not gate.
 */

export type ComboboxProps = {
  name: string;
  label: string;
  defaultValue?: string;
  /** Debounced, min 1 char. Returns at most five hits. */
  search: (query: string) => Promise<InstrumentHit[]>;
  /** Told the chosen symbol, so a consumer can fetch its last close. */
  onSelect?: (symbol: string) => void;
};

const DEBOUNCE_MS = 150;

export function Combobox({ name, label, defaultValue = "", search, onSelect }: ComboboxProps) {
  const [value, setValue] = useState(defaultValue);
  const [hits, setHits] = useState<InstrumentHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  // True between pointerdown and click on an option: the input's blur must not close the listbox
  // out from under a tap that is already in flight.
  const pickingRef = useRef(false);

  // Debounced search. A keystroke per query would hammer the database for a five-row list.
  //
  // The empty-query case is handled INSIDE the timer rather than in the effect body: clearing the
  // hits synchronously as the effect runs would set state during render-commit and cascade an extra
  // render on every keystroke. Everything the effect does now happens on the timer, or not at all.
  useEffect(() => {
    const query = value.trim();
    const timer = setTimeout(async () => {
      if (query.length < 1) {
        setHits([]);
        return;
      }
      const found = await search(query);
      setHits(found);
      setActive(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, search]);

  // Tap outside → close. On `pointerdown`, because iOS never sends the click (see the file comment).
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  function choose(hit: InstrumentHit) {
    setValue(hit.symbol);
    setOpen(false);
    onSelect?.(hit.symbol);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault(); // Enter picks the option; it does not submit the ticket
      choose(hits[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      <label htmlFor={name} className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          value={value}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && hits.length > 0 ? `${listboxId}-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // A tap on an option fires pointerdown BEFORE this blur. Without the flag, the blur
            // would close the listbox and the option's click would land on nothing.
            if (!pickingRef.current) setOpen(false);
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full rounded-control border border-hairline bg-surface px-3 font-mono text-input-touch uppercase text-ink"
        />

        {open && hits.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            // Below the input, always. A list anchored above it fights the iOS keyboard for the same
            // pixels. Capped so the whole list fits in the space the keyboard leaves.
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[min(40dvh,220px)] overflow-y-auto overscroll-contain rounded-card border border-hairline bg-surface-solid shadow-panel"
            onPointerDown={() => {
              pickingRef.current = true;
            }}
          >
            {hits.map((hit, index) => (
              <li
                key={hit.symbol}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === active}
                onPointerDown={() => {
                  pickingRef.current = true;
                }}
                onClick={() => {
                  pickingRef.current = false;
                  choose(hit);
                }}
                onMouseEnter={() => setActive(index)}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 touch-manipulation",
                  index === active && "bg-accent-soft",
                )}
              >
                <span className="font-mono text-sm text-ink">{hit.symbol}</span>
                <span className="truncate font-ui text-2xs text-muted">{hit.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
