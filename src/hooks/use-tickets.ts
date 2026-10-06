"use client";

/**
 * NEST — maintenance-ticket query hooks (Phase 2, issue #23).
 *
 * Wire contract (PR #28): GET/POST /api/tickets, GET /api/tickets/[id],
 * POST /api/tickets/[id]/updates — all wrapped as ApiOk<TicketDto> and
 * unwrapped by apiGet/apiPost. The list arrives status-ordered (OPEN,
 * IN_PROGRESS, RESOLVED, CLOSED; newest first within a status) — screens
 * render it in the delivered order and never re-sort.
 *
 * TENANT timelines are read-only server-side (403 on updates) — the UI hides
 * the composer and transition buttons for tenants instead of surfacing it.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";
import type { CreateTicketRequest, TicketDto, TicketStatus } from "@/lib/types";

/** Localized status label keys — reuses the filter chip copy ("Open", …). */
export const TICKET_STATUS_LABEL_KEYS: Record<TicketStatus, TranslationKey> = {
  OPEN: "repairs.filterOpen",
  IN_PROGRESS: "repairs.filterInProgress",
  RESOLVED: "repairs.filterResolved",
  CLOSED: "repairs.filterClosed",
};

/** Localized status label ("OPEN" → "Open" / "Wazi"). */
export function ticketStatusLabel(status: TicketStatus, t: (key: TranslationKey) => string): string {
  return t(TICKET_STATUS_LABEL_KEYS[status]);
}

/** Scoped ticket list — mounted for LANDLORD/CARETAKER/TENANT (never GUARD). */
export function useTickets(): UseQueryResult<TicketDto[]> {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiGet<TicketDto[]>("/api/tickets"),
    staleTime: 30_000,
  });
}

/** One ticket with its full timeline (oldest first). 404 when out of scope. */
export function useTicket(id: string): UseQueryResult<TicketDto> {
  return useQuery({
    queryKey: ["tickets", id],
    queryFn: () => apiGet<TicketDto>(`/api/tickets/${id}`),
    staleTime: 30_000,
  });
}

/** POST /api/tickets — tenant (unit derived) or caretaker (unitId required). */
export function useCreateTicket() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketRequest) => apiPost<TicketDto>("/api/tickets", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(t("repairs.submitted"));
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.error : t("errors.somethingWrong"));
    },
  });
}

/** POST /api/tickets/[id]/updates — note (1..2000 chars) and/or transition. */
export function useTicketUpdate(id: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ note, statusTo }: { note: string; statusTo?: TicketStatus; statusFrom?: TicketStatus }) =>
      apiPost<TicketDto>(`/api/tickets/${id}/updates`, { note, statusTo }),
    onSuccess: (ticket, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets", id] });
      if (variables.statusTo) {
        toast.success(
          t("repairs.statusChanged", {
            from: ticketStatusLabel(variables.statusFrom ?? ticket.status, t),
            to: ticketStatusLabel(variables.statusTo, t),
          }),
        );
      }
    },
    onError: (error) => {
      // Server semantics win: 409 (invalid transition / closed ticket) and
      // 403 (tenant timeline) arrive with human-readable messages.
      toast.error(error instanceof ApiError ? error.error : t("errors.somethingWrong"));
    },
  });
}
