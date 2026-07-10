import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { getLatestRun } from "@/lib/pipeline";
import { formatEtDate } from "@/lib/time";

/**
 * The Desk, as it exists at P0: a walking skeleton with one live module.
 *
 * That module reads the most recent pipeline_run and shows when the cloud pipeline last ran.
 * This is the app half of the P0 loop: a cron writes a row in the cloud, and the app renders it,
 * with nothing having run on the user's hardware (plan P0 acceptance).
 *
 * The eight real Desk modules mount at P1 in strict ritual order (macro, brief, calendar, movers,
 * watchlist, setup cards, sectors/scans, paper corner); unbuilt ones will render their masthead
 * over a quiet "—" body, so the ritual's shape is complete from the first day.
 */

// Dynamic: this reads the database on every request. Single user, cheap reads — no caching
// complexity in v1 (plan §4.5). force-dynamic also keeps the build from trying to prerender a
// page that needs a database connection.
export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const latest = await getLatestRun();

  return (
    <div className="flex flex-col gap-7">
      <section>
        <SectionMasthead
          index={0}
          title="Pipeline"
          asOf={latest?.finishedAt ?? undefined}
        />
        <div className="pt-4">
          <StatFigure
            label="Last cloud run"
            value={latest ? formatEtDate(latest.runDate) : "—"}
            scale="figure"
          />
          <p className="pt-3 font-ui text-sm text-muted">
            {latest
              ? "Written by the nightly pipeline in the cloud — nothing runs on this device."
              : "No run recorded yet. The nightly jobs write here after each US close."}
          </p>
        </div>
      </section>
    </div>
  );
}
