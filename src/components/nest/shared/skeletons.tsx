"use client";

/** Skeletons matching final layouts (design-system §8) — never full-page spinners. */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </CardContent>
    </Card>
  );
}

export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 p-4 min-h-16">
      <div className="space-y-2 flex-1 min-w-0">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("divide-y", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </Card>
  );
}

export function ChipRowSkeleton({ chips = 4 }: { chips?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden>
      {Array.from({ length: chips }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-32 rounded-lg shrink-0" />
      ))}
    </div>
  );
}

export function FullShellSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col" aria-busy="true">
      <div className="h-14 border-b bg-background" />
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
        <KpiSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
        <ListSkeleton rows={4} />
      </div>
      <div className="h-14 border-t bg-card lg:hidden" />
    </div>
  );
}

export function RoleSelectSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-10 max-w-md mx-auto" aria-busy="true">
      <Skeleton className="size-16 rounded-2xl" />
      <Skeleton className="h-8 w-64 mt-6" />
      <div className="w-full space-y-4 mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-4">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
