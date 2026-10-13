"use client";

/**
 * S-03 · Landlord home — ONE call (LandlordOverviewDto) + the shared analytics
 * cache (6-month series for the KPI sparkline and the mini trend chart — the
 * SAME query key the Analytics tab uses, so navigating there is free).
 *
 * Phase 21 (D-034, the classic home) — the LEDGER language: the letterhead
 * masthead (small-caps eyebrow · serif greeting · the double rule · estate
 * figures · collection-rate aside) replaces the Phase 17 cream hero panel
 * and illustration; the KPI quad reads as ledger figure boxes (2px top
 * rules, hairline boxes, no shadows); sections wear serif heads over ruled
 * hairlines. Data, queries, and behavior are untouched — this is a visual
 * language pass. Below: unmatched alert, arrears + recent payments
 * side-by-side ≥xl, vacancies, properties.
 */

import { Building2, CheckCircle2, ChevronRight, HelpCircle, Megaphone, TriangleAlert, Wrench } from "lucide-react";
import { greetingKeyForHour, useI18n } from "@/lib/i18n";
import type { AnalyticsMonthDto, ListingApplicationDto, PropertyDto, UnitDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordAnalytics, useLandlordOverview, useSession } from "@/hooks/use-overview";
import { useApplications, useListings } from "@/hooks/use-listings";
import { formatMonthKey } from "@/components/nest/shared/format";
import { SecurityCard } from "@/components/nest/shared/security/security-card";
import { KpiCard, momDeltaPct } from "@/components/nest/shared/kpi-card";
import { ClassicMasthead, MastheadAside, MastheadSkeleton } from "@/components/nest/shared/classic-masthead";
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
  // Shared ["analytics"] cache — powers the sparkline + mini chart; mounting
  // here just means the landlord's home keeps the series warm.
  const { data: analytics } = useLandlordAnalytics();

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
  const monthly = analytics?.monthly ?? [];
  const collectedSpark = monthly.map((m) => m.collectedMinor);

  return (
    // D-029: sections stagger in (40ms steps) as data lands; the keyed
    // wrapper in app-shell fades the whole screen on tab switches.
    <div className="space-y-4 sm:space-y-6 nest-stagger">
      {/* MASTHEAD (D-034) — the ledger letterhead: eyebrow, serif greeting,
       * the double rule, the estate figures, the collection-rate aside. */}
      <section aria-label={t("landlord.properties")}>
        {isPending || !overview || !totals ? (
          <MastheadSkeleton />
        ) : (
          <ClassicMasthead
            eyebrow={`${t("role.landlord")} · ${formatMonthKey(overview.month)}`}
            greeting={t(greetingKeyForHour(), { name })}
            stats={
              <p className="text-body text-muted-foreground tabular-nums">
                {t("landlord.heroContext", {
                  plots: properties.length,
                  units: totals.units,
                  amount: formatKes(totals.monthExpectedMinor),
                })}
              </p>
            }
            aside={
              <MastheadAside
                label={t("landlord.collectionRate")}
                value={`${totals.collectionRatePct}%`}
              />
            }
          />
        )}
      </section>

      {/* KPI QUAD (D-034) — the ledger figure boxes, full width under the
       * masthead: 2px top rules, hairline boxes, tabular figures. */}
      <section aria-label={t("landlord.collectedThisMonth")}>
        {isPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" aria-busy>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
        ) : totals ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* KPI 1 — collected this month (the statement's headline figure:
             * paper tint + primary ink + the 6-month sparkline, MoM delta) */}
            <KpiCard
              variant="classic"
              label={t("landlord.collectedThisMonth")}
              value={formatKes(totals.monthCollectedMinor)}
              highlight
              sparkline={collectedSpark}
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
            {/* KPI 2 — arrears (amber rule) */}
            <KpiCard
              variant="classic"
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
            {/* KPI 3 — occupancy (Building2 icon — every KPI in the quad
             * carries the same icon anatomy) */}
            <KpiCard
              variant="classic"
              label={t("landlord.occupancyRate")}
              value={`${totals.occupancyRatePct}%`}
              icon={Building2}
              progressPct={totals.occupancyRatePct}
              sub={t("common.ofUnits", { occupied: totals.occupied, total: totals.units })}
            />
            {/* KPI 4 — open repairs (tap → repairs tab) */}
            <button
              type="button"
              onClick={() => setTab("repairs")}
              aria-label={`${t("repairs.openRepairs")}: ${totals.openTickets}`}
              className="text-left w-full h-full rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <KpiCard
                variant="classic"
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
        ) : null}
      </section>

      {/* Compact 6-month collection trend — the hero bar chart, in the
       * classic frame; exact numbers on the Analytics tab (this one whispers
       * direction, the footer carries the latest month's exact values). */}
      {monthly.length >= 3 ? <MiniTrendCard monthly={monthly} /> : null}

      {/* Security digest (Phase 3) — eyes on the ground; unseen reports
          land the tap straight on the incident queue. */}
      {overview ? <SecurityCard security={overview.security} variant="classic" /> : null}

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
          className="w-full text-left rounded-[6px] border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring outline-none"
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

      {/* Arrears + recent payments — the reference's data-section density:
          side by side from ≥xl, stacked on smaller screens. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 items-start">
        <section aria-label={t("landlord.arrears")}>
          <SectionHeader
            variant="classic"
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
            <Card className="divide-y gap-0 py-0 nest-classic">
              {arrears.map((row) => (
                <ArrearsRow key={row.tenancyId} row={row} />
              ))}
            </Card>
          )}
        </section>

        <section aria-label={t("landlord.recentPayments")}>
          <SectionHeader
            variant="classic"
            title={t("landlord.recentPayments")}
            actionLabel={t("arrears.viewAll")}
            onAction={() => setTab("payments")}
            className="mb-3"
          />
          {recentPayments.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t("empty.payments")} success />
          ) : (
            <Card className="divide-y gap-0 py-0 nest-classic">
              {recentPayments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </Card>
          )}
        </section>
      </div>

      {/* Vacancies — horizontal chips */}
      <section aria-label={t("landlord.vacancies")}>
        <SectionHeader
          variant="classic"
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

      {/* Properties — letter tiles (the classic square monogram) */}
      <section aria-label={t("landlord.properties")}>
        <SectionHeader
          variant="classic"
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

      {isPending ? <ListSkeleton rows={5} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini collection trend (D-030) — the reference's hero bar chart, compact:
// billed (muted) vs collected (primary), rounded tops, dashed gridlines, no
// axis (the analytics tab owns the exact table). Each month group is
// focusable with a <title> tooltip; the footer carries the latest month's
// exact numbers so money is never guessed from bar heights.
// ---------------------------------------------------------------------------

const MINI_W = 340;
const MINI_H = 104;
const MINI_BASE = 82;
const MINI_TOP = 8;

/** Bar path with rounded top only — base sits flat on the baseline. */
function miniBarPath(x: number, top: number, width: number, bottom: number): string {
  const radius = Math.min(3, bottom - top, width / 2);
  if (bottom - top <= radius) return `M ${x} ${bottom} L ${x + width} ${bottom} Z`;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `L ${x + width - radius} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + radius}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

function MiniTrendCard({ monthly }: { monthly: AnalyticsMonthDto[] }) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);

  const maxMinor = monthly.reduce((max, m) => Math.max(max, m.billedMinor, m.collectedMinor), 0);
  const groupW = MINI_W / monthly.length;
  const barW = Math.min(14, groupW * 0.3);
  const pairW = barW * 2 + 4;
  const barH = (valueMinor: number) =>
    maxMinor > 0 ? Math.max(2, Math.round((valueMinor / maxMinor) * (MINI_BASE - MINI_TOP))) : 2;
  const last = monthly[monthly.length - 1]!;

  return (
    <Card className="py-0 gap-0 nest-classic">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label font-semibold truncate">{t("analytics.collectionTrend")}</p>
            <p className="text-caption text-muted-foreground">{t("analytics.last6Months")}</p>
          </div>
          <button
            type="button"
            onClick={() => setTab("analytics")}
            className="h-8 px-3 rounded-[4px] text-label font-medium text-primary underline underline-offset-4 decoration-border hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring outline-none shrink-0"
          >
            {t("landlord.viewAnalytics")}
          </button>
        </div>

        <svg
          viewBox={`0 0 ${MINI_W} ${MINI_H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${t("analytics.collectionTrend")} — ${t("analytics.last6Months")}`}
        >
          {/* Quiet dashed gridlines (reference texture); baseline solid. */}
          {[0.5, 1].map((frac) => {
            const y = MINI_BASE - Math.round(frac * (MINI_BASE - MINI_TOP));
            return (
              <line
                key={frac}
                x1={0}
                x2={MINI_W}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            );
          })}
          <line
            x1={0}
            x2={MINI_W}
            y1={MINI_BASE}
            y2={MINI_BASE}
            className="stroke-foreground/25"
            strokeWidth={1}
          />

          {monthly.map((month, index) => {
            const groupX = index * groupW;
            const pairX = groupX + (groupW - pairW) / 2;
            const billedH = barH(month.billedMinor);
            const collectedH = barH(month.collectedMinor);
            const summary = t("analytics.monthSummary", {
              month: month.label,
              billed: formatKes(month.billedMinor),
              collected: formatKes(month.collectedMinor),
              expenses: formatKes(month.expensesMinor),
              net: formatKes(month.netMinor),
            });
            return (
              <g
                key={month.monthKey}
                tabIndex={0}
                role="img"
                aria-label={summary}
                className="outline-none focus-visible:[outline:2px_solid_var(--ring)]"
              >
                <title>{summary}</title>
                <path
                  d={miniBarPath(pairX, MINI_BASE - billedH, barW, MINI_BASE)}
                  className="fill-muted"
                />
                <path
                  d={miniBarPath(pairX + barW + 4, MINI_BASE - collectedH, barW, MINI_BASE)}
                  className="fill-primary"
                />
                <text
                  x={groupX + groupW / 2}
                  y={MINI_H - 4}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted-foreground"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Latest month, exact — the honesty line under the whisper. */}
        <p className="text-caption text-muted-foreground tabular-nums">
          {last.label}: {t("analytics.billed")} {formatKes(last.billedMinor)} ·{" "}
          {t("analytics.collected")}{" "}
          <span className="font-medium text-foreground">{formatKes(last.collectedMinor)}</span>
        </p>
      </CardContent>
    </Card>
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
        className="w-full text-left rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <Card className="py-0 gap-0 nest-classic-tint border border-warning/40 bg-warning/15 dark:bg-warning/10">
          <CardContent className="p-4 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="size-4 text-attention shrink-0" aria-hidden />
              <p className="text-label font-medium text-attention truncate flex-1 min-w-0">
                {t("agent.funnelCardTitle")}
              </p>
              {/* NEW-style amber pulse badge — the awaiting-decision count */}
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-warning/60 bg-warning/15 dark:bg-warning/10 px-2 py-0.5 text-caption font-semibold text-attention tabular-nums shrink-0">
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
        className="w-full text-left rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <Card className="py-0 gap-0 nest-classic-tint border border-success/40 bg-success/10 dark:bg-success/10">
          <CardContent className="p-4 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden />
              <p className="text-label font-medium text-success truncate flex-1 min-w-0">
                {t("agent.funnelCardTitle")}
              </p>
              {/* success badge — the move-in-ready count */}
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-success/50 bg-success/10 px-2 py-0.5 text-caption font-semibold text-success tabular-nums shrink-0">
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
        className="w-full text-left rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <Card className="py-0 gap-0 nest-classic">
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
      className="w-full text-left rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <Card className="py-0 gap-0 nest-classic bg-muted/40">
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
    <div className="shrink-0 w-44 rounded-[6px] border p-3 nest-classic">
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
    <Card className="py-0 gap-0 nest-classic">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Letter tile — the classic square monogram, serif initial. */}
          <span
            aria-hidden
            className="size-10 shrink-0 rounded-[4px] border border-primary/30 bg-primary/5 text-primary grid place-items-center font-serif text-h3 font-semibold"
          >
            {property.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-h3 font-semibold truncate">{property.name}</p>
            <p className="text-caption text-muted-foreground truncate">{property.location}</p>
          </div>
          <Building2 className="size-4 text-muted-foreground/60 shrink-0" aria-hidden />
        </div>
        <p className="text-caption text-muted-foreground mt-3 tabular-nums">
          {t("property.unitsSummary", {
            units: property.unitCount,
            occupied: property.occupiedCount,
            vacant: Math.max(0, vacant),
          })}
        </p>
        <Progress
          className="h-1.5 mt-3"
          value={property.unitCount > 0 ? Math.round((property.occupiedCount / property.unitCount) * 100) : 0}
          aria-hidden
        />
      </CardContent>
    </Card>
  );
}
