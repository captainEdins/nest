"use client";

/**
 * S-11 · Arrears (landlord tab / caretaker pushed screen).
 * Aging buckets derived client-side from oldestUnpaidPeriod (days overdue vs
 * the 5th). Mobile: grouped cards; ≥sm: table. Red never — amber only.
 */

import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ArrearsRowDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { daysSincePeriodDue } from "./format";
import { ArrearsRow, SendReminderButton } from "./arrears-row";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
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

type Bucket = "current" | "1_30" | "31_60" | "61plus";

const BUCKET_KEY: Record<Bucket, "arrears.aging.current" | "arrears.aging.1_30" | "arrears.aging.31_60" | "arrears.aging.61plus"> = {
  current: "arrears.aging.current",
  "1_30": "arrears.aging.1_30",
  "31_60": "arrears.aging.31_60",
  "61plus": "arrears.aging.61plus",
};

function bucketOf(row: ArrearsRowDto): Bucket {
  if (!row.oldestUnpaidPeriod) return "current";
  const days = daysSincePeriodDue(row.oldestUnpaidPeriod);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  return "61plus";
}

const BUCKET_ORDER: Bucket[] = ["current", "1_30", "31_60", "61plus"];

export function ArrearsScreen({
  rows,
  totalMinor,
  tenantCount,
  isPending,
  error,
  onRetry,
}: {
  rows: ArrearsRowDto[];
  totalMinor: number;
  tenantCount: number;
  isPending: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (error) {
    return (
      <section aria-label={t("landlord.arrears")}>
        <h1 className="text-h2 font-semibold mb-4">{t("landlord.arrears")}</h1>
        <ErrorState onRetry={onRetry} />
      </section>
    );
  }

  const sorted = [...rows].sort((a, b) => b.balanceMinor - a.balanceMinor);
  const byBucket = new Map<Bucket, ArrearsRowDto[]>();
  for (const row of sorted) {
    const bucket = bucketOf(row);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row]);
  }

  return (
    <section aria-label={t("landlord.arrears")}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h1 className="text-h2 font-semibold">{t("landlord.arrears")}</h1>
        <p className="text-attention font-semibold tabular-nums">{formatKes(totalMinor)}</p>
      </div>
      <p className="text-caption text-muted-foreground mb-4">
        {t("arrears.tenantsBehind", { count: tenantCount })}
      </p>

      {isPending ? (
        <div className="space-y-4" aria-busy>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-24 animate-pulse bg-muted" />
            ))}
          </div>
          <Card className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 min-h-16 animate-pulse bg-muted/50" />
            ))}
          </Card>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t("empty.arrears")} success />
      ) : (
        <div className="space-y-4">
          {/* Aging chips */}
          <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible">
            {BUCKET_ORDER.map((bucket) => {
              const bucketRows = byBucket.get(bucket) ?? [];
              const amount = bucketRows.reduce((sum, r) => sum + r.balanceMinor, 0);
              return (
                <div
                  key={bucket}
                  className={cn(
                    "shrink-0 w-32 rounded-lg border p-3",
                    bucket === "61plus" ? "border-warning" : "border-border",
                  )}
                >
                  <p className="text-caption text-muted-foreground">{t(BUCKET_KEY[bucket])}</p>
                  <p className="text-attention font-semibold tabular-nums text-body mt-0.5">
                    {formatKes(amount)}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {t("arrears.bucketTenants", { count: bucketRows.length })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mobile: grouped cards · ≥sm: table */}
          <div className="sm:hidden space-y-4">
            {BUCKET_ORDER.map((bucket) => {
              const bucketRows = byBucket.get(bucket) ?? [];
              if (bucketRows.length === 0) return null;
              return (
                <div key={bucket}>
                  <h2 className="text-label font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {t(BUCKET_KEY[bucket])} ({bucketRows.length})
                  </h2>
                  <Card className="divide-y">
                    {bucketRows.map((row) => (
                      <ArrearsRow key={row.tenancyId} row={row} />
                    ))}
                  </Card>
                </div>
              );
            })}
          </div>

          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("receipt.receivedFrom")}</TableHead>
                  <TableHead>{t("receipt.forUnit")}</TableHead>
                  <TableHead>{t("receipt.property")}</TableHead>
                  <TableHead>{t("arrears.monthsBehindShort")}</TableHead>
                  <TableHead className="text-right">{t("money.balance")}</TableHead>
                  <TableHead className="text-right">{t("arrears.sendReminder")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.tenancyId}>
                    <TableCell className="font-medium">{row.tenantName}</TableCell>
                    <TableCell>{row.unitLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{row.propertyName}</TableCell>
                    <TableCell>
                      {row.monthsBehind <= 1
                        ? t("arrears.monthBehind")
                        : t("arrears.monthsBehind", { count: row.monthsBehind })}
                    </TableCell>
                    <TableCell className="text-right text-attention font-semibold tabular-nums">
                      {formatKes(row.balanceMinor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <SendReminderButton row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </section>
  );
}
