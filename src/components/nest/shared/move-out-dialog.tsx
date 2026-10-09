"use client";

/**
 * S-14c · Complete move-out dialog (Phase 11, issue #78) — the landlord's and
 * caretaker's exit execution.
 *
 * Opens from a NOTICE unit row (Properties screen for the landlord, Units
 * screen for the caretaker) via `openMoveOut(tenancyId, context)` — the
 * context rides the ui-store like every other flow anchor (matchPayment,
 * settleDeposit). The dialog states the record: unit, tenant, the move-out
 * date on the notice, and that the deposit settlement stays a separate step
 * AFTER the move-out inspection — sequencing the trust story.
 *
 * POST /api/tenancies/[id]/move-out — the server guards the rest (no notice,
 * date not reached, replay, scope). On success the units directory refetch
 * flips the row to VACANT (and the settle-deposit entry appears when the
 * inspection is on record).
 *
 * Optional handover note rides the audit row (keys returned, meter reading).
 */

import * as React from "react";
import { DoorOpen, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useCompleteMoveOut, lifecycleErrorMessage } from "@/hooks/use-lifecycle";
import { useOnline } from "@/components/nest/offline-banner";
import { formatDate } from "@/components/nest/shared/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const NOTE_MAX = 400;

export function MoveOutDialog() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.moveOutFlow.open);
  const tenancyId = useUIStore((s) => s.moveOutFlow.tenancyId);
  const context = useUIStore((s) => s.moveOutContext);
  const close = useUIStore((s) => s.closeMoveOut);
  const openInspection = useUIStore((s) => s.openInspection);
  const moveOut = useCompleteMoveOut();

  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setNote(""), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  function submit() {
    if (moveOut.isPending || !online || !tenancyId) return;
    moveOut.mutate(
      { tenancyId, note: note.trim() || undefined },
      { onSuccess: () => close() },
    );
  }

  const dateLabel = context?.moveOutDate ? formatDate(context.moveOutDate) : "—";
  const serverError = moveOut.isError ? lifecycleErrorMessage(moveOut.error) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !moveOut.isPending) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="size-5 text-primary" aria-hidden />
            {t("notice.moveOutTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("notice.moveOutBody", {
              unit: context?.unitLabel ?? "—",
              tenant: context?.tenantName ?? "—",
              date: dateLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="moveout-note" className="text-label">
              {t("notice.moveOutNoteLabel")}
            </Label>
            <Textarea
              id="moveout-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              placeholder={t("notice.moveOutNotePlaceholder")}
              onChange={(e) => setNote(e.target.value)}
              disabled={moveOut.isPending}
            />
          </div>

          {/* The inspection step — one tap away while executing the exit */}
          <button
            type="button"
            onClick={() => tenancyId && openInspection(tenancyId)}
            className="w-full rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-3 space-y-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors hover:bg-primary/10 dark:hover:bg-primary/15"
          >
            <p className="text-caption font-medium text-primary flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              {t("notice.recordMoveOutReport")}
            </p>
            <p className="text-caption text-muted-foreground">{t("notice.inspectionAction")}</p>
          </button>

          {serverError ? (
            <p className="text-caption text-destructive" role="alert">
              {serverError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="h-11" onClick={close} disabled={moveOut.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            className="h-11"
            onClick={submit}
            disabled={moveOut.isPending || !online}
            aria-busy={moveOut.isPending}
          >
            {moveOut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            {t("notice.moveOutAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
