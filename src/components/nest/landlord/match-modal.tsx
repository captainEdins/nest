"use client";

/**
 * S-04 · Match flow (landlord + caretaker). Step 1: searchable tenancy picker
 * (cmdk Command inside the responsive modal). Step 2: confirm — money-crediting
 * action shown in an amber confirm card. Success → toast + invalidation.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { PaymentDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useTenancies, type TenancyPickerRow } from "@/hooks/use-overview";
import { formatDate, formatPhone } from "@/components/nest/shared/format";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RowSkeleton } from "@/components/nest/shared/skeletons";
import { Card } from "@/components/ui/card";

export function MatchModal() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const online = useOnline();
  const matchPayment = useUIStore((s) => s.matchPayment);
  const closeMatch = useUIStore((s) => s.closeMatch);
  const open = matchPayment !== null;

  const [selected, setSelected] = React.useState<TenancyPickerRow | null>(null);
  const [step, setStep] = React.useState<"pick" | "confirm">("pick");

  const { data: tenancies, isPending } = useTenancies(open);

  // Reset the flow whenever a new payment enters the queue.
  React.useEffect(() => {
    if (matchPayment) {
      setSelected(null);
      setStep("pick");
    }
  }, [matchPayment]);

  const match = useMutation({
    mutationFn: ({ paymentId, tenancyId }: { paymentId: string; tenancyId: string }) =>
      apiPost<PaymentDto>("/api/payments/unmatched/match", { paymentId, tenancyId }),
    onSuccess: (payment) => {
      toast.success(t("unmatched.matchedSuccessfully"), {
        description: payment.receiptNo ?? undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["unmatched"] });
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["tenancies"] });
      closeMatch();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && (error.code === "NETWORK" || error.code === "OFFLINE")
          ? t("errors.needOnline")
          : t("errors.somethingWrong");
      toast.error(message);
    },
  });

  if (!matchPayment) return null;

  const payment = matchPayment;
  const payerLabel = payment.matchedLabel ?? (payment.phone ? formatPhone(payment.phone) : "—");

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeMatch();
      }}
      title={t("unmatched.matchPayment")}
      description={t("unmatched.needsReview")}
    >
      <div aria-live="polite">
        {step === "pick" ? (
          <div className="space-y-3">
            {/* The unmatched payment being resolved */}
            <div className="rounded-lg border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-attention font-semibold tabular-nums">{formatKes(payment.amountMinor)}</p>
                <p className="text-caption text-attention">{t("status.unmatched")}</p>
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                {t("unmatched.paidFrom")} {payerLabel}
              </p>
              {payment.accountReference ? (
                <p className="text-caption text-muted-foreground tabular-nums tracking-wide uppercase mt-0.5">
                  {t("receipt.accountReference")}: {payment.accountReference}
                </p>
              ) : null}
              <p className="text-caption text-muted-foreground mt-0.5">
                {formatDate(payment.receivedAt)} · {t("unmatched.unknownAccountRef")}
              </p>
            </div>

            {isPending ? (
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
                        setStep("confirm");
                      }}
                      className="min-h-11"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium truncate">
                          {tenancy.tenantName} · {tenancy.unitLabel} · {tenancy.propertyName}
                        </p>
                        <p className="text-caption text-muted-foreground tabular-nums tracking-wide uppercase">
                          {tenancy.accountRef}
                          {tenancy.balanceMinor > 0 ? (
                            <span className="text-attention normal-case tracking-normal">
                              {" "}
                              · {t("money.balance")} {formatKes(tenancy.balanceMinor)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Confirm step — amber, money-crediting action */}
            <Card className="border-warning/40 bg-warning/15 dark:bg-warning/10">
              <div className="p-4 space-y-2">
                <p className="flex items-center gap-2 text-attention font-semibold">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {t("unmatched.matchConfirm")}
                </p>
                <div className="space-y-1">
                  <p className="text-body tabular-nums">
                    {formatKes(payment.amountMinor)} · {payerLabel}
                  </p>
                  {payment.accountReference ? (
                    <p className="text-caption text-muted-foreground tabular-nums tracking-wide uppercase">
                      {t("receipt.accountReference")}: {payment.accountReference}
                    </p>
                  ) : null}
                  {selected ? (
                    <p className="text-body">
                      → {selected.tenantName} · {selected.unitLabel} · {selected.propertyName}
                    </p>
                  ) : null}
                  {selected ? (
                    <p className="text-caption text-muted-foreground tabular-nums tracking-wide uppercase">
                      → {t("receipt.accountReference")}: {selected.accountRef}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
            {!online ? (
              <p className="text-caption text-muted-foreground">{t("errors.needOnline")}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => setStep("pick")}
                disabled={match.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="h-11 sm:h-10"
                disabled={!selected || match.isPending || !online}
                onClick={() =>
                  selected && match.mutate({ paymentId: payment.id, tenancyId: selected.id })
                }
                aria-busy={match.isPending}
              >
                {match.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t("unmatched.matchConfirm")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
