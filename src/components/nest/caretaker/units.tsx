"use client";

/**
 * S-17c · Units (caretaker tab) — search + status filter chips; tapping an
 * occupied row opens the cash-collection flow preselected (S-06). Rows with
 * an ACTIVE/NOTICE tenancy also carry a Deposit cell (Phase 3, issue #37):
 * the caretaker's read-only view of that tenancy's deposit ledger — the
 * settlement flow itself stays landlord-only (SettleDepositModal is
 * role-gated in the shell).
 */

import * as React from "react";
import { DoorOpen, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useUnits } from "@/hooks/use-deposits";
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
  const pushDeposit = useUIStore((s) => s.pushDeposit);
  // /api/units (not the overview) — it carries the CURRENT tenancy on NOTICE
  // rows too, so every ACTIVE/NOTICE unit gets its deposit cell.
  const { data, isPending, error, refetch } = useUnits(true);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  const units = React.useMemo(() => {
    const all = data ?? [];
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
                  "shrink-0 h-11 px-4 rounded-full text-caption font-medium border transition-colors",
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
                <UnitRow key={unit.id} unit={unit} onCollect={openCashFlow} onDeposit={pushDeposit} />
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
  onDeposit,
}: {
  unit: UnitDto;
  onCollect: (tenancyId?: string) => void;
  onDeposit: (tenancyId?: string) => void;
}) {
  const { t } = useI18n();
  const tenancy = unit.tenancy;
  const canCollect = unit.status === "OCCUPIED" && tenancy !== null && tenancy !== undefined;

  return (
    <div className="p-4 flex items-center gap-3 animate-in fade-in duration-300 fill-mode-both">
      <button
        type="button"
        disabled={!canCollect}
        onClick={() => canCollect && onCollect(tenancy!.id)}
        className="flex-1 min-w-0 text-left rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none disabled:cursor-default"
        aria-label={`${unit.label}${tenancy ? ` · ${tenancy.tenantName}` : ""}`}
      >
        <p className="text-body font-semibold truncate">
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
      </button>
      {tenancy != null ? (
        <button
          type="button"
          onClick={() => onDeposit(tenancy.id)}
          aria-label={`${t("money.deposit")}: ${formatKes(unit.depositAmountMinor)} · ${unit.label}`}
          className="shrink-0 h-11 min-w-28 px-3 rounded-lg border bg-background flex flex-col items-end justify-center gap-0 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors hover:bg-muted/40 active:scale-[0.99]"
        >
          <span className="text-caption text-muted-foreground truncate max-w-full">
            {t("money.deposit")}
          </span>
          <span className="text-label font-semibold tabular-nums whitespace-nowrap">
            {formatKes(unit.depositAmountMinor)} · {t("deposit.kind.HOLD")}
          </span>
        </button>
      ) : null}
      <StatusBadge status={unit.status} className="shrink-0" />
    </div>
  );
}
