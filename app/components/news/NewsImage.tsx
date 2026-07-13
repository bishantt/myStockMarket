import Image from "next/image";

import { catalystLabel } from "@/lib/news";
import type { NewsCardImage } from "@/lib/news";
import { cx } from "@/lib/cx";

/**
 * NewsImage — the ONE component in this app allowed to render a news visual (plan 7.9).
 *
 * The imagery drift rule points here: no other `<img>` or `next/image` may reference the media
 * bucket. One door in, so the etiquette (fetched at ingest, never hotlinked at render), the
 * attribution and the zero-layout-shift contract are kept in one file rather than remembered in
 * five.
 *
 * THE LADDER, AND WHY ITS BOTTOM RUNGS ARE THE POINT.
 *
 *   L1  the publisher's own image, delivered through the news API we license
 *   L2  og:image / twitter:image, fetched from the article page at ingest
 *   L3  the publisher identity card — the outlet's mark on a designed ground
 *   L4  the catalyst identity card — the event's own name, set large
 *
 * L1 and L2 are stored rows and arrive as `image`. L3 and L4 are built here, from tokens, and they
 * are FIRST-CLASS OUTCOMES rather than empty states: same geometry, same frame, same visual weight
 * as a photograph. A text-treatment card sitting next to a photo card must read as an editorial
 * choice, not as a hole where a picture failed to load. Every card ships a visual; there is no
 * failure state on this page.
 *
 * TODAY, ALMOST EVERY CARD IS L4, AND THAT IS NOT A BUG. The media bucket does not exist yet
 * (provisioning row P-1), so the pipeline stores no images and records `news-images:
 * not_configured` on every run. Every article in the recorded feed DID carry a publisher image
 * (160 of 160), so L1 will answer for nearly every card the moment a bucket exists — which is a
 * secret and one environment variable, not a code change. The rungs below it are built properly
 * because they have to carry the room until then, and because the night a publisher serves nothing
 * they carry it again.
 *
 * L3 IS BUILT AND DORMANT. A favicon must be fetched once per domain into our own bucket, with the
 * same etiquette as any other image — so hotlinking one at render is exactly what 7.9 forbids, and
 * without the bucket there is nowhere to keep it. The branch exists, the styleguide exercises it,
 * and it lights up on its own the day P-1 lands. This is a latch, not dead code.
 *
 * ON COLOUR (a deliberate amendment to the plan's "sector-tinted wash"). The plan tints the
 * generated card by sector. Twelve sector hues is twelve new colours whose only job is decoration,
 * and the design law this app is built on says colour is scarce and always means something
 * (UI-REDESIGN-PLAN, which outranks the plan on looks). A reader cannot learn twelve hues, so they
 * would carry no meaning and would only add noise beside the two colours that DO mean something
 * here — up and down. So the ground is one restrained wash in both themes, and the card is
 * distinguished by TYPOGRAPHY: the catalyst's own word, set large in the display serif, with the
 * tickers in mono beneath it. Deterministic from (eventType, tickers), so the pixel oracle can lock
 * it.
 */

/** The three slots a news visual is rendered into, and the geometry each one owes. */
type Slot = "lead" | "thumb" | "story";

type NewsImageProps = {
  /** The stored image (L1/L2), or null to fall to the generated rungs. */
  image: NewsCardImage | null;
  eventType: string;
  tickers: string[];
  /**
   * The outlet, for L3. Today this is always null in the room: a favicon lives in the media bucket,
   * and there is no bucket (P-1). The styleguide passes one so the rung is exercised and locked.
   */
  favicon?: { url: string; source: string } | null;
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
  lead: "(min-width: 1024px) 720px, 100vw",
  thumb: "112px",
  story: "(min-width: 1024px) 720px, 100vw",
};

/** The frame every rung shares. The 1.91:1 ratio is the one the publishers themselves shoot for. */
const FRAME: Record<Slot, string> = {
  lead: "aspect-[1.91/1] w-full",
  thumb: "aspect-[4/3] w-28 shrink-0",
  story: "aspect-[1.91/1] w-full",
};

export function NewsImage({
  image,
  eventType,
  tickers,
  favicon = null,
  slot,
  eager = false,
  className,
}: NewsImageProps) {
  const frame = cx(
    FRAME[slot],
    "relative overflow-hidden rounded-card border border-hairline",
    className,
  );

  // L1 / L2 — a real photograph. It renders TRUE in both themes: dimming a photo in dark mode is a
  // designed lie about the photo. The frame adapts; the picture does not.
  if (image) {
    return (
      <div className={frame}>
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

  // L3 — the publisher identity card. Dormant until P-1 (see the note above).
  if (favicon) {
    return (
      <div className={cx(frame, "flex items-center justify-center gap-2 bg-accent-muted")}>
        <Image src={favicon.url} alt="" width={24} height={24} className="size-6 rounded-sm" />
        <span className="font-display text-sm text-ink-2">{favicon.source}</span>
      </div>
    );
  }

  // L4 — the catalyst identity card. The event names itself.
  return <CatalystCard eventType={eventType} tickers={tickers} slot={slot} frame={frame} />;
}

/**
 * The generated card: the catalyst's word, and the companies it touches.
 *
 * Deterministic from its inputs and built entirely from tokens, so it themes natively and the
 * visual-regression baselines can lock it. It is `aria-hidden` because it says nothing the card's
 * own headline and tags do not already say out loud — a screen reader should not have to hear the
 * word "EARNINGS" twice before reaching the story.
 */
function CatalystCard({
  eventType,
  tickers,
  slot,
  frame,
}: {
  eventType: string;
  tickers: string[];
  slot: Slot;
  frame: string;
}) {
  const label = catalystLabel(eventType);
  const named = tickers.slice(0, 3).join(" · ");

  return (
    <div
      aria-hidden="true"
      data-testid="news-image-generated"
      className={cx(frame, "flex flex-col items-center justify-center gap-1 bg-band-outer px-2 text-center")}
    >
      <span
        className={cx(
          "font-display uppercase leading-none tracking-[0.06em] text-ink-2",
          slot === "thumb" ? "text-2xs" : "text-lg desk:text-2xl",
        )}
      >
        {label}
      </span>
      {named ? (
        <span
          className={cx(
            "font-mono uppercase tracking-[0.08em] text-muted",
            slot === "thumb" ? "text-[9px]" : "text-2xs",
          )}
        >
          {named}
        </span>
      ) : null}
    </div>
  );
}
