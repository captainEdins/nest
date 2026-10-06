"use client";

/**
 * S-03 · Landlord home — ONE call (LandlordOverviewDto). KPI row, unmatched
 * alert, arrears, recent payments, vacancies, properties.
 */

import { CheckCircle2, ChevronRight, HelpCircle, TriangleAlert, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PropertyDto, UnitDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview, useSession } from "@/hooks/use-overview";
import { formatMonthKey } from "@/components/nest/shared/format";
import { SecurityCard } from "@/components/nest/shared/security/security-card";
import { KpiCard } from "@/components/nest/shared/kpi-card";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { PaymentRow } from "@/components/nest/shared/payment-row";
import { ArrearsRow } from "@/components/nest/shared/arrears-row";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { KpiSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function LandlordHome() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setPaymentsFilter = useUIStore((s) => s.setPaymentsFilter);
  const { data } = useSession();
  const { data: overview, isPending, error, refetch } = useLandlordOverview();

  if (error != null) {
    return (
      <section aria-label={t("landlord.properties")}>
        <ErrorState onRetry={() => refetch()} message={t("errors.couldNotLoad")} />
      </section>
    );
  }

  const name = data?.profile.fullName.split(" ")[0] ?? "";
  const totals = overview?.totals;
  const arrears = [...(overview?.arrears ?? [])].sort((a, b) => b.balanceMinor - a.balanceMinor).slice(0, 5);
  const recentPayments = overview?.recentPayments ?? [];
  const vacancies = overview?.vacancies ?? [];
  const properties = overview?.properties ?? [];
  const unmatchedCount = totals?.unmatchedPayments ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Greeting (the screen's h1) + month chip */}
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h3 font-semibold">{t("common.greeting", { name })}</h1>
        {overview ? (
          <span className="text-caption text-muted-foreground tabular-nums">
            {formatMonthKey(overview.month)}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <KpiSkeleton className="h-28" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
          <KpiSkeleton />
          <ListSkeleton rows={5} />
        </div>
      ) : totals ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* KPI 1 — collected this month */}
            <KpiCard
              className="sm:col-span-2"
              label={t("landlord.collectedThisMonth")}
              value={formatKes(totals.monthCollectedMinor)}
              sub={
                <span className="tabular-nums">
                  {t("money.expected")} {formatKes(totals.monthExpectedMinor)} ·{" "}
                  {t("landlord.collectionRate")} {totals.collectionRatePct}%
                </span>
              }
              progressPct={totals.collectionRatePct}
            />
            {/* KPI 2 — arrears (amber) */}
            <KpiCard
              label={t("landlord.arrears")}
              value={formatKes(totals.arrearsMinor)}
              tone="amber"
              icon={TriangleAlert}
              sub={
                <span className="tabular-nums">
                  {t("landlord.tenantsInArrears")}: {totals.arrearsTenantCount}
                </span>
              }
            />
            {/* KPI 3 — occupancy */}
            <KpiCard
              label={t("landlord.occupancyRate")}
              value={`${totals.occupancyRatePct}%`}
              progressPct={totals.occupancyRatePct}
              sub={t("common.ofUnits", { occupied: totals.occupied, total: totals.units })}
            />
            {/* KPI 4 — open repairs (tap → repairs tab, Phase 2) */}
            <button
              type="button"
              onClick={() => setTab("repairs")}
              aria-label={`${t("repairs.openRepairs")}: ${totals.openTickets}`}
              className="text-left w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
            >
              <KpiCard
                label={t("repairs.openRepairs")}
                value={String(totals.openTickets)}
                icon={Wrench}
                tone={totals.openTickets > 0 ? "amber" : "default"}
                sub={
                  <span className="flex items-center gap-1">
                    <span className="tabular-nums">{t("repairs.ticketsCount", { count: totals.openTickets })}</span>
                    <ChevronRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            </button>
          </div>

          {/* Security digest (Phase 3) — eyes on the ground; unseen reports
              land the tap straight on the incident queue. */}
          {overview ? <SecurityCard security={overview.security} /> : null}

          {/* Unmatched alert card (amber tint — hidden when zero) */}
          {unmatchedCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setPaymentsFilter("UNMATCHED");
                setTab("payments");
              }}
              className="w-full text-left rounded-xl border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              <HelpCircle className="size-5 text-attention shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-attention font-medium">
                {t("landlord.unmatchedPayments")}: <span className="tabular-nums">{unmatchedCount}</span>
              </p>
              <span className="text-label text-attention flex items-center gap-1 shrink-0">
                {t("unmatched.review")}
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </button>
          ) : null}

          {/* Arrears */}
          <section aria-label={t("landlord.arrears")}>
            <SectionHeader
              title={t("landlord.arrears")}
              count={overview?.arrears.length}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("arrears")}
              className="mb-3"
            />
            {arrears.length === 0 ? (
              <p className="flex items-center gap-2 text-body text-muted-foreground py-4">
                <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden />
                {t("empty.arrears")}
              </p>
            ) : (
              <Card className="divide-y">
                {arrears.map((row) => (
                  <ArrearsRow key={row.tenancyId} row={row} />
                ))}
              </Card>
            )}
          </section>

          {/* Recent payments */}
          <section aria-label={t("landlord.recentPayments")}>
            <SectionHeader
              title={t("landlord.recentPayments")}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("payments")}
              className="mb-3"
            />
            {recentPayments.length === 0 ? (
              <EmptyState icon={CheckCircle2} title={t("empty.payments")} success />
            ) : (
              <Card className="divide-y">
                {recentPayments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </Card>
            )}
          </section>

          {/* Vacancies — horizontal chips */}
          <section aria-label={t("landlord.vacancies")}>
            <SectionHeader
              title={t("landlord.vacancies")}
              count={vacancies.length}
              className="mb-3"
            />
            {vacancies.length === 0 ? (
              <p className="text-body text-muted-foreground py-4">{t("empty.arrears")}</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {vacancies.map((unit) => (
                  <VacancyChip key={unit.id} unit={unit} />
                ))}
              </div>
            )}
          </section>

          {/* Properties */}
          <section aria-label={t("landlord.properties")}>
            <SectionHeader
              title={t("landlord.properties")}
              count={properties.length}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("properties")}
              className="mb-3"
            />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function VacancyChip({ unit }: { unit: UnitDto }) {
  return (
    <div className="shrink-0 w-44 rounded-lg border p-3">
      <p className="text-body font-semibold">{unit.label}</p>
      <p className="text-caption text-muted-foreground truncate">{unit.propertyName}</p>
      <p className="text-caption text-muted-foreground tabular-nums mt-0.5">
        {formatKes(unit.rentAmountMinor)}
      </p>
      <div className="mt-1.5">
        <StatusBadge status={unit.status} />
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: PropertyDto }) {
  const { t } = useI18n();
  const vacant = property.unitCount - property.occupiedCount;
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <p className="text-h3 font-semibold truncate">{property.name}</p>
        <p className="text-caption text-muted-foreground truncate">{property.location}</p>
        <p className="text-caption text-muted-foreground mt-2 tabular-nums">
          {t("property.unitsSummary", {
            units: property.unitCount,
            occupied: property.occupiedCount,
            vacant: Math.max(0, vacant),
          })}
        </p>
        <Progress
          className="h-2 mt-3"
          value={property.unitCount > 0 ? Math.round((property.occupiedCount / property.unitCount) * 100) : 0}
          aria-hidden
        />
      </CardContent>
    </Card>
  );
}
