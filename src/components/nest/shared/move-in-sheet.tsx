"use client";

/**
 * S-12f · Move-in sheet (Phase 8, issue #72) — the landlord's conversion desk.
 *
 * Opens from an APPROVED application (application detail or the landlord
 * funnel card). Everything of record is prefilled from the application + its
 * listing: tenant name/phone, unit, rent (listing), deposit (one month —
 * the Kenya standard, editable). The date defaults to today. The only new
 * money decisions the landlord makes: confirm rent, confirm deposit, pick
 * the start date.
 *
 * POST /api/move-ins — LANDLORD ONLY. On success the app-shell surfaces the
 * toast with the accountRef and every invalidation (application timeline,
 * listing funnel, overview vacancy totals) refreshes behind the sheet.
 *
 * Money: whole-shilling inputs (inputMode numeric), converted with
 * shillingsToMinor — integers all the way down, per ADR-0004.
 */

import * as React from "react";
import { CalendarDays, Home, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes, minorToShillingsInput, shillingsToMinor } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useApplication, useListing, useMoveIn } from "@/hooks/use-listings";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { ErrorState } from "@/components/nest/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NOTE_MAX = 500;
const MAX_SHILLINGS = 999_999;

export function MoveInSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.moveInOpen);
  const applicationId = useUIStore((s) => s.moveInApplicationId);
  const close = useUIStore((s) => s.closeMoveIn);

  const { data: application, isPending, error } = useApplication(applicationId ?? "");
  const { data: listing } = useListing(application?.listingId ?? "");
  const moveIn = useMoveIn();

  const [rentInput, setRentInput] = React.useState("");
  const [depositInput, setDepositInput] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [note, setNote] = React.useState("");

  // Prefill from the listing of record once it arrives; deposit defaults to
  // one month's rent (the Kenya standard; every seeded tenancy does this).
  const prefilledRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open || !listing) return;
    if (prefilledRef.current === applicationId) return;
    prefilledRef.current = applicationId;
    setRentInput(minorToShillingsInput(listing.rentAmountMinor));
    setDepositInput(minorToShillingsInput(listing.rentAmountMinor));
    setStartDate(new Date().toISOString().slice(0, 10));
    setNote("");
  }, [open, listing, applicationId]);

  // Reset after close (past the slide-out).
  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      prefilledRef.current = null;
      setRentInput("");
      setDepositInput("");
      setStartDate("");
      setNote("");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  const rentMinor = shillingsToMinor(rentInput);
  const depositMinor = shillingsToMinor(depositInput);
  const rentValid = rentMinor != null && rentMinor > 0 && rentMinor <= MAX_SHILLINGS * 100;
  const depositValid = depositMinor != null && depositMinor >= 0 && depositMinor <= MAX_SHILLINGS * 100;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(startDate));
  const formValid = rentValid && depositValid && dateValid;

  function submit() {
    if (moveIn.isPending || !online || !formValid || !application) return;
    moveIn.mutate(
      {
        applicationId: application.id,
        monthlyRentMinor: rentMinor ?? 0,
        depositHeldMinor: depositMinor ?? 0,
        startDate,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: () => close() },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        // Never dismiss mid-conversion — a tenancy in flight.
        if (!next && !moveIn.isPending) close();
      }}
      title={t("agent.moveInTitle")}
      description={t("agent.moveInDesc")}
    >
      <div className="space-y-4">
        {isPending ? (
          <MoveInSkeleton />
        ) : error != null || !application ? (
          <ErrorState />
        ) : (
          <>
            {/* Who + where — the record of record, read-only */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Home className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold truncate">{application.applicantName}</p>
                  <p className="text-caption text-muted-foreground truncate">
                    {application.unitLabel} · {application.propertyName}
                  </p>
                </div>
                <ShieldCheck className="size-4 text-success shrink-0" aria-hidden />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-caption text-muted-foreground flex-1 min-w-0">
                  {t("agent.applicantPhone")}:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {application.applicantPhone}
                  </span>
                </p>
              </div>
            </div>

            {/* Monthly rent */}
            <div className="space-y-2">
              <Label htmlFor="movein-rent" className="text-label">
                {t("agent.moveInRent")}
              </Label>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground font-medium pointer-events-none"
                >
                  KSh
                </span>
                <Input
                  id="movein-rent"
                  inputMode="numeric"
                  autoComplete="off"
                  value={rentInput}
                  placeholder="25,000"
                  onChange={(e) => setRentInput(e.target.value)}
                  className={cn(
                    "h-11 sm:h-10 pl-12 text-body font-medium tabular-nums",
                    rentInput.length > 0 && !rentValid && "border-destructive",
                  )}
                  aria-invalid={rentInput.length > 0 && !rentValid ? true : undefined}
                  disabled={moveIn.isPending}
                />
              </div>
              {rentInput.length > 0 && !rentValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.moveInRentTooLow")}
                </p>
              ) : listing ? (
                <p className="text-caption text-muted-foreground tabular-nums">
                  {t("agent.listingRentLabel")}: {formatKes(listing.rentAmountMinor)} ·{" "}
                  {t("agent.perMonth")}
                </p>
              ) : null}
            </div>

            {/* Deposit to hold */}
            <div className="space-y-2">
              <Label htmlFor="movein-deposit" className="text-label">
                {t("agent.moveInDeposit")}
              </Label>
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground font-medium pointer-events-none"
                >
                  KSh
                </span>
                <Input
                  id="movein-deposit"
                  inputMode="numeric"
                  autoComplete="off"
                  value={depositInput}
                  placeholder="25,000"
                  onChange={(e) => setDepositInput(e.target.value)}
                  className={cn(
                    "h-11 sm:h-10 pl-12 text-body font-medium tabular-nums",
                    depositInput.length > 0 && !depositValid && "border-destructive",
                  )}
                  aria-invalid={depositInput.length > 0 && !depositValid ? true : undefined}
                  disabled={moveIn.isPending}
                />
              </div>
              {depositInput.length > 0 && !depositValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.moveInDepositInvalid")}
                </p>
              ) : (
                <p className="text-caption text-muted-foreground">
                  {t("agent.moveInDepositHint")}
                </p>
              )}
            </div>

            {/* Move-in date */}
            <div className="space-y-2">
              <Label htmlFor="movein-date" className="text-label">
                {t("agent.moveInStart")}
              </Label>
              <div className="relative">
                <CalendarDays
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="movein-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn(
                    "h-11 sm:h-10 pl-9 text-body tabular-nums",
                    startDate.length > 0 && !dateValid && "border-destructive",
                  )}
                  aria-invalid={startDate.length > 0 && !dateValid ? true : undefined}
                  disabled={moveIn.isPending}
                />
              </div>
              {startDate.length > 0 && !dateValid ? (
                <p className="text-caption text-destructive" role="alert">
                  {t("agent.moveInDateInvalid")}
                </p>
              ) : (
                <p className="text-caption text-muted-foreground">
                  {t("agent.moveInStartHint")}
                </p>
              )}
            </div>

            {/* Note (optional) — rides the CONVERTED timeline event */}
            <div className="space-y-2">
              <Label htmlFor="movein-note" className="text-label">
                {t("agent.decisionNote")}
              </Label>
              <Textarea
                id="movein-note"
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                placeholder={t("agent.moveInNotePlaceholder")}
                onChange={(e) => setNote(e.target.value)}
                disabled={moveIn.isPending}
              />
            </div>

            {/* What happens — the trust summary, stated up front */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-3 space-y-1.5">
              <p className="text-caption font-medium text-primary flex items-center gap-1.5">
                <KeyRound className="size-3.5 shrink-0" aria-hidden />
                {t("agent.moveInTrustTitle")}
              </p>
              <ul className="text-caption text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>{t("agent.moveInTrustLease")}</li>
                <li>{t("agent.moveInTrustDeposit")}</li>
                <li>{t("agent.moveInTrustCharge")}</li>
              </ul>
            </div>

            {/* Submit */}
            <div className="space-y-1.5">
              <Button
                className="w-full h-11 sm:h-10"
                disabled={moveIn.isPending || !online || !formValid}
                aria-busy={moveIn.isPending}
                onClick={submit}
              >
                {moveIn.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <KeyRound aria-hidden />
                )}
                {moveIn.isPending ? t("common.loading") : t("agent.moveInConfirm")}
              </Button>
              {!online ? (
                <p className="text-caption text-muted-foreground text-center">
                  {t("errors.needOnline")}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}

function MoveInSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-16 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-11 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 rounded-md" />
      </div>
    </div>
  );
}
