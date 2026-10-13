"use client";

/**
 * Section header — h2 heading + optional count chip + "View all" link.
 *
 * Phase 21 (D-034): opt-in `variant="classic"` for the role homes — the
 * ledger's section head: serif title, full-width hairline rule under the
 * header row, and a persistently underlined View-all link. The default
 * "soft" rendering is unchanged for every other screen.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  className,
  variant = "soft",
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  variant?: "soft" | "classic";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        // Classic: the hairline rule closes the section head like a ledger
        // subheading; the card below carries the box.
        variant === "classic" && "border-b border-border pb-2",
        className,
      )}
    >
      <h2
        className={cn(
          "flex items-baseline gap-2 min-w-0",
          variant === "classic"
            ? // D-034: serif section title — the document's subheading voice.
              "font-serif text-h3 font-semibold tracking-normal"
            : "text-h2 font-semibold",
        )}
      >
        <span className="truncate">{title}</span>
        {typeof count === "number" ? (
          <span className="text-caption text-muted-foreground tabular-nums">({count})</span>
        ) : null}
      </h2>
      {actionLabel && onAction ? (
        <Button
          variant="link"
          size="sm"
          className={cn(
            "text-label shrink-0 h-11 sm:h-8",
            // Classic: the link is always underlined — a printed cross-
            // reference, not a hover-revealed control.
            variant === "classic" && "underline underline-offset-4 decoration-border hover:decoration-primary",
          )}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
