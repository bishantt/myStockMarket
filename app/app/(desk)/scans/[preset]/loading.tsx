import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /scans/[preset], loading (Appendix C): the return link, the recipe card, and the table's bones. */
export default function ScanPresetLoading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Skeleton variant="text" lines={1} className="w-28" />

      <Surface className="p-5">
        <Skeleton variant="text" lines={1} className="w-56" />
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton variant="text" lines={2} />
          {/* The match count is a figure, so it loads as a still em-dash — never a shimmering bar (M4). */}
          <Skeleton variant="figure" />
        </div>
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="flex flex-col pt-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
            <Skeleton key={row} variant="row" />
          ))}
        </div>
      </Surface>
    </div>
  );
}
