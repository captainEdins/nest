"use client";

/**
 * Empty state (design-system §8) — Phase 16 (D-029) illustration treatment:
 * the icon sits in a tinted concentric blob (two soft circles, brand green or
 * success family) instead of floating as a bare glyph, then title + hint +
 * optional action. No image assets — pure paint, zero network cost.
 */

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
  success = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  success?: boolean;
}) {
  return (
    <div className="py-12 flex flex-col items-center text-center gap-3">
      {/* Concentric tinted blob — decorative, hidden from AT. */}
      <span
        aria-hidden
        className={cn(
          "grid place-items-center size-20 rounded-full",
          success ? "bg-success/10" : "bg-primary/5 dark:bg-primary/10",
        )}
      >
        <span
          className={cn(
            "grid place-items-center size-12 rounded-full",
            success ? "bg-success/15" : "bg-primary/10",
          )}
        >
          <Icon
            className={cn("size-5", success ? "text-success" : "text-primary")}
            aria-hidden
          />
        </span>
      </span>
      <p className="text-body-lg font-medium">{title}</p>
      {hint ? <p className="text-caption text-muted-foreground max-w-xs">{hint}</p> : null}
      {actionLabel && onAction ? (
        <Button size="sm" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
