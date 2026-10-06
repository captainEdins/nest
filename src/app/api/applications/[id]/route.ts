/**
 * NEST — GET /api/applications/[id]  (Task P4-c, issue #47)
 *
 * One application with its append-only event timeline (oldest first — the
 * trust record). AGENT + LANDLORD only (matrix §4.2 — same fence as the list
 * and the status-change route; CARETAKER/TENANT/GUARD get a real 403).
 *
 * The application is fetched WITH the caller's scope condition in the same
 * query (miss → 404 — existence must not leak, matrix §1). Read-only: no
 * audit, no notification — the detail screen for the funnel timeline.
 *
 * Returns ApiOk<ListingApplicationDto>.
 */

import { db } from "@/lib/db"
import { handleRouteError, notFound, ok, requireRole, applicationScopeWhere } from "@/lib/auth-guard"
import { applicationInclude, toApplicationDto } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { id } = await params

    const row = await db.listingApplication.findFirst({
      where: { id, ...applicationScopeWhere(profile) },
      include: applicationInclude,
    })
    if (!row) throw notFound("Application not found")

    return ok(toApplicationDto(row))
  } catch (error) {
    return handleRouteError(error)
  }
}
