"use client";

import { cx } from "@/lib/cx";

/**
 * ExternalLink — an outbound source link (a news article, a filing) that lives inside a clickable
 * Desk row. It opens in a new tab and STOPS the click from bubbling to the row, so tapping the
 * source does not also open the drill rail behind it. Underlined, ink — the editorial link style
 * (plan §3.3: interactive elements are ink + underline, never colour).
 */
export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cx("underline underline-offset-2 hover:text-accent", className)}
    >
      {children}
    </a>
  );
}
