import { SectionMasthead } from "@/components/SectionMasthead";
import { Surface } from "@/components/Surface";
import { cx } from "@/lib/cx";

/**
 * EmptyModule — a module with nothing in it yet, rendered as a slim information band (PD3, Law 2).
 *
 * This was a page-local `Placeholder` helper inside the Desk. It is a component now because it is
 * about to have consumers on several rooms, and because Law 2 gives it a contract that has to hold
 * in one place rather than five:
 *
 *   **A module with no content takes only the height it earns.**
 *
 * That law exists because of the defect PD3 was commissioned to kill. A short module used to dig a
 * hole in the Desk's grid, and the emptiest module is the shortest one — so the empty state was the
 * worst offender in the room. Law 1 (independent column flow) removes the mechanism that turned a
 * short module into a hole; this component removes the temptation to pad it back out.
 *
 * WHY IT RESERVES NO HEIGHT. Nothing here sets `min-h`, a fixed height, or an aspect box — and
 * check-drift rule 24 fails the build if anything ever does, on any module Surface. A reserved
 * height is a promise that content is coming to fill it. On the night the pipeline did not run,
 * that promise is a lie told in whitespace, and the reader has to scroll past it either way.
 *
 * THE VOICE: information, not an apology (the copy deck's standing rule). "The evening briefing
 * lands after the close" states a fact about the schedule. "Sorry, no briefing is available right
 * now" would be the same absence, dressed as a failure. The `note` a caller passes is held to that
 * standard — it says what the slot is for and when it fills, and it never apologises.
 *
 * THE TIMESTAMP IS OPTIONAL, AND THAT IS AN HONESTY RULE, NOT A CONVENIENCE.
 * The constitution puts a timestamp on everything — but it also forbids stamping a module with a
 * date nothing computed. Both are true here, and which one applies depends on WHY the module is
 * empty:
 *
 *   · The pipeline ran, and this module simply has nothing tonight (no setup cards fired). There IS
 *     an as-of — the run's — and the absence is a finding as of that moment. Pass `asOf`.
 *   · Nothing has ever run, so there is no as-of to give. Omit it. The Desk does exactly this: it
 *     passes `asOf` only when `morning.asOf` exists, and on an empty database every module renders
 *     its band with no stamp rather than borrowing the wall clock.
 *
 * A fabricated timestamp is worse than no timestamp, because a reader believes it.
 *
 * THERE IS NO SHIMMER HERE, AND ITS REMOVAL IS THE POINT (PD3, booked in DECISIONS.md).
 * The page-local Placeholder this replaces ended with a shimmering bar — the app's one sanctioned
 * loading animation, legal on an empty structural slot. Two things were wrong with it.
 *
 * It was a LIE on the state that matters most. A shimmer means "content is on its way, wait for it".
 * That is true on an empty database, where the nightly has simply not run yet. It is false on a thin
 * night — the run happened, the setup cards did not fire, and NOTHING is coming. The shimmer told
 * the reader to wait for something that does not exist, which is the exact species of small dishonesty
 * this product exists to refuse. And "the run found nothing" is the common case; "the database is
 * empty" happens once.
 *
 * And it cost 20px of the band's 112px budget to say, in motion, what the note already says in words.
 * Removing it brought the band from 124px to ~104px, inside the plan's number. The two arguments point
 * the same way, which is usually a sign the answer is right.
 */
export function EmptyModule({
  index,
  title,
  note,
  asOf,
  className,
}: {
  /** The module's position in the ritual order — the same index its filled state carries. */
  index: number;
  /** The module name, sentence case. The filled state's title, unchanged. */
  title: string;
  /** One line: what belongs in this slot, and when it arrives. Information, never an apology. */
  note: string;
  /** When the run that found nothing was computed. Omit when nothing has ever run (see above). */
  asOf?: Date;
  className?: string;
}) {
  return (
    <Surface className={cx("p-5", className)}>
      <SectionMasthead index={index} title={title} asOf={asOf} />
      <p className="max-w-[62ch] pt-3 font-ui text-sm text-muted">{note}</p>
    </Surface>
  );
}
