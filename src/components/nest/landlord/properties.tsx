"use client";

/**
 * S-17b · Properties (landlord tab) — PropertyDto cards.
 *
 * Phase 26 (issue #121): every card is now a TAP → the property detail
 * pushed screen (units + tenants + add-unit — see property-detail.tsx).
 * The old flat all-properties unit directory is GONE: the detail screen is
 * its scoped, cleaner replacement, and it carries every row action the
 * directory used to hold (statement opener, complete move-out, settle
 * deposit). The card itself keeps the letter-tile anatomy with a chevron
 * affordance.
 */

import { Building2, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PropertyDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview } from "@/hooks/use-overview";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function PropertiesScreen() {
  const { t } = useI18n();
  const openProperty = useUIStore((s) => s.openProperty);
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
            <PropertyCard key={property.id} property={property} onOpen={() => openProperty(property.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Phase 23 (issue #109): exported for the agent's Properties tab —
 * same card, agent-scoped data source (see agent/properties.tsx).
 * Phase 26 (issue #121): optional onOpen — the landlord's tap drills into
 * the property detail; the agent's cards stay informational (no handler). */
export function PropertyCard({
  property,
  onOpen,
}: {
  property: PropertyDto;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const vacant = Math.max(0, property.unitCount - property.occupiedCount);
  const occupancyPct =
    property.unitCount > 0 ? Math.round((property.occupiedCount / property.unitCount) * 100) : 0;

  const body = (
    <CardContent className="p-4 sm:p-6">
      <div className="flex items-center gap-2 min-w-0">
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
        {onOpen ? (
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" aria-hidden />
        ) : (
          <Building2 className="size-4 text-muted-foreground/60 shrink-0" aria-hidden />
        )}
      </div>
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
  );

  if (onOpen == null) {
    return <Card className="py-0 gap-0">{body}</Card>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("property.viewUnitsAria", { name: property.name })}
      className="text-left w-full h-full rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <Card className="py-0 gap-0 nest-classic">{body}</Card>
    </button>
  );
}
