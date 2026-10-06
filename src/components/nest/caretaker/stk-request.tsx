"use client";

/**
 * S-07 · Caretaker M-Pesa request flow — pick tenancy → amount → live STK
 * status (poll 3s, ≤120s, aria-live). The prompt goes to the TENANT's phone;
 * caretaker copy asks them to enter the PIN. Sim mode shows the sandbox hook.
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
import { fetchMpesaStatus, useTenancies, type TenancyPickerRow } from "@/hooks/use-overview";
import { formatPhone } from "@/components/nest/shared/format";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { RowSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

type Phase =
  | { step: "pick" }
  | { step: "amount"; tenancy: TenancyPickerRow }
  | {
      step: "status";
      tenancy: TenancyPickerRow;
      amountMinor: number;
      response: StkPushResponseDto;
      state: "pending" | "success" | "failed" | "stillWaiting";
      reason?: string | null;
      receiptNo?: string | null;
    };

export function StkRequestModal() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const stkRequest = useUIStore((s) => s.stkRequest);
  const closeStkRequest = useUIStore((s) => s.closeStkRequest);
  const openReceipt = useUIStore((s) => s.openReceipt);
  const open = stkRequest.open;

  const [phase, setPhase] = React.useState<Phase>({ step: "pick" });
  const [amountInput, setAmountInput] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [pushing, setPushing] = React.useState(false);

  const { data: tenancies, isPending } = useTenancies(open);

  // Preselect + reset on open (once per key).
  const initRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open) {
      initRef.current = null;
      return;
    }
    const key = stkRequest.tenancyId ?? "picker";
    if (initRef.current === key) return;
    if (stkRequest.tenancyId && tenancies === undefined) return;
    initRef.current = key;
    setAmountError(null);
    setPhase({ step: "pick" });
    const preselected = stkRequest.tenancyId
      ? (tenancies ?? []).find((tenancy) => tenancy.id === stkRequest.tenancyId) ?? null
      : null;
    if (preselected) {
      setAmountInput(minorToShillingsInput(preselected.balanceMinor));
      setPhase({ step: "amount", tenancy: preselected });
    }
  }, [open, stkRequest.tenancyId, tenancies]);

  async function sendRequest(tenancy: TenancyPickerRow, amountMinor: number) {
    setPushing(true);
    try {
      const response = await apiPost<StkPushResponseDto>("/api/payments/stk-push", {
        tenancyId: tenancy.id,
        amountMinor,
      });
      setPhase({ step: "status", tenancy, amountMinor, response, state: "pending" });
    } catch (error) {
      toast.error(
        error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
          ? t("errors.network")
          : t("errors.somethingWrong"),
      );
    } finally {
      setPushing(false);
    }
  }

  // Mirror the latest phase for pollers created in the interval closure.
  const phaseRef = React.useRef(phase);
  React.useEffect(() => {
    phaseRef.current = phase;
  });

  async function pollOnce() {
    const current = phaseRef.current;
    if (current.step !== "status") return;
    if (current.state !== "pending" && current.state !== "stillWaiting") return;
    try {
      const status = await fetchMpesaStatus(current.response.checkoutRequestId);
      if (status.status === "SUCCESS") {
        setPhase((prev) =>
          prev.step === "status" ? { ...prev, state: "success", receiptNo: status.receiptNo } : prev,
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
      /* transient poll failure — next tick retries */
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

  // Polling loop (3s, ≤120s); stops on terminal states; re-polls on focus.
  React.useEffect(() => {
    if (phase.step !== "status" || phase.state !== "pending") return;
    let cancelled = false;
    const startedAt = Date.now();
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      const current = phaseRef.current;
      if (current.step === "status" && (current.state === "success" || current.state === "failed")) {
        window.clearInterval(interval);
        return;
      }
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

  const title = t("caretaker.requestMpesa");

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeStkRequest();
      }}
      title={title}
      description={
        phase.step === "pick"
          ? t("common.stepOf", { current: 1, total: 2 })
          : phase.step === "amount"
            ? t("common.stepOf", { current: 2, total: 2 })
            : undefined
      }
    >
      <div aria-live="polite">
        {phase.step === "pick" ? (
          isPending ? (
            <div className="rounded-lg border divide-y" aria-busy>
              {Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : (
            <Command className="rounded-lg border">
              <CommandInput placeholder={t("common.searchTenantUnit")} />
              <CommandList>
                <CommandEmpty>{t("empty.units")}</CommandEmpty>
                {(tenancies ?? []).map((tenancy) => (
                  <CommandItem
                    key={tenancy.id}
                    value={`${tenancy.tenantName} ${tenancy.unitLabel} ${tenancy.propertyName} ${tenancy.accountRef}`}
                    onSelect={() => {
                      setAmountInput(minorToShillingsInput(tenancy.balanceMinor));
                      setPhase({ step: "amount", tenancy });
                    }}
                    className="min-h-11"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium truncate">
                        {tenancy.tenantName} · {tenancy.unitLabel} · {tenancy.propertyName}
                      </p>
                      {tenancy.balanceMinor > 0 ? (
                        <p className="text-caption text-attention tabular-nums">
                          {t("money.balance")} {formatKes(tenancy.balanceMinor)}
                        </p>
                      ) : (
                        <p className="text-caption text-success tabular-nums">{t("tenant.allPaidUp")}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          )
        ) : null}

        {phase.step === "amount" ? (
          <div className="space-y-4">
            <div>
              <p className="text-body font-medium truncate">{phase.tenancy.tenantName}</p>
              <p className="text-caption text-muted-foreground tabular-nums">
                {phase.tenancy.unitLabel} · {phase.tenancy.propertyName} ·{" "}
                {formatPhone(phase.tenancy.tenantPhone)}
              </p>
              <p className="text-caption text-muted-foreground tabular-nums">
                {t("money.balance")} {formatKes(phase.tenancy.balanceMinor)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stk-amount" className="text-label">
                {t("mpesa.enterAmount")}
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-label text-muted-foreground">
                  KES
                </span>
                <Input
                  id="stk-amount"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-14 pl-16 text-kpi font-bold tabular-nums"
                  value={amountInput ? parseInt(amountInput, 10).toLocaleString("en-KE") : ""}
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
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => setPhase({ step: "pick" })}
                disabled={pushing}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="h-11 sm:h-10"
                disabled={pushing}
                onClick={() => {
                  const minor = shillingsToMinor(amountInput);
                  if (minor === null || minor <= 0) {
                    setAmountError(t("errors.invalidAmount"));
                    return;
                  }
                  void sendRequest(phase.tenancy, minor);
                }}
                aria-busy={pushing}
              >
                {pushing ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t("mpesa.sendPaymentRequest")}
              </Button>
            </div>
          </div>
        ) : null}

        {phase.step === "status" ? (
          <div role="status" aria-live="polite" className="space-y-4">
            {phase.state === "pending" || phase.state === "stillWaiting" ? (
              <div
                className={
                  phase.state === "stillWaiting"
                    ? "rounded-lg border bg-muted p-4 space-y-2"
                    : "rounded-lg border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 space-y-2"
                }
              >
                <p className="flex items-center gap-2 text-attention font-semibold">
                  {phase.state === "stillWaiting" ? (
                    <Clock className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  )}
                  {phase.state === "stillWaiting"
                    ? t("mpesa.stillWaiting")
                    : t("mpesa.waitingForConfirmation")}
                </p>
                <p className="text-body">
                  {t("mpesa.askTenantPin", { name: phase.tenancy.tenantName })}
                </p>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {formatKes(phase.amountMinor)} · {phase.tenancy.tenantName} ·{" "}
                  {phase.tenancy.unitLabel} · {formatPhone(phase.response.phone)}
                </p>
                <p className="text-caption text-muted-foreground flex items-center gap-1.5">
                  <TriangleAlert className="size-3.5 text-attention shrink-0" aria-hidden />
                  {t("mpesa.sandboxNotice")}
                </p>
                {phase.response.mode === "sim" && phase.state === "pending" ? (
                  <Button variant="outline" className="w-full h-11 sm:h-10" onClick={simulateSuccess}>
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
                <p className="text-caption text-muted-foreground">
                  {phase.tenancy.tenantName} · {phase.tenancy.unitLabel}
                </p>
                {phase.receiptNo ? (
                  <Button
                    className="w-full h-11 sm:h-10"
                    onClick={() => {
                      closeStkRequest();
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
                  {t("mpesa.failed")}
                </p>
                {phase.reason ? (
                  <p className="text-body text-muted-foreground">
                    {t("mpesa.reason", { reason: phase.reason })}
                  </p>
                ) : null}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="h-11 sm:h-10" onClick={closeStkRequest}>
                    {t("common.done")}
                  </Button>
                  <Button
                    className="h-11 sm:h-10"
                    onClick={() =>
                      setPhase({ step: "amount", tenancy: phase.tenancy })
                    }
                  >
                    {t("common.retry")}
                  </Button>
                </div>
              </div>
            ) : null}

            {phase.state === "pending" ? (
              <div className="flex justify-end">
                <Button variant="ghost" className="h-11 sm:h-10" onClick={closeStkRequest}>
                  {t("mpesa.cancelRequest")}
                </Button>
              </div>
            ) : null}
            {phase.state === "stillWaiting" ? (
              <div className="flex justify-end">
                <Button variant="outline" className="h-11 sm:h-10" onClick={closeStkRequest}>
                  {t("common.done")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
