"use client";

/**
 * NEST — typed query hooks (one API call per role home, D-014: refetch on
 * focus + 30s). The ["overview"] key is shared by every screen of the signed-in
 * role — all tabs read the cached payload instead of re-fetching.
 */

import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { apiGet, apiGetSession, apiPost, type MpesaStatusDto } from "@/lib/api";
import { getQueryClient } from "@/components/nest/providers";
import type {
  AgentOverviewDto,
  CaretakerOverviewDto,
  GuardOverviewDto,
  KraSummaryDto,
  LandlordAnalyticsDto,
  LandlordOverviewDto,
  NotificationDto,
  PaymentDto,
  ReceiptDto,
  RentScoreBand,
  RentScoreDto,
  SessionDto,
  StatementDto,
  TenantOverviewDto,
} from "@/lib/types";

/** The signed-in session (reactive — flips to null on 401/logout). */
export function useSession(): UseQueryResult<SessionDto | null> {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: apiGetSession,
    staleTime: 5 * 60_000,
  });
}

/** Role dashboard — the endpoint branches on the session role server-side. */
export function useOverview<T>(): UseQueryResult<T> {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => apiGet<T>("/api/overview"),
    refetchInterval: 30_000,
  });
}

export function useLandlordOverview(): UseQueryResult<LandlordOverviewDto> {
  return useOverview<LandlordOverviewDto>();
}

export function useCaretakerOverview(): UseQueryResult<CaretakerOverviewDto> {
  return useOverview<CaretakerOverviewDto>();
}

export function useTenantOverview(): UseQueryResult<TenantOverviewDto> {
  return useOverview<TenantOverviewDto>();
}

export function useAgentOverview(): UseQueryResult<AgentOverviewDto> {
  return useOverview<AgentOverviewDto>();
}

export function useGuardOverview(): UseQueryResult<GuardOverviewDto> {
  return useOverview<GuardOverviewDto>();
}

/**
 * Landlord analytics (Phase 5 wedge A): the Analytics tab's own payload —
 * GET /api/analytics is LANDLORD-only, so the query only runs on the
 * landlord shell (403 for anyone else would flip this to error). Key is
 * separate from ["overview"]: charts invalidate independently, payments
 * mutations don't recompute trends on every keystroke.
 */
