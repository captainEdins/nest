"use client";

/**
 * S-09 · Tenant pay flow — amount → phone → live STK status (poll every 3s,
 * ≤120s, aria-live). Sim mode shows the clearly-labelled sandbox confirmation
 * hook (POST /api/mpesa/simulate) — the "customer entered PIN" action.
 */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Smartphone,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { StkPushResponseDto } from "@/lib/types";
import { formatKes, minorToShillingsInput, shillingsToMinor } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useSession, useTenantOverview, fetchMpesaStatus } from "@/hooks/use-overview";
import { formatPhone, formatDate, normalizeKePhone } from "@/components/nest/shared/format";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

type Phase =
  | { step: "amount" }
  | { step: "phone"; amountMinor: number }
  | { step: "status"; amountMinor: number; phone: string; response: StkPushResponseDto; state: "pending" | "success" | "failed" | "stillWaiting"; reason?: string | null; receiptNo?: string | null };

export function PayFlowModal() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const online = useOnline();
  const open = useUIStore((s) => s.payFlowOpen);
  const setOpen = useUIStore((s) => s.setPayFlowOpen);
  const openReceipt = useUIStore((s) => s.openReceipt);

  const { data: session } = useSession();
  const { data: overview } = useTenantOverview();

  const [phase, setPhase] = React.useState<Phase>({ step: "amount" });
  const [amountInput, setAmountInput] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [phoneInput, setPhoneInput] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [pushing, setPushing] = React.useState(false);

  const tenancyId = overview?.tenancy.id ?? null;
  const balanceMinor = overview?.totals.balanceMinor ?? 0;
  const nextDueMinor = overview?.totals.nextDueAmountMinor ?? 0;
  const nextDueDate = overview?.totals.nextDueDate ?? null;

  // Reset whenever the flow opens.
  React.useEffect(() => {
    if (open) {
      setPhase({ step: "amount" });
      setAmountInput(minorToShillingsInput(balanceMinor));
      setAmountError(null);
      setPhoneInput(session?.profile.phone ?? "");
      setPhoneError(null);
    }
  }, [open]);

  function startAmountStep() {
    setPhase({ step: "amount" });
  }

  function goPhone(amountMinor: number) {
    setPhase({ step: "phone", amountMinor });
  }

  async function confirmPayment(amountMinor: number) {
    if (!tenancyId) {
      toast.error(t("errors.somethingWrong"));
      return;
    }
    setPushing(true);
    try {
      const normalized = normalizeKePhone(phoneInput);
      const body: Record<string, unknown> = { tenancyId, amountMinor };
      if (normalized) body.phone = normalized;
      const response = await apiPost<StkPushResponseDto>("/api/payments/stk-push", body);
      setPhase({ step: "status", amountMinor, phone: response.phone, response, state: "pending" });
    } catch (error) {
      const message =
        error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
          ? t("errors.network")
          : t("errors.somethingWrong");
      toast.error(message);
    } finally {
      setPushing(false);
    }
  }

  async function simulateSuccess() {
    if (phase.step !== "status") return;
    try {
      await apiPost("/api/mpesa/simulate", {
        checkoutRequestId: phase.response.checkoutRequestId,
        outcome: "SUCCESS",
      });
      void pollOnce();
    } catch {
      toast.error(t("errors.somethingWrong"));
    }
  }

  async function pollOnce() {
    if (phase.step !== "status") return;
    if (phase.state !== "pending" && phase.state !== "stillWaiting") return;
    try {
      const status = await fetchMpesaStatus(phase.response.checkoutRequestId);
      if (status.status === "SUCCESS") {
        setPhase((prev) =>
          prev.step === "status"
            ? { ...prev, state: "success", receiptNo: status.receiptNo }
            : prev,
        );
        toast.success(t("mpesa.paymentConfirmed"));
        void queryClient.invalidateQueries({ queryKey: ["overview"] });
        void queryClient.invalidateQueries({ queryKey: ["receipts"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } else if (status.status === "FAILED" || status.status === "TIMEOUT") {
        setPhase((prev) =>
          prev.step === "status" ? { ...prev, state: "failed", reason: status.resultDesc } : prev,
        );
      }
    } catch {
      // Transient poll failure — the next tick retries.
    }
  }

  // Polling loop (3s, ≤120s); stillWaiting re-polls on focus.
  React.useEffect(() => {
    if (phase.step !== "status" || phase.state !== "pending") return;
    let cancelled = false;
    const startedAt = Date.now();

    const interval = window.setInterval(async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        window.clearInterval(interval);
        setPhase((prev) => (prev.step === "status" ? { ...prev, state: "stillWaiting" } : prev));
        return;
      }
      await pollOnce();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      if (Date.now() - startedAt < POLL_TIMEOUT_MS) void pollOnce();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [phase.step, phase.step === "status" ? phase.response.checkoutRequestId : null]);

  const title =
    phase.step === "amount"
      ? t("tenant.payViaMpesa")
      : phase.step === "phone"
        ? t("mpesa.phoneNumber")
        : t("tenant.payViaMpesa");

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={
        phase.step === "amount" && overview
          ? `${t("money.balance")} ${formatKes(balanceMinor)}${
              nextDueDate ? ` · ${t("tenant.nextPaymentDue")} ${formatDate(nextDueDate)}` : ""
            }`
          : undefined
      }
    >
      {phase.step === "amount" ? (
        <div className="space-y-4">
          {/* Presets */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setAmountInput(minorToShillingsInput(balanceMinor));
                setAmountError(null);
              }}
              className="h-9 px-3 rounded-full border text-caption font-medium focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              {t("money.balance")} {formatKes(balanceMinor)}
            </button>
            {nextDueMinor > 0 && nextDueMinor !== balanceMinor ? (
              <button
                type="button"
                onClick={() => {
                  setAmountInput(minorToShillingsInput(nextDueMinor));
                  setAmountError(null);
                }}
                className="h-9 px-3 rounded-full border text-caption font-medium focus-visible:ring-2 focus-visible:ring-ring outline-none"
              >
                {t("tenant.amountDue")} {formatKes(nextDueMinor)}
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-amount" className="text-label">
              {t("mpesa.enterAmount")}
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-label text-muted-foreground">
                KES
              </span>
              <Input
                id="pay-amount"
                inputMode="numeric"
                autoComplete="off"
                className="h-14 pl-16 text-kpi font-bold tabular-nums"
                value={formatAmountInput(amountInput)}
                onChange={(e) => {
                  setAmountInput(e.target.value.replace(/[^\d]/g, ""));
                  if (amountError) setAmountError(null);
                }}
                aria-invalid={amountError ? true : undefined}
              />
            </div>
            {amountError ? (
              <p className="text-caption text-destructive" role="alert">
                {amountError}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">{t("cash.partialAllowed")}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              className="h-11 sm:h-10"
              disabled={!online}
              onClick={() => {
                const minor = shillingsToMinor(amountInput);
                if (minor === null || minor <= 0) {
                  setAmountError(t("errors.invalidAmount"));
                  return;
                }
                if (minor > balanceMinor) {
                  setAmountError(t("errors.invalidAmount"));
                  return;
                }
                goPhone(minor);
              }}
            >
              {t("common.continue")}
            </Button>
          </div>
          {!online ? (
            <p className="text-caption text-muted-foreground text-right">{t("errors.needOnline")}</p>
          ) : null}
        </div>
      ) : null}

      {phase.step === "phone" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-phone" className="text-label">
              {t("mpesa.phoneNumber")}
            </Label>
            <Input
              id="pay-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="h-11 sm:h-10 tabular-nums"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              aria-invalid={phoneError ? true : undefined}
            />
            {phoneError ? (
              <p className="text-caption text-destructive" role="alert">
                {phoneError}
              </p>
            ) : null}
          </div>
          <p className="text-caption text-muted-foreground flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 text-attention shrink-0" aria-hidden />
            {t("mpesa.sandboxNotice")}
          </p>
          <div className="flex justify-between gap-2">
            <Button variant="outline" className="h-11 sm:h-10" onClick={() => startAmountStep()}>
              {t("common.back")}
            </Button>
            <Button
              className="h-11 sm:h-10"
              disabled={pushing || !online}
              onClick={() => {
                const normalized = normalizeKePhone(phoneInput);
                if (!normalized) {
                  setPhoneError(t("errors.phoneLooksWrong"));
                  return;
                }
                void confirmPayment(phase.amountMinor);
              }}
              aria-busy={pushing}
            >
              {pushing ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("tenant.confirmPayment")}
            </Button>
          </div>
        </div>
      ) : null}

      {phase.step === "status" ? (
        <div role="status" aria-live="polite" className="space-y-4">
          {phase.state === "pending" || phase.state === "stillWaiting" ? (
            <div
              className={cn(
                "rounded-lg border p-4 space-y-2",
                phase.state === "stillWaiting"
                  ? "border-border bg-muted"
                  : "border-warning/40 bg-warning/15 dark:bg-warning/10",
              )}
            >
              <p className="flex items-center gap-2 text-attention font-semibold">
                {phase.state === "stillWaiting" ? (
                  <Clock className="size-4 shrink-0" aria-hidden />
                ) : (
                  <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                )}
                {phase.state === "stillWaiting" ? t("mpesa.stillWaiting") : t("mpesa.waitingForConfirmation")}
              </p>
              <p className="text-body">{t("mpesa.checkYourPhone")}</p>
              <p className="text-body text-muted-foreground">{t("mpesa.enterPin")}</p>
              <p className="text-caption text-muted-foreground tabular-nums">
                {formatKes(phase.amountMinor)} · {formatPhone(phase.phone)} ·{" "}
                {phase.response.accountReference}
              </p>
              <p className="text-caption text-muted-foreground flex items-center gap-1.5">
                <TriangleAlert className="size-3.5 text-attention shrink-0" aria-hidden />
                {t("mpesa.sandboxNotice")}
              </p>
              {phase.response.mode === "sim" && phase.state === "pending" ? (
                <Button
                  variant="outline"
                  className="w-full h-11 sm:h-10"
                  onClick={simulateSuccess}
                >
                  <Smartphone aria-hidden />
                  {t("mpesa.simulateConfirm")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {phase.state === "success" ? (
            <div className="rounded-lg border border-success/40 bg-success/10 p-4 space-y-2">
              <p className="flex items-center gap-2 text-success font-semibold">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {t("mpesa.paymentConfirmed")}
              </p>
              <p className="text-kpi font-bold tabular-nums">{formatKes(phase.amountMinor)}</p>
              <p className="text-caption text-muted-foreground">{t("tenant.receiptReady")}</p>
              {phase.receiptNo ? (
                <Button
                  variant="default"
                  className="w-full h-11 sm:h-10"
                  onClick={() => {
                    setOpen(false);
                    openReceipt({ receiptNo: phase.receiptNo! });
                  }}
                >
                  {t("common.viewReceipt")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {phase.state === "failed" ? (
            <div className="rounded-lg border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 space-y-2">
              <p className="flex items-center gap-2 text-attention font-semibold">
                <XCircle className="size-4 shrink-0" aria-hidden />
                {t("mpesa.paymentFailed")}
              </p>
              {phase.reason ? (
                <p className="text-body text-muted-foreground">{t("mpesa.reason", { reason: phase.reason })}</p>
              ) : null}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="h-11 sm:h-10" onClick={() => setOpen(false)}>
                  {t("common.done")}
                </Button>
                <Button className="h-11 sm:h-10" onClick={startAmountStep}>
                  {t("common.retry")}
                </Button>
              </div>
            </div>
          ) : null}

          {phase.state === "pending" ? (
            <div className="flex justify-end">
              <Button variant="ghost" className="h-11 sm:h-10" onClick={() => setOpen(false)}>
                {t("mpesa.cancelRequest")}
              </Button>
            </div>
          ) : null}
          {phase.state === "stillWaiting" ? (
            <div className="flex justify-end">
              <Button variant="outline" className="h-11 sm:h-10" onClick={() => setOpen(false)}>
                {t("common.done")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ResponsiveModal>
  );
}

/** Group digits with commas for display in the amount input. */
function formatAmountInput(digits: string): string {
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return digits;
  return n.toLocaleString("en-KE");
}
