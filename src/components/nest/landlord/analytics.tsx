"use client";

/**
 * S-36 · Landlord analytics (Phase 5 wedge A, issue #57 — More tab). Three
 * dependency-light charts, hand-written inline SVG/divs (no chart library —
 * this must run on low-end Android), driven by ONE call:
 * GET /api/analytics → LandlordAnalyticsDto.
 *
 * - Collection trend: grouped bars, billed (primary tint) vs collected
 *   (primary) vs money-out (attention), last 6 months — CSS/flex bars with
 *   real-text labels (#117). Month groups are keyboard-focusable with a
 *   title tooltip; exact values sit in the table below (screen-reader
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
                "py-0 gap-0 border-transparent transition-shadow",
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
// Chart 1 — collection trend (grouped bars, CSS/flex — issue #117)
// ---------------------------------------------------------------------------

/** #117: CSS/flex bar chart — no viewBox, no fixed-px text. Tallest bar
 *  occupies ≤ MAX_BAR_SHARE of the bar zone so rounded tops always render. */
const MAX_BAR_SHARE = 0.92;
/** Axis headroom: the data max is inflated before nice-rounding — the old
 *  defect was axisMax == dataMax (84k → 84k), pinning the tallest bar to the
 *  plot ceiling, which read as clipped. */
const AXIS_HEADROOM = 1.18;

/**
 * Axis maximum rounded up so the top + mid gridline labels stay round
 * (integer math only — money never becomes a float). The data max is
 * inflated by AXIS_HEADROOM first (#117). 84k of data → a 100k axis with a
 * 50k midline; a 2px-min bar keeps its shape when the value is 0.
 */
function niceAxisMaxMinor(maxMinor: number): number {
  if (maxMinor <= 0) return 0;
  const withHeadroom = Math.ceil(maxMinor * AXIS_HEADROOM);
  const wholeShillings = Math.ceil(withHeadroom / 100);
  const digits = wholeShillings.toString().length;
  const unitSh = wholeShillings < 100 ? 25 : 10 ** Math.max(0, digits - 2);
  const steps = Math.ceil(wholeShillings / (2 * unitSh));
  return steps * 2 * unitSh * 100;
}

function LegendSwatch({ className }: { className: string }) {
  return <span className={cn("inline-block size-2.5 rounded-[4px] shrink-0", className)} aria-hidden />;
}

/** #125 AC-1: the honest zero. A month with no bars draws a small dot on
 *  the baseline — an intentional mark, not a 1px sliver that reads as a
 *  rendering error. Muted ink, rounded, centered where the group sits. */
