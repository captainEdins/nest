/**
 * NEST — GET /api/tickets/[id]  (Task P2-a, issue #21)
 *
 * One scoped TicketDto (ticket + unit/property chain + reporter + the full
 * oldest-first update history). Roles: TENANT / LANDLORD / CARETAKER / AGENT —
 * GUARD is never admitted (Phase 2 matrix; guards have no repair records).
 *
 * The row is fetched WITH the scope condition in the same query — an
 * out-of-scope id is a 404, not a 403, so ticket existence never leaks
 * (matrix §1: scope conditions travel with the fetch, never after it).
 */

import { db } from "@/lib/db"
import { handleRouteError, notFound, ok, requireRole, ticketScopeWhere } from "@/lib/auth-guard"
import { ticketInclude, toTicketDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("TENANT", "LANDLORD", "CARETAKER", "AGENT")
    const { id } = await params

    const ticket = await db.maintenanceTicket.findFirst({
      where: { id, ...ticketScopeWhere(profile) },
      include: ticketInclude,
    })
    if (!ticket) throw notFound("Ticket not found")

    return ok(toTicketDto(ticket))
  } catch (error) {
    return handleRouteError(error)
  }
}
