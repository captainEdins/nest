"use client";

/**
 * Tenant statement screen (Phase 6-a, issue #65) — the month-by-month
 * portable payment record. One GET /api/statements payload; every month
 * shows brought-forward → billed lines → the payments that landed on them
 * → carried-forward. Disputes end here.
 *
 * Phase 15 (issue #88): the timeline, summary strip and print sheet now
 * render through the SHARED statement module — the tenant's view and the
 * landlord/caretaker's reconciliation view are one component tree, so the
 * two desks can never drift apart. Tenant-only furniture stays here: the
 * exit banner (Phase 11) and the give-notice action.
 */

import { DoorOpen, Printer, ScrollText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStatement, useTenantOverview } from "@/hooks/use-overview";
import { useUIStore } from "@/lib/ui-store";
import { formatDate } from "@/components/nest/shared/format";
import {
  StatementMonthsTimeline,
  StatementSummaryStrip,
} from "@/components/nest/shared/statement-screen";
import { StatementPrintSheet } from "@/components/nest/tenant/statement-print";
import { NoticeBanner } from "@/components/nest/shared/give-notice-sheet";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { HeroSkeleton, ListSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";

export function TenantStatementScreen() {
  const { t } = useI18n();
  const { data, isPending, error, refetch } = useStatement();
  // Phase 11: the tenancy's lifecycle state rides the overview call — the
  // banner (NOTICE) and the give-notice entry (ACTIVE) hang off it.
  const { data: overview } = useTenantOverview();
  const setGiveNoticeOpen = useUIStore((s) => s.setGiveNoticeOpen);
  const onNotice = overview?.tenancy.status === "NOTICE";
  const tenancyActive = overview?.tenancy.status === "ACTIVE";

  if (error != null) {
    return (
      <section aria-label={t("statement.title")}>
        <ErrorState onRetry={() => refetch()} />
      </section>
    );
  }

  if (isPending || !data) {
    return (
      <div className="space-y-4 sm:space-y-6" aria-busy>
        <HeroSkeleton className="h-28" />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 print:space-y-0">
      {/* Phase 13 — the print sheet is the ONLY thing that prints; the
       *  interactive timeline below is screen-only. */}
      <div className="hidden print:block">
        <StatementPrintSheet data={data} />
      </div>

      <div className="space-y-4 sm:space-y-6 print:hidden">
      {/* Phase 11 — the exit banner: the notice made visible where the lease
       *  story is told. */}
      {onNotice && overview ? (
        <NoticeBanner
          tenancy={{
            id: overview.tenancy.id,
            unitLabel: overview.tenancy.unitLabel,
            moveOutDate: overview.tenancy.moveOutDate,
          }}
        />
      ) : null}

      {/* Head */}
      <div>
        <h1 className="text-h3 font-semibold">{t("statement.title")}</h1>
        <p className="text-caption text-muted-foreground mt-0.5">
          {t("statement.subtitle", { unit: data.unitLabel, property: data.propertyName })}
        </p>
        <p className="text-caption text-muted-foreground tabular-nums mt-1 flex items-center gap-2 flex-wrap">
          <span className="rounded-full border px-2 py-0.5">{data.accountRef}</span>
          {t("statement.generated", { date: formatDate(data.generatedAt) })}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {tenancyActive ? (
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              onClick={() => setGiveNoticeOpen(true)}
            >
              <DoorOpen className="size-4" aria-hidden />
              {t("notice.giveNotice")}
            </Button>
          ) : null}
          {/* Phase 13 — the portable document: print or save as PDF via the
           *  browser (low-end Android → share-to-PDF works offline). */}
          <Button
            variant="outline"
            size="sm"
            className="h-11"
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            {t("statement.print")}
          </Button>
        </div>
      </div>

      <StatementSummaryStrip data={data} />

      {/* Months — newest first, down a ruled timeline (shared with the
       *  staff reconciliation view since Phase 15). */}
      <section aria-label={t("statement.title")}>
        {data.months.length === 0 ? (
          <EmptyState icon={ScrollText} title={t("statement.emptyTitle")} hint={t("statement.emptyHint")} />
        ) : (
          <StatementMonthsTimeline months={data.months} />
        )}
      </section>
      </div>
    </div>
  );
}
