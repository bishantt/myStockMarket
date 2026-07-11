import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { getLatestRun } from "@/lib/pipeline";
import { formatEtDate } from "@/lib/time";

/**
 * The Desk — the one-screen ritual column (plan §9.2, Figure 9.2).
 *
 * The eight modules mount in the fixed ritual order (macro → brief → calendar → movers →
 * watchlist → setup cards → sectors/scans → paper corner). That order is the invariant: it mirrors
 * the documented professional pre-market sequence, so the layout itself teaches the routine, and it
 * is the same on every visit whether or not a module has data yet.
 *
 * At P1 the modules whose data pipeline is not wired render their masthead over a quiet "—"
 * placeholder, so the ritual's shape is complete from the first day and nothing has to be
 * rearranged later. The pipeline-status module reads the real last run (the P0 loop). The macro,
 * movers, and watchlist modules — whose components exist and are tested — light up as the nightly
 * pipeline begins publishing their serving data.
 */

export const dynamic = "force-dynamic";

/** The eight ritual modules, in order. `body` is the P1 placeholder shown under each masthead. */
const RITUAL = [
  { index: 1, title: "Macro pulse", note: "Index pulse and breadth arrive with the nightly ingest." },
  { index: 2, title: "Daily brief", note: "The evening briefing lands in P3." },
  { index: 3, title: "Session calendar", note: "Earnings and macro events arrive in P2." },
  { index: 4, title: "Movers", note: "Movers with reasons arrive in P2." },
  { index: 5, title: "Focus watchlist", note: "Add names and the reason you are watching them." },
  { index: 6, title: "Setup cards", note: "Probabilistic setup cards arrive in P4." },
  { index: 7, title: "Sectors & scans", note: "Sector small multiples and scan presets arrive in P2–P4." },
  { index: 8, title: "Paper corner", note: "The paper ledger and cost mirror arrive in P6." },
];

export default async function DeskPage() {
  const latest = await getLatestRun();

  return (
    <div className="flex flex-col gap-7">
      {/* Module 0 — the pipeline heartbeat (the P0 loop): the app renders what the cloud wrote. */}
      <section>
        <SectionMasthead index={0} title="Pipeline" asOf={latest?.finishedAt ?? undefined} />
        <div className="pt-4">
          <StatFigure label="Last cloud run" value={latest ? formatEtDate(latest.runDate) : "—"} scale="figure" />
          <p className="pt-3 font-ui text-sm text-muted">
            {latest
              ? "Written by the nightly pipeline in the cloud — nothing runs on this device."
              : "No run recorded yet. The nightly jobs write here after each US close."}
          </p>
        </div>
      </section>

      {/* Modules 1–8 in ritual order — mastheads mounted now, bodies fill in phase by phase. */}
      {RITUAL.map((module) => (
        <section key={module.index}>
          <SectionMasthead index={module.index} title={module.title} />
          <div className="pt-3">
            <p className="font-ui text-sm text-muted">— &nbsp; {module.note}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
