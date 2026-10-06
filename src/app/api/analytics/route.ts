/**
 * NEST — GET /api/analytics  (Phase 5 wedge A, issue #57)
 *
 * The landlord's Analytics screen payload: 6-month collection trend,
 * arrears-aging buckets and per-property occupancy — one call, one
 * LandlordAnalyticsDto (money definitions live in src/lib/analytics.ts).
 *
 * LANDLORD only: every other role gets a real 403 via requireRole (the role
 * is re-derived from the DB session, never trusted from the client); no
 * session → 401 via requireProfile. Read-only by contract — this route
 * NEVER writes, so it records no AuditLog rows (analytics is observation,
 * not a money event).
 */

import { getLandlordAnalytics } from "@/lib/analytics"
import { handleRouteError, ok, requireRole } from "@/lib/auth-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireRole("LANDLORD")
    return ok(await getLandlordAnalytics(profile))
  } catch (error) {
    return handleRouteError(error)
  }
}
