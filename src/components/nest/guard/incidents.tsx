"use client";

/**
 * S-32 · Guard incidents tab — P3-0 CONTRACT STUB (issue #33).
 *
 * Written contract for P3-c (issue #36): the guard's incident queue. Rows:
 * severity chip (CRITICAL pulses — match repairs URGENT), category label,
 * description clamp, filed time, ack status (Seen by {name} / Not yet seen).
 * Header action: Report incident (opens ReportIncidentSheet via ui-store
 * `reportIncidentOpen`; offDutyHint when no active shift).
 * Data: GET /api/incidents (guard scope = shared register at worked
 * properties). i18n: guard.incidents.*.
 */

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GuardIncidents() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <h1 className="text-h3 font-semibold">{t("guard.incidents")}</h1>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
