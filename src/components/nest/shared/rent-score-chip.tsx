"use client";

/**
 * Rent Score chip (Phase 6-b, issue #66) — the small staff-facing badge:
 * score + band word in the band's semantic colour, never colour-only.
 * Shared by the arrears card rows and the desktop table so the number a
 * landlord sees is the same engine output the tenant's card shows.
 *
 * Phase 18 (D-031): pastel-tint treatment (matches StatusBadge) — the old
 * neutral outline read as an empty/broken container on the warm canvas
 * (two independent design audits mis-filed it as a rendering failure).
 */

import { useI18n } from "@/lib/i18n";
import { scoreBandKey } from "@/components/nest/tenant/rent-score-card";
import type { RentScoreBand } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<RentScoreBand, string> = {
  EXCELLENT: "border-transparent bg-success/15 text-success",
  GOOD: "border-transparent bg-primary/10 text-primary",
  FAIR: "border-transparent bg-warning/15 text-attention",
  BUILDING: "border-transparent bg-muted text-muted-foreground",
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
