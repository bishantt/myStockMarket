import { ChevronDown } from "lucide-react";

/**
 * Chevron — the open/closed marker on a `<details>` summary. It rotates; that is allowed.
 *
 * It lives in its own file for a reason worth writing down. The anti-drift grep (§3.10 rule 6)
 * forbids the words `transition`, `animate` and `@keyframes` anywhere inside a P2 file — the files
 * that render probability and money visuals — because those visuals must never move. SetupCards.tsx
 * is one of them.
 *
 * But the chevron IS allowed to rotate (§3.6): it is a sibling of the probability visuals, never an
 * ancestor of one, so rotating it moves nothing that carries a claim. The file-level grep cannot
 * see that distinction, and it should not have to — a coarse rule that is easy to verify is worth
 * more than a subtle one that is easy to get wrong. So the motion moves out to where it is
 * unambiguously safe, and the P2 file stays literally motionless.
 *
 * The real guarantee is elsewhere anyway: a jsdom test walks up from every `[data-p2]` node and
 * asserts no animated or transformed ancestor. That test is what would catch a genuine violation.
 * This split just keeps the cheap check honest as well.
 */
export function Chevron() {
  return (
    <ChevronDown
      size={16}
      strokeWidth={1.75}
      aria-hidden="true"
      className="shrink-0 text-muted transition-transform duration-(--duration-quick) ease-(--ease-quiet) group-open:rotate-180"
    />
  );
}
