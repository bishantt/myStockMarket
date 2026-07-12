import { Skeleton } from "@/components/Skeleton";

/**
 * A lesson, loading (Appendix C). Prose bones at the reading measure, so the skeleton has the shape
 * of the thing it is standing in for. There are no figures on a lesson page, so nothing here needs
 * an em-dash slot — the whole page is container.
 */
export default function LessonLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-40" />
      <Skeleton variant="text" lines={1} className="w-3/4 max-w-[65ch]" />
      <div className="max-w-[65ch] pt-4">
        <Skeleton variant="text" lines={8} />
      </div>
    </div>
  );
}
