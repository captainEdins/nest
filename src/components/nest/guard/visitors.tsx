"use client";

/**
 * S-31 · Guard visitors tab — the gate register (Phase 3, issue #36).
 *
 * GET /api/visitors (shared register at the guard's worked properties,
 * newest-first) rendered in the API's order verbatim — never re-sorted —
 * grouped by local calendar day of enteredAt. Not-yet-exited rows carry the
 * Mark exit action (POST /api/visitors/[id]/exit; the button stays disabled
 * while that row's request is in flight).
 *
 * Also exports the gate-register visual primitives shared with the guard
 * home: PurposeChip (tasteful per-purpose colors, no indigo/blue) and
 * OnSiteBadge (green, subtle pulse).
 */

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { BookOpen, CheckCircle2, Loader2, LogIn, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { VisitorLogDto, VisitorPurpose } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useMarkExit, useVisitorLog } from "@/hooks/use-guard";
import { formatPhone, formatTime } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared visual primitives (guard home reuses both)
// ---------------------------------------------------------------------------

/** Purpose chip — token-palette tones only; never color-alone (label always). */
const PURPOSE_STYLES: Record<VisitorPurpose, string> = {
  VISITOR: "border-primary/40 bg-primary/10 dark:bg-primary/15 text-primary",
  DELIVERY: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
  CONTRACTOR: "border-border bg-muted text-muted-foreground",
  VIEWING: "border-destructive/40 bg-destructive/10 text-destructive",
  OTHER: "border-border bg-transparent text-muted-foreground",
};

export function PurposeChip({
  purpose,
  className,
}: {
  purpose: VisitorPurpose;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-caption font-medium w-fit whitespace-nowrap shrink-0 transition-colors duration-300",
        PURPOSE_STYLES[purpose],
        className,
      )}
    >
      {t(`guard.visitors.purpose.${purpose}` as TranslationKey)}
    </span>
  );
}

/** "On site" badge — green with a subtle live pulse until exit is stamped. */
export function OnSiteBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 text-success px-2 py-0.5 text-caption font-medium w-fit whitespace-nowrap shrink-0 transition-colors duration-300",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-success animate-pulse" />
      {t("guard.visitors.onSite")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Day grouping — labels follow the delivered (newest-first) order
// ---------------------------------------------------------------------------

interface DayGroup {
  key: string;
  label: string;
  rows: VisitorLogDto[];
}

function groupVisitorsByDay(
  visitors: VisitorLogDto[],
  t: ReturnType<typeof useI18n>["t"],
): DayGroup[] {
  const groups: DayGroup[] = [];
  const now = new Date();
  for (const row of visitors) {
    let label: string;
    let key: string;
    try {
      const days = differenceInCalendarDays(now, parseISO(row.enteredAt));
      if (days <= 0) {
        label = t("guard.visitors.today");
        key = "today";
      } else if (days === 1) {
        label = t("guard.visitors.yesterday");
        key = "yesterday";
      } else {
        label = row.enteredAt.slice(0, 10);
        key = label;
      }
    } catch {
      key = row.id;
      label = row.enteredAt;
    }
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.rows.push(row);
    else groups.push({ key, label, rows: [row] });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function GuardVisitors() {
  const { t } = useI18n();
  const setLogVisitorOpen = useUIStore((s) => s.setLogVisitorOpen);
  const { data: visitors, isPending, error, refetch } = useVisitorLog();

  const groups = React.useMemo(
    () => (visitors == null ? [] : groupVisitorsByDay(visitors, t)),
    [visitors, t],
  );
  const todayCount = groups.find((g) => g.key === "today")?.rows.length ?? 0;
  const onSiteCount = visitors?.filter((row) => row.exitedAt == null).length ?? 0;

  return (
    <section aria-label={t("guard.visitorLog")} className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-h2 font-semibold">{t("guard.visitorLog")}</h1>
        {visitors != null ? (
          <div className="flex gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border bg-secondary text-secondary-foreground border-transparent text-caption font-medium tabular-nums">
              <Users className="size-3.5" aria-hidden />
              {t("guard.visitors.todayCount", { count: todayCount })}
            </span>
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-success/40 bg-success/10 text-success text-caption font-medium tabular-nums">
              <LogIn className="size-3.5" aria-hidden />
              {t("guard.visitors.onSiteCount", { count: onSiteCount })}
            </span>
          </div>
        ) : null}
      </div>

      {/* Log visitor — ≤3 taps: open → type name → submit */}
      <Button className="w-full h-12 text-body-lg" onClick={() => setLogVisitorOpen(true)}>
        <UserPlus aria-hidden />
        {t("guard.visitors.logVisitor")}
      </Button>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("guard.visitors.loadError")} />
      ) : isPending ? (
        <ListSkeleton rows={5} />
      ) : visitors == null || visitors.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("guard.visitors.empty")} />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="space-y-2 animate-in fade-in duration-300">
            <h2 className="text-label font-medium text-muted-foreground uppercase tracking-wide">
              {group.label}
            </h2>
            <Card className="divide-y">
              {group.rows.map((row) => (
                <VisitorRow key={row.id} row={row} />
              ))}
            </Card>
          </section>
        ))
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function VisitorRow({ row }: { row: VisitorLogDto }) {
  const { t } = useI18n();
  const markExit = useMarkExit();
  const busy = markExit.isPending && markExit.variables?.id === row.id;
  const exitedAt = row.exitedAt;

  const meta: string[] = [`${t("guard.visitors.entry")} ${formatTime(row.enteredAt)}`, row.unitLabel ?? "—"];
  if (row.visitorPhone) meta.push(formatPhone(row.visitorPhone));

  return (
    <div className="flex items-center gap-3 p-3.5 sm:p-4 min-h-16">
      <AvatarInitials fullName={row.visitorName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{row.visitorName}</p>
        <p className="text-caption text-muted-foreground truncate">{meta.join(" · ")}</p>
        <div className="mt-1">
          <PurposeChip purpose={row.purpose} />
        </div>
      </div>

      {exitedAt != null ? (
        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground shrink-0 whitespace-nowrap tabular-nums">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("guard.visitors.exited")} {formatTime(exitedAt)}
        </span>
      ) : (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <OnSiteBadge />
          <Button
            variant="ghost"
            className="h-11 px-3 text-label"
            disabled={busy || markExit.isPending}
            aria-busy={busy}
            aria-label={t("guard.visitors.markExit")}
            onClick={() => markExit.mutate({ id: row.id, name: row.visitorName })}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("guard.visitors.markExit")}
          </Button>
        </div>
      )}
    </div>
  );
}
