"use client";

/**
 * S-03 · Landlord home — ONE call (LandlordOverviewDto). KPI row, unmatched
 * alert, arrears, recent payments, vacancies, properties.
 */

import { CheckCircle2, ChevronRight, HelpCircle, Megaphone, TriangleAlert, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ListingApplicationDto, PropertyDto, UnitDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview, useSession } from "@/hooks/use-overview";
import { useApplications, useListings } from "@/hooks/use-listings";
import { formatMonthKey } from "@/components/nest/shared/format";
import { SecurityCard } from "@/components/nest/shared/security/security-card";
import { KpiCard, momDeltaPct } from "@/components/nest/shared/kpi-card";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { PaymentRow } from "@/components/nest/shared/payment-row";
import { ArrearsRow } from "@/components/nest/shared/arrears-row";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { KpiSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { ListingStatusChip } from "@/components/nest/shared/listing-chips";
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
            {/* KPI 1 — collected this month (Monty hero: solid primary, MoM delta) */}
            <KpiCard
              className="sm:col-span-2"
              label={t("landlord.collectedThisMonth")}
              value={formatKes(totals.monthCollectedMinor)}
              highlight
              delta={{
                deltaPct: momDeltaPct(totals.monthCollectedMinor, totals.monthCollectedPrevMinor),
              }}
              lastMonthValue={
                totals.monthCollectedPrevMinor > 0
                  ? t("common.lastMonthCollected", {
                      amount: formatKes(totals.monthCollectedPrevMinor),
                    })
                  : t("common.noHistoryYet")
              }
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

          {/* Vacancy funnel (Phase 4) — the landlord's decision queue; amber
              attention while live applicants await an approve/reject. */}
          <VacancyFunnelCard />

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

// ---------------------------------------------------------------------------
// Vacancy funnel card (Phase 4, issue #48) — the landlord's decision queue at
// a glance. Data: ["listings"] + ["applications"] (both landlord-scoped
// server-side; the same keys P4-c's decision mutations invalidate, so the
// pending count live-updates after every approve/reject). Rendered ONLY when
// there is something to show (listings exist): amber attention while live
// applicants (NEW/CONTACTED/VIEWING) on non-LET listings await a decision;
// a neutral summary when the funnel runs quietly; a muted line when every
// listing is closed (LET). Never rendered while pending or on query error —
// the home's own skeleton/error states cover that.
// ---------------------------------------------------------------------------

/** Live pipeline statuses — an undecided, unwithdrawn applicant. */
const LIVE_APPLICATION_STATUSES: ReadonlySet<ListingApplicationDto["status"]> = new Set([
  "NEW",
  "CONTACTED",
  "VIEWING",
]);

function VacancyFunnelCard() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setListingsSegment = useUIStore((s) => s.setListingsSegment);
  const { data: listings } = useListings();
  const { data: applications } = useApplications();

  // Nothing to observe yet (also covers the queries' pending state).
  if (listings == null || listings.length === 0) return null;

  const liveListings = listings.filter((listing) => listing.status !== "LET");
  const liveListingIds = new Set(liveListings.map((listing) => listing.id));
  const pending = (applications ?? []).filter(
    (application) =>
      LIVE_APPLICATION_STATUSES.has(application.status) && liveListingIds.has(application.listingId),
  );

  function openListings(segment: "listings" | "applicants") {
    // Decisions pending land on the applicant queue (the urgent thing first);
    // everything else opens the listings view — the security-card precedent.
    setListingsSegment(segment);
    setTab("listings");
  }

  // 1. Live applicants await the landlord's decision — amber attention.
  //    Then: approved applicants on still-live listings — green, Phase 8's
  //    move-in-ready state (the funnel's happiest moment).
  const approvedReady = (applications ?? []).filter(
    (application) =>
      application.status === "APPROVED" && liveListingIds.has(application.listingId),
  );

  if (pending.length > 0) {
    const primary = liveListings.find((listing) => pending.some((a) => a.listingId === listing.id));
    const pendingUnits = [...new Set(pending.map((application) => application.unitLabel))];
    const summary =
      primary != null && pendingUnits.length === 1
        ? `${primary.unitLabel} · ${primary.propertyName} · ${formatKes(primary.rentAmountMinor)} ${t("agent.perMonth")}`
        : pendingUnits.join(" · ");
    return (
      <button
        type="button"
        onClick={() => openListings("applicants")}
        aria-label={`${t("agent.funnelCardTitle")} — ${t("agent.pendingDecisions", { count: pending.length })}`}
        className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
      >
        <Card className="border-l-4 border-l-warning/70 bg-warning/15 dark:bg-warning/10 animate-in fade-in duration-300">
          <CardContent className="p-4 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="size-4 text-attention shrink-0" aria-hidden />
              <p className="text-label font-medium text-attention truncate flex-1 min-w-0">
                {t("agent.funnelCardTitle")}
              </p>
              {/* NEW-style amber pulse badge — the awaiting-decision count */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/60 bg-warning/15 dark:bg-warning/10 px-2 py-0.5 text-caption font-semibold text-attention tabular-nums shrink-0">
                <span aria-hidden className="size-1.5 rounded-full bg-attention animate-pulse" />
                {pending.length}
              </span>
            </div>
            <p className="text-body font-medium text-attention">
              {t("agent.pendingDecisions", { count: pending.length })}
            </p>
            <p className="text-caption text-muted-foreground truncate">{summary}</p>
            <p className="flex items-center justify-end gap-1 text-label font-medium text-attention">
              {t("agent.viewApplicants")}
              <ChevronRight className="size-4" aria-hidden />
            </p>
          </CardContent>
        </Card>
      </button>
    );
  }

  // 1b. Phase 8: approved + unit still live — the move-in-ready moment
  //     (green; the landlord's next verified action is one tap away).
  if (approvedReady.length > 0) {
    const primary = liveListings.find((listing) =>
      approvedReady.some((a) => a.listingId === listing.id),
    );
    const readyUnits = [...new Set(approvedReady.map((application) => application.unitLabel))];
    const summary =
      primary != null && readyUnits.length === 1
        ? t("agent.moveInReadySummary", {
            unit: primary.unitLabel,
            rent: formatKes(primary.rentAmountMinor),
          })
        : readyUnits.join(" · ");
    return (
      <button
        type="button"
        onClick={() => openListings("applicants")}
        aria-label={`${t("agent.funnelCardTitle")} — ${t("agent.moveInReadyCard", {
          count: approvedReady.length,
        })}`}
        className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
      >
        <Card className="border-l-4 border-l-success/70 bg-success/10 dark:bg-success/10 animate-in fade-in duration-300">
          <CardContent className="p-4 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden />
              <p className="text-label font-medium text-success truncate flex-1 min-w-0">
                {t("agent.funnelCardTitle")}
              </p>
              {/* success badge — the move-in-ready count */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-success/50 bg-success/10 px-2 py-0.5 text-caption font-semibold text-success tabular-nums shrink-0">
                {approvedReady.length}
              </span>
            </div>
            <p className="text-body font-medium text-success">
              {t("agent.moveInReadyCard", { count: approvedReady.length })}
            </p>
            <p className="text-caption text-muted-foreground truncate">{summary}</p>
            <p className="flex items-center justify-end gap-1 text-label font-medium text-success">
              {t("agent.moveInView")}
              <ChevronRight className="size-4" aria-hidden />
            </p>
          </CardContent>
        </Card>
      </button>
    );
  }

  // 2. The funnel runs quietly — a neutral summary of the live listing.
  if (liveListings.length > 0) {
    const primary = liveListings[0];
    return (
      <button
        type="button"
        onClick={() => openListings("listings")}
        aria-label={`${t("agent.funnelCardTitle")} — ${primary.unitLabel}. ${formatKes(primary.rentAmountMinor)}`}
        className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
      >
        <Card className="animate-in fade-in duration-300">
          <CardContent className="p-4 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="size-4 text-muted-foreground shrink-0" aria-hidden />
              <p className="text-label font-medium text-muted-foreground truncate flex-1 min-w-0">
                {t("agent.funnelCardTitle")}
              </p>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ListingStatusChip status={primary.status} />
            </div>
            <p className="text-body font-semibold break-words">{primary.title}</p>
            <p className="text-caption text-muted-foreground truncate">
              {primary.unitLabel} · {primary.propertyName} ·{" "}
              <span className="tabular-nums">{formatKes(primary.rentAmountMinor)}</span>
            </p>
            <p className="text-caption text-muted-foreground tabular-nums">
              {t("applicant.count", { count: primary.applicationCount })} · {t("landlord.funnelNoNew")}
            </p>
          </CardContent>
        </Card>
      </button>
    );
  }

  // 3. Every listing closed (LET) — the quiet line.
  return (
    <button
      type="button"
      onClick={() => openListings("listings")}
      aria-label={`${t("agent.funnelCardTitle")} — ${t("landlord.funnelAllLet")}`}
      className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
    >
      <Card className="bg-muted/40 animate-in fade-in duration-300">
        <CardContent className="p-4 flex items-center gap-2.5 text-muted-foreground">
          <Megaphone className="size-5 shrink-0" aria-hidden />
          <p className="text-body flex-1 min-w-0 truncate">{t("landlord.funnelAllLet")}</p>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </CardContent>
      </Card>
    </button>
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
