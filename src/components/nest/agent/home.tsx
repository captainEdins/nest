"use client";

/**
 * S-12 · Agent home — ONE call (AgentOverviewDto). Portfolio KPIs, honest
 * phase notice (i18n key primary, DTO string is the documented fallback —
 * the key exists, so only it renders), property cards.
 */

import { Building2, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAgentOverview, useSession } from "@/hooks/use-overview";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { KpiSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function AgentHome() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useAgentOverview();

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-h3 font-semibold">{t("common.greeting", { name })}</h1>

      {isPending || !totals ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <div className="grid grid-cols-3 gap-3">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCell label={t("nav.properties")} value={String(totals.properties)} />
            <KpiCell label={t("nav.units")} value={String(totals.units)} />
            <KpiCell label={t("landlord.occupancyRate")} value={`${totals.occupancyRatePct}%`} />
          </div>

          {/* Phase notice — amber tint, info icon, non-urgent (S-12) */}
          <div className="rounded-xl border border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 flex items-start gap-3">
            <Info className="size-5 text-attention shrink-0 mt-0.5" aria-hidden />
            <p className="text-body text-attention">{t("phase.agentNotice", { phase: "4" })}</p>
          </div>

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

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 min-w-0">
      <p className="text-caption text-muted-foreground truncate">{label}</p>
      <p className="text-kpi font-bold tabular-nums mt-1 truncate">{value}</p>
    </div>
  );
}
