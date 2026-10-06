"use client";

/**
 * S-26 · Landlord repairs tab (Phase 2 stub — Task P2-c replaces this file).
 *
 * Full screen: all-properties queue, close/reopen actions, per-unit context.
 * STUB CONTRACT (do not change the export name):
 *   export function LandlordTickets()
 */

import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/nest/shared/empty-state";

export function LandlordTickets() {
  const { t } = useI18n();
  return (
    <section aria-label={t("repairs.queue")}>
      <EmptyState icon={Wrench} title={t("repairs.emptyQueue")} hint={t("repairs.emptyQueueDesc")} />
    </section>
  );
}
