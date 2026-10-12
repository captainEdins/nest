"use client";

/**
 * S-05 · Caretaker home — ONE call (CaretakerOverviewDto).
 *
 * Phase 18 (D-031, the detail sweep): the v2 asymmetric hero mirrored from
 * the landlord home (D-030) — left, the shift-briefing panel (cream bloom:
 * greeting, plot context, month progress, the arrears alert row); right,
 * the three money action tiles (Record cash stays the ONE solid primary)
 * above the KPI quad (today · arrears · repairs · unmatched). Mobile keeps
 * the briefing first and the actions within the first fold (Phase 9 rule);
 * Units + recent collections sit side-by-side from ≥xl.
 */

import * as React from "react";
import {
  Banknote,
  ChevronRight,
  DoorOpen,
  HelpCircle,
  Smartphone,
  TrendingDown,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { greetingKeyForHour, useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useUIStore } from "@/lib/ui-store";
import { useCaretakerOverview, useSession } from "@/hooks/use-overview";
import { formatMonthKey } from "@/components/nest/shared/format";
import { SecurityCard } from "@/components/nest/shared/security/security-card";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { momDeltaPct, KpiCard } from "@/components/nest/shared/kpi-card";
import { PaymentRow } from "@/components/nest/shared/payment-row";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, KpiSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { StatusBadge } from "@/components/nest/shared/status-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Receipt } from "lucide-react";

/** Action tile — the reference's icon-in-tinted-container pattern. The
 *  money-in action wears the solid primary; the rest are white surfaces. */
function ActionTile({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-xl h-20 min-w-0 flex flex-col items-center justify-center gap-1.5 px-2 outline-none",
        "transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        primary
          ? "bg-primary text-primary-foreground nest-card-shadow"
          : "bg-card text-foreground nest-card-shadow",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-9 rounded-lg grid place-items-center transition-transform duration-200 group-hover:scale-105",
          primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="text-caption sm:text-label font-semibold leading-4 text-center line-clamp-2">
        {label}
      </span>
    </button>
  );
}

/** Tappable KPI wrapper (Phase 16 hover-lift contract). */
function KpiButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-left w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function CaretakerHome() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const pushArrears = useUIStore((s) => s.pushArrears);
  const openCashFlow = useUIStore((s) => s.openCashFlow);
  const openStkRequest = useUIStore((s) => s.openStkRequest);
  const setPaymentsFilter = useUIStore((s) => s.setPaymentsFilter);
  // Phase 12: the caretaker's on-site spend capture — one tap from home.
  const setRecordExpenseOpen = useUIStore((s) => s.setRecordExpenseOpen);
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
    <div className="space-y-4 sm:space-y-6 nest-stagger">
      {isPending || !totals || !data ? (
        <div className="space-y-4 sm:space-y-6" aria-busy>
          <HeroSkeleton className="h-36" />
          <KpiSkeleton />
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <>
          {/* HERO BAND (D-031) — the asymmetric split, mirrored from the
           * landlord home: briefing panel left, actions + KPI quad right.
           * Mobile stacks (briefing first, actions inside the first fold). */}
          <section
            aria-label={t("caretaker.todaysCollections")}
            className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] items-stretch"
          >
            {/* Left — the shift briefing panel (cream bloom, D-029).
             * Phase 18 refinement: the panel mirrors the landlord's —
             * greeting, plot context, the arrears alert, and the TODAY
             * pill (the shift's live score) as the panel's pulse; the
             * month numbers live in the quad's highlight card. */}
            <div className="relative overflow-hidden rounded-2xl bg-primary/5 dark:bg-primary/10 nest-hero-soft p-5 sm:p-6 flex flex-col min-w-0">
              <h1 className="text-h2 lg:text-display font-bold tracking-tight leading-tight">
                {t(greetingKeyForHour(), { name })}
              </h1>
              <p className="text-caption text-muted-foreground tabular-nums mt-1 truncate">
                {data.property ? `${data.property.name} · ` : ""}
                {formatMonthKey(data.month)}
              </p>

              {/* Plot context — the one sentence that says what this desk
               * is responsible for right now. */}
              <p className="text-body text-muted-foreground mt-3 tabular-nums">
                {t("caretaker.heroContext", {
                  units: data.units.length,
                  amount: formatKes(totals.monthExpectedMinor),
                })}
              </p>

              {/* Arrears alert — the amber row rides in the briefing (the
               * money conversation starts where the debt is). */}
              {totals.arrearsTenantCount > 0 ? (
                <button
                  type="button"
                  onClick={pushArrears}
                  className="mt-4 w-full flex items-center justify-between gap-2 rounded-lg bg-warning/15 dark:bg-warning/10 px-3 h-11 text-left focus-visible:ring-2 focus-visible:ring-ring outline-none transition-transform duration-200 hover:-translate-y-px active:scale-[0.99]"
                >
                  <span className="text-attention text-label font-medium flex items-center gap-1.5 min-w-0">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      {t("arrears.tenantsBehind", { count: totals.arrearsTenantCount })}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-attention shrink-0" aria-hidden />
                </button>
              ) : null}

              {/* Today's collections — the shift's live score, riding in the
               * briefing as the white pill (the landlord's rate-pill slot). */}
              <div className="mt-auto pt-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 h-8 text-label font-medium shadow-sm">
                  <span aria-hidden className="size-2 rounded-full bg-primary" />
                  {t("caretaker.todaysCollections")}
                  <span className="tabular-nums font-semibold">
                    {formatKes(totals.todayCollectedMinor)}
                  </span>
                </span>
              </div>
            </div>

            {/* Right — the three money actions, then the KPI quad. */}
            <div className="space-y-4 sm:space-y-5 min-w-0 flex flex-col">
              {/* Quick actions (Phase 9 rule: above the fold on mobile,
               * straight under the briefing) — Record cash is the ONE
               * solid-primary surface on the desk. */}
              <div className="grid grid-cols-3 gap-3">
                <ActionTile primary icon={Banknote} label={t("caretaker.recordCash")} onClick={() => openCashFlow()} />
                <ActionTile icon={Smartphone} label={t("caretaker.requestMpesa")} onClick={() => openStkRequest()} />
                <ActionTile icon={TrendingDown} label={t("expenses.record")} onClick={() => setRecordExpenseOpen(true)} />
              </div>

              {/* KPI quad — the day's numbers; every card is a move. The
               * month-collected card owns the highlight (the landlord's
               * pattern); today lives in the briefing pill so no two
               * solid-green surfaces compete. */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <KpiButton
                  label={`${t("landlord.collectedThisMonth")}: ${formatKes(totals.monthCollectedMinor)}`}
                  onClick={() => setTab("collections")}
                >
                  <KpiCard
                    label={t("landlord.collectedThisMonth")}
                    value={formatKes(totals.monthCollectedMinor)}
                    highlight
                    progressPct={monthProgressPct}
                    delta={{ deltaPct: momDeltaPct(totals.monthCollectedMinor, totals.monthCollectedPrevMinor) }}
                    lastMonthValue={
                      totals.monthCollectedPrevMinor > 0
                        ? t("common.lastMonthCollected", {
                            amount: formatKes(totals.monthCollectedPrevMinor),
                          })
                        : t("common.noHistoryYet")
                    }
                    sub={
                      <span className="tabular-nums">
                        {t("money.expected")} {formatKes(totals.monthExpectedMinor)}
                      </span>
                    }
                  />
                </KpiButton>
                <KpiButton
                  label={`${t("landlord.arrears")}: ${formatKes(totals.arrearsMinor)}`}
                  onClick={pushArrears}
                >
                  <KpiCard
                    label={t("landlord.arrears")}
                    value={formatKes(totals.arrearsMinor)}
                    tone="amber"
                    icon={TriangleAlert}
                    sub={
                      <span className="tabular-nums">
                        {t("landlord.tenantsInArrears")}: {totals.arrearsTenantCount}
                      </span>
                    }
                  />
                </KpiButton>
                <KpiButton
                  label={`${t("repairs.openRepairs")}: ${totals.openTickets}`}
                  onClick={() => setTab("repairs")}
                >
                  <KpiCard
                    label={t("repairs.openRepairs")}
                    value={String(totals.openTickets)}
                    icon={Wrench}
                    tone={totals.openTickets > 0 ? "amber" : "default"}
                    sub={
                      <span className="flex items-center gap-1">
                        <span className="tabular-nums">{t("repairs.ticketsCount", { count: totals.openTickets })}</span>
                        <ChevronRight className="size-3.5" aria-hidden />
                      </span>
                    }
                  />
                </KpiButton>
                <KpiButton
                  label={`${t("landlord.unmatchedPayments")}: ${totals.unmatchedPayments}`}
                  onClick={() => {
                    setPaymentsFilter("UNMATCHED");
                    setTab("collections");
                  }}
                >
                  <KpiCard
                    label={t("landlord.unmatchedPayments")}
                    value={String(totals.unmatchedPayments)}
                    icon={HelpCircle}
                    tone={totals.unmatchedPayments > 0 ? "amber" : "default"}
                    sub={totals.unmatchedPayments > 0 ? t("unmatched.review") : undefined}
                  />
                </KpiButton>
              </div>
            </div>
          </section>

          {/* Security digest (Phase 3) — same card as the landlord's home. */}
          <SecurityCard security={data.security} />

          {/* Units + recent collections — side-by-side from ≥xl (the
           * reference's data-section density), stacked below. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 items-start">
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
                <Card className="divide-y gap-0 py-0">
                  {units.slice(0, 5).map((unit) => (
                    <UnitRow key={unit.id} unit={unit} />
                  ))}
                </Card>
              )}
            </section>

            <section aria-label={t("caretaker.recentCollections")}>
              <SectionHeader
                title={t("caretaker.recentCollections")}
                actionLabel={t("arrears.viewAll")}
                onAction={() => setTab("collections")}
                className="mb-3"
              />
              {recentPayments.length === 0 ? (
                <EmptyState icon={Receipt} title={t("empty.payments")} />
              ) : (
                <Card className="divide-y gap-0 py-0">
                  {recentPayments.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} />
                  ))}
                </Card>
              )}
            </section>
          </div>
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
