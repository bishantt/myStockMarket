import { Skeleton } from "@/components/Skeleton";
import { Surface } from "@/components/Surface";

/** /settings, loading: the heading and three section cards (Appendix C). */
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-8 py-6">
      <Skeleton variant="text" lines={1} className="w-32" />

      {[0, 1, 2].map((card) => (
        <Surface key={card} className="p-5">
          <Skeleton variant="masthead" />
          <div className="pt-4">
            <Skeleton variant="text" lines={2} />
          </div>
        </Surface>
      ))}
    </div>
  );
}
