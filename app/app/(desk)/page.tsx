import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";

/**
 * The Desk, as it exists at P0: a walking skeleton.
 *
 * Right now this renders one module — the pipeline's own heartbeat — because that is exactly
 * what P0 has to prove: that a cron ran in the cloud, wrote a row, and the app can show it,
 * with nothing having run on the user's hardware (plan P0 acceptance).
 *
 * The eight real modules mount at P1 in strict ritual order (macro pulse, daily brief, session
 * calendar, movers, watchlist, setup cards, sectors/scans, paper corner). Unbuilt modules will
 * render their masthead over a quiet "—" body, so the shape of the ritual is complete from the
 * first day and nothing has to be rearranged later.
 *
 * The timestamp below is a placeholder until P0 step 7 brings up Prisma and the `pipeline_run`
 * table. It is deliberately NOT faked with `new Date()` at render time: a timestamp that always
 * says "now" is the exact lie every module's "as of" line exists to prevent.
 */
export default function DeskPage() {
  return (
    <div className="flex flex-col gap-7">
      <section>
        <SectionMasthead index={0} title="Pipeline" />
        <div className="pt-4">
          <StatFigure
            label="Last cloud run"
            value="—"
            scale="figure"
          />
          <p className="pt-3 font-ui text-sm text-muted">
            No run recorded yet. The nightly jobs land at P0 step 8; this figure reads the
            most recent <code className="font-mono text-2xs">pipeline_run</code> row once the
            database is connected.
          </p>
        </div>
      </section>
    </div>
  );
}
