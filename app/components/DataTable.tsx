"use client";

import { useMemo, useState } from "react";

import { Tag } from "@/components/Tag";
import { useRail, type RailPayload } from "@/components/rail/Rail";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { compactMoney, decimal, multiple, percent, price, signedPercent } from "@/lib/format";
import { DEFAULT_PER_PAGE, paginate, sortRows, type Column, type SortDirection } from "@/lib/table";

/**
 * DataTable — the one table in this app (APP-FEEL-PLAN §3.3, Appendix A).
 *
 * DEVELOPMENT-PLAN §3.6 named a DataTable and never built one, and the gap showed: /scans printed a
 * wall of bare ticker chips capped at 24, with a dead "+ N more" that was not a link, not a button,
 * not anything — on the first live pipeline night, 1,825 matches were unreachable from the page that
 * exists to show them. This is that table, and the reachability of every row is the point.
 *
 * THIS FILE IS P2-BEARING BY CONSTRUCTION, AND THAT BINDS EVERYTHING IN IT. Its delta cells are
 * money, so they carry `data-p2` — which means no ancestor of them may animate or transform, which
 * means THIS FILE CONTAINS NO TRANSITIONS AT ALL. Not on rows, not on hover, not on sort. Row
 * feedback is an instant background change with no `transition-*` or `duration-*` class anywhere.
 *
 * That is a real constraint with a real casualty: the movers row hovers with `transition-colors`
 * today, and this table cannot copy it. The movers row gets away with it only because its delta
 * chips are unmarked — an honest kit marks them, and then has to live with the rule. Sorting
 * re-renders rows in their new order INSTANTLY: a FLIP-animated sort is a screenful of money
 * figures sliding around, and it is banned (M3). A unit test asserts this file is free of
 * transitions, so the guard bites the exact shortcut a hurried consumer would take.
 *
 * The order is honest by default: the pipeline's own rank, and the header says so in words —
 * "scan order", never "top" (M1). The reader may re-sort by any column they can SEE, and can always
 * get back.
 */

export type DataTableProps<Row> = {
  columns: Column<Row>[];
  /** Already bounded by the route (≤ 500). */
  rows: Row[];
  defaultSort: { key: string; dir: SortDirection; label?: string };
  perPage?: number;
  rowKey: (row: Row) => string;
  /** Presence makes each row a rail trigger (drill level 2). Absence makes rows inert. */
  onRowPayload?: (row: Row) => RailPayload;
  ariaLabel: string;
  /** Rendered under the table. copy.scans.tableNote's single home. */
  footnote?: string;
  /**
   * False above the row cap. Sorting a silent subset would present "the biggest movers among the
   * most salient" as "the biggest movers" — an unlabelled ranking, the exact species M1 forbids.
   */
  sortable?: boolean;
};

/** Every number in this table comes through lib/format. There is no other door (drift rule 12). */
function formatCell(value: string | number | null, kind: Column<never>["kind"]): string {
  if (value === null) return "—"; // an unknown, not a zero
  if (typeof value === "number") {
    switch (kind) {
      case "price":
        return price(value);
      case "signedPercent":
        return signedPercent(value);
      case "percent":
        return percent(value);
      case "multiple":
        return multiple(value);
      case "compact":
        return compactMoney(value);
      case "mono":
        // A plain numeral (an RSI reading). Symbols are also "mono" but arrive as strings, and fall
        // through below untouched.
        return decimal(value, 1);
      case "int":
        return String(Math.round(value));
      default:
        return String(value);
    }
  }
  return value;
}

/** The delta chip: the movers' visual grammar (word + triangle + sign), never their hover motion. */
function DeltaChip({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      data-p2="true"
      className={cx(
        "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 font-mono text-2xs",
        up ? "bg-up-wash text-up-text" : "bg-down-wash text-down-text",
      )}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {signedPercent(value)}
    </span>
  );
}

function Cell<Row>({ column, row }: { column: Column<Row>; row: Row }) {
  const value = column.value(row);

  // A custom renderer wins — but only over the DISPLAY. The sort still reads column.value.
  if (column.render) return <>{column.render(row)}</>;
  if (column.kind === "signedPercent" && typeof value === "number") return <DeltaChip value={value} />;
  if (column.kind === "chip" && value !== null) return <Tag variant="catalyst">{String(value)}</Tag>;

  const numeric = column.kind !== "text";
  return (
    <span className={cx(numeric ? "font-mono tabular-nums" : "font-ui", value === null && "text-muted")}>
      {formatCell(value, column.kind)}
    </span>
  );
}

