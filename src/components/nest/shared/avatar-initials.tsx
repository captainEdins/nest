"use client";

/** Initials avatar — no photos on 3G (design-system §7). */

import { cn } from "@/lib/utils";
import { initialsOf } from "./format";

export function AvatarInitials({
  fullName,
  className,
  size = "md",
}: {
  fullName: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold select-none shrink-0",
        size === "sm" ? "size-8 text-xs" : "size-10 text-label",
        className,
      )}
    >
      {initialsOf(fullName)}
    </span>
  );
}
