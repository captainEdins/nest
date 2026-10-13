/**
 * NEST — GET /api/analytics  (Phase 5 wedge A, issue #57; Phase 23 issue #109 — agent parity)
 *
 * The staff Analytics screen payload: 6-month collection trend,
 * arrears-aging buckets and per-property occupancy — one call, one
 * LandlordAnalyticsDto (money definitions live in src/lib/analytics.ts).
 *
 * LANDLORD + AGENT (Phase 23, scoped to `agentId = SELF`): every other role
 * gets a real 403 via requireRole (the role is re-derived from the DB
 * session, never trusted from the client); no session → 401 via
 * requireProfile. Read-only by contract — this route NEVER writes, so it
 * records no AuditLog rows (analytics is observation, not a money event).
 */

import { getAgentAnalytics, getLandlordAnalytics } from "@/lib/analytics"
import { handleRouteError, ok, requireRole } from "@/lib/auth-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const profile = await requireRole("LANDLORD", "AGENT")
    const data =
      profile.role === "AGENT" ? await getAgentAnalytics(profile) : await getLandlordAnalytics(profile)
    return ok(data)
  } catch (error) {
    return handleRouteError(error)
  }
}
