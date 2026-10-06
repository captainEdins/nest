"use client";

/**
 * S-40 · Landlord Tax assistant (Phase 5 wedge B, issue #59 — More tab).
 *
 * Record-keeping assistance for Kenya's Monthly Rental Income (MRI) regime:
 * the calendar-year monthly rent summary (billed vs collected, Jan–Dec,
 * zeros included — CSV parity), a 7.5% MRI estimate on collected rent and
 * a CSV export for the landlord's own records. NEVER tax advice — the
 * amber disclaimer banner is the FIRST element under the screen header and
 * stays visible without scrolling (legally important).
 *
 * Data: GET /api/kra/summary?year=YYYY → KraSummaryDto (one call per year,
 * year in the query key). The CSV download is a plain same-origin anchor
 * to /api/kra/export — the cookie session carries the auth, no fetch or
 * token needed. Money is integer KES minor units formatted via
 * src/lib/money.ts; this is a compliance view, so values are ALWAYS the
 * full formatKes form (exact numbers matter), never the compact one.
 */

import * as React from "react";
import { CalendarClock, Download, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatKes } from "@/lib/money";
import { useKraSummary } from "@/hooks/use-overview";
import { formatDate } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function LandlordKraScreen() {
  const { t } = useI18n();
  // Default = the current year; the selector offers it + the previous one.
  const [year, setYear] = React.useState(() => new Date().getFullYear());
  const { data, isPending, error, refetch } = useKraSummary(year);
  const years = React.useMemo(() => {
    const thisYear = new Date().getFullYear();
    return [thisYear - 1, thisYear];
  }, []);

  // "No data for this year" = nothing billed AND nothing collected — the
  // 12-row table with zeros is only meaningful once the year has records.
  const isEmpty =
    data != null && data.totals.billedMinor === 0 && data.totals.collectedMinor === 0;

  return (
    <section aria-label={t("kra.title")} className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("kra.title")}</h1>
        {data ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {t("kra.generated", { date: formatDate(data.generatedAt) })}
          </span>
        ) : null}
      </div>

      {/* Disclaimer — legally required, FIRST element under the header and
          visible without scrolling. Record-keeping assistance only. */}
      <div
        role="note"
        aria-label={t("kra.disclaimer")}
        className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 p-4"
      >
        <TriangleAlert className="size-5 text-warning shrink-0 mt-0.5" aria-hidden />
        <p className="text-caption text-warning-foreground font-medium min-w-0">
          {t("kra.disclaimer")}
        </p>
      </div>

      {/* Year switch + CSV export (the export stays available even for a
          record-less year — a nil-year CSV is a legitimate filing aid). */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          role="radiogroup"
          aria-label={t("kra.year")}
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-56"
        >
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={y === year}
              onClick={() => setYear(y)}
              className={cn(
                "h-11 rounded-md text-label font-medium tabular-nums flex items-center justify-center",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
                y === year
                  ? "bg-card text-primary font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {y}
            </button>
          ))}
        </div>
        {/* Same-origin anchor: the session cookie authorizes the download;
            the route answers JSON errors (401/403/400) as any API would. */}
        <Button asChild className="h-11 sm:h-10 sm:ml-auto">
          <a href={`/api/kra/export?year=${year}`} download>
            <Download aria-hidden />
            {t("kra.downloadCsv")}
          </a>
        </Button>
      </div>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("errors.couldNotLoad")} />
      ) : isPending ? (
        <KraSkeleton />
      ) : !data || isEmpty ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={t("kra.emptyTitle", { year })}
          hint={t("kra.emptyHint")}
        />
      ) : (
        <>
          {/* Month table — 12 rows + totals, all months shown (zeros included,
              CSV parity). Horizontal scroll wrapper as a safety net. */}
          <section aria-label={t("kra.monthlyTitle")}>
            <SectionHeader title={t("kra.monthlyTitle")} className="mb-3" />
            <Card>
              <CardContent className="p-4 sm:p-6 overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">
                    {t("kra.tableCaption", { year })}
                  </caption>
                  <thead>
                    <tr className="text-caption text-muted-foreground border-b border-border">
                      <th scope="col" className="text-left font-medium py-2 pr-4">
                        {t("kra.month")}
                      </th>
                      <th scope="col" className="text-right font-medium py-2 pl-4">
                        {t("kra.billed")}
                      </th>
                      <th scope="col" className="text-right font-medium py-2 pl-4">
                        {t("kra.collected")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-label tabular-nums">
                    {data.months.map((row) => (
                      <tr key={row.month} className="border-b border-border last:border-b-0">
                        <th
                          scope="row"
                          className="text-left font-normal text-muted-foreground py-2 pr-4"
                        >
                          {row.label}
                        </th>
                        <td className="text-right text-muted-foreground py-2 pl-4">
                          {formatKes(row.billedMinor)}
                        </td>
                        <td className="text-right font-medium py-2 pl-4">
                          {formatKes(row.collectedMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border text-label font-semibold">
                      <th scope="row" className="text-left py-2.5 pr-4">
                        {t("kra.total")}
                      </th>
                      <td className="text-right py-2.5 pl-4">
                        {formatKes(data.totals.billedMinor)}
                      </td>
                      <td className="text-right py-2.5 pl-4">
                        {formatKes(data.totals.collectedMinor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </section>

          {/* MRI estimate — the headline number of the regime. */}
          <section aria-label={t("kra.mriEstimate")}>
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-2">
                <p className="text-label font-medium text-muted-foreground">
                  {t("kra.mriEstimate")}
                </p>
                <p className="text-kpi font-semibold tabular-nums">
                  {formatKes(data.mriEstimateMinor)}
                </p>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {t("kra.mriBasis", { collected: formatKes(data.totals.collectedMinor) })}
                </p>
                <p className="pt-2 border-t border-border text-caption text-muted-foreground flex items-center gap-2">
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  <span>{t("kra.filingHint")}</span>
                </p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — table-shaped placeholder (12 rows + totals + estimate
// card), never a full-page spinner
// ---------------------------------------------------------------------------

function KraSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true">
      <Card>
        <CardContent className="p-4 sm:p-6 overflow-x-auto" aria-hidden="true">
          <Skeleton className="h-3.5 w-40 mb-3" />
          <Skeleton className="h-3 w-full mb-2" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <Skeleton className="h-3.5 w-10" />
              <div className="flex items-center gap-6">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))}
          <Skeleton className="h-4 w-full mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-2.5" aria-hidden="true">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-56" />
        </CardContent>
      </Card>
    </div>
  );
}
