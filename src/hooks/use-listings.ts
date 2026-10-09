"use client";

/**
 * NEST — listings & applications query + mutation hooks (Phase 4, issue #47).
 *
 * Wire contract (P4-b, PR #52): GET/POST /api/listings, GET /api/listings/[id],
 * POST /api/listings/[id]/publish + /pause, GET/POST /api/listings/[id]/applications,
 * GET /api/applications, GET /api/applications/[id] (added in P4-c — same
 * scope-fetch + applicationInclude shape), POST /api/applications/[id]/status.
 *
 * Lists arrive newest-first (listings: newest-updated; applications: newest
 * created; a listing's applicants: newest first; timelines: OLDEST first) —
 * screens render the delivered order verbatim and never re-sort.
 *
 * The role fence is server-side (agent pipeline moves vs landlord decisions);
 * the UI stays role-aware but the 403/409 messages surface verbatim as the
 * toast body (server messages are English-only by design).
 *
 * Keys: ["listings"] (list) · ["listing", id] (detail) · ["applications"]
 * (list) · ["applications", id] (detail — prefix-shares the list key so the
 * single invalidation covers both). ["overview"] carries the agent funnel
 * totals, so every mutation refreshes it too.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  ApplicationStatus,
  CreateListingRequest,
  ListingApplicationDto,
  ListingDetailDto,
  ListingDto,
  MoveInRequest,
  MoveInResultDto,
  RecordApplicationRequest,
} from "@/lib/types";

/** Server error message wins (English-only by contract); fallback is generic. */
function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.error ? error.error : fallback;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** Role-scoped listings, newest-updated first. */
export function useListings(): UseQueryResult<ListingDto[]> {
  return useQuery({
    queryKey: ["listings"],
    queryFn: () => apiGet<ListingDto[]>("/api/listings"),
    staleTime: 30_000,
  });
}

/** Listing detail with the full applicant list (newest first). 404 when out of scope. */
export function useListing(id: string): UseQueryResult<ListingDetailDto> {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: () => apiGet<ListingDetailDto>(`/api/listings/${id}`),
    staleTime: 30_000,
  });
}

/** POST /api/listings — DRAFT on a VACANT unit (409 not-vacant / duplicate live listing). */
export function useCreateListing() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingRequest) => apiPost<ListingDto>("/api/listings", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("agent.listingCreated"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/** POST /api/listings/[id]/publish — DRAFT/PAUSED → PUBLISHED (409 otherwise). */
export function usePublishListing(id: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumed }: { resumed: boolean }) =>
      apiPost<ListingDto>(`/api/listings/${id}/publish`),
    onSuccess: (_updated, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["listing", id] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(variables.resumed ? t("agent.resumedDone") : t("agent.publishedDone"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/** POST /api/listings/[id]/pause — PUBLISHED → PAUSED (409 otherwise). */
export function usePauseListing(id: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<ListingDto>(`/api/listings/${id}/pause`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["listing", id] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("agent.pausedDone"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

// ---------------------------------------------------------------------------
// Applications (the applicant pipeline)
// ---------------------------------------------------------------------------

/** Role-scoped applicant pipeline across the portfolio, newest first. */
export function useApplications(): UseQueryResult<ListingApplicationDto[]> {
  return useQuery({
    queryKey: ["applications"],
    queryFn: () => apiGet<ListingApplicationDto[]>("/api/applications"),
    staleTime: 30_000,
  });
}

/** One application with its append-only timeline (oldest first). 404 when out of scope. */
export function useApplication(id: string): UseQueryResult<ListingApplicationDto> {
  return useQuery({
    queryKey: ["applications", id],
    queryFn: () => apiGet<ListingApplicationDto>(`/api/applications/${id}`),
    staleTime: 30_000,
  });
}

/** POST /api/listings/[id]/applications — agent intake (403 landlord, 409 not published). */
export function useRecordApplication(listingId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordApplicationRequest) =>
      apiPost<ListingApplicationDto>(`/api/listings/${listingId}/applications`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("agent.applicantRecorded"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/**
 * POST /api/applications/[id]/status — the role-fenced funnel. AGENT moves
 * CONTACTED/VIEWING/WITHDRAWN; LANDLORD decides APPROVED/REJECTED (403 the
 * other way). Invalid transitions come back 409 with guidance.
 */
export function useApplicationStatus(id: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, note }: { status: ApplicationStatus; note?: string }) =>
      apiPost<ListingApplicationDto>(`/api/applications/${id}/status`, {
        status,
        ...(note ? { note } : {}),
      }),
    onSuccess: (updated) => {
      // ["applications"] is the prefix of ["applications", id] — one
      // invalidation refreshes both the pipeline list and this detail.
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["listing", updated.listingId] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("agent.statusUpdated"));
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}

/**
 * POST /api/move-ins (Phase 8, issue #72) — the landlord's conversion verb:
 * approved application → active tenancy (deposit held, first charge raised,
 * unit occupied, listing LET). The success toast carries the accountRef —
 * the lease's human-stable reference. Invalidations cover the application
 * timeline, the listing (funnel counts), the landlord overview (vacancy
 * totals flipped) and the session demo profile list is refreshed on next
 * login (the new tenant profile appears automatically).
 */
export function useMoveIn() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MoveInRequest) => apiPost<MoveInResultDto>("/api/move-ins", input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["listing", result.applicationId] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.success(
        t("agent.moveInDone", { ref: result.accountRef, name: result.tenantName }),
      );
    },
    onError: (error) => {
      toast.error(mutationErrorMessage(error, t("errors.somethingWrong")));
    },
  });
}
