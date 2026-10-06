/**
 * NEST — GET/POST /api/tickets  (Task P2-a, issue #21)
 *
 * GET — role-scoped TicketDto[] via ticketScopeWhere (Phase 2 matrix):
 *   TENANT              → tickets on their own tenancies (history stays visible),
 *   LANDLORD/CARETAKER/
 *   AGENT               → tickets across their property chain (AGENT read-only),
 *   GUARD               → 403 (requireRole never admits GUARD here).
 * Ordering: status priority first (OPEN → IN_PROGRESS → RESOLVED → CLOSED),
 * then createdAt desc (newest first within a status). SQLite cannot express
 * the status ranking in ORDER BY, so the rank sort runs in JS — Array#sort is
 * stable, which preserves the DB's createdAt-desc order inside each bucket.
 *
 * POST — create a maintenance ticket. Creation stays with the people on the
 * ground this round: TENANT + CARETAKER only (LANDLORD/AGENT/GUARD → 403;
 * the landlord verifies and closes, they do not file repairs).
 *   TENANT     — unitId from the client is IGNORED: the unit is derived from
 *                the caller's own ACTIVE tenancy (none → 404 "no active
 *                tenancy"); tenancyId is that tenancy.
 *   CARETAKER  — unitId REQUIRED (400 when missing) and must sit on a property
 *                they tend (scope-checked in the same query, miss → 404);
 *                tenancyId = the unit's ACTIVE tenancy, or null for a
 *                common-area/vacant-unit ticket.
 * New rows start OPEN with the caller as reportedBy. The ticket row itself
 * carries the description — NO initial TicketUpdate row is written; updates
 * are follow-ups only.
 *
 * Side effects (never fatal): TICKET_CREATED audit + IN_APP notifications —
 * TENANT reporter → property caretaker + landlord; CARETAKER reporter →
 * landlord only. Notification/audit failures must not break the route
 * (queueNotification/audit already swallow their own errors).
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { audit } from "@/lib/audit"
import {
  handleRouteError,
  notFound,
  ok,
  parseJsonBody,
  requireRole,
  ticketScopeWhere,
  validationError,
} from "@/lib/auth-guard"
import { ticketInclude, toTicketDto } from "@/lib/dto"
import { queueNotification } from "@/lib/notify"
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** List ordering: OPEN first … CLOSED last (matrix-lifecycle priority). */
const STATUS_RANK: Record<string, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  RESOLVED: 2,
  CLOSED: 3,
}

/** Human words for notification bodies (seed convention: "Normal priority"). */
const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
}

const createTicketSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  priority: z.enum(TICKET_PRIORITIES).default("NORMAL"),
  unitId: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const profile = await requireRole("TENANT", "LANDLORD", "CARETAKER", "AGENT")

    const tickets = await db.maintenanceTicket.findMany({
      where: ticketScopeWhere(profile),
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
    })

    // Stable sort → status buckets keep their createdAt-desc internal order.
    tickets.sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))

    return ok(tickets.map(toTicketDto))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireRole("TENANT", "CARETAKER")
    const body = await parseJsonBody(request, createTicketSchema)

    // Resolve {unit, property, tenancy} for the new row — always from the
    // DB against the caller's own scope, never from client-sent ids alone.
    let unitId: string
    let propertyId: string
    let tenancyId: string | null
    let unitLabel: string
    let propertyName: string
    let landlordId: string | null
    let caretakerId: string | null

    if (profile.role === "TENANT") {
      // unitId is IGNORED — the unit comes from the caller's ACTIVE tenancy.
      const tenancy = await db.tenancy.findFirst({
        where: { tenantId: profile.id, status: "ACTIVE" },
        include: { unit: { include: { property: true } } },
        orderBy: { createdAt: "desc" },
      })
      if (!tenancy) throw notFound("No active tenancy found for this account")

      unitId = tenancy.unitId
      propertyId = tenancy.unit.propertyId
      tenancyId = tenancy.id
      unitLabel = tenancy.unit.label
      propertyName = tenancy.unit.property.name
      landlordId = tenancy.unit.property.landlordId
      caretakerId = tenancy.unit.property.caretakerId
    } else {
      // CARETAKER — a unit picker is mandatory (common areas have no tenancy).
      if (!body.unitId) {
        throw validationError({ unitId: "unitId is required for caretakers" }, "unitId is required")
      }

      // Fetch WITH the scope condition — a unit on someone else's property is
      // a 404, never a 403 (existence must not leak, matrix §1).
      const unit = await db.unit.findFirst({
        where: { id: body.unitId, property: { caretakerId: profile.id } },
        include: { property: true, tenancies: { where: { status: "ACTIVE" } } },
      })
      if (!unit) throw notFound("Unit not found")

      unitId = unit.id
      propertyId = unit.propertyId
      tenancyId = unit.tenancies[0]?.id ?? null
      unitLabel = unit.label
      propertyName = unit.property.name
      landlordId = unit.property.landlordId
      caretakerId = unit.property.caretakerId
    }

    const ticket = await db.maintenanceTicket.create({
      data: {
        propertyId,
        unitId,
        tenancyId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: "OPEN",
        reportedById: profile.id,
      },
    })

    await audit(profile.id, "TICKET_CREATED", "MaintenanceTicket", ticket.id, {
      title: ticket.title,
      unitId: ticket.unitId,
      priority: ticket.priority,
    })

    // IN_APP notifications — the people who must act on a new repair.
    // queueNotification never throws, so this can never break the route.
    const notifyBody =
      `NEST: ${profile.fullName} reported a repair in unit ${unitLabel} ` +
      `(${propertyName}): "${ticket.title}" (${PRIORITY_LABEL[body.priority]} priority).`

    if (profile.role === "TENANT") {
      // Tenant reports → the caretaker and the landlord both hear about it.
      if (caretakerId && caretakerId !== profile.id) {
        await queueNotification(caretakerId, "IN_APP", "TICKET_CREATED", notifyBody)
      }
      if (landlordId && landlordId !== profile.id) {
        await queueNotification(landlordId, "IN_APP", "TICKET_CREATED", notifyBody)
      }
    } else if (landlordId && landlordId !== profile.id) {
      // Caretaker reports → only the landlord is notified.
      await queueNotification(landlordId, "IN_APP", "TICKET_CREATED", notifyBody)
    }

    const created = await db.maintenanceTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: ticketInclude,
    })
    return ok(toTicketDto(created))
  } catch (error) {
    return handleRouteError(error)
  }
}
