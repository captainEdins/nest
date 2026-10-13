"use client";

/**
 * MiniTrendCard (Phase 21, D-034 — the classic home) — the compact 6-month
 * collection trend, the hero bar chart in the classic frame. Extracted from
 * landlord/home.tsx in Phase 23 (issue #109 — agent parity) so the agent's
 * desk renders the SAME chart from the shared ["analytics"] cache.
 *
 * Accessible by construction: each month group is focusable with a
 * <title> tooltip; the footer carries the latest month's exact numbers so
 * money is never guessed from bar heights.
 */

import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { formatKes } from "@/lib/money";
import type { AnalyticsMonthDto } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

const MINI_W = 340;
const MINI_H = 104;
const MINI_BASE = 82;
const MINI_TOP = 8;

/** Bar path with rounded top only — base sits flat on the baseline. */
function miniBarPath(x: number, top: number, width: number, bottom: number): string {
  const radius = Math.min(3, bottom - top, width / 2);
  if (bottom - top <= radius) return `M ${x} ${bottom} L ${x + width} ${bottom} Z`;
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

export function MiniTrendCard({ monthly }: { monthly: AnalyticsMonthDto[] }) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);

  const maxMinor = monthly.reduce((max, m) => Math.max(max, m.billedMinor, m.collectedMinor), 0);
  const groupW = MINI_W / monthly.length;
  const barW = Math.min(14, groupW * 0.3);
  const pairW = barW * 2 + 4;
  const barH = (valueMinor: number) =>
    maxMinor > 0 ? Math.max(2, Math.round((valueMinor / maxMinor) * (MINI_BASE - MINI_TOP))) : 2;
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

        <svg
          viewBox={`0 0 ${MINI_W} ${MINI_H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${t("analytics.collectionTrend")} — ${t("analytics.last6Months")}`}
        >
          {/* Quiet dashed gridlines (reference texture); baseline solid. */}
          {[0.5, 1].map((frac) => {
            const y = MINI_BASE - Math.round(frac * (MINI_BASE - MINI_TOP));
            return (
              <line
                key={frac}
                x1={0}
                x2={MINI_W}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            );
          })}
          <line
            x1={0}
            x2={MINI_W}
            y1={MINI_BASE}
            y2={MINI_BASE}
            className="stroke-foreground/25"
            strokeWidth={1}
          />

          {monthly.map((month, index) => {
            const groupX = index * groupW;
            const pairX = groupX + (groupW - pairW) / 2;
            const billedH = barH(month.billedMinor);
            const collectedH = barH(month.collectedMinor);
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
                  d={miniBarPath(pairX, MINI_BASE - billedH, barW, MINI_BASE)}
                  className="fill-muted"
                />
                <path
                  d={miniBarPath(pairX + barW + 4, MINI_BASE - collectedH, barW, MINI_BASE)}
                  className="fill-primary"
                />
                <text
                  x={groupX + groupW / 2}
                  y={MINI_H - 4}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted-foreground"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>

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
