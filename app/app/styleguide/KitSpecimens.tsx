"use client";

import { DataTable } from "@/components/DataTable";
import { Disclosure } from "@/components/Disclosure";
import { Shelf, ShelfItem } from "@/components/Shelf";
import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";
import { SegmentedControl } from "@/components/form/SegmentedControl";
import { Stepper } from "@/components/form/Stepper";
import { StatFigure } from "@/components/StatFigure";
import { copy } from "@/lib/copy";
import type { Column } from "@/lib/table";

/**
 * Styleguide section 9 — the kit (APP-FEEL-PLAN §3.6).
 *
 * This is the VRT anchor for every primitive F2 introduced. Locking them HERE, on a page with fixed
 * data, is what makes the pixel oracle deterministic: the alternative is racing a real page load to
 * photograph a skeleton, which is a flaky test with extra steps.
 *
 * WHY THIS FILE IS A CLIENT COMPONENT. A `Column`'s accessor is a FUNCTION (`value: (row) => …`),
 * and a function cannot cross the server-to-client boundary — React cannot serialize it. So a column
 * SET must be defined in a client module, and the server passes only the rows, which are plain data.
 * That is the right shape anyway, and it is the shape every table consumer follows: the page stays a
 * server component and does the database read; a small client module owns the columns and renders
 * the table. (The build catches this immediately if anyone forgets, which is how it was found.)
 *
 * The specimens all sit inside ONE plain Surface card, deliberately. The kit pieces are furniture,
 * not surfaces — they paint no card, border or background of their own, they inherit the card they
 * sit in and contribute hairlines only. Rendering them here in a single plain card is what proves it
 * (and a grep keeps `.surface` out of the four kit files).
 */

type SpecimenRow = { symbol: string; name: string; rvol: number | null; ret: number; close: number };

const SPECIMEN_ROWS: SpecimenRow[] = [
  { symbol: "SMCI", name: "Super Micro Computer", rvol: 4.7, ret: 0.184, close: 41.2 },
  { symbol: "GME", name: "GameStop", rvol: 3.3, ret: -0.092, close: 23.14 },
  { symbol: "PLTR", name: "Palantir Technologies", rvol: 2.8, ret: 0.061, close: 28.9 },
  // The unknown. It renders "—" and sorts last in BOTH directions: an unknown is not a zero.
  { symbol: "CHPT", name: "ChargePoint Holdings", rvol: null, ret: -0.104, close: 1.97 },
];

const SPECIMEN_COLUMNS: Column<SpecimenRow>[] = [
  { key: "symbol", header: "Symbol", kind: "mono", priority: 1, value: (r) => r.symbol },
  { key: "name", header: "Name", kind: "text", priority: 2, value: (r) => r.name },
  { key: "ret", header: "1-day move", kind: "signedPercent", priority: 1, value: (r) => r.ret },
  { key: "rvol", header: "RVOL", kind: "multiple", priority: 2, value: (r) => r.rvol },
  { key: "close", header: "Close", kind: "price", priority: 3, value: (r) => r.close },
];

export function KitSpecimens() {
  return (
    <div className="flex flex-col gap-8">
      <Surface className="flex flex-col gap-8 p-5 desk:p-6">
        {/* The table, in its default (honest) order — the header says which order that is. */}
        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">DataTable · default order</h3>
          <DataTable
            columns={SPECIMEN_COLUMNS}
            rows={SPECIMEN_ROWS}
            defaultSort={{ key: "symbol", dir: "asc", label: copy.scans.order }}
            rowKey={(row) => row.symbol}
            ariaLabel="Specimen matches"
            footnote={copy.scans.tableNote}
          />
        </div>

        {/* Disclosure, both states. The count grammar is ruling M2 in its final human form. */}
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Disclosure · closed and open</h3>
          <Disclosure label="All movers" count={5} context="by rank">
            <p className="py-2 font-ui text-sm text-ink-2">The five movers below the fold.</p>
          </Disclosure>
          <Disclosure label="Closed trades" count={3} context="all time" defaultOpen>
            <p className="py-2 font-ui text-sm text-ink-2">Open: the summary drops the word “more”.</p>
          </Disclosure>
          <Disclosure label="Per-provider detail" count={6} forceOpen>
            <p className="py-2 font-ui text-sm text-ink-2">
              forceOpen: a degradation may not be folded away, so there is no toggle at all.
            </p>
          </Disclosure>
        </div>

        {/* The shelf. The reader pushes it; it never pushes itself (M3). */}
        <div className="flex flex-col gap-2">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Shelf · at rest</h3>
          <Shelf label="Macro figures" countLine={copy.pulse.swipe}>
            {[
              { label: "VIX", value: "15.84" },
              { label: "10-yr", value: "4.54%" },
              { label: "Nasdaq", value: "22,345.67" },
              { label: "Dow", value: "44,210.55" },
              { label: "Small caps", value: "220.40" },
            ].map((figure) => (
              <ShelfItem key={figure.label} className="w-[150px]">
                <Surface className="h-full p-3">
                  <StatFigure label={figure.label} value={figure.value} scale="body" />
                </Surface>
              </ShelfItem>
            ))}
          </Shelf>
        </div>

        {/* The skeletons, side by side — this row is what makes ruling M4 visible. */}
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            Skeleton · containers shimmer, figures do not
          </h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className="font-ui text-2xs text-faint">masthead + text — a container, so it may shimmer</p>
              <Skeleton variant="masthead" />
              <Skeleton variant="text" lines={3} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-ui text-2xs text-faint">figure — a still em-dash, never a shimmering bar</p>
              <Skeleton variant="figure" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-ui text-2xs text-faint">block — the chart reservation: still geometry</p>
              <Skeleton variant="block" height={96} />
            </div>
          </div>
        </div>

        {/* The form kit. The side control is pressed NOWHERE, and that is the specimen. */}
        <div className="flex flex-col gap-4">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-muted">Form kit</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SegmentedControl
              name="specimen-side"
              legend="Side · no default (M9)"
              options={[
                { value: "buy", label: "Buy" },
                { value: "sell", label: "Sell (short)" },
              ]}
            />
            <SegmentedControl
              name="specimen-bucket"
              legend="Bucket · a parameter, so it keeps one"
              defaultValue="large-mid"
              options={[
                { value: "large-mid", label: "Large / mid", detail: "20bp" },
                { value: "small", label: "Small", detail: "60bp" },
              ]}
            />
            <Stepper name="specimen-quantity" label="Quantity" defaultValue={10} min={1} presets={[10, 25, 50, 100]} />
          </div>
        </div>
      </Surface>
    </div>
  );
}
