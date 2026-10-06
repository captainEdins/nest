"use client";

/**
 * S-34a · Start-shift sheet (Phase 3, issue #36).
 *
 * Bottom sheet to go on duty at one of the guard's worked properties
 * (overview `properties`). One property → a single big confirm button
 * (1 tap); several → a picker list.
 *
 * POST /api/shifts — the server rejects properties without shift history
 * (403, first-shift bootstrap is a landlord-side invite) and double starts
 * (409 "already on duty"); both arrive as human-readable toasts.
 */

import * as React from "react";
import { Building2, CheckCircle2, Loader2, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useGuardOverview } from "@/hooks/use-overview";
import { useStartShift } from "@/hooks/use-guard";
import { useOnline } from "@/components/nest/offline-banner";
import { ResponsiveModal } from "@/components/nest/shared/responsive-modal";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartShiftSheet() {
  const { t } = useI18n();
  const online = useOnline();
  const open = useUIStore((s) => s.startShiftOpen);
  const setOpen = useUIStore((s) => s.setStartShiftOpen);
  const { data: overview } = useGuardOverview();
  const startShift = useStartShift();

  const properties = overview?.properties ?? [];

  function start(propertyId: string) {
    if (startShift.isPending || !online) return;
    startShift.mutate(
      { propertyId },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t("guard.startShiftTitle")}
      description={t("guard.startShiftDesc")}
    >
      <div className="space-y-3">
        {properties.length === 1 ? (
          /* One property — 1 tap to go on duty. */
          <Button
            className="w-full h-14 text-body-lg"
            disabled={startShift.isPending || !online}
            aria-busy={startShift.isPending}
            onClick={() => start(properties[0]!.id)}
          >
            {startShift.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Play aria-hidden />
            )}
            {startShift.isPending
              ? t("guard.startingShift")
              : t("guard.startShiftAt", { property: properties[0]!.name })}
          </Button>
        ) : properties.length > 1 ? (
          <>
            <p className="text-label font-medium">{t("guard.chooseProperty")}</p>
            <div className="max-h-[52dvh] overflow-y-auto pr-1 space-y-2">
              {properties.map((property) => {
                const busy =
                  startShift.isPending && startShift.variables?.propertyId === property.id;
                return (
                  <Button
                    key={property.id}
                    variant="outline"
                    className="w-full h-14 justify-start text-body font-medium"
                    disabled={startShift.isPending || !online}
                    aria-busy={busy}
                    onClick={() => start(property.id)}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Building2 aria-hidden />
                    )}
                    <span className="truncate">{property.name}</span>
                    <CheckCircle2
                      className={cn(
                        "size-4 ml-auto shrink-0",
                        busy ? "text-primary" : "text-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                  </Button>
                );
              })}
            </div>
          </>
        ) : (
          /* No worked properties yet — the landlord-side invite is the bootstrap. */
          <EmptyState icon={Building2} title={t("guard.noShiftsYet")} />
        )}

        {!online ? (
          <p className="text-caption text-muted-foreground text-center">
            {t("errors.needOnline")}
          </p>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
