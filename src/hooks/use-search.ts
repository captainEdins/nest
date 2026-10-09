"use client";

/**
 * NEST — /api/search hook (Phase 10, issue #76).
 *
 * Genuinely debounced (350ms): keystrokes update `query` instantly in the
 * palette state, but only the SETTLED value reaches TanStack Query — on the
 * flaky rural networks this product designs for, per-keystroke requests are
 * churn, and the route runs up to five Prisma reads per call.
 *
 * Queries shorter than 2 chars never reach the network (the API would 400).
 * Results are cached per lowercased query for 60s (SQLite LIKE is
 * ASCII-case-insensitive, so the case of the query cannot change the rows);
 * `placeholderData: keepPreviousData` keeps rows on screen while a refined
 * query resolves (no flash of empty). Errors surface as `isError` — the
 * palette renders an honest retry state, never "no results" on a dead
 * network.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { SearchResultDto } from "@/lib/types";

const DEBOUNCE_MS = 350;

export function useSearch(query: string) {
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const enabled = debounced.length >= 2;

  return useQuery<SearchResultDto[]>({
    queryKey: ["search", debounced.toLowerCase()],
    queryFn: () => apiGet<SearchResultDto[]>(`/api/search?q=${encodeURIComponent(debounced)}`),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
