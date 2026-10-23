"use client";

/**
 * MiniTrendCard (Phase 21, D-034 — the classic home) — the compact 6-month
 * collection trend, the hero bar chart in the classic frame. Extracted from
 * landlord/home.tsx in Phase 23 (issue #109 — agent parity) so the agent's
 * desk renders the SAME chart from the shared ["analytics"] cache.
 *
 * Issue #117 — the SVG viewBox version scaled its 10px text with container
 * width (illegible at 375px, inflated at desktop) and the tallest bar sat
 * exactly on the plot ceiling. Rebuilt as a CSS/flex bar chart: real-text
 * labels at every width, bars as % heights with built-in headroom, and the
 * same a11y contract (focusable month groups with full summaries; exact
 * numbers in the honesty line so money is never guessed from bar heights).
 *
 * Issue #125 (AC-1/AC-5) — an all-zero month now prints the honest zero (a
 * small baseline dot, not two invisible slivers) and the bars carry the
 * same subtle top-lighter gradient as the analytics chart, so both
 * surfaces speak one chart language.
 */

import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { formatKes } from "@/lib/money";
import type { AnalyticsMonthDto } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

/** Tallest bar occupies this share of the plot height — visible headroom
 *  above the data, so rounded tops always render and nothing reads clipped. */
const MAX_BAR_SHARE = 0.88;

export function MiniTrendCard({ monthly }: { monthly: AnalyticsMonthDto[] }) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);

  const maxMinor = monthly.reduce((max, m) => Math.max(max, m.billedMinor, m.collectedMinor), 0);
  const barHeightPct = (valueMinor: number) =>
    maxMinor > 0
      ? Math.max(0.8, (valueMinor / maxMinor) * MAX_BAR_SHARE * 100)
      : 0.8;
  const last = monthly[monthly.length - 1]!;

  return (
    <Card className="py-0 gap-0 nest-classic">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label font-semibold truncate">{t("analytics.collectionTrend")}</p>
            <p className="text-caption text-muted-foreground">{t("analytics.last6Months")}</p>
          </div>
          <button
            type="button"
            onClick={() => setTab("analytics")}
            className="h-8 px-3 rounded-[4px] text-label font-medium text-primary underline underline-offset-4 decoration-border hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring outline-none shrink-0"
          >
            {t("landlord.viewAnalytics")}
          </button>
        </div>

        {/* Plot — CSS bars: real text labels, % heights, headroom by design. */}
        <div
          role="img"
          aria-label={`${t("analytics.collectionTrend")} — ${t("analytics.last6Months")}`}
          className="relative h-24"
        >
          {/* Quiet gridlines (decorative reference texture; exact values in
              the honesty line below). Top line = the data maximum. */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-border/70" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border/40" />
          {/* Baseline — solid. */}
          <div aria-hidden className="absolute inset-x-0 bottom-[22px] h-px bg-foreground/25" />

          {/* Month groups — flex row; each group is focusable with the full
              summary (same contract as the analytics chart). */}
          <div className="absolute inset-0 flex items-stretch justify-around gap-1">
            {monthly.map((month) => {
              const summary = t("analytics.monthSummary", {
                month: month.label,
                billed: formatKes(month.billedMinor),
                collected: formatKes(month.collectedMinor),
                expenses: formatKes(month.expensesMinor),
                net: formatKes(month.netMinor),
              });
              // #125 AC-1: an empty month prints the honest zero — a small
              // dot on the baseline — instead of two invisible 1px slivers.
              const isEmptyMonth = month.billedMinor === 0 && month.collectedMinor === 0;
              return (
                <div
                  key={month.monthKey}
                  tabIndex={0}
                  role="img"
                  aria-label={summary}
                  title={summary}
                  className="group relative flex-1 min-w-0 flex flex-col justify-end focus-visible:outline-2 focus-visible:outline-ring rounded-sm focus-visible:-outline-offset-2 transition-colors"
                >
                  {/* Bars sit on the baseline; the label strip lives below it. */}
                  <div className="relative flex items-end justify-center gap-[3px] h-[calc(100%-22px)]">
                    {isEmptyMonth ? (
                      <span
                        aria-hidden
                        className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 size-[5px] rounded-full bg-muted-foreground/50"
                      />
                    ) : (
                      <>
                        <div
                          aria-hidden
                          className="w-[min(46%,13px)] rounded-t-[3px] bg-gradient-to-t from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 transition-colors group-hover:from-primary/20 group-hover:to-primary/30 dark:group-hover:from-primary/30 dark:group-hover:to-primary/40"
                          style={{ height: `${barHeightPct(month.billedMinor)}%` }}
                        />
                        <div
                          aria-hidden
                          className="w-[min(46%,13px)] rounded-t-[3px] bg-gradient-to-t from-primary/85 to-primary transition-colors group-hover:from-primary/95 group-hover:to-primary"
                          style={{ height: `${barHeightPct(month.collectedMinor)}%` }}
                        />
                      </>
                    )}
                  </div>
                  <p className="h-[22px] flex items-center justify-center text-[10px] leading-none text-muted-foreground tabular-nums">
                    <span className="truncate px-0.5">{month.label}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest month, exact — the honesty line under the whisper. */}
        <p className="text-caption text-muted-foreground tabular-nums">
          {last.label}: {t("analytics.billed")} {formatKes(last.billedMinor)} ·{" "}
          {t("analytics.collected")}{" "}
          <span className="font-medium text-foreground">{formatKes(last.collectedMinor)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
