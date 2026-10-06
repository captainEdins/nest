"use client";

/**
 * NEST — security-module query hooks (Phase 3, issue #37).
 *
 * The landlord/caretaker read surface of the guard module: the shared gate
 * register (GET /api/visitors), the incident reports with their ack state
 * (GET /api/incidents) and the shift log (GET /api/shifts) — all
 * role-scoped server-side via the property chain (matrix §4.1/§4.2).
 *
 * The ack mutation (POST /api/incidents/[id]/ack, LANDLORD/CARETAKER only)
 * closes the trust loop: on success it refreshes the incident register AND
 * both role overviews (the digest's unseen counts live there), then toasts
 * in the acker's language. A replayed ack surfaces the server's 409 message
 * verbatim ("Incident already acknowledged").
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { GuardShiftDto, IncidentReportDto, VisitorLogDto } from "@/lib/types";

/** Shared gate register — GET /api/visitors (newest first, take 100). */
export function useVisitorRegister(): UseQueryResult<VisitorLogDto[]> {
  return useQuery({
    queryKey: ["visitors"],
    queryFn: () => apiGet<VisitorLogDto[]>("/api/visitors"),
    staleTime: 30_000,
  });
}

/** Incident register — GET /api/incidents (newest first, take 100). */
export function useIncidentRegister(): UseQueryResult<IncidentReportDto[]> {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: () => apiGet<IncidentReportDto[]>("/api/incidents"),
    staleTime: 30_000,
  });
}

/** Shift log — GET /api/shifts (newest first, take 50). */
export function useShiftRegister(): UseQueryResult<GuardShiftDto[]> {
  return useQuery({
    queryKey: ["shifts"],
    queryFn: () => apiGet<GuardShiftDto[]>("/api/shifts"),
    staleTime: 30_000,
  });
}

/**
 * POST /api/incidents/[id]/ack — LANDLORD/CARETAKER mark a guard's report as
 * seen (the guard gets an IN_APP notification server-side). Takes the full
 * incident so the toast can name the filing guard.
 */
export function useAckIncident() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (incident: IncidentReportDto) =>
      apiPost<IncidentReportDto>(`/api/incidents/${incident.id}/ack`),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("security.ackDone", { guard: updated.guardName }));
    },
    onError: (error) => {
      // 409 (already acknowledged) and 403 arrive with human-readable messages.
      toast.error(error instanceof ApiError ? error.error : t("security.loadError"));
    },
  });
}
