"use client";

/**
 * S-17a · Payments ledger (landlord "Payments" tab / caretaker "Collections"
 * tab). Data = overview.recentPayments (no separate payments endpoint in the
 * Phase 1 backend). Filter chips: All · M-Pesa · Cash · Unmatched (amber).
 * Mobile: stacked cards · ≥sm: table.
 */

import { useI18n } from "@/lib/i18n";
import type { PaymentDto, PaymentSource } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useCaretakerOverview, useLandlordOverview } from "@/hooks/use-overview";
import { formatDate } from "@/components/nest/shared/format";
import { paymentRowLabel, PaymentRow } from "@/components/nest/shared/payment-row";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Receipt } from "lucide-react";

type Filter = "ALL" | "MPESA" | "CASH" | "UNMATCHED";

const FILTERS: { value: Filter; labelKey: "common.filterAll" | "source.mpesa" | "source.cash" | "status.unmatched" }[] = [
  { value: "ALL", labelKey: "common.filterAll" },
  { value: "MPESA", labelKey: "source.mpesa" },
  { value: "CASH", labelKey: "source.cash" },
  { value: "UNMATCHED", labelKey: "status.unmatched" },
];

export function PaymentsLedger({ variant }: { variant: "landlord" | "caretaker" }) {
  const { t } = useI18n();
  const filter = useUIStore((s) => s.paymentsFilter);
  const setFilter = useUIStore((s) => s.setPaymentsFilter);

  const landlordQuery = useLandlordOverview();
  const caretakerQuery = useCaretakerOverview();
  const query = variant === "landlord" ? landlordQuery : caretakerQuery;
  const { data, isPending, error, refetch } = query;

  const payments: PaymentDto[] = data?.recentPayments ?? [];
  const filtered =
    filter === "ALL"
      ? payments
      : filter === "UNMATCHED"
        ? payments.filter((p) => p.status === "UNMATCHED")
        : payments.filter((p) => p.source === (filter as PaymentSource));

  const title = variant === "landlord" ? t("nav.payments") : t("nav.collections");
  const unmatchedCount = payments.filter((p) => p.status === "UNMATCHED").length;

  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h1 className="text-h2 font-semibold">{title}</h1>
        {unmatchedCount > 0 ? (
          <span className="text-caption text-attention font-medium tabular-nums">
            {t("status.unmatched")}: {unmatchedCount}
          </span>
        ) : null}
      </div>
      <p className="text-caption text-muted-foreground mb-4">
        {variant === "landlord" ? t("landlord.recentPayments") : t("caretaker.recentCollections")}
      </p>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("common.status")}>
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "shrink-0 h-11 px-4 rounded-full text-caption font-medium border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring outline-none",
                  filter === option.value
                    ? option.value === "UNMATCHED"
                      ? "border-warning text-attention bg-warning/15"
                      : "bg-secondary text-secondary-foreground border-transparent"
                    : "border-border text-muted-foreground",
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={filter === "UNMATCHED" ? t("empty.unmatched") : t("empty.payments")}
              success={filter === "UNMATCHED"}
            />
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <Card className="divide-y sm:hidden">
                {filtered.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </Card>

              {/* ≥sm: table */}
              <Card className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("receipt.receivedFrom")}</TableHead>
                      <TableHead className="text-right">{t("common.amount")}</TableHead>
                      <TableHead>{t("receipt.paymentMethod")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-right" aria-label={t("unmatched.matchToTenant")} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((payment) => (
                      <TableRow key={payment.id} className={payment.status === "UNMATCHED" ? "bg-warning/10" : undefined}>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {formatDate(payment.receivedAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {paymentRowLabel(payment) || t("status.unmatched")}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            payment.status === "UNMATCHED" ? "text-attention" : undefined,
                          )}
                        >
                          {formatKes(payment.amountMinor)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={payment.source} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status === "UNMATCHED" ? (
                            <MatchCellButton payment={payment} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MatchCellButton({ payment }: { payment: PaymentDto }) {
  const { t } = useI18n();
  const openMatch = useUIStore((s) => s.openMatch);
  return (
    <Button variant="outline" size="sm" className="h-9" onClick={() => openMatch(payment)}>
      {t("unmatched.matchToTenant")}
    </Button>
  );
}
