"use client";

/**
 * NEST — client providers: TanStack Query (HMR-stable client) + the Sonner
 * toaster positioned per design-system §9.4 (bottom-center above the tab bar
 * on mobile, bottom-right on desktop).
 *
 * Also owns service-worker lifecycle (D-017): /sw.js is registered ONLY in
 * production builds. Dev NEVER registers — Turbopack HMR plus a caching
 * worker would serve stale chunks and break the dev loop — and any leftover
 * registration from an accidental production-mode visit is unregistered.
 */

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // D-014: data is fresh for 30s; refetch on window focus.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function NestToaster() {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  return (
    <Toaster
      position={isDesktop ? "bottom-right" : "bottom-center"}
      offset={isDesktop ? 24 : 80}
      duration={4000}
      toastOptions={{
        classNames: {
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-attention",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(getQueryClient);

  // D-017 — service-worker lifecycle. Production builds register /sw.js
  // (offline shell support; money data is never cached by it). Dev never
  // registers (HMR would fight the cache) and actively unregisters any
  // worker left behind from an accidental production-mode visit, so the
  // dev loop stays clean.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is best-effort — never block the app on it */
      });
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {
          /* best-effort cleanup only */
        });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NestToaster />
    </QueryClientProvider>
  );
}