export function useLandlordAnalytics(): UseQueryResult<LandlordAnalyticsDto> {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiGet<LandlordAnalyticsDto>("/api/analytics"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * KRA/MRI tax assistant (Phase 5 wedge B): one payload per TAX YEAR — the
 * year is part of the query key so switching years refetches instead of
 * serving the cached year. LANDLORD-only endpoint (landlord shell only).
 */
export function useKraSummary(year: number): UseQueryResult<KraSummaryDto> {
  return useQuery({
    queryKey: ["kra", year],
    queryFn: () => apiGet<KraSummaryDto>(`/api/kra/summary?year=${year}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Tenant statement (Phase 6-a, issue #65): the month-by-month portable
 * payment record. TENANT call is parameterless (server resolves the tenancy);
 * staff callers pass the tenancy id. Keyed separately from ["overview"] so
 * payment mutations don't thrash the statement refetch.
 */
export function useStatement(tenancyId?: string): UseQueryResult<StatementDto> {
  return useQuery({
    queryKey: ["statement", tenancyId ?? "mine"],
    queryFn: () =>
      apiGet<StatementDto>(tenancyId ? `/api/statements?tenancyId=${encodeURIComponent(tenancyId)}` : "/api/statements"),
    staleTime: 30_000,
  });
}

/**
 * Rent Score (Phase 6-b, issue #66): the signed-in tenant's own score card
 * payload. Tenant shell only — a 403 for other roles would flip this to
 * error, so the query is enabled just for TENANT.
 */
export function useRentScore(enabled: boolean): UseQueryResult<RentScoreDto> {
  return useQuery({
    queryKey: ["rent-score", "mine"],
    queryFn: () => apiGet<RentScoreDto>("/api/rent-score"),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/** One row of the staff score list (GET /api/rent-score/list). */
export interface RentScoreListRow {
  tenancyId: string;
  tenantName: string;
  score: number;
  band: RentScoreBand;
}

/**
 * Staff arrears-view score list (Phase 6-b): every ACTIVE tenancy in the
 * caller's scope with {tenancyId, score, band}. LANDLORD/CARETAKER only.
 */
export function useRentScoreList(enabled: boolean): UseQueryResult<RentScoreListRow[]> {
  return useQuery({
    queryKey: ["rent-score", "list"],
    queryFn: () => apiGet<RentScoreListRow[]>("/api/rent-score/list"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Scoped ACTIVE-tenancy picker rows (GET /api/tenancies — real wire shape). */
export interface TenancyPickerRow {
  id: string;
  tenantName: string;
  tenantPhone: string;
  unitLabel: string;
  propertyName: string;
  accountRef: string;
  monthlyRentMinor: number;
  balanceMinor: number;
}

/**
 * Offline field fallback (D-012): derive picker rows from the cached role
 * overview — the overview is always loaded before any money flow opens, so
 * the caretaker who walks into a dead-signal basement still gets a picker.
 */
function overviewTenancyRows(): TenancyPickerRow[] | undefined {
  if (typeof window === "undefined") return undefined;
  const cache = getQueryClient();
  const overview = cache.getQueryData<
    LandlordOverviewDto | CaretakerOverviewDto | TenantOverviewDto | AgentOverviewDto | GuardOverviewDto
  >(["overview"]);
  if (!overview) return undefined;
  const rows: TenancyPickerRow[] = [];
  if ("units" in overview) {
    for (const unit of overview.units) {
      if (!unit.tenancy) continue;
      rows.push({
        id: unit.tenancy.id,
        tenantName: unit.tenancy.tenantName,
        tenantPhone: unit.tenancy.tenantPhone,
        unitLabel: unit.label,
        propertyName: unit.propertyName,
        accountRef: unit.tenancy.accountRef,
        monthlyRentMinor: unit.tenancy.monthlyRentMinor,
        balanceMinor: unit.tenancy.balanceMinor,
      });
    }
  }
  return rows.length > 0 ? rows : undefined;
}

/** Tenancy picker list for match / cash / STK flows (lazy — modal-scoped). */
export function useTenancies(enabled = true): UseQueryResult<TenancyPickerRow[]> {
  return useQuery({
    queryKey: ["tenancies"],
    queryFn: () => apiGet<TenancyPickerRow[]>("/api/tenancies"),
    enabled,
    staleTime: 60_000,
    retry: false,
    placeholderData: () => overviewTenancyRows(),
  });
}

/** Unmatched payment queue (S-04) — landlord/agent/caretaker. */
export function useUnmatched(enabled = true): UseQueryResult<PaymentDto[]> {
  return useQuery({
    queryKey: ["unmatched"],
    queryFn: () => apiGet<PaymentDto[]>("/api/payments/unmatched"),
    enabled,
    staleTime: 30_000,
  });
}

/** Scoped receipts (S-10) — lazy, used by the receipt-detail modal. */
export function useReceipts(enabled = true): UseQueryResult<ReceiptDto[]> {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: () => apiGet<ReceiptDto[]>("/api/receipts"),
    enabled,
    staleTime: 30_000,
  });
}

/** Own notifications (S-14) — lazy, used by the bell modal. */
export function useNotifications(enabled = true): UseQueryResult<NotificationDto[]> {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationDto[]>("/api/notifications"),
    enabled,
    staleTime: 30_000,
  });
}

/** Phase 7: own unread count — the cheap bell-badge poll (30s, all roles). */
export function useUnreadCount(enabled = true): UseQueryResult<number> {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      apiGet<import("@/lib/types").NotificationUnreadCountDto>("/api/notifications/unread-count").then(
        (dto) => dto.unread,
      ),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

/**
 * Phase 7: mark own notifications read. Optimistically zeroes the badge, then
 * invalidates both caches so the list refetches with fresh readAt values.
 */
export function useMarkNotificationsRead(): UseMutationResult<number, Error, { ids?: string[]; all?: boolean }> {
  const queryClient = getQueryClient();
  return useMutation({
    mutationFn: (vars: { ids?: string[]; all?: boolean }) =>
      apiPost<import("@/lib/types").NotificationUnreadCountDto>("/api/notifications/read", vars).then(
        (dto) => dto.unread,
      ),
    onSuccess: (unread) => {
      queryClient.setQueryData(["notifications", "unread-count"], unread);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Tenant home carries notifications inside the overview cache too.
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

/** Demo identities for the login screen (S-01). */
export function useProfiles(enabled = true): UseQueryResult<import("@/lib/types").ProfileDto[]> {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiGet<import("@/lib/types").ProfileDto[]>("/api/auth/profiles"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** M-Pesa STK status (GET /api/mpesa/status?checkoutRequestId=…) — poll shape. */
export type { MpesaStatusDto };

export function fetchMpesaStatus(checkoutRequestId: string): Promise<MpesaStatusDto> {
  return apiGet<MpesaStatusDto>(
    `/api/mpesa/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`,
  );
}
