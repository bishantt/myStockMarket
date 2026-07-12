import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /academy, loading: the heading and three module-card bones (Appendix C). */
export default function AcademyLoading() {
  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="flex flex-col gap-3">
        <Skeleton variant="text" lines={1} className="w-56" />
        <Skeleton variant="text" lines={2} />
      </div>

      {[0, 1, 2].map((card) => (
        <Surface key={card} className="p-5">
          <Skeleton variant="text" lines={1} className="w-24" />
          <div className="flex flex-col gap-1 pt-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} variant="row" />
            ))}
          </div>
        </Surface>
      ))}
    </div>
  );
}
