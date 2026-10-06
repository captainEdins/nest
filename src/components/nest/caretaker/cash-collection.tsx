"use client";

/**
 * S-06 · Cash collection flow (caretaker) — ≤3 taps: pick tenancy → amount →
 * confirm. Works offline: NETWORK/OFFLINE failures queue to the local outbox
 * (clientRef idempotency) and sync when back online (D-012).
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Share2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { PaymentDto } from "@/lib/types";
import { formatKes, minorToShillingsInput, shillingsToMinor } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useTenancies, type TenancyPickerRow } from "@/hooks/use-overview";
import { enqueueOffline } from "@/hooks/use-outbox";
import { formatDate } from "@/components/nest/shared/format";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CashResult {
  receiptNo: string | null;
  amountMinor: number;
  tenantName: string;
  unitLabel: string;
  receivedAt: string;
}

const MAX_SHILLINGS = 999_999;

export function CashFlowModal() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const cashFlow = useUIStore((s) => s.cashFlow);
  const closeCashFlow = useUIStore((s) => s.closeCashFlow);
  const open = cashFlow.open;

  const [selected, setSelected] = React.useState<TenancyPickerRow | null>(null);
  const [step, setStep] = React.useState<"pick" | "amount" | "success">("pick");
  const [amountInput, setAmountInput] = React.useState("");
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [result, setResult] = React.useState<CashResult | null>(null);

  const { data: tenancies, isPending } = useTenancies(open);

  // Preselect (unit-row entry) + reset on open — runs once per open/key.
  const initRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open) {
      initRef.current = null;
      return;
    }
    const key = cashFlow.tenancyId ?? "picker";
    if (initRef.current === key) return;
    if (cashFlow.tenancyId && tenancies === undefined) return; // wait for the picker list
    initRef.current = key;
    setAmountError(null);
    setNote("");
    setResult(null);
    const preselected = cashFlow.tenancyId
      ? (tenancies ?? []).find((tenancy) => tenancy.id === cashFlow.tenancyId) ?? null
      : null;
    if (preselected) {
      setSelected(preselected);
      setAmountInput(minorToShillingsInput(preselected.balanceMinor));
      setStep("amount");
    } else {
      setSelected(null);
      setStep("pick");
    }
  }, [open, cashFlow.tenancyId, tenancies]);

  // Auto-dismiss the success step (~2.5s).
  React.useEffect(() => {
    if (step !== "success") return;
    const timer = window.setTimeout(() => closeCashFlow(), 2_500);
    return () => window.clearTimeout(timer);
  }, [step, closeCashFlow]);

  const recordCash = useMutation({
    mutationFn: (input: { tenancyId: string; amountMinor: number; note?: string; clientRef: string }) => {
      // The browser already knows it is offline — queue instantly instead of
      // waiting for the fetch to fail (D-012; silent-dead networks are still
      // caught by the 30s request timeout in api.ts).
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return Promise.reject(new ApiError("Network request failed", "NETWORK", 0))
      }
      return apiPost<{ payment: PaymentDto; receiptNo: string; replay: boolean }>(
        "/api/payments/cash",
        input,
      )
    },
    onSuccess: (response, variables) => {
      const tenancy = selected;
      setResult({
        receiptNo: response.receiptNo,
        amountMinor: variables.amountMinor,
        tenantName: tenancy?.tenantName ?? "",
        unitLabel: tenancy?.unitLabel ?? "",
        receivedAt: response.payment.receivedAt,
      });
      setStep("success");
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["tenancies"] });
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")) {
        // Offline queue (D-012): the clientRef makes the replay idempotent.
        enqueueOffline({
          kind: "CASH",
          clientRef: variables.clientRef,
          tenancyId: variables.tenancyId,
          amountMinor: variables.amountMinor,
          note: variables.note,
        });
        setResult({
          receiptNo: null,
          amountMinor: variables.amountMinor,
          tenantName: selected?.tenantName ?? "",
          unitLabel: selected?.unitLabel ?? "",
          receivedAt: new Date().toISOString(),
        });
        setStep("success");
        toast.warning(t("offline.queued"));
        return;
      }
      toast.error(
        error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
          ? t("errors.network")
          : t("errors.somethingWrong"),
      );
    },
  });

  async function shareReceipt() {
    if (!result) return;
    const text = [
      `NEST ${t("receipt.receipt")}`,
      result.receiptNo ?? t("cash.receiptFollows"),
      `${t("common.amount")}: ${formatKes(result.amountMinor)}`,
      `${t("receipt.receivedFrom")}: ${result.tenantName}`,
      result.unitLabel ? `${t("receipt.forUnit")}: ${result.unitLabel}` : null,
      `${t("common.date")}: ${formatDate(result.receivedAt)}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success(t("receipt.linkCopied"));
    } catch {
      /* share cancelled — no-op */
    }
  }

  const title = t("caretaker.recordCash");

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeCashFlow();
      }}
      title={title}
      description={
        step === "pick"
          ? t("common.stepOf", { current: 1, total: 3 })
          : step === "amount"
            ? t("common.stepOf", { current: 2, total: 3 })
            : undefined
      }
    >
      <div aria-live="polite">
        {step === "pick" ? (
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
                      setSelected(tenancy);
                      setAmountInput(minorToShillingsInput(tenancy.balanceMinor));
                      setStep("amount");
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

        {step === "amount" && selected ? (
          <div className="space-y-4">
            <div>
              <p className="text-body font-medium truncate">{selected.tenantName}</p>
              <p className="text-caption text-muted-foreground tabular-nums">
                {selected.unitLabel} · {selected.propertyName} · {t("money.balance")}{" "}
                {formatKes(selected.balanceMinor)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-amount" className="text-label">
                {t("caretaker.amountReceived")}
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-label text-muted-foreground">
                  KES
                </span>
                <Input
                  id="cash-amount"
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
                <p className="text-caption text-muted-foreground">
                  {shillingsToMinor(amountInput) !== null &&
                  (shillingsToMinor(amountInput) ?? 0) > selected.balanceMinor
                    ? t("cash.overpaymentCredited")
                    : t("cash.partialAllowed")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-note" className="text-label">
                {t("caretaker.noteOptional")}
              </Label>
              <Textarea
                id="cash-note"
                rows={3}
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => setStep("pick")}
                disabled={recordCash.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="h-11 sm:h-10"
                disabled={recordCash.isPending}
                onClick={() => {
                  const minor = shillingsToMinor(amountInput);
                  const shillings = amountInput ? parseInt(amountInput, 10) : 0;
                  if (minor === null || shillings <= 0 || shillings > MAX_SHILLINGS) {
                    setAmountError(t("errors.invalidAmount"));
                    return;
                  }
                  recordCash.mutate({
                    tenancyId: selected.id,
                    amountMinor: minor,
                    note: note.trim() || undefined,
                    clientRef: crypto.randomUUID(),
                  });
                }}
                aria-busy={recordCash.isPending}
              >
                {recordCash.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t("cash.confirm")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "success" && result ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="size-10 text-success mx-auto" aria-hidden />
            <p className="text-h3 font-semibold">{t("caretaker.collectionRecorded")}</p>
            <div className="rounded-lg border p-4 space-y-1">
              {result.receiptNo ? (
                <p className="text-kpi font-bold tabular-nums tracking-wide uppercase">
                  {result.receiptNo}
                </p>
              ) : (
                <Badge className="bg-warning text-warning-foreground border-transparent">
                  {t("offline.queued")}
                </Badge>
              )}
              <p className="text-body tabular-nums">
                {formatKes(result.amountMinor)} · {result.tenantName} · {result.unitLabel}
              </p>
              {result.receiptNo ? null : (
                <p className="text-caption text-muted-foreground">{t("cash.receiptFollows")}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 sm:h-10" onClick={shareReceipt}>
                <Share2 aria-hidden />
                {t("receipt.shareReceipt")}
              </Button>
              <Button className="flex-1 h-11 sm:h-10" onClick={closeCashFlow}>
                {t("common.done")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
