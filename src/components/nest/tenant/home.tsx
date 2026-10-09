"use client";

/**
 * S-08 · Tenant home — ONE call (TenantOverviewDto). Balance hero, Pay now,
 * stats row (deposit cell → deposit ledger), receipts preview, repairs preview
 * (Phase 2), visitors to your unit (Phase 3), charges accordion,
 * notifications preview.
 */

import { Bell, ChevronRight, Receipt, Users, Wrench } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ChargeDto, ChargeKind } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useSession, useTenantOverview, useRentScore } from "@/hooks/use-overview";
import { useTickets } from "@/hooks/use-tickets";
import { RentScoreCard } from "@/components/nest/tenant/rent-score-card";
import { useOnline } from "@/components/nest/offline-banner";
import { formatDate, formatMonthKey, formatTime } from "@/components/nest/shared/format";
import { NoticeBanner } from "@/components/nest/shared/give-notice-sheet";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { visitorPurposeLabel } from "@/components/nest/shared/security/visitor-row";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton, RowSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { TicketRow } from "@/components/nest/shared/ticket-detail";
import { NotificationsList } from "@/components/nest/shared/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function chargeKindLabel(kind: ChargeKind, t: ReturnType<typeof useI18n>["t"]): string {
  if (kind === "RENT") return t("money.rent");
  if (kind === "WATER") return t("money.water");
  return t("money.garbage");
}

