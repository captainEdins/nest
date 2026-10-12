"use client";

/**
 * S-17a · Payments ledger (landlord "Payments" tab / caretaker "Collections"
 * tab). Phase 14: reads the full ledger from GET /api/payments (newest first,
 * take ≤ 60) instead of the overview's recent-5 — and gains the multi-plot
 * view: property chips (All plots · per-property) + a Property column on ≥sm,
 * shown only when the caller actually has more than one plot (D-027).
 * Source filter stays the Monty SegmentedControl — All · M-Pesa · Cash ·
 * Unmatched (amber accent). Mobile: stacked cards · ≥sm: table.
 */

import { useI18n } from "@/lib/i18n";
import type { PaymentDto, PaymentSource } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { usePaymentsLedger } from "@/hooks/use-overview";
import { formatDate } from "@/components/nest/shared/format";
import { paymentRowLabel, PaymentRow } from "@/components/nest/shared/payment-row";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { SegmentedControl } from "@/components/nest/shared/segmented-control";
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

const FILTERS: { value: Filter; labelKey: "common.filterAll" | "source.mpesa" | "source.cash" | "status.unmatched"; attention?: boolean }[] = [
  { value: "ALL", labelKey: "common.filterAll" },
  { value: "MPESA", labelKey: "source.mpesa" },
  { value: "CASH", labelKey: "source.cash" },
  { value: "UNMATCHED", labelKey: "status.unmatched", attention: true },
];

export function PaymentsLedger({ variant }: { variant: "landlord" | "caretaker" }) {
  const { t } = useI18n();
  const filter = useUIStore((s) => s.paymentsFilter);
  const setFilter = useUIStore((s) => s.setPaymentsFilter);
  const propertyFilter = useUIStore((s) => s.paymentsPropertyFilter);
  const setPropertyFilter = useUIStore((s) => s.setPaymentsPropertyFilter);

  // Full ledger (unfiltered) — the property filter is applied client-side so
  // the chip row always knows every plot, even mid-refilter.
  const { data, isPending, error, refetch } = usePaymentsLedger();
  const payments: PaymentDto[] = data ?? [];

  // Distinct plots in the caller's scope (null propertyName = unmatched rows,
  // which belong to no plot). Chips render only when the portfolio is real.
  const propertyNames = [...new Set(payments.map((p) => p.propertyName).filter((n): n is string => n != null))].sort(
    (a, b) => a.localeCompare(b),
  );
  const multiPlot = propertyNames.length > 1;

  const filtered = payments
    .filter((p) => (propertyFilter ? p.propertyName === propertyFilter : true))
    .filter((p) =>
      filter === "ALL"
        ? true
        : filter === "UNMATCHED"
          ? p.status === "UNMATCHED"
          : p.source === (filter as PaymentSource),
    );

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
          {/* Property chips — only when the caller has more than one plot */}
          {multiPlot ? (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("payments.plot")}>
              <button
                type="button"
                onClick={() => setPropertyFilter(null)}
                aria-pressed={propertyFilter === null}
                className={cn(
                  // Phase 18 (D-031): the v2 pill — tint, not border.
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-caption font-medium transition-colors",
                  propertyFilter === null
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t("payments.allPlots")}
              </button>
              {propertyNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPropertyFilter(name)}
                  aria-pressed={propertyFilter === name}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 h-8 text-caption font-medium transition-colors",
                    propertyFilter === name
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {/* Filter — Monty segmented control (D-022) */}
          <SegmentedControl
            ariaLabel={t("common.status")}
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
              attention: option.attention,
              count: option.value === "UNMATCHED" ? unmatchedCount : undefined,
            }))}
          />

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
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    showUnit={
                      payment.unitLabel
                        ? multiPlot
                          ? `${payment.unitLabel} · ${payment.propertyName}`
                          : payment.unitLabel
                        : undefined
                    }
                  />
                ))}
              </Card>

              {/* ≥sm: table */}
              <Card className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("receipt.receivedFrom")}</TableHead>
                      {multiPlot ? <TableHead>{t("payments.plot")}</TableHead> : null}
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
                        {multiPlot ? (
                          <TableCell className="text-muted-foreground">
                            {payment.propertyName ?? "—"}
                          </TableCell>
                        ) : null}
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
