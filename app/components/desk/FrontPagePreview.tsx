import Link from "next/link";

import { SectionMasthead } from "@/components/SectionMasthead";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";
import type { FrontPagePreviewRow } from "@/lib/morning";
import { catalystLabel, sourcesLine } from "@/lib/news";

/**
 * Module 08 — the Front Page, on the Desk (plan Part 7.6 / 0.1).
 *
 * A GLANCE station and a doorway, and nothing more. It is deliberately NOT a second feed: no
 * images, no context lines, no ticker chips, no move numbers. The Desk's job here is to tell the
 * reader what the day's biggest stories were and get out of the way; the room does the rest. A
 * bounded preview that quietly grew into a feed would give the Desk two heroes and the app two
 * front pages.
 *
 * IT STATES ITS OWN CUT (ruling M8). "First 3 of 14 by significance" — because an unlabelled slice
 * of a ranked list cannot be distinguished from the whole list, and three-of-three and three-of-forty
 * are very different nights. The count is COUNTED, from the database, never typed in.
 *
 * It ships in both of Part 0.1's options, which is what made the sixth tab a cheap decision to
 * reverse: the Desk doorway exists either way, so removing the tab costs the reader one tap, not
 * the room.
 */
export function FrontPagePreview({
  top,
  total,
  asOf,
  editionAsOf,
}: {
  top: FrontPagePreviewRow[];
  total: number;
  asOf?: Date;
  /** The edition's own stamp, for the as-of matches/differs treatment (CC4). */
  editionAsOf?: Date;
}) {
  return (
    <>
      <SectionMasthead index={8} title="Front page" asOf={asOf} editionAsOf={editionAsOf} />

      {top.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">
          No front page has been assembled yet. It is built by the nightly run, after the US close.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 pt-4">
            {top.map((story) => (
              <li key={story.id} className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-0 last:pb-0">
                {/*
                 * THE 44px TOUCH BOX, AND THE REASON IT WAS MISSING IS WORTH KNOWING (PD3).
                 *
                 * This link was 23px tall on a phone and the sweep had been passing anyway — because
                 * the sweep runs on LINUX, where Playfair Display sets wider, the headline wraps to
                 * TWO lines, and two lines of 23px happen to clear 44px. On macOS and iOS metrics the
                 * same headline fits on ONE line, and the tap target is 23px. So on the reader's
                 * actual iPhone this was under the floor the whole time, and the guard was green.
                 *
                 * Verified against the pd-2 tag, not assumed: the identical failure reproduces there,
                 * so this is a latent defect PD3 uncovered rather than one it introduced. A rule that
                 * holds only because a font happened to wrap is not a rule; it is a coincidence.
                 *
                 * `md:min-h-0` gives the height straight back above the phone, exactly as the mover's
                 * source link does — there is no thumb up there, and 44px of headline in a tight list
                 * would be a hole in the card.
                 */}
                <Link
                  href={`/news/${story.id}`}
                  className="flex min-h-11 items-center font-display text-base text-ink underline-offset-2 hover:underline md:min-h-0"
                >
                  {story.headline}
                </Link>
                <span className="flex items-center gap-2">
                  <Tag variant="catalyst">{catalystLabel(story.eventType)}</Tag>
                  <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
                    {sourcesLine(story.sources)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-4">
            <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
              {fill(copy.news.deskPreviewCut, { n: top.length, total })}
            </p>
            <Link
              href="/news"
              className="flex min-h-11 items-center font-ui text-sm text-accent-deep underline-offset-2 hover:underline"
            >
              {copy.news.deskDoorway}
            </Link>
          </div>
        </>
      )}
    </>
  );
}
