"use client";

/**
 * KPI card — Monty-inspired "Soft SaaS" stat card (D-022, Phase 9).
 *
 * Anatomy: uppercase micro-label · 28px tabular bold value · optional
 * month-over-month delta (arrow + pct + context) · optional icon in a tinted
 * round container · optional progress · optional `highlight` hero treatment
 * (solid primary surface — Monty's "Revenue" card).
 *
 * The delta is computed by the CALLER (server supplies monthCollectedPrevMinor
 * in the same overview call — no extra round trips): `deltaPct` is the signed
 * percentage; `null` renders nothing; `undefined` (no history yet) renders a
 * muted "first full month" note.
 */

import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  /** Signed percentage, e.g. +12.5 → "+13%". `null` = delta not computable. */
  deltaPct: number | null;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  sub,
  progressPct,
  highlight = false,
  delta,
  lastMonthValue,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "amber" | "success";
  sub?: React.ReactNode;
  progressPct?: number;
  /** Monty hero treatment — solid primary surface, white-on-green type. */
  highlight?: boolean;
  /** Month-over-month context; renders under the value. */
  delta?: KpiDelta;
  /** Optional absolute "Last month KSh X" caption (used when delta is null). */
  lastMonthValue?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const valueTone = highlight
    ? "text-primary-foreground"
    : tone === "amber"
      ? "text-attention"
      : tone === "success"
        ? "text-success"
        : "text-foreground";

  const clamped =
    typeof progressPct === "number" ? Math.min(100, Math.max(0, progressPct)) : undefined;

  return (
    <Card
      className={cn(
        "transition-shadow",
        highlight && "border-transparent bg-primary nest-card-shadow",
        className,
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              // Monty micro-label: uppercase, tracked, muted.
              "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] leading-5",
              highlight ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          {Icon ? (
            <span
              aria-hidden
              className={cn(
                "size-8 shrink-0 flex items-center justify-center rounded-full",
                highlight ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>

        <p className={cn("text-kpi font-bold tabular-nums mt-1.5", valueTone)}>{value}</p>

        {delta ? (
          delta.deltaPct == null ? (
            lastMonthValue ? (
              <p
                className={cn(
                  "text-caption mt-1.5 tabular-nums",
                  highlight ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {lastMonthValue}
              </p>
            ) : null
          ) : (
            <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-caption font-semibold tabular-nums",
                  delta.deltaPct >= 0
                    ? highlight
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-success/15 text-success"
                    : highlight
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-destructive/10 text-destructive",
                )}
              >
                {delta.deltaPct >= 0 ? (
                  <TrendingUp className="size-3 shrink-0" aria-hidden />
                ) : (
                  <TrendingDown className="size-3 shrink-0" aria-hidden />
                )}
                {formatDeltaPct(delta.deltaPct)}
              </span>
              <span
                className={cn(
                  "text-caption truncate",
                  highlight ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {t("common.vsLastMonth")}
              </span>
            </div>
          )
        ) : null}

        {sub ? (
          <div
            className={cn(
              "text-caption mt-1",
              highlight ? "text-primary-foreground/75" : "text-muted-foreground",
            )}
          >
            {sub}
          </div>
        ) : null}

        {clamped !== undefined ? (
          highlight ? (
            // On the solid-primary hero the stock Progress (bg-primary fill)
            // would vanish — a custom track keeps it visible in both themes.
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clamped}
              className="h-2 mt-3 w-full rounded-full bg-primary-foreground/20 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-primary-foreground transition-all"
                style={{ width: `${clamped}%` }}
              />
            </div>
          ) : (
            <Progress value={clamped} className="h-2 mt-3" aria-hidden />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

/** +12.5 → "+13%" · −4.2 → "−4%" (sign always explicit, integer math). */
export function formatDeltaPct(pct: number): string {
  const rounded = Math.round(Math.abs(pct));
  return `${pct >= 0 ? "+" : "\u2212"}${rounded}%`;
}

/**
 * Month-over-month percentage from two integer-minor amounts.
 * `null` when there is no baseline (prev = 0) — the caller renders a muted
 * "first full month" note instead of a misleading "+∞%".
 */
export function momDeltaPct(currentMinor: number, prevMinor: number): number | null {
  if (prevMinor <= 0) return null;
  return ((currentMinor - prevMinor) / prevMinor) * 100;
}
