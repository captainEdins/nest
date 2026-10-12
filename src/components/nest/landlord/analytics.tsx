"use client";

/**
 * S-36 · Landlord analytics (Phase 5 wedge A, issue #57 — More tab). Three
 * dependency-light charts, hand-written inline SVG/divs (no chart library —
 * this must run on low-end Android), driven by ONE call:
 * GET /api/analytics → LandlordAnalyticsDto.
 *
 * - Collection trend: grouped bars, billed (muted/outlined) vs collected
 *   (primary), last 6 months. Month groups are keyboard-focusable with a
 *   <title> tooltip; exact values sit in the table below (screen-reader
 *   caption included) — money is never guessable from bar heights alone.
 * - Arrears aging: four horizontal rows (current / 1–30d / 31–60d / 61+d)
 *   on the semantic ladder primary → warning → attention → destructive.
 * - Occupancy: one donut per property (stroke-dasharray technique), center
 *   shows occupied/total + percentage.
 *
 * All colors are CSS variables (dark-mode safe); every money value is an
 * integer in KES minor units formatted via src/lib/money.ts.
 */

import * as React from "react";
import { Building2, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { formatKes, formatKesCompact } from "@/lib/money";
import type { AnalyticsMonthDto, ArrearsAgingDto, OccupancyRowDto } from "@/lib/types";
import { useLandlordAnalytics } from "@/hooks/use-overview";
import { formatDate } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function LandlordAnalyticsScreen() {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const { data, isPending, error, refetch } = useLandlordAnalytics();

  if (error != null) {
    return (
      <section aria-label={t("analytics.title")}>
        <h1 className="text-h2 font-semibold mb-4">{t("analytics.title")}</h1>
        <ErrorState onRetry={() => refetch()} message={t("errors.couldNotLoad")} />
      </section>
    );
  }

  const hasPortfolio = (data?.occupancy.length ?? 0) > 0;

  return (
    <section aria-label={t("analytics.title")} className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("analytics.title")}</h1>
        {data ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {t("analytics.generated", { date: formatDate(data.generatedAt) })}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <AnalyticsSkeleton />
      ) : !data || !hasPortfolio ? (
        <EmptyState icon={Building2} title={t("analytics.emptyTitle")} hint={t("analytics.emptyHint")} />
      ) : (
        <>
          {/* Phase 12 — the P&L hero: the CURRENT month's net (collected −
              expenses). The number the whole trend builds toward. */}
          {data.monthly.length > 0 ? (
            <Card
              className={cn(
                "border-transparent transition-shadow",
                data.monthly[data.monthly.length - 1]!.netMinor >= 0
                  ? "bg-success/10 border-success/20"
                  : "bg-attention/10 border-attention/20",
              )}
            >
              <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                <span
                  aria-hidden
                  className={cn(
                    "size-10 shrink-0 rounded-full grid place-items-center",
                    data.monthly[data.monthly.length - 1]!.netMinor >= 0
                      ? "bg-success/15 text-success"
                      : "bg-attention/15 text-attention",
                  )}
                >
                  <TrendingDown className="size-5 rotate-180" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] leading-5 text-muted-foreground">
                    {t("analytics.netCard")}
                  </p>
                  <p
                    className={cn(
                      "text-kpi font-bold tabular-nums",
                      data.monthly[data.monthly.length - 1]!.netMinor >= 0
                        ? "text-success"
                        : "text-attention",
                    )}
                  >
                    {formatKes(data.monthly[data.monthly.length - 1]!.netMinor)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("expenses")}
                  className="h-9 px-3 rounded-lg text-label font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring outline-none shrink-0"
                >
                  {t("expenses.title")}
                </button>
              </CardContent>
            </Card>
          ) : null}

          {/* Chart 1 — collection trend (full width; the 6-group geometry
              needs every pixel it can get at 375px). */}
          <section aria-label={t("analytics.collectionTrend")}>
            <SectionHeader title={t("analytics.collectionTrend")} className="mb-3" />
            <CollectionTrendChart monthly={data.monthly} />
          </section>

          {/* Charts 2 + 3 — side by side from ≥sm. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
            <section aria-label={t("analytics.arrearsAging")}>
              <SectionHeader title={t("analytics.arrearsAging")} className="mb-3" />
              <ArrearsAgingChart aging={data.arrearsAging} />
            </section>
            <section aria-label={t("analytics.occupancy")}>
              <SectionHeader title={t("analytics.occupancy")} className="mb-3" />
              <OccupancyChart occupancy={data.occupancy} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chart 1 — collection trend (grouped bars, hand-written SVG)
// ---------------------------------------------------------------------------

/** viewBox geometry — scales to any width; renders ~1:1 at 375px. */
const TREND_W = 340;
const TREND_H = 224;
const PLOT_LEFT = 64;
const PLOT_RIGHT = 332;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 192;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
// Phase 12: three bars per group (billed, collected, money out).
// Phase 17 (D-030): wider reference-style bars — 12px bars in 3px gutters
// fill ~94% of each month's category width (the reference's chunky look).
const BAR_W = 12;
const BAR_GAP = 3;
const BAR_GROUP_W = BAR_W * 3 + BAR_GAP * 2;
const MONTH_LABEL_Y = 210;

/**
 * Axis maximum rounded up so the top + mid gridline labels stay round
 * (integer math only — money never becomes a float). 37k of data → a 38k
 * axis with a 19k midline; a 2px bar keeps its shape when the value is 0.
 */
function niceAxisMaxMinor(maxMinor: number): number {
  if (maxMinor <= 0) return 0;
  const wholeShillings = Math.ceil(maxMinor / 100);
  const digits = wholeShillings.toString().length;
  const unitSh = wholeShillings < 100 ? 25 : 10 ** Math.max(0, digits - 2);
  const steps = Math.ceil(wholeShillings / (2 * unitSh));
  return steps * 2 * unitSh * 100;
}

/** Bar path with rounded TOP only, so the base sits flat on the baseline. */
function topRoundedBarPath(x: number, top: number, width: number, bottom: number): string {
  // D-022: radius 4 — Monty's soft bar geometry (was 3).
  const radius = Math.min(4, bottom - top, width / 2);
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `L ${x + width - radius} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + radius}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

function LegendSwatch({ className }: { className: string }) {
  return <span className={cn("inline-block size-2 rounded-full shrink-0", className)} aria-hidden />;
}

/** Legend pill chip (D-030) — the reference's bordered pill toggles: 1px
 *  hairline, fully rounded, dot + label. Presentational (colors are the
 *  swatches' job). */
function LegendChip({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 h-6 text-caption font-medium text-muted-foreground shrink-0">
      <LegendSwatch className={swatch} />
      {children}
    </span>
  );
}

function CollectionTrendChart({ monthly }: { monthly: AnalyticsMonthDto[] }) {
  const { t } = useI18n();

  const maxMinor = monthly.reduce(
    (max, m) => Math.max(max, m.billedMinor, m.collectedMinor, m.expensesMinor),
    0,
  );
  const axisMaxMinor = niceAxisMaxMinor(maxMinor);
  const groupWidth = monthly.length > 0 ? PLOT_WIDTH / monthly.length : PLOT_WIDTH;

  /** Bar height in viewBox units — always ≥ 2 so zero keeps its shape. */
  const barHeight = (valueMinor: number) =>
    axisMaxMinor > 0 ? Math.max(2, Math.round((valueMinor / axisMaxMinor) * PLOT_HEIGHT)) : 2;
  const gridY = (valueMinor: number) =>
    axisMaxMinor > 0 ? PLOT_BOTTOM - Math.round((valueMinor / axisMaxMinor) * PLOT_HEIGHT) : PLOT_BOTTOM;

  // 2–3 gridline ticks: 0, half, max (skipping duplicates on an all-zero chart).
  const ticks = axisMaxMinor > 0 ? [0, Math.round(axisMaxMinor / 2), axisMaxMinor] : [0];

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-caption text-muted-foreground">{t("analytics.last6Months")}</p>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LegendChip swatch="border border-border bg-muted">
              {t("analytics.billed")}
            </LegendChip>
            <LegendChip swatch="bg-primary">
              {t("analytics.collected")}
            </LegendChip>
            <LegendChip swatch="bg-attention">
              {t("analytics.moneyOut")}
            </LegendChip>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${TREND_W} ${TREND_H}`}
          className="w-full h-auto"
          role="group"
          aria-label={t("analytics.collectionTrend")}
        >
          {/* Gridlines + tick labels (decorative — exact values live in the
              table). D-022: non-baseline gridlines dashed + lighter — Monty's
              quiet grid. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={gridY(tick)}
                y2={gridY(tick)}
                className={tick === 0 ? "stroke-foreground/25" : "stroke-border"}
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text
                x={PLOT_LEFT - 8}
                y={gridY(tick) + 3}
                textAnchor="end"
                fontSize={10}
                className="fill-muted-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatKesCompact(tick)}
              </text>
            </g>
          ))}

          {/* Month groups — focusable, with a native <title> tooltip. */}
          {monthly.map((month, index) => {
            const groupX = PLOT_LEFT + index * groupWidth;
            const group0X = groupX + (groupWidth - BAR_GROUP_W) / 2;
            const billedH = barHeight(month.billedMinor);
            const collectedH = barHeight(month.collectedMinor);
            const expensesH = barHeight(month.expensesMinor);
            const summary = t("analytics.monthSummary", {
              month: month.label,
              billed: formatKes(month.billedMinor),
              collected: formatKes(month.collectedMinor),
              expenses: formatKes(month.expensesMinor),
              net: formatKes(month.netMinor),
            });
            return (
              <g
                key={month.monthKey}
                tabIndex={0}
                role="img"
                aria-label={summary}
                className="outline-none focus-visible:[outline:2px_solid_var(--ring)]"
              >
                <title>{summary}</title>
                <path
                  d={topRoundedBarPath(group0X, PLOT_BOTTOM - billedH, BAR_W, PLOT_BOTTOM)}
                  className="fill-muted"
                />
                <path
                  d={topRoundedBarPath(
                    group0X + BAR_W + BAR_GAP,
                    PLOT_BOTTOM - collectedH,
                    BAR_W,
                    PLOT_BOTTOM,
                  )}
                  className="fill-primary"
                />
                <path
                  d={topRoundedBarPath(
                    group0X + (BAR_W + BAR_GAP) * 2,
                    PLOT_BOTTOM - expensesH,
                    BAR_W,
                    PLOT_BOTTOM,
                  )}
                  className="fill-attention"
                />
                <text
                  x={groupX + groupWidth / 2}
                  y={MONTH_LABEL_Y}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Exact values — visible (low-end phones have no hover) and the
            screen-reader fallback, with an sr-only caption. */}
        <table className="w-full">
          <caption className="sr-only">{t("analytics.monthCollected")}</caption>
          <thead>
            <tr className="text-caption text-muted-foreground border-b border-border">
              <th scope="col" className="text-left font-medium py-1.5">
                {t("analytics.monthHeader")}
              </th>
              <th scope="col" className="text-right font-medium py-1.5">
                {t("analytics.billed")}
              </th>
              <th scope="col" className="text-right font-medium py-1.5">
                {t("analytics.collected")}
              </th>
              <th scope="col" className="text-right font-medium py-1.5">
                {t("analytics.moneyOut")}
              </th>
              <th scope="col" className="text-right font-medium py-1.5">
                {t("analytics.net")}
              </th>
            </tr>
          </thead>
          <tbody className="text-caption tabular-nums">
            {monthly.map((month) => (
              <tr key={month.monthKey} className="border-b border-border last:border-b-0">
                <th scope="row" className="text-left font-normal text-muted-foreground py-1.5">
                  {month.label}
                </th>
                <td className="text-right text-muted-foreground py-1.5">
                  {formatKes(month.billedMinor)}
                </td>
                <td className="text-right font-medium py-1.5">
                  {formatKes(month.collectedMinor)}
                </td>
                <td className="text-right text-attention py-1.5">
                  {formatKes(month.expensesMinor)}
                </td>
                <td
                  className={cn(
                    "text-right font-semibold py-1.5",
                    month.netMinor >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {formatKes(month.netMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart 2 — arrears aging (four horizontal bars on the semantic ladder)
// ---------------------------------------------------------------------------

const AGING_ROWS = [
  { labelKey: "analytics.current", bucket: "current", barClass: "bg-primary" },
  { labelKey: "analytics.days1to30", bucket: "d1_30", barClass: "bg-warning/60" },
  { labelKey: "analytics.days31to60", bucket: "d31_60", barClass: "bg-attention" },
  { labelKey: "analytics.days61plus", bucket: "d61plus", barClass: "bg-destructive" },
] as const;

function ArrearsAgingChart({ aging }: { aging: ArrearsAgingDto }) {
  const { t } = useI18n();
  const maxTotal = Math.max(
    aging.current.totalMinor,
    aging.d1_30.totalMinor,
    aging.d31_60.totalMinor,
    aging.d61plus.totalMinor,
  );

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {AGING_ROWS.map(({ labelKey, bucket, barClass }) => {
          const row = aging[bucket];
          const widthPct = maxTotal > 0 ? Math.round((row.totalMinor / maxTotal) * 100) : 0;
          return (
            <div key={bucket} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-label font-medium">{t(labelKey)}</p>
                <p className="text-caption text-muted-foreground tabular-nums text-right">
                  {t("analytics.tenants", { count: row.count })} · {formatKes(row.totalMinor)}
                </p>
              </div>
              {/* Track is decorative — the row text carries the values. */}
              <div className="h-2.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full min-w-[2px] transition-all duration-300", barClass)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-caption text-muted-foreground">{t("analytics.agingHint")}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart 3 — occupancy donuts (stroke-dasharray technique)
// ---------------------------------------------------------------------------

function OccupancyChart({ occupancy }: { occupancy: OccupancyRowDto[] }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className={cn("grid gap-4 sm:gap-6", occupancy.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {occupancy.map((property) => (
            <OccupancyDonutItem key={property.propertyId} property={property} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OccupancyDonutItem({ property }: { property: OccupancyRowDto }) {
  const { t } = useI18n();
  const total = property.occupied + property.vacant; // NOTICE counts as occupied
  const occupancyPct = total > 0 ? Math.round((property.occupied / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center text-center gap-2 min-w-0">
      <OccupancyDonut occupied={property.occupied} total={total} pct={occupancyPct} />
      <div className="min-w-0">
        <p className="text-body font-semibold truncate">{property.propertyName}</p>
        <p className="text-caption text-muted-foreground tabular-nums mt-0.5">
          <span className="font-medium">{property.occupied}</span> {t("analytics.occupied")}
          <span aria-hidden> · </span>
          <span>{property.vacant}</span> {t("analytics.vacant")}
        </p>
      </div>
    </div>
  );
}

function OccupancyDonut({ occupied, total, pct }: { occupied: number; total: number; pct: number }) {
  const { t } = useI18n();
  const size = 116;
  const center = size / 2;
  const radius = 45;
  // Phase 17 (D-030): the reference's thick ring — stroke 18 (was 12) with a
  // visible GAP before the track's end and round caps, the "friendly data"
  // signature. Geometry stays dasharray math (no library, no floats in the
  // DATA — display fractions are fine).
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? occupied / total : 0; // display geometry, not money
  const gap = 6; // arc length held back so the segment never touches itself
  const dash = Math.max(0, Math.min(circumference - gap, fraction * circumference));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${t("analytics.occupancy")}: ${t("common.ofUnits", { occupied, total })} (${pct}%)`}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted"
      />
      {occupied > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-primary"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap={fraction < 1 ? "round" : "butt"}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
      <text
        x={center}
        y={center - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={22}
        fontWeight={700}
        className="fill-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {occupied}/{total}
      </text>
      <text
        x={center}
        y={center + 18}
        textAnchor="middle"
        fontSize={11}
        className="fill-muted-foreground"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — chart-shaped placeholders, never full-page spinners
// ---------------------------------------------------------------------------

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true">
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-end gap-2 h-40" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 h-full flex items-end gap-1">
                <Skeleton className="flex-1" style={{ height: `${28 + ((i * 37) % 62)}%` }} />
                <Skeleton className="flex-1" style={{ height: `${18 + ((i * 53) % 58)}%` }} />
              </div>
            ))}
          </div>
          <Skeleton className="h-3.5 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4" aria-hidden="true">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent
            className="p-4 sm:p-6 flex flex-col items-center gap-3"
            aria-hidden="true"
          >
            <Skeleton className="size-28 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
