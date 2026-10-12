"use client";

/**
 * Security digest card (Phase 3, issue #37) — the landlord/caretaker home's
 * eyes-on-the-ground summary, fed by overview.security (SecurityDigestDto).
 *
 * The whole card is one tap into the Security tab. Landing logic: unseen
 * incident reports open the Incidents segment directly (the urgent thing
 * first); otherwise Visitors (the daily pulse). When a HIGH/CRITICAL report
 * is unseen, the rose flag line replaces the amber unseen line.
 */

import { ChevronRight, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { SecurityDigestDto } from "@/lib/types";
import { useUIStore } from "@/lib/ui-store";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SecurityCard({ security }: { security: SecurityDigestDto }) {
  const { t } = useI18n();
  const setTab = useUIStore((s) => s.setTab);
  const setSecuritySegment = useUIStore((s) => s.setSecuritySegment);

  const unacked = security.unacknowledgedIncidents;
  const highUnacked = security.highSeverityUnacked;

  function openSecurity() {
    // Unseen reports jump straight to the incident queue; otherwise the
    // visitors register is the daily default.
    setSecuritySegment(unacked > 0 ? "incidents" : "visitors");
    setTab("security");
  }

  return (
    <button
      type="button"
      onClick={openSecurity}
      aria-label={`${t("security.cardTitle")} — ${t("security.visitorsToday", {
        count: security.visitorsToday,
      })}`}
      className="w-full text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground shrink-0" aria-hidden />
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t("security.cardTitle")}
            </p>
            <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" aria-hidden />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            <p className="text-body tabular-nums">
              {t("security.visitorsToday", { count: security.visitorsToday })}
            </p>
            <p className="text-body tabular-nums">
              {t("security.onSiteNow", { count: security.onSiteNow })}
            </p>
            {highUnacked > 0 ? (
              // Phase 18 (D-031): soft badge treatment — bare red text
              // clashed with the warm canvas (the palette stays cream +
              // green; urgency reads through the tinted chip, not raw red).
              <p className="sm:col-span-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 dark:bg-destructive/20 text-destructive px-2.5 py-0.5 text-label font-semibold">
                  {t("security.highSeverityFlag", { count: highUnacked })}
                </span>
              </p>
            ) : (
              <p
                className={cn(
                  "text-body sm:col-span-2",
                  unacked > 0 ? "font-semibold text-attention" : "text-muted-foreground",
                )}
              >
                {t("security.unacknowledged", { count: unacked })}
              </p>
            )}
          </div>

          <p className="text-caption text-muted-foreground flex items-center gap-1.5 min-w-0">
            {security.onDutyGuardName ? (
              <>
                <span className="size-1.5 rounded-full bg-success animate-pulse shrink-0" aria-hidden />
                <span className="truncate">
                  {t("security.onDutyGuard", { name: security.onDutyGuardName })}
                </span>
              </>
            ) : (
              t("security.noGuardOnDuty")
            )}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
