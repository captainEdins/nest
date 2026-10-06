"use client";

/** Empty state — icon + headline + hint + optional action (design-system §8). */

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="py-12 flex flex-col items-center text-center gap-2">
      <Icon
        className={success ? "size-10 text-success" : "size-10 text-muted-foreground"}
        aria-hidden
      />
      <p className="text-body-lg font-medium">{title}</p>
      {hint ? <p className="text-caption text-muted-foreground max-w-xs">{hint}</p> : null}
      {actionLabel && onAction ? (
        <Button size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
