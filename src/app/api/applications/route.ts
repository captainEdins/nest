/**
 * NEST — GET /api/applications  (Task P4-b, issue #46)
 *
 * The agent's applicant pipeline across their whole portfolio (and the
 * landlord's view across theirs). AGENT + LANDLORD only (matrix §4.2 —
 * CARETAKER/TENANT/GUARD get a real 403 via requireRole; the funnel is
 * marketing data, not operations).
 *
 * Role-scoped via applicationScopeWhere, newest applicants first, take 100.
 * Optional ?status= filter validated against APPLICATION_STATUSES (anything
 * else is a 400 VALIDATION, never a silently-ignored value) — the landlord's
 * pending-decisions card will consume ?status=NEW/CONTACTED/VIEWING.
 *
 * Returns ApiOk<ListingApplicationDto[]>.
 */

import { z } from "zod"
import { db } from "@/lib/db"
import { handleRouteError, ok, parseSearchParams, requireRole, applicationScopeWhere } from "@/lib/auth-guard"
import { applicationInclude, toApplicationDto } from "@/lib/dto"
import { APPLICATION_STATUSES } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const listQuerySchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
})

export async function GET(request: Request) {
  try {
    const profile = await requireRole("AGENT", "LANDLORD")
    const { status } = parseSearchParams(request, listQuerySchema)

    const rows = await db.listingApplication.findMany({
      where: { ...applicationScopeWhere(profile), ...(status ? { status } : {}) },
      include: applicationInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return ok(rows.map(toApplicationDto))
  } catch (error) {
    return handleRouteError(error)
  }
}
