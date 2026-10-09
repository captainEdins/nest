"use client";

/**
 * S-14d · Move-out inspection sheet (Phase 11, issue #78) — the evidence step
 * of the exit arc. Records the MOVE_OUT condition report the deposit
 * settlement requires (the settle route rejects without it), using the
 * Phase 2 POST /api/condition-reports — LANDLORD or CARETAKER.
 *
 * Entry points: the settle modal's "inspection missing" warning card (the
 * landlord is told exactly what unblocks their money decision) and the
 * move-out dialog's inspection chip. One decision of record: the notes,
 * written for both parties to read against at settlement.
 *
 * The hook `useCreateConditionReport` (Phase 2) finally has its consumer.
 */

import * as React from "react";
import { ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useCreateConditionReport } from "@/hooks/use-deposits";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { formatDate } from "@/components/nest/shared/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NOTES_MIN = 10;
const NOTES_MAX = 4000;

export function InspectionSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.inspectionFlow.open);
  const tenancyId = useUIStore((s) => s.inspectionFlow.tenancyId);
  const context = useUIStore((s) => s.inspectionContext);
  const close = useUIStore((s) => s.closeInspection);
  const createReport = useCreateConditionReport();

  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setNotes(""), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const notesValid = notes.trim().length >= NOTES_MIN;

  function submit() {
    if (createReport.isPending || !online || !notesValid || !tenancyId) return;
    createReport.mutate(
      { tenancyId, kind: "MOVE_OUT", notes: notes.trim() },
      {
        onSuccess: () => {
          toast.success(t("notice.inspectionRecordedToast"));
          close();
        },
      },
    );
  }

  const serverError =
    createReport.isError && createReport.error instanceof ApiError
      ? createReport.error.message
      : null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !createReport.isPending) close();
      }}
      title={t("notice.inspectionTitle")}
      description={t("notice.inspectionDesc")}
    >
      <div className="space-y-4">
        {/* The record anchor — whose exit this documents */}
        {context ? (
          <div className="rounded-xl border bg-muted/40 p-4 flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold truncate">
                {context.unitLabel} · {context.tenantName}
              </p>
            </div>
          </div>
        ) : null}

        {/* Notes — the record of record */}
        <div className="space-y-2">
          <Label htmlFor="inspection-notes" className="text-label">
            {t("notice.inspectionNotesLabel")}
          </Label>
          <Textarea
            id="inspection-notes"
            rows={5}
            maxLength={NOTES_MAX}
            value={notes}
            placeholder={t("notice.inspectionNotesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
            className={cn("text-body", notes.length > 0 && !notesValid && "border-destructive")}
            aria-invalid={notes.length > 0 && !notesValid ? true : undefined}
            disabled={createReport.isPending}
          />
          {notes.length > 0 && !notesValid ? (
            <p className="text-caption text-destructive" role="alert">
              {t("notice.inspectionErrorShort")}
            </p>
          ) : (
            <p className="text-caption text-muted-foreground">{t("notice.inspectionHint")}</p>
          )}
        </div>

        {serverError ? (
          <p className="text-caption text-destructive" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Button
            className="w-full h-12 text-body-lg"
            disabled={createReport.isPending || !online || !notesValid}
            aria-busy={createReport.isPending}
            onClick={submit}
          >
            {createReport.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ShieldCheck aria-hidden />
            )}
            {createReport.isPending ? t("notice.inspectionSubmitting") : t("notice.inspectionSubmit")}
          </Button>
          {!online ? (
            <p className="text-caption text-muted-foreground text-center">{t("errors.needOnline")}</p>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}
