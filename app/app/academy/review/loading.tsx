import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /academy/review, loading: one centred card bone — the review queue is one card at a time. */
export default function ReviewLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-32" />
      <Surface className="p-6">
        <Skeleton variant="text" lines={1} className="w-24" />
        <div className="pt-6">
          <Skeleton variant="text" lines={3} />
        </div>
      </Surface>
    </div>
  );
}
