import { copy } from "@/lib/copy";

/**
 * NewTag — the quiet "new" mark on a row first published in the current edition (CC10, ruling R8).
 *
 * R8: NEW IS INFORMATION, NEVER URGENCY. It is a lowercase mono word in the muted ink, the same weight
 * as any other meta — no count, no badge, no colour, no red, and (the P2 rule, if it ever sits near
 * money) nothing that moves. It is edition-relative: the caller decides `isNew` by comparing a row's
 * first-seen to the prior edition's press time, so it is safe on a cached page, tracks no reader, and
 * falls away with the next edition. This is the ONE renderer of the tag and copy.ts owns the word —
 * a second door is how the "new" mark would drift into a shout (the sibling-bug rule this build keeps).
 */
export function NewTag() {
  return (
    <span
      title={copy.news.newTagTitle}
      className="ml-1.5 whitespace-nowrap align-baseline font-mono text-xs font-normal lowercase text-muted"
    >
      {copy.news.newTag}
    </span>
  );
}
