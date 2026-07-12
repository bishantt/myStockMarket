import { Skeleton } from "@/components/Skeleton";

/**
 * /track-record, loading: the five stat tiles and the resolved log (Appendix C).
 *
 * Every one of the five stats is a figure — hits, misses, the hit rate — so all five load as still
 * em-dashes (M4). This is the accountability surface; a row of pulsing bars where the app's own miss
 * count belongs would be the worst possible place to imply that a number is on its way.
 */
export default function TrackRecordLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-56" />
      <Skeleton variant="text" lines={2} />

      <div className="flex flex-wrap gap-8 pt-2">
        {[0, 1, 2, 3, 4].map((stat) => (
          <div key={stat} className="flex flex-col gap-2">
            <Skeleton variant="text" lines={1} className="w-16" />
            <Skeleton variant="figure" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 pt-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
          <Skeleton key={row} variant="row" />
        ))}
      </div>
    </div>
  );
}
