"use client";

/**
 * Rent Score card (Phase 6-b, issue #66) — the tenant's payment-record score.
 *
 * Design rules this follows:
 * - Never a black box: the card ships the factor breakdown (earned/max per
 *   documented factor) and an expandable "how this is built" that states each
 *   factor's rule in one sentence. Trust is the product.
 * - Never colour-only: band colour is paired with a band word + the score.
 * - Hand-rolled inline SVG, zero chart deps (D-018) — the low-end-Android
 *   persona pays no bundle tax for one arc.
 * - Score colours: EXCELLENT success · GOOD primary · FAIR attention ·
 *   BUILDING muted (design-system semantic tokens, no new colours).
 */

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { RentScoreBand, RentScoreDto, RentScoreFactorKey } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { HeroSkeleton } from "@/components/nest/shared/skeletons";
import { cn } from "@/lib/utils";

const BAND_STYLES: Record<RentScoreBand, { ring: string; text: string; dot: string }> = {
  EXCELLENT: { ring: "stroke-success", text: "text-success", dot: "bg-success" },
  GOOD: { ring: "stroke-primary", text: "text-primary", dot: "bg-primary" },
  FAIR: { ring: "stroke-attention", text: "text-attention", dot: "bg-attention" },
  BUILDING: { ring: "stroke-muted-foreground/50", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export function scoreBandKey(band: RentScoreBand): TranslationKey {
  return `score.band.${band.toLowerCase()}` as TranslationKey;
}

function factorLabelKey(key: RentScoreFactorKey): TranslationKey {
  return `score.factor.${key}` as TranslationKey;
}

function factorExplainKey(key: RentScoreFactorKey): TranslationKey {
  return `score.explain.${key}` as TranslationKey;
}

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function RentScoreCard({
  data,
  isPending,
}: {
  data: RentScoreDto | undefined;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [explainerOpen, setExplainerOpen] = useState(false);

  if (isPending || !data) {
    return (
      <Card aria-busy>
        <CardContent className="p-4 sm:p-6">
          <HeroSkeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const band = BAND_STYLES[data.band];
  const progress = Math.max(0, Math.min(1, data.score / 800));
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Head: score ring + band */}
        <div className="flex items-center gap-5">
          <svg
            viewBox="0 0 120 120"
            className="size-28 shrink-0"
            role="img"
            aria-label={`${t("score.title")}: ${data.score} ${t("score.ofMax")}, ${t(scoreBandKey(data.band))}`}
          >
            {/* Track */}
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            {/* Progress arc — rotated so it starts at 12 o'clock */}
            <circle
              cx="60"
              cy="60"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              className={cn(band.ring, "transition-[stroke-dashoffset] duration-700 ease-out")}
            />
            <text
              x="60"
              y="66"
              textAnchor="middle"
              className="fill-foreground text-[28px] font-bold tabular-nums"
            >
              {data.score}
            </text>
          </svg>

          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted-foreground uppercase tracking-wide">
              {t("score.title")}
            </p>
            <p className={cn("text-h3 font-semibold mt-0.5 flex items-center gap-2", band.text)}>
              <span className={cn("size-2 rounded-full shrink-0", band.dot)} aria-hidden />
              {t(scoreBandKey(data.band))}
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              {t("score.subtitle")} · {t("score.monthsOnRecord", { count: data.monthsOfHistory })}
            </p>
          </div>
        </div>

        {/* Factor breakdown — earned out of max, never a black box */}
        <div className="mt-5 space-y-3">
          {data.factors.map((factor) => {
            const ratio = factor.max > 0 ? factor.earned / factor.max : 0;
            return (
              <div key={factor.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-caption text-foreground/80 truncate">
                    {t(factorLabelKey(factor.key))}
                  </p>
                  <p className="text-caption tabular-nums text-muted-foreground shrink-0">
                    <span className="text-foreground font-semibold">{factor.earned}</span>
                    {" / "}
                    {factor.max}
                  </p>
                </div>
                <div
                  className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={factor.max}
                  aria-valuenow={factor.earned}
                  aria-label={t(factorLabelKey(factor.key))}
                >
                  <div
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", band.dot)}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-caption text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0 mt-0.5" aria-hidden />
          {t("score.disclaimer")}
        </p>

        {/* How this is built — one tap, four one-sentence rules */}
        <div className="mt-3 pt-3 border-t">
          <button
            type="button"
            onClick={() => setExplainerOpen((open) => !open)}
            aria-expanded={explainerOpen}
            className="flex items-center gap-1.5 text-caption font-medium text-foreground/80 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {t("score.howBuilt")}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                explainerOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {explainerOpen ? (
            <ul className="mt-2 space-y-2">
              {data.factors.map((factor) => (
                <li key={factor.key} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/50 shrink-0"
                    aria-hidden
                  />
                  <p className="text-caption text-muted-foreground">
                    <span className="text-foreground font-medium">
                      {t(factorLabelKey(factor.key))}
                      {": "}
                    </span>
                    {t(factorExplainKey(factor.key))}{" "}
                    <span className="tabular-nums">({factor.earned}/{factor.max})</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
