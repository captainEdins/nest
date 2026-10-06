"use client";

/**
 * S-27 · Ticket detail pushed screen (Phase 2 stub — Task P2-c replaces this file).
 *
 * Full screen: ticket header (title, unit, status, priority), description,
 * full update timeline, and the role-appropriate action bar (caretaker:
 * start/resolve/note; landlord: close/reopen; tenant: read-only).
 * Data: GET /api/tickets/[id] via useQuery(["tickets", id]) — the id comes
 * from the ui-store `ticketViewId` (set by openTicket).
 * STUB CONTRACT (do not change the export name or the props):
 *   export function TicketDetailScreen({ ticketId }: { ticketId: string })
 * The shell renders it with the back button already wired — content only.
 */

export function TicketDetailScreen({ ticketId }: { ticketId: string }) {
  void ticketId; // stub — data fetching lands with Task P2-c
  return null;
}
