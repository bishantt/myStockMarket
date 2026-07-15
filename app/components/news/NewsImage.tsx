import Image from "next/image";

import type { NewsCardImage } from "@/lib/news";
import { cx } from "@/lib/cx";

/**
 * NewsImage — the ONE component in this app allowed to render a news visual (plan 7.9, drift rule 20).
 *
 * The imagery drift rule points here: no other `<img>` or `next/image` may reference the media
 * bucket. One door in, so the etiquette (fetched at ingest, never hotlinked at render), the
 * attribution and the zero-layout-shift contract are kept in one file rather than remembered in five.
 *
 * IT RENDERS A REAL STORED IMAGE, OR NOTHING (CC5, R4). Two rungs only:
 *
 *   L1  the publisher's own image, delivered through the news API we license
 *   L2  og:image / twitter:image, fetched from the article page at ingest
 *
 * Both are stored rows and arrive as `image`. A card with no stored image renders NO image frame at
 * all — the room is text-first now, and the headline is the visual. The generated catalyst/publisher
 * cards (the old L3/L4 rungs) are GONE: after weeks of nothing-but-L4 nights, a grey slab carrying
 * the catalyst word — taller than the headline it sat above — was an eye-magnet that said nothing the
 * card's own tag did not (R4 retires it; the finding amended UI-REDESIGN §7.7/7.9's "every card ships
 * a visual"). The caller decides when to render this: NewsImage is only mounted when a real image
 * exists, so its prop is non-null by construction.
 *
 * TODAY, ALMOST NO CARD HAS AN IMAGE, AND THAT IS THE DESIGN TARGET. The media bucket does not exist
 * yet (provisioning row P-1), so the pipeline stores no images and records `news-images:
 * not_configured` on every run. Every article in the recorded feed DID carry a publisher image (160
 * of 160), so L1 will answer for nearly every card the moment a bucket exists — which is a secret and
 * one environment variable, not a code change.
 */

/** The three slots a news visual is rendered into, and the geometry each one owes. */
type Slot = "lead" | "thumb" | "story";

type NewsImageProps = {
  /** A real stored image (L1/L2). The caller only mounts NewsImage when one exists, so never null. */
  image: NewsCardImage;
  slot: Slot;
  /** The lead card is the only thing above the fold by definition, so it is the only eager one. */
  eager?: boolean;
  className?: string;
};

/**
 * `sizes` per slot — what the browser should actually download.
 *
 * Wrong values here do not break anything visible, which is exactly why they get left wrong: the
 * page looks perfect and quietly ships a 1200px file into a 112px box.
 */
const SIZES: Record<Slot, string> = {
  lead: "(min-width: 1024px) 520px, 100vw",
  thumb: "112px",
  story: "(min-width: 1024px) 720px, 100vw",
};

/**
 * The frame every rung shares. The 1.91:1 ratio is the one the publishers themselves shoot for.
 *
 * The lead keeps its ratio at every width; what changes is the COLUMN it sits in. Above `lg` the lead
 * card turns sideways (see NewsCard) and the photo takes 40% of it — beside the headline, not under
 * it — so its height falls out of that instead of swallowing the fold. On a phone it stacks, which is
 * right there: at 390px the same ratio is a comfortable 204px and there is no fold to lose.
 */
const FRAME: Record<Slot, string> = {
  lead: "aspect-[1.91/1] w-full",
  thumb: "aspect-[4/3] w-28 shrink-0",
  // The story page has no filter rows above it and only one thing to say, so its picture may be the
  // full width — but not at any height. A reader who opened one story should see its first paragraph
  // without scrolling.
  story: "aspect-[1.91/1] w-full lg:max-h-[420px]",
};

export function NewsImage({ image, slot, eager = false, className }: NewsImageProps) {
  // L1 / L2 — a real photograph. It renders TRUE in both themes: dimming a photo in dark mode is a
  // designed lie about the photo. The frame adapts; the picture does not.
  return (
    <div
      className={cx(
        FRAME[slot],
        "relative overflow-hidden rounded-card border border-hairline",
        className,
      )}
    >
      <Image
        src={slot === "thumb" ? image.urlThumb : slot === "lead" ? image.urlCard : image.urlFull}
        alt=""
        width={image.width}
        height={image.height}
        sizes={SIZES[slot]}
        loading={eager ? "eager" : "lazy"}
        placeholder={image.blurDataUrl ? "blur" : "empty"}
        blurDataURL={image.blurDataUrl ?? undefined}
        className="size-full object-cover"
      />
    </div>
  );
}
