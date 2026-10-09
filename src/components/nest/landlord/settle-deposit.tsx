"use client";

/**
 * S-30 · Deposit settlement modal (landlord, Task P2-d — issue #24).
 *
 * Mounted by the app shell for LANDLORD and opened from the Properties screen
 * (NOTICE units). Reads `settleDeposit { open, tenancyId }` from the ui-store.
 *
 * Flow: held amount + tenant context → deduction line editor (reason +
 * INTEGER shillings ×100 to minor on submit, add/remove, live remainder on
 * every keystroke) → AlertDialog confirm with the exact arithmetic → the
 * server is the guard of record (ACTIVE tenancy / missing MOVE_OUT report /
 * over-settle / second settle surface as an inline destructive alert with the
 * server's own message). Success flips the modal to the released ledger
 * summary — the receipt of the money story — while the mutation toasts and
 * invalidates deposit + overview queries.
 *
 * Money rule: everything internal is integer minor units; shillings exist
 * only inside the input fields (shillingsToMinor parses, parseInt only —
 * no floats anywhere).
 */

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatKes, shillingsToMinor } from "@/lib/money";
import type { DepositDto, DepositMovementDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useDeposit, useSettleDeposit } from "@/hooks/use-deposits";
import { useOnline } from "@/components/nest/offline-banner";
import {
  DepositKindBadge,
  movementAmountText,
} from "@/components/nest/shared/deposit-detail";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The server caps settlement at ten deduction lines. */
const MAX_LINES = 10;
/** Duration of the collapse animation when a line is removed (ms). */
const REMOVE_MS = 220;

/** One editor row — shillings as typed; minor units only on submit. */
interface DeductionLine {
  key: number;
  reason: string;
  amount: string;
}

