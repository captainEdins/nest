"use client";

/**
 * ClassicMasthead (Phase 21, D-034 — the classic home) — the ledger
 * letterhead that replaces the Phase 17 cream hero panel on the five role
 * homes. The classic documents register:
 *
 *   eyebrow   — small-caps estate line (month · plot) in Poppins
 *   greeting  — the SERIF display voice (system stack, zero download)
 *   the rule  — the print double-rule: 2px primary + 1px hairline 3px below
 *   stats     — the estate figures, tabular Poppins, under the rule
 *   aside     — optional right block (≥md): the live figure (rate, clock)
 *
 * The masthead sits directly ON the canvas (no card, no shadow — a
 * letterhead is printed on the page, not floated above it). Data stays
 * Poppins; only the greeting speaks in serif.
 */

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ClassicMasthead({
  eyebrow,
  greeting,
  stats,
  aside,
  className,
}: {
  /** Small-caps context line — property · period, uppercase-tracked Poppins. */
  eyebrow?: React.ReactNode;
  /** The serif greeting (h1). */
  greeting: string;
  /** Figure lines under the rule (the estate's context sentence). */
  stats?: React.ReactNode;
  /** Right-aligned live figure block (≥md) — the desk's pulse. */
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("min-w-0", className)}>
      <div className="flex items-end justify-between gap-6 md:gap-10">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-caption font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-serif text-h2 lg:text-display font-semibold leading-tight text-foreground mt-1 truncate">
            {greeting}
          </h1>
        </div>
        {aside ? <div className="shrink-0 hidden md:block text-right">{aside}</div> : null}
      </div>
      {/* The double rule — the ledger signature. */}
      <div className="nest-rule mt-3" aria-hidden />
      {stats ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 min-w-0">{stats}</div>
      ) : null}
      {aside ? <div className="md:hidden mt-3">{aside}</div> : null}
    </header>
  );
}

/** One masthead stat — small-caps label, tabular Poppins value. Baseline
 *  aligned inside the flex row so mixed labels share one line. */
export function MastheadStat({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  tone?: "default" | "attention" | "success";
  className?: string;
}) {
  return (
    <p className={cn("text-caption uppercase tracking-[0.1em] text-muted-foreground tabular-nums", className)}>
      {label}{" "}
      <span
        className={cn(
          "text-body font-semibold tracking-normal normal-case",
          tone === "attention" ? "text-attention" : tone === "success" ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </span>
    </p>
  );
}

/** The masthead's right-hand live figure (the collection rate / clock slot). */
export function MastheadAside({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="min-w-0">
      <p className="text-caption font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
        {label}
      </p>
      <p
        className={cn(
          "text-h3 font-bold tabular-nums leading-8 mt-0.5",
          tone === "success" ? "text-success" : "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Masthead-shaped skeleton — serif line, rule, stat lines (never a spinner). */
export function MastheadSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-8 lg:h-9 w-56 sm:w-72 mt-2" />
      <div className="h-[2px] w-full bg-muted mt-3" />
      <div className="h-px w-full bg-muted mt-[3px]" />
      <div className="flex gap-6 mt-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
