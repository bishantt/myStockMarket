import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { MacroPulse } from "@/components/desk/MacroPulse";
import { Movers } from "@/components/desk/Movers";
import { Watchlist } from "@/components/desk/Watchlist";
import { getLatestRun } from "@/lib/pipeline";
import { getMorning } from "@/lib/morning";
import { formatEtDate } from "@/lib/time";

/**
 * The Desk — the one-screen ritual column (plan §9.2, Figure 9.2).
 *
 * The eight modules mount in the fixed ritual order (macro → brief → calendar → movers →
 * watchlist → setup cards → sectors/scans → paper corner). That order is the invariant: it mirrors
 * the documented professional pre-market sequence, so the layout itself teaches the routine, and it
 * is the same on every visit whether or not a module has data yet.
 *
 * At P1 three modules are wired to the serving database the nightly cloud pipeline fills — the macro
 * strip, the movers, and the focus watchlist. Each renders its live component when getMorning
 * returns data and falls back to a quiet placeholder otherwise, so the ritual's shape is always
 * complete and a slow or empty table degrades one module rather than the page. The remaining
 * modules (brief, calendar, setup cards, sectors/scans, paper corner) show their masthead over a
 * placeholder note until their phase lands.
 */

export const dynamic = "force-dynamic";

/** The modules not yet wired to data — masthead over a one-line note saying when they arrive. */
const PLACEHOLDERS: Record<number, string> = {
  2: "The evening briefing lands in P3.",
  3: "Earnings and macro events arrive in P2.",
  6: "Probabilistic setup cards arrive in P4.",
  7: "Sector small multiples and scan presets arrive in P2–P4.",
  8: "The paper ledger and cost mirror arrive in P6.",
};

function Placeholder({ index, title, note }: { index: number; title: string; note: string }) {
  return (
    <section>
      <SectionMasthead index={index} title={title} />
      <div className="pt-3">
        <p className="font-ui text-sm text-muted">— &nbsp; {note}</p>
      </div>
    </section>
  );
}

export default async function DeskPage() {
  const [latest, morning] = await Promise.all([getLatestRun(), getMorning()]);
  // A live module always carries an "as of" timestamp, and that timestamp comes from a recorded
  // run. If no run is recorded yet, asOf is null and every live module shows its placeholder — the
  // Desk never stamps a module with a fabricated date.
  const asOf = morning.asOf;

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

      {/* 01 — Macro pulse: the day's opening posture, or the placeholder until the ingest runs. */}
      {asOf && morning.macro ? (
        <MacroPulse asOf={asOf} {...morning.macro} />
      ) : (
        <Placeholder index={1} title="Macro pulse" note="Index pulse and breadth arrive with the nightly ingest." />
      )}

      {/* 02–03 — brief and calendar, not yet wired. */}
      <Placeholder index={2} title="Daily brief" note={PLACEHOLDERS[2]} />
      <Placeholder index={3} title="Session calendar" note={PLACEHOLDERS[3]} />

      {/* 04 — Movers: the volume-confirmed moves, or the placeholder until scans publish. */}
      {asOf && morning.movers ? (
        <Movers asOf={asOf} movers={morning.movers} />
      ) : (
        <Placeholder index={4} title="Movers" note="Movers arrive with the nightly scans." />
      )}

      {/* 05 — Focus watchlist: the user's names with the day change, or the empty-state prompt. */}
      {asOf && morning.watch ? (
        <Watchlist asOf={asOf} rows={morning.watch} />
      ) : (
        <Placeholder index={5} title="Focus watchlist" note="Add names and the reason you are watching them." />
      )}

      {/* 06–08 — setup cards, sectors/scans, paper corner, each arriving in a later phase. */}
      <Placeholder index={6} title="Setup cards" note={PLACEHOLDERS[6]} />
      <Placeholder index={7} title="Sectors & scans" note={PLACEHOLDERS[7]} />
      <Placeholder index={8} title="Paper corner" note={PLACEHOLDERS[8]} />
    </div>
  );
}
