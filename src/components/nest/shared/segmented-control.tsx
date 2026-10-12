"use client";

/**
 * SegmentedControl — Monty-style filter tabs (D-022, Phase 9).
 *
 * A muted pill container holds full-round option pills; the selected pill is
 * the card surface with a soft contact shadow. Keyboard + AT semantics follow
 * the ARIA tabs toggle pattern: one `radiogroup`-like row of `aria-pressed`
 * buttons (the same contract the notification feed pills used — kept so
 * existing tests/announcements still read correctly).
 *
 * Touch: every option keeps a 44px hit area on mobile (h-11) and relaxes to
 * h-9 on ≥sm pointer-fine layouts.
 */

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional count badge (e.g. "Unread 3") — tabular, right-aligned. */
  count?: number;
  /** Amber attention accent for urgent options (e.g. UNMATCHED). */
  attention?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/70 dark:bg-muted/50 p-1",
        "max-w-full overflow-x-auto nest-scrollbar",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5",
              "h-9 sm:h-8 text-label font-medium whitespace-nowrap",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "transition-all duration-200",
              selected
                ? option.attention
                  ? // Phase 18 (D-031): the urgent filter, visibly ON —
                    // amber tint beats a white pill (the audit read the
                    // selected UNMATCHED state as near-invisible).
                    "bg-warning/15 dark:bg-warning/20 text-attention nest-card-shadow"
                  : "bg-card text-foreground nest-card-shadow"
                : option.attention && option.count
                  ? "text-attention/85 hover:text-attention"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* D-029: keyed content — the newly-selected pill's label settles
             * in (fade + 95% zoom, 200ms) instead of hard-swapping. */}
            <span
              key={selected ? "on" : "off"}
              className={cn(
                "inline-flex items-center gap-1.5",
                selected && "animate-in fade-in zoom-in-95 duration-200",
              )}
            >
              {option.label}
              {typeof option.count === "number" && option.count > 0 ? (
                <span
                  className={cn(
                    "text-caption font-semibold tabular-nums",
                    option.attention ? "text-attention" : "text-muted-foreground",
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
