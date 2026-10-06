"use client";

/**
 * S-35 · Security screen (LANDLORD/CARETAKER, More tab) — P3-0 CONTRACT STUB
 * (issue #33).
 *
 * Written contract for P3-d (issue #37): segmented control
 * (security.visitorsSegment | incidentsSegment | shiftsSegment, ui-store
 * `securitySegment`) over:
 * - Visitors: today's register first (in/out, on-site badge, unit, purpose),
 *   then history; empty state security.noVisitors.
 * - Incidents: cards with severity chip, category, description, action
 *   taken, guard attribution, time; unacked cards carry the Acknowledge
 *   action (AlertDialog confirm → POST /api/incidents/[id]/ack; the confirm
 *   states the guard will be notified).
 * - Shifts: on-duty card (live) + past shifts with handover notes.
 * Data: GET /api/visitors, /api/incidents, /api/shifts (property-chain
 * scope). i18n: security.*.
 */

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SecurityScreen() {
  const { t } = useI18n();
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <h1 className="text-h3 font-semibold">{t("security.title")}</h1>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
