"use client";

/**
 * S-35 · Security screen (LANDLORD/CARETAKER — More sheet / desktop sidebar,
 * Phase 3 issue #37). One screen, three segments (ui-store `securitySegment`):
 *
 * - Visitors: the shared gate register — today first, then history grouped
 *   by day (in/out times, on-site badge, unit, purpose chip). P4-e: the rows
 *   are the SHARED visitor-row component (same one the guard register
 *   renders) plus the logging guard's attribution line.
 * - Incidents: severity-coded cards with the Acknowledge action (AlertDialog
 *   confirm → POST /api/incidents/[id]/ack; the confirm states the guard will
 *   be notified). Acked cards flip to "Seen by …" — state-driven, so a
 *   replayed ack has no button to hit (server 409 is the backstop).
 * - Shifts: the live on-duty card + past shifts with handover notes.
 *
 * Data: GET /api/visitors, /api/incidents, /api/shifts (property-chain
 * scope, newest-first). No money on any security surface.
 */

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Loader2,
  MoonStar,
  ShieldAlert,
} from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type {
  GuardShiftDto,
  IncidentCategory,
  IncidentReportDto,
  IncidentSeverity,
  VisitorLogDto,
} from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import {
  useAckIncident,
  useIncidentRegister,
  useShiftRegister,
  useVisitorRegister,
} from "@/hooks/use-security";
import { formatDate, formatTime, timeAgo } from "@/components/nest/shared/format";
import { SectionHeader } from "@/components/nest/shared/section-header";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { VisitorRow } from "@/components/nest/shared/security/visitor-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type SecuritySegment = "visitors" | "incidents" | "shifts";

// ---------------------------------------------------------------------------
// Label key maps (guard-module keys are shared vocabulary)
// ---------------------------------------------------------------------------

const CATEGORY_KEYS: Record<IncidentCategory, TranslationKey> = {
  SECURITY: "guard.incidents.category.SECURITY",
  DAMAGE: "guard.incidents.category.DAMAGE",
  DISPUTE: "guard.incidents.category.DISPUTE",
  THEFT: "guard.incidents.category.THEFT",
  OTHER: "guard.incidents.category.OTHER",
};

const SEVERITY_KEYS: Record<IncidentSeverity, TranslationKey> = {
  LOW: "guard.incidents.severity.LOW",
  MEDIUM: "guard.incidents.severity.MEDIUM",
  HIGH: "guard.incidents.severity.HIGH",
  CRITICAL: "guard.incidents.severity.CRITICAL",
};

/**
 * (P4-e) time-ago captions run through shared/format `timeAgo` — the one
 * helper (the local security.time* duplication was removed with it).
 */

