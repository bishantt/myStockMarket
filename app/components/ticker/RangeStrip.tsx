import { copy, fill } from "@/lib/copy";
import { price } from "@/lib/format";
import { YEAR_LABEL_THRESHOLD, type RangeStripData } from "@/lib/ticker-depth";
import { formatUtcDate } from "@/lib/time";

/**
 * RangeStrip — the 52-week strip (PD8, plan 10.1 block 2).
 *
 * A POSITION, never an angle (P13): a thin horizontal band with the trailing window's low at the
 * left, its high at the right, and a marker where the last close sits between them. It is a RECORD
 * of history, not a claim about what comes next — so there is no direction, no colour, no motion.
 * It renders complete on first paint and it is `data-p2`, because it carries price, and price does
 * not move on this app (§3.6); the marker's transform is a STATIC centering offset, not animation.
 *
 * It STATES ITS WINDOW OUT LOUD (§5.2). "52-week" is a claim about a year, so the label says it only
 * when the window really is about a year; a thinner history gets "Trading range" and the true session
 * count. Both name the window — the reader never has to guess the scope of the range they are shown.
 *
 * Deliberately ONE thin band: nothing here may exceed the Range Ladder's visual weight, which is the
 * page's hero (block 3). This is context for it, not competition with it.
 */
export function RangeStrip({ strip }: { strip: RangeStripData }) {
  const isYear = strip.sessions >= YEAR_LABEL_THRESHOLD;
  const windowLine = fill(isYear ? copy.ticker.range52wWindow : copy.ticker.rangeShortWindow, {
    n: strip.sessions,
    date: formatUtcDate(new Date(`${strip.through}T00:00:00Z`)),
  });

  return (
    <div data-p2="true" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Endpoint label={copy.ticker.rangeLow} value={strip.low} align="left" />
        <Endpoint label={copy.ticker.rangeCurrent} value={strip.current} align="center" />
        <Endpoint label={copy.ticker.rangeHigh} value={strip.high} align="right" />
      </div>

      {/* The band. The marker is a dot at the current position — a mark on a record, not a needle on
          a gauge, so it does not point and it does not move. */}
      <div className="relative h-1.5 rounded-full bg-band-inner">
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper bg-ink"
          style={{ left: `${strip.position * 100}%` }}
        />
      </div>

      <p className="font-mono text-2xs text-muted">{windowLine}</p>
    </div>
  );
}

/** One end of the strip: its label above, the formatted price below. */
function Endpoint({
  label,
  value,
  align,
}: {
  label: string;
  value: number;
  align: "left" | "center" | "right";
}) {
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <div className={alignClass}>
      <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">{label}</p>
      <p className="font-mono text-sm text-ink">{price(value)}</p>
    </div>
  );
}
