"use client";

/** KPI card — caption label + big number (text-kpi tabular-nums) + optional icon/progress. */

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  sub,
  progressPct,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "amber" | "success";
  sub?: React.ReactNode;
  progressPct?: number;
  className?: string;
}) {
  const valueTone =
    tone === "amber" ? "text-attention" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
          <p className="text-label font-medium text-muted-foreground">{label}</p>
        </div>
        <p className={cn("text-kpi font-bold tabular-nums mt-2", valueTone)}>{value}</p>
        {sub ? <div className="text-caption text-muted-foreground mt-1">{sub}</div> : null}
        {typeof progressPct === "number" ? (
          <Progress value={Math.min(100, Math.max(0, progressPct))} className="h-2 mt-3" aria-hidden />
        ) : null}
      </CardContent>
    </Card>
  );
}
