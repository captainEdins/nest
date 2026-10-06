"use client";

/**
 * S-24 · Tenant repairs tab (Phase 2 stub — Task P2-c replaces this file).
 *
 * Full screen: own tickets list + "Report an issue" entry point.
 * STUB CONTRACT (do not change the export name):
 *   export function TenantTickets()
 */

import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/nest/shared/empty-state";

export function TenantTickets() {
  const { t } = useI18n();
  return (
    <section aria-label={t("repairs.title")}>
      <EmptyState icon={Wrench} title={t("repairs.empty")} hint={t("repairs.emptyDesc")} />
    </section>
  );
}
