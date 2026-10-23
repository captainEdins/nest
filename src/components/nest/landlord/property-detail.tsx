"use client";

/**
 * Phase 26 (issue #121) · Property detail — the pushed screen behind every
 * property card tap (landlord home + Properties tab).
 *
 * The user's ask: "tap on property and it opens where they can be able to
 * add a unit or see the list of all the units available with their tenant.
 * that is more cleaner." The flat all-properties unit directory on the
 * Properties tab is gone; THIS screen is the scoped replacement:
 *
 * - masthead — the letter-tile monogram, name, location, units summary and
 *   occupancy bar (the same anatomy as the card, one level deeper);
 * - the property's units, one row each — label · tenant · type · rent ·
 *   balance · status — with EVERY row action the old flat list carried
 *   (statement opener, complete move-out, settle deposit — nothing lost);
 * - the "Add unit" CTA → the AddUnitSheet (new units are born VACANT).
 *
 * Data: ["overview"].properties for the masthead + ["units"] for the rows
 * (the same keys the settle/move-out flows invalidate — the detail stays
 * live after every exit-arc mutation). Back = popScreen, the app-shell
 * precedent (listing/statement).
 */

import { Building2, DoorOpen, HandCoins, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PropertyDto, UnitDto } from "@/lib/types";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useLandlordOverview } from "@/hooks/use-overview";
import { useUnits } from "@/hooks/use-deposits";
import { OpenStatementButton } from "@/components/nest/shared/statement-screen";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { formatDate, calendarDayReached } from "@/components/nest/shared/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function PropertyDetailScreen({ propertyId }: { propertyId: string }) {
  const { t } = useI18n();
  const openSettleDeposit = useUIStore((s) => s.openSettleDeposit);
  const openMoveOut = useUIStore((s) => s.openMoveOut);
  const openAddUnit = useUIStore((s) => s.openAddUnit);
  const { data: overview, isPending: overviewPending, error: overviewError, refetch } = useLandlordOverview();
  const unitsQuery = useUnits(true);

  const property = overview?.properties.find((p) => p.id === propertyId) ?? null;
  const units = (unitsQuery.data ?? [])
    .filter((unit) => unit.propertyId === propertyId)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  // Overview failed → the screen's own error state (retry refetches).
  if (overviewError != null) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 nest-stagger">
      {/* MASTHEAD — the card anatomy, one level deeper. */}
      {overviewPending || !overview ? (
        <ListSkeleton rows={3} />
      ) : property == null ? (
        // Unknown id (deleted property / stale link) — honest empty, one tap
        // back to the directory the user came from.
        <EmptyState
          icon={Building2}
          title={t("property.notFoundTitle")}
          hint={t("property.notFoundHint")}
        />
      ) : (
        <PropertyMasthead property={property} onAddUnit={() => openAddUnit(property.id)} />
      )}

      {/* UNITS — the property's own directory (tenant, type, rent, money
       * position, status + the exit-arc actions), nothing from other plots. */}
      <section aria-label={t("nav.units")}>
        <SectionHeader
          variant="classic"
          title={t("nav.units")}
          count={units.length}
          className="mb-3"
        />
        {unitsQuery.error != null ? (
          <ErrorState onRetry={() => unitsQuery.refetch()} />
        ) : unitsQuery.isPending ? (
          <ListSkeleton rows={4} />
        ) : units.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title={t("property.noUnitsTitle")}
            hint={t("property.noUnitsHint")}
            actionLabel={property ? t("property.addUnit") : undefined}
            onAction={property ? () => openAddUnit(property.id) : undefined}
          />
        ) : (
          <Card className="divide-y gap-0 py-0 nest-classic">
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
    </div>
  );
}

/** The card anatomy, one level deeper — plus the Add-unit CTA (Phase 26). */
function PropertyMasthead({ property, onAddUnit }: { property: PropertyDto; onAddUnit: () => void }) {
  const { t } = useI18n();
  const vacant = Math.max(0, property.unitCount - property.occupiedCount);
  const occupancyPct =
    property.unitCount > 0 ? Math.round((property.occupiedCount / property.unitCount) * 100) : 0;

  return (
    <Card className="py-0 gap-0 nest-classic">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Letter tile — the classic square monogram, serif initial. */}
          <span
            aria-hidden
            className="size-12 shrink-0 rounded-[4px] border border-primary/30 bg-primary/5 text-primary grid place-items-center font-serif text-h2 font-semibold"
          >
            {property.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-h3 font-semibold truncate">{property.name}</p>
            <p className="text-caption text-muted-foreground truncate">{property.location}</p>
            <p className="text-caption text-muted-foreground mt-1 tabular-nums">
              {t("property.unitsSummary", {
                units: property.unitCount,
                occupied: property.occupiedCount,
                vacant,
              })}
            </p>
          </div>
          <span className="text-label text-muted-foreground tabular-nums shrink-0">
            {occupancyPct}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Progress className="h-2 flex-1" value={occupancyPct} aria-hidden />
        </div>
        {/* The user's ask, verbatim: tap in → add a unit. 44px target. */}
        <Button
          type="button"
          className="h-11 w-full mt-4"
          onClick={onAddUnit}
          aria-label={t("property.addUnitAria", { name: property.name })}
        >
          <Plus aria-hidden />
          {t("property.addUnit")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * One unit row — moved from the Properties tab's flat directory (Phase 26):
 * same anatomy everywhere (label · tenant, type + rent, balance, status
 * badge), same actions — the statement opener (Phase 15), the exit executor
 * (Phase 11: complete move-out), and the settlement flow in order. Vacant
 * rows stay informational — a fresh unit has no story to tell yet.
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
  // Phase 15 — any live tenancy (occupied or on notice) can show its record.
  const hasLiveTenancy =
    (unit.status === "OCCUPIED" || unit.status === "NOTICE") && tenancy != null;
  // Phase 11: an ENDED lease with the deposit still HELD keeps its settle
  // action after the move-out — the money decision survives the exit.
  const endedWithDeposit = tenancy?.tenancyStatus === "ENDED";
  const moveOutReached =
    tenancy?.moveOutDate != null && calendarDayReached(tenancy.moveOutDate);

  return (
    <div className="p-4 animate-in fade-in duration-300 fill-mode-both transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">
            {unit.label}
            <span className="text-muted-foreground font-normal">
              {tenancy ? ` · ${tenancy.tenantName}` : " · —"}
            </span>
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {t(`unitType.${unit.type}` as const)} · {formatKes(unit.rentAmountMinor)}{" "}
            {t("agent.perMonth")}
            {tenancy && tenancy.balanceMinor > 0 ? (
              <span className="text-attention">
                {" "}
                · {t("money.balance")} {formatKes(tenancy.balanceMinor)}
              </span>
            ) : null}
            {tenancy?.tenancyStatus === "NOTICE" && tenancy.moveOutDate ? (
              <span className="text-attention tabular-nums">
                {" "}· {t("notice.onNoticeChip", { date: formatDate(tenancy.moveOutDate) })}
              </span>
            ) : null}
          </p>
        </div>
        {/* Phase 15 — this tenancy's money story, one tap away */}
        {hasLiveTenancy && tenancy != null ? (
          <OpenStatementButton tenancyId={tenancy.id} tenantName={tenancy.tenantName} />
        ) : null}
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
