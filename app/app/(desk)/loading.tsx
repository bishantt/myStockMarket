import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/**
 * The Desk, loading (Appendix C).
 *
 * FOUR module bones, not ten. A loading page taller than the viewport is painting for nobody: the
 * reader sees the top of the screen, and by the time they have scrolled the real page has arrived
 * (logged decision, Appendix E-15).
 *
 * The two figure slots — the last-run stamp and the S&P hero — render a still em-dash, never a
 * shimmering bar (ruling M4). The hero is the largest numeral in the app; a pulsing rectangle in its
 * place would be the loudest "a number is coming" signal the product could send.
 */
export default function DeskLoading() {
  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" lines={1} className="w-24" />
        <Skeleton variant="text" lines={1} className="w-64" />
      </div>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="pt-4">
          <Skeleton variant="figure" />
        </div>
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="pt-4">
          <Skeleton variant="figure" />
        </div>
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="pt-4">
          <Skeleton variant="text" lines={2} />
        </div>
      </Surface>

      <Surface className="p-5">
        <Skeleton variant="masthead" />
        <div className="pt-4">
          <Skeleton variant="text" lines={2} />
        </div>
      </Surface>
    </div>
  );
}
