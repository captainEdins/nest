"use client";

/**
 * S-34b · End-shift sheet (Phase 3, issue #36).
 *
 * Bottom sheet to end the ACTIVE shift: summary (property, started time,
 * live duration) + optional handover note (≤500 — the relay record shown to
 * the next guard and the landlord), confirmed via AlertDialog before
 * POST /api/shifts/[id]/end { notes }.
 */

import * as React from "react";
import { Clock, LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useGuardOverview } from "@/hooks/use-overview";
import { useDurationTicker, useEndShift } from "@/hooks/use-guard";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { formatTime } from "@/components/nest/shared/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const NOTES_MAX = 500;

export function EndShiftSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.endShiftOpen);
  const setOpen = useUIStore((s) => s.setEndShiftOpen);
  const endShift = useEndShift();

  const { data: overview } = useGuardOverview();
  const shift = overview?.activeShift ?? null;
  const duration = useDurationTicker(shift?.startedAt);

  const [notes, setNotes] = React.useState("");

  // Reset the note when the sheet closes (after the slide-out animation).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setNotes(""), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  function submit() {
    if (endShift.isPending || !online || shift == null) return;
    endShift.mutate(
      { id: shift.id, notes: notes.trim() ? notes.trim() : undefined },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("guard.endShiftTitle")}
      description={t("guard.endShiftDesc")}
    >
      <div className="space-y-4">
        {/* Shift summary */}
        {shift ? (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <p className="text-body font-semibold truncate">{shift.propertyName}</p>
            <p className="text-caption text-muted-foreground tabular-nums">
              {t("guard.onDutyAt", {
                property: shift.propertyName,
                time: formatTime(shift.startedAt),
              })}
            </p>
            <p className="inline-flex items-center gap-1.5 text-label font-semibold tabular-nums text-success">
              <Clock className="size-4" aria-hidden />
              {t("guard.durationLabel")} · {duration ?? "—"}
            </p>
          </div>
        ) : null}

        {/* Handover note — the relay record */}
        <div className="space-y-2">
          <Label htmlFor="shift-notes" className="text-label">
            {t("guard.handoverNotes")}
          </Label>
          <Textarea
            id="shift-notes"
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            placeholder={t("guard.handoverPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
            aria-label={t("guard.handoverNotes")}
          />
          <p className="text-caption text-right text-muted-foreground tabular-nums">
            {notes.length}/{NOTES_MAX}
          </p>
        </div>

        {/* Confirm — ending a shift is final (timesheet latches server-side). */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="w-full h-11 sm:h-10"
              disabled={endShift.isPending || !online || shift == null}
              aria-busy={endShift.isPending}
            >
              <LogOut aria-hidden />
              {t("guard.endShift")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("guard.endShiftTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("guard.endShiftDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11 sm:h-10">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 sm:h-10"
                onClick={(e) => {
                  // Prevent the dialog's default close — the sheet closes on success.
                  e.preventDefault();
                  submit();
                }}
              >
                {endShift.isPending ? t("guard.endingShift") : t("guard.endShift")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!online ? (
          <p className="text-caption text-muted-foreground text-center">{t("errors.needOnline")}</p>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
