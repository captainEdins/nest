"use client";

/**
 * S-20 · Staff statement (Phase 15, issue #88) — the reconciliation view.
 *
 * The landlord and the caretaker sit across the table from the tenant in a
 * money conversation. This screen hands them EXACTLY what the tenant's own
 * Statement tab shows: the same `/api/statements?tenancyId=` payload, the
 * same month timeline, the same print sheet (D-018 — one payload, one truth;
 * screen and export can never disagree).
 *
 * The interactive pieces (months timeline, summary strip) were lifted out of
 * the tenant statement screen into this module so the tenant view and the
 * staff view render through ONE component tree — a styling change to the
 * timeline lands on both desks at once, by construction.
 *
 * Entry points (all landlord + caretaker, matrix §4.4):
 * - Arrears rows (mobile card + desktop table) — beside Send reminder.
 * - Caretaker Units rows and Landlord Properties unit rows — per live tenancy.
 * - The ⌘K search palette — a TENANT result opens that tenant's statement.
 */

import { CheckCircle2, Printer, ScrollText, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { StatementDto, StatementMonthDto } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n/en";
import { formatKes } from "@/lib/money";
import { useStatement } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatDate, formatMonthKey, formatPhone } from "@/components/nest/shared/format";
import { StatementPrintSheet } from "@/components/nest/tenant/statement-print";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function chargeKindKey(kind: StatementMonthDto["billedLines"][number]["kind"]): TranslationKey {
  if (kind === "RENT") return "money.rent";
  if (kind === "WATER") return "money.water";
  return "money.garbage";
}

