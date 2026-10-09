"use client";

/**
 * S-14a · Give-notice sheet (Phase 11, issue #78) — the tenant's exit moment.
 *
 * Opens from the Statement screen (and the More sheet). Two decisions of
 * record: the move-out date (native date input, min = today) and the reason
 * (kept verbatim on the audit row). The confirm AlertDialog states the exact
 * move-out date and what follows (inspection → deposit settlement) — the
 * trust story is told BEFORE the button commits, not after.
 *
 * POST /api/tenancies/[id]/notice — the server is the guard of record (past
 * dates, > 120 days, replayed notice, wrong role all surface inline from its
 * own messages). On success the overview refetch flips the home banner.
 *
 * Field-worker rules: 44px targets, offline-guarded, no money moves here.
 */

import * as React from "react";
import { CalendarDays, DoorOpen, Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useTenantOverview } from "@/hooks/use-overview";
import { useGiveNotice, useWithdrawNotice, lifecycleErrorMessage } from "@/hooks/use-lifecycle";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { formatDate } from "@/components/nest/shared/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const REASON_MIN = 3;
const REASON_MAX = 400;

export function GiveNoticeSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.giveNoticeOpen);
  const setGiveNoticeOpen = useUIStore((s) => s.setGiveNoticeOpen);
  const { data: overview } = useTenantOverview();
  const giveNotice = useGiveNotice();

  const tenancy = overview?.tenancy;
  const today = new Date().toISOString().slice(0, 10);

  const [moveOutDate, setMoveOutDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Reset on close (past the slide-out).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setMoveOutDate("");
      setReason("");
      setValidationError(null);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(moveOutDate) && !Number.isNaN(Date.parse(moveOutDate));
  const reasonValid = reason.trim().length >= REASON_MIN;
  const formValid = dateValid && reasonValid;

  function confirm() {
    if (giveNotice.isPending || !online || !formValid || !tenancy) return;
    setValidationError(null);
    giveNotice.mutate(
      { tenancyId: tenancy.id, moveOutDate, reason: reason.trim() },
      {
        onSuccess: () => setGiveNoticeOpen(false),
        onError: (error) => setValidationError(lifecycleErrorMessage(error)),
      },
    );
  }

  const serverError = giveNotice.isError ? lifecycleErrorMessage(giveNotice.error) : null;
  const inlineError = validationError ?? serverError;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !giveNotice.isPending) setGiveNoticeOpen(false);
      }}
      title={t("notice.sheetTitle")}
      description={tenancy ? t("notice.sheetSubtitle", { unit: tenancy.unitLabel, property: tenancy.propertyName }) : undefined}
    >
      <div className="space-y-4">
        {/* Move-out date — the commitment of record */}
        <div className="space-y-2">
          <Label htmlFor="notice-date" className="text-label">
            {t("notice.dateLabel")}
          </Label>
          <div className="relative">
            <CalendarDays
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            />
            <Input
              id="notice-date"
              type="date"
              min={today}
              value={moveOutDate}
              onChange={(e) => {
                setMoveOutDate(e.target.value);
                setValidationError(null);
              }}
              className={cn(
                "h-11 sm:h-10 pl-9 text-body tabular-nums",
                moveOutDate.length > 0 && !dateValid && "border-destructive",
              )}
              aria-invalid={moveOutDate.length > 0 && !dateValid ? true : undefined}
              disabled={giveNotice.isPending}
            />
          </div>
          {moveOutDate.length > 0 && !dateValid ? (
            <p className="text-caption text-destructive" role="alert">
              {t("notice.errorNoDate")}
            </p>
          ) : (
            <p className="text-caption text-muted-foreground">{t("notice.dateHint")}</p>
          )}
        </div>

        {/* Reason — rides the audit row verbatim */}
        <div className="space-y-2">
          <Label htmlFor="notice-reason" className="text-label">
            {t("notice.reasonLabel")}
          </Label>
          <Textarea
            id="notice-reason"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            placeholder={t("notice.reasonPlaceholder")}
            onChange={(e) => {
              setReason(e.target.value);
              setValidationError(null);
            }}
            className={cn("text-body", reason.length > 0 && !reasonValid && "border-destructive")}
            aria-invalid={reason.length > 0 && !reasonValid ? true : undefined}
            disabled={giveNotice.isPending}
          />
          {reason.length > 0 && !reasonValid ? (
            <p className="text-caption text-destructive" role="alert">
              {t("notice.errorNoReason")}
            </p>
          ) : null}
        </div>

        {/* What happens next — the trust summary, stated BEFORE the commit */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-3 space-y-1.5">
          <p className="text-caption font-medium text-primary flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            {t("notice.confirmTitle")}
          </p>
          <p className="text-caption text-muted-foreground">
            {t("notice.confirmBody", { date: dateValid ? formatDate(moveOutDate) : "—" })}
          </p>
        </div>

        {/* Inline server/validation error — the server is the guard of record */}
        {inlineError ? (
          <p className="text-caption text-destructive" role="alert">
            {inlineError}
          </p>
        ) : null}

        {/* Submit — AlertDialog confirm states the exact date */}
        <div className="space-y-1.5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full h-12 text-body-lg"
                disabled={giveNotice.isPending || !online || !formValid}
                aria-busy={giveNotice.isPending}
              >
                {giveNotice.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <DoorOpen aria-hidden />
                )}
                {giveNotice.isPending ? t("notice.submitting") : t("notice.confirmAction")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("notice.confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("notice.confirmBody", { date: dateValid ? formatDate(moveOutDate) : "—" })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={confirm}>{t("notice.confirmAction")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!online ? (
            <p className="text-caption text-muted-foreground text-center">{t("errors.needOnline")}</p>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  );
}

/**
 * S-14b · Notice banner (Phase 11) — tenant home + statement.
 *
 * The NOTICE state made visible: move-out date, what follows, and the
 * withdraw action (its own AlertDialog — both decisions stay on record).
 * Withdrawing reloads the overview and the banner disappears.
 */
export function NoticeBanner({ tenancy }: { tenancy: { id: string; unitLabel: string; moveOutDate: string | null } }) {
  const { t } = useI18n();
  const online = useOnline();
  const withdraw = useWithdrawNotice();
  const dateLabel = tenancy.moveOutDate ? formatDate(tenancy.moveOutDate) : "—";

  return (
    <div
      role="status"
      className="rounded-2xl border border-attention/40 bg-attention/10 dark:bg-attention/15 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-attention/20 text-attention">
          <DoorOpen className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-h3 font-semibold">{t("notice.bannerTitle", { date: dateLabel })}</p>
          <p className="text-caption text-muted-foreground mt-0.5">{t("notice.bannerBody")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-11 px-4"
              disabled={withdraw.isPending || !online}
            >
              {withdraw.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Undo2 className="size-4" aria-hidden />
              )}
              {t("notice.bannerWithdraw")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("notice.withdrawTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("notice.withdrawBody", { date: dateLabel })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  withdraw.mutate(tenancy.id, {
                    onError: (error) => {
                      // The server is the guard of record (exit executed
                      // elsewhere, deposit settled…) — never silent.
                      toast.error(lifecycleErrorMessage(error) ?? t("notice.errorGeneric"));
                    },
                  })
                }
              >
                {t("notice.withdrawAction")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
