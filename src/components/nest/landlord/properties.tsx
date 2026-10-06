"use client";

/** S-17b · Properties (landlord tab) — PropertyDto cards, non-navigating. */

import { Building2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PropertyDto } from "@/lib/types";
import { useLandlordOverview } from "@/hooks/use-overview";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function PropertiesScreen() {
  const { t } = useI18n();
  const { data, isPending, error, refetch } = useLandlordOverview();
  const properties = data?.properties ?? [];

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
    </section>
  );
}

function PropertyCard({ property }: { property: PropertyDto }) {
  const { t } = useI18n();
  const vacant = Math.max(0, property.unitCount - property.occupiedCount);
  const occupancyPct =
    property.unitCount > 0 ? Math.round((property.occupiedCount / property.unitCount) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-h3 font-semibold truncate">{property.name}</p>
        </div>
        <p className="text-caption text-muted-foreground truncate mt-0.5">{property.location}</p>
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
}
