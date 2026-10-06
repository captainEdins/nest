"use client";

/**
 * S-25 · Caretaker repair queue tab (Phase 2 stub — Task P2-c replaces this file).
 *
 * Full screen: property queue with status filter chips, start/resolve actions,
 * note composer, unit picker for caretaker-reported issues.
 * STUB CONTRACT (do not change the export name):
 *   export function CaretakerTickets()
 */

import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/nest/shared/empty-state";

export function CaretakerTickets() {
  const { t } = useI18n();
  return (
    <section aria-label={t("repairs.queue")}>
      <EmptyState icon={Wrench} title={t("repairs.emptyQueue")} hint={t("repairs.emptyQueueDesc")} />
    </section>
  );
}
