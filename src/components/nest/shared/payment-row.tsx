"use client";

/**
 * Payment row (S-03 / S-05 / S-17a): payer label, source badge + date,
 * right-aligned tabular money. Tap → receipt detail (S-10b) when a receiptNo
 * exists. UNMATCHED rows get a tint + inline Match action.
 */

import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PaymentDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { formatDate, formatPhone } from "./format";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function paymentRowLabel(payment: PaymentDto): string {
  if (payment.matchedLabel) return payment.matchedLabel;
  if (payment.phone) return formatPhone(payment.phone);
  return "";
}

export function PaymentRow({
  payment,
  onMatch,
  showUnit,
}: {
  payment: PaymentDto;
  /** Inline Match action (unmatched queue rows, landlord/caretaker). */
  onMatch?: (payment: PaymentDto) => void;
  /** Optional unit caption passed by callers that know it. */
  showUnit?: string;
}) {
  const { t } = useI18n();
  const openReceipt = useUIStore((s) => s.openReceipt);
  const openMatch = useUIStore((s) => s.openMatch);

  const unmatched = payment.status === "UNMATCHED";
  const label = paymentRowLabel(payment) || t("status.unmatched");

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium truncate" title={label}>
          {label}
          {showUnit ? <span className="text-muted-foreground font-normal"> · {showUnit}</span> : null}
        </p>
        <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={payment.source} />
          {formatDate(payment.receivedAt)}
          {payment.recordedByName ? (
            <span className="truncate">· {payment.recordedByName}</span>
          ) : null}
        </p>
      </div>
      <p
        className={cn(
          "text-body font-semibold tabular-nums shrink-0",
          unmatched ? "text-attention" : "text-foreground",
        )}
      >
        {formatKes(payment.amountMinor)}
      </p>
      {payment.receiptNo && !unmatched ? (
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
      ) : null}
    </>
  );

  if (unmatched) {
    return (
      <div className="p-4 min-h-14 bg-warning/10 flex items-center gap-3">
        {content}
        <Button variant="outline" size="sm" className="h-11 sm:h-9 shrink-0" onClick={() => (onMatch ? onMatch(payment) : openMatch(payment))}>
          {t("unmatched.matchToTenant")}
        </Button>
      </div>
    );
  }

  if (payment.receiptNo) {
    return (
      <button
        type="button"
        onClick={() => openReceipt({ receiptNo: payment.receiptNo!, fallbackPayment: payment })}
        className="w-full text-left p-4 min-h-14 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none"
      >
        {content}
      </button>
    );
  }

  return <div className="p-4 min-h-14 flex items-center gap-3">{content}</div>;
}
