"use client";

import { useMemo, useState } from "react";

import { NewsCard } from "@/components/news/NewsCard";
import { RangeControl } from "@/components/RangeControl";
import { Surface } from "@/components/Surface";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { signedPercent } from "@/lib/format";
import {
  type NewsCard as Card,
  type NewsFilters,
  type NewsRange,
  type NoStoryMover,
  activeCatalystChips,
  activeSectorChips,
  countLine,
  filterCards,
  inRange,
  leadAndRest,
  noStoryMovers,
  zeroStateLine,
} from "@/lib/news";

/**
 * NewsFeed — the Front Page's interactive half (plan 7.7).
 *
 * The whole week's clusters are handed down in the initial payload and sliced here. That is why the
 * range control needs no loading state and why filtering is instant: nothing this component does
 * touches the network. It also means the filters CANNOT change the ranking — they remove rows from
 * a list the pipeline already ordered, and there is no code path in which a reader's choice
 * re-scores a story.
 *
 * FILTERING IS SUBTRACTION, NEVER SORTING. It would be one line to "float the matching stories to
 * the top", and it would quietly turn the reader's attention into an editorial signal — the exact
 * thing ruling C1 forbids. The order is the pipeline's, always, and a filtered page states what it
 * is hiding in its own count line.
 */

const PAGE_SIZE = 20;

type NewsFeedProps = {
  cards: Card[];
  movers: NoStoryMover[];
  /** The session the page was assembled for — what "Today" means, from the data, not the clock. */
  sessionDate: string;
  /** True when the archive does not yet span a week, so "This week" would over-promise. */
  weekIncomplete: boolean;
};