export function DataTable<Row>({
  columns,
  rows,
  defaultSort,
  perPage = DEFAULT_PER_PAGE,
  rowKey,
  onRowPayload,
  ariaLabel,
  footnote,
  sortable = true,
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = useState(defaultSort.key);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSort.dir);
  const [page, setPage] = useState(1);
  const rail = useRail();

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    return column ? sortRows(rows, column, sortDir) : rows;
  }, [columns, rows, sortKey, sortDir]);

  const view = paginate(sorted, page, perPage);

  /** Tap a header: sort by it, or flip it if it is already the sorted one. */
  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc"); // a fresh metric column reads strongest-first, which is what a reader means
    }
    setPage(1); // re-sorting and staying on page 4 shows a slice of a set the reader has not seen
  }

  const isDefaultOrder = sortKey === defaultSort.key && sortDir === defaultSort.dir;
  const showing = view.rows;

  return (
    <div className="flex flex-col gap-3">
      {/* PHONE — card-rows. A 7-column grid peeked through a 390px keyhole is not a table (E-5). */}
      <div className="md:hidden">
        {sortable ? (
          <label className="flex flex-col gap-1 pb-3">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">{copy.table.sortHint}</span>
            {/*
             * A native select: the OS picker is the best one-handed ergonomic on a phone and costs
             * zero dependencies. Its FIRST and default option is always the honest order — the way
             * back to "scan order" is never more than one flick away (M1).
             */}
            <select
              className="min-h-11 rounded-control border border-hairline bg-surface px-3 font-ui text-input-touch text-ink"
              value={`${sortKey}:${sortDir}`}
              onChange={(event) => {
                const [key, dir] = event.target.value.split(":");
                setSortKey(key);
                setSortDir(dir as SortDirection);
                setPage(1);
              }}
            >
              <option value={`${defaultSort.key}:${defaultSort.dir}`}>
                {defaultSort.label ? defaultSort.label.replace(/^./, (c) => c.toUpperCase()) : "Default order"}
              </option>
              {columns
                .filter((c) => c.sortable !== false && c.key !== defaultSort.key)
                .flatMap((c) => [
                  <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{`${c.header} — high to low`}</option>,
                  <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{`${c.header} — low to high`}</option>,
                ])}
            </select>
          </label>
        ) : null}

        <ul className="flex flex-col">
          {showing.map((row) => {
            const line1 = columns.filter((c) => c.priority === 1);
            const line2 = columns.filter((c) => c.priority === 2);
            const payload = onRowPayload?.(row);

            const body = (
              <>
                <span className="flex flex-wrap items-center gap-2">
                  {line1.map((c) => (
                    <Cell key={c.key} column={c} row={row} />
                  ))}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono text-2xs text-muted">
                  {line2.map((c) => (
                    <span key={c.key} className="flex items-center gap-1">
                      <span className="text-muted">{c.header}</span>
                      <Cell column={c} row={row} />
                    </span>
                  ))}
                </span>
              </>
            );

            return (
              <li key={rowKey(row)} className="border-b border-hairline last:border-b-0">
                {payload ? (
                  <button
                    type="button"
                    onClick={() => rail.open(payload)}
                    className="flex min-h-11 w-full flex-col items-start py-3 text-left active:bg-accent-soft"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex min-h-11 flex-col py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* DESKTOP — the real table. No sticky thead (the iOS trap), no zebra stripes (§3.6 DP). */}
      <div className="hidden md:block">
        <table className="w-full border-collapse" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-hairline-strong">
              {columns.map((column) => {
                const active = column.key === sortKey;
                const canSort = sortable && column.sortable !== false;
                const alignRight = column.align === "right" || (column.kind !== "text" && column.kind !== "mono");

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className={cx("p-0 font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted", alignRight && "text-right")}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        // touch-manipulation: a second quick tap flips the direction, and iOS would
                        // otherwise read those two taps as a double-tap and smart-zoom the page.
                        className={cx(
                          "flex min-h-11 w-full items-center gap-1 px-2 py-2 touch-manipulation hover:text-ink-2",
                          alignRight ? "justify-end" : "justify-start",
                        )}
                      >
                        {column.header}
                        {/* The arrow is a visible affordance, not a hover-only one. */}
                        <span aria-hidden="true" className="text-muted">
                          {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </span>
                        {active && isDefaultOrder && defaultSort.label ? (
                          <span className="font-normal normal-case tracking-normal text-muted">· {defaultSort.label}</span>
                        ) : null}
                      </button>
                    ) : (
                      <div className={cx("flex min-h-11 items-center px-2 py-2", alignRight ? "justify-end" : "justify-start")}>
                        {column.header}
                        {active && isDefaultOrder && defaultSort.label ? (
                          <span className="pl-1 font-normal normal-case tracking-normal text-muted">· {defaultSort.label}</span>
                        ) : null}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {showing.map((row) => {
              const payload = onRowPayload?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={payload ? () => rail.open(payload) : undefined}
                  // Instant background feedback. No transition — see the file comment. This row can
                  // contain a money figure, and money figures do not move, including by inheritance.
                  className={cx(
                    "border-b border-hairline last:border-b-0",
                    payload && "cursor-pointer hover:bg-accent-soft",
                  )}
                >
                  {columns.map((column) => {
                    const alignRight = column.align === "right" || (column.kind !== "text" && column.kind !== "mono");
                    return (
                      <td
                        key={column.key}
                        className={cx("min-h-11 px-2 py-3 text-sm text-ink-2", alignRight && "text-right")}
                      >
                        <Cell column={column} row={row} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Position in words, never a bar (M6, P13). Client state only — a URL-state page number would
          fragment this route's cache per page visited and put a server hop back into every click. */}
      {view.pages > 1 ? (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="font-mono text-2xs text-muted">
            {fill(copy.table.page, { p: view.page, t: view.pages, n: view.total })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={view.page === 1}
              className="min-h-11 rounded-control border border-hairline px-4 font-ui text-sm text-ink-2 touch-manipulation disabled:text-faint"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(view.pages, p + 1))}
              disabled={view.page === view.pages}
              className="min-h-11 rounded-control border border-hairline px-4 font-ui text-sm text-ink-2 touch-manipulation disabled:text-faint"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <p className="font-mono text-2xs text-muted">
          {fill(copy.table.page, { p: view.page, t: view.pages, n: view.total })}
        </p>
      )}

      {footnote ? <p className="max-w-[62ch] font-ui text-2xs leading-relaxed text-muted">{footnote}</p> : null}
    </div>
  );
}
