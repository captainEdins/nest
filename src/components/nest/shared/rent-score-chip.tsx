"use client";

/**
 * Rent Score chip (Phase 6-b, issue #66) — the small staff-facing badge:
 * score + band word in the band's semantic colour, never colour-only.
 * Shared by the arrears card rows and the desktop table so the number a
 * landlord sees is the same engine output the tenant's card shows.
 */

import { useI18n } from "@/lib/i18n";
import { scoreBandKey } from "@/components/nest/tenant/rent-score-card";
import type { RentScoreBand } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<RentScoreBand, string> = {
  EXCELLENT: "border-success text-success",
  GOOD: "border-primary text-primary",
  FAIR: "border-attention text-attention",
  BUILDING: "border-border text-muted-foreground",
};

export function RentScoreChip({
  score,
  band,
  className,
}: {
  score: number;
  band: RentScoreBand;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-full border px-2 py-0.5 tabular-nums",
        CHIP_STYLES[band],
        className,
      )}
      title={`${t("score.title")}: ${score} ${t("score.ofMax")}`}
    >
      <span className="text-caption font-semibold">{score}</span>
      <span className="text-caption/90 hidden min-[420px]:inline">
        {t(scoreBandKey(band))}
      </span>
    </span>
  );
}
