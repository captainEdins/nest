"use client";

/**
 * NEST — lease-exit mutation hooks (Phase 11, issue #78).
 *
 * The exit arc state transitions: give/withdraw notice (tenant or landlord)
 * and complete move-out (landlord or caretaker). Each mutation is one API
 * call with a server-guarded transaction behind it; the client only
 * invalidates caches and toasts the outcome. The server is the guard of
 * record — replayed or out-of-order calls surface its 409/400 inline.
 *
 * Invalidations on every success: overview (all role homes change — unit
 * status, notice banner), units directory (NOTICE/VACANT flip), deposits
 * (settle entry appears once a tenancy is NOTICE), notifications (the
 * queueNotification rows), and search (tenancy rows change state).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiDelete, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/components/nest/shared/format";
import type { TenancyLifecycleDto } from "@/lib/types";

/** Queries whose data depends on tenancy/unit lifecycle state. */
function invalidateLifecycle(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["overview"] });
  void queryClient.invalidateQueries({ queryKey: ["units"] });
  void queryClient.invalidateQueries({ queryKey: ["deposits"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  void queryClient.invalidateQueries({ queryKey: ["search"] });
  void queryClient.invalidateQueries({ queryKey: ["tenancies"] });
}

/** Tenant/landlord — POST /api/tenancies/[id]/notice. */
export function useGiveNotice() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { tenancyId: string; moveOutDate: string; reason: string }) =>
      apiPost<TenancyLifecycleDto>(`/api/tenancies/${args.tenancyId}/notice`, {
        moveOutDate: args.moveOutDate,
        reason: args.reason,
      }),
    onSuccess: (data) => {
      invalidateLifecycle(queryClient);
      toast.success(
        t("notice.givenToast", {
          unit: data.unitLabel,
          // A human day, never the raw ISO (design-system: no ISO in UI).
          date: data.moveOutDate ? formatDate(data.moveOutDate) : "—",
        }),
      );
    },
    // Server rule violations (409 replay, past date…) surface inline — the
    // caller renders `error.message` next to the submit button.
  });
}

/** Tenant/landlord — DELETE /api/tenancies/[id]/notice (exit not executed). */
export function useWithdrawNotice() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenancyId: string) =>
      apiDelete<TenancyLifecycleDto>(`/api/tenancies/${tenancyId}/notice`),
    onSuccess: (data) => {
      invalidateLifecycle(queryClient);
      toast.success(t("notice.withdrawnToast", { unit: data.unitLabel }));
    },
  });
}

/** Landlord/caretaker — POST /api/tenancies/[id]/move-out (exit executed). */
export function useCompleteMoveOut() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { tenancyId: string; note?: string }) =>
      apiPost<TenancyLifecycleDto>(`/api/tenancies/${args.tenancyId}/move-out`, {
        note: args.note,
      }),
    onSuccess: (data) => {
      invalidateLifecycle(queryClient);
      toast.success(t("notice.moveOutToast", { unit: data.unitLabel }));
    },
  });
}

/** Guard used inside flows before submit — client-side pre-checks only. */
export function lifecycleErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  return null;
}
