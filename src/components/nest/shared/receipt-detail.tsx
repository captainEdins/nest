"use client";

/**
 * S-10b · Receipt detail — printed-style receipt card (drawer <sm / dialog ≥sm
 * via ResponsiveModal). Full ReceiptDto is resolved from the scoped
 * /api/receipts cache; a payment row's data is the fallback.
 */

import * as React from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PaymentDto, ReceiptDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useReceipts } from "@/hooks/use-overview";
import { formatDate, formatMonthKey } from "./format";
import { StatusBadge } from "./status-badge";
import { ResponsiveModal } from "./responsive-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function receiptFromPayment(payment: PaymentDto): ReceiptDto {
  return {
    receiptNo: payment.receiptNo ?? "",
    paymentId: payment.id,
    amountMinor: payment.amountMinor,
    source: payment.source,
    receivedAt: payment.receivedAt,
    tenancyId: payment.tenancyId ?? "",
    tenantName: payment.matchedLabel ?? payment.phone ?? "",
    tenantPhone: payment.phone ?? "",
    unitLabel: "",
    propertyName: "",
    accountRef: payment.accountReference ?? "",
    allocations: payment.allocations ?? [],
  };
}

function DefRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-label text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={
          mono
            ? "text-body font-medium tabular-nums tracking-wide uppercase text-right break-all"
            : "text-body text-right break-words min-w-0"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function chargeKindLabel(kind: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (kind === "RENT") return t("money.rent");
  if (kind === "WATER") return t("money.water");
  if (kind === "GARBAGE") return t("money.garbage");
  return kind;
}

export function ReceiptDetailModal() {
  const { t } = useI18n();
  const receiptView = useUIStore((s) => s.receiptView);
  const closeReceipt = useUIStore((s) => s.closeReceipt);
  const open = receiptView !== null;

  const { data: receipts, isPending } = useReceipts(open);

  const receipt = React.useMemo<ReceiptDto | null>(() => {
    if (!receiptView) return null;
    const found = receipts?.find((r) => r.receiptNo === receiptView.receiptNo);
    if (found) return found;
    if (receiptView.fallbackPayment) return receiptFromPayment(receiptView.fallbackPayment);
    return null;
  }, [receiptView, receipts]);

  async function shareReceipt() {
    if (!receipt) return;
    const text = [
      `NEST ${t("receipt.receipt")}`,
      receipt.receiptNo,
      `${t("receipt.receivedFrom")}: ${receipt.tenantName}`,
      receipt.unitLabel ? `${t("receipt.forUnit")}: ${receipt.unitLabel}` : null,
      receipt.propertyName ? `${t("receipt.property")}: ${receipt.propertyName}` : null,
      `${t("common.total")}: ${formatKes(receipt.amountMinor)}`,
      `${t("common.date")}: ${formatDate(receipt.receivedAt)}`,
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
      // Share cancelled / clipboard unavailable — no-op (user aborted).
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeReceipt();
      }}
      title={t("receipt.receipt")}
    >
      {open && (!receipt || isPending) ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : receipt ? (
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-h3">NEST</span>
                <span className="text-caption text-muted-foreground">{t("receipt.receipt")}</span>
              </div>
              <p className="text-kpi font-bold tabular-nums tracking-wide uppercase break-all">
                {receipt.receiptNo}
              </p>
              <Separator />
              <dl>
                <DefRow label={t("receipt.receivedFrom")} value={receipt.tenantName} />
                {receipt.unitLabel ? (
                  <DefRow
                    label={t("receipt.forUnit")}
                    value={`${receipt.unitLabel}${receipt.propertyName ? ` · ${receipt.propertyName}` : ""}`}
                  />
                ) : null}
                {receipt.accountRef ? (
                  <DefRow label={t("receipt.accountReference")} value={receipt.accountRef} mono />
                ) : null}
                <DefRow label={t("common.date")} value={formatDate(receipt.receivedAt)} />
                <DefRow label={t("receipt.paymentMethod")} value={<StatusBadge status={receipt.source} />} />
                <DefRow
                  label={t("common.total")}
                  value={<span className="font-semibold tabular-nums">{formatKes(receipt.amountMinor)}</span>}
                />
              </dl>
              {receipt.allocations.length > 0 ? (
                <>
                  <Separator />
                  <p className="text-label font-medium text-muted-foreground">
                    {t("receipt.allocatedTo")}
                  </p>
                  <div className="space-y-1.5">
                    {receipt.allocations.map((allocation) => (
                      <div
                        key={allocation.chargeId}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <p className="text-body min-w-0 truncate">
                          {chargeKindLabel(allocation.chargeKind, t)} · {formatMonthKey(allocation.chargePeriod)}
                        </p>
                        <p className="text-body tabular-nums shrink-0">
                          {formatKes(allocation.amountMinor)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Button
            variant="default"
            className="w-full h-11 sm:h-10"
            onClick={shareReceipt}
          >
            <Share2 aria-hidden />
            {t("receipt.shareReceipt")}
          </Button>
        </div>
      ) : null}
    </ResponsiveModal>
  );
}
