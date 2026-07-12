import { Tag } from "@/components/Tag";
import { copy } from "@/lib/copy";
import { buildBaseRate, type BaseRateData } from "@/lib/baserate";

/**
 * BaseRate — the ONE renderer for a historical base rate (§3.8, §1.5, base-rate-display skill).
 *
 * No other component may format a base rate. This one implements the N-gated precision rules and
 * the canonical natural-frequency sentence, so a rate reads identically wherever it appears. It
 * renders only what the pipeline stored — it never computes n, wins, the interval, or the baseline.
 *
 * What it shows, by sample size:
 *   - N ≥ 100: the sentence with the percentage, then the Wilson 95% interval.
 *   - N 30–99: the sentence with the natural frequency ("about 6 in 10"), then the wide-interval note.
 *   - N < 30 : the suppression line only. Not shrunk, not hedged — suppressed.
 *
 * Every resolvable rate carries the always-up baseline beneath it (so a rate cannot pose as an edge
 * over simply being long), and the decay stamp rides alongside when the pattern has provenance.
 *
 * THE VISUALS LIVE IN HERE, and that is the most important structural decision in the redesign
 * (§3.8, and the honesty review's top finding). The proportion bar and the dot array ARE base-rate
 * displays — so the N-gate, the interval, the baseline and the WEAK cap have to travel with them.
 * Put a proportion bar on a collapsed card and you have published a rate stripped of every piece of
 * context that keeps it honest. So there is no standalone proportion-bar component, no other file
 * may render an "X of N" visual, and a grep enforces it.
 *
 * Nothing here moves (P2). It renders complete on the first paint, and no ancestor may animate or
 * transform it either — a jsdom test walks up from this `data-p2` root to prove it.
 */
export function BaseRate({ data }: { data: BaseRateData }) {
  const view = buildBaseRate(data);
  const misses = data.n - data.wins;

  return (
    <div data-p2 className="flex flex-col gap-2">
      {view.decay ? <DecayStamp decay={view.decay} /> : null}

      <p className="max-w-[58ch] font-prose text-base text-ink">{view.sentence}</p>

      {/*
       * The visuals exist only where the numbers are trustworthy. Below N = 30 the rate itself is
       * suppressed, and a picture of a suppressed rate would smuggle it back onto the screen — the
       * one thing the suppression rule exists to prevent.
       */}
      {view.suppressed ? null : (
        <>
          <ProportionBar wins={data.wins} misses={misses} />
          <DotArray wins={data.wins} misses={misses} />
        </>
      )}

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

/**
 * The proportion bar — hits and misses at EQUAL visual weight.
 *
 * Both segments render at the same alpha. Only their lengths differ, and the printed counts carry
 * the actual numbers. That symmetry is deliberate: saturating the majority segment lets the eye
 * exaggerate it, and a 56% base rate would *look* like a strong edge while the interval underneath
 * it says otherwise. Length encodes the proportion. Colour encodes nothing but which is which.
 */
function ProportionBar({ wins, misses }: { wins: number; misses: number }) {
  const total = wins + misses;
  const winShare = (wins / total) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex h-2 overflow-hidden rounded-pill"
        role="img"
        aria-label={`${wins} higher, ${misses} not higher, out of ${total} cases`}
      >
        <div className="bg-up-bar" style={{ width: `${winShare}%` }} />
        <div className="bg-down-bar" style={{ width: `${100 - winShare}%` }} />
      </div>
      <p className="font-mono text-2xs text-muted">
        {wins} higher · {misses} not · {total} cases
      </p>
    </div>
  );
}

/**
 * The dot array — one dot per historical case. Never scaled, never sampled.
 *
 * The Figma drew forty dots for a sample of 108 and put "+68" beside them. That is the one thing a
 * dot array must never do: the whole reason to draw dots instead of a bar is that a reader can
 * COUNT them, and a scaled array misrepresents the sample size while looking scrupulous about it.
 * So every case gets a dot, and a large N simply wraps onto more rows.
 *
 * Hits are filled; misses are HOLLOW, with a full-opacity stroke. The shape channel carries the
 * distinction and colour is the redundant one — because a colourblind reader has to be able to
 * count the misses, and the misses are the entire reason this is on the screen.
 */
function DotArray({ wins, misses }: { wins: number; misses: number }) {
  const dots = [
    ...Array.from({ length: wins }, (_, i) => ({ hit: true, key: `h${i}` })),
    ...Array.from({ length: misses }, (_, i) => ({ hit: false, key: `m${i}` })),
  ];

  return (
    <div className="flex flex-col gap-1 pt-1">
      <div
        className="flex flex-wrap gap-[3px]"
        role="img"
        aria-label={`${wins} of ${wins + misses} cases were higher; each dot is one case`}
      >
        {dots.map((dot) => (
          <span
            key={dot.key}
            className={
              dot.hit
                ? "block size-[9px] rounded-pill bg-up"
                : "block size-[9px] rounded-pill border-[1.5px] border-down"
            }
          />
        ))}
      </div>
      <p className="font-ui text-2xs text-muted">{copy.dotarray.caption}</p>
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
