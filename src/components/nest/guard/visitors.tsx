"use client";

/**
 * S-31 · Guard visitors tab — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): renders the gate register for the
 * guard's shift-scoped properties. Today's section first (newest first,
 * API order verbatim — never re-sorted), then history. Rows show visitor
 * name, purpose chip, optional unit + phone, entry time; not-yet-exited
 * rows carry the Mark exit action (POST /api/visitors/[id]/exit).
 * Header action: Log visitor (opens LogVisitorSheet via ui-store
 * `logVisitorOpen`; disabled with offDutyHint when no active shift).
 * Data: GET /api/visitors via use-guard hooks (P3-c). i18n: guard.visitors.*.
 */

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GuardVisitors() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <h1 className="text-h3 font-semibold">{t("guard.visitorLog")}</h1>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    </div>
  );
}
