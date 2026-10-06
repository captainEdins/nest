"use client";

/**
 * S-05 · Caretaker home — ONE call (CaretakerOverviewDto). Today hero
 * (collected-today + month progress), 2×2 quick actions, units, recent
 * collections.
 */

import * as React from "react";
import {
  Banknote,
  ChevronRight,
  DoorOpen,
  Smartphone,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useCaretakerOverview, useSession } from "@/hooks/use-overview";
import { formatMonthKey } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { PaymentRow } from "@/components/nest/shared/payment-row";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Receipt } from "lucide-react";

export function CaretakerHome() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const pushArrears = useUIStore((s) => s.pushArrears);
  const openCashFlow = useUIStore((s) => s.openCashFlow);
  const openStkRequest = useUIStore((s) => s.openStkRequest);
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useCaretakerOverview();

  const units = React.useMemo(() => {
    const all = data?.units ?? [];
    return [...all].sort((a, b) => {
      const aOccupied = a.status === "OCCUPIED" ? 0 : 1;
      const bOccupied = b.status === "OCCUPIED" ? 0 : 1;
      return aOccupied - bOccupied;
    });
  }, [data]);

  if (error != null) {
    return (
      <section aria-label={t("caretaker.todaysCollections")}>
        <ErrorState onRetry={() => refetch()} />
      </section>
    );
  }

  const name = session?.profile.fullName.split(" ")[0] ?? "";
  const totals = data?.totals;
  const recentPayments = data?.recentPayments ?? [];
  const monthProgressPct =
    totals && totals.monthExpectedMinor > 0
      ? Math.min(100, Math.round((totals.monthCollectedMinor / totals.monthExpectedMinor) * 100))
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h3 font-semibold truncate">
          {t("common.greeting", { name })}
          {data?.property ? <span className="text-muted-foreground font-normal"> · {data.property.name}</span> : null}
        </h1>
        {data ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {formatMonthKey(data.month)}
          </span>
        ) : null}
      </div>

      {isPending || !totals ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <HeroSkeleton className="h-36" />
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <>
          {/* Hero — today + month progress (todayExpected not in the DTO:
              month numbers labelled this-month per screen-specs fallback). */}
          <Card className="bg-secondary">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <p className="text-label font-medium text-muted-foreground">
                {t("caretaker.todaysCollections")}
              </p>
              <p className="text-kpi font-bold tabular-nums">
                {formatKes(totals.todayCollectedMinor)}
              </p>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-caption text-muted-foreground">{t("common.thisMonth")}</p>
                  <p className="text-caption text-muted-foreground tabular-nums">
                    {formatKes(totals.monthCollectedMinor)} / {formatKes(totals.monthExpectedMinor)}
                  </p>
                </div>
                <Progress className="h-2" value={monthProgressPct} aria-label={t("landlord.collectionRate")} />
              </div>
              {totals.arrearsTenantCount > 0 ? (
                <button
                  type="button"
                  onClick={pushArrears}
                  className="w-full flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/15 dark:bg-warning/10 px-3 h-11 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  <span className="text-attention text-label font-medium flex items-center gap-1.5 min-w-0">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      {t("arrears.tenantsBehind", { count: totals.arrearsTenantCount })}
                    </span>
                  </span>
                  <span className="text-attention text-label shrink-0">{t("arrears.viewAll")}</span>
                </button>
              ) : null}

              {/* Open repairs — straight into the queue (Phase 2) */}
              <button
                type="button"
                onClick={() => setTab("repairs")}
                aria-label={t("repairs.openRepairs")}
                className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 h-11 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors hover:bg-muted/40 active:scale-[0.99]"
              >
                <span
                  className={`flex items-center gap-1.5 text-label font-medium min-w-0 ${
                    totals.openTickets > 0 ? "text-attention" : "text-foreground"
                  }`}
                >
                  <Wrench
                    className={`size-4 shrink-0 ${totals.openTickets > 0 ? "text-attention" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <span className="truncate">{t("repairs.openRepairs")}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-label font-semibold tabular-nums">{totals.openTickets}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </button>
            </CardContent>
          </Card>

          {/* Quick actions 2×2 */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              className="h-20 flex-col gap-1.5 text-body font-semibold"
              onClick={() => openCashFlow()}
            >
              <Banknote size={20} aria-hidden />
              {t("caretaker.recordCash")}
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-1.5 text-body font-semibold"
              onClick={() => openStkRequest()}
            >
              <Smartphone size={20} aria-hidden />
              {t("caretaker.requestMpesa")}
            </Button>
            <Button
              variant="secondary"
              className="h-20 flex-col gap-1.5 text-body font-semibold"
              onClick={() => setTab("units")}
            >
              <DoorOpen size={20} aria-hidden />
              {t("nav.units")}
            </Button>
            <Button
              variant="secondary"
              className="h-20 flex-col gap-1.5 text-body font-semibold"
              onClick={pushArrears}
            >
              <TriangleAlert size={20} aria-hidden />
              {t("nav.arrears")}
            </Button>
          </div>

          {/* Units */}
          <section aria-label={t("nav.units")}>
            <SectionHeader
              title={t("nav.units")}
              count={data?.units.length}
              actionLabel={t("arrears.viewAll")}
              onAction={() => setTab("units")}
              className="mb-3"
            />
            {units.length === 0 ? (
              <EmptyState icon={DoorOpen} title={t("empty.units")} />
            ) : (
              <Card className="divide-y">
                {units.slice(0, 5).map((unit) => (
                  <UnitRow key={unit.id} unit={unit} />
                ))}
              </Card>
            )}
          </section>

          {/* Recent collections */}
          <section aria-label={t("caretaker.recentCollections")}>
            <SectionHeader title={t("caretaker.recentCollections")} className="mb-3" />
            {recentPayments.length === 0 ? (
              <EmptyState icon={Receipt} title={t("empty.payments")} />
            ) : (
              <Card className="divide-y">
                {recentPayments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UnitRow({ unit }: { unit: NonNullable<ReturnType<typeof useCaretakerOverview>["data"]>["units"][number] }) {
  const { t } = useI18n();
  const openCashFlow = useUIStore((s) => s.openCashFlow);
  const tenancy = unit.tenancy;
  const canCollect = unit.status === "OCCUPIED" && tenancy !== null && tenancy !== undefined;

  return (
    <button
      type="button"
      disabled={!canCollect}
      onClick={() => canCollect && openCashFlow(tenancy!.id)}
      className="w-full text-left p-4 min-h-14 flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset outline-none disabled:cursor-default"
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold">
          {unit.label}
          <span className="text-muted-foreground font-normal">
            {tenancy ? ` · ${tenancy.tenantName}` : " · —"}
          </span>
        </p>
        {tenancy && tenancy.balanceMinor > 0 ? (
          <p className="text-caption text-attention tabular-nums mt-0.5">
            {t("money.balance")} {formatKes(tenancy.balanceMinor)}
          </p>
        ) : null}
      </div>
      <StatusBadge status={unit.status} className="shrink-0" />
    </button>
  );
}
