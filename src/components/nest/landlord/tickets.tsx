"use client";

/**
 * S-26 · Landlord repairs tab (Phase 2, issue #23).
 *
 * All-properties queue — the landlord verifies and closes (or reopens);
 * ticket creation stays with tenants and caretakers, so there is no report
 * button here. Cards carry the property context; status chips match the
 * other roles; list renders in the API's status-first order.
 */

import * as React from "react";
import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/hooks/use-tickets";
import {
  TicketRow,
  TicketStatusFilterChips,
  type TicketStatusFilter,
} from "@/components/nest/shared/ticket-detail";
import { EmptyState } from "@/components/nest/shared/empty-state";
import { ErrorState } from "@/components/nest/shared/error-state";
import { ListSkeleton } from "@/components/nest/shared/skeletons";
import { Card } from "@/components/ui/card";

export function LandlordTickets() {
  const { t } = useI18n();
  const { data: tickets, isPending, error, refetch } = useTickets();
  const [filter, setFilter] = React.useState<TicketStatusFilter>("ALL");

  const filtered =
    tickets == null ? [] : filter === "ALL" ? tickets : tickets.filter((tk) => tk.status === filter);

  return (
    <section aria-label={t("repairs.title")} className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-h2 font-semibold">{t("repairs.queue")}</h1>
        {tickets != null ? (
          <span className="text-caption text-muted-foreground tabular-nums shrink-0">
            {t("repairs.ticketsCount", { count: filtered.length })}
          </span>
        ) : null}
      </div>

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
            />
          ) : (
            <Card className="divide-y">
              {filtered.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} showReporter showProperty />
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