/** Severity chip + left border tones — stone / amber / rose families only. */
const SEVERITY_STYLES: Record<IncidentSeverity, { chip: string; border: string; pulse?: boolean }> = {
  LOW: {
    chip: "border-transparent bg-muted text-muted-foreground",
    border: "border-l-muted-foreground/40",
  },
  MEDIUM: {
    chip: "border-warning/60 bg-warning/15 dark:bg-warning/10 text-attention",
    border: "border-l-warning",
  },
  HIGH: {
    chip: "border-destructive/50 bg-destructive/10 text-destructive",
    border: "border-l-destructive",
  },
  CRITICAL: {
    chip: "border-destructive bg-destructive text-destructive-foreground",
    border: "border-l-destructive",
    pulse: true,
  },
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function SecurityScreen() {
  const { t } = useI18n();
  const segment = useUIStore((s) => s.securitySegment);
  const setSegment = useUIStore((s) => s.setSecuritySegment);

  const visitorsQuery = useVisitorRegister();
  const incidentsQuery = useIncidentRegister();
  const shiftsQuery = useShiftRegister();

  // Segment counts are list-derived (they describe what's a tap away).
  const todayCount = React.useMemo(
    () => countToday((visitorsQuery.data ?? []).map((v) => v.enteredAt)),
    [visitorsQuery.data],
  );
  const unackedCount = React.useMemo(
    () => (incidentsQuery.data ?? []).filter((i) => i.acknowledgedById == null).length,
    [incidentsQuery.data],
  );

  const options: {
    value: SecuritySegment;
    label: string;
    count?: number;
    amber?: boolean;
  }[] = [
    {
      value: "visitors",
      label: t("security.visitorsSegment"),
      count: visitorsQuery.data != null ? todayCount : undefined,
    },
    {
      value: "incidents",
      label: t("security.incidentsSegment"),
      count: incidentsQuery.data != null ? unackedCount : undefined,
      amber: unackedCount > 0,
    },
    { value: "shifts", label: t("security.shiftsSegment") },
  ];

  return (
    <section aria-label={t("security.title")} className="space-y-4">
      <h1 className="text-h2 font-semibold">{t("security.title")}</h1>

      {/* Segmented control — 3× 44px targets, counts on Visitors + Incidents */}
      <div
        role="group"
        aria-label={t("security.title")}
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {options.map((option) => {
          const active = segment === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSegment(option.value)}
              className="h-11 px-1 rounded-md text-label font-medium flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ring outline-none transition-colors"
              style={{ backgroundColor: active ? "var(--card)" : undefined }}
            >
              <span className="truncate">{option.label}</span>
              {typeof option.count === "number" ? (
                <span
                  className={cn(
                    "text-caption tabular-nums shrink-0",
                    option.amber ? "text-attention font-semibold" : "opacity-70",
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {segment === "visitors" ? (
        <VisitorsSegment query={visitorsQuery} />
      ) : segment === "incidents" ? (
        <IncidentsSegment query={incidentsQuery} />
      ) : (
        <ShiftsSegment query={shiftsQuery} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Visitors — today first, then history grouped by day
// ---------------------------------------------------------------------------

interface DayGroup {
  label: string;
  items: VisitorLogDto[];
}

function groupVisitorsByDay(visitors: VisitorLogDto[], t: ReturnType<typeof useI18n>["t"]): DayGroup[] {
  const groups: DayGroup[] = [];
  const now = new Date();
  for (const visitor of visitors) {
    let label: string;
    try {
      const days = differenceInCalendarDays(now, parseISO(visitor.enteredAt));
      if (days <= 0) label = t("guard.visitors.today");
      else if (days === 1) label = t("guard.visitors.yesterday");
      else label = formatDate(visitor.enteredAt);
    } catch {
      label = formatDate(visitor.enteredAt);
    }
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(visitor);
    else groups.push({ label, items: [visitor] });
  }
  return groups;
}

function VisitorsSegment({ query }: { query: UseQueryResult<VisitorLogDto[]> }) {
  const { t } = useI18n();

  if (query.error != null) {
    return <ErrorState onRetry={() => query.refetch()} message={t("security.loadError")} />;
  }
  if (query.isPending) {
    return <ListSkeleton rows={6} />;
  }
  const groups = groupVisitorsByDay(query.data ?? [], t);
  if (groups.length === 0) {
    return <EmptyState icon={BookOpen} title={t("security.noVisitors")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <SectionHeader title={group.label} count={group.items.length} className="mb-3" />
          <Card className="overflow-hidden">
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {group.items.map((visitor) => (
                  <VisitorRow key={visitor.id} visitor={visitor} showGuard />
                ))}
              </div>
            </ScrollArea>
          </Card>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incidents — severity-coded cards + the acknowledge loop
// ---------------------------------------------------------------------------

function IncidentsSegment({ query }: { query: UseQueryResult<IncidentReportDto[]> }) {
  const { t } = useI18n();

  if (query.error != null) {
    return <ErrorState onRetry={() => query.refetch()} message={t("security.loadError")} />;
  }
  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <IncidentCardSkeleton />
        <IncidentCardSkeleton />
      </div>
    );
  }
  const incidents = query.data ?? [];
  if (incidents.length === 0) {
    return <EmptyState icon={ShieldAlert} title={t("security.noIncidents")} />;
  }

  return (
    <ScrollArea className="max-h-96">
      <div className="space-y-4 pr-3">
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
    </ScrollArea>
  );
}

function IncidentCard({ incident }: { incident: IncidentReportDto }) {
  const { t } = useI18n();
  const style = SEVERITY_STYLES[incident.severity];
  const acked = incident.acknowledgedById != null;

  return (
    <Card
      className={cn(
        "border-l-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
        style.border,
      )}
    >
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-caption gap-1", style.chip)}>
            {style.pulse ? (
              <span aria-hidden className="size-1.5 rounded-full bg-current animate-pulse" />
            ) : null}
            {t(SEVERITY_KEYS[incident.severity])}
          </Badge>
          <p className="text-caption font-medium text-muted-foreground">
            {t(CATEGORY_KEYS[incident.category])}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums ml-auto shrink-0">
            {timeAgo(incident.createdAt, t)}
          </p>
        </div>

        <p className="text-body break-words">{incident.description}</p>
        {incident.actionTaken ? (
          <p className="text-body text-muted-foreground break-words">
            {t("security.actionTakenLabel", { action: incident.actionTaken })}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t">
          <p className="text-caption text-muted-foreground min-w-0 truncate">
            {t("guard.incidents.filedBy", { guard: incident.guardName })}
          </p>
          {acked ? (
            <span className="inline-flex items-center gap-1 text-caption text-success font-medium shrink-0">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {t("guard.incidents.seenBy", { name: incident.acknowledgedByName ?? "—" })}
            </span>
          ) : (
            <AcknowledgeButton incident={incident} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Confirm-then-ack — the dialog states the guard will be notified. */
function AcknowledgeButton({ incident }: { incident: IncidentReportDto }) {
  const { t } = useI18n();
  const ack = useAckIncident();
  const [open, setOpen] = React.useState(false);
  const busy = ack.isPending && ack.variables?.id === incident.id;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 sm:h-9 shrink-0 border-primary/50 text-primary bg-transparent hover:bg-primary/10"
          disabled={ack.isPending}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {t("security.acknowledge")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("security.ackConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("security.ackConfirmBody", { guard: incident.guardName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-10" disabled={ack.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 sm:h-10"
            disabled={ack.isPending}
            onClick={(event) => {
              // Keep the dialog open while the ack is in flight; it closes on
              // success (the card flips) and stays put on error (toast).
              event.preventDefault();
              ack.mutate(incident, { onSuccess: () => setOpen(false) });
            }}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("security.acknowledge")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function IncidentCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex gap-2 items-center">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14 ml-auto" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-2.5 border-t flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shifts — live on-duty card + past shifts with handover notes
// ---------------------------------------------------------------------------

function ShiftsSegment({ query }: { query: UseQueryResult<GuardShiftDto[]> }) {
  const { t } = useI18n();

  if (query.error != null) {
    return <ErrorState onRetry={() => query.refetch()} message={t("security.loadError")} />;
  }
  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="size-3 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </CardContent>
        </Card>
        <ListSkeleton rows={3} />
      </div>
    );
  }
  const shifts = query.data ?? [];
  if (shifts.length === 0) {
    return <EmptyState icon={MoonStar} title={t("security.noShifts")} />;
  }

  const active = shifts.find((s) => s.endedAt == null) ?? null;
  const past = shifts.filter((s) => s.endedAt != null);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* On duty now — live dot */}
      {active != null ? (
        <Card className="animate-in fade-in duration-300 fill-mode-both">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold truncate">
                {t("security.onDutyGuard", { name: active.guardName })}
              </p>
              <p className="text-caption text-muted-foreground truncate tabular-nums">
                {t("guard.onDutySince", {
                  time: `${formatDate(active.startedAt)} · ${formatTime(active.startedAt)}`,
                })}{" "}
                · {active.propertyName}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 flex items-center gap-2.5 text-muted-foreground">
            <MoonStar className="size-4 shrink-0" aria-hidden />
            <p className="text-body">{t("security.noGuardOnDuty")}</p>
          </CardContent>
        </Card>
      )}

      {/* Past shifts + handover notes */}
      {past.length > 0 ? (
        <section aria-label={t("guard.pastShifts")}>
          <SectionHeader title={t("guard.pastShifts")} count={past.length} className="mb-3" />
          <Card className="overflow-hidden">
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {past.map((shift) => (
                  <PastShiftRow key={shift.id} shift={shift} />
                ))}
              </div>
            </ScrollArea>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function PastShiftRow({ shift }: { shift: GuardShiftDto }) {
  const { t } = useI18n();
  const ended = shift.endedAt ?? shift.startedAt;
  const durationMs = new Date(ended).getTime() - new Date(shift.startedAt).getTime();
  const hours = Math.max(0, Math.floor(durationMs / 3_600_000));
  const minutes = Math.max(0, Math.floor((durationMs % 3_600_000) / 60_000));

  return (
    <div className="p-4 space-y-1.5 animate-in fade-in duration-300 fill-mode-both">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body font-semibold truncate">{shift.guardName}</p>
        <p className="text-caption text-muted-foreground tabular-nums shrink-0">
          {t("guard.durationHours", { hours, minutes })}
        </p>
      </div>
      <p className="text-caption text-muted-foreground tabular-nums">
        {formatDate(shift.startedAt)} · {formatTime(shift.startedAt)} → {formatTime(ended)}
      </p>
      {shift.notes ? (
        <p className="text-body text-muted-foreground italic border-l-2 border-border pl-3 break-words">
          {shift.notes}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many ISO timestamps fall on today's calendar day. */
function countToday(isos: string[]): number {
  const now = new Date();
  let count = 0;
  for (const iso of isos) {
    try {
      if (differenceInCalendarDays(now, parseISO(iso)) <= 0) count += 1;
    } catch {
      /* unparseable timestamps simply don't count */
    }
  }
  return count;
}
