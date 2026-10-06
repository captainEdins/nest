/**
 * NEST — POST /api/tickets/[id]/updates  (Task P2-a, issue #21)
 *
 * Append one timeline entry to a maintenance ticket — a pure note, or a note
 * plus a status transition. LANDLORD + CARETAKER only this round (the tenant
 * timeline is read-only; the landlord verifies, the caretaker fixes).
 *
 * The ticket is fetched WITH the caller's scope condition in the same query
 * (miss → 404 — existence must not leak, matrix §1).
 *
 * Status state machine (any violation → 409 CONFLICT with the allowed path):
 *   OPEN        → IN_PROGRESS   caretaker or landlord
 *   IN_PROGRESS → RESOLVED      caretaker or landlord (sets resolvedAt = now)
 *   RESOLVED    → CLOSED        LANDLORD only (the verification step)
 *   RESOLVED    → IN_PROGRESS   caretaker or landlord (reopen — clears resolvedAt)
 *   CLOSED      → anything      NEVER — the record is final; file a new ticket
 *   statusTo == current status  → 409 "already in that status"
 * Pure notes (no statusTo) are allowed on any non-CLOSED ticket; CLOSED
 * tickets take no notes (409).
 *
 * Writes run in ONE transaction: the TicketUpdate row {authorId, note,
 * statusFrom, statusTo} + (when transitioning) the MaintenanceTicket
 * {status, updatedAt, resolvedAt}. Side effects are never fatal:
 * TICKET_UPDATED audit + an IN_APP notification to the reporter when the
 * author is someone else (self-notifications are skipped).
 *
 * Body: AddTicketUpdateRequest { note: 1..2000, statusTo? }
 * Returns ApiOk<TicketDto> re-fetched with ticketInclude.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  conflict,
  forbidden,
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
  ticketScopeWhere,
} from "@/lib/auth-guard"
import { ticketInclude, toTicketDto } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import { TICKET_STATUSES, type TicketStatus } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Plain-English status words for notification bodies. */
const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

const LIFECYCLE_MESSAGE =
  "Allowed path: OPEN → IN_PROGRESS → RESOLVED → CLOSED; a RESOLVED ticket " +
  "may reopen to IN_PROGRESS; CLOSED is final (create a new ticket instead)."

const updateSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  statusTo: z.enum(TICKET_STATUSES).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Timeline writes: LANDLORD + CARETAKER only (tenant timeline is
    // read-only this round; GUARD/AGENT/TENANT → 403).
    const profile = await requireRole("LANDLORD", "CARETAKER")
    const { id } = await params
    const body = await parseJsonBody(request, updateSchema)

    const ticket = await db.maintenanceTicket.findFirst({
      where: { id, ...ticketScopeWhere(profile) },
      include: ticketInclude,
    })
    if (!ticket) throw notFound("Ticket not found")

    const from = ticket.status as TicketStatus
    const to = body.statusTo // undefined ⇒ pure note

    // CLOSED is final — no transitions, no notes; a new ticket is the path.
    if (from === "CLOSED") {
      throw conflict("This ticket is CLOSED — the record is final. Create a new ticket instead.")
    }

    if (to === from) {
      throw conflict(`Ticket is already in status ${from}.`)
    }

    let resolvedAtPatch: { resolvedAt: Date | null } | undefined
    if (to !== undefined) {
      if (from === "OPEN" && to === "IN_PROGRESS") {
        // Work starts — resolvedAt stays null.
      } else if (from === "IN_PROGRESS" && to === "RESOLVED") {
        resolvedAtPatch = { resolvedAt: new Date() }
      } else if (from === "RESOLVED" && to === "CLOSED") {
        // The verification step — landlord only (caretaker 403).
        if (profile.role !== "LANDLORD") {
          throw forbidden("Only the landlord can verify and close a resolved ticket")
        }
        // resolvedAt keeps recording WHEN it was resolved.
      } else if (from === "RESOLVED" && to === "IN_PROGRESS") {
        // Reopen — the fix did not hold; clear the resolution timestamp.
        resolvedAtPatch = { resolvedAt: null }
      } else {
        throw conflict(`Invalid status transition ${from} → ${to}. ${LIFECYCLE_MESSAGE}`)
      }
    }

    const statusFrom = to === undefined ? null : from
    const statusTo = to ?? null

    const now = new Date()
    await db.$transaction(async (tx) => {
      await tx.ticketUpdate.create({
        data: {
          ticketId: ticket.id,
          authorId: profile.id,
          note: body.note,
          statusFrom,
          statusTo,
        },
      })
      if (to !== undefined) {
        await tx.maintenanceTicket.update({
          where: { id: ticket.id },
          data: { status: to, updatedAt: now, ...(resolvedAtPatch ?? {}) },
        })
      }
    })

    await audit(profile.id, "TICKET_UPDATED", "MaintenanceTicket", ticket.id, {
      statusFrom,
      statusTo,
      note: body.note,
    })

    // The reporter hears about progress they did not author themselves.
    // queueNotification never throws, so this can never break the route.
    if (ticket.reportedById !== profile.id) {
      const notifyBody =
        to === undefined
          ? `NEST: ${profile.fullName} added a note on your repair "${ticket.title}": "${body.note}"`
          : `NEST: Your repair "${ticket.title}" (unit ${ticket.unit.label}) is now ` +
            `${STATUS_LABEL[to]}. ${profile.fullName}: "${body.note}"`
      await queueNotification(ticket.reportedById, "IN_APP", "TICKET_UPDATED", notifyBody)
    }

    const updated = await db.maintenanceTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: ticketInclude,
    })
    return ok(toTicketDto(updated))
  } catch (error) {
    return handleRouteError(error)
  }
}