export function TenantHome() {
  const { t } = useI18n();
  const online = useOnline();
  const setTab = useUIStore((s) => s.setTab);
  const setPayFlowOpen = useUIStore((s) => s.setPayFlowOpen);
  const openReceipt = useUIStore((s) => s.openReceipt);
  const pushDeposit = useUIStore((s) => s.pushDeposit);
  const setReportIssueOpen = useUIStore((s) => s.setReportIssueOpen);
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useTenantOverview();
  const { data: tickets, isPending: ticketsPending, error: ticketsError } = useTickets();
  const { data: rentScore, isPending: rentScorePending } = useRentScore(true);

  if (error != null) {
    // Phase 11: a tenant whose lease ENDED (the exit arc now reaches it) gets
    // an honest empty state, not a retry-forever error — the overview's 404
    // "no active tenancy" is a normal end-of-lease state, not a failure.
    const endedLease =
      error instanceof ApiError && error.code === "NOT_FOUND"
    if (endedLease) {
      return (
        <section aria-label={t("tenant.yourRent")} className="space-y-4">
          <h1 className="text-h3 font-semibold">{t("common.greeting", { name: session?.profile.fullName.split(" ")[0] ?? "" })}</h1>
          <EmptyState icon={Receipt} title={t("tenant.noTenancyTitle")} hint={t("tenant.noTenancyBody")} />
        </section>
      )
    }
    return (
      <section aria-label={t("tenant.yourRent")}>
        <ErrorState onRetry={() => refetch()} />
      </section>
    );
  }

  const name = session?.profile.fullName.split(" ")[0] ?? "";
  const tenancy = data?.tenancy;
  const totals = data?.totals;
  const balance = totals?.balanceMinor ?? 0;

  // Charges grouped by period, newest first.
  const chargesByPeriod = new Map<string, ChargeDto[]>();
  for (const charge of data?.charges ?? []) {
    chargesByPeriod.set(charge.periodMonth, [...(chargesByPeriod.get(charge.periodMonth) ?? []), charge]);
  }
  const periods = [...chargesByPeriod.keys()].sort((a, b) => b.localeCompare(a));
  const openCharges = (data?.charges ?? []).filter((c) => c.status !== "PAID").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-h3 font-semibold">{t("common.greeting", { name })}</h1>

      {isPending || !tenancy || !totals ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <HeroSkeleton className="h-40" />
          <ListSkeleton rows={3} />
        </div>
      ) : (
        <>
          {/* Hero */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-caption text-muted-foreground uppercase tracking-wide truncate">
                {tenancy.propertyName} · {tenancy.propertyLocation}
              </p>
              <p className="text-h2 font-semibold mt-1">{t("tenant.yourRent")} · {tenancy.unitLabel}</p>
              <p className="text-label text-muted-foreground mt-3">{t("money.balance")}</p>
              <p
                className={
                  balance > 0
                    ? "text-kpi font-bold tabular-nums text-attention"
                    : "text-kpi font-bold tabular-nums text-success"
                }
              >
                {formatKes(balance)}
              </p>
              {balance > 0 ? null : (
                <p className="text-caption text-success mt-1">{t("tenant.allPaidUp")}</p>
              )}
              {totals.nextDueDate ? (
                <p className="text-caption text-muted-foreground mt-1 tabular-nums">
                  {t("tenant.nextPaymentDue")}: {formatDate(totals.nextDueDate)} ·{" "}
                  {formatKes(totals.nextDueAmountMinor)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Phase 11 — the notice state, made visible at the top of the day */}
          {tenancy.status === "NOTICE" ? (
            <NoticeBanner
              tenancy={{
                id: tenancy.id,
                unitLabel: tenancy.unitLabel,
                moveOutDate: tenancy.moveOutDate,
              }}
            />
          ) : null}

          {/* Pay now */}
          {balance > 0 ? (
            <div className="space-y-1.5">
              <Button
                className="w-full h-12 text-body-lg"
                disabled={!online}
                onClick={() => setPayFlowOpen(true)}
              >
                {t("tenant.payNow")}
              </Button>
              {!online ? (
                <p className="text-caption text-muted-foreground text-center">
                  {t("errors.needOnline")}
                </p>
              ) : null}
            </div>
          ) : (
            <Button variant="secondary" className="w-full h-12 text-body-lg" onClick={() => setTab("receipts")}>
              {t("tenant.yourReceipts")}
            </Button>
          )}

          {/* Rent Score (Phase 6-b) — the portable record, earning its card */}
          <RentScoreCard data={rentScore} isPending={rentScorePending} />

          {/* Stats row — the deposit cell opens the deposit ledger (Phase 2) */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => pushDeposit()}
              aria-label={`${t("money.deposit")}: ${formatKes(tenancy.depositHeldMinor)}`}
              className="rounded-lg border p-3 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40"
            >
              <p className="text-caption text-muted-foreground truncate flex items-center gap-0.5">
                <span className="truncate">{t("money.deposit")}</span>
                <ChevronRight className="size-3 shrink-0" aria-hidden />
              </p>
              <p className="text-body font-semibold tabular-nums truncate mt-0.5">
                {formatKes(tenancy.depositHeldMinor)}
              </p>
            </button>
            <StatCell label={t("tenant.yourReceipts")} value={String(data.receipts.length)} />
            <StatCell label={t("tenant.openCharges")} value={String(openCharges)} />
          </div>

          {/* Receipts preview */}
          <section aria-label={t("tenant.yourReceipts")}>
            <SectionHeader
              title={t("tenant.yourReceipts")}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("receipts")}
              className="mb-3"
            />
            {data.receipts.length === 0 ? (
              <EmptyState icon={Receipt} title={t("empty.receipts")} />
            ) : (
              <Card className="divide-y">
                {data.receipts.slice(0, 3).map((receipt) => (
                  <button
                    key={receipt.receiptNo}
                    type="button"
                    onClick={() => openReceipt({ receiptNo: receipt.receiptNo })}
                    className="w-full text-left p-4 min-h-14 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold tabular-nums truncate">{receipt.receiptNo}</p>
                      <p className="text-caption text-muted-foreground flex items-center gap-1.5 flex-wrap">
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

          {/* Repairs preview (Phase 2) — top 2 of the tenant's own reports */}
          {ticketsError == null ? (
            <section aria-label={t("repairs.yourReports")}>
              <SectionHeader
                title={t("repairs.yourReports")}
                actionLabel={t("arrears.viewAll")}
                onAction={() => setTab("repairs")}
                className="mb-3"
              />
              {ticketsPending ? (
                <Card className="divide-y" aria-busy>
                  <RowSkeleton />
                  <RowSkeleton />
                </Card>
              ) : (tickets ?? []).length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title={t("repairs.empty")}
                  hint={t("repairs.emptyDesc")}
                  actionLabel={t("repairs.reportIssue")}
                  onAction={() => setReportIssueOpen(true)}
                />
              ) : (
                <Card className="divide-y">
                  {(tickets ?? []).slice(0, 2).map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </Card>
              )}
            </section>
          ) : null}

          {/* Visitors to your unit (Phase 3) — what the guard logged at the gate */}
          <section aria-label={t("tenant.visitors.title")}>
            <SectionHeader
              title={t("tenant.visitors.title")}
              count={data.recentVisitors.length}
              className="mb-3"
            />
            {data.recentVisitors.length === 0 ? (
              <EmptyState icon={Users} title={t("tenant.visitors.empty")} />
            ) : (
              <Card className="divide-y">
                {data.recentVisitors.slice(0, 3).map((visitor) => (
                  <div key={visitor.id} className="p-4 min-h-14 flex items-center gap-3">
                    <AvatarInitials fullName={visitor.visitorName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium truncate">
                        {t("tenant.visitors.visitorOf", {
                          name: visitor.visitorName,
                          purpose: visitorPurposeLabel(visitor.purpose, t),
                        })}
                      </p>
                      <p className="text-caption text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {visitor.exitedAt == null ? (
                          <>
                            <span>
                              {t("tenant.visitors.stillOnSite", { in: formatTime(visitor.enteredAt) })}
                            </span>
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-success animate-pulse"
                            />
                          </>
                        ) : (
                          <span>
                            {t("tenant.visitors.inOut", {
                              in: formatTime(visitor.enteredAt),
                              out: formatTime(visitor.exitedAt),
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* Charges accordion (latest open) — the statement deep-link sits in
              the header action so the two money views stay one tap apart. */}
          <section aria-label={t("tenant.chargesBreakdown")}>
            <SectionHeader
              title={t("tenant.chargesBreakdown")}
              actionLabel={t("statement.viewStatement")}
              onAction={() => setTab("statement")}
              className="mb-3"
            />
            <Card>
              <CardContent className="p-0">
                <Accordion type="single" collapsible defaultValue={periods[0]}>
                  {periods.map((period) => {
                    const charges = chargesByPeriod.get(period) ?? [];
                    const outstanding = charges.reduce(
                      (sum, c) => sum + (c.amountMinor - c.paidMinor),
                      0,
                    );
                    return (
                      <AccordionItem key={period} value={period} className="px-4">
                        <AccordionTrigger className="py-4 hover:no-underline">
                          <span className="text-body font-medium">
                            {formatMonthKey(period)} ·{" "}
                            <span className="tabular-nums font-semibold">{formatKes(outstanding)}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          {charges.map((charge) => (
                            <div
                              key={charge.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-body truncate">
                                  {chargeKindLabel(charge.kind, t)}
                                </p>
                                {charge.status === "PART" ? (
                                  <p className="text-caption text-muted-foreground tabular-nums">
                                    {t("money.paid")} {formatKes(charge.paidMinor)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <p className="text-body tabular-nums">
                                  {formatKes(charge.amountMinor)}
                                </p>
                                <StatusBadge status={charge.status} />
                              </div>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </section>

          {/* Notifications preview */}
          <section aria-label={t("notifications.title")}>
            <SectionHeader
              title={t("notifications.title")}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("notifications")}
              className="mb-3"
            />
            {data.notifications.length === 0 ? (
              <EmptyState icon={Bell} title={t("notifications.empty")} />
            ) : (
              <NotificationsList notifications={data.notifications.slice(0, 3)} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 min-w-0">
      <p className="text-caption text-muted-foreground truncate">{label}</p>
      <p className="text-body font-semibold tabular-nums truncate mt-0.5" title={value}>
        {value}
      </p>
    </div>
  );
}
