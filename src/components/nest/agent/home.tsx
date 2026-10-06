"use client";

/**
 * S-12 · Agent home (Phase 4 rewrite, issue #47) — ONE call
 * (AgentOverviewDto). Funnel KPIs (vacant / live / new / in-pipeline), the
 * vacancy-funnel hero (the live listing, or the create-listing CTA when a
 * vacant unit has none, or a quiet "no vacancies" state), a live-listings
 * preview, and the portfolio property cards.
 */

import { Building2, CheckCircle2, ChevronRight, Megaphone, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAgentOverview, useSession } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatKes } from "@/lib/money";
import type { ListingDto } from "@/lib/types";
import { timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { ListingStatusChip, NewBadge } from "@/components/nest/shared/listing-chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentHome() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useAgentOverview();
  const setTab = useUIStore((s) => s.setTab);
  const openListing = useUIStore((s) => s.openListing);
  const setCreateListingOpen = useUIStore((s) => s.setCreateListingOpen);

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-h3 font-semibold">{t("common.greeting", { name })}</h1>

      {isPending || !totals ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCellSkeleton />
            <KpiCellSkeleton />
            <KpiCellSkeleton />
            <KpiCellSkeleton />
          </div>
          <HeroSkeleton className="h-36" />
          <ListSkeleton rows={2} />
        </div>
      ) : (
        <>
          {/* Funnel KPIs — 2×2 on mobile, 4 across from sm */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCell label={t("agent.vacantUnits")} value={String(totals.vacantUnits)} />
            <KpiCell label={t("agent.liveListings")} value={String(totals.liveListings)} />
            <KpiCell label={t("agent.newApplicants")} value={String(totals.newApplications)} />
            <KpiCell label={t("agent.inPipeline")} value={String(totals.activeApplications)} />
          </div>

          {/* Vacancy funnel — the live listing, the create CTA, or the quiet state */}
          <FunnelCard
            liveListing={liveListings[0] ?? null}
            unlistedCount={unlistedCount}
            onOpenListing={() => liveListings[0] && openListing(liveListings[0].id)}
            onCreateListing={() => setCreateListingOpen(true)}
          />

          {/* Live listings preview */}
          {liveListings.length > 0 ? (
            <section aria-label={t("nav.listings")}>
              <SectionHeader
                title={t("nav.listings")}
                actionLabel={t("common.viewAll")}
                onAction={() => setTab("listings")}
                className="mb-3"
              />
              <Card className="divide-y">
                {liveListings.slice(0, 2).map((listing) => (
                  <ListingPreviewRow key={listing.id} listing={listing} />
                ))}
              </Card>
            </section>
          ) : null}

          {/* Properties */}
          <section aria-label={t("nav.properties")}>
            <SectionHeader
              title={t("nav.properties")}
              count={properties.length}
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
                    <Card key={property.id}>
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
                          <Progress className="h-2 flex-1" value={occupancyPct} aria-hidden />
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
        className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition active:scale-[0.99]"
      >
        <Card className="animate-in fade-in duration-300">
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

  // 2. Vacant units with no live listing — the funnel starts here.
  if (unlistedCount > 0) {
    return (
      <Card className="border-l-4 border-l-warning/70 bg-warning/5 dark:bg-warning/10 animate-in fade-in duration-300">
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
    <Card className="bg-muted/40 animate-in fade-in duration-300">
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
      className="w-full text-left p-3.5 sm:p-4 min-h-16 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition active:scale-[0.99] hover:bg-muted/40 active:bg-muted/60"
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
    <div className="rounded-lg border p-3 min-w-0">
      <p className="text-caption text-muted-foreground truncate">{label}</p>
      <p className="text-kpi font-bold tabular-nums mt-1 truncate">{value}</p>
    </div>
  );
}

/** Compact 2-line cell skeleton for the 2×2 / 4-up KPI grid. */
function KpiCellSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2" aria-hidden>
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-7 w-1/2" />
    </div>
  );
}
