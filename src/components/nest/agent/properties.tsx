"use client";

/**
 * S-12 · Agent Properties tab (Phase 23, issue #109 — agent parity).
 *
 * The landlord's Properties tab, scoped to the appointed plots: the same
 * PropertyCard grid fed by `AgentOverviewDto.portfolioProperties` (one cached
 * call — no new endpoint), plus the vacancy-pipeline section the agent owns
 * (unlisted vacant units with the create-listing CTA). Unit-level deposit
 * actions stay on the landlord's desk — money decisions are the owner's.
 */

import { Building2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAgentOverview } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatKes } from "@/lib/money";
import { PropertyCard } from "@/components/nest/landlord/properties";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AgentPropertiesScreen() {
  const { t } = useI18n();
  const setCreateListingOpen = useUIStore((s) => s.setCreateListingOpen);
  const { data, isPending, error, refetch } = useAgentOverview();

  const properties = data?.portfolioProperties ?? [];
  const unlisted = data?.unlistedVacantUnits ?? [];

  return (
    <section aria-label={t("nav.properties")}>
      <h1 className="text-h2 font-semibold mb-4">{t("nav.properties")}</h1>
      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : properties.length === 0 ? (
        <EmptyState icon={Building2} title={t("empty.properties")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* The vacancy pipeline — the agent's own lever: vacant units that
          still need a listing. The amber tint in the classic frame. */}
      {unlisted.length > 0 ? (
        <section aria-label={t("agent.vacancyFunnel")} className="mt-6">
          <SectionHeader
            title={t("agent.vacancyFunnel")}
            count={unlisted.length}
            className="mb-3"
          />
          <Card className="divide-y gap-0 py-0 nest-classic-tint border border-warning/40">
            {unlisted.map((unit) => (
              <div
                key={unit.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold truncate">
                    {unit.label} · {unit.propertyName}
                  </p>
                  <p className="text-caption text-muted-foreground mt-0.5 tabular-nums">
                    {formatKes(unit.rentAmountMinor)} {t("agent.perMonth")}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => setCreateListingOpen(true)}
                >
                  <Plus aria-hidden />
                  {t("agent.createListing")}
                </Button>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </section>
  );
}
