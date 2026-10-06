"use client";

/**
 * NEST — typed query hooks (one API call per role home, D-014: refetch on
 * focus + 30s). The ["overview"] key is shared by every screen of the signed-in
 * role — all tabs read the cached payload instead of re-fetching.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiGet, apiGetSession, type MpesaStatusDto } from "@/lib/api";
import { getQueryClient } from "@/components/nest/providers";
import type {
  AgentOverviewDto,
  CaretakerOverviewDto,
  GuardOverviewDto,
  LandlordOverviewDto,
  NotificationDto,
  PaymentDto,
  ReceiptDto,
  SessionDto,
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
