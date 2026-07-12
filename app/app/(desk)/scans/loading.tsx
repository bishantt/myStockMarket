import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /scans, loading: the heading and two preset-card bones (Appendix C). */
export default function ScansLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-40" />

      {[0, 1].map((card) => (
        <Surface key={card} className="p-5">
          <Skeleton variant="masthead" />
          <div className="flex flex-col gap-3 pt-4">
            <Skeleton variant="text" lines={3} />
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} variant="row" />
            ))}
          </div>
        </Surface>
      ))}
    </div>
  );
}