export function SettleDepositModal() {
  const { t } = useI18n();
  const online = useOnline();
  const settleDeposit = useUIStore((s) => s.settleDeposit);
  const closeSettleDeposit = useUIStore((s) => s.closeSettleDeposit);
  const openInspection = useUIStore((s) => s.openInspection);

  const tenancyId =
    typeof settleDeposit.tenancyId === "string" && settleDeposit.tenancyId.length > 0
      ? settleDeposit.tenancyId
      : undefined;
  const open = settleDeposit.open && tenancyId !== undefined;

  const { data: deposit, isPending, error, refetch } = useDeposit(open ? tenancyId : undefined);
  const settle = useSettleDeposit(open ? tenancyId : undefined);

  const [lines, setLines] = React.useState<DeductionLine[]>([]);
  const [removing, setRemoving] = React.useState<ReadonlySet<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const nextKey = React.useRef(0);
  const newReasonRef = React.useRef<HTMLInputElement | null>(null);

  // Full reset on every open/close (the store object identity changes).
  React.useEffect(() => {
    setLines([]);
    setRemoving(new Set());
    setConfirmOpen(false);
    setServerError(null);
    nextKey.current = 0;
  }, [settleDeposit]);

  // -------------------------------------------------------------------
  // Derived money state — recomputed on every keystroke.
  // -------------------------------------------------------------------
  const released = deposit?.status === "RELEASED";
  const heldMinor = deposit?.heldMinor ?? 0;
  const hasMoveOutReport = (deposit?.conditionReports ?? []).some((r) => r.kind === "MOVE_OUT");

  const parsed = lines.map((line) => {
    const minor = shillingsToMinor(line.amount);
    return {
      line,
      minor,
      valid: line.reason.trim().length >= 3 && minor != null && minor > 0,
      hasContent: line.reason.trim().length > 0 || line.amount.length > 0,
    };
  });
  const totalDeductMinor = parsed.reduce((sum, p) => sum + (p.minor ?? 0), 0);
  const remainderMinor = heldMinor - totalDeductMinor;
  const overSet = totalDeductMinor > heldMinor;
  const blockingInvalid = parsed.some((p) => p.hasContent && !p.valid);
  const canSubmit =
    !released &&
    hasMoveOutReport &&
    !blockingInvalid &&
    !overSet &&
    online &&
    !settle.isPending;

  function addLine() {
    if (lines.length >= MAX_LINES) return;
    nextKey.current += 1;
    setLines((prev) => [...prev, { key: nextKey.current, reason: "", amount: "" }]);
    requestAnimationFrame(() => newReasonRef.current?.focus());
  }

  function updateLine(key: number, patch: Partial<Pick<DeductionLine, "reason" | "amount">>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: number) {
    if (removing.has(key)) return;
    setRemoving((prev) => new Set(prev).add(key));
    window.setTimeout(() => {
      setLines((prev) => prev.filter((l) => l.key !== key));
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, REMOVE_MS);
  }

  function submitSettlement() {
    setServerError(null);
    // Only complete lines are sent — an untouched empty row is a draft, not a
    // deduction. The confirm dialog has already shown this exact arithmetic.
    const deductions = parsed
      .filter((p) => p.valid)
      .map((p) => ({ reason: p.line.reason.trim(), amountMinor: p.minor as number }));
    settle.mutate(deductions, {
      onSuccess: () => setConfirmOpen(false),
      onError: (e) => {
        setConfirmOpen(false);
        if (e instanceof ApiError && (e.code === "NETWORK" || e.code === "OFFLINE")) {
          setServerError(t("errors.needOnline"));
        } else if (
          e instanceof ApiError &&
          (e.code === "VALIDATION" || e.code === "CONFLICT")
        ) {
          // The server is the guard of record — show its own words.
          setServerError(e.error);
        } else {
          setServerError(t("errors.somethingWrong"));
        }
      },
    });
  }

  if (!open) return null;

  // Confirm footer — the exact arithmetic, then the server validates. It
  // sticks to the modal foot so submit is reachable on 375px without
  // scrolling the deduction editor.
  const editorActive = !isPending && error == null && deposit != null && !released;
  const confirmFooter = editorActive ? (
    <AlertDialog
      open={confirmOpen}
      onOpenChange={(next) => {
        if (!settle.isPending) setConfirmOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button className="w-full h-11" disabled={!canSubmit} aria-busy={settle.isPending}>
          {settle.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("deposit.settle")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deposit.confirmSettle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deposit.confirmSettleDesc", {
              deductions: formatKes(totalDeductMinor),
              refund: formatKes(remainderMinor),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={settle.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={settle.isPending}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight.
              event.preventDefault();
              submitSettlement();
            }}
          >
            {settle.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("deposit.settle")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : undefined;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        // Never dismiss mid-mutation — money in flight.
        if (!next && !settle.isPending) closeSettleDeposit();
      }}
      title={t("deposit.settle")}
      description={t("deposit.settleDesc")}
      footer={confirmFooter}
    >
      {isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("deposit.loadError")} />
      ) : deposit == null ? null : released ? (
        <ReleasedLedger deposit={deposit} onClose={closeSettleDeposit} />
      ) : (
        <div className="max-h-[52dvh] overflow-y-auto pr-1 space-y-4">
          {/* Held amount + whose deposit this is */}
          <div className="rounded-lg border bg-secondary/40 p-4">
            <p className="text-label text-muted-foreground">{t("deposit.held")}</p>
            <p className="text-h3 font-bold tabular-nums">{formatKes(heldMinor)}</p>
            <p className="text-caption text-muted-foreground mt-0.5 truncate">
              {deposit.tenantName} · {deposit.unitLabel}
            </p>
          </div>

          {/* Missing MOVE_OUT condition report — pre-empted client-side.
           *  Phase 11: the warning is now actionable — record the inspection
           *  without leaving the settle flow (InspectionSheet). */}
          {!hasMoveOutReport ? (
            <Card className="border-warning/40 bg-warning/15 dark:bg-warning/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert className="size-4 text-attention shrink-0 mt-0.5" aria-hidden />
                  <p className="text-body text-attention">{t("deposit.needsMoveOut")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() =>
                    openInspection(tenancyId, {
                      unitLabel: deposit.unitLabel,
                      tenantName: deposit.tenantName,
                    })
                  }
                >
                  <ClipboardCheck className="size-4" aria-hidden />
                  {t("notice.inspectionAction")}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Server rejection — its own message (tenancy not ending, over-settle, already settled…) */}
          {serverError ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle aria-hidden />
              <AlertTitle>{serverError}</AlertTitle>
            </Alert>
          ) : null}

          {/* Deduction lines */}
          <div className="space-y-2">
            <p className="text-label font-medium">{t("deposit.deductionLines")}</p>
            {parsed.length === 0 ? (
              <p className="text-caption text-muted-foreground">{t("deposit.noDeductionsLine")}</p>
            ) : (
              <div className="space-y-2">
                {parsed.map((p, index) => (
                  <div
                    key={p.line.key}
                    className={cn(
                      "overflow-hidden transition-all duration-200 ease-in-out",
                      removing.has(p.line.key) ? "max-h-0 opacity-0" : "max-h-96 opacity-100",
                    )}
                  >
                    <DeductionLineEditor
                      line={p.line}
                      invalid={p.hasContent && !p.valid}
                      isLast={index === parsed.length - 1}
                      reasonRef={newReasonRef}
                      onReasonChange={(reason) => updateLine(p.line.key, { reason })}
                      onAmountChange={(amount) => updateLine(p.line.key, { amount })}
                      onRemove={() => removeLine(p.line.key)}
                    />
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full h-11 border-dashed"
              disabled={lines.length >= MAX_LINES}
              onClick={addLine}
            >
              <Plus aria-hidden />
              {t("deposit.addLine")}
            </Button>
          </div>

          {/* Live remainder — recomputed on every keystroke */}
          <div
            aria-live="polite"
            className={cn(
              "rounded-lg border p-4 flex items-baseline justify-between gap-3 transition-colors",
              overSet ? "border-destructive/40 bg-destructive/10" : "bg-secondary/40",
            )}
          >
            <p className="text-label font-medium">{t("deposit.remainder")}</p>
            <p
              key={remainderMinor}
              className={cn(
                "text-h3 font-bold tabular-nums animate-in zoom-in-95 duration-200 fill-mode-both",
                overSet && "text-destructive",
              )}
            >
              {formatKes(remainderMinor)}
            </p>
          </div>
          {overSet ? (
            <p className="text-caption text-destructive font-medium">{t("deposit.tooMuch")}</p>
          ) : null}
          {!online ? (
            <p className="text-caption text-muted-foreground">{t("errors.needOnline")}</p>
          ) : null}
        </div>
      )}
    </ResponsiveModal>
  );
}

// ---------------------------------------------------------------------------
// One deduction line — reason + INTEGER shillings (parsed with
// shillingsToMinor; anything non-numeric or ≤ 0 is rejected inline).
// ---------------------------------------------------------------------------

function DeductionLineEditor({
  line,
  invalid,
  isLast,
  reasonRef,
  onReasonChange,
  onAmountChange,
  onRemove,
}: {
  line: DeductionLine;
  invalid: boolean;
  /** The most recently added line carries the focus target. */
  isLast: boolean;
  reasonRef: React.RefObject<HTMLInputElement | null>;
  onReasonChange: (reason: string) => void;
  onAmountChange: (amount: string) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both",
        invalid && "border-destructive/50",
      )}
    >
      <Input
        ref={isLast ? reasonRef : undefined}
        value={line.reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder={t("deposit.reasonPlaceholder")}
        aria-label={t("deposit.reason")}
        aria-invalid={invalid}
        autoComplete="off"
        className="h-11"
      />
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground pointer-events-none"
            aria-hidden
          >
            KSh
          </span>
          <Input
            inputMode="decimal"
            value={line.amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder={t("deposit.amountPlaceholder")}
            aria-label={t("common.amount")}
            aria-invalid={invalid}
            autoComplete="off"
            className="h-11 pl-11 tabular-nums"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          onClick={onRemove}
          aria-label={t("deposit.removeLine")}
        >
          <X aria-hidden />
        </Button>
      </div>
      {invalid ? (
        <p className="text-caption text-destructive">{t("deposit.invalidLine")}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Released state — the receipt: status + the full append-only ledger.
// Shown for an already-settled deposit and right after a settlement succeeds
// (the mutation seeds the fresh payload into the query cache).
// ---------------------------------------------------------------------------

function ReleasedLedger({ deposit, onClose }: { deposit: DepositDto; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-success/40 bg-success/10 dark:bg-success/15 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both">
        <CheckCircle2 className="size-5 text-success shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-body font-semibold">{t("deposit.statusReleased")}</p>
          <p className="text-caption text-muted-foreground truncate">
            {deposit.tenantName} · {deposit.unitLabel}
          </p>
        </div>
      </div>
      <div>
        <p className="text-label font-medium text-muted-foreground mb-2">{t("deposit.movements")}</p>
        <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
          {deposit.movements.map((movement: DepositMovementDto) => (
            <div
              key={movement.id}
              className="flex items-start justify-between gap-3 p-3 animate-in fade-in duration-300 fill-mode-both"
            >
              <div className="min-w-0">
                <DepositKindBadge kind={movement.kind} />
                <p className="text-caption text-muted-foreground mt-1 break-words">
                  {movement.reason ?? "—"}
                </p>
              </div>
              <p
                className={cn(
                  "text-body font-semibold tabular-nums shrink-0",
                  movement.kind === "DEDUCT" && "text-attention",
                  movement.kind === "REFUND" && "text-success",
                )}
              >
                {movementAmountText(movement.kind, movement.amountMinor)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <Button className="w-full h-11" onClick={onClose}>
        {t("common.done")}
      </Button>
    </div>
  );
}
