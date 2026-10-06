"use client";

/**
 * S-25 · Caretaker repair queue tab (Phase 2, issue #23).
 *
 * Property-wide queue ("Repair queue") — reporter, unit, priority, status on
 * every card. The caretaker can also file a ticket on a tenant's behalf via
 * the shared report sheet (with the unit picker). Status filter chips with
 * live counts; list rendered in the API's status-first order.
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

export function CaretakerTickets() {
  const { t } = useI18n();
  const setReportIssueOpen = useUIStore((s) => s.setReportIssueOpen);
  const { data: tickets, isPending, error, refetch } = useTickets();
  const [filter, setFilter] = React.useState<TicketStatusFilter>("ALL");

  const filtered =
    tickets == null ? [] : filter === "ALL" ? tickets : tickets.filter((tk) => tk.status === filter);

  return (
    <section aria-label={t("repairs.queue")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("repairs.queue")}</h1>
        {tickets != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {t("repairs.ticketsCount", { count: filtered.length })}
          </span>
        ) : null}
      </div>

      {/* File on a tenant's behalf — same sheet, with the unit picker */}
      <Button variant="secondary" className="w-full h-12 text-body-lg" onClick={() => setReportIssueOpen(true)}>
        <Wrench aria-hidden />
        {t("repairs.reportIssue")}
      </Button>

      {error != null ? (
        <ErrorState onRetry={() => refetch()} message={t("repairs.loadError")} />
      ) : (
        <>
          <TicketStatusFilterChips value={filter} onChange={setFilter} tickets={tickets} />

          {isPending ? (
            <ListSkeleton rows={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={t("repairs.emptyQueue")}
              hint={filter === "ALL" ? t("repairs.emptyQueueDesc") : undefined}
              actionLabel={filter === "ALL" ? t("repairs.reportIssue") : undefined}
              onAction={filter === "ALL" ? () => setReportIssueOpen(true) : undefined}
            />
          ) : (
            <Card className="divide-y">
              {filtered.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} showReporter />
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
