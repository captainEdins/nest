"use client";

/**
 * NEST — guard-module query + mutation hooks (Phase 3, issue #36).
 *
 * Wire contract (P3-a/P3-b): GET/POST /api/visitors, POST /api/visitors/[id]/exit,
 * GET/POST /api/incidents, GET/POST /api/shifts, POST /api/shifts/[id]/end.
 * Lists arrive newest-first (shifts: ACTIVE first) — screens render the
 * delivered order verbatim and never re-sort.
 *
 * Writes derive the property server-side from the ACTIVE shift; off-duty
 * writes come back 409 with human-readable guidance which surfaces as the
 * toast body (server messages are English-only by design).
 *
 * useDurationTicker: live "{hours}h {minutes}m" elapsed label for an ACTIVE
 * shift, refreshed every 30s (guard.durationHours) — shared by the home
 * on-duty card, the shift log and the end-shift sheet.
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type {
  EndShiftRequest,
  GuardShiftDto,
  IncidentReportDto,
  IncidentSeverity,
  LogVisitorRequest,
  ReportIncidentRequest,
  StartShiftRequest,
  VisitorLogDto,
} from "@/lib/types";

/** Server error message wins (English-only by contract); fallback is generic. */
function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.error ? error.error : fallback;
}

// ---------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------

/** Shared gate register, newest-first (guard scope = worked properties). */
export function useVisitorLog(): UseQueryResult<VisitorLogDto[]> {
  return useQuery({
    queryKey: ["visitors"],
    queryFn: () => apiGet<VisitorLogDto[]>("/api/visitors"),
    staleTime: 30_000,
  });
}

/** POST /api/visitors — property derived from the ACTIVE shift (409 off duty). */
export function useLogVisitor() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LogVisitorRequest) => apiPost<VisitorLogDto>("/api/visitors", input),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["visitors"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("guard.visitors.logged", { name: created.visitorName }));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/** POST /api/visitors/[id]/exit — stamps exitedAt (409 when already out). */
export function useMarkExit() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) =>
      apiPost<VisitorLogDto>(`/api/visitors/${id}/exit`),
    onSuccess: (_updated, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["visitors"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("guard.visitors.exitDone", { name: variables.name }));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

/** Shared incident queue, newest-first (guard scope = worked properties). */
export function useIncidentLog(): UseQueryResult<IncidentReportDto[]> {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: () => apiGet<IncidentReportDto[]>("/api/incidents"),
    staleTime: 30_000,
  });
}

/** POST /api/incidents — HIGH/CRITICAL notify landlord + caretaker server-side. */
export function useReportIncident() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportIncidentRequest) => apiPost<IncidentReportDto>("/api/incidents", input),
    onSuccess: (_created, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(
        t("guard.incidents.filed", {
          severityLabel: t(`guard.incidents.severity.${variables.severity}` as TranslationKey),
        }),
      );
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

/** All guards' shifts at the guard's worked properties — ACTIVE first, then newest. */
export function useShifts(): UseQueryResult<GuardShiftDto[]> {
  return useQuery({
    queryKey: ["shifts"],
    queryFn: () => apiGet<GuardShiftDto[]>("/api/shifts"),
    staleTime: 30_000,
  });
}

/** POST /api/shifts — 409 already on duty, 403 never worked at that property. */
export function useStartShift() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartShiftRequest) => apiPost<GuardShiftDto>("/api/shifts", input),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("guard.shiftStarted", { property: created.propertyName }));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/** POST /api/shifts/[id]/end — latches endedAt; optional handover notes (≤500). */
export function useEndShift() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiPost<GuardShiftDto>(`/api/shifts/${id}/end`, notes ? { notes } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("guard.shiftEnded"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

// ---------------------------------------------------------------------------
// Live duration ticker
// ---------------------------------------------------------------------------

/** Live "Xh Ym" elapsed label for a shift start, refreshed every 30 seconds. */
export function useDurationTicker(startedAtIso: string | null | undefined): string | null {
  const { t } = useI18n();
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return React.useMemo(() => {
    if (startedAtIso == null) return null;
    const started = Date.parse(startedAtIso);
    if (Number.isNaN(started)) return null;
    const totalMinutes = Math.max(0, Math.floor((now - started) / 60_000));
    return t("guard.durationHours", {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  }, [startedAtIso, now, t]);
}

/** Static duration label for a COMPLETED shift (no ticker). */
export function shiftDurationLabel(
  shift: GuardShiftDto,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string | null {
  if (shift.endedAt == null) return null;
  const started = Date.parse(shift.startedAt);
  const ended = Date.parse(shift.endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return null;
  const totalMinutes = Math.max(0, Math.floor((ended - started) / 60_000));
  return t("guard.durationHours", {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  });
}

/** Re-exported so screens can label severities with one import. */
export const incidentSeverityLabelKey = (severity: IncidentSeverity): TranslationKey =>
  `guard.incidents.severity.${severity}` as TranslationKey;
