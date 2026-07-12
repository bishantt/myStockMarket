import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/**
 * /paper, loading: the ticket's five fields and the cost mirror's receipt (Appendix C).
 * The mirror's total is a money figure, so it loads as a still em-dash, never a shimmer (M4).
 */
export default function PaperLoading() {
  return (
    <div className="flex flex-col gap-8 py-6">
      <Skeleton variant="text" lines={1} className="w-40" />

      <Surface className="p-5">
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton variant="text" lines={1} className="w-20" />
              <Skeleton variant="block" height={44} />
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton variant="text" lines={3} />
          <Skeleton variant="figure" />
        </div>
      </Surface>
    </div>
  );
}
