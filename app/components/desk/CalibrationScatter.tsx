import type { CalibrationBucket } from "@/lib/brier";

/**
 * CalibrationScatter — predicted vs actual, against the perfect-calibration diagonal (plan §7 P6
 * step 4, Figure the RR calibration plot).
 *
 * The x-axis is the predicted probability, the y-axis what actually happened. A well-calibrated
 * forecaster's points sit on the diagonal: things called 70% likely happen about 70% of the time.
 * Each point's size carries its bucket's N — a small bucket is a faint claim. A server component (pure
 * SVG, no interaction); ink and hairlines, no colour on the data (calm tech, §3.3).
 */
export function CalibrationScatter({ buckets }: { buckets: CalibrationBucket[] }) {
  const size = 220;
  const pad = 24;
  const scale = (v: number) => pad + v * (size - 2 * pad);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-56 w-56" role="img" aria-label="Calibration: predicted versus actual">
      {/* Frame */}
      <rect x={pad} y={pad} width={size - 2 * pad} height={size - 2 * pad} fill="none" stroke="var(--color-hairline)" />
      {/* Perfect-calibration diagonal (bottom-left to top-right). */}
      <line x1={scale(0)} y1={scale(1)} x2={scale(1)} y2={scale(0)} stroke="var(--color-muted)" strokeDasharray="3 3" />
      {/* Points: x = predicted, y = actual (SVG y is inverted). Radius grows with N. */}
      {buckets.map((b) => (
        <circle
          key={b.lower}
          cx={scale(b.predictedMean)}
          cy={scale(1 - b.actual)}
          r={Math.min(8, 3 + Math.sqrt(b.n))}
          fill="var(--color-ink)"
        />
      ))}
      <text x={scale(0.5)} y={size - 6} textAnchor="middle" fontSize="8" fill="var(--color-muted)">
        predicted →
      </text>
      <text x={8} y={scale(0.5)} textAnchor="middle" fontSize="8" fill="var(--color-muted)" transform={`rotate(-90 8 ${scale(0.5)})`}>
        actual →
      </text>
    </svg>
  );
}
