"use client";

/**
 * S-32 · Guard incidents tab — the shared incident queue (Phase 3, issue #36).
 *
 * GET /api/incidents (shared register at the guard's worked properties,
 * newest-first) rendered in the API's order verbatim. Severity leads the
 * visual hierarchy — chip + colored left border; CRITICAL pulses like the
 * repairs URGENT chip. Ack status closes the loop ("Seen by …" once the
 * landlord/caretaker acknowledges).
 */

import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { IncidentReportDto, IncidentSeverity } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { useIncidentLog } from "@/hooks/use-guard";
import { timeAgo } from "@/components/nest/shared/format";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Severity tones — LOW stone · MEDIUM amber · HIGH/CRITICAL destructive (CRITICAL pulses). */
const SEVERITY_STYLES: Record<IncidentSeverity, { chip: string; bar: string; pulse?: boolean }> = {
  LOW: {
    chip: "border-transparent bg-muted text-muted-foreground",
    bar: "border-l-muted",
  },
  MEDIUM: {
    chip: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
    bar: "border-l-warning/70",
  },
  HIGH: {
    chip: "border-destructive/50 bg-destructive/10 text-destructive",
    bar: "border-l-destructive",
  },
  CRITICAL: {
    chip: "border-destructive/50 bg-destructive/10 text-destructive",
    bar: "border-l-destructive",
    pulse: true,
  },
};

function SeverityChip({ severity }: { severity: IncidentSeverity }) {
  const { t } = useI18n();
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-caption font-medium w-fit whitespace-nowrap shrink-0 transition-colors duration-300",
        style.chip,
      )}
    >
      {style.pulse ? (
        <span aria-hidden className="size-1.5 rounded-full bg-destructive animate-pulse" />
      ) : null}
      {t(`guard.incidents.severity.${severity}` as TranslationKey)}
    </span>
  );
}

export function GuardIncidents() {
  const { t } = useI18n();
  const setReportIncidentOpen = useUIStore((s) => s.setReportIncidentOpen);
  const { data: incidents, isPending, error, refetch } = useIncidentLog();

  return (
    <section aria-label={t("guard.incidents")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("guard.incidents")}</h1>
        {incidents != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {incidents.length}
          </span>
        ) : null}
      </div>

      {/* Report incident — the guard's escalation path */}
      <Button
        variant="outline"
        className="w-full h-12 text-body-lg border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10"
        onClick={() => setReportIncidentOpen(true)}
      >
        <ShieldAlert aria-hidden />
        {t("guard.incidents.report")}
      </Button>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("guard.incidents.loadError")} />
      ) : isPending ? (
        <ListSkeleton rows={4} />
      ) : incidents == null || incidents.length === 0 ? (
        <EmptyState icon={ShieldAlert} title={t("guard.incidents.empty")} />
      ) : (
        <Card className="divide-y animate-in fade-in duration-300">
          {incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </Card>
      )}
    </section>
  );
}

function IncidentRow({ incident }: { incident: IncidentReportDto }) {
  const { t } = useI18n();
  const style = SEVERITY_STYLES[incident.severity];
  const acker = incident.acknowledgedByName;

  return (
    <article className={cn("border-l-4 pl-4 p-3.5 sm:p-4", style.bar)}>
      <div className="flex items-center justify-between gap-2">
        <SeverityChip severity={incident.severity} />
        <span className="text-caption text-muted-foreground tabular-nums shrink-0">
          {timeAgo(incident.createdAt, t)}
        </span>
      </div>
      <p className="text-body font-semibold mt-1.5">
        {t(`guard.incidents.category.${incident.category}` as TranslationKey)}
      </p>
      <p className="text-body text-muted-foreground line-clamp-2 mt-0.5 break-words">
        {incident.description}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-caption text-muted-foreground truncate">
          {t("guard.incidents.filedBy", { guard: incident.guardName })}
        </span>
        {acker != null ? (
          <span className="inline-flex items-center gap-1 text-caption text-success shrink-0">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {t("guard.incidents.seenBy", { name: acker })}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md border border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention px-2 py-0.5 text-caption font-medium shrink-0">
            {t("guard.incidents.notYetSeen")}
          </span>
        )}
      </div>
    </article>
  );
}
