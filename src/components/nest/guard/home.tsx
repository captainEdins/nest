"use client";

/**
 * S-13 · Guard home — the on-duty command center (Phase 3, issue #36).
 *
 * One call (GuardOverviewDto): on-duty/off-duty state card (ACTIVE shift is
 * the guard's write anchor), two big quick actions (log visitor / report
 * incident — still openable off duty, the sheets explain), today's gate
 * stats (visitors / on-site / unseen incidents — never money), and the last
 * visitors through the gate. Everything else lives in the tabs.
 */

import * as React from "react";
import {
  BookOpen,
  Building2,
  Clock,
  History,
  LogOut,
  Play,
  ShieldAlert,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { greetingKeyForHour, useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useSession, useGuardOverview } from "@/hooks/use-overview";
import { useDurationTicker } from "@/hooks/use-guard";
import { formatTime, timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { AvatarInitials } from "@/components/nest/shared/avatar-initials";
import { OnSiteBadge, PurposeChip } from "@/components/nest/shared/security/visitor-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function GuardHome() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useGuardOverview();
  const setTab = useUIStore((s) => s.setTab);
  const pushShiftLog = useUIStore((s) => s.pushShiftLog);
  const setLogVisitorOpen = useUIStore((s) => s.setLogVisitorOpen);
  const setReportIncidentOpen = useUIStore((s) => s.setReportIncidentOpen);
  const setStartShiftOpen = useUIStore((s) => s.setStartShiftOpen);
  const setEndShiftOpen = useUIStore((s) => s.setEndShiftOpen);

  const activeShift = data?.activeShift ?? null;
  const duration = useDurationTicker(activeShift?.startedAt);
  const name = session?.profile.fullName.split(" ")[0] ?? "";

  return (
    <div className="space-y-4 sm:space-y-6 nest-stagger">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2 font-semibold tracking-tight truncate">{t(greetingKeyForHour(), { name })}</h1>
        {data?.property ? (
          <Badge variant="secondary" className="text-caption shrink-0 max-w-44 gap-1">
            <Building2 className="size-3" aria-hidden />
            <span className="truncate">{data.property.name}</span>
          </Badge>
        ) : null}
      </div>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending || data == null ? (
        <GuardHomeSkeleton />
      ) : (
        <>
          {/* On / off duty — the shift is the write anchor for every guard action.
              Phase 18 (D-031): tinted surface (no left accent bar — the v2
              canvas separates by shadow/tint, not rails). */}
          {activeShift ? (
            <Card className="py-0 gap-0 bg-success/5 dark:bg-success/10 animate-in fade-in duration-300">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="border-transparent bg-success text-success-foreground gap-1.5">
                    <span aria-hidden className="size-1.5 rounded-full bg-current animate-pulse" />
                    {t("guard.onDuty")}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 sm:h-9 text-label"
                    onClick={pushShiftLog}
                  >
                    <History aria-hidden />
                    {t("guard.shiftLog")}
                  </Button>
                </div>
                <p className="text-body text-muted-foreground">
                  {t("guard.onDutyAt", {
                    property: activeShift.propertyName,
                    time: formatTime(activeShift.startedAt),
                  })}
                </p>
                <div>
                  <p className="text-label font-medium text-muted-foreground">
                    {t("guard.durationLabel")}
                  </p>
                  <p className="text-kpi font-bold tabular-nums">{duration ?? "—"}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => setEndShiftOpen(true)}
                >
                  <LogOut aria-hidden />
                  {t("guard.endShift")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-0 gap-0 bg-muted/30 dark:bg-muted/20 animate-in fade-in duration-300">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-5" aria-hidden />
                  <p className="text-body-lg font-semibold">{t("guard.offDuty")}</p>
                </div>
                <p className="text-caption text-muted-foreground">{t("guard.startShiftDesc")}</p>
                <Button className="w-full h-11" onClick={() => setStartShiftOpen(true)}>
                  <Play aria-hidden />
                  {t("guard.startShift")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick actions — ≤3 taps from cold to a logged visitor.
              Phase 18 (D-031): the report-incident tile wears the amber
              surface so the emergency action reads as one (outline read
              as disabled in the audit); never red — urgency via tint. */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setLogVisitorOpen(true)}
              className="group rounded-xl h-auto min-h-20 py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-body font-semibold bg-primary text-primary-foreground nest-card-shadow outline-none transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span aria-hidden className="size-9 rounded-lg grid place-items-center bg-primary-foreground/15">
                <UserPlus className="size-[18px]" />
              </span>
              {t("guard.visitors.logVisitor")}
              {activeShift == null ? (
                <span className="text-caption font-normal opacity-75">
                  {t("guard.visitors.offDutyHint")}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setReportIncidentOpen(true)}
              aria-label={t("guard.incidents.report")}
              className="group rounded-xl h-auto min-h-20 py-3 px-2 flex flex-col items-center justify-center gap-1.5 text-body font-semibold bg-warning/15 dark:bg-warning/10 text-attention nest-card-shadow outline-none transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span aria-hidden className="size-9 rounded-lg grid place-items-center bg-warning/20 dark:bg-warning/20">
                <ShieldAlert className="size-[18px]" />
              </span>
              {t("guard.incidents.report")}
              {activeShift == null ? (
                <span className="text-caption font-normal opacity-70">
                  {t("guard.incidents.offDutyHint")}
                </span>
              ) : null}
            </button>
          </div>

          {/* Today at the gate — counts only, never money (matrix §6) */}
          <Card>
            <CardContent className="grid grid-cols-3 divide-x p-0">
              <StatCell
                icon={Users}
                label={t("guard.visitors.todayCount", { count: data.totals.visitorsToday })}
              />
              <StatCell
                icon={BookOpen}
                label={t("guard.visitors.onSiteCount", { count: data.totals.onSiteNow })}
              />
              <StatCell
                icon={TriangleAlert}
                label={t("guard.incidents.unackedCount", {
                  count: data.totals.unacknowledgedIncidents,
                })}
                tone={data.totals.unacknowledgedIncidents > 0 ? "amber" : "default"}
              />
            </CardContent>
          </Card>

          {/* Recent visitors — the last faces through the gate */}
          <section aria-label={t("guard.visitors.recent")}>
            <SectionHeader
              title={t("guard.visitors.recent")}
              actionLabel={t("common.viewAll")}
              onAction={() => setTab("visitors")}
              className="mb-3"
            />
            {data.recentVisitors.length === 0 ? (
              <EmptyState icon={BookOpen} title={t("guard.visitors.emptyHistory")} />
            ) : (
              <Card className="divide-y gap-0 py-0">
                {data.recentVisitors.slice(0, 3).map((visitor) => (
                  <RecentVisitorRow key={visitor.id} visitor={visitor} />
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Compact stat cell — icon + "{count} today"-style shipped label. */
function StatCell({
  icon: Icon,
  label,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "amber";
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 sm:p-4 text-center min-h-16 justify-center">
      <Icon
        className={tone === "amber" ? "size-4 text-attention" : "size-4 text-muted-foreground"}
        aria-hidden
      />
      <span
        className={`text-label font-semibold tabular-nums ${
          tone === "amber" ? "text-attention" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function RecentVisitorRow({
  visitor,
}: {
  visitor: NonNullable<ReturnType<typeof useGuardOverview>["data"]>["recentVisitors"][number];
}) {
  const { t } = useI18n();
  const meta: string[] = [];
  meta.push(timeAgo(visitor.enteredAt, t));
  if (visitor.unitLabel) meta.push(visitor.unitLabel);

  return (
    <div className="flex items-center gap-3 p-3.5 sm:p-4 min-h-16">
      <AvatarInitials fullName={visitor.visitorName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold truncate">{visitor.visitorName}</p>
        <p className="text-caption text-muted-foreground truncate">{meta.join(" · ")}</p>
        <div className="mt-1">
          <PurposeChip purpose={visitor.purpose} />
        </div>
      </div>
      {visitor.exitedAt == null ? <OnSiteBadge /> : null}
    </div>
  );
}

function GuardHomeSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy>
      <HeroSkeleton className="h-44" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Card className="py-0 gap-0">
        <CardContent className="grid grid-cols-3 divide-x p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-4">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
      <ListSkeleton rows={3} />
    </div>
  );
}
