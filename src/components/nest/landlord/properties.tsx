"use client";

/**
 * S-17b · Properties (landlord tab) — PropertyDto cards, non-navigating.
 *
 * Task P2-d (issue #24): a Units directory below the property cards —
 * every in-scope unit with its current tenancy — where NOTICE rows carry the
 * "Settle deposit" action that opens the settlement flow (S-30) with the
 * tenancy id. Vacant/occupied rows are informational only.
 *
 * Phase 11 (issue #78): NOTICE rows now ALSO carry "Complete move-out" — the
 * exit executor — with the move-out date on record shown on the row. The
 * sequencing is deliberate: move-out (exit executed, unit frees) comes first;
 * settle deposit stays the landlord's money decision AFTER the move-out
 * inspection (the server enforces the same order).
 */

import { Building2, DoorOpen, HandCoins } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PropertyDto, UnitDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview } from "@/hooks/use-overview";
import { useUnits } from "@/hooks/use-deposits";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { formatDate } from "@/components/nest/shared/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function PropertiesScreen() {
  const { t } = useI18n();
  const openSettleDeposit = useUIStore((s) => s.openSettleDeposit);
  const openMoveOut = useUIStore((s) => s.openMoveOut);
  const { data, isPending, error, refetch } = useLandlordOverview();
  const unitsQuery = useUnits(true);
  const properties = data?.properties ?? [];
  const units = unitsQuery.data ?? [];

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

      {/* Units — the deposit settlement entry point lives on NOTICE rows */}
      {unitsQuery.isPending || unitsQuery.error != null || units.length > 0 ? (
        <section aria-label={t("nav.units")} className="mt-6">
          <SectionHeader title={t("nav.units")} count={units.length} className="mb-3" />
          {unitsQuery.error != null ? (
            <ErrorState onRetry={() => unitsQuery.refetch()} />
          ) : unitsQuery.isPending ? (
            <ListSkeleton rows={5} />
          ) : (
            <Card className="divide-y">
              {units.map((unit) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  onSettle={openSettleDeposit}
                  onMoveOut={openMoveOut}
                />
              ))}
            </Card>
          )}
        </section>
      ) : null}
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

/**
 * One unit row — caretaker-units idiom (label · tenant, type, balance, status
 * badge). NOTICE rows with a live tenancy offer the exit executor (Phase 11)
 * and, in order, the settlement flow; vacant/occupied rows stay informational.
 */
function UnitRow({
  unit,
  onSettle,
  onMoveOut,
}: {
  unit: UnitDto;
  onSettle: (tenancyId: string) => void;
  onMoveOut: (
    tenancyId: string,
    context: { unitLabel: string; tenantName: string; moveOutDate: string | null },
  ) => void;
}) {
  const { t } = useI18n();
  const tenancy = unit.tenancy ?? null;
  const canAct = unit.status === "NOTICE" && tenancy != null;
  // Phase 11: an ENDED lease with the deposit still HELD keeps its settle
  // action after the move-out — the money decision survives the exit.
  const endedWithDeposit = tenancy?.tenancyStatus === "ENDED";
  const moveOutReached =
    tenancy?.moveOutDate != null && new Date(tenancy.moveOutDate).getTime() <= Date.now();

  return (
    <div className="p-4 animate-in fade-in duration-300 fill-mode-both">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">
            {unit.label}
            <span className="text-muted-foreground font-normal">
              {tenancy ? ` · ${tenancy.tenantName}` : " · —"}
            </span>
          </p>
          <p className="text-caption text-muted-foreground">
            {t(`unitType.${unit.type}` as const)}
            {tenancy && tenancy.balanceMinor > 0 ? (
              <span className="text-attention tabular-nums">
                {" "}
                · {t("money.balance")} {formatKes(tenancy.balanceMinor)}
              </span>
            ) : null}
            {tenancy?.moveOutDate ? (
              <span className="text-attention tabular-nums">
                {" "}· {t("notice.onNoticeChip", { date: formatDate(tenancy.moveOutDate) })}
              </span>
            ) : null}
          </p>
        </div>
        <StatusBadge status={unit.status} className="shrink-0" />
      </div>
      {endedWithDeposit && tenancy ? (
        /* The exit is done; the deposit is not — the settle action stays. */
        <div className="flex items-center gap-2 mt-3">
          <Button className="h-11 flex-1" onClick={() => onSettle(tenancy.id)}>
            <HandCoins aria-hidden />
            {t("deposit.settleCta")}
          </Button>
        </div>
      ) : canAct && tenancy ? (
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          {/* The exit executor — primary on/after the notice day, waiting before. */}
          <Button
            className="h-11 flex-1"
            variant={moveOutReached ? "default" : "secondary"}
            disabled={!moveOutReached}
            onClick={() =>
              onMoveOut(tenancy.id, {
                unitLabel: unit.label,
                tenantName: tenancy.tenantName,
                moveOutDate: tenancy.moveOutDate,
              })
            }
          >
            <DoorOpen aria-hidden />
            {t("notice.moveOutAction")}
          </Button>
          <Button
            className="h-11 flex-1 sm:flex-none"
            variant="outline"
            onClick={() => onSettle(tenancy.id)}
          >
            <HandCoins aria-hidden />
            {t("deposit.settleCta")}
          </Button>
        </div>
      ) : null}
      {canAct && tenancy && !moveOutReached ? (
        <p className="text-caption text-muted-foreground mt-2">
          {t("notice.moveOutNotReached")}
        </p>
      ) : null}
    </div>
  );
}
