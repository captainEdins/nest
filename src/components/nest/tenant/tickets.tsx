"use client";

/**
 * S-24 · Tenant repairs tab (Phase 2, issue #23).
 *
 * Own reports list ("Your repair reports") + the prominent Report-an-issue
 * entry point (opens the shared sheet — unit derived server-side). Status
 * filter chips with live counts; list rendered in the API's status-first
 * order. Tap a card → pushed ticket detail.
 */

import * as React from "react";
import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { useTickets } from "@/hooks/use-tickets";
import {
  TicketRow,
  TicketStatusFilterChips,
  type TicketStatusFilter,
} from "@/components/nest/shared/ticket-detail";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function TenantTickets() {
  const { t } = useI18n();
  const setReportIssueOpen = useUIStore((s) => s.setReportIssueOpen);
  const { data: tickets, isPending, error, refetch } = useTickets();
  const [filter, setFilter] = React.useState<TicketStatusFilter>("ALL");

  const filtered =
    tickets == null ? [] : filter === "ALL" ? tickets : tickets.filter((tk) => tk.status === filter);

  return (
    <section aria-label={t("repairs.title")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("repairs.yourReports")}</h1>
        {tickets != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {t("repairs.ticketsCount", { count: filtered.length })}
          </span>
        ) : null}
      </div>

      {/* Report an issue — ≤3 taps from the tab */}
      <Button className="w-full h-12 text-body-lg" onClick={() => setReportIssueOpen(true)}>
        <Wrench aria-hidden />
        {t("repairs.reportIssue")}
      </Button>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("repairs.loadError")} />
      ) : (
        <>
          {/* Chips render even while pending (counts arrive with data) — no layout shift. */}
          <TicketStatusFilterChips value={filter} onChange={setFilter} tickets={tickets} />

          {isPending ? (
            <ListSkeleton rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={t("repairs.empty")}
              hint={filter === "ALL" ? t("repairs.emptyDesc") : undefined}
              actionLabel={filter === "ALL" ? t("repairs.reportIssue") : undefined}
              onAction={filter === "ALL" ? () => setReportIssueOpen(true) : undefined}
            />
          ) : (
            <Card className="divide-y">
              {filtered.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
