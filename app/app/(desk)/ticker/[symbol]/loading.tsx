import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/**
 * /ticker/[symbol], loading (Appendix C).
 *
 * The 420px chart reservation is STILL GEOMETRY — a plain bordered box, no shimmer (ruling M4). The
 * candle chart is a money visual by this codebase's own record, and money visuals do not move; a
 * 1.6s pulse filling the largest visual slot in the app is the single biggest piece of manufactured
 * anticipation the product could show. Reserving the exact height also means nothing jumps when the
 * chart arrives (budget B5).
 */
export default function TickerLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-32" />

      <div className="flex flex-col gap-2">
        <Skeleton variant="text" lines={1} className="w-16" />
        <Skeleton variant="text" lines={1} className="w-56" />
        <Skeleton variant="figure" />
      </div>

      <Surface className="p-5">
        <Skeleton variant="block" height={420} />
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="block" height={72} />
        <div className="pt-3">
          <Skeleton variant="block" height={72} />
        </div>
        <div className="pt-3">
          <Skeleton variant="block" height={72} />
        </div>
      </Surface>
    </div>
  );
}
