import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/**
 * /news, loading: the room's bones — a masthead, the filter rows, a lead card and two rows.
 *
 * The card frames are geometry, not shimmer over a price. Ruling M4: a figure slot renders a still
 * em-dash rather than a pulsing bar, because a rectangle throbbing exactly where a number is about
 * to land reads as "something is coming, look here" — the anticipation the stillness rule exists to
 * kill. Container bones may breathe; the things that will hold numbers may not.
 */
export default function NewsLoading() {
  return (
    <div className="flex flex-col gap-5 py-6">
      <Skeleton variant="text" lines={1} className="w-48" />
      <Skeleton variant="text" lines={2} />

      <div className="flex gap-2">
        {[0, 1, 2, 3].map((chip) => (
          <Skeleton key={chip} variant="row" className="w-20" />
        ))}
      </div>

      <Surface className="p-4">
        <div className="aspect-[1.91/1] w-full rounded-card border border-hairline" />
        <div className="flex flex-col gap-2 pt-3">
          <Skeleton variant="text" lines={2} />
        </div>
      </Surface>

      {[0, 1].map((row) => (
        <Surface key={row} className="p-4">
          <Skeleton variant="text" lines={2} />
        </Surface>
      ))}
    </div>
  );
}