export function NewsFeed({ cards, movers, sessionDate, weekIncomplete }: NewsFeedProps) {
  const [range, setRange] = useState<NewsRange>("today");
  const [filters, setFilters] = useState<NewsFilters>({ types: [], sectors: [] });
  const [page, setPage] = useState(1);

  const session = useMemo(() => new Date(sessionDate), [sessionDate]);

  const inWindow = useMemo(
    () => cards.filter((card) => inRange(card, range, session)),
    [cards, range, session],
  );
  const shown = useMemo(() => filterCards(inWindow, filters), [inWindow, filters]);

  // The chips are derived from the window, not from the filtered result — otherwise selecting one
  // chip would erase every other chip and the reader would be locked inside their own filter.
  const catalystChips = useMemo(() => activeCatalystChips(inWindow), [inWindow]);
  const sectorChips = useMemo(() => activeSectorChips(inWindow), [inWindow]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageCards = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const { lead, rest } = leadAndRest(pageCards);

  const anyFilter = filters.types.length > 0 || filters.sectors.length > 0;

  /** Toggle one chip. Multi-select within a row; the two rows AND together. */
  function toggle(row: "types" | "sectors", key: string) {
    setPage(1);
    setFilters((previous) => {
      const chosen = previous[row];
      const next = chosen.includes(key)
        ? chosen.filter((entry) => entry !== key)
        : [...chosen, key];
      return { ...previous, [row]: next };
    });
  }

  function changeRange(value: string) {
    setPage(1);
    setRange(value === "week" ? "week" : "today");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <RangeControl
          surface="news-feed"
          legend="Window"
          value={range}
          onChange={changeRange}
          options={[
            { value: "today", label: "Today", available: true },
            // The week window is never DISABLED, and that took a second look to get right. A shallow
            // archive does not make the week meaningless — it makes it short, and "everything I
            // have, which is less than a week" is a true and useful answer. Disabling the control
            // would have hidden the coverage the app actually holds behind a greyed-out button. So
            // the window opens, and it SAYS how deep it goes (the note below).
            { value: "week", label: "This week", available: true },
          ]}
        />

        <div className="flex flex-col items-end gap-0.5">
          <p data-testid="news-count" className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
            {countLine(shown.length, filters)}
          </p>
          {/* How deep the archive actually goes. A window that says "this week" over four days of
              coverage is over-promising by one word. */}
          {range === "week" && weekIncomplete ? (
            <p data-testid="news-week-note" className="font-ui text-2xs text-muted">
              {copy.news.weekUnavailable}
            </p>
          ) : null}
        </div>
      </div>

      <ChipRow
        label="Catalyst"
        chips={catalystChips.map((chip) => ({ key: chip.key, label: chip.label, value: chip.types }))}
        selected={filters.types}
        onToggle={(values) => toggle("types", values[0])}
        selectedFor={(values) => values.some((type) => filters.types.includes(type))}
      />
      <ChipRow
        label="Sector"
        chips={sectorChips.map((name) => ({ key: name, label: name, value: [name] }))}
        selected={filters.sectors}
        onToggle={(values) => toggle("sectors", values[0])}
        selectedFor={(values) => filters.sectors.includes(values[0])}
      />

      {anyFilter ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setFilters({ types: [], sectors: [] });
              setPage(1);
            }}
            className="inline-flex min-h-11 items-center rounded-chip border border-hairline bg-surface px-3 font-ui text-xs text-accent-deep hover:bg-surface-raised"
          >
            {copy.news.reset}
          </button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        // An empty result is information, not an apology (M5).
        <Surface level="card" className="p-5">
          <p className="font-serif text-base text-ink-2">{zeroStateLine(filters)}</p>
        </Surface>
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
          {lead ? (
            <div className="lg:col-span-2">
              <NewsCard card={lead} tier="lead" />
            </div>
          ) : null}
          {rest.map((card) => (
            <NewsCard key={card.id} card={card} tier="row" />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="min-h-11 rounded-chip border border-hairline bg-surface px-3 font-ui text-xs text-accent-deep disabled:text-faint"
          >
            ← Previous
          </button>
          {/* M6: position in words. Never a progress bar. */}
          <p className="font-mono text-2xs text-muted">
            {fill(copy.table.page, { p: current, t: totalPages, n: shown.length })}
          </p>
          <button
            type="button"
            disabled={current === totalPages}
            onClick={() => setPage(current + 1)}
            className="min-h-11 rounded-chip border border-hairline bg-surface px-3 font-ui text-xs text-accent-deep disabled:text-faint"
          >
            Next →
          </button>
        </nav>
      ) : null}

      <NoStory movers={noStoryMovers(movers, inWindow)} />
    </div>
  );
}

/**
 * One row of filter chips.
 *
 * It scrolls sideways on a phone and wraps on a desktop, and the reader pushes it — no autoplay, no
 * scroll-into-view, no mandatory snap (drift rule 15). Snap PROXIMITY is allowed and used: it helps
 * a thumb come to rest on a chip rather than between two, without ever taking the scroll away.
 */
function ChipRow({
  label,
  chips,
  selected,
  onToggle,
  selectedFor,
}: {
  label: string;
  chips: { key: string; label: string; value: string[] }[];
  selected: string[];
  onToggle: (values: string[]) => void;
  selectedFor: (values: string[]) => boolean;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      {/* The fade rides this non-scrolling wrapper, not the scrolling <ul> below it (the .shelf-frame
          lesson: WebKit mis-composites a mask on a scroller). Below md the row scrolls with its track
          hidden and a right-edge fade; at md+ the chips wrap and neither applies (D10). */}
      <div className="chip-scroll-frame md:contents">
      <ul
        aria-label={`${label} filters`}
        className={cx(
          "no-scrollbar flex snap-x snap-proximity gap-2 overflow-x-auto pb-1",
          "md:flex-wrap md:overflow-visible",
        )}
      >
        {chips.map((chip) => {
          const active = selectedFor(chip.value);
          return (
            <li key={chip.key} className="snap-start">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(chip.value)}
                className={cx(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-chip border px-3 font-ui text-xs",
                  active
                    ? "border-accent bg-accent-soft text-accent-deep"
                    : "border-hairline bg-surface text-ink-2 hover:bg-surface-raised",
                )}
              >
                {chip.label}
              </button>
            </li>
          );
        })}
      </ul>
      </div>
      <p className="sr-only">{selected.length > 0 ? `${selected.length} selected` : "none selected"}</p>
    </div>
  );
}

/**
 * "Moved without a story" (ruling C9).
 *
 * The page's caveat about itself. These names moved and no catalyst explains them, and saying so is
 * the honest alternative to leaving the reader to assume the Front Page is exhaustive. They carry
 * no image, they are never ranked among the catalysts, and the standing noise line travels with
 * them — because most moves of this size have no identifiable cause, and a mover with no story is
 * the single easiest thing in this app to mistake for a signal.
 */
function NoStory({ movers }: { movers: NoStoryMover[] }) {
  if (movers.length === 0) return null;

  return (
    <Surface level="card" as="aside" className="flex flex-col gap-2 p-4 desk:p-5">
      <h2 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
        {copy.news.noStoryHeader}
      </h2>
      <ul className="flex flex-col gap-1">
        {movers.map((mover) => (
          <li key={mover.symbol} data-p2="true" className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm text-ink">{mover.symbol}</span>
            {mover.ret1 !== null ? (
              <span
                className={cx("font-mono text-sm", mover.ret1 >= 0 ? "text-up-text" : "text-down-text")}
              >
                {signedPercent(mover.ret1)} · 1D
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="font-ui text-2xs text-muted">{copy.mover.noNews}</p>
    </Surface>
  );
}
