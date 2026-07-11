import { Tag } from "@/components/Tag";
import { buildBaseRate, type BaseRateData } from "@/lib/baserate";

/**
 * BaseRate — the ONE renderer for a historical base rate (plan §4.3, §1.5, base-rate-display skill).
 *
 * No other component may format a base rate; this one implements the N-gated precision rules and the
 * canonical natural-frequency sentence, so a rate reads identically wherever it appears. It renders
 * only what the pipeline stored — it never computes n, wins, the interval, or the baseline.
 *
 * What it shows, by sample size:
 *   - N ≥ 100: the sentence with the percentage, then the Wilson 95% interval.
 *   - N 30–99: the sentence with the natural frequency ("about 6 in 10"), then the wide-interval note.
 *   - N < 30 : the suppression line only.
 * Every resolvable rate carries the always-up baseline line beneath it (so a rate cannot pose as an
 * edge over simply being long), and the decay stamp — publication year and evidence grade — rides
 * alongside whenever the pattern has provenance. Folklore renders the word, with its grade dot.
 */
export function BaseRate({ data }: { data: BaseRateData }) {
  const view = buildBaseRate(data);
  return (
    <div className="flex flex-col gap-1.5">
      {view.decay ? <DecayStamp decay={view.decay} /> : null}

      <p className="max-w-[58ch] font-prose text-base text-ink">{view.sentence}</p>

      {view.ciText ? <p className="font-mono text-2xs text-ink-2">{view.ciText}</p> : null}
      {view.wideIntervalNote ? (
        <p className="max-w-[54ch] font-ui text-2xs text-muted">{view.wideIntervalNote}</p>
      ) : null}
      {view.baselineLine ? (
        <p className="max-w-[54ch] font-ui text-2xs text-muted">{view.baselineLine}</p>
      ) : null}
    </div>
  );
}

/** The decay stamp: the evidence grade (with its dot) and the publication year, quiet provenance. */
function DecayStamp({ decay }: { decay: { year: number | null; grade: string | null; note: string | null } }) {
  const grade = decay.grade;
  return (
    <div className="flex items-center gap-2">
      {grade === "folklore" ? (
        <Tag variant="folklore" />
      ) : grade ? (
        <Tag variant="grade" grade={grade as "supported" | "mixed" | "weak"}>
          {grade}
        </Tag>
      ) : null}
      {decay.year != null ? (
        <span className="font-mono text-2xs text-muted" title={decay.note ?? undefined}>
          since {decay.year}
        </span>
      ) : decay.note ? (
        <span className="font-ui text-2xs text-muted" title={decay.note}>
          decay noted
        </span>
      ) : null}
    </div>
  );
}
