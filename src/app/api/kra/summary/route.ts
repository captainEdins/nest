/**
 * NEST — GET /api/kra/summary  (Phase 5 wedge B, issue #59)
 *
 * The landlord's Tax assistant screen payload: the calendar-year monthly
 * rent summary (billed vs collected, Jan–Dec, zeros included) plus the 7.5%
 * MRI estimate on collected rent — one call, one KraSummaryDto (money
 * definitions live in src/lib/kra.ts).
 *
 * Query: ?year= — 4-digit integer (e.g. 2025–2027); anything else is a 400
 * VALIDATION; absent → current year.
 *
 * LANDLORD only: every other role gets a real 403 via requireRole (the role
 * is re-derived from the DB session, never trusted from the client); no
 * session → 401 via requireProfile. Read-only by contract — this route
 * NEVER writes, so it records no AuditLog rows (a summary is observation,
 * not a money event).
 *
 * Record-keeping assistance only — NEVER tax advice (the UI carries a
 * persistent disclaimer; see kra.disclaimer).
 */

import { getKraYearSummary, parseYear } from "@/lib/kra"
import { handleRouteError, ok, requireRole } from "@/lib/auth-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const profile = await requireRole("LANDLORD")
    const year = parseYear(request)
    return ok(await getKraYearSummary(profile, year))
  } catch (error) {
    return handleRouteError(error)
  }
}
