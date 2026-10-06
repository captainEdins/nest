"use client";

/**
 * S-33 · Guard shift log (pushed screen) — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): the guard's shift history with the
 * ACTIVE shift pinned (live duration ticker, guard.durationHours), then past
 * shifts newest-first with handover notes. Reached from the home on-duty
 * card (ui-store pushShiftLog) and the More sheet.
 * Data: GET /api/shifts. i18n: guard.shift*, guard.activeShift,
 * guard.pastShifts, guard.noShiftsYet.
 */

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GuardShiftLog() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <h1 className="text-h3 font-semibold">{t("guard.shiftLog")}</h1>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
