"use client";

/**
 * S-12 · Agent home (Phase 4 rewrite, issue #47; Phase 23 issue #109 — agent
 * parity) — ONE call (AgentOverviewDto) + the shared ["analytics"] cache.
 *
 * The appointed manager's desk now mirrors the landlord's: the ledger
 * letterhead with estate figures, the money KPI quad (collected + MoM,
 * arrears, occupancy, open repairs), the mini collection trend, the security
 * digest, the unmatched alert, and the arrears + recent-payments previews —
 * every number scoped to `Properties WHERE agentId = SELF`. The leasing
 * funnel (the agent's own lever) keeps its ruled column heads and hero card.
 *
 * Phase 21 (D-034): the classic ledger frame throughout.
 */

import {
  Building2,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Megaphone,
  Plus,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { greetingKeyForHour, useI18n } from "@/lib/i18n";
import { useAgentOverview, useSession, useStaffAnalytics } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatKes } from "@/lib/money";
import type { ListingDto } from "@/lib/types";
import { formatMonthKey, timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { ClassicMasthead, MastheadAside, MastheadSkeleton } from "@/components/nest/shared/classic-masthead";
import { KpiCard, momDeltaPct } from "@/components/nest/shared/kpi-card";
import { MiniTrendCard } from "@/components/nest/shared/mini-trend-card";
import { SecurityCard } from "@/components/nest/shared/security/security-card";
import { ArrearsRow } from "@/components/nest/shared/arrears-row";
import { PaymentRow } from "@/components/nest/shared/payment-row";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, KpiSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { ListingStatusChip, NewBadge } from "@/components/nest/shared/listing-chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentHome() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setPaymentsFilter = useUIStore((s) => s.setPaymentsFilter);
  const openListing = useUIStore((s) => s.openListing);
  const setCreateListingOpen = useUIStore((s) => s.setCreateListingOpen);
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useAgentOverview();
  // Shared ["analytics"] cache — the SAME series the Analytics tab reads
  // (free navigation; the agent's scope comes from the session server-side).
  const { data: analytics } = useStaffAnalytics();

  if (error != null) {
    return (
      <section aria-label={t("role.agent")}>
        <ErrorState onRetry={() => refetch()} />
      </section>
    );
  }

  const name = session?.profile.fullName.split(" ")[0] ?? "";
  const totals = data?.totals;
  const properties = data?.portfolioProperties ?? [];
  const liveListings = data?.liveListings ?? [];
  const unlistedCount = data?.unlistedVacantUnits?.length ?? 0;
  const unmatchedCount = totals?.unmatchedPayments ?? 0;
  const arrears = [...(data?.arrears ?? [])]
    .sort((a, b) => b.balanceMinor - a.balanceMinor)
    .slice(0, 5);
  const recentPayments = data?.recentPayments ?? [];
  const monthly = analytics?.monthly ?? [];
  const collectedSpark = monthly.map((m) => m.collectedMinor);

  return (
    <div className="space-y-4 sm:space-y-6 nest-stagger">
      {/* MASTHEAD (D-034) — the letterhead: the appointment's estate figures
       * (plots · units · this month's expected rent) + the collection-rate
       * aside. Same anatomy as the landlord's — one record, two desks. */}
      <section aria-label={t("role.agent")}>
        {isPending || !data || !totals ? (
          <MastheadSkeleton />
        ) : (
          <ClassicMasthead
            eyebrow={`${t("role.agent")} · ${formatMonthKey(data.month)}`}
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

      {isPending || !totals ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
          <HeroSkeleton className="h-36 nest-classic" />
          <ListSkeleton rows={2} />
        </div>
      ) : (
        <>
          {/* MONEY KPI QUAD (Phase 23) — the landlord's ledger figure boxes,
              scoped to the appointed plots. */}
          <section aria-label={t("landlord.collectedThisMonth")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              <KpiCard
                variant="classic"
                label={t("landlord.occupancyRate")}
                value={`${totals.occupancyRatePct}%`}
                icon={Building2}
                progressPct={totals.occupancyRatePct}
                sub={t("common.ofUnits", { occupied: totals.occupied, total: totals.units })}
              />
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
                      <span className="tabular-nums">
                        {t("repairs.ticketsCount", { count: totals.openTickets })}
                      </span>
                      <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  }
                />
              </button>
            </div>
          </section>

          {/* Funnel KPIs — the agent's own leasing column heads (Phase 4),
              kept as ruled figure boxes under the money quad. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCell label={t("agent.vacantUnits")} value={String(totals.vacantUnits)} />
            <KpiCell label={t("agent.liveListings")} value={String(totals.liveListings)} />
            <KpiCell label={t("agent.newApplicants")} value={String(totals.newApplications)} />
            <KpiCell label={t("agent.inPipeline")} value={String(totals.activeApplications)} />
          </div>

          {/* Compact 6-month collection trend (shared chart + cache). */}
          {monthly.length >= 3 ? <MiniTrendCard monthly={monthly} /> : null}

          {/* Security digest (Phase 3) — eyes on the ground, scoped. */}
          {data ? <SecurityCard security={data.security} variant="classic" /> : null}

          {/* Vacancy funnel — the live listing, the create CTA, or the quiet state */}
          <FunnelCard
            liveListing={liveListings[0] ?? null}
            unlistedCount={unlistedCount}
            onOpenListing={() => liveListings[0] && openListing(liveListings[0].id)}
            onCreateListing={() => setCreateListingOpen(true)}
          />

          {/* Unmatched alert card (amber tint — hidden when zero) — the
              appointed manager can reconcile too (Phase 23). */}
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
                {t("landlord.unmatchedPayments")}:{" "}
                <span className="tabular-nums">{unmatchedCount}</span>
              </p>
              <span className="text-label text-attention flex items-center gap-1 shrink-0">
                {t("unmatched.review")}
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </button>
          ) : null}

          {/* Arrears + recent payments — the money previews, side by side ≥xl. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 items-start">
            <section aria-label={t("landlord.arrears")}>
              <SectionHeader
                variant="classic"
                title={t("landlord.arrears")}
                count={data?.arrears.length}
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

          {/* Live listings preview */}
          {liveListings.length > 0 ? (
            <section aria-label={t("nav.listings")}>
              <SectionHeader
                variant="classic"
                title={t("nav.listings")}
                actionLabel={t("common.viewAll")}
                onAction={() => setTab("listings")}
                className="mb-3"
              />
              <Card className="divide-y gap-0 py-0 nest-classic">
                {liveListings.slice(0, 2).map((listing) => (
                  <ListingPreviewRow key={listing.id} listing={listing} />
                ))}
              </Card>
            </section>
          ) : null}

          {/* Properties */}
          <section aria-label={t("nav.properties")}>
            <SectionHeader
              variant="classic"
              title={t("nav.properties")}
              count={properties.length}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("properties")}
              className="mb-3"
            />
            {properties.length === 0 ? (
              <EmptyState icon={Building2} title={t("empty.properties")} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {properties.map((property) => {
                  const vacant = Math.max(0, property.unitCount - property.occupiedCount);
                  const occupancyPct =
                    property.unitCount > 0
                      ? Math.round((property.occupiedCount / property.unitCount) * 100)
                      : 0;
                  return (
                    <Card className="py-0 gap-0 nest-classic" key={property.id}>
                      <CardContent className="p-4 sm:p-6">
                        <p className="text-h3 font-semibold truncate">{property.name}</p>
                        <p className="text-caption text-muted-foreground truncate">
                          {property.location}
                        </p>
                        <p className="text-caption text-muted-foreground mt-2 tabular-nums">
                          {t("property.unitsSummary", {
                            units: property.unitCount,
                            occupied: property.occupiedCount,
                            vacant,
                          })}
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <Progress className="h-1.5 flex-1" value={occupancyPct} aria-hidden />
                          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
                            {occupancyPct}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vacancy funnel hero — three honest states
// ---------------------------------------------------------------------------

function FunnelCard({
  liveListing,
  unlistedCount,
  onOpenListing,
  onCreateListing,
}: {
  liveListing: ListingDto | null;
  unlistedCount: number;
  onOpenListing: () => void;
  onCreateListing: () => void;
}) {
  const { t } = useI18n();

  // 1. A listing is live — the funnel is running; one tap into its applicants.
  if (liveListing != null) {
    return (
      <button
        type="button"
        onClick={onOpenListing}
        aria-label={`${t("agent.funnelCardTitle")} — ${liveListing.unitLabel}. ${formatKes(
          liveListing.rentAmountMinor,
        )}`}
        className="w-full text-left rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <Card className="py-0 gap-0 nest-classic animate-in fade-in duration-300">
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="size-4 text-muted-foreground shrink-0" aria-hidden />
                <p className="text-label font-medium text-muted-foreground truncate">
                  {t("agent.funnelCardTitle")}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-caption shrink-0">
                {liveListing.unitLabel}
              </Badge>
              <ListingStatusChip status={liveListing.status} />
            </div>

            <p className="text-body-lg font-semibold break-words">{liveListing.title}</p>

            <p className="text-body text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {formatKes(liveListing.rentAmountMinor)}
              </span>{" "}
              {t("agent.perMonth")}
            </p>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-caption text-muted-foreground tabular-nums">
                {t("applicant.count", { count: liveListing.applicationCount })}
              </p>
              {liveListing.newApplicationCount > 0 ? (
                <NewBadge count={liveListing.newApplicationCount} />
              ) : null}
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  // 2. Vacant units with no live listing — the funnel starts here
  //    (the amber tint in the classic frame — urgency via tint, no rail).
  if (unlistedCount > 0) {
    return (
      <Card className="py-0 gap-0 nest-classic-tint border border-warning/40 bg-warning/10 dark:bg-warning/10 animate-in fade-in duration-300">
        <CardContent className="p-4 sm:p-6 space-y-3">
          <p className="text-label font-medium text-muted-foreground">
            {t("agent.funnelCardTitle")}
          </p>
          <p className="text-body text-muted-foreground">{t("agent.createListingDesc")}</p>
          <Button className="w-full h-11" onClick={onCreateListing}>
            <Plus aria-hidden />
            {t("agent.createListing")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 3. Nothing vacant — the portfolio is full (the quiet success state).
  return (
    <Card className="py-0 gap-0 nest-classic bg-muted/30 dark:bg-muted/20 animate-in fade-in duration-300">
      <CardContent className="p-4 sm:p-6 flex items-center gap-3 text-muted-foreground">
        <CheckCircle2 className="size-5 text-success shrink-0" aria-hidden />
        <p className="text-body">{t("agent.emptyVacancies")}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Live listing preview row — the home's 2-row window into the Listings tab
// ---------------------------------------------------------------------------

function ListingPreviewRow({ listing }: { listing: ListingDto }) {
  const { t } = useI18n();
  const openListing = useUIStore((s) => s.openListing);

  return (
    <button
      type="button"
      onClick={() => openListing(listing.id)}
      className="w-full text-left p-3.5 sm:p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] hover:bg-muted/40 active:bg-muted/60"
      aria-label={`${listing.title}. ${formatKes(listing.rentAmountMinor)} ${t("agent.perMonth")}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{listing.title}</p>
        <p className="text-caption text-muted-foreground mt-0.5 truncate">
          {listing.unitLabel} · {listing.propertyName} · {formatKes(listing.rentAmountMinor)}{" "}
          {t("agent.perMonth")}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <ListingStatusChip status={listing.status} />
          <span className="text-caption text-muted-foreground tabular-nums">
            {t("applicant.count", { count: listing.applicationCount })}
          </span>
          {listing.newApplicationCount > 0 ? (
            <NewBadge count={listing.newApplicationCount} />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-caption text-muted-foreground tabular-nums">
          {timeAgo(listing.updatedAt, t)}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </div>
    </button>
  );
}

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="nest-classic-rule p-3 min-w-0">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground truncate">
        {label}
      </p>
      <p className="text-kpi font-bold tabular-nums mt-1 truncate">{value}</p>
    </div>
  );
}

/** Compact 2-line cell skeleton for the 2×2 / 4-up KPI grid. */
function KpiCellSkeleton() {
  return (
    <div className="nest-classic-rule p-3 space-y-2" aria-hidden>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-7 w-1/2" />
    </div>
  );
}
