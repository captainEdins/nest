"use client";

/**
 * NEST — deposit-ledger query hooks (Task P2-d, issue #24).
 *
 * One hook per deposit surface: the tenant trust view (/api/deposits/mine),
 * the landlord/caretaker settlement review (/api/deposits/[tenancyId]), the
 * unit directory that carries the settlement entry point (/api/units), the
 * LANDLORD-only settlement mutation and the condition-report mutation.
 *
 * Money is integer minor units on every boundary; shillings only inside the
 * modal's input fields (parsed with shillingsToMinor).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/hooks/use-overview";
import type {
  ConditionReportDto,
  CreateConditionReportRequest,
  DepositDto,
  DepositSettlementLine,
  UnitDto,
} from "@/lib/types";

/** Tenant trust view — GET /api/deposits/mine (TENANT only; 404 = no tenancy). */
export function useMyDeposit() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ["deposits", "mine"],
    queryFn: () => apiGet<DepositDto>("/api/deposits/mine"),
    enabled: session?.profile.role === "TENANT",
  });
}

/** Landlord/caretaker settlement review — GET /api/deposits/[tenancyId]. */
export function useDeposit(tenancyId?: string) {
  return useQuery({
    queryKey: ["deposits", tenancyId],
    queryFn: () => apiGet<DepositDto>(`/api/deposits/${tenancyId}`),
    enabled: typeof tenancyId === "string" && tenancyId.length > 0,
  });
}

/**
 * Unit directory for the settlement entry point — GET /api/units
 * (LANDLORD/CARETAKER). Every in-scope unit with its CURRENT tenancy
 * (ACTIVE or NOTICE), so NOTICE rows can offer "Settle deposit".
 */
export function useUnits(enabled = true) {
  return useQuery({
    queryKey: ["units"],
    queryFn: () => apiGet<UnitDto[]>("/api/units"),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * LANDLORD-only settlement — POST /api/deposits/[tenancyId]/settle.
 * On success: seed the fresh payload into the detail cache (the modal flips
 * to its released summary with zero refetch latency), then invalidate every
 * deposit + overview-flavoured query and toast the landlord.
 */
export function useSettleDeposit(tenancyId?: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deductions: DepositSettlementLine[]) => {
      if (tenancyId == null || tenancyId.length === 0) {
        throw new ApiError("No tenancy selected", "VALIDATION", 400);
      }
      return apiPost<DepositDto>(`/api/deposits/${tenancyId}/settle`, { deductions });
    },
    onSuccess: (deposit) => {
      if (tenancyId != null) {
        queryClient.setQueryData(["deposits", tenancyId], deposit);
      }
      void queryClient.invalidateQueries({ queryKey: ["deposits"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success(t("deposit.settleDone"));
    },
  });
}

/** Record a MOVE_IN / MOVE_OUT condition report — POST /api/condition-reports. */
export function useCreateConditionReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConditionReportRequest) =>
      apiPost<ConditionReportDto>("/api/condition-reports", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deposits"] });
    },
  });
}
