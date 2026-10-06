"use client";

/**
 * S-33 · Guard shift log (pushed screen, Phase 3, issue #36).
 *
 * GET /api/shifts (all guards' shifts at the guard's worked properties — the
 * handover relay — ACTIVE first, then newest-first). The ACTIVE shift is
 * pinned at the top with the live duration ticker (30s) and the End-shift
 * entry point; past shifts render in delivered order with their handover
 * notes in an italic quote style.
 */

import { Clock, History, LogOut, Power } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { GuardShiftDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { shiftDurationLabel, useDurationTicker, useShifts } from "@/hooks/use-guard";
import { formatDate, formatTime } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function GuardShiftLog() {
  const { t } = useI18n();
  const setEndShiftOpen = useUIStore((s) => s.setEndShiftOpen);
  const { data: shifts, isPending, error, refetch } = useShifts();

  const active = shifts?.find((shift) => shift.endedAt == null) ?? null;
  const past = shifts?.filter((shift) => shift.endedAt != null) ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={3} />
      ) : active == null && past.length === 0 ? (
        <EmptyState icon={Clock} title={t("guard.noShiftsYet")} />
      ) : (
        <>
          {active ? <ActiveShiftCard shift={active} onEndShift={() => setEndShiftOpen(true)} /> : null}

          {past.length > 0 ? (
            <section aria-label={t("guard.pastShifts")}>
              <SectionHeader title={t("guard.pastShifts")} count={past.length} className="mb-3" />
              <Card className="divide-y">
                {past.map((shift) => (
                  <PastShiftRow key={shift.id} shift={shift} />
                ))}
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACTIVE shift — pinned top, live ticker, End-shift entry point
// ---------------------------------------------------------------------------

function ActiveShiftCard({ shift, onEndShift }: { shift: GuardShiftDto; onEndShift: () => void }) {
  const { t } = useI18n();
  const duration = useDurationTicker(shift.startedAt);

  return (
    <Card className="border-l-4 border-l-success bg-success/5 dark:bg-success/10 animate-in fade-in duration-300">
      <CardContent className="p-4 sm:p-6 space-y-3">
        <Badge className="border-transparent bg-success text-success-foreground gap-1.5 w-fit">
          <span aria-hidden className="size-1.5 rounded-full bg-current animate-pulse" />
          {t("guard.activeShift")}
        </Badge>
        <p className="text-body text-muted-foreground">
          {t("guard.onDutyAt", {
            property: shift.propertyName,
            time: formatTime(shift.startedAt),
          })}
        </p>
        <div>
          <p className="text-label font-medium text-muted-foreground">{t("guard.durationLabel")}</p>
          <p className="text-kpi font-bold tabular-nums">{duration ?? "—"}</p>
        </div>
        <Button variant="outline" className="w-full h-11" onClick={onEndShift}>
          <LogOut aria-hidden />
          {t("guard.endShift")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Past shift — started–ended, duration, handover note as an italic quote
// ---------------------------------------------------------------------------

function PastShiftRow({ shift }: { shift: GuardShiftDto }) {
  const { t } = useI18n();
  const duration = shiftDurationLabel(shift, t);

  return (
    <div className="p-4 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-body font-semibold tabular-nums">
          {formatDate(shift.startedAt)} · {formatTime(shift.startedAt)} – {formatTime(shift.endedAt!)}
        </p>
        {duration ? (
          <span className="inline-flex items-center gap-1 text-caption text-muted-foreground tabular-nums shrink-0">
            <History className="size-3.5" aria-hidden />
            {duration}
          </span>
        ) : null}
      </div>
      <p className="text-caption text-muted-foreground">
        {t("guard.visitors.by", { guard: shift.guardName })} · {shift.propertyName}
      </p>
      {shift.notes ? (
        <blockquote className="border-l-2 border-border pl-3 my-1.5 text-body text-muted-foreground italic break-words">
          {shift.notes}
        </blockquote>
      ) : (
        <p className="text-caption text-muted-foreground/70 inline-flex items-center gap-1">
          <Power className="size-3.5" aria-hidden />
          {t("guard.handoverNotes")}: —
        </p>
      )}
    </div>
  );
}
