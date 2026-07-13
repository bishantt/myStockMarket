import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /news/[cluster], loading: the story's bones — headline, sources, image frame, prose. */
export default function StoryLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-32" />
      <Skeleton variant="text" lines={2} />

      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((source) => (
          <Skeleton key={source} variant="row" />
        ))}
      </div>

      {/* The image reservation is geometry, and stays still. */}
      <div className="aspect-[1.91/1] w-full rounded-card border border-hairline" />

      <Surface className="p-4">
        <Skeleton variant="text" lines={3} />
      </Surface>
    </div>
  );
}
