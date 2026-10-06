"use client";

/**
 * S-31 · Guard visitors tab — the gate register (Phase 3, issue #36).
 *
 * GET /api/visitors (shared register at the guard's worked properties,
 * newest-first) rendered in the API's order verbatim — never re-sorted —
 * grouped by local calendar day of enteredAt.
 *
 * P4-e convergence: the register rows are the SHARED visitor-row component
 * (shared/security/visitor-row.tsx — the same one the landlord/caretaker
 * Security screen renders). This screen owns the exit mutation and arms the
 * row's Mark-exit action (POST /api/visitors/[id]/exit; the button disables
 * on every row while a request is in flight).
 */

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { BookOpen, LogIn, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { VisitorLogDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useMarkExit, useVisitorLog } from "@/hooks/use-guard";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { VisitorRow } from "@/components/nest/shared/security/visitor-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const markExit = useMarkExit();

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
                <VisitorRow
                  key={row.id}
                  visitor={row}
                  onMarkExit={(visitor) =>
                    markExit.mutate({ id: visitor.id, name: visitor.visitorName })
                  }
                  exitPending={markExit.isPending && markExit.variables?.id === row.id}
                  exitDisabled={markExit.isPending}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </section>
  );
}
