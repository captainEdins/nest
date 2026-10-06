"use client";

/**
 * S-10a · Receipts list (tenant tab) — fed by the cached overview receipts.
 * Row → receipt detail (S-10b).
 */

import { ChevronRight, Receipt } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useTenantOverview } from "@/hooks/use-overview";
import { formatDate } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Card } from "@/components/ui/card";

export function TenantReceiptsScreen() {
  const { t } = useI18n();
  const openReceipt = useUIStore((s) => s.openReceipt);
  const { data, isPending, error, refetch } = useTenantOverview();
  const receipts = data?.receipts ?? [];

  return (
    <section aria-label={t("tenant.yourReceipts")}>
      <h1 className="text-h2 font-semibold mb-4">{t("tenant.yourReceipts")}</h1>
      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={6} />
      ) : receipts.length === 0 ? (
        <EmptyState icon={Receipt} title={t("empty.receipts")} />
      ) : (
        <Card className="divide-y">
          {receipts.map((receipt) => (
            <button
              key={receipt.receiptNo}
              type="button"
              onClick={() => openReceipt({ receiptNo: receipt.receiptNo })}
              className="w-full text-left p-4 min-h-14 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold tabular-nums truncate">{receipt.receiptNo}</p>
                <p className="text-caption text-muted-foreground truncate">
                  {receipt.unitLabel} · {receipt.propertyName}
                </p>
                <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                  <StatusBadge status={receipt.source} />
                  {formatDate(receipt.receivedAt)}
                </p>
              </div>
              <p className="text-body font-semibold tabular-nums shrink-0">
                {formatKes(receipt.amountMinor)}
              </p>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </button>
          ))}
        </Card>
      )}
    </section>
  );
}
