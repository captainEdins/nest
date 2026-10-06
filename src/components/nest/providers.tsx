"use client";

/**
 * NEST — client providers: TanStack Query (HMR-stable client) + the Sonner
 * toaster positioned per design-system §9.4 (bottom-center above the tab bar
 * on mobile, bottom-right on desktop).
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

function getQueryClient(): QueryClient {
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <NestToaster />
    </QueryClientProvider>
  );
}
