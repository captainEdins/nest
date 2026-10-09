"use client";

/**
 * NEST — /api/search hook (Phase 10, issue #76).
 *
 * Debounced (350ms) role-scoped record lookup for the ⌘K palette.
 * Queries shorter than 2 chars never reach the network (the API would 400).
 * Results are cached per query for 60s — the palette reopens instantly for
 * repeat searches within a session; `placeholderData: keepPreviousData`
 * keeps rows on screen while a refined query resolves (no flash of empty).
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { SearchResultDto } from "@/lib/types";

export function useSearch(query: string) {
  const trimmed = query.trim();
  const enabled = trimmed.length >= 2;

  return useQuery<SearchResultDto[]>({
    queryKey: ["search", trimmed.toLowerCase()],
    queryFn: () => apiGet<SearchResultDto[]>(`/api/search?q=${encodeURIComponent(trimmed)}`),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
