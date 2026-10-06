"use client";

/** Section header — h2 heading + optional count chip + "View all" link. */

import { Button } from "@/components/ui/button";

export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ""}`}>
      <h2 className="text-h2 font-semibold flex items-baseline gap-2 min-w-0">
        <span className="truncate">{title}</span>
        {typeof count === "number" ? (
          <span className="text-caption text-muted-foreground tabular-nums">({count})</span>
        ) : null}
      </h2>
      {actionLabel && onAction ? (
        <Button variant="link" size="sm" className="text-label shrink-0 h-11 sm:h-8" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