/** The month's outcome chip: fully settled vs what it still owes. */
function MonthNode({ month }: { month: StatementMonthDto }) {
  const outstanding = month.billedMinor - month.settledMinor;
  if (outstanding <= 0) {
    return (
      <span
        className="inline-flex items-center justify-center size-6 rounded-full bg-success/10 border border-success text-success shrink-0"
        aria-label=""
      >
        <CheckCircle2 className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center size-6 rounded-full border-2 border-attention text-attention shrink-0"
      aria-label=""
    >
      <span className="sr-only">outstanding</span>
    </span>
  );
}

/** Totals strip — billed / settled / closing balance, shared by both views. */
export function StatementSummaryStrip({ data }: { data: StatementDto }) {
  const { t } = useI18n();
  const closing = data.closingBalanceMinor;
  return (
    <div className="grid grid-cols-3 gap-3">
      <SummaryCell label={t("statement.summaryBilled")} value={formatKes(data.totalBilledMinor)} />
      <SummaryCell label={t("statement.summarySettled")} value={formatKes(data.totalSettledMinor)} />
      <SummaryCell
        label={t("statement.summaryBalance")}
        value={formatKes(closing)}
        tone={closing > 0 ? "attention" : "success"}
      />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "attention" | "success";
}) {
  return (
    <div className="rounded-lg border p-3 min-w-0">
      <p className="text-caption text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-body font-semibold tabular-nums truncate mt-0.5",
          tone === "attention" ? "text-attention" : tone === "success" ? "text-success" : undefined,
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

/** Months — newest first, down a ruled timeline. Shared by tenant + staff views. */
export function StatementMonthsTimeline({ months }: { months: StatementMonthDto[] }) {
  const { t } = useI18n();
  const monthsNewestFirst = [...months].reverse();

  if (monthsNewestFirst.length === 0) {
    return <EmptyState icon={ScrollText} title={t("statement.emptyTitle")} hint={t("statement.emptyHint")} />;
  }

  return (
    <ol className="relative space-y-4">
      {/* The ruled line behind the nodes */}
      <span aria-hidden className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
      {monthsNewestFirst.map((month) => {
        const outstanding = month.billedMinor - month.settledMinor;
        return (
          <li key={month.periodMonth} className="relative pl-9">
            <span className="absolute left-0 top-4">
              <MonthNode month={month} />
            </span>
            <Card>
              <CardContent className="p-4 sm:p-5">
                {/* Month head */}
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-body-lg font-semibold">{formatMonthKey(month.periodMonth)}</p>
                  <p
                    className={cn(
                      "text-body font-semibold tabular-nums shrink-0",
                      outstanding > 0 ? "text-attention" : "text-success",
                    )}
                  >
                    {outstanding > 0
                      ? formatKes(month.closingBalanceMinor)
                      : t("tenant.allPaidUp")}
                  </p>
                </div>

                {/* Brought forward (only when it carries weight) */}
                {month.openingBalanceMinor !== 0 ? (
                  <p className="text-caption text-muted-foreground tabular-nums mt-2">
                    {t("statement.broughtForward")}: {formatKes(month.openingBalanceMinor)}
                  </p>
                ) : null}

                {/* Billed lines */}
                <div className="mt-3 space-y-2">
                  {month.billedLines.map((line) => (
                    <div key={line.chargeId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <p className="text-body truncate">{t(chargeKindKey(line.kind))}</p>
                        {line.paidMinor < line.amountMinor ? (
                          <StatusBadge
                            status={line.paidMinor > 0 ? "PART" : "UNPAID"}
                            className="scale-90 origin-left"
                          />
                        ) : (
                          <StatusBadge status="PAID" className="scale-90 origin-left" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {line.paidMinor > 0 && line.paidMinor < line.amountMinor ? (
                          <p className="text-caption text-muted-foreground tabular-nums">
                            {t("statement.monthSettled")} {formatKes(line.paidMinor)}
                          </p>
                        ) : null}
                        <p className="text-body tabular-nums">{formatKes(line.amountMinor)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payments that landed on this month's charges */}
                <div className="mt-4 pt-3 border-t">
                  <p className="text-caption text-muted-foreground uppercase tracking-wide mb-2">
                    {t("statement.monthSettled")} · {formatKes(month.settledMinor)}
                  </p>
                  {month.paymentLines.length === 0 ? (
                    <p className="text-caption text-muted-foreground">{t("statement.noPayments")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {month.paymentLines.map((payment) => (
                        <li key={payment.paymentId} className="flex items-center gap-3 min-h-8">
                          <div className="min-w-0 flex-1">
                            <p className="text-body font-medium tabular-nums truncate">
                              {payment.receiptNo ?? `#${payment.paymentId}`}
                            </p>
                            <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                              <StatusBadge status={payment.source} className="scale-90 origin-left" />
                              {formatDate(payment.receivedAt)}
                              {payment.allocatedMinor < payment.amountMinor ? (
                                <span className="tabular-nums">
                                  ·{" "}
                                  {t("statement.ofPayment", {
                                    amount: formatKes(payment.allocatedMinor),
                                    total: formatKes(payment.amountMinor),
                                  })}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <p className="text-body font-semibold tabular-nums shrink-0 text-success">
                            +{formatKes(payment.allocatedMinor)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Carried forward */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3">
                  <p className="text-caption text-muted-foreground">{t("statement.carriedForward")}</p>
                  <p
                    className={cn(
                      "text-body font-semibold tabular-nums",
                      month.closingBalanceMinor > 0 ? "text-attention" : "text-success",
                    )}
                  >
                    {formatKes(month.closingBalanceMinor)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The staff statement screen body (title + back button live in the shell's
 * pushed-screen branch). Who it is for rides the context banner — staff open
 * this for someone else, so the issued-to identity is never ambiguous.
 */
export function StatementScreen({ tenancyId }: { tenancyId: string }) {
  const { t } = useI18n();
  const { data, isPending, error, refetch } = useStatement(tenancyId);

  if (error != null) {
    return (
      <section aria-label={t("statement.staffTitle")}>
        <ErrorState onRetry={() => refetch()} />
      </section>
    );
  }

  if (isPending || !data) {
    return (
      <div className="space-y-4 sm:space-y-6" aria-busy>
        <HeroSkeleton className="h-28" />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 print:space-y-0">
      {/* The print sheet is the ONLY thing that prints — same sheet, same
       *  payload the tenant prints (Phase 13, D-026). */}
      <div className="hidden print:block">
        <StatementPrintSheet data={data} />
      </div>

      <div className="space-y-4 sm:space-y-6 print:hidden">
        {/* Head — the record's coordinates + the portable-document action */}
        <div>
          <p className="text-caption text-muted-foreground tabular-nums flex items-center gap-2 flex-wrap">
            <span className="rounded-full border px-2 py-0.5">{data.accountRef}</span>
            {t("statement.generated", { date: formatDate(data.generatedAt) })}
          </p>
          <p className="text-caption text-muted-foreground mt-1.5">
            {t("statement.staffOneRecord", { name: data.tenantName })}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="outline" size="sm" className="h-11" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {t("statement.print")}
            </Button>
          </div>
        </div>

        {/* Who this record belongs to — the meeting's other party */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
            <div
              className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
              aria-hidden
            >
              <UserRound className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-lg font-semibold truncate" title={data.tenantName}>
                {data.tenantName}
              </p>
              <p className="text-caption text-muted-foreground truncate">
                {formatPhone(data.tenantPhone)} · {data.unitLabel} · {data.propertyName}
              </p>
            </div>
          </CardContent>
        </Card>

        <StatementSummaryStrip data={data} />

        <section aria-label={t("statement.staffTitle")}>
          <StatementMonthsTimeline months={data.months} />
        </section>
      </div>
    </div>
  );
}

/**
 * Per-row statement opener — the icon action beside Send reminder on arrears
 * rows and on unit rows. Icon-only (rows are dense); the accessible name and
 * the desktop tooltip both name WHO it opens (matrix §7 — every action is
 * self-describing).
 */
export function OpenStatementButton({
  tenancyId,
  tenantName,
}: {
  tenancyId: string;
  tenantName: string;
}) {
  const { t } = useI18n();
  const openStatement = useUIStore((s) => s.openStatement);
  const label = t("statement.openAria", { name: tenantName });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      onClick={() => openStatement(tenancyId)}
      aria-label={label}
      title={label}
    >
      <ScrollText className="size-4" aria-hidden />
    </Button>
  );
}
