"use client";

/**
 * S-17c · Units (caretaker tab) — search + status filter chips; tapping an
 * occupied row opens the cash-collection flow preselected (S-06).
 */

import * as React from "react";
import { DoorOpen, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useCaretakerOverview } from "@/hooks/use-overview";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UnitDto } from "@/lib/types";

type StatusFilter = "ALL" | "OCCUPIED" | "VACANT";

export function CaretakerUnits() {
  const { t } = useI18n();
  const openCashFlow = useUIStore((s) => s.openCashFlow);
  const { data, isPending, error, refetch } = useCaretakerOverview();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const units = React.useMemo(() => {
    const all = data?.units ?? [];
    const occupiedFirst = [...all].sort((a, b) => {
      const aOccupied = a.status === "OCCUPIED" ? 0 : 1;
      const bOccupied = b.status === "OCCUPIED" ? 0 : 1;
      return aOccupied - bOccupied;
    });
    const query = search.trim().toLowerCase();
    return occupiedFirst.filter((unit) => {
      if (statusFilter !== "ALL" && unit.status !== statusFilter) return false;
      if (!query) return true;
      const tenantName = unit.tenancy?.tenantName ?? "";
      return (
        unit.label.toLowerCase().includes(query) || tenantName.toLowerCase().includes(query)
      );
    });
  }, [data, search, statusFilter]);

  const filters: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: t("common.filterAll") },
    { value: "OCCUPIED", label: t("status.occupied") },
    { value: "VACANT", label: t("status.vacant") },
  ];

  return (
    <section aria-label={t("nav.units")}>
      <h1 className="text-h2 font-semibold mb-4">{t("nav.units")}</h1>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.searchTenantUnit")}
              aria-label={t("common.search")}
              className="h-11 sm:h-10 pl-10"
            />
          </div>

          <div className="flex gap-2" role="group" aria-label={t("common.status")}>
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={statusFilter === filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "shrink-0 h-9 px-3 rounded-full text-caption font-medium border transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring outline-none",
                  statusFilter === filter.value
                    ? "bg-secondary text-secondary-foreground border-transparent"
                    : "border-border text-muted-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {isPending ? (
            <ListSkeleton rows={6} />
          ) : units.length === 0 ? (
            <EmptyState icon={DoorOpen} title={t("empty.units")} />
          ) : (
            <Card className="divide-y">
              {units.map((unit) => (
                <UnitRow key={unit.id} unit={unit} onCollect={openCashFlow} />
              ))}
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function UnitRow({
  unit,
  onCollect,
}: {
  unit: UnitDto;
  onCollect: (tenancyId?: string) => void;
}) {
  const { t } = useI18n();
  const tenancy = unit.tenancy;
  const canCollect = unit.status === "OCCUPIED" && tenancy !== null && tenancy !== undefined;

  return (
    <button
      type="button"
      disabled={!canCollect}
      onClick={() => canCollect && onCollect(tenancy!.id)}
      className="w-full text-left p-4 min-h-14 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none disabled:cursor-default"
      aria-label={`${unit.label}${tenancy ? ` · ${tenancy.tenantName}` : ""}`}
    >
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
        </p>
      </div>
      <StatusBadge status={unit.status} className="shrink-0" />
    </button>
  );
}