function ZeroBaselineDot() {
  return (
    <span
      aria-hidden
      className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 size-[5px] rounded-full bg-muted-foreground/50"
    />
  );
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

  // #125 AC-3: the active month (hover or keyboard focus) feeds ONE shared
  // tooltip chip anchored to the plot's top-center — it can never clip past
  // the card edges the way a per-group chip would on a 390px screen.
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  const maxMinor = monthly.reduce(
    (max, m) => Math.max(max, m.billedMinor, m.collectedMinor, m.expensesMinor),
    0,
  );
  const axisMaxMinor = niceAxisMaxMinor(maxMinor);

  /** Bar height as a % of the bar zone — ≥ 0.6% so zero keeps its sliver. */
  const barHeightPct = (valueMinor: number) =>
    axisMaxMinor > 0 ? Math.max(0.6, (valueMinor / axisMaxMinor) * MAX_BAR_SHARE * 100) : 0.6;

  /** Gridline/tick position as a % up the bar zone (0 = baseline). */
  const tickPct = (valueMinor: number) =>
    axisMaxMinor > 0 ? Math.min(100, (valueMinor / axisMaxMinor) * 100) : 0;

  // 2–3 gridline ticks: 0, half, max (skipping duplicates on an all-zero chart).
  const ticks = axisMaxMinor > 0 ? [0, Math.round(axisMaxMinor / 2), axisMaxMinor] : [0];

  return (
    <Card className="py-0 gap-0">
      <CardContent className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 gap-y-2 flex-wrap">
          <p className="text-caption text-muted-foreground">{t("analytics.last6Months")}</p>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <LegendChip swatch="border border-border bg-primary/15 dark:bg-primary/25">
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

        {/* Plot — CSS/flex bars (#117): real-text labels at every width, bars
            as % heights, headroom by construction (the tallest bar tops out
            well below the top gridline). Anatomy: a y-axis gutter whose tick
            labels hug their gridlines + the bar zone on a solid baseline. */}
        <div className="flex gap-2 sm:gap-3">
          {/* Y-axis gutter — ticks anchored to their lines, right-aligned. */}
          <div aria-hidden className="relative w-11 sm:w-12 shrink-0 h-40 sm:h-44">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 text-[10px] leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ bottom: `${tickPct(tick)}%` }}
              >
                {formatKesCompact(tick)}
              </span>
            ))}
          </div>

          {/* Bar zone — gridlines behind, month groups on top. */}
          <div className="relative flex-1 h-40 sm:h-44">
            {/* #125 AC-3: the shared exact-values chip. Whitespace-normal so a
                long summary wraps to two lines instead of overflowing; the
                top gridline zone is design headroom, so the overlay never
                hides a bar. */}
            {activeIdx != null && monthly[activeIdx] ? (
              <span
                role="status"
                className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 z-10 max-w-[min(22rem,calc(100%-0.5rem))] whitespace-normal text-center rounded-md border border-border bg-card px-2.5 py-1.5 text-caption tabular-nums text-foreground shadow-md nest-float-shadow"
              >
                {t("analytics.monthSummary", {
                  month: monthly[activeIdx]!.label,
                  billed: formatKes(monthly[activeIdx]!.billedMinor),
                  collected: formatKes(monthly[activeIdx]!.collectedMinor),
                  expenses: formatKes(monthly[activeIdx]!.expensesMinor),
                  net: formatKes(monthly[activeIdx]!.netMinor),
                })}
              </span>
            ) : null}
            {ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden
                className={cn(
                  "absolute inset-x-0 h-px",
                  tick === 0 ? "bg-foreground/25" : "bg-border",
                )}
                style={{ bottom: `${tickPct(tick)}%` }}
              />
            ))}

            {/* Month groups — focusable, with a native title tooltip (same
                a11y contract as before); hover/focus ALSO feeds the shared
                exact-values chip (#125 AC-3 — touch users still have the
                honesty table below). Bars sit on the baseline. */}
            <div className="absolute inset-x-0 top-0 bottom-0 flex items-stretch justify-around gap-1 sm:gap-2">
              {monthly.map((month, i) => {
                const summary = t("analytics.monthSummary", {
                  month: month.label,
                  billed: formatKes(month.billedMinor),
                  collected: formatKes(month.collectedMinor),
                  expenses: formatKes(month.expensesMinor),
                  net: formatKes(month.netMinor),
                });
                const isEmptyMonth =
                  month.billedMinor === 0 && month.collectedMinor === 0 && month.expensesMinor === 0;
                return (
                  <div
                    key={month.monthKey}
                    tabIndex={0}
                    role="img"
                    aria-label={summary}
                    title={summary}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                    onFocus={() => setActiveIdx(i)}
                    onBlur={() => setActiveIdx(null)}
                    className="group relative flex-1 min-w-0 max-w-20 flex flex-col focus-visible:outline-2 focus-visible:outline-ring rounded-md focus-visible:-outline-offset-2 transition-colors"
                  >
                    {/* #125 AC-1: an all-zero month prints the honest zero —
                        a small baseline dot — instead of three 1px slivers
                        that read like a rendering error. */}
                    {/* Bars row — fixed height above the label strip so %
                        heights resolve. */}
                    <div className="flex items-end justify-center gap-1 h-[calc(100%-20px)]">
                      {isEmptyMonth ? (
                        <div className="relative w-full h-full flex items-end justify-center">
                          <ZeroBaselineDot />
                        </div>
                      ) : (
                        <>
                          <div
                            aria-hidden
                            className="w-3 sm:w-3.5 rounded-t-[4px] bg-gradient-to-t from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 transition-colors group-hover:from-primary/20 group-hover:to-primary/30 dark:group-hover:from-primary/30 dark:group-hover:to-primary/40"
                            style={{ height: `${barHeightPct(month.billedMinor)}%` }}
                          />
                          <div
                            aria-hidden
                            className="w-3 sm:w-3.5 rounded-t-[4px] bg-gradient-to-t from-primary/85 to-primary transition-colors group-hover:from-primary/95 group-hover:to-primary"
                            style={{ height: `${barHeightPct(month.collectedMinor)}%` }}
                          />
                          <div
                            aria-hidden
                            className="w-3 sm:w-3.5 rounded-t-[4px] bg-gradient-to-t from-attention/70 to-attention/85 transition-colors group-hover:from-attention/80 group-hover:to-attention"
                            style={{ height: `${barHeightPct(month.expensesMinor)}%` }}
                          />
                        </>
                      )}
                    </div>
                    <p className="h-5 flex items-center justify-center text-caption leading-none text-muted-foreground tabular-nums">
                      <span className="truncate px-0.5">{month.label}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Exact values — visible (low-end phones have no hover) and the
            screen-reader fallback, with an sr-only caption. #125 AC-2: on
            narrow screens the five columns keep their natural width inside a
            horizontally scrollable strip (edge fade hints the scroll); no
            more squeeze at 390px. */}
        <div className="relative -mx-1 px-1">
          <div className="overflow-x-auto nest-scrollbar scroll-smooth">
            <table className="w-full min-w-[420px]">
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
          </div>
          {/* Edge fades — the scroll affordance without chrome. Only on the
              very narrow widths that actually scroll (hidden ≥sm). */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent sm:hidden"
          />
        </div>
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
    <Card className="py-0 gap-0">
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
    <Card className="py-0 gap-0">
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
      <Card className="py-0 gap-0">
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
        <Card className="py-0 gap-0">
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
        <Card className="py-0 gap-0">
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
